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
]);

export const DEFAULT_SITE_ENVIRONMENT = Object.freeze({
  width: 120,
  depth: 90,
  groundMaterial: "CONCRETE",
  backgroundTheme: "DAY",
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeSiteEnvironment(environment) {
  const groundMaterial = SITE_GROUND_MATERIAL_OPTIONS.some((option) => option.id === environment?.groundMaterial)
    ? environment.groundMaterial
    : DEFAULT_SITE_ENVIRONMENT.groundMaterial;
  const backgroundTheme = SITE_BACKGROUND_THEME_OPTIONS.some((option) => option.id === environment?.backgroundTheme)
    ? environment.backgroundTheme
    : DEFAULT_SITE_ENVIRONMENT.backgroundTheme;
  return {
    width: Math.min(400, Math.max(20, finite(environment?.width, DEFAULT_SITE_ENVIRONMENT.width))),
    depth: Math.min(400, Math.max(20, finite(environment?.depth, DEFAULT_SITE_ENVIRONMENT.depth))),
    groundMaterial,
    backgroundTheme,
  };
}
