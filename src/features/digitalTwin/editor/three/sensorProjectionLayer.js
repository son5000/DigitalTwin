import * as THREE from "three";
import { applySensorView } from "./sensorCamera.js";
import { getEnclosureSurfaces } from "../model/equipmentEnclosure.js";
import { normalizeSensorProjection, sensorProjectionFrame, temperaturePixels } from "../model/sensorProjection.js";
import { isFreshMeasurement, mediaUrl } from "../model/monitoringContract.js";

export function projectionMeshes(root) {
  const result = [];
  function visit(object, path) {
    if (object.userData.monitoringOverlay || object.userData.sensorId) return;
    if ((object.isMesh || object.isPoints) && !object.isInstancedMesh) result.push({ object, path });
    object.children.forEach((child, index) => visit(child, path ? `${path}/${index}` : String(index)));
  }
  if (root) visit(root, "");
  return result;
}

const visible = (object) => {
  for (let current = object; current; current = current.parent) if (!current.visible) return false;
  return true;
};
const vertexShader = `
  uniform mat4 projectorMatrix;
  uniform mat3 worldNormalMatrix;
  varying vec4 projected;
  varying vec3 worldPosition;
  varying vec3 worldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    worldPosition = world.xyz;
    worldNormal = normalize(worldNormalMatrix * normal);
    projected = projectorMatrix * world;
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_PointSize = 2.0;
  }`;
const fragmentShader = `
  #include <packing>
  uniform sampler2D imageMap;
  uniform sampler2D projectorDepth;
  uniform vec3 projectorPosition;
  uniform vec3 faceNormal;
  uniform bool restrictFace;
  uniform bool pointCloud;
  uniform vec2 imageScale;
  uniform vec2 imageOffset;
  uniform vec4 crop;
  uniform float imageRotation;
  uniform float opacity;
  varying vec4 projected;
  varying vec3 worldPosition;
  varying vec3 worldNormal;
  void main() {
    if (projected.w <= 0.0) discard;
    vec3 projectedUV = projected.xyz / projected.w * 0.5 + 0.5;
    if (any(lessThan(projectedUV, vec3(0.0))) || any(greaterThan(projectedUV, vec3(1.0)))) discard;
    if (!pointCloud && dot(normalize(worldNormal), normalize(projectorPosition - worldPosition)) <= 0.0) discard;
    if (restrictFace && dot(normalize(worldNormal), faceNormal) < 0.9) discard;
    float nearestDepth = unpackRGBAToDepth(texture2D(projectorDepth, projectedUV.xy));
    if (projectedUV.z > nearestDepth + 0.001) discard;
    vec2 uv = projectedUV.xy - vec2(0.5) - imageOffset;
    float c = cos(imageRotation), s = sin(imageRotation);
    uv = mat2(c, -s, s, c) * uv / imageScale + vec2(0.5);
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    uv = crop.xy + uv * crop.zw;
    if (any(greaterThan(uv, vec2(1.0)))) discard;
    gl_FragColor = texture2D(imageMap, uv);
    gl_FragColor.a *= opacity;
    if (gl_FragColor.a < 0.001) discard;
    #include <colorspace_fragment>
  }`;

