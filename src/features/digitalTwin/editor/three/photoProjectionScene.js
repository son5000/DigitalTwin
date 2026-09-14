import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";

const vertexHeader = `
varying vec3 projectionWorldPosition;
varying vec3 projectionWorldNormal;
`;
const fragmentHeader = `
varying vec3 projectionWorldPosition;
varying vec3 projectionWorldNormal;
uniform sampler2D photo0;
uniform sampler2D photo1;
uniform mat4 projection0;
uniform mat4 projection1;
uniform vec3 projectorPosition0;
uniform vec3 projectorPosition1;
uniform float faces0[6];
uniform float faces1[6];
uniform bool enabled0;
uniform bool enabled1;
uniform bool firstPriority;
uniform vec4 crop0;
uniform vec4 crop1;
uniform vec3 framing0;
uniform vec3 framing1;
vec4 framedPhoto(sampler2D photo, vec2 uv, vec4 crop, vec3 framing) {
  // Crop coordinates are measured from the original image's top-left corner.
  uv = (uv - 0.5) / framing.z + vec2(0.5 + framing.x, 0.5 - framing.y);
  vec2 topLeftUV = vec2(uv.x, 1.0 - uv.y);
  if (any(lessThan(topLeftUV, crop.xy)) || any(greaterThan(topLeftUV, crop.xy + crop.zw))) return vec4(0.0);
  return texture2D(photo, uv);
}
int projectionFace(vec3 n) {
  vec3 a = abs(n);
  if (a.x > a.y && a.x > a.z) return n.x > 0.0 ? 0 : 1;
  if (a.y > a.z) return n.y > 0.0 ? 2 : 3;
  return n.z > 0.0 ? 4 : 5;
}
vec4 projectedPhoto(sampler2D photo, mat4 projection, vec3 eye, bool enabled, float allowed, vec4 crop, vec3 framing) {
  if (!enabled || allowed < 0.5) return vec4(0.0);
  if (dot(normalize(projectionWorldNormal), eye - projectionWorldPosition) <= 0.00001) return vec4(0.0);
  vec4 clip = projection * vec4(projectionWorldPosition, 1.0);
  if (clip.w <= 0.0) return vec4(0.0);
  vec3 ndc = clip.xyz / clip.w;
  if (any(greaterThan(abs(ndc), vec3(1.0)))) return vec4(0.0);
  return framedPhoto(photo, ndc.xy * 0.5 + 0.5, crop, framing);
}
`;

