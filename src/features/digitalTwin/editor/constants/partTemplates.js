const CATEGORY_PART_BLUEPRINTS = {
  CABINET: [
    { name: "Enclosure", shape: "BOX", dimensions: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0.5, z: 0 } },
    { name: "Front Door", shape: "BOX", dimensions: { x: 0.92, y: 0.9, z: 0.05 }, position: { x: 0, y: 0.52, z: 0.52 } },
    { name: "Control Module", shape: "BOX", dimensions: { x: 0.28, y: 0.16, z: 0.08 }, position: { x: 0, y: 0.65, z: 0.56 } },
  ],
  MECHANICAL: [
    { name: "Base", shape: "BOX", dimensions: { x: 1, y: 0.14, z: 1 }, position: { x: 0, y: 0.07, z: 0 } },
    { name: "Main Body", shape: "CYLINDER_X", dimensions: { x: 0.7, y: 0.68, z: 0.68 }, position: { x: -0.08, y: 0.52, z: 0 } },
    { name: "Terminal Housing", shape: "BOX", dimensions: { x: 0.28, y: 0.42, z: 0.7 }, position: { x: 0.32, y: 0.5, z: 0 } },
  ],
  PIPE: [
    { name: "Pipe Body", shape: "CYLINDER_X", dimensions: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0.5, z: 0 } },
    { name: "Inlet", shape: "CYLINDER_X", dimensions: { x: 0.08, y: 1.3, z: 1.3 }, position: { x: -0.5, y: 0.5, z: 0 } },
    { name: "Outlet", shape: "CYLINDER_X", dimensions: { x: 0.08, y: 1.3, z: 1.3 }, position: { x: 0.5, y: 0.5, z: 0 } },
  ],
  DUCT: [
    { name: "Duct Body", shape: "BOX", dimensions: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0.5, z: 0 } },
    { name: "Inlet Flange", shape: "BOX", dimensions: { x: 0.04, y: 1.12, z: 1.12 }, position: { x: -0.5, y: 0.5, z: 0 } },
    { name: "Outlet Flange", shape: "BOX", dimensions: { x: 0.04, y: 1.12, z: 1.12 }, position: { x: 0.5, y: 0.5, z: 0 } },
  ],
  TANK: [
    { name: "Vessel", shape: "CYLINDER_Y", dimensions: { x: 1, y: 0.86, z: 1 }, position: { x: 0, y: 0.48, z: 0 } },
    { name: "Top Nozzle", shape: "CYLINDER_Y", dimensions: { x: 0.18, y: 0.14, z: 0.18 }, position: { x: 0, y: 0.94, z: 0 } },
    { name: "Support", shape: "BOX", dimensions: { x: 0.72, y: 0.08, z: 0.72 }, position: { x: 0, y: 0.04, z: 0 } },
  ],
  SENSOR: [
    { name: "Sensor Body", shape: "BOX", dimensions: { x: 1, y: 0.82, z: 1 }, position: { x: 0, y: 0.46, z: 0 } },
    { name: "Probe", shape: "CYLINDER_Y", dimensions: { x: 0.28, y: 0.24, z: 0.28 }, position: { x: 0, y: 0.92, z: 0 } },
  ],
};

const GENERIC_PART_BLUEPRINTS = [
  { name: "Main Housing", shape: "BOX", dimensions: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0.5, z: 0 } },
];

const PART_COLORS = ["#5F8798", "#87A6B2", "#C28B4B", "#6F8D74"];

function createPartId() {
  return `PART_${crypto.randomUUID()}`;
}

export function normalizeEquipmentPart(part, index = 0) {
  return {
    id: part.id ?? createPartId(),
    domain: "PART",
    name: part.name ?? `Part ${String(index + 1).padStart(2, "0")}`,
    shape: part.shape ?? "BOX",
    dimensions: { x: 0.3, y: 0.3, z: 0.3, ...part.dimensions },
    position: { x: 0, y: 0.5, z: 0, ...part.position },
    rotation: { x: 0, y: 0, z: 0, ...part.rotation },
    appearance: { color: PART_COLORS[index % PART_COLORS.length], opacity: 0.92, ...part.appearance },
    status: part.status ?? "NORMAL",
    visible: part.visible ?? true,
    locked: part.locked ?? false,
  };
}

export function createDefaultEquipmentParts(template) {
  const blueprints = CATEGORY_PART_BLUEPRINTS[template.category] ?? GENERIC_PART_BLUEPRINTS;
  return blueprints.map((part, index) => normalizeEquipmentPart(part, index));
}

export function createEquipmentPart(sequence, shape = "BOX") {
  return normalizeEquipmentPart({
    name: `Custom Part ${String(sequence).padStart(2, "0")}`,
    shape,
    dimensions: { x: 0.25, y: 0.25, z: 0.25 },
    position: { x: 0, y: 0.5, z: 0 },
  }, sequence - 1);
}

export const PART_SHAPES = [
  { id: "BOX", label: "Box" },
  { id: "CYLINDER_X", label: "Cylinder X" },
  { id: "CYLINDER_Y", label: "Cylinder Y" },
  { id: "SPHERE", label: "Sphere" },
];
