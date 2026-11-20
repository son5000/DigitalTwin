import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, api, repository, serializer, rawRois;
before(async () => {
  server = await createServer({ configFile: false, envDir: false, cacheDir: "node_modules/.vite-persistence-tests", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const channel = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  try {
    api = await server.ssrLoadModule("/src/features/portal/projects/projectPersistence.js");
    repository = await server.ssrLoadModule("/src/features/portal/projects/projectRepository.js");
    serializer = await server.ssrLoadModule("/src/features/digitalTwin/editor/api/layoutRepository.js");
    rawRois = await server.ssrLoadModule("/src/features/portal/projects/projectRawRois.js");
  } finally { globalThis.BroadcastChannel = channel; }
});
after(async () => { await server?.close(); });

function fixture() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const layout = { version: 18, name: "import", savedAt: "2026-11-20T00:00:00Z", hierarchy: { nodes: [] },
    future: { nil: null, no: false, zero: 0 }, siteEnvironment: { width: 10, depth: 10 }, observationConfig: { future: [null, false, 0], sensorBindings: [] } };
  storage.setItem(repository.PROJECT_STORAGE_KEY, JSON.stringify({ version: 1, activeId: "other", projects: [{ id: "local", layout }] }));
  const calls = [];
  const deps = { ...repository,
    uploadProjectAssets: async (id) => { calls.push(["upload", id]); return []; },
    createBackendProject: async () => { calls.push(["create"]); return { id: "server", externalProjectId: "local", revision: 0 }; },
    saveProjectConfiguration: async (id, saved, signal, base) => { calls.push(["draft", id, base]); return { projectId: id, revision: base + 1 }; },
  };
  return { storage, layout, calls, deps };
}

test("import saves draft only and keeps exact opaque values and server revision", async () => {
  const f = fixture();
  assert.equal((await api.persistImportedProject("local", f.deps, f)).revision, 1);
  assert.deepEqual(f.calls.map(c => c[0]), ["upload", "create", "draft"]);
  const p = repository.readProjects(f.storage).projects[0];
  assert.equal(p.serverProjectId, "server"); assert.equal(p.savedRevision, 1); assert.equal(p.pendingSave, null);
  assert.deepEqual(p.layout.future, { nil: null, no: false, zero: 0 });
});

test("lost draft response survives reload and reconciles without repeating the write", async () => {
  const f = fixture(); let written;
  f.deps.saveProjectConfiguration = async (id, layout, signal, base, assetManifest) => {
    f.calls.push(["draft"]); written = { id, revision: base + 1, layout, assetManifest }; throw new TypeError("lost response");
  };
  await assert.rejects(api.persistImportedProject("local", f.deps, f), /lost/);
  f.deps.projectRequest = async () => ({ project: written });
  const result = await api.persistImportedProject("local", f.deps, { storage: f.storage });
  assert.equal(result.revision, 1); assert.deepEqual(f.calls.map(c => c[0]), ["upload", "create", "draft"]);
});

test("conflict never changes expected revision or overwrites another writer", async () => {
  const f = fixture(); f.deps.saveProjectConfiguration = async () => { throw Object.assign(new Error("conflict"), { status: 409 }); };
  await assert.rejects(api.persistImportedProject("local", f.deps, f));
  f.deps.projectRequest = async () => ({ project: { id: "server", revision: 2, layout: { different: true } } });
  await assert.rejects(api.persistImportedProject("local", f.deps, f), { code: "VERSION_CONFLICT" });
  assert.equal(repository.readProjects(f.storage).projects[0].pendingSave.expectedRevision, 0);
});

test("lost create response resolves only exact external ID across pages", async () => {
  const f = fixture(); f.deps.createBackendProject = async () => { f.calls.push(["create"]); throw Error("lost create"); };
  await assert.rejects(api.persistImportedProject("local", f.deps, f));
  f.deps.listProjectConfigurations = async ({ cursor }) => cursor
    ? { items: [{ projectId: "server", externalProjectId: "local" }], nextCursor: null }
    : { items: [{ projectId: "wrong", externalProjectId: "unrelated" }], nextCursor: "next" };
  f.deps.projectRequest = async () => ({ project: { id: "server", revision: 0 } });
  await api.persistImportedProject("local", f.deps, f);
  assert.deepEqual(f.calls.map(c => c[0]), ["upload", "create", "draft"]);
});

test("local mark failure retries local state only, without another server revision", async () => {
  const f = fixture(); f.deps.markProjectSavedRevision = () => { throw Error("quota"); };
  await assert.rejects(api.persistImportedProject("local", f.deps, f), /quota/);
  f.deps.markProjectSavedRevision = repository.markProjectSavedRevision;
  await api.persistImportedProject("local", f.deps, f);
  assert.equal(f.calls.filter(c => c[0] === "draft").length, 1);
});

test("linked project uploads using server UUID and cannot guess a missing revision", async () => {
  const f = fixture(); repository.linkProjectServerId("local", "server", f.storage);
  await assert.rejects(api.persistImportedProject("local", f.deps, f), /기준 버전/);
  repository.markProjectSavedRevision("local", f.layout, 3, f.storage, "server");
  await api.persistImportedProject("local", f.deps, f);
  assert.deepEqual(f.calls, [["upload", "server"], ["draft", "server", 3]]);
});

test("serializer retains unknown root and observation fields, replaces deleted arrays and strips runtime URLs", () => {
  const f = fixture(); const layout = { ...f.layout, objectUrl: "blob:root", observationConfig: { ...f.layout.observationConfig,
    equipmentAssetBindings: [{ assetId: "asset", objectUrl: "blob:asset" }], sensorBindings: [] }, sensorBindings: [{ id: "deleted" }] };
  const saved = serializer.serializeLayout(layout);
  assert.deepEqual(saved.future, f.layout.future); assert.deepEqual(saved.observationConfig.future, [null, false, 0]);
  assert.deepEqual(saved.sensorBindings, []); assert.equal(saved.objectUrl, undefined); assert.equal(saved.equipmentAssetBindings[0].objectUrl, undefined);
});

test("raw polygon ROI survives remote activation unchanged without calling monitoring", () => {
  const f = fixture();
  const roi = { id: "polygon", equipmentId: "equipment", name: "표면", revision: 7, updatedAt: "original",
    surface: { type: "POLYGON", vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], outline: [0, 1, 2, 3], triangles: [0, 1, 2, 0, 2, 3], representation: "ACTUAL", coordinateSpace: "EQUIPMENT_LOCAL" }, displayMetrics: ["temperature.max"], measurements: [], rules: [] };
  const layout = { ...f.layout, importedRois: [roi] };
  assert.deepEqual(rawRois.retainedRois([roi], layout), [roi]);
  repository.openRemoteProject("server", layout, 2, f.storage);
  assert.deepEqual(JSON.parse(f.storage.getItem(repository.roiStorageKey("server"))), [roi]);
});
