import * as THREE from "three";
import { applySensorView, fitSensorCameraNear } from "./sensorCamera.js";
import { getEnclosureSurfaces } from "../model/equipmentEnclosure.js";
import { normalizeSensorProjection, sensorProjectionFrame, temperaturePixels } from "../model/sensorProjection.js";
import { temperatureSummary } from "../model/thermalFrame.js";
import { isFreshMeasurement, mediaUrl } from "../model/monitoringContract.js";
import { sensorImageTransform } from "../model/sensorImageTransform.js";
import { imageSurfaceMatrix, resolveImageSurface } from "../model/textureSurfaceMapping.js";
import { isProjectionVisible, pickVisionProjection } from "./visionProjectionPicking.js";

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
  varying vec3 worldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    worldNormal = normalize(worldNormalMatrix * normal);
    projected = projectorMatrix * world;
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_PointSize = 2.0;
  }`;
const DEPTH_SIZE = 1024;
// Store linear camera distance; a fixed tolerance in perspective depth changes
// by orders of magnitude between a close-up scan and a distant one.
const depthVertexShader = `
  varying float cameraDistance;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    cameraDistance = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = 2.0;
  }`;
const depthFragmentShader = `
  #include <packing>
  uniform float cameraFar;
  varying float cameraDistance;
  void main() { gl_FragColor = packDepthToRGBA(clamp(cameraDistance / cameraFar, 0.0, 1.0)); }
