export const VIEWER_PRESET_VERSION = 1;

export const EQUIPMENT_GLOBAL_DISPLAY_MODES = Object.freeze({
  SIMPLIFIED: "SIMPLIFIED",
  REALISTIC: "REALISTIC",
  AUTO: "AUTO",
  CUSTOM: "CUSTOM",
});

export const EQUIPMENT_DISPLAY_OVERRIDES = Object.freeze({
  AUTO: "AUTO",
  DISTANCE: "DISTANCE",
  SIMPLIFIED: "SIMPLIFIED",
  DETAILED: "DETAILED",
});

export const EQUIPMENT_REPRESENTATIONS = Object.freeze({
  SIMPLIFIED: "SIMPLIFIED",
  DETAILED: "DETAILED",
});

const GLOBAL_MODES = new Set(Object.values(EQUIPMENT_GLOBAL_DISPLAY_MODES));
const OVERRIDE_MODES = new Set(Object.values(EQUIPMENT_DISPLAY_OVERRIDES));

export function createViewerPreset(source = {}) {
  const representation = source.equipmentRepresentation ?? {};
  const overrides = Object.fromEntries(Object.entries(representation.overrides ?? source.equipmentDisplayOverrides ?? {})
    .filter(([, value]) => OVERRIDE_MODES.has(value)));
  return {
    version: VIEWER_PRESET_VERSION,
    camera: source.camera ?? null,
    visibility: { ...(source.visibility ?? {}) },
    filters: { ...(source.filters ?? {}) },
    floorSettings: { ...(source.floorSettings ?? {}) },
    detailFocusEquipmentId: source.detailFocusEquipmentId ?? null,
    equipmentRepresentation: {
      globalMode: GLOBAL_MODES.has(representation.globalMode)
        ? representation.globalMode
        : EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO,
      overrides,
      autoDetailDistance: Math.max(1, Number(representation.autoDetailDistance) || 12),
    },
  };
}

export function normalizeViewerPreset(source) {
  return createViewerPreset(source);
}

export function setEquipmentDisplayOverride(preset, equipmentId, override) {
  const current = createViewerPreset(preset);
  if (!equipmentId || !OVERRIDE_MODES.has(override)) return current;
  const overrides = { ...current.equipmentRepresentation.overrides };
  if (override === EQUIPMENT_DISPLAY_OVERRIDES.AUTO) delete overrides[equipmentId];
  else overrides[equipmentId] = override;
  return createViewerPreset({
    ...current,
    equipmentRepresentation: { ...current.equipmentRepresentation, overrides },
  });
}

export function resolveEquipmentRepresentation({
  preset,
  equipmentId,
  hasDetailedModel,
  selected = false,
  distance = Number.POSITIVE_INFINITY,
}) {
  if (!hasDetailedModel) return EQUIPMENT_REPRESENTATIONS.SIMPLIFIED;
  const normalized = createViewerPreset(preset);
  const override = normalized.equipmentRepresentation.overrides[equipmentId];
  if (override === EQUIPMENT_DISPLAY_OVERRIDES.SIMPLIFIED) return EQUIPMENT_REPRESENTATIONS.SIMPLIFIED;
  if (override === EQUIPMENT_DISPLAY_OVERRIDES.DETAILED) return EQUIPMENT_REPRESENTATIONS.DETAILED;
  if (override === EQUIPMENT_DISPLAY_OVERRIDES.DISTANCE) return distance <= normalized.equipmentRepresentation.autoDetailDistance
    ? EQUIPMENT_REPRESENTATIONS.DETAILED : EQUIPMENT_REPRESENTATIONS.SIMPLIFIED;
  const globalMode = normalized.equipmentRepresentation.globalMode;
  if (globalMode === EQUIPMENT_GLOBAL_DISPLAY_MODES.SIMPLIFIED) return EQUIPMENT_REPRESENTATIONS.SIMPLIFIED;
  if (globalMode === EQUIPMENT_GLOBAL_DISPLAY_MODES.REALISTIC) return EQUIPMENT_REPRESENTATIONS.DETAILED;
  return selected || distance <= normalized.equipmentRepresentation.autoDetailDistance
    ? EQUIPMENT_REPRESENTATIONS.DETAILED
    : EQUIPMENT_REPRESENTATIONS.SIMPLIFIED;
}
