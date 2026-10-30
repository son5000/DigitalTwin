import * as THREE from "three";
import { applySensorView, fitSensorCameraNear } from "./sensorCamera.js";
import { projectionMeshes } from "./sensorProjectionLayer.js";

const SIZE = 512;
const vertexShader = `
  uniform mat4 projectorMatrix;
  varying vec4 projected;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    projected = projectorMatrix * world;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const fragmentShader = `
  #include <packing>
  uniform sampler2D surfaceDepth;
  uniform float cameraFar;
  varying vec4 projected;
  void main() {
    if (projected.w <= 0.0) discard;
    vec2 uv = clamp(projected.xy / projected.w * 0.5 + 0.5, vec2(0.5 / 512.0), vec2(1.0 - 0.5 / 512.0));
    float distance = unpackRGBAToDepth(texture2D(surfaceDepth, uv)) * cameraFar;
    if (projected.w > distance + max(0.0005, cameraFar / 16777216.0)) discard;
    gl_FragColor = vec4(0.067, 0.392, 1.0, 0.3);
    #include <colorspace_fragment>
  }`;

// Clip guides from the SENSOR's viewpoint, not just the viewer's depth buffer.
// A cached GPU depth pass avoids CPU raycasts through millions of scan triangles.
// Only the guide's display length changes; saved camera/projection ranges do not.
export function createSensorFrustumLayer({ renderer, renderedEquipment }) {
  const states = new Map();
  const depthMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { cameraFar: { value: 10 } },
    vertexShader: `varying float distance;
      void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
        distance = -p.z; gl_Position = projectionMatrix * p; gl_PointSize = 2.0; }`,
    fragmentShader: `#include <packing>
      uniform float cameraFar; varying float distance;
      void main() { gl_FragColor = packDepthToRGBA(clamp(distance / cameraFar, 0.0, 1.0)); }`,
  });
  const hiddenMaterial = depthMaterial.clone();
  hiddenMaterial.visible = false;
  function remove(id) {
    states.get(id)?.target.dispose();
    states.delete(id);
  }
  return {
    addCameraFrustum(marker, sensor) {
      remove(sensor.id);
      const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      const line = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
        vertexShader, fragmentShader, transparent: true, depthWrite: false,
        uniforms: { surfaceDepth: { value: target.texture }, cameraFar: { value: 10 }, projectorMatrix: { value: new THREE.Matrix4() } },
      }));
      line.visible = false;
      line.raycast = () => {};
      marker.add(line);
      states.set(sensor.id, { marker, line, target, camera: new THREE.PerspectiveCamera() });
    },
    update(sensors) {
      for (const [id, state] of states) {
        if (!state.marker.parent || !sensors.some((sensor) => sensor.id === id)) remove(id);
      }
      for (const sensor of sensors) {
        const state = states.get(sensor.id);
        if (!state) continue;
        const { marker, camera, line, target } = state;
        const entry = renderedEquipment.get(sensor.textureProjection?.equipmentId ?? sensor.equipmentIds?.[0]);
        line.visible = false;
        if (!marker.visible || !entry || entry.loading) continue;
        const roots = [entry.actual, entry.proxy].filter(Boolean);
        const surfaces = roots.flatMap(projectionMeshes).map(({ object }) => object).filter((object) => {
          for (let current = object; current; current = current.parent) if (!current.visible) return false;
          return (Array.isArray(object.material) ? object.material : [object.material])
            .some((material) => material?.visible && (!material.transparent || material.opacity > 0.001));
        });
        if (!surfaces.length) continue;
        applySensorView(camera, marker, sensor);
        fitSensorCameraNear(camera, roots);
        const key = [camera.projectionMatrix.elements, camera.matrixWorld.elements];
        const bounds = new THREE.Box3(), localBounds = new THREE.Box3(), modelView = new THREE.Matrix4();
        for (const object of surfaces) {
          object.updateWorldMatrix(true, false);
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          modelView.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
          bounds.union(localBounds.copy(object.geometry.boundingBox).applyMatrix4(modelView));
          key.push(object.uuid, object.geometry.uuid, object.geometry.attributes.position?.version,
            object.matrixWorld.elements, (Array.isArray(object.material) ? object.material : [object.material]).map((m) => Boolean(m?.visible && (!m.transparent || m.opacity > 0.001))));
        }
        const length = Math.min(camera.far, -bounds.min.z);
        if (length <= camera.near) continue;
        const signature = JSON.stringify(key);
        if (state.signature !== signature) {
          const scene = new THREE.Scene();
          depthMaterial.uniforms.cameraFar.value = camera.far;
          for (const object of surfaces) {
            const materials = (Array.isArray(object.material) ? object.material : [object.material])
              .map((m) => m?.visible && (!m.transparent || m.opacity > 0.001) ? depthMaterial : hiddenMaterial);
            const copy = object.isPoints ? new THREE.Points(object.geometry, materials[0])
              : new THREE.Mesh(object.geometry, Array.isArray(object.material) ? materials : materials[0]);
            copy.matrixAutoUpdate = false; copy.matrix.copy(object.matrixWorld); scene.add(copy);
          }
          const previous = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4());
          const scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest();
          const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
          try {
            renderer.setRenderTarget(target); renderer.setViewport(0, 0, SIZE, SIZE); renderer.setScissorTest(false);
            renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, camera);
          } finally {
            renderer.setRenderTarget(previous); renderer.setViewport(viewport); renderer.setScissor(scissor);
            renderer.setScissorTest(scissorTest); renderer.setClearColor(color, alpha);
            // Copies borrow geometry and materials; never dispose scan resources.
            scene.clear();
          }
          const radius = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * length, width = radius * camera.aspect;
          const corners = [[-width, -length, -radius], [width, -length, -radius], [width, -length, radius], [-width, -length, radius]].map((p) => new THREE.Vector3(...p));
          const points = [];
          corners.forEach((point, i) => points.push(new THREE.Vector3(), point, point, corners[(i + 1) % 4]));
          line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(points);
          line.material.uniforms.projectorMatrix.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          line.material.uniforms.cameraFar.value = camera.far;
          state.signature = signature;
        }
        line.visible = true;
      }
    },
    dispose() { states.forEach((state) => state.target.dispose()); states.clear(); depthMaterial.dispose(); hiddenMaterial.dispose(); },
  };
}
