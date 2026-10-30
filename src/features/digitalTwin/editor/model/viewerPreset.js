export const VIEWER_PRESET_VERSION = 1;

export const DEFAULT_SCAN_LIGHTING = Object.freeze({ ambient: 2.1, key: 2.4, fill: 0.7 });

export function normalizeEquipmentEnvironment(source = {}) {
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : fallback;
  const number = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return {
    backgroundColor: color(source.backgroundColor, "#f5f5f5"),
    groundColor: color(source.groundColor, "#a1a1a1"),
    gridColor: color(source.gridColor, "#1f6c98"),
    groundMode: ["VISIBLE", "TRANSLUCENT", "SECTION", "HIDDEN"].includes(source.groundMode) ? source.groundMode : "VISIBLE",
    groundOpacity: number(source.groundOpacity, 0.28, 0, 1),
    groundSize: number(source.groundSize, 20, 0.1, 10000),
    groundHeight: number(source.groundHeight, 0, -1000, 1000),
    gridVisible: source.gridVisible !== false,
    gridSpacing: number(source.gridSpacing, 0.5, 0.01, 1000),
  };
}

export function normalizeEquipmentView(view) {
  if (!view || ![view.position, view.target, view.up].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite))) return null;
  if (Math.hypot(...view.up) < 0.001 || Math.hypot(...view.position.map((value, index) => value - view.target[index])) < 0.001) return null;
  return { position: [...view.position], target: [...view.target], up: [...view.up],
    zoom: Number.isFinite(view.zoom) ? Math.max(0.01, Math.min(100, view.zoom)) : 1,
    fov: Number.isFinite(view.fov) ? Math.max(10, Math.min(100, view.fov)) : 60,
    near: Number.isFinite(view.near) ? Math.max(0.0001, view.near) : 0.01,
    far: Number.isFinite(view.far) ? Math.max((view.near || 0.01) + 1, view.far) : 500 };
}

export function normalizeScanLighting(source = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SCAN_LIGHTING).map(([key, fallback]) => [key,
    typeof source?.[key] === "number" && Number.isFinite(source[key]) ? Math.min(6, Math.max(0, source[key])) : fallback]));
}

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
    lighting: normalizeScanLighting(source.lighting),
    equipmentEnvironments: Object.fromEntries(Object.entries(source.equipmentEnvironments ?? {}).filter(([, value]) => value && typeof value === "object").map(([id, value]) => [id, normalizeEquipmentEnvironment(value)])),
    equipmentViews: Object.fromEntries(Object.entries(source.equipmentViews ?? {}).map(([id, view]) => [id, normalizeEquipmentView(view)]).filter(([, view]) => view)),
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
