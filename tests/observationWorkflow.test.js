import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/features/digitalTwin/editor/model/observationWorkflow.js", import.meta.url), "utf8");
const scopeStyles = await readFile(new URL("../src/features/digitalTwin/editor/components/ObservationScopeSelector.module.css", import.meta.url), "utf8");

test("관측 유형별 단계와 뷰어 모드 계약을 유지한다", () => {
  for (const scopeType of ["SITE", "BUILDING", "SINGLE_EQUIPMENT", "MULTI_EQUIPMENT", "CUSTOM"]) {
    assert.match(source, new RegExp(`${scopeType}: \\"${scopeType}\\"`));
  }
  assert.match(source, /SINGLE_EQUIPMENT_FOCUS/);
  assert.match(source, /MULTI_EQUIPMENT_OVERVIEW/);
  assert.match(source, /steps: \[WORLD_WIZARD_STEP_IDS\.MONITORING\]/);
  assert.match(source, /title: "건물 중심 관측"/);
  assert.match(source, /title: "단일 설비 관측"/);
  assert.match(source, /title: "다중 설비 관측"/);
});

test("공간 단계를 생략한 범위만 안정적인 내부 호스트를 사용한다", () => {
  assert.match(source, /OBSERVATION_HOST_BUILDING/);
  assert.match(source, /OBSERVATION_HOST_FLOOR_1/);
  assert.match(source, /SINGLE_EQUIPMENT, OBSERVATION_SCOPE_TYPES\.MULTI_EQUIPMENT/);
  assert.match(source, /!activeStepIds\.includes\(WORLD_WIZARD_STEP_IDS\.COMPOSITION\)/);
  assert.doesNotMatch(source, /\[OBSERVATION_SCOPE_TYPES\.BUILDING, OBSERVATION_SCOPE_TYPES\.SINGLE_EQUIPMENT/);
});

test("기존 프로젝트 마이그레이션과 비삭제 범위 확장 함수를 제공한다", () => {
  assert.match(source, /legacyLayout \? createObservationWorkflow\(OBSERVATION_SCOPE_TYPES\.SITE\)/);
  assert.match(source, /expandObservationWorkflow/);
  assert.match(source, /\.\.\.\(current\?\.activeStepIds \?\? \[\]\)/);
});

test("설비 상세 재진입 시 저장된 활성 설비와 첫 유효 설비를 복원한다", () => {
  assert.match(source, /resolveObservationEquipmentId/);
  assert.match(source, /viewerSettings\?\.activeEquipmentId/);
  assert.match(source, /equipment\[0\]\?\.id \?\? null/);
});

test("관측 범위 카드 설명은 한국어 어절 단위로 안전하게 줄바꿈한다", () => {
  assert.match(scopeStyles, /word-break:\s*keep-all/);
  assert.match(scopeStyles, /overflow-wrap:\s*break-word/);
  assert.match(scopeStyles, /max-width:\s*100%/);
});
