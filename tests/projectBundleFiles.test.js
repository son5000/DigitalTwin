import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { encodeProjectZip, decodeProjectFile } from "../src/features/portal/projects/projectBundleFiles.js";
import { normalizeSensorBinding } from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";

test("여러 스캔과 설정·대표 이미지가 ZIP 왕복 후 그대로 복원되고 손상된 파일은 거부된다", async () => {
  const previousReader = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.();
      }, (error) => { this.error = error; this.onerror?.(); });
    }
  };
  try {
    const source = {
      format: "digital-twin-project", version: 2, project: { id: "P1", layout: {
        hierarchy: { nodes: [{ id: "E1", type: "EQUIPMENT" }] },
        equipmentAssetBindings: [{ id: "B1", assetId: "A1", scanSlot: { side: "FRONT", index: 0 } },
          { id: "B2", assetId: "A2", scanSlot: { side: "FRONT", index: 1 } }],
        sensorBindings: [{ id: "S1", scanSlotMount: { side: "FRONT", index: 1, position: { x: .2, y: .3, z: -.1 } } }],
        viewerPreset: { virtualCameras: { E1: [{ id: "C1", name: "내부" }] } },
        representativeImage: `data:image/png;base64,${Buffer.from("image-sample").toString("base64")}`,
      } }, rois: [{ id: "R1", equipmentId: "E1" }], assets: {
        equipment: [{ id: "A1", files: [{ name: "first.obj", blob: new Blob(["scan-one"]) }] },
          { id: "A2", files: [{ name: "second.ply", blob: new Blob(["scan-two"]) }] }],
        textures: [], custom: [],
      },
    };
    const zip = await encodeProjectZip(source, () => {});
    const restored = await decodeProjectFile(zip, () => {});
    assert.deepEqual(restored.project.layout.equipmentAssetBindings, source.project.layout.equipmentAssetBindings);
    assert.deepEqual(restored.project.layout.sensorBindings, source.project.layout.sensorBindings);
    assert.deepEqual(restored.project.layout.viewerPreset, source.project.layout.viewerPreset);
    assert.equal(restored.project.layout.representativeImage, source.project.layout.representativeImage);
    assert.deepEqual(restored.rois, source.rois);
    assert.equal(await restored.assets.equipment[0].files[0].blob.text(), "scan-one");
    assert.equal(await restored.assets.equipment[1].files[0].blob.text(), "scan-two");

    const bytes = new Uint8Array(await zip.arrayBuffer());
    const needle = new TextEncoder().encode("scan-one");
    const start = bytes.findIndex((value, index) => value === needle[0] && needle.every((part, offset) => bytes[index + offset] === part));
    assert.ok(start >= 0);
    bytes[start] ^= 1;
    await assert.rejects(decodeProjectFile(new Blob([bytes]), () => {}), /무결성/);
  } finally {
    globalThis.FileReader = previousReader;
  }
});

test("ZIP 가져오기는 프로젝트·파일 ID와 센서 보정 참조를 새 프로젝트에 맞춘다", async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const originalWindow = globalThis.window, originalStorageEvent = globalThis.StorageEvent;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  let originalPut;
  try {
    const { importProjectBundle } = await server.ssrLoadModule("/src/features/portal/projects/projectBundle.js");
    const { PROJECT_STORAGE_KEY } = await server.ssrLoadModule("/src/features/portal/projects/projectRepository.js");
    const { equipmentAssetRepository } = await server.ssrLoadModule("/src/features/digitalTwin/editor/api/equipmentAssetRepository.js");
    const files = [];
    originalPut = equipmentAssetRepository.put;
    equipmentAssetRepository.put = async (asset) => { files.push(asset); return asset; };
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    globalThis.window = { localStorage: storage, dispatchEvent() {} };
    globalThis.StorageEvent = class { constructor(type, options) { this.type = type; this.key = options.key; } };
    const sensor = normalizeSensorBinding({ id: "S1", equipmentIds: ["E1"], serverSensorId: "D1", serialNumber: "SERIAL",
      mountMode: "EQUIPMENT", position: { x: .1, y: .2, z: .3 }, calibrationConfirmed: true,
      calibrationConfirmationModel: "old-model", calibration: { storage: "SERVER", revision: 4, signature: "old-signature" } });
    const source = { format: "digital-twin-project", version: 2, project: { id: "P1", layout: {
      hierarchy: { nodes: [{ id: "E1", type: "EQUIPMENT" }] }, equipmentByFloorId: { F1: [{ id: "E1", dimensions: { width: 1, height: 2, depth: 1 } }] },
      equipmentAssetBindings: [{ id: "B1", equipmentId: "E1", assetId: "A1", sourceType: "UPLOAD", sourceKey: "model.ply", assetType: "PLY" }],
      sensorBindings: [sensor], observationConfig: { sensorBindings: [sensor] },
    } }, rois: [], assets: { equipment: [{ id: "A1", files: [{ name: "model.ply", blob: new Blob(["sample"]) }] }], textures: [], custom: [] } };
    const zip = await encodeProjectZip(source, () => {});
    const projectId = await importProjectBundle(zip, storage, { onProgress() {} });
    const registry = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));
    const imported = registry.projects.find((project) => project.id === projectId);
    assert.ok(imported);
    assert.notEqual(projectId, "P1");
    assert.equal(files.length, 1);
    assert.notEqual(files[0].id, "A1");
    assert.equal(imported.layout.equipmentAssetBindings[0].assetId, files[0].id);
    const restoredSensor = imported.layout.sensorBindings[0];
    assert.equal(restoredSensor.calibration.payload.projectId, projectId);
    assert.equal(restoredSensor.calibration.signature, JSON.stringify(restoredSensor.calibration.payload));
    assert.equal(restoredSensor.calibration.storage, "LOCAL");
    assert.equal(imported.layout.observationConfig.sensorBindings[0].calibrationConfirmationModel, restoredSensor.calibrationConfirmationModel);
  } finally {
    globalThis.window = originalWindow;
    globalThis.StorageEvent = originalStorageEvent;
    globalThis.BroadcastChannel = originalBroadcastChannel;
    if (originalPut) {
      const { equipmentAssetRepository } = await server.ssrLoadModule("/src/features/digitalTwin/editor/api/equipmentAssetRepository.js");
      equipmentAssetRepository.put = originalPut;
    }
    await server.close();
  }
});
