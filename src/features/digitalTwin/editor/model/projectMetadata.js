export function getProjectName(layout = {}) {
  if (typeof layout.name === "string" && layout.name.trim()) return layout.name.trim();
  const scope = layout.observationWorkflow?.scopeType ?? "SITE";
  const nodes = layout.hierarchy?.nodes ?? [];
  const equipment = Object.values(layout.equipmentByFloorId ?? {}).flat();
  const legacyName = scope === "BUILDING" ? nodes.find((node) => node.type === "BUILDING" && !node.systemHost)?.name
    : scope.includes("EQUIPMENT") ? equipment[0]?.name : nodes.find((node) => node.type === "SITE")?.name;
  return legacyName || "이름 없는 프로젝트";
}
