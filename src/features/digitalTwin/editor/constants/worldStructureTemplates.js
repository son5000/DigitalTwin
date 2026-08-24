export const EDITOR_MODES = {
  EQUIPMENT: "EQUIPMENT",
  WORLD: "WORLD",
  VIEWER: "VIEWER",
};

export const WORLD_STRUCTURE_MATERIALS = [
  "CONCRETE",
  "PAINTED_CONCRETE",
  "STEEL",
  "PAINTED_STEEL",
  "GLASS",
  "MESH",
  "GRATING",
  "GENERIC",
];

const meter = (key, label, defaultValue, min = 0.02) => ({
  key,
  label,
  unit: "m",
  step: 0.01,
  min,
  defaultValue,
});

function template({
  id,
  group,
  name,
  nameKo,
  parameters,
  appearance,
  variants,
  isVertical = false,
  defaultPositionY = 0,
  defaultGroundSnap = true,
}) {
  return {
    id,
    domain: "WORLD",
    group,
    name,
    nameKo,
    parameters,
    defaultParameters: Object.fromEntries(
      parameters.map((parameter) => [parameter.key, parameter.defaultValue]),
    ),
    defaultAppearance: {
      color: "#87939A",
      opacity: 0.92,
      materialPreset: "CONCRETE",
      ...appearance,
    },
    variants,
    isVertical,
    defaultPositionY,
    defaultGroundSnap,
  };
}

export const WORLD_STRUCTURE_GROUPS = [
  { id: "SPACE", name: "Space", nameKo: "공간 구획·통로" },
  { id: "STRUCTURE", name: "Structure", nameKo: "구조" },
  { id: "FLOOR", name: "Floor", nameKo: "바닥·레벨" },
  { id: "OPENING", name: "Opening", nameKo: "개구부" },
  { id: "BOUNDARY", name: "Boundary", nameKo: "경계·안전" },
  { id: "VERTICAL", name: "Vertical Core", nameKo: "수직 연결" },
  { id: "CUSTOM", name: "Custom", nameKo: "사용자 구조물" },
];

