import {
  OBJECT_LIBRARY_DEFINITION_MAP,
  OBJECT_LIBRARY_DEFINITIONS,
  getDefaultObjectVariants,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { SITE_OBJECT_GEOMETRY_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates.types";
import { normalizeVerticalPath, VERTICAL_PATH_MODES } from "@/features/digitalTwin/editor/terrain/VerticalPathModel";

export { SITE_OBJECT_GEOMETRY_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates.types";

export const SITE_INTERACTION_MODES = Object.freeze({
  NAVIGATE: "NAVIGATE",
  AREA_SELECT: "AREA_SELECT",
  PLACE_OBJECT: "PLACE_OBJECT",
  EDIT_TERRAIN: "EDIT_TERRAIN",
});

export const SITE_MATERIAL_OPTIONS = Object.freeze([
  { id: "CONCRETE", label: "콘크리트" },
  { id: "ASPHALT", label: "아스팔트" },
  { id: "METAL", label: "금속" },
  { id: "GRASS", label: "잔디" },
  { id: "PAINTED", label: "도장" },
  { id: "GLASS", label: "유리" },
  { id: "BRICK", label: "벽돌" },
  { id: "SOIL", label: "토사" },
  { id: "ROCK", label: "암석" },
  { id: "GRAVEL", label: "자갈" },
]);

export const TREE_DEFAULT_SPACING = 4;
export const MAX_TREE_COUNT = 256;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getTreeCountForArea(width, depth, spacing = TREE_DEFAULT_SPACING) {
  const normalizedSpacing = Math.max(0.5, finite(spacing, TREE_DEFAULT_SPACING));
  const columns = Math.max(1, Math.ceil(Math.max(0.1, finite(width, 1)) / normalizedSpacing) + 1);
  const rows = Math.max(1, Math.ceil(Math.max(0.1, finite(depth, 1)) / normalizedSpacing) + 1);
  return Math.min(MAX_TREE_COUNT, columns * rows);
}

export const SITE_CREATION_TEMPLATES = OBJECT_LIBRARY_DEFINITIONS;
export const SITE_CREATION_TEMPLATE_MAP = OBJECT_LIBRARY_DEFINITION_MAP;

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

function getDefaultCount(template, width, depth) {
  if (template.assetKind === "VEGETATION") {
    return template.parameters?.count
      ?? getTreeCountForArea(width, depth, template.parameters?.spacing ?? TREE_DEFAULT_SPACING);
  }
  if (template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.CLUSTER) {
    return template.parameters?.count ?? Math.max(1, Math.round(Math.max(width, depth) / 8));
  }
  return template.parameters?.count ?? 1;
}

export function createSiteObjectFromArea(templateId, area, sequence = 1, variantOverrides = {}) {
  const template = SITE_CREATION_TEMPLATE_MAP[templateId];
  if (!template || template.createsBuilding) return null;
  const areaWidth = Math.max(0.5, finite(area?.width, template.width ?? 1));
  const areaDepth = Math.max(0.5, finite(area?.depth, template.depth ?? 1));
  const isPoint = template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.POINT;
  const width = isPoint ? template.width : areaWidth;
  const depth = isPoint ? template.depth : areaDepth;

  return {
    id: `SITE_OBJECT_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    objectDefinitionId: template.id,
    categoryId: template.categoryId,
    assetKind: template.assetKind,
    profile: template.profile,
    name: `${template.name} ${String(sequence).padStart(2, "0")}`,
    geometryMode: template.geometryMode,
    variants: { ...getDefaultObjectVariants(template), ...variantOverrides },
    position: { x: finite(area?.center?.x, 0), y: 0, z: finite(area?.center?.z, 0) },
    rotation: { x: 0, y: 0, z: 0 },
    dimensions: { width, height: template.height, depth },
    appearance: { color: template.color, material: template.material },
    parameters: {
      ...template.parameters,
      count: getDefaultCount(template, areaWidth, areaDepth),
      spacing: template.parameters?.spacing ?? (template.assetKind === "FENCE" ? 2.5 : TREE_DEFAULT_SPACING),
      parkingAngle: template.parameters?.parkingAngle ?? 90,
    },
    path: template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR
      ? { ...createLinearPath(areaWidth, areaDepth), elevationMode: VERTICAL_PATH_MODES.FOLLOW_TERRAIN }
      : null,
    visible: true,
    locked: false,
  };
}

export function normalizeSiteObject(object, index = 0) {
  const template = SITE_CREATION_TEMPLATE_MAP[object?.type ?? object?.objectDefinitionId];
  if (!template || template.createsBuilding) return null;
  const width = Math.max(0.1, finite(object.dimensions?.width, template.width ?? 4));
  const depth = Math.max(0.1, finite(object.dimensions?.depth, template.depth ?? 4));

  return {
    ...object,
    id: typeof object.id === "string" ? object.id : `SITE_OBJECT_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    objectDefinitionId: template.id,
    categoryId: template.categoryId,
    assetKind: template.assetKind,
    profile: template.profile,
    name: object.name ?? `${template.name} ${String(index + 1).padStart(2, "0")}`,
    geometryMode: template.geometryMode,
    variants: { ...getDefaultObjectVariants(template), ...object.variants },
    position: { x: 0, y: 0, z: 0, ...object.position },
    rotation: { x: 0, y: 0, z: 0, ...object.rotation },
    dimensions: { width, height: Math.max(0.02, finite(object.dimensions?.height, template.height)), depth },
    appearance: { color: template.color, material: template.material, ...object.appearance },
    parameters: {
      ...template.parameters,
      count: 1,
      spacing: TREE_DEFAULT_SPACING,
      parkingAngle: 90,
      ...object.parameters,
    },
    path: template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR
      ? normalizeVerticalPath({
          width: Math.max(0.5, finite(object.path?.width, Math.min(width, depth))),
          elevationMode: object.path?.elevationMode ?? object.parameters?.verticalPathMode ?? VERTICAL_PATH_MODES.FOLLOW_TERRAIN,
          points: Array.isArray(object.path?.points) && object.path.points.length >= 2
            ? object.path.points.map((point) => ({ ...point, x: finite(point.x, 0), z: finite(point.z, 0) }))
            : createLinearPath(width, depth).points,
        })
      : null,
    visible: object.visible !== false,
    locked: Boolean(object.locked),
  };
}
