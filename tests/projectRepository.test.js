import test from "node:test";
import assert from "node:assert/strict";
import { createProject, openProject, readProjects, PROJECT_STORAGE_KEY } from "../src/features/portal/projects/projectRepository.js";
import { LAYOUT_STORAGE_KEY } from "../src/features/digitalTwin/editor/model/layoutInitialization.js";

function storageWith(layout) {
  const data = new Map(layout ? [[LAYOUT_STORAGE_KEY, JSON.stringify(layout)]] : []);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const world = (name) => ({ version: 18, savedAt: "2026-09-07T00:00:00.000Z", hierarchy: { nodes: [{ id: "SITE_MAIN", type: "SITE", name }] }, observationWorkflow: { configured: true, scopeType: "SITE" }, equipmentAssetBindings: [{ assetId: "keep-local-asset" }] });

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
