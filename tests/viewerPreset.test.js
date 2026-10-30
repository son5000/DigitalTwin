import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { captureViewerCamera, restoreEquipmentCamera } from "../src/features/digitalTwin/editor/three/viewerCameraMemory.js";
import { applyEquipmentEnvironment } from "../src/features/digitalTwin/editor/three/equipmentEnvironment.js";

import {
  createViewerPreset,
  EQUIPMENT_DISPLAY_OVERRIDES,
  EQUIPMENT_GLOBAL_DISPLAY_MODES,
  EQUIPMENT_REPRESENTATIONS,
  resolveEquipmentRepresentation,
  setEquipmentDisplayOverride,
  normalizeEquipmentEnvironment,
  normalizeEquipmentView,
} from "../src/features/digitalTwin/editor/model/viewerPreset.js";

test("설비별 배경·지면은 독립적으로 저장되고 잘못된 값은 보정된다", () => {
  const preset = createViewerPreset({ equipmentEnvironments: {
    A: { backgroundColor: "#123456", groundMode: "TRANSLUCENT", groundOpacity: 0.4, groundHeight: -2 },
    B: { backgroundColor: "bad", groundMode: "HIDDEN", gridSpacing: -1, groundSize: 100000 },
    C: null,
  } });
  const restored = createViewerPreset(JSON.parse(JSON.stringify(preset))).equipmentEnvironments;
  assert.equal(restored.A.backgroundColor, "#123456");
  assert.equal(restored.A.groundHeight, -2);
  assert.equal(restored.B.groundMode, "HIDDEN");
  assert.equal(restored.B.gridSpacing, 0.01);
  assert.equal(restored.B.groundSize, 10000);
  assert.equal(restored.B.backgroundColor, "#f5f5f5");
  assert.equal(restored.C, undefined);
});

test("모델 관제 화면의 환경과 카메라 기본값을 사용한다", () => {
  assert.deepEqual(normalizeEquipmentEnvironment(), {
    backgroundColor: "#f5f5f5", groundColor: "#a1a1a1", gridColor: "#1f6c98",
    groundMode: "VISIBLE", groundOpacity: 0.28, groundSize: 20, groundHeight: 0,
    gridVisible: true, gridSpacing: 0.5,
  });
  assert.equal(normalizeEquipmentView({ position: [0, 1, 3], target: [0, 1, 0], up: [0, 1, 0] }).fov, 60);
});

test("환경 변경은 지면·격자에 적용되고 전용 설정 해제 시 기본 화면으로 복원한다", () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial());
  ground.position.y = -0.015;
  const grid = new THREE.GridHelper(8, 8);
  const renderer = {};
  const runtime = { scene, ground, grid, renderer };
  applyEquipmentEnvironment(runtime, { backgroundColor: "#123456", groundColor: "#abcdef", groundMode: "TRANSLUCENT", groundOpacity: 0.4, groundSize: 12, gridSpacing: 2, groundHeight: -1 }, "VISIBLE", "dark");
  assert.equal(scene.background.getHexString(), "123456");
  assert.equal(ground.material.opacity, 0.4);
  assert.equal(ground.scale.x, 1.5);
  assert.equal(grid.position.y, -1);
  const geometry = grid.geometry;
  applyEquipmentEnvironment(runtime, { groundMode: "HIDDEN", gridVisible: true, groundSize: 12, gridSpacing: 2 }, "VISIBLE", "dark");
  assert.equal(ground.visible, false);
  assert.equal(grid.visible, true);
  assert.equal(grid.geometry, geometry);
  applyEquipmentEnvironment(runtime, null, "VISIBLE", "light");
  assert.equal(ground.scale.x, 1);
  assert.equal(ground.position.y, -0.015);
  assert.equal(scene.background.getHexString(), "e8eef1");
  ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); grid.material.dispose();
});

