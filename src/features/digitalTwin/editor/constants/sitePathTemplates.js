export const SITE_PATH_TEMPLATES = Object.freeze([
  { id: "ROAD", name: "Road", width: 6, color: "#59666c", edgeColor: "#c7d0d4" },
  { id: "WALKWAY", name: "Walkway", width: 1.8, color: "#8b9a9f", edgeColor: "#d8b54a" },
]);

export const SITE_PATH_TEMPLATE_MAP = Object.fromEntries(
  SITE_PATH_TEMPLATES.map((template) => [template.id, template]),
);

export function createSitePath(templateId, firstPoint, sequence) {
  const template = SITE_PATH_TEMPLATE_MAP[templateId];
  if (!template) return null;
  return {
    id: `SITE_PATH_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    name: `${template.name} ${String(sequence).padStart(2, "0")}`,
    width: template.width,
    color: template.color,
    edgeColor: template.edgeColor,
    points: [firstPoint],
    visible: true,
    locked: false,
  };
}

export function normalizeSitePath(path, index = 0) {
  const template = SITE_PATH_TEMPLATE_MAP[path.type] ?? SITE_PATH_TEMPLATES[0];
  return {
    id: path.id ?? `SITE_PATH_${crypto.randomUUID()}`,
    domain: "SITE",
    type: template.id,
    name: path.name ?? `${template.name} ${String(index + 1).padStart(2, "0")}`,
    width: Math.max(0.5, Number(path.width) || template.width),
    color: path.color ?? template.color,
    edgeColor: path.edgeColor ?? template.edgeColor,
    points: Array.isArray(path.points)
      ? path.points.map((point) => ({ x: Number(point.x) || 0, z: Number(point.z) || 0 }))
      : [],
    visible: path.visible ?? true,
    locked: path.locked ?? false,
  };
}
