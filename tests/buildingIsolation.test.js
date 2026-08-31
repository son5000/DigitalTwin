import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBuildingIsolationVisibility,
  captureBuildingIsolationVisibility,
  restoreBuildingIsolationVisibility,
} from "../src/features/digitalTwin/editor/three/buildingIsolation.js";

function createRuntime() {
  return {
    buildingObjects: new Map([
      ["BUILDING_A", { visible: true }],
      ["BUILDING_B", { visible: false }],
      ["BUILDING_C", { visible: true }],
    ]),
    siteEnvironmentObjects: new Map([
      ["ROAD_A", { visible: true }],
      ["EQUIPMENT_A", { visible: false }],
    ]),
    siteConnectionRoot: { visible: false },
    ground: { visible: true },
    grid: { visible: false },
    gridRegionRoot: { visible: true },
  };
}

test("선택 건축물 격리는 주변 요소를 숨기고 기존 표시 상태를 정확히 복원한다", () => {
  const runtime = createRuntime();
  const state = captureBuildingIsolationVisibility(runtime);

  applyBuildingIsolationVisibility(runtime, state, "BUILDING_C");

  assert.equal(runtime.buildingObjects.get("BUILDING_A").visible, false);
  assert.equal(runtime.buildingObjects.get("BUILDING_B").visible, false);
  assert.equal(runtime.buildingObjects.get("BUILDING_C").visible, true);
  assert.ok([...runtime.siteEnvironmentObjects.values()].every((object) => !object.visible));
  assert.equal(runtime.siteConnectionRoot.visible, false);
  assert.equal(runtime.ground.visible, false);
  assert.equal(runtime.grid.visible, false);
  assert.equal(runtime.gridRegionRoot.visible, false);

  restoreBuildingIsolationVisibility(runtime, state);

  assert.equal(runtime.buildingObjects.get("BUILDING_A").visible, true);
  assert.equal(runtime.buildingObjects.get("BUILDING_B").visible, false);
  assert.equal(runtime.buildingObjects.get("BUILDING_C").visible, true);
  assert.equal(runtime.siteEnvironmentObjects.get("ROAD_A").visible, true);
  assert.equal(runtime.siteEnvironmentObjects.get("EQUIPMENT_A").visible, false);
  assert.equal(runtime.siteConnectionRoot.visible, false);
  assert.equal(runtime.ground.visible, true);
  assert.equal(runtime.grid.visible, false);
  assert.equal(runtime.gridRegionRoot.visible, true);
});

test("격리 중 선택 변경과 새 오브젝트 추가를 새 기준으로 갱신한다", () => {
  const runtime = createRuntime();
  const state = captureBuildingIsolationVisibility(runtime);
  applyBuildingIsolationVisibility(runtime, state, "BUILDING_A");

  runtime.buildingObjects.set("BUILDING_D", { visible: true });
  runtime.siteEnvironmentObjects.set("ROAD_B", { visible: true });
  applyBuildingIsolationVisibility(runtime, state, "BUILDING_D");

  assert.equal(runtime.buildingObjects.get("BUILDING_A").visible, false);
  assert.equal(runtime.buildingObjects.get("BUILDING_D").visible, true);
  assert.equal(runtime.siteEnvironmentObjects.get("ROAD_B").visible, false);

  restoreBuildingIsolationVisibility(runtime, state);
  assert.equal(runtime.buildingObjects.get("BUILDING_D").visible, true);
  assert.equal(runtime.siteEnvironmentObjects.get("ROAD_B").visible, true);
});
