export const TERRAIN_MODEL_VERSION = 1;

export const TERRAIN_MATERIALS = Object.freeze({
  SOIL: { id: "SOIL", label: "토사", color: "#786b58", roughness: 1 },
  GRASS: { id: "GRASS", label: "잔디", color: "#627c63", roughness: 1 },
  ROCK: { id: "ROCK", label: "암석", color: "#6f716d", roughness: 0.94 },
  ASPHALT: { id: "ASPHALT", label: "아스팔트", color: "#4e565d", roughness: 0.98 },
  CONCRETE: { id: "CONCRETE", label: "콘크리트", color: "#9ca7ad", roughness: 0.92 },
  GRAVEL: { id: "GRAVEL", label: "자갈", color: "#88847a", roughness: 1 },
});

const MIN_RESOLUTION = 1;
const MAX_RESOLUTION = 10;
const MAX_TERRAIN_HEIGHT = 80;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function getGridDimensions(width, depth, resolution) {
  return {
    columns: Math.max(3, Math.ceil(width / resolution) + 1),
    rows: Math.max(3, Math.ceil(depth / resolution) + 1),
  };
}

export function createFlatTerrainModel(width = 120, depth = 90, resolution = 3) {
  const normalizedWidth = Math.max(20, finite(width, 120));
  const normalizedDepth = Math.max(20, finite(depth, 90));
  const normalizedResolution = clamp(finite(resolution, 3), MIN_RESOLUTION, MAX_RESOLUTION);
  const { columns, rows } = getGridDimensions(normalizedWidth, normalizedDepth, normalizedResolution);
  return {
    version: TERRAIN_MODEL_VERSION,
    width: normalizedWidth,
    depth: normalizedDepth,
    resolution: normalizedResolution,
    columns,
    rows,
    elevations: Array(columns * rows).fill(0),
    material: "CONCRETE",
    showContours: false,
    showHeightColors: false,
    revision: 0,
  };
}

export function getTerrainVertexIndex(terrain, column, row) {
  return row * terrain.columns + column;
}

export function getTerrainVertexPosition(terrain, column, row) {
  const xStep = terrain.width / Math.max(1, terrain.columns - 1);
  const zStep = terrain.depth / Math.max(1, terrain.rows - 1);
  return {
    x: -terrain.width / 2 + column * xStep,
    z: -terrain.depth / 2 + row * zStep,
  };
}

export function sampleBaseTerrainElevation(terrain, x, z) {
  if (!terrain?.elevations?.length) return 0;
  const columnPosition = clamp((x + terrain.width / 2) / terrain.width, 0, 1) * (terrain.columns - 1);
  const rowPosition = clamp((z + terrain.depth / 2) / terrain.depth, 0, 1) * (terrain.rows - 1);
  const column0 = Math.floor(columnPosition);
  const row0 = Math.floor(rowPosition);
  const column1 = Math.min(terrain.columns - 1, column0 + 1);
  const row1 = Math.min(terrain.rows - 1, row0 + 1);
  const tx = columnPosition - column0;
  const tz = rowPosition - row0;
  const top = terrain.elevations[getTerrainVertexIndex(terrain, column0, row0)] * (1 - tx)
    + terrain.elevations[getTerrainVertexIndex(terrain, column1, row0)] * tx;
  const bottom = terrain.elevations[getTerrainVertexIndex(terrain, column0, row1)] * (1 - tx)
    + terrain.elevations[getTerrainVertexIndex(terrain, column1, row1)] * tx;
  return top * (1 - tz) + bottom * tz;
}

function resampleElevations(source, target) {
  const elevations = Array(target.columns * target.rows).fill(0);
  for (let row = 0; row < target.rows; row += 1) {
    for (let column = 0; column < target.columns; column += 1) {
      const point = getTerrainVertexPosition(target, column, row);
      elevations[getTerrainVertexIndex(target, column, row)] = sampleBaseTerrainElevation(source, point.x, point.z);
    }
  }
  return elevations;
}

