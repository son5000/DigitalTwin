import { LAYOUT_STORAGE_KEY, readLocalLayout } from "../../digitalTwin/editor/model/layoutInitialization.js";
import { getProjectName } from "../../digitalTwin/editor/model/projectMetadata.js";

export const PROJECT_STORAGE_KEY = "digital-twin-projects-v1";
export const roiStorageKey = (projectId) => `digital-twin-rois-v1:${projectId}`;
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
  if (current.layout && (current.layout.observationWorkflow?.configured !== false || current.layout.name?.trim())) {
    const project = { id: registry.activeId, layout: current.layout };
    const index = projects.findIndex((item) => item.id === project.id);
    if (index < 0) projects.push(project);
    else projects[index] = { ...projects[index], ...project };
  }
  return { ...registry, projects };
}

function activateProject(id, layout, storage, projectEntry = null) {
  const registry = readProjects(storage);
  const previousRegistry = storage.getItem(PROJECT_STORAGE_KEY);
  const previousLayout = storage.getItem(LAYOUT_STORAGE_KEY);
  // Archive first: a failed write must never discard the current world.
  const projects = projectEntry
    ? [...registry.projects.filter((project) => project.id !== id), projectEntry]
    : registry.projects;
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects }));
  try {
    if (layout) storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    else storage.removeItem(LAYOUT_STORAGE_KEY);
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, activeId: id, projects }));
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

export function openRemoteProject(id, layout, revision, storage = window.localStorage, serverProjectId = id) {
  if (!isLayout(layout) || !Number.isInteger(revision) || revision < 1) {
    throw new Error("서버의 편집 저장본을 확인할 수 없습니다.");
  }
  const previous = readProjects(storage).projects.find((item) => item.id === id);
  activateProject(id, layout, storage, { ...previous, id, layout, serverProjectId, storageMode: "SERVER", savedRevision: revision, serverSavedAt: layout.savedAt });
}

export function linkProjectServerId(id, serverProjectId, storage = window.localStorage) {
  const registry = readProjects(storage);
  if (!registry.projects.some((item) => item.id === id)) throw new Error("로컬 프로젝트를 찾을 수 없습니다.");
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects: registry.projects.map((item) => item.id === id
    ? { ...item, serverProjectId } : item) }));
}

export function markProjectSavedRevision(id, layout, revision, storage = window.localStorage, serverProjectId = id) {
  if (!isLayout(layout) || !Number.isInteger(revision) || revision < 1) return;
  const registry = readProjects(storage);
  const project = registry.projects.find((item) => item.id === id);
  if (!project) return;
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
    ...registry,
    projects: registry.projects.map((item) => item.id === id
      ? { ...item, serverProjectId, storageMode: "SERVER", savedRevision: revision, serverSavedAt: layout.savedAt }
      : item),
  }));
}

export function markProjectPublishedRevision(id, revision, storage = window.localStorage) {
  const registry = readProjects(storage);
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects: registry.projects.map((item) => item.id === id
    ? { ...item, publishedRevision: revision } : item) }));
}

export function removeProject(id, storage = window.localStorage) {
  const registry = readProjects(storage);
  if (!registry.projects.some((project) => project.id === id)) throw new Error("프로젝트를 찾을 수 없습니다.");
  const previousRegistry = storage.getItem(PROJECT_STORAGE_KEY);
  const previousLayout = storage.getItem(LAYOUT_STORAGE_KEY);
  const roiKey = roiStorageKey(id);
  const previousRois = storage.getItem(roiKey);
  try {
    if (registry.activeId === id) storage.removeItem(LAYOUT_STORAGE_KEY);
    storage.removeItem(roiKey);
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
      ...registry,
      activeId: registry.activeId === id ? crypto.randomUUID() : registry.activeId,
      projects: registry.projects.filter((project) => project.id !== id),
    }));
  } catch (error) {
    if (previousLayout === null) storage.removeItem(LAYOUT_STORAGE_KEY);
    else storage.setItem(LAYOUT_STORAGE_KEY, previousLayout);
    if (previousRois === null) storage.removeItem(roiKey);
    else storage.setItem(roiKey, previousRois);
    if (previousRegistry === null) storage.removeItem(PROJECT_STORAGE_KEY);
    else storage.setItem(PROJECT_STORAGE_KEY, previousRegistry);
    throw error;
  }
}

export function updateProjectObservationPoints(projectId, update, storage = window.localStorage) {
  const registry = readProjects(storage);
  const project = registry.projects.find((item) => item.id === projectId);
  if (!project) throw new Error("프로젝트를 저장한 뒤 관측 영역을 저장하세요.");
  const points = update(project.layout.observationConfig?.observationPoints ?? project.layout.observationPoints ?? []);
  const layout = { ...project.layout, savedAt: new Date().toISOString(), observationPoints: points,
    observationConfig: { ...(project.layout.observationConfig ?? {
      equipmentAssetBindings: project.layout.equipmentAssetBindings ?? [], sensorBindings: project.layout.sensorBindings ?? [], serverBindings: project.layout.serverBindings ?? [],
    }), observationPoints: points } };
  if (registry.activeId === projectId) storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  else storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects: registry.projects.map((item) => item.id === projectId ? { ...item, layout } : item) }));
  return layout;
}

export function getProjectDetails(project) {
  const { layout } = project;
  const scope = layout.observationWorkflow?.scopeType ?? "SITE";
  const names = { SITE: "전체 공간·부지", BUILDING: "건물 중심 관측", SINGLE_EQUIPMENT: "단일 설비 관측", MULTI_EQUIPMENT: "다중 설비 관측", CUSTOM: "사용자 정의" };
  const image = scope.includes("EQUIPMENT") ? "sensors" : scope === "BUILDING" ? "building" : "site";
  const date = new Date(layout.savedAt);
  return {
    name: getProjectName(layout),
    scope: names[scope] ?? names.SITE,
    thumbnail: typeof layout.representativeImage === "string" && layout.representativeImage.startsWith("data:image/")
      ? layout.representativeImage
      : `/portal/workflow-${image}.svg`,
    modified: Number.isNaN(date.getTime()) ? "수정일 정보 없음" : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }),
    isDraft: layout.projectStatus === "DRAFT" || layout.observationWorkflow?.configured === false,
    status: layout.projectStatus === "DRAFT" || layout.observationWorkflow?.configured === false ? "작업 중" : "저장 완료",
  };
}

export function canOpenProjectViewer(project) {
  return isLayout(project.layout) && project.layout.observationWorkflow?.configured !== false;
}
