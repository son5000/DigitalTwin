export const SITE_BACKGROUND_THEME_OPTIONS = Object.freeze([
  { id: "DAY", label: "낮", description: "균형 잡힌 자연광" },
  { id: "NIGHT", label: "밤", description: "어두운 산업 현장" },
  { id: "SUNSET", label: "석양", description: "따뜻한 저녁광" },
  { id: "CLEAR_SKY", label: "맑은 하늘", description: "밝고 선명한 주광" },
]);

export const SITE_BACKGROUND_PRESETS = Object.freeze({
  DAY: { background: 0xb8c8d8, fog: 0xc8d4df, sky: 0xf2f6fa, ground: 0x8798a4, key: 0xfff6df, fill: 0x8da9c2 },
  NIGHT: { background: 0x111827, fog: 0x182233, sky: 0x60708d, ground: 0x16202b, key: 0xb7c8e8, fill: 0x496181 },
  SUNSET: { background: 0x8f7380, fog: 0xb59282, sky: 0xffc38f, ground: 0x574b4d, key: 0xffb36f, fill: 0x8f7fb0 },
  CLEAR_SKY: { background: 0xa8cbe5, fog: 0xd6e5ef, sky: 0xffffff, ground: 0x91a49c, key: 0xffffff, fill: 0x9cc4df },
});

export const SITE_GROUND_MATERIAL_OPTIONS = Object.freeze([
  { id: "CONCRETE", label: "콘크리트", color: 0x9ca7ad, roughness: 0.92 },
  { id: "ASPHALT", label: "아스팔트", color: 0x4e565d, roughness: 0.98 },
  { id: "GRASS", label: "잔디", color: 0x627c63, roughness: 1 },
  { id: "SOIL", label: "토양", color: 0x786b58, roughness: 1 },
  { id: "ROCK", label: "암석", color: 0x6f716d, roughness: 0.94 },
  { id: "GRAVEL", label: "자갈", color: 0x88847a, roughness: 1 },
]);

export const DEFAULT_SITE_ENVIRONMENT = Object.freeze({
  width: 120,
  depth: 90,
  groundMaterial: "CONCRETE",
  backgroundTheme: "DAY",
  terrain: createFlatTerrainModel(120, 90, 3),
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolveSize(value) {
  if (typeof value === "number") return { width: value, depth: value };
  if (!value || typeof value !== "object") return null;
  const size = finite(value.size, Number.NaN);
  return {
    width: finite(value.width, size),
    depth: finite(value.depth, size),
  };
}

export function normalizeSiteEnvironment(environment) {
  const groundMaterial = SITE_GROUND_MATERIAL_OPTIONS.some((option) => option.id === environment?.groundMaterial)
    ? environment.groundMaterial
    : DEFAULT_SITE_ENVIRONMENT.groundMaterial;
  const backgroundTheme = SITE_BACKGROUND_THEME_OPTIONS.some((option) => option.id === environment?.backgroundTheme)
    ? environment.backgroundTheme
    : DEFAULT_SITE_ENVIRONMENT.backgroundTheme;
  const width = Math.min(400, Math.max(20, finite(environment?.width, DEFAULT_SITE_ENVIRONMENT.width)));
  const depth = Math.min(400, Math.max(20, finite(environment?.depth, DEFAULT_SITE_ENVIRONMENT.depth)));
  return {
    width,
    depth,
    groundMaterial,
    backgroundTheme,
    terrain: normalizeTerrainModel(environment?.terrain, width, depth, groundMaterial),
  };
}

export function resolveSiteEnvironmentFromLayout(layout) {
  const current = resolveSize(layout?.siteEnvironment ?? layout?.worldSettings?.site);
  const legacySite = resolveSize(layout?.siteSize ?? layout?.worldSettings?.siteSize);
  const legacyGrid = resolveSize(layout?.gridSize ?? layout?.worldGridSize ?? layout?.gridSettings?.gridSize);
  const dimensions = current ?? legacySite ?? legacyGrid ?? DEFAULT_SITE_ENVIRONMENT;
  return normalizeSiteEnvironment({
    ...dimensions,
    ...(layout?.siteEnvironment ?? layout?.worldSettings?.site),
  });
}

export function getSiteBounds(environment) {
  const site = normalizeSiteEnvironment(environment);
  return {
    width: site.width,
    depth: site.depth,
    minX: -site.width / 2,
    maxX: site.width / 2,
    minZ: -site.depth / 2,
    maxZ: site.depth / 2,
  };
}

export function getRotatedFootprint(dimensions, rotationY = 0) {
  const width = Math.max(0, finite(dimensions?.width, 0));
  const depth = Math.max(0, finite(dimensions?.depth, 0));
  const angle = finite(rotationY, 0);
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    width: width * cosine + depth * sine,
    depth: width * sine + depth * cosine,
  };
}

export function clampObjectPositionToSite(position, dimensions, rotationY, environment) {
  const bounds = getSiteBounds(environment);
  const footprint = getRotatedFootprint(dimensions, rotationY);
  const fits = footprint.width <= bounds.width && footprint.depth <= bounds.depth;
  const xLimit = Math.max(0, (bounds.width - footprint.width) / 2);
  const zLimit = Math.max(0, (bounds.depth - footprint.depth) / 2);
  const currentX = finite(position?.x, 0);
  const currentZ = finite(position?.z, 0);
  const x = Math.min(xLimit, Math.max(-xLimit, currentX));
  const z = Math.min(zLimit, Math.max(-zLimit, currentZ));

  return {
    position: { ...position, x, z },
    footprint,
    fits,
    wasClamped: Math.abs(x - currentX) > 1e-6 || Math.abs(z - currentZ) > 1e-6,
  };
}

export function intersectAreaWithSite(area, environment) {
  const bounds = getSiteBounds(environment);
  const width = Math.max(0, finite(area?.width, 0));
  const depth = Math.max(0, finite(area?.depth, 0));
  const centerX = finite(area?.center?.x, 0);
  const centerZ = finite(area?.center?.z, 0);
  const minX = Math.max(bounds.minX, centerX - width / 2);
  const maxX = Math.min(bounds.maxX, centerX + width / 2);
  const minZ = Math.max(bounds.minZ, centerZ - depth / 2);
  const maxZ = Math.min(bounds.maxZ, centerZ + depth / 2);
  if (minX >= maxX || minZ >= maxZ) return null;
  return {
    ...area,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}
import { createFlatTerrainModel, normalizeTerrainModel } from "@/features/digitalTwin/editor/terrain/TerrainModel";
