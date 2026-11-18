import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { sha256 } from "../src/features/portal/projects/projectAssetTransport.js";
import { readProjectArchive } from "../src/features/portal/projects/projectArchive.js";

let server, assetsApi, configApi, viewerApi, loadBindingObject;
const records = new Map();
const originalFetch = globalThis.fetch;
const originalProgressEvent = globalThis.ProgressEvent;
before(async () => {
  server = await createServer({ configFile: false, envDir: false,
    define: { "import.meta.env.VITE_PROJECT_API_BASE": JSON.stringify("https://fixture.invalid/api/v1") },
    cacheDir: "node_modules/.vite-project-assets-tests", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const originalChannel = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  try {
    assetsApi = await server.ssrLoadModule("/src/features/portal/projects/projectAssetApi.js");
  } finally { globalThis.BroadcastChannel = originalChannel; }
  configApi = await server.ssrLoadModule("/src/features/portal/projects/projectConfigurationApi.js");
  viewerApi = await server.ssrLoadModule("/src/features/portal/projects/projectViewerApi.js");
  const { equipmentAssetRepository } = await server.ssrLoadModule("/src/features/digitalTwin/editor/api/equipmentAssetRepository.js");
  Object.assign(equipmentAssetRepository, { get: async (id) => records.get(id), put: async (asset) => records.set(asset.id, asset), remove: async (id) => records.delete(id) });
  ({ loadBindingObject } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/EquipmentAssetViewer.jsx"));
  globalThis.ProgressEvent = class extends Event { constructor(type, init) { super(type); Object.assign(this, init); } };
});
after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.ProgressEvent = originalProgressEvent;
  await server?.close();
});

test("editor asset upload -> draft manifest -> clean-cache viewer restore preserves original model bytes", async () => {
  records.clear();
  const modelText = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3";
  records.set("local-model", { id: "local-model", primaryFileName: "model.obj", files: [{ name: "model.obj", blob: new Blob([modelText]) }] });
  const layout = { version: 18, hierarchy: { nodes: [{ id: "equipment", type: "EQUIPMENT" }] },
    equipmentAssetBindings: [{ id: "binding", equipmentId: "equipment", assetId: "local-model", sourceType: "UPLOAD", assetType: "OBJ" }] };
  let archive, saved;
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(url.startsWith("https://fixture.invalid/api/v1"));
    const path = new URL(url).pathname;
    if (path === "/api/v1/project-assets") {
      assert.equal(options.headers["Content-Type"], undefined);
      archive = options.body.get("file");
      const manifest = await (await readProjectArchive(archive)).read("project.json", "application/json");
      return Response.json({ data: { asset: { kind: "NATIVE_BUNDLE", asset_id: "native", archive_sha256: await sha256(archive), manifest_sha256: await sha256(manifest) } } });
    }
    if (path.endsWith("/draft")) {
      assert.equal(options.headers["Content-Type"], "application/json");
      saved = JSON.parse(options.body);
      return Response.json({ data: { projectId: "server-project", revision: 1 } });
    }
    if (path.endsWith("/file")) return new Response(archive);
    return Response.json({ data: { project: { id: "server-project", revision: 1, layout: saved.layout, assetManifest: saved.assetManifest } } });
  };
  const references = await assetsApi.uploadProjectAssets("external-project", layout);
  await configApi.saveProjectConfiguration("server-project", layout, undefined, 0, references);
  assert.equal(saved.assetManifest[0].kind, "NATIVE_BUNDLE");
  records.clear(); // Represents another browser with no original file cache.
  const remote = await viewerApi.loadViewerProjectConfiguration("server-project");
  await assetsApi.loadProjectAssets("server-project", remote.revision, remote.layout, undefined, remote.assetManifest);
  assert.equal(await records.get("local-model").files[0].blob.text(), modelText);
  assert.deepEqual(remote.layout.equipmentAssetBindings, layout.equipmentAssetBindings);
});

test("server glTF asset is linked to the declared equipment and loaded with original node transforms", async () => {
  records.clear();
  const buffer = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer).toString("base64");
  const model = new Blob([JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: `data:application/octet-stream;base64,${buffer}`, byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0, translation: [2, 3, 4] }], scenes: [{ nodes: [0] }], scene: 0 })]);
  const reference = { asset_id: "display", manifest_sha256: "a".repeat(64) };
  const member = { member_id: "model", kind: "MODEL", size_bytes: model.size, sha256: await sha256(model) };
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("data:")) return originalFetch(url, options);
    if (String(url).endsWith("/files/model")) return new Response(model);
    return Response.json({ data: { ...reference, members: [member], manifest: { asset_id: "display", format_version: "1.0", model_member: "model", members: [member], materials: [] } } });
  };
  const layout = { equipmentAssetBindings: [{ id: "binding", equipmentId: "equipment", assetId: "display", assetType: "GLTF", sourceType: "SERVER_KEY" }] };
  await assetsApi.loadProjectAssets("project", 1, layout, undefined, [reference]);
  assert.equal(layout.equipmentAssetBindings[0].sourceType, "UPLOAD");
  const loaded = await loadBindingObject(layout.equipmentAssetBindings[0]);
  try {
    const mesh = loaded.object.children[0];
    assert.equal(mesh.geometry.getAttribute("position").count, 3);
    assert.deepEqual(mesh.position.toArray(), [2, 3, 4]);
  } finally { loaded.revoke(); }
  await assert.rejects(assetsApi.loadProjectAssets("project", 1, { equipmentAssetBindings: [] }, undefined, [reference]), /연결된 설비/);
});

test("glTF and GLB permit packaged resources and reject undeclared external resources", async () => {
  const { validateGltfResources } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/loadStoredGltf.js");
  const data = (value) => new TextEncoder().encode(JSON.stringify(value)).buffer;
  assert.throws(() => validateGltfResources(data({ asset: { version: "2.0" }, images: [{ uri: "https://external.invalid/image.png" }] })), /외부 파일/);
  assert.throws(() => validateGltfResources(data({ asset: { version: "2.0" }, images: [{ uri: "blob:untrusted" }] })), /외부 파일/);
  assert.doesNotThrow(() => validateGltfResources(data({ asset: { version: "2.0" }, images: [{ uri: "front" }] }), ["front"]));
  const json = new TextEncoder().encode('{"asset":{"version":"2.0"},"images":[{"bufferView":0}]}');
  const size = Math.ceil(json.length / 4) * 4;
  const glb = new ArrayBuffer(20 + size), view = new DataView(glb);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, glb.byteLength, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(glb, 20).fill(32); new Uint8Array(glb, 20).set(json);
  assert.doesNotThrow(() => validateGltfResources(glb));
});
