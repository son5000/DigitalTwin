import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { isVisibleSurfaceIntersection } from "../src/features/digitalTwin/editor/three/objectRaycast.js";
import { pickEquipmentId } from "../src/features/digitalTwin/editor/three/equipmentRaycast.js";

test("벽 외곽선의 1m 선택 범위 대신 실제 클릭한 옆 오브젝트 표면을 선택한다", () => {
  const root = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 4), new THREE.MeshBasicMaterial());
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry), new THREE.LineBasicMaterial());
  wall.add(edges); root.add(wall);
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial());
  target.position.set(0.6, 0, 0); target.userData.equipmentId = "beside-wall"; root.add(target);
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0.6, 0, 10), new THREE.Vector3(0, 0, -1));
  const hits = ray.intersectObject(root, true);
  assert.equal(hits[0].object, edges); // Reproduces the previous wrong selection.
  assert.equal(hits.find((hit) => isVisibleSurfaceIntersection(hit, root)).object, target);
  assert.equal(pickEquipmentId(ray, root), "beside-wall");
  root.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
});

test("보이지 않는 벽 재질·숨긴 상위 그룹은 건너뛰고 불투명 벽의 실제 표면은 유지한다", () => {
  const root = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  root.add(wall);
  const hit = { object: wall, face: { materialIndex: 0 } };
  assert.equal(isVisibleSurfaceIntersection(hit, root), true);
  wall.material.visible = false;
  assert.equal(isVisibleSurfaceIntersection(hit, root), false);
  wall.material.visible = true; wall.material.transparent = true; wall.material.opacity = 0;
  assert.equal(isVisibleSurfaceIntersection(hit, root), false);
  wall.material.opacity = 0.3;
  assert.equal(isVisibleSurfaceIntersection(hit, root), true);
  root.visible = false;
  assert.equal(isVisibleSurfaceIntersection(hit, root), false);
  wall.geometry.dispose(); wall.material.dispose();
});

test("다중 재질은 맞은 면의 표시 상태를 사용하고 점군은 선택 가능하다", () => {
  const materials = [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshBasicMaterial()];
  const object = new THREE.Mesh(new THREE.BoxGeometry(), materials);
  assert.equal(isVisibleSurfaceIntersection({ object, face: { materialIndex: 0 } }), false);
  assert.equal(isVisibleSurfaceIntersection({ object, face: { materialIndex: 1 } }), true);
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  assert.equal(isVisibleSurfaceIntersection({ object: points }), true);
  object.geometry.dispose(); materials.forEach((material) => material.dispose());
  points.geometry.dispose(); points.material.dispose();
});
