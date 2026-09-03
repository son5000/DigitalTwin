import { clampDimension } from "@/features/digitalTwin/editor/utils/editorMath";
import {
  createDefaultEquipmentParts,
  normalizeEquipmentPart,
} from "@/features/digitalTwin/editor/constants/partTemplates";

export function getDimensionsFromParameters(template, parameters = {}) {
  const defaults = template.defaultDimensions;
  const values = { ...template.defaultParameters, ...parameters };
  const category = template.floorCategory ?? template.category;
  let dimensions = { ...defaults };

  if (category === "PIPE") {
    const diameter = clampDimension(values.diameter ?? defaults.height);
    const length = clampDimension(values.length ?? defaults.width);
    dimensions = { width: length, height: diameter, depth: diameter };

    if (template.id === "PIPE_ELBOW_90") {
      const radius = clampDimension(values.bendRadius ?? 0.4);
      dimensions = { width: radius + diameter, height: diameter, depth: radius + diameter };
    } else if (template.id === "PIPE_ELBOW_45") {
      const radius = clampDimension(values.bendRadius ?? 0.4);
      dimensions = { width: radius * 1.7 + diameter, height: diameter, depth: radius * 0.75 + diameter };
    } else if (template.id === "PIPE_T" || template.id === "PIPE_Y") {
      dimensions.depth = clampDimension(values.branchLength ?? defaults.depth);
    } else if (template.id === "PIPE_VALVE") {
      dimensions.height = Math.max(defaults.height, diameter * 2.5);
    }
  } else if (category === "DUCT") {
    dimensions = {
      width: clampDimension(values.length ?? defaults.width),
      height: clampDimension(values.height ?? defaults.height),
      depth: clampDimension(values.width ?? defaults.depth),
    };
  } else if (template.id === "CYLINDER" || template.id === "TANK_VERTICAL") {
    dimensions = {
      width: clampDimension(values.diameter ?? defaults.width),
      height: clampDimension(values.height ?? defaults.height),
      depth: clampDimension(values.diameter ?? defaults.depth),
    };
  } else if (template.id === "TANK_HORIZONTAL") {
    dimensions = {
      width: clampDimension(values.length ?? defaults.width),
      height: clampDimension(values.diameter ?? defaults.height),
      depth: clampDimension(values.diameter ?? defaults.depth),
    };
  }

  return Object.fromEntries(
    Object.entries(dimensions).map(([key, value]) => [key, clampDimension(value)]),
  );
}

export function createTemplateInstanceDefaults(template) {
  const parameters = { ...template.defaultParameters };

  return {
    domain: template.domain,
    category: template.category,
    parameters,
    dimensions: getDimensionsFromParameters(template, parameters),
    appearance: { ...template.defaultAppearance },
    parts: createDefaultEquipmentParts(template),
  };
}

export function normalizeEquipmentInstance(equipment, template) {
  const defaults = createTemplateInstanceDefaults(template);
  const parameters = { ...defaults.parameters, ...equipment.parameters };
  const hasParameters = Object.keys(parameters).length > 0;

  return {
    ...equipment,
    domain: template.domain,
    category: template.category,
    parameters,
    dimensions: hasParameters
      ? getDimensionsFromParameters(template, parameters)
      : { ...defaults.dimensions, ...equipment.dimensions },
    position: { x: 0, y: template.defaultPositionY ?? 0, z: 0, ...equipment.position },
    rotation: { x: 0, y: 0, z: 0, ...equipment.rotation },
    appearance: { ...defaults.appearance, ...equipment.appearance },
    appearanceSlots: Object.fromEntries((template.materialSlots ?? []).map((slot) => [
      slot.id,
      { ...slot.defaultAppearance, ...equipment.appearanceSlots?.[slot.id] },
    ])),
    parts: Array.isArray(equipment.parts)
      ? equipment.parts.map(normalizeEquipmentPart)
      : defaults.parts,
    detailAssetId: equipment.detailAssetId ?? null,
    dataBindings: Array.isArray(equipment.dataBindings) ? equipment.dataBindings : [],
    operationalState: {
      status: "UNCOMMISSIONED",
      alarmLevel: "NONE",
      lastUpdatedAt: null,
      ...equipment.operationalState,
    },
    control: {
      enabled: false,
      mode: "MONITOR_ONLY",
      endpoint: "",
      ...equipment.control,
    },
    visible: equipment.visible ?? true,
    locked: equipment.locked ?? false,
    showNameLabel: equipment.showNameLabel === true,
  };
}
