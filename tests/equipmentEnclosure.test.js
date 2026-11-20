import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";
import { getEnclosure, getEnclosureDoor, getEnclosureScanSlot } from "../src/features/digitalTwin/editor/model/equipmentEnclosure.js";
import { normalizeAssetBinding } from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";
import { modelToScanSlot, scanSlotToModel } from "../src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js";
import { encodeProjectZip, decodeProjectFile } from "../src/features/portal/projects/projectBundleFiles.js";

let server, generateEnclosure, disposeObject3D, applyAssetAlignment;
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  ({ generateEnclosure } = await server.ssrLoadModule("/src/features/digitalTwin/editor/generators/EnclosureGenerator.js"));
  ({ disposeObject3D } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/disposeObject3D.js"));
  ({ applyAssetAlignment } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/EquipmentAssetViewer.jsx"));
});
after(async () => { await server?.close(); });

function cabinet(changes = {}) {
  return { id: "CABINET", dimensions: { width: 1.2, height: 2, depth: .8 },
    enclosure: { enabled: true, doorCount: 2, doorLayout: "SIDE_BY_SIDE", doorRatios: [.4, .6],
      doors: [{ hinge: "LEFT", open: true }, { hinge: "RIGHT", open: true }], ...changes } };
}
function panels(equipment) {
  const object = generateEnclosure(equipment, { edgeColor: "#000000", sceneTheme: "light" });
  const ids = [];
  object.traverse((child) => { if (child.userData.enclosurePanel) ids.push(child.userData.enclosurePanel); });
  disposeObject3D(object);
  return ids;
}

test("좌우 양문은 내부를 한 공간으로 바꿔도 문 크기와 경첩·열림 상태를 유지한다", () => {
  const divided = cabinet(), shared = cabinet({ interiorLayout: "SHARED" });
  assert.equal(getEnclosure(divided).interiorLayout, "PARTITIONED");
  assert.ok(panels(divided).includes("front-divider-0"));
  assert.deepEqual(panels(shared), panels(divided).filter((id) => id !== "front-divider-0"));
  for (const index of [0, 1]) assert.deepEqual(getEnclosureDoor(shared, index), getEnclosureDoor(divided, index));
});

test("공유 내부는 앞뒤 모든 문에서 전체 폭을 사용하며 스캔을 반쪽 공간으로 축소하지 않는다", () => {
  const equipment = cabinet({ interiorLayout: "SHARED", rear: { doorCount: 2, doorLayout: "SIDE_BY_SIDE", interiorLayout: "SHARED" } });
  assert.ok(!panels(equipment).some((id) => id.includes("divider")));
  for (const side of ["FRONT", "REAR"]) {
    const first = getEnclosureScanSlot(equipment, 0, side);
    for (const index of [0, 1]) {
      const slot = getEnclosureScanSlot(equipment, index, side);
      assert.deepEqual(slot.origin, first.origin);
      assert.deepEqual(slot.dimensions, { width: 1.16, height: 1.96, depth: .76 });
      const local = { x: 1, y: .4, z: -.1 };
      const restored = modelToScanSlot(scanSlotToModel(local, slot), slot);
      for (const axis of ["x", "y", "z"]) assert.ok(Math.abs(restored[axis] - local[axis]) < 1e-8);
      const actualObject = new THREE.Mesh(new THREE.BoxGeometry(1000, 500, 100));
      const aligned = new THREE.Group(); aligned.add(actualObject);
      const binding = normalizeAssetBinding({ equipmentId: equipment.id, scanSlot: { side, index },
        alignmentTransform: { unit: "MM", fitToProxy: true } });
      assert.equal(applyAssetAlignment({ actualObject, aligned }, binding, equipment), true);
      const bounds = new THREE.Box3().setFromObject(aligned);
      assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x - 1.16) < 1e-8);
      assert.ok(Math.abs((side === "FRONT" ? bounds.min.x : bounds.max.x) - slot.origin.x) < 1e-8);
      disposeObject3D(aligned);
    }
  }
});

test("좌우 칸막이를 없애도 앞뒤 가운데 칸막이와 층별 선반은 유지한다", () => {
  const equipment = cabinet({ interiorLayout: "SHARED", bodyLayout: "BACK_TO_BACK",
    rear: { doorCount: 3, doorLayout: "STACKED", interiorLayout: "SHARED" } });
  const ids = panels(equipment);
  assert.ok(!ids.includes("front-divider-0"));
  assert.ok(ids.includes("center-divider"));
  assert.ok(ids.includes("rear-shelf-0"));
  assert.ok(ids.includes("rear-shelf-1"));
  assert.equal(getEnclosure(equipment).rear.interiorLayout, "PARTITIONED");
  assert.ok(getEnclosureScanSlot(equipment, 0).dimensions.depth < .4);
});

test("한 공간 양문 구성은 저장 데이터와 ZIP 왕복 후 같은 형상으로 복원된다", async () => {
  const equipment = cabinet({ interiorLayout: "SHARED", rear: { doorCount: 2, doorLayout: "SIDE_BY_SIDE", interiorLayout: "SHARED" } });
  const source = { format: "digital-twin-project", version: 2, project: { id: "P1", layout: {
    equipmentByFloorId: { F1: [equipment] },
  } }, assets: { equipment: [], textures: [], custom: [] } };
  const restored = await decodeProjectFile(await encodeProjectZip(JSON.parse(JSON.stringify(source)), () => {}), () => {});
  const imported = restored.project.layout.equipmentByFloorId.F1[0];
  assert.deepEqual(getEnclosure(imported), getEnclosure(equipment));
  assert.deepEqual(panels(imported), panels(equipment));
  assert.ok(!panels(imported).some((id) => id.includes("divider")));
});