export function normalizeTerrainModel(value, width = 120, depth = 90, material = "CONCRETE") {
  const normalizedWidth = Math.max(20, finite(width, 120));
  const normalizedDepth = Math.max(20, finite(depth, 90));
  const resolution = clamp(finite(value?.resolution, 3), MIN_RESOLUTION, MAX_RESOLUTION);
  const target = createFlatTerrainModel(normalizedWidth, normalizedDepth, resolution);
  const sourceColumns = Math.max(3, Math.round(finite(value?.columns, 0)));
  const sourceRows = Math.max(3, Math.round(finite(value?.rows, 0)));
  const sourceElevations = Array.isArray(value?.elevations)
    ? value.elevations.map((elevation) => clamp(finite(elevation), -MAX_TERRAIN_HEIGHT, MAX_TERRAIN_HEIGHT))
    : [];
  const hasUsableSource = sourceElevations.length === sourceColumns * sourceRows;
  const source = hasUsableSource ? {
    ...target,
    width: Math.max(20, finite(value?.width, normalizedWidth)),
    depth: Math.max(20, finite(value?.depth, normalizedDepth)),
    columns: sourceColumns,
    rows: sourceRows,
    elevations: sourceElevations,
  } : null;
  const dimensionsMatch = source
    && source.width === target.width
    && source.depth === target.depth
    && source.columns === target.columns
    && source.rows === target.rows;
  const resolvedMaterial = TERRAIN_MATERIALS[value?.material]
    ? value.material
    : TERRAIN_MATERIALS[material]
      ? material
      : "CONCRETE";
  return {
    ...target,
    elevations: dimensionsMatch ? [...source.elevations] : source ? resampleElevations(source, target) : target.elevations,
    material: resolvedMaterial,
    showContours: Boolean(value?.showContours),
    showHeightColors: Boolean(value?.showHeightColors),
    revision: Math.max(0, Math.round(finite(value?.revision, 0))),
  };
}

function worldToFeatureLocal(feature, x, z) {
  const dx = x - finite(feature.position?.x);
  const dz = z - finite(feature.position?.z);
  const angle = -finite(feature.rotation?.y);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: dx * cosine + dz * sine, z: -dx * sine + dz * cosine };
}

function rectangularBlend(local, width, depth, slopeRatio) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const edge = Math.max(0.25, Math.min(width, depth) * clamp(slopeRatio, 0.04, 0.48));
  const outside = Math.max(Math.abs(local.x) - halfWidth, Math.abs(local.z) - halfDepth);
  if (outside > 0) return 0;
  const edgeDistance = Math.min(halfWidth - Math.abs(local.x), halfDepth - Math.abs(local.z));
  return smoothstep(edgeDistance / edge);
}

export function getTerrainFeatureElevation(feature, x, z) {
  if (!feature || feature.visible === false || feature.assetKind !== "TERRAIN") return 0;
  const local = worldToFeatureLocal(feature, x, z);
  const width = Math.max(0.5, finite(feature.dimensions?.width, 8));
  const depth = Math.max(0.5, finite(feature.dimensions?.depth, 8));
  const height = Math.max(0, finite(feature.dimensions?.height, 1));
  const slopeRatio = finite(feature.parameters?.slopeRatio, 0.24);
  const profile = feature.profile ?? "HIGH_GROUND";
  if (["HILL_GENTLE", "HILL_STEEP"].includes(profile)) {
    const radius = Math.hypot(local.x / (width / 2), local.z / (depth / 2));
    if (radius >= 1) return 0;
    const exponent = profile === "HILL_STEEP" ? 0.72 : 1.55;
    return height * Math.pow(1 - smoothstep(radius), exponent);
  }
  if (profile === "LOW_GROUND" || profile === "DRAINAGE_CHANNEL") {
    return -height * rectangularBlend(local, width, depth, profile === "DRAINAGE_CHANNEL" ? 0.42 : slopeRatio);
  }
  if (profile === "TRANSITION_SLOPE") {
    if (Math.abs(local.x) > width / 2 || Math.abs(local.z) > depth / 2) return 0;
    const sideBlend = smoothstep((width / 2 - Math.abs(local.x)) / Math.max(0.25, width * slopeRatio));
    return height * clamp(local.z / depth + 0.5, 0, 1) * sideBlend;
  }
  if (["EMBANKMENT", "CUT_SLOPE", "FILL_SLOPE"].includes(profile)) {
    const longitudinal = smoothstep((width / 2 - Math.abs(local.x)) / Math.max(0.25, width * 0.12));
    const cross = smoothstep((depth / 2 - Math.abs(local.z)) / Math.max(0.25, depth * slopeRatio));
    const sign = profile === "CUT_SLOPE" ? -1 : 1;
    return sign * height * longitudinal * cross;
  }
  if (feature.parameters?.edgeMode === "RETAINING_WALL") {
    if (Math.abs(local.x) > width / 2 || Math.abs(local.z) > depth / 2) return 0;
    const rampCount = Math.max(0, Math.min(4, Math.round(finite(feature.parameters?.rampCount, 0))));
    const rampWidth = Math.max(1, finite(feature.parameters?.rampWidth, 3));
    if (rampCount > 0 && local.z < -depth / 2 + Math.max(1, depth * 0.3)) {
      const spacing = width / rampCount;
      const inRamp = Array.from({ length: rampCount }, (_, index) => -width / 2 + spacing * (index + 0.5))
        .some((center) => Math.abs(local.x - center) <= rampWidth / 2);
      if (inRamp) return height * clamp((local.z + depth / 2) / Math.max(1, depth * 0.3), 0, 1);
    }
    return height;
  }
  return height * rectangularBlend(local, width, depth, slopeRatio);
}

