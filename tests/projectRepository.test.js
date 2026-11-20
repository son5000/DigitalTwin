import test from "node:test";
import assert from "node:assert/strict";
import { canOpenProjectViewer, createProject, getProjectDetails, markProjectSavedRevision, openProject, openRemoteProject, readProjects, removeProject, roiStorageKey, PROJECT_STORAGE_KEY } from "../src/features/portal/projects/projectRepository.js";
import { LAYOUT_STORAGE_KEY } from "../src/features/digitalTwin/editor/model/layoutInitialization.js";

function storageWith(layout) {
  const data = new Map(layout ? [[LAYOUT_STORAGE_KEY, JSON.stringify(layout)]] : []);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const world = (name) => ({ version: 18, savedAt: "2026-09-07T00:00:00.000Z", hierarchy: { nodes: [{ id: "SITE_MAIN", type: "SITE", name }] }, observationWorkflow: { configured: true, scopeType: "SITE" }, equipmentAssetBindings: [{ assetId: "keep-local-asset" }] });

test("프로젝트 목록은 실제로 열 수 있는 로컬·공개 뷰어만 안내한다", () => {
  const draft = { id: "draft", layout: { ...world("초안"), projectStatus: "DRAFT" } };
  assert.equal(canOpenProjectViewer(draft, null, false), true);
  assert.equal(canOpenProjectViewer(draft, null, true), true);
  assert.equal(canOpenProjectViewer({ ...draft, storageMode: "LOCAL" }, null, true), true);
  assert.equal(canOpenProjectViewer({ ...draft, storageMode: "SERVER", savedRevision: 2 }, { publishedRevision: 1 }, true), true);
  assert.equal(canOpenProjectViewer({ ...draft, storageMode: "SERVER", savedRevision: 2 }, null, true), true);
  assert.equal(canOpenProjectViewer({ ...draft, storageMode: "SERVER", savedRevision: 2, publishedRevision: 1 }, null, true), true);
});

test("empty and unconfigured working documents are not sample projects", () => {
  assert.equal(readProjects(storageWith()).projects.length, 0);
  assert.equal(readProjects(storageWith({ ...world("draft"), observationWorkflow: { configured: false } })).projects.length, 0);
});

test("legacy document, second world, and subsequent edits survive project switches", () => {
  const storage = storageWith(world("기존 월드"));
  const first = readProjects(storage).projects[0];
  createProject(storage);
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), null);
  assert.deepEqual(readProjects(storage).projects[0], first);
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(world("새 월드")));
  const second = readProjects(storage).projects.find((project) => project.id !== first.id);
  openProject(first.id, storage);
  assert.deepEqual(JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY)), first.layout);
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(world("기존 월드 수정")));
  openProject(second.id, storage);
  assert.equal(JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY)).hierarchy.nodes[0].name, "새 월드");
  assert.equal(readProjects(storage).projects.find((project) => project.id === first.id).layout.hierarchy.nodes[0].name, "기존 월드 수정");
  assert.equal(readProjects(storage).projects.length, 2);
});

test("corrupt storage is reported without replacing it", () => {
  const storage = storageWith();
  storage.setItem(LAYOUT_STORAGE_KEY, "{broken");
  assert.throws(() => createProject(storage));
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), "{broken");
});

test("quota failure before archiving leaves the current document intact", () => {
  const storage = storageWith(world("보존"));
  const previous = storage.getItem(LAYOUT_STORAGE_KEY);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => createProject(storage));
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), previous);
});

test("failed activation rolls back the working document and registry", () => {
  const storage = storageWith(world("보존"));
  const previous = storage.getItem(LAYOUT_STORAGE_KEY);
  const write = storage.setItem;
  let writes = 0;
  storage.setItem = (key, value) => {
    if (key === PROJECT_STORAGE_KEY && ++writes === 2) throw new Error("QuotaExceededError");
    write(key, value);
  };
  assert.throws(() => createProject(storage));
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), previous);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), null);
});

test("saved representative image replaces the project card fallback", () => {
  const fallback = getProjectDetails({ id: "fallback", layout: world("기본 이미지") });
  const captured = getProjectDetails({
    id: "captured",
    layout: { ...world("대표 이미지"), representativeImage: "data:image/png;base64,captured" },
  });
  assert.equal(fallback.thumbnail, "/portal/workflow-site.svg");
  assert.equal(captured.thumbnail, "data:image/png;base64,captured");
});