// Project raw sensor frames; UV-mapped server textures remain in monitoringLayers.
// Overlays share geometry, never modify/dispose scan geometry or its base material.
export function bindSensorProjectionLayer({ renderer, renderedEquipment, markers, getOptions, getSensors, onError = () => {} }) {
  const states = new Map();
  let disposed = false, lastError = "";
  function clearState(state) {
    state.generation++;
    for (const { overlay } of state.targets) { overlay.removeFromParent(); overlay.material.dispose(); }
    state.texture?.dispose(); state.depth.dispose(); state.depthMaterial.dispose();
  }
  function createState(sensor) {
    const depth = new THREE.WebGLRenderTarget(512, 512, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const state = { id: sensor.id, depth, depthScene: new THREE.Scene(), depthMaterial: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
      camera: new THREE.PerspectiveCamera(), targets: [], occluders: [], generation: 0, texture: null };
    state.depthScene.overrideMaterial = state.depthMaterial;
    return state;
  }
  function depthPass(state) {
    const target = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(), color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(state.depth); renderer.setViewport(0, 0, 512, 512); renderer.setScissorTest(false);
      renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(state.depthScene, state.camera);
    } finally {
      renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); renderer.setClearColor(color, alpha);
    }
  }
  return {
    update() {
      const options = getOptions() ?? {}, sensors = getSensors() ?? [];
      const active = sensors.filter((sensor) => sensor.textureProjection?.enabled);
      const errors = [];
      for (const [id, state] of states) if (!active.some((sensor) => sensor.id === id)) { clearState(state); states.delete(id); }
      for (const sensor of active) {
        const p = normalizeSensorProjection(sensor.textureProjection), marker = markers.get(sensor.id);
        const entry = renderedEquipment.get(sensor.surfaceMount?.equipmentId ?? sensor.equipmentIds?.[0]);
        if (!entry || !marker) { const previous = states.get(sensor.id); if (previous) { clearState(previous); states.delete(sensor.id); } continue; }
        let state = states.get(sensor.id);
        if (!state) { state = createState(sensor); states.set(sensor.id, state); }
        const roots = [["ACTUAL", entry.actual], ["PROXY", entry.proxy]].filter(([kind, root]) => root && (p.target === "BOTH" || p.target === kind));
        const geometryKey = JSON.stringify([roots.map(([kind, root]) => [kind, root.uuid]), p.surfaceId, p.meshPath]);
        if (geometryKey !== state.geometryKey) {
          state.targets.forEach(({ overlay }) => { overlay.removeFromParent(); overlay.material.dispose(); });
          state.targets = []; state.occluders = []; state.depthScene.clear(); state.depthKey = ""; state.uniformKey = "";
          for (const [kind, root] of roots) for (const { object, path } of projectionMeshes(root)) {
            const depthObject = object.isPoints ? new THREE.Points(object.geometry, state.depthMaterial) : new THREE.Mesh(object.geometry, state.depthMaterial);
            depthObject.matrixAutoUpdate = false; state.depthScene.add(depthObject); state.occluders.push({ object, depthObject });
            const panel = object.userData.enclosurePanel;
            if (kind === "ACTUAL" && p.meshPath !== null && p.meshPath !== path) continue;
            if (kind === "PROXY" && p.surfaceId && !(p.surfaceId === panel || (panel && p.surfaceId.startsWith(`${panel}-`)))) continue;
            const uniforms = {
              imageMap: { value: state.texture }, projectorDepth: { value: state.depth.texture },
              projectorMatrix: { value: new THREE.Matrix4() }, projectorPosition: { value: new THREE.Vector3() }, worldNormalMatrix: { value: new THREE.Matrix3() },
              faceNormal: { value: new THREE.Vector3() }, restrictFace: { value: false }, pointCloud: { value: Boolean(object.isPoints) },
              imageScale: { value: new THREE.Vector2() }, imageOffset: { value: new THREE.Vector2() }, crop: { value: new THREE.Vector4() },
              imageRotation: { value: 0 }, opacity: { value: 1 },
            };
            const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
            const overlay = object.isPoints ? new THREE.Points(object.geometry, material) : new THREE.Mesh(object.geometry, material);
            overlay.userData.monitoringOverlay = true; overlay.raycast = () => {}; overlay.renderOrder = 3; overlay.visible = false;
            object.add(overlay); state.targets.push({ overlay, object, kind });
          }
          state.geometryKey = geometryKey;
        }
        const frame = sensorProjectionFrame(sensor, options.textures, options.now, options.demo);
        const frameKey = frame ? JSON.stringify([frame.url, frame.measuredAt, p.temperatureMin, p.temperatureMax]) : "";
        if (frameKey !== state.frameKey) {
          state.frameKey = frameKey; const generation = ++state.generation;
          const accept = (texture) => {
            if (disposed || generation !== state.generation) { texture.dispose(); return; }
            state.texture?.dispose(); state.texture = texture; state.ready = true; state.error = ""; state.displayedFrame = frame;
            texture.colorSpace = THREE.SRGBColorSpace;
            state.targets.forEach(({ overlay }) => { overlay.material.uniforms.imageMap.value = texture; });
          };
          if (!frame || state.displayedFrame?.kind !== frame.kind) state.ready = false;
          if (frame?.temperatureGrid) {
            const pixels = temperaturePixels(frame.temperatureGrid, p.temperatureMin, p.temperatureMax);
            if (pixels) { const texture = new THREE.DataTexture(pixels, frame.temperatureGrid.width, frame.temperatureGrid.height); texture.needsUpdate = true; accept(texture); }
            else state.error = "온도 범위와 수신한 온도 분포를 확인하세요.";
          } else if (frame) {
            const url = mediaUrl(frame.url, options.demo || sensor.dataSource === "DEMO");
            new THREE.TextureLoader().load(url, accept, undefined, () => { if (!disposed && generation === state.generation) state.error = "영상을 불러오지 못했습니다. 이미지 주소와 접근 권한을 확인하세요."; });
          }
        }
        const show = Boolean(frame && state.ready && isFreshMeasurement(state.displayedFrame, options.now) && (!options.mode || options.mode === p.kind));
        if (state.error) errors.push(`${sensor.name}: ${state.error}`);
        else if (!frame) errors.push(`${sensor.name}: 최신 ${p.kind === "THERMAL" ? "온도 분포·열화상" : "영상"} 수신 대기`);
        else if (!state.targets.length) errors.push(`${sensor.name}: 적용할 모델이나 면을 다시 선택하세요.`);
        applySensorView(state.camera, marker, sensor);
        const projection = new THREE.Matrix4().multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        const surface = p.surfaceId ? getEnclosureSurfaces(entry.item).find((s) => s.id === p.surfaceId) : null;
        const surfaceNormal = surface?.normal.clone().transformDirection(entry.object.matrixWorld);
        const depthParts = [projection.elements.join(","), JSON.stringify(entry.item.enclosure), JSON.stringify(entry.layerSource)];
        for (const [, root] of roots) { root.updateWorldMatrix(true, false); depthParts.push(`${root.visible}:${root.matrixWorld.elements.join(",")}`); }
        const depthKey = depthParts.join("|");
        if (show && depthKey !== state.depthKey) {
          for (const { object, depthObject } of state.occluders) {
            object.updateWorldMatrix(true, false); depthObject.matrix.copy(object.matrixWorld);
            depthObject.visible = visible(object) && (Array.isArray(object.material) ? object.material : [object.material]).some((material) => material?.opacity > 0);
          }
          depthPass(state); state.depthKey = depthKey;
        }
        const uniformKey = `${depthKey}:${JSON.stringify(p)}:${JSON.stringify(entry.layerSource)}:${show}:${state.texture?.uuid}:${options.opacity}`;
        if (uniformKey === state.uniformKey) continue;
        state.uniformKey = uniformKey;
        for (const { overlay, object, kind } of state.targets) {
          overlay.visible = show && visible(object) && !(kind === "PROXY" && p.surfaceId && !surface);
          const u = overlay.material.uniforms;
          u.projectorMatrix.value.copy(projection); u.projectorPosition.value.copy(state.camera.position);
          u.worldNormalMatrix.value.getNormalMatrix(object.matrixWorld);
          u.restrictFace.value = Boolean(kind === "PROXY" && surfaceNormal);
          if (surfaceNormal) u.faceNormal.value.copy(surfaceNormal);
          u.imageScale.value.set(p.scaleX, p.scaleY); u.imageOffset.value.set(p.offsetX, p.offsetY);
          u.crop.value.set(p.cropX, p.cropY, Math.min(p.cropWidth, 1 - p.cropX), Math.min(p.cropHeight, 1 - p.cropY));
          u.imageRotation.value = THREE.MathUtils.degToRad(p.rotation); u.opacity.value = p.opacity * (options.opacity ?? 1) * (entry.layerSource?.[kind]?.opacity ?? (kind === "PROXY" ? entry.item.enclosure?.opacity ?? entry.item.appearance?.opacity ?? 1 : 1));
        }
      }
      const error = [...new Set(errors)].join(" · ");
      if (error !== lastError) { lastError = error; onError(error); }
    },
    dispose() { disposed = true; states.forEach(clearState); states.clear(); },
  };
}