export function createPhotoProjectionScene(container, onError) {
  const palette = SCENE_THEMES[document.documentElement.dataset.theme] ?? SCENE_THEMES.light;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.005, 100);
  camera.position.set(0.65, 0.5, 0.7);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.1, 0);
  controls.minDistance = 0.08;
  controls.maxDistance = 8;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x71808c, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(1, 2, 3);
  scene.add(light);
  const grid = new THREE.GridHelper(2, 20, palette.grid, palette.grid);
  scene.add(grid);
  const uniforms = {
    firstPriority: { value: true },
  };
  const textures = [null, null];
  const sources = [null, null];
  let viewIndex = null;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let lastProjectors = [];
  let guidesVisible = false;
  const cameras = [0, 1].map(() => new THREE.PerspectiveCamera(45, 1, 0.005, 20));
  const helpers = cameras.map((c) => {
    const helper = new THREE.CameraHelper(c);
    scene.add(helper);
    return helper;
  });
  for (let i = 0; i < 2; i += 1) {
    uniforms[`photo${i}`] = { value: null };
    uniforms[`projection${i}`] = { value: new THREE.Matrix4() };
    uniforms[`projectorPosition${i}`] = { value: new THREE.Vector3() };
    uniforms[`faces${i}`] = { value: new Float32Array(6).fill(1) };
    uniforms[`enabled${i}`] = { value: false };
    uniforms[`crop${i}`] = { value: new THREE.Vector4(0, 0, 1, 1) };
    uniforms[`framing${i}`] = { value: new THREE.Vector3(0, 0, 1) };
  }
  const photoPlanes = cameras.map((c, i) => {
    const planeMaterial = new THREE.ShaderMaterial({
      uniforms: { photo: uniforms[`photo${i}`], crop: uniforms[`crop${i}`], framing: uniforms[`framing${i}`], opacity: { value: 0.4 } },
      vertexShader: 'varying vec2 photoUV; void main() { photoUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D photo; uniform vec4 crop; uniform vec3 framing; uniform float opacity; varying vec2 photoUV;
        ${fragmentHeader.slice(fragmentHeader.indexOf('vec4 framedPhoto'), fragmentHeader.indexOf('int projectionFace'))}
        void main() { gl_FragColor = framedPhoto(photo, photoUV, crop, framing); gl_FragColor.a *= opacity;
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMaterial);
    plane.renderOrder = 10;
    scene.add(plane);
    return plane;
  });
  const sightLines = cameras.map(() => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x19bdd4 }));
    scene.add(line);
    return line;
  });
  const material = new THREE.MeshStandardMaterial({ color: 0xd9e1e8, roughness: 0.75 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHeader + shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      projectionWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      projectionWorldNormal = normalize(mat3(modelMatrix) * normal);
    `);
    shader.fragmentShader = fragmentHeader + shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      int face = projectionFace(projectionWorldNormal);
      vec4 a = projectedPhoto(photo0, projection0, projectorPosition0, enabled0, faces0[face], crop0, framing0);
      vec4 b = projectedPhoto(photo1, projection1, projectorPosition1, enabled1, faces1[face], crop1, framing1);
      vec4 chosen = firstPriority ? (a.a > 0.01 ? a : b) : (b.a > 0.01 ? b : a);
      if (chosen.a > 0.01) diffuseColor.rgb = chosen.rgb;
    `);
  };
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  scene.add(box);
  let disposed = false;
  let hasSize = false;
  function render() {
    if (disposed || !hasSize) return;
    try {
      const activeCamera = viewIndex === null ? camera : cameras[viewIndex];
      photoPlanes.forEach((plane, i) => {
        plane.visible = Boolean(textures[i] && lastProjectors[i]?.showPlane && (viewIndex === null || viewIndex === i));
        helpers[i].visible = viewIndex === null && guidesVisible && Boolean(lastProjectors[i]?.enabled);
        sightLines[i].visible = helpers[i].visible;
      });
      // Match the photograph aspect ratio without changing the user's free-view camera.
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, viewportWidth, viewportHeight);
      renderer.clear();
      if (viewIndex !== null) {
        const width = Math.min(viewportWidth, viewportHeight * activeCamera.aspect);
        const height = width / activeCamera.aspect;
        const x = Math.round((viewportWidth - width) / 2), y = Math.round((viewportHeight - height) / 2);
        renderer.setViewport(x, y, Math.round(width), Math.round(height));
        renderer.setScissor(x, y, Math.round(width), Math.round(height));
        renderer.setScissorTest(true);
      }
      renderer.render(scene, activeCamera);
      renderer.setScissorTest(false);
    }
    catch (error) { console.error("[사진 투영 테스트]", error); onError("3D 화면을 렌더링하지 못했습니다."); }
  }
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    hasSize = width > 0 && height > 0;
    if (!hasSize) return;
    viewportWidth = Math.round(width); viewportHeight = Math.round(height);
    renderer.setSize(Math.round(width), Math.round(height), false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  controls.addEventListener("change", render);
  const lost = (event) => { event.preventDefault(); onError("그래픽 연결이 끊겼습니다. 테스트를 닫고 다시 열어주세요."); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    update({ dimensions, photos, projectors, priority, showGuides }) {
      lastProjectors = projectors;
      guidesVisible = showGuides;
      // The editor uses metres; dimensions in this test are entered in centimetres.
      box.scale.set(dimensions.x / 100, dimensions.y / 100, dimensions.z / 100);
      box.position.y = dimensions.y / 200;
      uniforms.firstPriority.value = priority === 0;
      projectors.forEach((config, i) => {
        if (sources[i] !== photos[i]?.canvas) {
          textures[i]?.dispose();
          sources[i] = photos[i]?.canvas;
          textures[i] = sources[i] ? new THREE.CanvasTexture(sources[i]) : null;
          if (textures[i]) {
            textures[i].colorSpace = THREE.SRGBColorSpace;
            textures[i].anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            const limit = renderer.capabilities.maxTextureSize;
            if (sources[i].width > limit || sources[i].height > limit) {
              const canvas = document.createElement("canvas");
              const factor = limit / Math.max(sources[i].width, sources[i].height);
              canvas.width = Math.max(1, Math.round(sources[i].width * factor));
              canvas.height = Math.max(1, Math.round(sources[i].height * factor));
              canvas.getContext("2d").drawImage(sources[i], 0, 0, canvas.width, canvas.height);
              textures[i].image = canvas;
            }
          }
          uniforms[`photo${i}`].value = textures[i];
        }
        const c = cameras[i];
        c.position.fromArray(config.position);
        const target = new THREE.Vector3().fromArray(config.target);
        const valid = c.position.distanceToSquared(target) > 0.000001;
        c.up.set(0, 1, 0);
        if (valid) c.lookAt(target);
        c.fov = config.fov;
        c.aspect = photos[i] ? photos[i].width / photos[i].height : 1;
        c.far = Math.max(0.1, c.position.distanceTo(target) * 1.25);
        c.updateProjectionMatrix();
        c.updateMatrixWorld(true);
        uniforms[`projection${i}`].value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
        uniforms[`projectorPosition${i}`].value.copy(c.position);
        uniforms[`faces${i}`].value.set(config.faces.map(Number));
        uniforms[`enabled${i}`].value = Boolean(textures[i] && config.enabled && valid);
        uniforms[`crop${i}`].value.fromArray(config.crop);
        uniforms[`framing${i}`].value.set(config.pan[0], config.pan[1], config.zoom);
        const distance = Math.max(0.01, c.position.distanceTo(target) * 0.5);
        const plane = photoPlanes[i];
        plane.position.copy(c.position).add(new THREE.Vector3(0, 0, -distance).applyQuaternion(c.quaternion));
        plane.quaternion.copy(c.quaternion);
        const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
        plane.scale.set(height * c.aspect, height, 1);
        plane.material.uniforms.opacity.value = config.planeOpacity;
        const points = sightLines[i].geometry.attributes.position;
        points.setXYZ(0, ...config.position); points.setXYZ(1, ...config.target); points.needsUpdate = true;
        sightLines[i].geometry.computeBoundingSphere();
        helpers[i].visible = showGuides && config.enabled && valid;
        helpers[i].update();
      });
      render();
    },
    viewPhoto(index) { viewIndex = index; controls.enabled = index === null; render(); },
    fit() { controls.target.copy(box.position); camera.position.copy(box.position).add(new THREE.Vector3(1, 0.8, 1.2).multiplyScalar(Math.max(...box.scale.toArray()) * 2)); controls.update(); render(); },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      textures.forEach((texture) => texture?.dispose());
      helpers.forEach((helper) => helper.dispose());
      [...photoPlanes, ...sightLines].forEach((object) => { object.geometry.dispose(); object.material.dispose(); });
      box.geometry.dispose();
      material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
