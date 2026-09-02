import assert from "node:assert/strict";
import test from "node:test";

import {
  createObservationWorkflow,
  ensureObservationHostHierarchy,
  expandObservationWorkflow,
  normalizeObservationWorkflow,
  OBSERVATION_HOST_IDS,
  OBSERVATION_SCOPE_TYPES,
  OBSERVATION_VIEWER_MODES,
} from "../src/features/digitalTwin/editor/model/observationWorkflow.js";
import { createDefaultHierarchy } from "../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js";
import { WORLD_WIZARD_STEP_IDS } from "../src/features/digitalTwin/editor/constants/worldWizard.js";

test("관측 유형마다 필요한 단계와 뷰어 모드만 제공한다", () => {
  const single = createObservationWorkflow(OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT);
  assert.deepEqual(single.activeStepIds, [WORLD_WIZARD_STEP_IDS.MONITORING]);
  assert.equal(single.viewerSettings.mode, OBSERVATION_VIEWER_MODES.SINGLE_EQUIPMENT);

  const multiple = createObservationWorkflow(OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT);
  assert.deepEqual(multiple.activeStepIds, [WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT, WORLD_WIZARD_STEP_IDS.MONITORING]);
});

test("생략된 단계의 내부 건물과 층은 안정적인 ID로 한 번만 생성한다", () => {
  const first = ensureObservationHostHierarchy(createDefaultHierarchy(), OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT);
  assert.equal(first.buildingId, OBSERVATION_HOST_IDS.BUILDING);
  assert.equal(first.floorId, OBSERVATION_HOST_IDS.FLOOR);
  assert.equal(first.hierarchy.nodes.filter((node) => node.id === OBSERVATION_HOST_IDS.BUILDING).length, 1);

  const second = ensureObservationHostHierarchy(first.hierarchy, OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT);
  assert.equal(second.hierarchy.nodes.length, first.hierarchy.nodes.length);
  assert.equal(second.created, false);
});

test("기존 프로젝트는 전체 공간 워크플로로 마이그레이션한다", () => {
  const migrated = normalizeObservationWorkflow(undefined, { legacyLayout: true });
  assert.equal(migrated.configured, true);
  assert.equal(migrated.scopeType, OBSERVATION_SCOPE_TYPES.SITE);
  assert.deepEqual(migrated.activeStepIds, [
    WORLD_WIZARD_STEP_IDS.COMPOSITION,
    WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT,
    WORLD_WIZARD_STEP_IDS.MONITORING,
  ]);
});

test("관측 범위 확장은 기존 단계를 삭제하지 않는다", () => {
  const single = createObservationWorkflow(OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT, {
    viewerSettings: { equipmentIds: ["EQ_1"], activeEquipmentId: "EQ_1" },
  });
  const expanded = expandObservationWorkflow(single, OBSERVATION_SCOPE_TYPES.BUILDING);
  assert.deepEqual(expanded.activeStepIds, [
    WORLD_WIZARD_STEP_IDS.COMPOSITION,
    WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT,
    WORLD_WIZARD_STEP_IDS.MONITORING,
  ]);
});