test("설비별 최초 카메라를 저장하고 이동·회전된 월드에서 복원한다", () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  camera.position.set(0, 2, 5);
  const controls = { target: new THREE.Vector3(0, 1, 0), update() {}, enableDamping: true };
  const preset = createViewerPreset({ equipmentViews: { EQ: captureViewerCamera(camera, controls), BAD: { position: [NaN, 0, 0] } } });
  const restored = createViewerPreset(JSON.parse(JSON.stringify(preset)));
  assert.equal(restored.equipmentViews.BAD, undefined);
  const root = new THREE.Group(); root.position.set(10, 0, 20); root.rotation.y = Math.PI / 2;
  camera.position.set(99, 99, 99); camera.fov = 45;
  assert.equal(restoreEquipmentCamera(camera, controls, restored.equipmentViews.EQ, root), true);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(15, 2, 20)) < 1e-8);
  assert.deepEqual(controls.target.toArray(), [10, 1, 20]);
  assert.equal(camera.fov, 60);
  assert.equal(restoreEquipmentCamera(camera, controls, { position: [0, 0, 0] }), false);
});

test("조명은 저장 복원되고 잘못된 값은 기본값 또는 범위로 보정한다", () => {
  const preset = createViewerPreset({ lighting: { ambient: 0, key: 4.2, fill: 1.3 } });
  assert.deepEqual(createViewerPreset(JSON.parse(JSON.stringify(preset))).lighting, { ambient: 0, key: 4.2, fill: 1.3 });
  assert.deepEqual(createViewerPreset({ lighting: { ambient: -1, key: 100, fill: NaN } }).lighting, { ambient: 0, key: 6, fill: 0.7 });
  assert.deepEqual(createViewerPreset({ lighting: null }).lighting, { ambient: 2.1, key: 2.4, fill: 0.7 });
});

test("상세 자산이 없으면 모든 모드에서 간략 모델로 폴백한다", () => {
  for (const globalMode of Object.values(EQUIPMENT_GLOBAL_DISPLAY_MODES)) {
    const preset = createViewerPreset({ equipmentRepresentation: { globalMode } });
    assert.equal(resolveEquipmentRepresentation({ preset, equipmentId: "EQ_1", hasDetailedModel: false, selected: true }), EQUIPMENT_REPRESENTATIONS.SIMPLIFIED);
  }
});

test("현실 보기와 자동 최적화가 상세 모델 사용 조건을 구분한다", () => {
  const realistic = createViewerPreset({ equipmentRepresentation: { globalMode: EQUIPMENT_GLOBAL_DISPLAY_MODES.REALISTIC } });
  const automatic = createViewerPreset({ equipmentRepresentation: { globalMode: EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO, autoDetailDistance: 10 } });
  assert.equal(resolveEquipmentRepresentation({ preset: realistic, equipmentId: "EQ_1", hasDetailedModel: true }), EQUIPMENT_REPRESENTATIONS.DETAILED);
  assert.equal(resolveEquipmentRepresentation({ preset: automatic, equipmentId: "EQ_1", hasDetailedModel: true, distance: 20 }), EQUIPMENT_REPRESENTATIONS.SIMPLIFIED);
  assert.equal(resolveEquipmentRepresentation({ preset: automatic, equipmentId: "EQ_1", hasDetailedModel: true, selected: true, distance: 20 }), EQUIPMENT_REPRESENTATIONS.DETAILED);
});

test("설비별 재정의가 전역 모드보다 우선하고 AUTO 삭제는 기본 규칙으로 복귀한다", () => {
  const base = createViewerPreset({ equipmentRepresentation: { globalMode: EQUIPMENT_GLOBAL_DISPLAY_MODES.SIMPLIFIED } });
  const overridden = setEquipmentDisplayOverride(base, "EQ_1", EQUIPMENT_DISPLAY_OVERRIDES.DETAILED);
  assert.equal(resolveEquipmentRepresentation({ preset: overridden, equipmentId: "EQ_1", hasDetailedModel: true }), EQUIPMENT_REPRESENTATIONS.DETAILED);
  const restored = setEquipmentDisplayOverride(overridden, "EQ_1", EQUIPMENT_DISPLAY_OVERRIDES.AUTO);
  assert.equal(resolveEquipmentRepresentation({ preset: restored, equipmentId: "EQ_1", hasDetailedModel: true }), EQUIPMENT_REPRESENTATIONS.SIMPLIFIED);
});