export const WORLD_STRUCTURE_TEMPLATES = [
  template({ id: "ROOM", group: "SPACE", name: "Space Zone", nameKo: "공간 구획", parameters: [meter("width", "Width", 6), meter("depth", "Depth", 5), meter("height", "Height", 3)], appearance: { color: "#AAB8BE", opacity: 0.18, materialPreset: "GENERIC" } }),
  template({ id: "CORRIDOR", group: "SPACE", name: "Corridor", nameKo: "복도", parameters: [meter("width", "Width", 2), meter("length", "Length", 6), meter("height", "Height", 3)], appearance: { color: "#AAB8BE", opacity: 0.12, materialPreset: "GENERIC" } }),
  template({ id: "UTILITY_AREA", group: "SPACE", name: "Utility Area", nameKo: "유틸리티 구역", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3)], appearance: { color: "#AAB8BE", opacity: 0.12, materialPreset: "GENERIC" } }),

  template({ id: "WALL", group: "STRUCTURE", name: "Wall", nameKo: "벽체", parameters: [meter("length", "Length", 4), meter("height", "Height", 3), meter("thickness", "Thickness", 0.12)], appearance: { color: "#A7B0B5", opacity: 1, materialPreset: "PAINTED_CONCRETE" } }),
  template({ id: "PARTITION", group: "STRUCTURE", name: "Partition", nameKo: "파티션", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.5), meter("thickness", "Thickness", 0.08)], variants: ["SOLID", "GLASS", "MESH", "LOW_PARTITION", "FENCE_PARTITION", "CUSTOM"], appearance: { color: "#9AA5AA", opacity: 0.88, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "TEMPORARY_WALL", group: "STRUCTURE", name: "Temporary Wall", nameKo: "가벽", parameters: [meter("length", "Length", 3), meter("height", "Height", 2.2), meter("thickness", "Thickness", 0.1)], variants: ["SOLID", "GLASS", "LOW_PARTITION", "CUSTOM"], appearance: { color: "#B0B7BA", opacity: 0.9, materialPreset: "GENERIC" } }),
  template({ id: "COLUMN", group: "STRUCTURE", name: "Column", nameKo: "기둥", parameters: [meter("width", "Width / Diameter", 0.5), meter("depth", "Depth", 0.5), meter("height", "Height", 3)], variants: ["RECTANGULAR", "SQUARE", "CIRCULAR"], appearance: { color: "#8B9499", opacity: 1, materialPreset: "CONCRETE" } }),
  template({ id: "BEAM", group: "STRUCTURE", name: "Beam", nameKo: "보", parameters: [meter("length", "Length", 4), meter("width", "Width", 0.3), meter("height", "Height", 0.4)], appearance: { color: "#737F85", opacity: 1, materialPreset: "STEEL" } }),
  template({ id: "STRUCTURAL_FRAME", group: "STRUCTURE", name: "Structural Frame", nameKo: "구조 프레임", parameters: [meter("width", "Width", 3), meter("depth", "Depth", 2), meter("height", "Height", 2.8), meter("legThickness", "Leg", 0.12), meter("beamThickness", "Beam", 0.14)], appearance: { color: "#6F7E84", opacity: 1, materialPreset: "STEEL" } }),

  template({ id: "FLOOR_REGION", group: "FLOOR", name: "Floor", nameKo: "바닥", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3), meter("height", "Thickness", 0.08)], appearance: { color: "#707B80", opacity: 0.95, materialPreset: "CONCRETE" } }),
  template({ id: "PLATFORM", group: "FLOOR", name: "Platform", nameKo: "플랫폼", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3), meter("height", "Height", 0.3)], appearance: { color: "#59666B", opacity: 1, materialPreset: "STEEL" } }),
  template({ id: "STEP", group: "FLOOR", name: "Step", nameKo: "단차", parameters: [meter("width", "Width", 1.2), meter("depth", "Depth", 0.4), meter("height", "Height", 0.2)], appearance: { color: "#737D82", opacity: 1 } }),
  template({ id: "RAMP", group: "FLOOR", name: "Ramp", nameKo: "경사로", parameters: [meter("width", "Width", 1.5), meter("length", "Length", 3), meter("startHeight", "Start Height", 0), meter("endHeight", "End Height", 0.5)], appearance: { color: "#737D82", opacity: 1 } }),

  template({ id: "ENTRANCE", group: "OPENING", name: "Entrance", nameKo: "입구", parameters: [meter("width", "Width", 1.8), meter("height", "Height", 2.2), meter("depth", "Depth", 0.08)], appearance: { color: "#4593A4", opacity: 0.72, materialPreset: "GENERIC" } }),
  template({ id: "EXIT", group: "OPENING", name: "Exit", nameKo: "출구", parameters: [meter("width", "Width", 1.8), meter("height", "Height", 2.2), meter("depth", "Depth", 0.08)], appearance: { color: "#B48332", opacity: 0.72, materialPreset: "GENERIC" } }),
  template({ id: "DOOR", group: "OPENING", name: "Door", nameKo: "도어", parameters: [meter("width", "Width", 1), meter("height", "Height", 2.1), meter("depth", "Depth", 0.08)], appearance: { color: "#8C969B", opacity: 0.95, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "GATE", group: "OPENING", name: "Gate", nameKo: "게이트", parameters: [meter("width", "Width", 2.5), meter("height", "Height", 2), meter("depth", "Depth", 0.1)], appearance: { color: "#858F94", opacity: 0.95, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "PASSAGE", group: "OPENING", name: "Passage", nameKo: "통로", parameters: [meter("width", "Width", 2), meter("depth", "Depth", 1)], appearance: { color: "#71878F", opacity: 0.45 } }),

  template({ id: "RAILING", group: "BOUNDARY", name: "Railing", nameKo: "난간", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.1), meter("postInterval", "Post Interval", 1), meter("thickness", "Thickness", 0.06)], appearance: { color: "#78858B", opacity: 1, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "FENCE", group: "BOUNDARY", name: "Fence", nameKo: "펜스", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.8), meter("thickness", "Thickness", 0.05)], variants: ["SOLID", "MESH", "SAFETY_FENCE"], appearance: { color: "#C69A36", opacity: 0.9, materialPreset: "MESH" } }),
  template({ id: "STAIR", group: "VERTICAL", name: "Stair", nameKo: "계단", isVertical: true, parameters: [meter("width", "Width", 1.2), meter("treadDepth", "Tread Depth", 0.28), meter("riserHeight", "Target Riser Height", 0.18), meter("landingDepth", "Landing Depth", 1.2)] }),
  template({ id: "STAIRWELL", group: "VERTICAL", name: "Stairwell", nameKo: "계단실", isVertical: true, parameters: [meter("width", "Width", 3), meter("depth", "Depth", 5), meter("height", "Floor Height", 3)], appearance: { color: "#8FA0A8", opacity: 0.32, materialPreset: "CONCRETE" } }),
  template({ id: "ELEVATOR", group: "VERTICAL", name: "Elevator", nameKo: "엘리베이터", isVertical: true, parameters: [meter("width", "Car Width", 2.1), meter("depth", "Car Depth", 2.1), meter("height", "Floor Height", 3)], appearance: { color: "#6F8D99", opacity: 0.42, materialPreset: "STEEL" } }),
  template({ id: "SHAFT", group: "VERTICAL", name: "Shaft", nameKo: "샤프트", isVertical: true, parameters: [meter("width", "Width", 1.5), meter("depth", "Depth", 1.5), meter("height", "Floor Height", 3)], appearance: { color: "#7D8790", opacity: 0.26, materialPreset: "GENERIC" } }),

  template({ id: "CUSTOM_STRUCTURE", group: "CUSTOM", name: "Custom Structure", nameKo: "사용자 구조물", parameters: [meter("width", "Width", 1), meter("height", "Height", 1), meter("depth", "Depth", 1)], variants: ["BOX", "CYLINDER", "PLANE", "LINEAR_STRUCTURE"], appearance: { color: "#7F8A90", opacity: 0.9, materialPreset: "GENERIC" } }),
];

export const WORLD_STRUCTURE_TEMPLATE_MAP = Object.fromEntries(
  WORLD_STRUCTURE_TEMPLATES.map((item) => [item.id, item]),
);

export const DEFAULT_WORLD_SPACE = {
  id: "SPACE_MACHINE_ROOM",
  name: "Machine Room A",
  type: "ROOM",
};

export const DEFAULT_VISIBILITY_FILTERS = {
  FLOOR: true,
  WALL: true,
  OPENING: true,
  PARTITION: true,
  COLUMN: true,
  PLATFORM: true,
  BOUNDARY: true,
  VERTICAL: true,
  OTHER: true,
  EQUIPMENT: true,
};