function getCutFillRoadSurface(feature, x, z) {
  if (!["ROAD", "WALKWAY"].includes(feature?.profile) || feature.parameters?.verticalPathMode !== "CUT_FILL") return null;
  const points = feature.path?.points;
  if (!Array.isArray(points) || points.length < 2) return null;
  const local = worldToFeatureLocal(feature, x, z);
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.z - points[index].z));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let accumulated = 0;
  let closest = null;
  points.slice(1).forEach((end, index) => {
    const start = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 0.001) return;
    const t = clamp(((local.x - start.x) * dx + (local.z - start.z) * dz) / lengthSquared, 0, 1);
    const px = start.x + dx * t;
    const pz = start.z + dz * t;
    const distance = Math.hypot(local.x - px, local.z - pz);
    if (!closest || distance < closest.distance) closest = { distance, pathDistance: accumulated + lengths[index] * t };
    accumulated += lengths[index];
  });
  if (!closest) return null;
  const halfWidth = Math.max(0.5, finite(feature.path?.width, feature.dimensions?.depth ?? 6) / 2);
  const blendWidth = Math.max(1, finite(feature.parameters?.cutFillBlendWidth, 3));
  if (closest.distance > halfWidth + blendWidth) return null;
  const ratio = totalLength > 0 ? closest.pathDistance / totalLength : 0;
  const startElevation = finite(feature.parameters?.startElevation, 0);
  const endElevation = finite(feature.parameters?.endElevation, startElevation);
  return {
    target: startElevation + (endElevation - startElevation) * ratio,
    influence: closest.distance <= halfWidth ? 1 : 1 - smoothstep((closest.distance - halfWidth) / blendWidth),
  };
}

export function sampleTerrainElevation(terrain, x, z, terrainFeatures = []) {
  const base = sampleBaseTerrainElevation(terrain, x, z);
  return terrainFeatures.reduce((elevation, feature) => {
    const cutFill = getCutFillRoadSurface(feature, x, z);
    if (cutFill) return elevation + (cutFill.target - elevation) * cutFill.influence;
    const delta = getTerrainFeatureElevation(feature, x, z);
    return delta >= 0 ? Math.max(elevation, base + delta) : Math.min(elevation, base + delta);
  }, base);
}

export function getTerrainElevationRange(terrain, terrainFeatures = []) {
  let min = Infinity;
  let max = -Infinity;
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const point = getTerrainVertexPosition(terrain, column, row);
      const elevation = sampleTerrainElevation(terrain, point.x, point.z, terrainFeatures);
      min = Math.min(min, elevation);
      max = Math.max(max, elevation);
    }
  }
  return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
}

export function isTerrainFeature(object) {
  return object?.assetKind === "TERRAIN"
    || (["ROAD", "WALKWAY"].includes(object?.profile) && object?.parameters?.verticalPathMode === "CUT_FILL");
}

export function collectTerrainFeatures(siteObjects = []) {
  return siteObjects.filter(isTerrainFeature);
}
