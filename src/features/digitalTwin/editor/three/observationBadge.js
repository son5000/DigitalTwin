import * as THREE from "three";

const BADGE_HEIGHT = 24;
const MAX_BADGE_WIDTH = 180;
const TEXTURE_SCALE = 2;

// Screen-sized labels keep close-up inspections clear, regardless of model scale.
export function createObservationBadge(marker, point, index, status) {
  const canvas = document.createElement("canvas");
  // WebGL texture storage cannot resize after its first upload. Keep the backing
  // canvas fixed and crop its UVs when the badge expands or collapses.
  canvas.width = MAX_BADGE_WIDTH * TEXTURE_SCALE;
  canvas.height = BADGE_HEIGHT * TEXTURE_SCALE;
  const context = canvas.getContext("2d");
  if (!context) return;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  label.renderOrder = Infinity;
  label.frustumCulled = false;
  label.center.set(.5, 0);
  label.position.y = point.radius;
  label.userData.monitoringOverlay = true;
  label.userData.observationBadge = true;
  label.userData.pixelHeight = BADGE_HEIGHT;
  let expanded;
  label.userData.setExpanded = (next) => {
    if (expanded === next) return;
    expanded = next;
    const statusLabel = { EMPTY: "대기", NORMAL: "정상", WARNING: "주의", DANGER: "위험" }[status.level] ?? "대기";
    context.setTransform(TEXTURE_SCALE, 0, 0, TEXTURE_SCALE, 0, 0);
    context.clearRect(0, 0, MAX_BADGE_WIDTH, BADGE_HEIGHT);
    context.font = "600 12px sans-serif";
    const number = String(index + 1), originalName = point.name || "관측 영역";
    const prefix = `${number} · `, suffix = ` · ${statusLabel}`;
    let name = originalName;
    const nameWidth = Math.max(0, MAX_BADGE_WIDTH - 20 - context.measureText(prefix + suffix).width);
    while (context.measureText(name === originalName ? name : `${name}…`).width > nameWidth && name.length) name = name.slice(0, -1);
    if (name !== originalName) name += "…";
    const text = next ? `${prefix}${name}${suffix}` : number;
    const width = next ? Math.min(MAX_BADGE_WIDTH, Math.ceil(context.measureText(text).width) + 20) : BADGE_HEIGHT;
    context.fillStyle = "#16232c";
    context.beginPath(); context.roundRect(.5, .5, width - 1, 23, next ? 5 : 12); context.fill();
    context.strokeStyle = { DANGER: "#ff9879", WARNING: "#ffd071", NORMAL: "#9cdbca", EMPTY: "#97a9b4" }[status.level];
    context.lineWidth = 1; context.stroke();
    context.fillStyle = "#f0f5f8"; context.font = "600 12px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(text, width / 2, 12);
    label.userData.pixelWidth = width;
    texture.repeat.set(width / MAX_BADGE_WIDTH, 1);
    texture.needsUpdate = true;
  };
  label.userData.setExpanded(false);
  // Group priority is sorted before object priority, including transform handles.
  const overlay = new THREE.Group();
  overlay.renderOrder = Infinity;
  overlay.userData.monitoringOverlay = true;
  overlay.add(label);
  marker.add(overlay);
  return label;
}

const position = new THREE.Vector3(), projected = new THREE.Vector3(), parentScale = new THREE.Vector3(), viewport = new THREE.Vector4();
export function updateObservationBadge(label, camera, renderer, expanded) {
  label.userData.setExpanded(expanded);
  label.getWorldPosition(position).applyMatrix4(camera.matrixWorldInverse);
  label.visible = position.z < 0;
  if (!label.visible) return;
  renderer.getViewport(viewport);
  projected.copy(position).applyMatrix4(camera.projectionMatrix);
  label.visible = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1;
  if (!label.visible) return;
  const pixelX = (projected.x + 1) * viewport.z / 2;
  const width = label.userData.pixelWidth;
  const left = Math.max(6, Math.min(viewport.z - width - 6, pixelX - width / 2));
  label.center.set(THREE.MathUtils.clamp((pixelX - left) / width, 0, 1), (1 - projected.y) * viewport.w / 2 < 30 ? 1 : 0);
  const height = Math.max(1, viewport.w);
  const unitsPerPixel = camera.isPerspectiveCamera
    ? 2 * -position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom / height
    : (camera.top - camera.bottom) / camera.zoom / height;
  label.parent.getWorldScale(parentScale);
  label.scale.set(label.userData.pixelWidth * unitsPerPixel / Math.max(.00001, Math.abs(parentScale.x)),
    label.userData.pixelHeight * unitsPerPixel / Math.max(.00001, Math.abs(parentScale.y)), 1);
}
