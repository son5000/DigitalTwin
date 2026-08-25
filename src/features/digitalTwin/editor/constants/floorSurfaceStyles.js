import {
  createMaterialAppearance,
  FLOOR_MATERIAL_PRESET_IDS,
  getMaterialPreset,
  normalizeMaterialAppearance,
} from "@/features/digitalTwin/editor/constants/materialPresets";

export const FLOOR_SURFACE_PRESETS = Object.freeze(
  FLOOR_MATERIAL_PRESET_IDS.map((id) => getMaterialPreset(id)),
);

export const DEFAULT_FLOOR_SURFACE_STYLE = Object.freeze({
  ...createMaterialAppearance("CONCRETE"),
  presetId: "CONCRETE",
});

export function getFloorSurfacePreset(presetId) {
  return FLOOR_SURFACE_PRESETS.find((preset) => preset.id === presetId) ?? FLOOR_SURFACE_PRESETS[0];
}

export function normalizeFloorSurfaceStyle(style = {}) {
  const requestedId = style.presetId ?? style.materialPresetId ?? style.materialPreset ?? style.material;
  const preset = getFloorSurfacePreset(requestedId);
  const normalized = normalizeMaterialAppearance({
    ...style,
    materialPresetId: preset.id,
    materialPreset: preset.id,
    material: preset.id,
  });
  return { ...normalized, presetId: preset.id };
}
