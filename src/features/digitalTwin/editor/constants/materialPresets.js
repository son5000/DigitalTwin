const preset = (id, label, category, color, roughness, metalness, pattern, options = {}) => Object.freeze({
  id, label, category, color, roughness, metalness, pattern,
  reflectivity: options.reflectivity ?? 0.35,
  opacity: options.opacity ?? 1,
  textureScale: options.textureScale ?? 2,
  textureRotation: 0,
  bumpStrength: options.bumpStrength ?? 0.18,
  aging: options.aging ?? 0,
  transmission: options.transmission ?? 0,
});

export const MATERIAL_PRESETS = Object.freeze([
  preset("CONCRETE", "콘크리트", "광물", "#9aa2a4", 0.9, 0.02, "SPECKLE", { textureScale: 3, bumpStrength: 0.28 }),
  preset("PAINTED_CONCRETE", "도장 콘크리트", "광물", "#b9bebd", 0.58, 0.02, "FINE", { reflectivity: 0.38, textureScale: 4, bumpStrength: 0.1 }),
  preset("CEMENT", "시멘트", "광물", "#aaa9a2", 0.94, 0.01, "CLOUD", { textureScale: 2.4, bumpStrength: 0.22 }),
  preset("BRICK", "벽돌", "조적", "#9b5845", 0.93, 0, "BRICK", { textureScale: 1.5, bumpStrength: 0.34 }),
  preset("TILE", "타일", "광물", "#c8ceca", 0.48, 0.02, "TILE", { reflectivity: 0.55, textureScale: 2, bumpStrength: 0.12 }),
  preset("TERRAZZO", "테라조", "광물", "#b8b5aa", 0.52, 0.02, "TERRAZZO", { reflectivity: 0.5, textureScale: 3.4, bumpStrength: 0.1 }),
  preset("WOOD", "목재", "목재", "#9a6a43", 0.7, 0, "WOOD", { textureScale: 1.6, bumpStrength: 0.22 }),
  preset("MARBLE", "대리석", "광물", "#d9d5cc", 0.3, 0.02, "MARBLE", { reflectivity: 0.66, textureScale: 1.2, bumpStrength: 0.06 }),
  preset("STONE", "석재", "광물", "#777873", 0.88, 0.01, "STONE", { textureScale: 2.2, bumpStrength: 0.3 }),
  preset("ASPHALT", "아스팔트", "바닥", "#3e4142", 0.98, 0, "ASPHALT", { textureScale: 4, bumpStrength: 0.38 }),
  preset("VINYL", "비닐 시트", "바닥", "#88979a", 0.46, 0.01, "FINE", { reflectivity: 0.48, textureScale: 5, bumpStrength: 0.035 }),
  preset("CARPET", "카펫", "바닥", "#666b68", 0.98, 0, "CARPET", { reflectivity: 0.06, textureScale: 6, bumpStrength: 0.3 }),
  preset("FABRIC", "패브릭", "섬유", "#687982", 0.96, 0, "CARPET", { reflectivity: 0.08, textureScale: 8, bumpStrength: 0.2 }),
  preset("PAINT", "도장면", "도장", "#c7cbc8", 0.5, 0.01, "FINE", { reflectivity: 0.42, textureScale: 5, bumpStrength: 0.045 }),
  preset("STEEL", "일반 강재", "금속", "#788286", 0.48, 0.86, "BRUSHED", { reflectivity: 0.78, textureScale: 3, bumpStrength: 0.08 }),
  preset("PAINTED_METAL", "도장 철판", "금속", "#607d8b", 0.42, 0.68, "PANEL", { reflectivity: 0.72, textureScale: 2.5, bumpStrength: 0.08 }),
  preset("STAINLESS", "스테인리스", "금속", "#b8c1c4", 0.2, 0.96, "BRUSHED", { reflectivity: 0.95, textureScale: 3, bumpStrength: 0.06 }),
  preset("ALUMINUM", "알루미늄", "금속", "#aeb8bd", 0.3, 0.88, "BRUSHED", { reflectivity: 0.86, textureScale: 2.8, bumpStrength: 0.05 }),
  preset("GALVANIZED", "아연도금 강판", "금속", "#98a4a5", 0.46, 0.78, "GALVANIZED", { reflectivity: 0.74, textureScale: 3.5, bumpStrength: 0.14 }),
  preset("RUSTED_METAL", "녹슨 금속", "금속", "#7f4f35", 0.86, 0.58, "RUST", { reflectivity: 0.34, textureScale: 2.6, bumpStrength: 0.32, aging: 0.65 }),
  preset("PLASTIC", "플라스틱", "합성", "#5687a0", 0.38, 0.02, "FINE", { reflectivity: 0.58, textureScale: 3, bumpStrength: 0.04 }),
  preset("RUBBER", "고무", "합성", "#292d2e", 0.94, 0, "RUBBER", { reflectivity: 0.12, textureScale: 4, bumpStrength: 0.2 }),
  preset("GLASS", "유리", "유리", "#9bc8d4", 0.08, 0.05, "NONE", { reflectivity: 1, opacity: 0.34, transmission: 0.72, bumpStrength: 0 }),
  preset("FROSTED_GLASS", "반투명 유리", "유리", "#c0d6d8", 0.46, 0.02, "FROST", { reflectivity: 0.7, opacity: 0.58, transmission: 0.42, textureScale: 5, bumpStrength: 0.08 }),
  preset("METAL_MESH", "철망", "금속", "#596468", 0.52, 0.82, "MESH", { reflectivity: 0.68, opacity: 0.82, textureScale: 3, bumpStrength: 0.18 }),
  preset("PANEL", "외장 패널", "패널", "#81949c", 0.5, 0.46, "PANEL", { textureScale: 2, bumpStrength: 0.12 }),
  preset("METAL_PANEL", "금속 패널", "패널", "#849196", 0.38, 0.72, "PANEL", { reflectivity: 0.72, textureScale: 2.4, bumpStrength: 0.1 }),
  preset("SANDWICH_PANEL", "샌드위치 패널", "패널", "#d0d3cf", 0.48, 0.34, "PANEL", { reflectivity: 0.54, textureScale: 2.2, bumpStrength: 0.11 }),
  preset("INDUSTRIAL_FLOOR", "산업용 바닥", "바닥", "#647176", 0.72, 0.12, "SPECKLE", { textureScale: 4, bumpStrength: 0.2 }),
  preset("EPOXY_FLOOR", "에폭시 바닥", "바닥", "#557c88", 0.24, 0.08, "FINE", { reflectivity: 0.76, textureScale: 5, bumpStrength: 0.04 }),
  preset("CHECKER_PLATE", "체크 플레이트", "금속", "#737e82", 0.43, 0.82, "CHECKER_PLATE", { reflectivity: 0.72, textureScale: 2.8, bumpStrength: 0.3 }),
  preset("CEILING_PANEL", "천장 패널", "패널", "#d2d4cf", 0.68, 0.04, "CEILING", { textureScale: 2.4, bumpStrength: 0.1 }),
  preset("CERAMIC", "세라믹", "광물", "#d6d2c7", 0.28, 0.01, "TILE", { reflectivity: 0.72, textureScale: 2, bumpStrength: 0.08 }),
]);