test("step 1 photos from each saved equipment collection appear on local project cards", () => {
  const photo = "data:image/jpeg;base64,step-one-photo";
  const equipment = { id: "pump", metadata: { representativeImage: photo } };
  for (const collection of [
    { equipmentByFloorId: { floor: [equipment] } },
    { roomScenes: { room: { equipment: [equipment] } } },
    { equipment: [equipment] },
    { siteObjects: [equipment] },
  ]) {
    const storage = storageWith({ ...world("사진 프로젝트"), ...collection });
    const project = readProjects(storage).projects[0];
    assert.equal(getProjectDetails(project).thumbnail, photo);
    createProject(storage);
    storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(world("다른 프로젝트")));
    const projects = readProjects(storage).projects;
    assert.equal(getProjectDetails(projects.find((item) => item.id === project.id)).thumbnail, photo);
    assert.equal(getProjectDetails(projects.find((item) => item.id !== project.id)).thumbnail, "/portal/workflow-site.svg");
  }
});

test("project snapshots keep priority and equipment photo updates and removal use the current saved instance", () => {
  const photo = "data:image/png;base64,current-photo";
  const oldPhoto = "data:image/png;base64,old-photo";
  const layout = {
    ...world("대표 사진 변경"),
    equipmentByFloorId: { floor: [{ id: "pump", metadata: { representativeImage: photo } }] },
    roomScenes: { room: { equipment: [{ id: "pump", metadata: { representativeImage: oldPhoto } }] } },
  };
  const storage = storageWith(layout);
  assert.equal(getProjectDetails(readProjects(storage).projects[0]).thumbnail, photo);
  assert.equal(getProjectDetails({ layout: { ...layout, representativeImage: oldPhoto } }).thumbnail, oldPhoto);
  layout.equipmentByFloorId.floor[0].metadata.representativeImage = null;
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  assert.equal(getProjectDetails(readProjects(storage).projects[0]).thumbnail, "/portal/workflow-site.svg");
});

test("equipment without a persistent photo is skipped when resolving the card image", () => {
  const photo = "data:image/webp;base64,saved-photo";
  const layout = { ...world("다중 설비"), equipmentByFloorId: { floor: [
    { id: "empty" },
    { id: "temporary", metadata: { representativeImage: "blob:expired" } },
    { id: "photo", metadata: { representativeImage: photo } },
  ] } };
  assert.equal(getProjectDetails({ layout }).thumbnail, photo);
});

test("remote draft activation preserves the previous working world and revision", () => {
  const storage = storageWith(world("기존 월드"));
  const firstId = readProjects(storage).activeId;
  openRemoteProject("server-id", world("서버 초안"), 3, storage);
  assert.equal(readProjects(storage).activeId, "server-id");
  assert.equal(readProjects(storage).projects.find((project) => project.id === firstId).layout.hierarchy.nodes[0].name, "기존 월드");
  assert.equal(readProjects(storage).projects.find((project) => project.id === "server-id").savedRevision, 3);
  markProjectSavedRevision("server-id", world("서버 초안"), 4, storage);
  assert.equal(readProjects(storage).projects.find((project) => project.id === "server-id").savedRevision, 4);
});

test("deleting the active project removes its layout and ROI but keeps other projects", () => {
  const storage = storageWith(world("첫 월드"));
  const firstId = readProjects(storage).activeId;
  createProject(storage);
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(world("삭제할 월드")));
  const deletedId = readProjects(storage).activeId;
  storage.setItem(roiStorageKey(deletedId), "[]");
  removeProject(deletedId, storage);
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), null);
  assert.equal(storage.getItem(roiStorageKey(deletedId)), null);
  assert.equal(readProjects(storage).projects.length, 1);
  openProject(firstId, storage);
  assert.equal(readProjects(storage).projects[0].layout.hierarchy.nodes[0].name, "첫 월드");
});

test("deleting an inactive project leaves the active world untouched", () => {
  const storage = storageWith(world("첫 월드"));
  const firstId = readProjects(storage).activeId;
  createProject(storage);
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(world("현재 월드")));
  removeProject(firstId, storage);
  assert.equal(readProjects(storage).projects.length, 1);
  assert.equal(JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY)).hierarchy.nodes[0].name, "현재 월드");
});

test("failed local deletion restores the active layout and ROI", () => {
  const storage = storageWith(world("보존"));
  const id = readProjects(storage).activeId;
  storage.setItem(roiStorageKey(id), "[]");
  const write = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === PROJECT_STORAGE_KEY) throw new Error("QuotaExceededError");
    write(key, value);
  };
  assert.throws(() => removeProject(id, storage));
  assert.equal(JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY)).hierarchy.nodes[0].name, "보존");
  assert.equal(storage.getItem(roiStorageKey(id)), "[]");
});
