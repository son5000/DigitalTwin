import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, roiApi, projects, model, bundle, files, loader, client, storage, values;
const originals = Object.fromEntries(["window", "fetch", "BroadcastChannel", "CustomEvent", "StorageEvent"].map((key) => [key, globalThis[key]]));
const assetMaps = { equipment: new Map(), textures: new Map() };
before(async () => {
  globalThis.BroadcastChannel = undefined;
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  globalThis.StorageEvent = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
  server = await createServer({ configFile: false, envDir: false,
    define: { "import.meta.env.VITE_PROJECT_API_BASE": JSON.stringify("https://fixture.invalid/api/v1"),
      "import.meta.env.VITE_MONITORING_API_BASE": JSON.stringify("https://fixture.invalid/monitoring") },
    cacheDir: "node_modules/.vite-local-viewer-tests", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const load = (path) => server.ssrLoadModule(`/src/features/${path}`);
  roiApi = await load("digitalTwin/editor/api/roiRepository.js");
  projects = await load("portal/projects/projectRepository.js");
  model = await load("digitalTwin/editor/model/roiMonitoring.js");
  bundle = await load("portal/projects/projectBundle.js");
  files = await load("portal/projects/projectBundleFiles.js");
  loader = await load("portal/projects/projectViewerLoader.js");
  client = await load("digitalTwin/editor/api/monitoringClient.js");
  for (const [kind, name] of [["equipment", "equipmentAssetRepository"], ["textures", "textureAssetRepository"]]) {
    const module = await load(`digitalTwin/editor/api/${name}.js`);
    Object.assign(module[name], { get: async (id) => assetMaps[kind].get(id), put: async (asset) => assetMaps[kind].set(asset.id, asset), remove: async (id) => assetMaps[kind].delete(id) });
  }
});
after(async () => { await server?.close(); Object.assign(globalThis, originals); });

function setup(mode, points = []) {
  values = new Map();
  storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.window = { localStorage: storage, dispatchEvent() {} };
  globalThis.fetch = async () => { throw new Error("backend offline"); };
  const layout = { version: 18, name: "Offline demo", savedAt: "2026-11-18T00:00:00Z", observationWorkflow: { configured: true, scopeType: "SINGLE_EQUIPMENT" },
    hierarchy: { nodes: [{ id: "equipment", type: "EQUIPMENT" }] }, observationPoints: points, observationConfig: { observationPoints: points }, equipmentAssetBindings: [] };
  const project = { id: "local", serverProjectId: "server", storageMode: mode, savedRevision: 1, serverSavedAt: layout.savedAt, layout };
  storage.setItem(projects.PROJECT_STORAGE_KEY, JSON.stringify({ version: 1, activeId: "another-editor", projects: [project] }));
  return project;
}
function roi() {
  return model.createSurfaceRoi("equipment", { type: "SPHERE", center: [0, .5, 0], radius: .2, coordinateSpace: "EQUIPMENT_LOCAL", representation: "BOTH" });
}

test("failed ROI save persists in layout, survives reload, and offline deletion is not resurrected", async () => {
  setup();
  let repository = roiApi.createRoiRepository("local", storage);
  assert.equal(repository.shared, true);
  const saved = await repository.save(roi());
  assert.equal(repository.shared, false);
  const layout = projects.readProjects(storage).projects[0].layout;
  assert.equal(layout.observationPoints[0].id, saved.id);
  assert.deepEqual(layout.observationConfig.observationPoints, layout.observationPoints);
  repository = roiApi.createRoiRepository("local", storage);
  assert.equal((await repository.list())[0].revision, 1);
  globalThis.fetch = async () => Response.json({ rois: [saved] });
  await repository.remove(saved);
  assert.deepEqual(await roiApi.createRoiRepository("local", storage).list(), []);
});

test("server ID resolves to local project when saving ROI", async () => {
  setup("SERVER");
  const saved = await roiApi.createRoiRepository("server", storage).save(roi());
  assert.equal(projects.readProjects(storage).projects[0].layout.observationPoints[0].id, saved.id);
  assert.equal((await roiApi.createRoiRepository("server", storage).list())[0].id, saved.id);
});

test("server ROI/readings failure does not hide local points", async () => {
  const point = model.roiToObservationPoint(roi());
  setup(undefined, [point]);
  const repository = roiApi.createRoiRepository("local", storage);
  assert.equal((await repository.list())[0].id, point.id);
  assert.deepEqual(await repository.readings(), []);
});

test("editing a cached server ROI preserves other cached observation points in the layout", async () => {
  setup();
  const first = roi(), second = roi();
  globalThis.fetch = async () => Response.json({ rois: [first, second] });
  const repository = roiApi.createRoiRepository("local", storage);
  await repository.list();
  globalThis.fetch = async () => { throw new Error("offline"); };
  await repository.save({ ...first, name: "edited" });
  const points = projects.readProjects(storage).projects[0].layout.observationPoints;
  assert.equal(points.length, 2);
  assert.equal(points.find((point) => point.id === second.id).name, second.name);
});

test("storage failure never reports a successful ROI save", async () => {
  setup("LOCAL");
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  await assert.rejects(roiApi.createRoiRepository("local", storage).save(roi()), /QuotaExceeded/);
});

test("ZIP exports unsaved ROI, rule, reference photo and model, then opens imported viewer offline", async () => {
  const project = setup("SERVER");
  const area = roi();
  area.measurements[0].rules = [{ operator: "gte", threshold: 75, severity: "WARNING" }];
  area.measurements[0].analysisConfig = { referenceFrame: { textureAssetId: "photo", name: "reference.png" } };
  const point = model.roiToObservationPoint(area);
  project.layout.observationPoints = [point];
  project.layout.observationConfig.observationPoints = [point];
  project.layout.equipmentAssetBindings = [{ id: "binding", equipmentId: "equipment", sourceType: "UPLOAD", assetId: "scan", assetType: "OBJ" }];
  assetMaps.equipment.set("scan", { id: "scan", primaryFileName: "scan.obj", files: [{ name: "scan.obj", blob: new Blob(["v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3"]) }] });
  assetMaps.textures.set("photo", { id: "photo", name: "reference.png", blob: new Blob(["photo-bytes"], { type: "image/png" }) });
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("offline"); };
  const zip = await bundle.exportProjectBundle(project, { storage });
  const decoded = await files.decodeProjectFile(zip, () => {});
  assert.equal(decoded.rois[0].id, point.id);
  assert.equal(decoded.project.layout.observationPoints[0].measurements[0].rules[0].threshold, 75);
  assert.equal(await decoded.assets.textures[0].blob.text(), "photo-bytes");
  const importedId = await bundle.importProjectBundle(zip, storage);
  const imported = await loader.loadProjectForViewer(importedId, new AbortController().signal, storage);
  assert.equal(imported.storageMode, "LOCAL");
  assert.equal(imported.serverProjectId, undefined);
  assert.equal(imported.layout.observationPoints[0].id, point.id);
  const frame = imported.layout.observationPoints[0].measurements[0].analysisConfig.referenceFrame;
  assert.notEqual(frame.textureAssetId, "photo");
  assert.equal(await assetMaps.textures.get(frame.textureAssetId).blob.text(), "photo-bytes");
  assert.equal(requests, 0);
});

test("v2 ZIP with ROI only in rois restores it into both layout locations", async () => {
  const project = setup("SERVER");
  const area = roi();
  const zip = await files.encodeProjectZip({ format: "digital-twin-project", version: 2, project, rois: [area], assets: { equipment: [], textures: [], custom: [] } }, () => {});
  const id = await bundle.importProjectBundle(zip, storage);
  const imported = projects.readProjects(storage).projects.find((item) => item.id === id);
  assert.equal(imported.layout.observationPoints[0].id, area.id);
  assert.deepEqual(imported.layout.observationConfig.observationPoints, imported.layout.observationPoints);
});

test("server viewer falls back to cached project by server ID; unsynced edits skip server", async () => {
  setup("SERVER");
  const loaded = await loader.loadProjectForViewer("server", new AbortController().signal, storage);
  assert.equal(loaded.id, "local");
  assert.equal(loaded.localFallback, true);
  assert.equal(loaded.storageMode, "LOCAL");
  await roiApi.createRoiRepository("server", storage).save(roi());
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("offline"); };
  const edited = await loader.loadProjectForViewer("server", undefined, storage);
  assert.equal(edited.layout.observationPoints.length, 1);
  assert.equal(calls, 0);
});

test("alarm acknowledgement remains persisted when backend is unavailable", async () => {
  setup("LOCAL");
  const result = await client.acknowledgeAlarm("local", "equipment", "alarm");
  assert.equal(result.storage, "LOCAL");
  assert.equal(client.readAlarmAcknowledgements("local", "equipment", storage).alarm, result.acknowledgedAt);
});

test("server deletion and access rejection do not reopen a synchronized cached viewer", async () => {
  for (const status of [401, 403, 404, 410]) {
    setup("SERVER");
    globalThis.fetch = async () => Response.json({ error: { code: "PROJECT_UNAVAILABLE", message: "unavailable" } }, { status });
    await assert.rejects(loader.loadProjectForViewer("server", undefined, storage), (error) => error.status === status);
    assert.equal(projects.readProjects(storage).projects.length, 1); // A rejected read is not authorization to erase local edits.
  }
});