export const MATERIAL_PRESET_MAP = Object.freeze(Object.fromEntries(MATERIAL_PRESETS.map((item) => [item.id, item])));

export const FLOOR_MATERIAL_PRESET_IDS = Object.freeze([
  "CONCRETE", "PAINTED_CONCRETE", "CEMENT", "EPOXY_FLOOR", "INDUSTRIAL_FLOOR", "TILE",
  "TERRAZZO", "WOOD", "STONE", "MARBLE", "ASPHALT", "VINYL", "STEEL", "CHECKER_PLATE",
]);

export const WALL_MATERIAL_PRESET_IDS = Object.freeze([
  "CONCRETE", "PAINTED_CONCRETE", "CEMENT", "PAINT", "BRICK", "STONE", "TILE", "WOOD",
  "METAL_PANEL", "SANDWICH_PANEL", "PAINTED_METAL", "GALVANIZED", "GLASS", "FROSTED_GLASS",
]);

export const SPACE_MATERIAL_PRESET_IDS = Object.freeze([
  "PAINT", "VINYL", "TILE", "WOOD", "CONCRETE", "EPOXY_FLOOR", "CARPET",
]);

export const EQUIPMENT_MATERIAL_PRESET_IDS = Object.freeze([
  "PAINTED_METAL", "STEEL", "STAINLESS", "ALUMINUM", "GALVANIZED", "RUSTED_METAL",
  "PLASTIC", "RUBBER", "FABRIC", "WOOD", "CERAMIC", "METAL_MESH", "CHECKER_PLATE", "GLASS", "FROSTED_GLASS",
]);

const MATERIAL_ALIASES = Object.freeze({
  METAL: "PAINTED_METAL",
  PAINTED: "PAINTED_METAL",
  PAINTED_STEEL: "PAINTED_METAL",
  INDUSTRIAL_PANEL: "METAL_PANEL",
  MESH: "METAL_MESH",
  GRATING: "METAL_MESH",
  GENERIC: "CEMENT",
  EPOXY: "EPOXY_FLOOR",
});

export function getMaterialPreset(id) {
  return MATERIAL_PRESET_MAP[id] ?? MATERIAL_PRESET_MAP[MATERIAL_ALIASES[id]] ?? MATERIAL_PRESET_MAP.CONCRETE;
}

export function getMaterialPresetId(appearance = {}) {
  const candidate = appearance.materialPresetId ?? appearance.materialPreset ?? appearance.material;
  return MATERIAL_PRESET_MAP[candidate] ? candidate : MATERIAL_ALIASES[candidate] ?? "CONCRETE";
}

export function createMaterialAppearance(presetId, overrides = {}) {
  const selected = getMaterialPreset(presetId);
  return {
    materialPresetId: selected.id,
    materialPreset: selected.id,
    material: selected.id,
    pattern: selected.pattern,
    color: selected.color,
    roughness: selected.roughness,
    metalness: selected.metalness,
    reflectivity: selected.reflectivity,
    opacity: selected.opacity,
    textureScale: selected.textureScale,
    textureRotation: selected.textureRotation,
    bumpStrength: selected.bumpStrength,
    aging: selected.aging,
    transmission: selected.transmission,
    ...overrides,
  };
}

export function normalizeMaterialAppearance(appearance = {}) {
  const selected = getMaterialPreset(getMaterialPresetId(appearance));
  return createMaterialAppearance(selected.id, appearance);
}
