import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBuildingMetrics,
  footprintArea,
  getFloorBaseElevation,
} from "../src/features/customAssets/building/buildingMetrics.js";
import {
  BUILDING_FOOTPRINT_TEMPLATES,
  createBuildingFootprint,
  resizeBuildingFootprint,
} from "../src/features/customAssets/building/buildingTemplates.js";
import { createComplexTowerCustomBuilding, createDefaultCustomBuilding } from "../src/features/customAssets/building/buildingDefaults.js";
import { validateCustomBuilding } from "../src/features/customAssets/building/buildingValidator.js";
import { customBuildingAssetToLibraryDefinition } from "../src/features/customAssets/core/customAssetRegistry.js";
import { migrateCustomAsset } from "../src/features/customAssets/core/customAssetMigrations.js";
import {
  BUILDING_ENTITY_TYPES,
  createBuildingMassEntity,
  resolveConnectorPath,
} from "../src/features/customAssets/building/buildingAssembly.js";

function section(startFloor, endFloor, floorHeight, footprint) {
  return { startFloor, endFloor, floorHeight, footprint, offset: { x: 0, z: 0 }, rotation: 0 };
}

test("커스텀 건축물은 요구된 평면 템플릿을 모두 제공한다", () => {
  const ids = new Set(BUILDING_FOOTPRINT_TEMPLATES.map((template) => template.id));
  ["RECTANGLE", "L_SHAPED", "U_SHAPED", "T_SHAPED", "CROSS", "COURTYARD", "STEPPED", "PODIUM_TOWER", "FREE_POLYGON"]
    .forEach((id) => assert.ok(ids.has(id), id));
});

test("평면 리사이즈 후 실제 면적과 외곽 크기가 일치한다", () => {
  const footprint = resizeBuildingFootprint(createBuildingFootprint("L_SHAPED", 24, 16), 30, 20);
  const xs = footprint.points.map(({ x }) => x);
  const zs = footprint.points.map(({ z }) => z);
  assert.equal(Math.max(...xs) - Math.min(...xs), 30);
  assert.equal(Math.max(...zs) - Math.min(...zs), 20);
  assert.ok(footprintArea(footprint) > 0);
});

test("층 구간별 층고를 사용해 높이와 연면적을 다시 계산한다", () => {
  const asset = {
    sections: [
      section(1, 2, 4, createBuildingFootprint("RECTANGLE", 20, 10)),
      section(3, 5, 3, createBuildingFootprint("RECTANGLE", 10, 8)),
    ],
  };
  const result = calculateBuildingMetrics(asset);
  assert.equal(result.metrics.floorCount, 5);
  assert.equal(result.metrics.totalFloorAreaM2, 640);
  assert.equal(result.bounds.height, 17);
  assert.equal(getFloorBaseElevation(asset, 3), 8);
});

test("중정 Hole은 건축 면적에서 제외된다", () => {
  const footprint = createBuildingFootprint("COURTYARD", 30, 20);
  assert.ok(footprintArea(footprint) < 30 * 20);
  assert.ok(Math.abs(footprintArea(footprint) - 494.16) < 0.001);
});

test("동일 높이의 복수 매스는 허용하고 층 정의 자체의 중복은 차단한다", () => {
  const asset = createDefaultCustomBuilding();
  assert.deepEqual(validateCustomBuilding(asset), []);
  asset.entities.push(createBuildingMassEntity({ name: "별동", footprint: createBuildingFootprint("RECTANGLE", 10, 8), topElevation: asset.bounds.height, position: { x: 30, y: 0, z: 0 } }));
  assert.equal(validateCustomBuilding(asset).filter((item) => item.severity !== "warning").length, 0);
  asset.levels[1].baseElevation = asset.levels[0].baseElevation;
  assert.ok(validateCustomBuilding(asset).some((error) => error.message.includes("중복")));
});

test("저장 자산은 기존 오브젝트 카탈로그용 정의로 변환된다", () => {
  const asset = { ...createDefaultCustomBuilding("L_SHAPED"), status: "ready", revision: 4 };
  const definition = customBuildingAssetToLibraryDefinition(asset);
  assert.equal(definition.createsBuilding, true);
  assert.equal(definition.customAssetId, asset.id);
  assert.equal(definition.customAssetRevision, 4);
  assert.equal(definition.width, asset.bounds.width);
  assert.equal(definition.parameters.floorCount, asset.metrics.floorCount);
});

test("기존 sections 기반 건축물은 단일 매스 BuildingAssembly로 변환된다", () => {
  const legacy = createDefaultCustomBuilding();
  delete legacy.entities;
  delete legacy.levels;
  delete legacy.viewGroups;
  delete legacy.relations;
  legacy.schemaVersion = 1;
  const migrated = migrateCustomAsset(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.entities.filter((item) => item.entityType === BUILDING_ENTITY_TYPES.MASS).length, legacy.sections.length);
  assert.equal(migrated.viewGroups.filter((item) => item.type === "whole").length, 1);
  assert.equal(migrated.id, legacy.id);
});

test("복합 연결 타워 샘플은 두 동, 연결 통로, 상부 공용 매스를 가진다", () => {
  const asset = createComplexTowerCustomBuilding();
  const masses = asset.entities.filter((item) => item.entityType === BUILDING_ENTITY_TYPES.MASS);
  const connectors = asset.entities.filter((item) => item.entityType === BUILDING_ENTITY_TYPES.CONNECTOR);
  assert.equal(asset.name, "복합 연결 타워");
  assert.equal(asset.levels.length, 20);
  assert.equal(masses.length, 3);
  assert.equal(connectors.length, 1);
  assert.ok(asset.viewGroups.some((group) => group.name === "A동만"));
  assert.ok(asset.viewGroups.some((group) => group.name === "11층 이상 공용 공간"));
  assert.deepEqual(validateCustomBuilding(asset).filter((item) => item.severity !== "warning"), []);
});

test("매스 이동 시 연결 통로 끝점과 길이가 자동 갱신된다", () => {
  const asset = createComplexTowerCustomBuilding();
  const connector = asset.entities.find((item) => item.entityType === BUILDING_ENTITY_TYPES.CONNECTOR);
  const b = asset.entities.find((item) => item.name === "B동");
  const before = resolveConnectorPath(asset, connector);
  b.transform.position.x += 8;
  const after = resolveConnectorPath(asset, connector);
  assert.notEqual(after.at(-1).x, before.at(-1).x);
  assert.ok(Math.abs(after.at(-1).x - after[0].x) > Math.abs(before.at(-1).x - before[0].x));
});

test("하나의 물리 요소는 여러 관측 그룹에 동시에 포함될 수 있다", () => {
  const asset = createComplexTowerCustomBuilding();
  const connector = asset.entities.find((item) => item.entityType === BUILDING_ENTITY_TYPES.CONNECTOR);
  const memberships = asset.viewGroups.filter((group) => group.entityIds.includes(connector.id));
  assert.ok(memberships.length >= 5);
  assert.equal(connector.viewGroupIds.length, memberships.length);
});
