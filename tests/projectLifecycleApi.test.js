import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, config, viewer, editor, list, deletion;
const originalFetch = globalThis.fetch;
const originalChannel = globalThis.BroadcastChannel;
before(async () => {
  globalThis.BroadcastChannel = undefined;
  server = await createServer({ configFile: false, envDir: false,
    define: { "import.meta.env.VITE_PROJECT_API_BASE": JSON.stringify("https://fixture.invalid/api/v1") },
    cacheDir: "node_modules/.vite-project-lifecycle-tests", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const load = (name) => server.ssrLoadModule(`/src/features/portal/projects/${name}.js`);
  [config, viewer, editor, list, deletion] = await Promise.all([load("projectConfigurationApi"), load("projectViewerApi"), load("projectEditApi"), load("projectListApi"), load("projectDeleteApi")]);
});
after(async () => { globalThis.fetch = originalFetch; globalThis.BroadcastChannel = originalChannel; await server?.close(); });

test("create, edit, publish, list and delete use one server identity and preserve complete layout", async () => {
  let revision = 0, publishedRevision = null, deleted = false;
  const layouts = new Map();
  globalThis.fetch = async (url, options) => {
    const { pathname, searchParams } = new URL(url);
    const method = options.method ?? "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "same-origin");
    const ok = (data) => Response.json({ request_id: "trace", data });
    if (pathname === "/api/v1/projects" && method === "POST") {
      assert.equal(body.externalProjectId, "local-id");
      assert.ok(body.clientRequestId);
      return ok({ project: { id: "server-id", externalProjectId: body.externalProjectId } });
    }
    if (pathname === "/api/v1/projects") return ok({ items: deleted ? [] : [{ id: "server-id", externalProjectId: "local-id", name: "설비", scope: "SINGLE_EQUIPMENT", revision, publishedRevision }], nextCursor: null });
    assert.ok(pathname.startsWith("/api/v1/projects/server-id"));
    if (method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
    if (deleted) return Response.json({ error: { code: "PROJECT_DELETED", message: "deleted" } }, { status: 410 });
    if (pathname.endsWith("/draft")) {
      assert.equal(body.baseRevision, revision);
      layouts.set(++revision, body.layout);
      return ok({ projectId: "server-id", revision });
    }
    if (pathname.endsWith("/validate")) { assert.equal(body.revision, revision); return ok({ valid: true, issues: [] }); }
    if (pathname.endsWith("/publish")) { publishedRevision = body.revision; return ok({ projectId: "server-id", publishedRevision }); }
    const selected = searchParams.get("mode") === "viewer" ? publishedRevision : revision;
    return ok({ project: { id: "server-id", externalProjectId: "local-id", revision: selected, layout: layouts.get(selected), assetManifest: [] } });
  };
  const layout = { version: 18, name: "설비", hierarchy: { nodes: [] }, observationWorkflow: { scopeType: "SINGLE_EQUIPMENT" },
    equipmentByFloorId: {}, viewerPreset: { arbitraryNestedFutureField: { values: [0, false, null] } },
    equipmentAssetBindings: [], sensorBindings: [], observationPoints: [], serverBindings: [],
    observationConfig: { equipmentAssetBindings: [], sensorBindings: [], observationPoints: [], serverBindings: [] } };
  const project = await config.createBackendProject("local-id", layout);
  await config.saveProjectConfiguration(project.id, layout);
  await config.publishProjectConfiguration(project.id, 1);
  const changed = { ...layout, name: "설비 수정", viewerPreset: { ...layout.viewerPreset, backgroundTheme: "DARK" } };
  await config.saveProjectConfiguration(project.id, changed, undefined, 1);
  assert.deepEqual((await viewer.loadViewerProjectConfiguration(project.id)).layout, layout);
  assert.deepEqual((await editor.loadEditableProject(project.id)).layout, changed);
  await config.publishProjectConfiguration(project.id, 2);
  assert.deepEqual((await viewer.loadViewerProjectConfiguration(project.id)).layout, changed);
  assert.equal((await list.listProjectConfigurations()).items[0].projectId, project.id);
  await deletion.deleteProjectConfiguration(project.id);
  assert.equal((await list.listProjectConfigurations()).items.length, 0);
  await assert.rejects(viewer.loadViewerProjectConfiguration(project.id), (error) => error.status === 410);
});

test("failed revision checks and validation do not publish a new viewer", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return url.endsWith("/draft") ? Response.json({ error: { code: "REVISION_CONFLICT", message: "changed" } }, { status: 409 })
      : Response.json({ data: { valid: false, issues: [{ message: "missing asset" }] } });
  };
  await assert.rejects(config.saveProjectConfiguration("server", { version: 18, hierarchy: { nodes: [] } }), (error) => error.code === "REVISION_CONFLICT");
  await assert.rejects(config.publishProjectConfiguration("server", 2), /missing asset/);
  assert.equal(requests.some((url) => url.endsWith("/publish")), false);
});
