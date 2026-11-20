import { getProjectName } from "../../digitalTwin/editor/model/projectMetadata.js";

const nameOrder = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

export function selectProjectList(localProjects, serverProjects, { query = "", sort = "updated-desc" } = {}) {
  const localIds = new Set(localProjects.flatMap((project) => [project.id, project.serverProjectId].filter(Boolean)));
  const entries = [
    ...localProjects.map((project) => ({ project, isLocal: true, key: `local:${project.id}`, name: getProjectName(project.layout), updatedAt: project.layout.savedAt })),
    ...serverProjects.filter((project) => !localIds.has(project.projectId) && !localIds.has(project.externalProjectId))
      .map((project) => ({ project, isLocal: false, key: `server:${project.projectId}`, name: project.name, updatedAt: project.updatedAt })),
  ];
  const search = query.trim().normalize("NFC").toLocaleLowerCase("ko");
  const items = entries.filter((entry) => entry.name.normalize("NFC").toLocaleLowerCase("ko").includes(search));
  items.sort((a, b) => {
    const byName = nameOrder.compare(a.name, b.name);
    if (sort === "name-asc" || sort === "name-desc") return (sort === "name-desc" ? -byName : byName) || a.key.localeCompare(b.key);
    const aTime = Date.parse(a.updatedAt);
    const bTime = Date.parse(b.updatedAt);
    // Unknown modification dates stay at the end in either date order.
    if (Number.isNaN(aTime) !== Number.isNaN(bTime)) return Number.isNaN(aTime) ? 1 : -1;
    return (sort === "updated-asc" ? aTime - bTime : bTime - aTime) || byName || a.key.localeCompare(b.key);
  });
  return { total: entries.length, items };
}
