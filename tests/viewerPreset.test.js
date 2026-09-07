import assert from "node:assert/strict";
import test from "node:test";

import {
  createViewerPreset,
  EQUIPMENT_DISPLAY_OVERRIDES,
  EQUIPMENT_GLOBAL_DISPLAY_MODES,
  EQUIPMENT_REPRESENTATIONS,
  resolveEquipmentRepresentation,
  setEquipmentDisplayOverride,
} from "../src/features/digitalTwin/editor/model/viewerPreset.js";

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
