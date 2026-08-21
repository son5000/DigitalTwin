export const SITE_OBJECT_GEOMETRY_MODES = Object.freeze({
  AREA: "AREA",
  LINEAR: "LINEAR",
  CLUSTER: "CLUSTER",
  PERIMETER: "PERIMETER",
  POINT: "POINT",
});

export const SITE_INTERACTION_MODES = Object.freeze({
  NAVIGATE: "NAVIGATE",
  AREA_SELECT: "AREA_SELECT",
  PLACE_OBJECT: "PLACE_OBJECT",
});

export const SITE_MATERIAL_OPTIONS = Object.freeze([
  { id: "CONCRETE", label: "콘크리트" },
  { id: "ASPHALT", label: "아스팔트" },
  { id: "METAL", label: "금속" },
  { id: "GRASS", label: "잔디" },
  { id: "PAINTED", label: "도장" },
]);

export const TREE_DEFAULT_SPACING = 4;
export const MAX_TREE_COUNT = 256;

export function getTreeCountForArea(width, depth, spacing = TREE_DEFAULT_SPACING) {
  const normalizedSpacing = Math.max(0.5, finite(spacing, TREE_DEFAULT_SPACING));
  const columns = Math.max(1, Math.ceil(Math.max(0.1, finite(width, 1)) / normalizedSpacing) + 1);
  const rows = Math.max(1, Math.ceil(Math.max(0.1, finite(depth, 1)) / normalizedSpacing) + 1);
  return Math.min(MAX_TREE_COUNT, columns * rows);
}

export const SITE_CREATION_TEMPLATES = Object.freeze([
  { id: "BUILDING", name: "건물", icon: "▦", category: "건축", createsBuilding: true, width: 24, depth: 16 },
  { id: "ROAD", name: "도로", icon: "═", category: "동선", geometryMode: SITE_OBJECT_GEOMETRY_MODES.LINEAR, color: "#555f64", material: "ASPHALT", width: 14, depth: 4, height: 0.08 },
  { id: "WALKWAY", name: "보행로", icon: "┄", category: "동선", geometryMode: SITE_OBJECT_GEOMETRY_MODES.LINEAR, color: "#89979c", material: "CONCRETE", width: 10, depth: 2, height: 0.06 },
  { id: "GRASS", name: "잔디", icon: "▧", category: "바닥", geometryMode: SITE_OBJECT_GEOMETRY_MODES.AREA, color: "#55765a", material: "GRASS", width: 8, depth: 8, height: 0.04 },
  { id: "TREE", name: "나무", icon: "♠", category: "조경", geometryMode: SITE_OBJECT_GEOMETRY_MODES.CLUSTER, color: "#4f7657", material: "GRASS", width: 8, depth: 8, height: 5 },
  { id: "PARKING", name: "주차장", icon: "P", category: "바닥", geometryMode: SITE_OBJECT_GEOMETRY_MODES.AREA, color: "#4f595e", material: "ASPHALT", width: 12, depth: 8, height: 0.07 },
  { id: "CAR", name: "자동차", icon: "▰", category: "환경", geometryMode: SITE_OBJECT_GEOMETRY_MODES.POINT, color: "#647e8c", material: "PAINTED", width: 1.9, depth: 4.5, height: 1.55 },
  { id: "EXTERIOR_FLOOR", name: "외부 바닥", icon: "▤", category: "바닥", geometryMode: SITE_OBJECT_GEOMETRY_MODES.AREA, color: "#8a9396", material: "CONCRETE", width: 8, depth: 8, height: 0.08 },
  { id: "FENCE", name: "울타리", icon: "╫", category: "경계", geometryMode: SITE_OBJECT_GEOMETRY_MODES.PERIMETER, color: "#6f7c81", material: "METAL", width: 8, depth: 8, height: 2 },
  { id: "STREETLIGHT", name: "가로등", icon: "†", category: "환경", geometryMode: SITE_OBJECT_GEOMETRY_MODES.CLUSTER, color: "#7d898d", material: "METAL", width: 8, depth: 3, height: 6 },
  { id: "OTHER", name: "기타 구조물", icon: "◇", category: "기타", geometryMode: SITE_OBJECT_GEOMETRY_MODES.AREA, color: "#7b878d", material: "CONCRETE", width: 4, depth: 4, height: 1 },
]);

