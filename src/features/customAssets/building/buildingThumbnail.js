import { colorToCss, SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { BUILDING_ENTITY_TYPES, getMassWorldPoints, normalizeBuildingAssembly, resolveConnectorPath } from "./buildingAssembly.js";

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (letter) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[letter]);
}

export function createBuildingThumbnail(source, theme = "dark") {
  const asset = normalizeBuildingAssembly(source);
  const masses = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS);
  if (!masses.length) return "";
  const connectors = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR);
  const worldPoints = masses.flatMap(getMassWorldPoints);
  const xs = worldPoints.map((point) => point.x); const zs = worldPoints.map((point) => point.z);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  const width = maxX - minX || 1; const depth = maxZ - minZ || 1;
  const scale = Math.min(176 / width, 94 / depth);
  const point = ({ x, z }) => `${20 + (x - minX) * scale},${16 + (z - minZ) * scale}`;
  const sceneTheme = SCENE_THEMES[theme] ?? SCENE_THEMES.dark;
  const connectorSvg = connectors.map((connector) => `<polyline points="${resolveConnectorPath(asset, connector).map(point).join(" ")}" fill="none" stroke="${colorToCss(sceneTheme.connectionNormal)}" stroke-width="5" stroke-linecap="round"/>`).join("");
  const massSvg = masses.map((mass, index) => `<polygon points="${getMassWorldPoints(mass).map(point).join(" ")}" fill="${escapeXml(mass.color ?? asset.materials?.[0]?.color ?? colorToCss(sceneTheme.wallFill))}" fill-opacity="0.9" stroke="${index === 0 ? colorToCss(sceneTheme.selection) : colorToCss(sceneTheme.worldEdge)}" stroke-width="2"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="144" viewBox="0 0 216 144"><rect width="216" height="144" rx="16" fill="${colorToCss(sceneTheme.background)}"/><path d="M16 118H200" stroke="${colorToCss(sceneTheme.grid)}"/>${connectorSvg}${massSvg}<text x="16" y="134" fill="${escapeXml(sceneTheme.labelText)}" font-family="system-ui, sans-serif" font-size="12">${escapeXml(asset.name)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
