import { LAYOUT_STORAGE_KEY, readLocalLayout } from "../../digitalTwin/editor/model/layoutInitialization.js";

export const PROJECT_STORAGE_KEY = "digital-twin-projects-v1";
const LEGACY_PROJECT_ID = "local-world";

function isLayout(layout) {
  return layout && typeof layout === "object" && !Array.isArray(layout)
    && (Array.isArray(layout.hierarchy?.nodes) || Array.isArray(layout.equipment));
}

// The editor keeps its existing single working document. This adapter archives
// that document per project when switching, without changing its schema or assets.
export function readProjects(storage = window.localStorage) {
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  const registry = raw ? JSON.parse(raw) : { version: 1, activeId: LEGACY_PROJECT_ID, projects: [] };
  if (registry.version !== 1 || typeof registry.activeId !== "string" || !Array.isArray(registry.projects)
    || registry.projects.some((project) => typeof project.id !== "string" || !isLayout(project.layout))) {
    throw new Error("프로젝트 목록을 읽을 수 없습니다. 기존 저장 데이터는 유지됩니다.");
  }
  const current = readLocalLayout(storage);
  if (current.status === "ERROR") throw new Error(current.message);
  if (current.layout && !isLayout(current.layout)) throw new Error("저장된 월드 형식을 확인해 주세요. 기존 데이터는 유지됩니다.");
  const projects = [...registry.projects];
  if (current.layout && current.layout.observationWorkflow?.configured !== false) {
    const project = { id: registry.activeId, layout: current.layout };
    const index = projects.findIndex((item) => item.id === project.id);
    if (index < 0) projects.push(project);
    else projects[index] = project;
  }
  return { ...registry, projects };
}

function activateProject(id, layout, storage) {
  const registry = readProjects(storage);
  const previousRegistry = storage.getItem(PROJECT_STORAGE_KEY);
  const previousLayout = storage.getItem(LAYOUT_STORAGE_KEY);
  // Archive first: a failed write must never discard the current world.
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(registry));
  try {
    if (layout) storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    else storage.removeItem(LAYOUT_STORAGE_KEY);
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, activeId: id }));
  } catch (error) {
    if (previousLayout === null) storage.removeItem(LAYOUT_STORAGE_KEY);
    else storage.setItem(LAYOUT_STORAGE_KEY, previousLayout);
    if (previousRegistry === null) storage.removeItem(PROJECT_STORAGE_KEY);
    else storage.setItem(PROJECT_STORAGE_KEY, previousRegistry);
    throw error;
  }
}

export function createProject(storage = window.localStorage) {
  activateProject(crypto.randomUUID(), null, storage);
}

export function openProject(id, storage = window.localStorage) {
  const project = readProjects(storage).projects.find((item) => item.id === id);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
  activateProject(id, project.layout, storage);
}

export function getProjectDetails(project) {
  const { layout } = project;
  const nodes = layout.hierarchy?.nodes ?? [];
  const scope = layout.observationWorkflow?.scopeType ?? "SITE";
  const names = { SITE: "전체 공간·부지", BUILDING: "건물 중심 관측", SINGLE_EQUIPMENT: "단일 설비 관측", MULTI_EQUIPMENT: "다중 설비 관측", CUSTOM: "사용자 정의" };
  const equipment = Object.values(layout.equipmentByFloorId ?? {}).flat();
  const name = layout.name || (scope === "BUILDING" ? nodes.find((node) => node.type === "BUILDING")?.name
    : scope.includes("EQUIPMENT") ? equipment[0]?.name : nodes.find((node) => node.type === "SITE")?.name);
  const image = scope.includes("EQUIPMENT") ? "sensors" : scope === "BUILDING" ? "building" : "site";
  const date = new Date(layout.savedAt);
  return {
    name: name || "이름 없는 월드",
    scope: names[scope] ?? names.SITE,
    thumbnail: typeof layout.representativeImage === "string" && layout.representativeImage.startsWith("data:image/")
      ? layout.representativeImage
      : `/portal/workflow-${image}.svg`,
    modified: Number.isNaN(date.getTime()) ? "수정일 정보 없음" : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }),
    status: "로컬 저장됨",
  };
}