export const SITE_CREATION_TEMPLATE_MAP = Object.fromEntries(
  SITE_CREATION_TEMPLATES.map((template) => [template.id, template]),
);

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createSitePlacementArea(templateId, position, cellSize = 1) {
  const template = SITE_CREATION_TEMPLATE_MAP[templateId];
  if (!template) return null;
  return {
    center: { x: finite(position?.x, 0), z: finite(position?.z, 0) },
    width: Math.max(0.5, finite(template.width, 4)),
    depth: Math.max(0.5, finite(template.depth, 4)),
    cellSize: Math.max(0.1, finite(cellSize, 1)),
  };
}

function createLinearPath(width, depth) {
  const alongX = width >= depth;
  const length = Math.max(width, depth);
  return {
    width: Math.max(0.5, Math.min(width, depth)),
    points: alongX
      ? [{ x: -length / 2, z: 0 }, { x: length / 2, z: 0 }]
      : [{ x: 0, z: -length / 2 }, { x: 0, z: length / 2 }],
  };
}

export function createSiteObjectFromArea(templateId, area, sequence = 1) {
  const template = SITE_CREATION_TEMPLATE_MAP[templateId];
  if (!template || template.createsBuilding) return null;
  const areaWidth = Math.max(0.5, finite(area.width, 1));
  const areaDepth = Math.max(0.5, finite(area.depth, 1));
  const isPoint = template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.POINT;
  const width = isPoint ? template.width : areaWidth;
  const depth = isPoint ? template.depth : areaDepth;

  return {
    id: `SITE_OBJECT_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    name: `${template.name} ${String(sequence).padStart(2, "0")}`,
    geometryMode: template.geometryMode,
    position: { x: finite(area.center?.x, 0), y: 0, z: finite(area.center?.z, 0) },
    rotation: { x: 0, y: 0, z: 0 },
    dimensions: { width, height: template.height, depth },
    appearance: { color: template.color, material: template.material },
    parameters: {
      count: template.id === "TREE"
        ? getTreeCountForArea(areaWidth, areaDepth)
        : template.id === "STREETLIGHT"
          ? Math.max(1, Math.round(Math.max(areaWidth, areaDepth) / 8))
          : 1,
      spacing: template.id === "FENCE" ? 2.5 : TREE_DEFAULT_SPACING,
      parkingAngle: 90,
    },
    path: template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR
      ? createLinearPath(areaWidth, areaDepth)
      : null,
    visible: true,
    locked: false,
  };
}

export function normalizeSiteObject(object, index = 0) {
  const template = SITE_CREATION_TEMPLATE_MAP[object?.type];
  if (!template || template.createsBuilding) return null;
  const width = Math.max(0.1, finite(object.dimensions?.width, template.width ?? 4));
  const depth = Math.max(0.1, finite(object.dimensions?.depth, template.depth ?? 4));

  return {
    ...object,
    id: typeof object.id === "string" ? object.id : `SITE_OBJECT_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    name: object.name ?? `${template.name} ${String(index + 1).padStart(2, "0")}`,
    geometryMode: template.geometryMode,
    position: { x: 0, y: 0, z: 0, ...object.position },
    rotation: { x: 0, y: 0, z: 0, ...object.rotation },
    dimensions: { width, height: Math.max(0.02, finite(object.dimensions?.height, template.height)), depth },
    appearance: { color: template.color, material: template.material, ...object.appearance },
    parameters: { count: 1, spacing: 4, parkingAngle: 90, ...object.parameters },
    path: template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR
      ? {
          width: Math.max(0.5, finite(object.path?.width, Math.min(width, depth))),
          points: Array.isArray(object.path?.points) && object.path.points.length >= 2
            ? object.path.points.map((point) => ({ x: finite(point.x, 0), z: finite(point.z, 0) }))
            : createLinearPath(width, depth).points,
        }
      : null,
    visible: object.visible !== false,
    locked: Boolean(object.locked),
  };
}
