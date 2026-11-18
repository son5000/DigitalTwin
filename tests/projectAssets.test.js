import test from "node:test";
import assert from "node:assert/strict";
import { downloadAssetFile, downloadNativeAssetBundle, sha256, uploadNativeAssetBundle, validateAssetManifest } from "../src/features/portal/projects/projectAssetTransport.js";
import { loadDisplayAsset, parseDisplayAsset } from "../src/features/portal/projects/displayAssetApi.js";
import { assertAssetsComplete, restoreAssetRecords, validateNativeAssets } from "../src/features/portal/projects/projectAssetRestore.js";
import { encodeProjectZip, decodeProjectFile } from "../src/features/portal/projects/projectBundleFiles.js";
import { readProjectArchive } from "../src/features/portal/projects/projectArchive.js";
import { createProjectConfigurationPayload } from "../src/features/portal/projects/projectConfigurationApi.js";
import { parseProjectConfiguration } from "../src/features/portal/projects/projectViewerApi.js";
import { equipmentScanBindings } from "../src/features/digitalTwin/editor/model/equipmentScanBindings.js";

const hash = "a".repeat(64);
const emptyAssets = () => ({ equipment: [], textures: [], custom: [] });

test("native ZIP upload uses multipart and passes the immutable reference into the draft", async () => {
  const archive = await encodeProjectZip({ format: "digital-twin-assets", version: 2, assets: emptyAssets() });
  const archiveHash = await sha256(archive);
  const manifestHash = await sha256(await (await readProjectArchive(archive)).read("project.json", "application/json"));
  const reference = { kind: "NATIVE_BUNDLE", asset_id: "native-1", manifest_sha256: manifestHash, archive_sha256: archiveHash };
  const uploaded = await uploadNativeAssetBundle("local-1", archive, undefined, async (path, options) => {
    assert.equal(path, "/project-assets");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.headers, undefined); // Browser supplies the multipart boundary.
    assert.equal(await sha256(options.body.get("file")), archiveHash);
    const metadata = JSON.parse(options.body.get("metadata"));
    assert.equal(metadata.archive_sha256, archiveHash);
    assert.equal(metadata.externalProjectId, "local-1");
    return { asset: reference };
  });
  const payload = createProjectConfigurationPayload({ version: 18, hierarchy: { nodes: [] } }, 2, [uploaded]);
  assert.deepEqual(payload.assetManifest, [reference]);
  const restored = await downloadNativeAssetBundle(reference, undefined, async (path) => {
    assert.equal(path, "/project-assets/native-1/file"); return archive;
  });
  assert.equal(await sha256(restored), archiveHash);
  await assert.rejects(downloadNativeAssetBundle(reference, undefined, async () => new Blob(["tampered"])), /SHA-256/);
  await assert.rejects(uploadNativeAssetBundle("local-1", archive, undefined, async () => { throw Object.assign(new Error(), { status: 404 }); }), /아직 준비되지/);
});

test("native archive preserves OBJ, texture bytes and custom definitions and checks missing dependencies", async () => {
  const assets = emptyAssets();
  assets.equipment.push({ id: "scan", primaryFileName: "model.obj", files: [{ name: "model.obj", blob: new Blob(["v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3"]) }] });
  assets.textures.push({ id: "image", blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }) });
  assets.custom.push({ id: "custom", textureAssetId: "image", parts: [{ id: "part", width: 2 }] });
  const zip = await encodeProjectZip({ format: "digital-twin-assets", version: 2, projectId: "local", assets });
  const restored = validateNativeAssets(await decodeProjectFile(zip, () => {}));
  assert.equal(await restored.equipment[0].files[0].blob.text(), await assets.equipment[0].files[0].blob.text());
  assert.deepEqual(new Uint8Array(await restored.textures[0].blob.arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.deepEqual(restored.custom, assets.custom);
  const layout = { bindings: [{ sourceType: "UPLOAD", assetId: "scan" }], customAssetId: "custom" };
  assertAssetsComplete(layout, restored);
  assert.throws(() => assertAssetsComplete(layout, { ...restored, textures: [] }), /image/);
});

test("partial local restoration rolls back previous values, including cancellation", async () => {
  const records = new Map([["a", { id: "a", value: "old" }]]);
  const controller = new AbortController();
  const repository = { get: async (id) => records.get(id), remove: async (id) => records.delete(id),
    put: async (asset) => { records.set(asset.id, asset); if (asset.id === "b") controller.abort(); } };
  const assets = { ...emptyAssets(), textures: [{ id: "a", value: "new" }, { id: "b" }] };
  await assert.rejects(restoreAssetRecords(assets, { textures: repository }, controller.signal), { name: "AbortError" });
  assert.deepEqual([...records.values()], [{ id: "a", value: "old" }]);
});

test("display asset download verifies every member and never uses server-supplied download URLs", async () => {
  const model = new Blob([JSON.stringify({ asset: { version: "2.0" }, scenes: [] })], { type: "model/gltf+json" });
  const member = { member_id: "model", kind: "MODEL", sha256: await sha256(model), size_bytes: model.size };
  const reference = { asset_id: "display-1", manifest_sha256: hash };
  const data = { ...reference, manifest: { asset_id: "display-1", format_version: "1.0", model_member: "model", materials: [], members: [member] },
    members: [{ ...member, url: "https://untrusted.invalid/file" }] };
  const record = await loadDisplayAsset(reference, undefined, { request: async () => data, download: async (path) => {
    assert.equal(path, "/display-assets/display-1/files/model"); return model;
  } });
  assert.equal(record.assetType, "GLTF");
  assert.equal(record.primaryFileName, "model");
  assert.throws(() => parseDisplayAsset({ ...data, manifest_sha256: "b".repeat(64) }, reference), /일치하지/);
  await assert.rejects(loadDisplayAsset(reference, undefined, { request: async () => data, download: async () => new Blob(["bad"]) }), /SHA-256/);
});

test("fetch is bounded to the configured API and rejects HTTP errors", async () => {
  const blob = await downloadAssetFile("/display-assets/id/files/model", undefined, { base: "https://backend.invalid/api/v1",
    fetcher: async (url, options) => {
      assert.equal(url, "https://backend.invalid/api/v1/display-assets/id/files/model");
      assert.equal(options.redirect, "error"); return new Response("model");
    } });
  assert.equal(await blob.text(), "model");
  await assert.rejects(downloadAssetFile("/file", undefined, { base: "/api", fetcher: async () => new Response("", { status: 404 }) }), /404/);
});

test("synthetic demo is rejected for missing hierarchy; supported display bindings are scan candidates", () => {
  assert.throws(() => parseProjectConfiguration({ project: { id: "demo", revision: 1,
    layout: { version: 18, equipment_id: "equipment" }, assetManifest: [] } }, "demo"), /hierarchy.nodes/);
  assert.throws(() => validateAssetManifest([{ asset_id: "x", manifest_sha256: hash }, { asset_id: "x", manifest_sha256: hash }]), /중복/);
  assert.throws(() => validateAssetManifest([{ asset_id: "x", manifest_sha256: hash, kind: "UNKNOWN" }]));
  const binding = { id: "b", equipmentId: "equipment", assetType: "GLTF" };
  assert.deepEqual(equipmentScanBindings({ id: "equipment" }, [binding]), [binding]);
});
