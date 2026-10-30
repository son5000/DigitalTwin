import * as THREE from "three";

const BADGE_HEIGHT = 30;
const COLLAPSED_WIDTH = 30;
const MAX_BADGE_WIDTH = 232;
const TEXTURE_SCALE = 2;

const STATUS = Object.freeze({
  EMPTY: { label: "대기", dark: "#aebdc5", light: "#536670" },
  NORMAL: { label: "정상", dark: "#8ed8c7", light: "#146f62" },
  WARNING: { label: "주의", dark: "#f0bd59", light: "#8a5800" },
  DANGER: { label: "위험", dark: "#ff9189", light: "#b83943" },
});

function fitText(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length && context.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return text ? `${text}…` : "";
}

// Keep a compact equipment tag visible and reveal operational detail only for
// the active or hovered ROI so the model remains the primary workspace.
export function createObservationBadge(marker, point, index, status, theme = "dark") {
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
  texture.magFilter = THREE.LinearFilter;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  label.renderOrder = Infinity;
  label.frustumCulled = false;
  label.center.set(.5, 0);
  const extent = point.geometryType === "PLANE" ? (point.planeHeight ?? .3) / 2 : point.radius ?? .15;
  label.position.y = extent + .035;
  label.userData.monitoringOverlay = true;
  label.userData.observationBadge = true;
  label.userData.pixelHeight = BADGE_HEIGHT;
  let expanded;
  label.userData.setExpanded = (next) => {
    if (expanded === next) return;
    expanded = next;
    const light = theme === "light";
    const operational = STATUS[status.level] ?? STATUS.EMPTY;
    const statusColor = operational[light ? "light" : "dark"];
    const background = light ? "rgba(247,250,251,.96)" : "rgba(9,18,25,.94)";
    const border = light ? "rgba(50,72,84,.30)" : "rgba(205,225,234,.24)";
    const primary = light ? "#18313d" : "#eef5f7";
    const secondary = light ? "#5d707b" : "#9fb0ba";
    context.setTransform(TEXTURE_SCALE, 0, 0, TEXTURE_SCALE, 0, 0);
    context.clearRect(0, 0, MAX_BADGE_WIDTH, BADGE_HEIGHT);
    context.font = "600 12px system-ui, sans-serif";
    const number = String(index + 1).padStart(2, "0"), originalName = point.name?.trim() || "관측 영역";
    const statusWidth = context.measureText(operational.label).width + 20;
    const nameWidth = Math.min(138, Math.max(58, context.measureText(originalName).width));
    const width = next ? Math.min(MAX_BADGE_WIDTH, 48 + nameWidth + statusWidth) : COLLAPSED_WIDTH;
    context.fillStyle = background;
    context.strokeStyle = border;
    context.lineWidth = 1;
    context.beginPath(); context.roundRect(.5, .5, width - 1, BADGE_HEIGHT - 1, 4); context.fill(); context.stroke();
    context.fillStyle = statusColor;
    context.fillRect(1.5, 6, 3, BADGE_HEIGHT - 12);
    context.textBaseline = "middle";
    context.fillStyle = next ? secondary : primary;
    context.font = "700 12px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.textAlign = next ? "left" : "center";
    context.fillText(number, next ? 11 : width / 2 + 1, BADGE_HEIGHT / 2 + .5);
    if (next) {
      context.strokeStyle = light ? "rgba(50,72,84,.18)" : "rgba(205,225,234,.16)";
      context.beginPath(); context.moveTo(39.5, 7); context.lineTo(39.5, BADGE_HEIGHT - 7); context.stroke();
      context.fillStyle = primary;
      context.font = "600 12px system-ui, sans-serif";
      context.textAlign = "left";
      context.fillText(fitText(context, originalName, nameWidth), 48, BADGE_HEIGHT / 2 + .5);
      context.fillStyle = statusColor;
      context.font = "700 12px system-ui, sans-serif";
      context.textAlign = "right";
      context.fillText(operational.label, width - 10, BADGE_HEIGHT / 2 + .5);
    }
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
  const left = Math.max(8, Math.min(viewport.z - width - 8, pixelX - width / 2));
  label.center.set(THREE.MathUtils.clamp((pixelX - left) / width, 0, 1), (1 - projected.y) * viewport.w / 2 < 36 ? 1 : 0);
  const height = Math.max(1, viewport.w);
  const unitsPerPixel = camera.isPerspectiveCamera
    ? 2 * -position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom / height
    : (camera.top - camera.bottom) / camera.zoom / height;
  label.parent.getWorldScale(parentScale);
  label.scale.set(label.userData.pixelWidth * unitsPerPixel / Math.max(.00001, Math.abs(parentScale.x)),
    label.userData.pixelHeight * unitsPerPixel / Math.max(.00001, Math.abs(parentScale.y)), 1);
}
