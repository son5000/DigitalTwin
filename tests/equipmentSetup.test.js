import assert from "node:assert/strict";
import test from "node:test";
import { EQUIPMENT_SETUP_STEPS, getEquipmentSetup, updateEquipmentSetup, getSensorReadingState, getSetupStepIssue, getEquipmentSetupSaveSummary } from "../src/features/digitalTwin/editor/model/equipmentSetup.js";
import { createViewerPreset, resolveEquipmentRepresentation } from "../src/features/digitalTwin/editor/model/viewerPreset.js";

test("설비별 단계는 저장 후 복원하며 완료와 건너뜀을 구분한다", () => {
  let equipment = { id: "A", metadata: {} };
  equipment.metadata.detailSetup = updateEquipmentSetup(equipment, "BASIC", "DONE");
  equipment.metadata.detailSetup = updateEquipmentSetup(equipment, "ASSET", "SKIPPED");
  const restored = getEquipmentSetup(JSON.parse(JSON.stringify(equipment)));
  assert.equal(restored.currentStep, "SENSOR");
  assert.equal(restored.completed, 1);
  assert.equal(restored.skipped, 1);
  assert.equal(getEquipmentSetup({ id: "B" }).completed, 0);
  equipment.metadata.detailSetup = updateEquipmentSetup(equipment, "BASIC", "PENDING");
  assert.equal(getEquipmentSetup(equipment).completed, 0);
  assert.equal(getEquipmentSetup(equipment).currentStep, "BASIC");
});

test("거리별 모델 옵션은 전역 모드 및 선택 여부와 독립적이며 자산 누락 시 복구한다", () => {
  const preset = createViewerPreset({ equipmentRepresentation: { globalMode: "REALISTIC", autoDetailDistance: 10, overrides: { A: "DISTANCE" } } });
  const input = { preset, equipmentId: "A", hasDetailedModel: true, selected: true };
  assert.equal(resolveEquipmentRepresentation({ ...input, distance: 11 }), "SIMPLIFIED");
  assert.equal(resolveEquipmentRepresentation({ ...input, distance: 10 }), "DETAILED");
  assert.equal(resolveEquipmentRepresentation({ ...input, distance: 0, hasDetailedModel: false }), "SIMPLIFIED");
});

test("센서 수신 없음은 정상으로 오인하지 않고 경계값에서 경보를 표시한다", () => {
  const point = { metric: "TEMPERATURE", warningRange: { min: 60 }, dangerRange: { min: 80 } };
  assert.equal(getSensorReadingState(point, undefined).level, "EMPTY");
  assert.equal(getSensorReadingState(point, "").level, "EMPTY");
  assert.equal(getSensorReadingState(point, 0).level, "NORMAL");
  assert.equal(getSensorReadingState(point, 60).level, "WARNING");
  assert.deepEqual(getSensorReadingState(point, 80), { level: "DANGER", icon: "🔥", label: "위험" });
});

test("센서 미연결이나 역전된 임계치는 완료 처리 전에 안내한다", () => {
  const point = { sensorIds: ["S1"], normalRange: { max: 60 }, warningRange: { max: 80 }, dangerRange: { max: 120 } };
  const values = { points: [point], sensors: [{ id: "S1" }] };
  assert.equal(getSetupStepIssue("POINT", values), "");
  assert.match(getSetupStepIssue("POINT", { ...values, sensors: [] }), /센서/);
  assert.match(getSetupStepIssue("POINT", { ...values, points: [{ ...point, normalRange: { max: 100 } }] }), /임계치/);
  assert.match(getSetupStepIssue("ASSET", {}), /건너뛰세요/);
});

test("저장 확인은 선택 설비 외의 미완료·건너뜀 단계도 집계한다", () => {
  const complete = Object.fromEntries(EQUIPMENT_SETUP_STEPS.map(({ id }) => [id, "DONE"]));
  const equipment = [
    { id: "selected", metadata: { detailSetup: { steps: complete } } },
    { id: "other-floor" },
    { id: "outdoor", metadata: { detailSetup: { steps: { ...complete, ASSET: "SKIPPED" } } } },
  ];
  assert.deepEqual(getEquipmentSetupSaveSummary(equipment), { equipmentCount: 2, pendingCount: 5, skippedCount: 1 });
  assert.deepEqual(getEquipmentSetupSaveSummary([equipment[0]]), { equipmentCount: 0, pendingCount: 0, skippedCount: 0 });
  assert.deepEqual(getEquipmentSetupSaveSummary([]), { equipmentCount: 0, pendingCount: 0, skippedCount: 0 });
});
