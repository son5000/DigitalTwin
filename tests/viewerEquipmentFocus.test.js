import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { equipmentWorldBounds, focusEquipmentInWorld, updateViewerCameraRange } from "../src/features/digitalTwin/editor/three/viewerEquipmentFocus.js";

function runtime() {
  const camera = new THREE.PerspectiveCamera(46, 1.8, 0.01, 100);
  camera.position.set(80, 40, 70);
  return { activeCamera: camera, orbitControls: { target: new THREE.Vector3(), minDistance: 0.1, maxDistance: 10000 },
    container: { clientWidth: 1600, clientHeight: 900 } };
}

test("작은 설비를 선택한 뒤 멀리 줌아웃해도 월드 전체가 원거리 클리핑 범위 안에 남는다", () => {
  const { activeCamera: camera } = runtime();
  const bounds = new THREE.Box3(new THREE.Vector3(-150, -0.1, -180), new THREE.Vector3(220, 12, 190));
  for (const distance of [10, 100, 1000, 10000]) {
    camera.position.set(distance, distance * 0.5, distance);
    camera.lookAt(bounds.getCenter(new THREE.Vector3()));
    camera.updateMatrixWorld(true);
    updateViewerCameraRange(camera, bounds);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      if (point.z < 0) assert.ok(-point.z < camera.far, `distance=${distance}`);
    }
    assert.ok(camera.near <= 0.1);
  }
});

test("설비 정면 포커스는 건물·방 회전과 배치 위치를 반영하고 주변 설비는 유지한다", () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Group(); floor.position.set(30, 11, -25); floor.rotation.y = Math.PI / 2;
  scene.add(floor);
  const equipment = new THREE.Group(); equipment.userData.equipmentId = "selected";
  equipment.position.set(4, 0, 3); equipment.rotation.y = Math.PI / 4;
  equipment.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshStandardMaterial()));
  const neighbour = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial()); neighbour.position.x = 100;
  floor.add(equipment, neighbour);
  const state = runtime();
  const original = state.activeCamera.position.clone();
  assert.equal(focusEquipmentInWorld(state, floor, { rotation: { y: Math.PI / 4 } }, { equipmentId: "selected", parent: floor }), true);
  assert.equal(state.cameraFocus.duration, 700);
  assert.ok(state.activeCamera.position.equals(original));
  const expectedCenter = equipment.getWorldPosition(new THREE.Vector3());
  assert.ok(state.cameraFocus.target.distanceTo(expectedCenter) < 1e-6);
  const expectedFront = new THREE.Vector3(0, 0, 1).applyQuaternion(equipment.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(state.cameraFocus.position.clone().sub(state.cameraFocus.target).normalize().distanceTo(expectedFront) < 1e-6);
  assert.equal(neighbour.visible, true);
  assert.equal(floor.children.length, 2);
});

test("인스턴싱된 설비는 선택한 인스턴스만 카메라 경계로 사용한다", () => {
  const root = new THREE.Group(); root.position.set(12, 8, -4); root.rotation.y = Math.PI / 2;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshStandardMaterial(), 3);
  mesh.userData.equipmentInstanceIds = ["a", "b", "c"];
  [0, 10, 100].forEach((x, index) => mesh.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 2, 0)));
  root.add(mesh); root.updateMatrixWorld(true);
  const bounds = equipmentWorldBounds(root, "b");
  assert.ok(bounds.getCenter(new THREE.Vector3()).distanceTo(root.localToWorld(new THREE.Vector3(10, 2, 0))) < 1e-6);
  assert.ok(bounds.getSize(new THREE.Vector3()).distanceTo(new THREE.Vector3(2, 4, 2)) < 1e-6);
  assert.equal(mesh.count, 3);
});