`;
const fragmentShader = `
  #include <packing>
  uniform sampler2D imageMap;
  uniform sampler2D projectorDepth;
  uniform float projectorFar;
  uniform vec2 depthTexelSize;
  uniform vec3 faceNormal;
  uniform bool restrictFace;
  uniform bool pointCloud;
  uniform bool surfaceMapped;
  uniform mat3 imageTransform;
  uniform bool perspectiveEnabled;
  uniform vec2 sourceQuad[4];
  uniform vec4 crop;
  uniform float opacity;
  varying vec4 projected;
  varying vec3 worldNormal;
  void main() {
    if (projected.w <= 0.0) discard;
    vec3 projectedUV = surfaceMapped ? vec3(projected.xy, 0.0) : projected.xyz / projected.w * 0.5 + 0.5;
    if (any(lessThan(projectedUV, vec3(0.0))) || any(greaterThan(projectedUV, vec3(1.0)))) discard;
    if (!surfaceMapped) {
      // Scans can have inverted/smoothed vertex normals. The first visible
      // surface in the depth pass decides occlusion, including double-sided scans.
      vec2 dx = dFdx(projectedUV.xy), dy = dFdy(projectedUV.xy);
      float inverseDistance = 1.0 / projected.w;
      float dzdx = dFdx(inverseDistance), dzdy = dFdy(inverseDistance);
      float determinant = dx.x * dy.y - dx.y * dy.x;
      vec2 slope = abs(determinant) > 1e-12
        ? vec2(dy.y * dzdx - dx.y * dzdy, dx.x * dzdy - dy.x * dzdx) / determinant : vec2(0.0);
      // Compare at the depth texel's centre on the receiver plane. This avoids
      // treating a slanted surface as its own occluder at short distances.
      vec2 base = (floor(projectedUV.xy / depthTexelSize - 0.5) + 0.5) * depthTexelSize;
      float visibleSamples = 0.0;
      for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
        vec2 sampleUV = clamp(base + vec2(float(x), float(y)) * depthTexelSize, depthTexelSize * 0.5, 1.0 - depthTexelSize * 0.5);
        float nearestDistance = unpackRGBAToDepth(texture2D(projectorDepth, sampleUV)) * projectorFar;
        float receiverInverse = inverseDistance + dot(slope, sampleUV - projectedUV.xy);
        float receiverDistance = 1.0 / max(receiverInverse, 1e-12);
        // 0.5 mm in model/world metres, plus packed-depth rounding tolerance.
        if (receiverDistance <= nearestDistance + max(0.0005, projectorFar / 16777216.0)) visibleSamples += 1.0;
      }
      if (visibleSamples == 0.0) discard;
    }
    if (!pointCloud && restrictFace && dot(normalize(worldNormal), faceNormal) < 0.9) discard;
    vec3 homogeneous = imageTransform * vec3(projectedUV.xy, 1.0);
    if (abs(homogeneous.z) < 0.00000001) discard;
    vec2 uv = homogeneous.xy / homogeneous.z;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    if (perspectiveEnabled) {
      for (int i = 0; i < 4; i++) {
        vec2 edge = sourceQuad[(i + 1) % 4] - sourceQuad[i];
        vec2 delta = uv - sourceQuad[i];
        if (edge.x * delta.y - edge.y * delta.x > 0.0000001) discard;
      }
    }
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
    state.texture?.dispose(); state.depthLayers.forEach((layer) => layer.target.dispose()); state.depthMaterial?.dispose();
  }
  function createState(sensor) {
    const kind = normalizeSensorProjection(sensor.textureProjection).kind;
    const state = { id: sensor.id, kind, depthLayers: new Map(), depthMaterial: kind === "THERMAL" ? new THREE.ShaderMaterial({
      vertexShader: depthVertexShader, fragmentShader: depthFragmentShader, uniforms: { cameraFar: { value: 10 } }, side: THREE.DoubleSide,
    }) : null, camera: new THREE.PerspectiveCamera(), targets: [], generation: 0, texture: null };
    return state;
  }
  function depthPass(state, layer) {
    const target = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(), color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(layer.target); renderer.setViewport(0, 0, DEPTH_SIZE, DEPTH_SIZE); renderer.setScissorTest(false);
      renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(layer.scene, state.camera);
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
        const p = normalizeSensorProjection(sensor.textureProjection), surfaceMapped = p.kind === "VISION", marker = markers.get(sensor.id);
        const entry = renderedEquipment.get(p.equipmentId ?? sensor.equipmentIds?.[0]);
        if (!entry || (!surfaceMapped && !marker)) { const previous = states.get(sensor.id); if (previous) { clearState(previous); states.delete(sensor.id); } continue; }
        let state = states.get(sensor.id);
        if (state && state.kind !== p.kind) { clearState(state); states.delete(sensor.id); state = null; }
        if (!state) { state = createState(sensor); states.set(sensor.id, state); }
        const roots = [["ACTUAL", entry.actual], ["PROXY", entry.proxy]].filter(([kind, root]) => root && (p.target === "BOTH" || p.target === kind));
        const geometryKey = JSON.stringify([roots.map(([kind, root]) => [kind, root.uuid]), p.surfaceId, p.meshPath]);
        if (geometryKey !== state.geometryKey) {
          state.targets.forEach(({ overlay }) => { overlay.removeFromParent(); overlay.material.dispose(); });
          state.targets = []; state.depthLayers.forEach((layer) => layer.target.dispose()); state.depthLayers.clear(); state.depthKey = ""; state.uniformKey = "";
          for (const [kind, root] of roots) {
            // PROXY and ACTUAL describe alternative representations of the same
            // equipment. Their envelopes must not shadow each other's projection.
            const depthLayer = surfaceMapped ? null : { target: new THREE.WebGLRenderTarget(DEPTH_SIZE, DEPTH_SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), scene: new THREE.Scene(), occluders: [] };
            if (depthLayer) state.depthLayers.set(kind, depthLayer);
            for (const { object, path } of projectionMeshes(root)) {
              if (!surfaceMapped) {
                const depthObject = object.isPoints ? new THREE.Points(object.geometry, state.depthMaterial) : new THREE.Mesh(object.geometry, state.depthMaterial);
                depthObject.matrixAutoUpdate = false; depthLayer.scene.add(depthObject); depthLayer.occluders.push({ object, depthObject });
              }
              const panel = object.userData.enclosurePanel;
              if (kind === "ACTUAL" && p.meshPath !== null && p.meshPath !== path) continue;
              if (kind === "PROXY" && p.surfaceId && !(p.surfaceId === panel || (panel && p.surfaceId.startsWith(`${panel}-`)))) continue;
              const uniforms = {
                imageMap: { value: state.texture }, projectorDepth: { value: depthLayer?.target.texture ?? null }, surfaceMapped: { value: surfaceMapped },
                projectorFar: { value: 10 }, depthTexelSize: { value: new THREE.Vector2(1 / DEPTH_SIZE, 1 / DEPTH_SIZE) },
                projectorMatrix: { value: new THREE.Matrix4() }, worldNormalMatrix: { value: new THREE.Matrix3() },
                faceNormal: { value: new THREE.Vector3() }, restrictFace: { value: false }, pointCloud: { value: Boolean(object.isPoints) },
                imageTransform: { value: new THREE.Matrix3() }, crop: { value: new THREE.Vector4() }, opacity: { value: 1 },
                perspectiveEnabled: { value: false }, sourceQuad: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
              };
              const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
              const overlay = object.isPoints ? new THREE.Points(object.geometry, material) : new THREE.Mesh(object.geometry, material);
              overlay.userData.monitoringOverlay = true; overlay.raycast = () => {}; overlay.renderOrder = surfaceMapped ? 3 : 4; overlay.visible = false;
              object.add(overlay); state.targets.push({ overlay, object, kind });
            }
          }
          state.geometryKey = geometryKey;
        }
        const frame = sensorProjectionFrame(sensor, options.textures, options.now, options.demo);
        const frameKey = frame ? JSON.stringify([frame.url, frame.measuredAt, frame.loadedAt, p.palette]) : "";
        if (frameKey !== state.frameKey || frame?.temperatureGrid !== state.temperatureGrid) {
          state.frameKey = frameKey; state.temperatureGrid = frame?.temperatureGrid; const generation = ++state.generation;
          const accept = (texture) => {
            if (disposed || generation !== state.generation) { texture.dispose(); return; }
            state.texture?.dispose(); state.texture = texture; state.ready = true; state.error = ""; state.displayedFrame = frame;
            texture.colorSpace = THREE.SRGBColorSpace;
            state.targets.forEach(({ overlay }) => { overlay.material.uniforms.imageMap.value = texture; });
          };
          if (!frame || state.displayedFrame?.kind !== frame.kind || Boolean(state.displayedFrame?.sample) !== Boolean(frame.sample)) state.ready = false;
          if (frame?.temperatureGrid) {
            const summary = temperatureSummary(frame.temperatureGrid);
            const pixels = summary && temperaturePixels(frame.temperatureGrid, summary.min, summary.max, p.palette);
            if (pixels) { const texture = new THREE.DataTexture(pixels, frame.temperatureGrid.width, frame.temperatureGrid.height); texture.needsUpdate = true; accept(texture); }
            else { state.ready = false; state.error = "수신한 온도 분포의 유효한 픽셀을 확인하세요."; }
          } else if (frame) {
            const url = mediaUrl(frame.url, options.demo || sensor.dataSource === "DEMO");
            new THREE.TextureLoader().load(url, accept, undefined, () => { if (!disposed && generation === state.generation) state.error = "영상을 불러오지 못했습니다. 이미지 주소와 접근 권한을 확인하세요."; });
          }
        }
        const enabled = (surfaceMapped && options.continuousVision) || !options.mode || options.mode === p.kind;
        const show = Boolean(enabled && frame && state.ready && ((frame.sample && state.displayedFrame?.sample) || isFreshMeasurement(state.displayedFrame, options.now)));
        if (enabled && state.error) errors.push(`${sensor.name}: ${state.error}`);
        else if (enabled && !frame) errors.push(`${sensor.name}: 최신 ${p.kind === "THERMAL" ? "온도 분포·열화상" : "영상"} 수신 대기`);
        else if (enabled && !state.targets.length) errors.push(`${sensor.name}: 적용할 모델이나 면을 다시 선택하세요.`);
        entry.object.updateWorldMatrix(true, false);
        const imageSurface = surfaceMapped ? resolveImageSurface(entry.item, p) : null;
        if (!surfaceMapped) { applySensorView(state.camera, marker, sensor); fitSensorCameraNear(state.camera, roots.map(([, root]) => root)); state.depthMaterial.uniforms.cameraFar.value = state.camera.far; }
        const projection = surfaceMapped ? imageSurfaceMatrix(imageSurface, entry.object.matrixWorld)
          : new THREE.Matrix4().multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        const surface = p.surfaceId ? getEnclosureSurfaces(entry.item).find((s) => s.id === p.surfaceId) : null;
        const surfaceNormal = (surfaceMapped ? new THREE.Vector3(...imageSurface.normal) : surface?.normal.clone())
          ?.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(entry.object.matrixWorld));
        const depthParts = [projection.elements.join(","), JSON.stringify(entry.item.enclosure), JSON.stringify(entry.layerSource)];
        for (const [, root] of roots) { root.updateWorldMatrix(true, false); depthParts.push(`${root.visible}:${root.matrixWorld.elements.join(",")}`); }
        for (const [kind, layer] of state.depthLayers) for (const { object, depthObject } of layer.occluders) {
          object.updateWorldMatrix(true, false); depthObject.matrix.copy(object.matrixWorld);
          depthObject.visible = visible(object) && (Array.isArray(object.material) ? object.material : [object.material]).some((material) => material?.visible && material.opacity > 0);
          depthParts.push(`${kind}:${object.uuid}:${depthObject.visible}:${object.matrixWorld.elements.join(",")}`);
        }
        const depthKey = depthParts.join("|");
        if (show && !surfaceMapped && depthKey !== state.depthKey) {
          state.depthLayers.forEach((layer) => depthPass(state, layer)); state.depthKey = depthKey;
        }
        const uniformKey = `${depthKey}:${JSON.stringify(p)}:${JSON.stringify(entry.layerSource)}:${show}:${state.texture?.uuid}:${options.opacity}`;
        if (uniformKey === state.uniformKey) continue;
        state.uniformKey = uniformKey;
        const imageTransform = sensorImageTransform(sensor).targetUvToCropUv;
        for (const { overlay, object, kind } of state.targets) {
          object.updateWorldMatrix(true, false);
          overlay.visible = show && visible(object) && !(kind === "PROXY" && p.surfaceId && !surface);
          const u = overlay.material.uniforms;
          u.projectorMatrix.value.copy(projection);
          u.projectorFar.value = state.camera.far;
          u.worldNormalMatrix.value.getNormalMatrix(object.matrixWorld);
          u.restrictFace.value = Boolean(surfaceMapped || (kind === "PROXY" && surfaceNormal));
          if (surfaceNormal) u.faceNormal.value.copy(surfaceNormal);
          u.imageTransform.value.set(...imageTransform);
          u.perspectiveEnabled.value = p.perspective.enabled;
          p.perspective.source.forEach((point, index) => u.sourceQuad.value[index].set(...point));
          u.crop.value.set(p.cropX, p.cropY, Math.min(p.cropWidth, 1 - p.cropX), Math.min(p.cropHeight, 1 - p.cropY));
          u.opacity.value = p.opacity * (surfaceMapped && options.continuousVision ? 1 : options.opacity ?? 1) * (entry.layerSource?.[kind]?.opacity ?? (kind === "PROXY" ? entry.item.enclosure?.opacity ?? entry.item.appearance?.opacity ?? 1 : 1));
        }
      }
      const error = [...new Set(errors)].join(" · ");
      if (error !== lastError) { lastError = error; onError(error); }
    },
    isVisible(sensorId) { return states.get(sensorId)?.targets.some(({overlay})=>isProjectionVisible(overlay)) ?? false; },
    pickVisionSurface(sensorId, raycaster) { return pickVisionProjection(states.get(sensorId)?.targets ?? [],raycaster); },
    pickObservationSurface(kind, equipmentId, raycaster, sensorId = null) {
      const hits = [], entry = renderedEquipment.get(equipmentId);
      if (!entry) return null;
      for (const sensor of getSensors() ?? []) {
        const p = normalizeSensorProjection(sensor.textureProjection), state = states.get(sensor.id);
        if (!state?.ready || p.kind !== kind || (sensorId && sensor.id !== sensorId)
          || (p.equipmentId ?? sensor.equipmentIds?.[0]) !== equipmentId) continue;
        const hit = pickVisionProjection(state.targets, raycaster, (candidate) => {
          if (kind !== "THERMAL") return true;
          const grid = state.displayedFrame?.temperatureGrid;
          if (grid) {
            const [u, v] = candidate.sourceUv;
            const index = Math.min(grid.height - 1, Math.floor(v * grid.height)) * grid.width + Math.min(grid.width - 1, Math.floor(u * grid.width));
            if (!Number.isFinite(grid.values[index])) return false;
          }
          // Same representation and first-surface rule as the thermal depth pass.
          const origin = state.camera.getWorldPosition(new THREE.Vector3());
          const direction = candidate.point.clone().sub(origin), distance = direction.length();
          const probe = new THREE.Raycaster(origin, direction.normalize(), 0, Math.max(0, distance - .0005));
          const layer = state.depthLayers.get(candidate.representation);
          layer?.scene.updateMatrixWorld(true);
          return !probe.intersectObjects(layer?.scene.children.filter((o) => o.visible) ?? [], false).length;
        });
        if (hit) {
          entry.object.updateWorldMatrix(true, false);
          hits.push({ ...hit, sensor, frame: state.displayedFrame,
            projectorMatrix: new THREE.Matrix4().multiplyMatrices(hit.target.overlay.material.uniforms.projectorMatrix.value, entry.object.matrixWorld).toArray() });
        }
      }
      hits.sort((a,b) => Math.abs(a.distance-b.distance) < 1e-5 ? b.target.overlay.id-a.target.overlay.id : a.distance-b.distance);
      const hit = hits[0];
      if (!hit) return null;
      const foreground = raycaster.intersectObjects([entry.actual, entry.proxy].filter((o) => o?.visible), true)
        .find((h) => !h.object.userData.monitoringOverlay && visible(h.object) && (h.object.isMesh || h.object.isPoints));
      return foreground && foreground.distance < hit.distance - .001 ? null : hit;
    },
    dispose() { disposed = true; states.forEach(clearState); states.clear(); },
  };
}
