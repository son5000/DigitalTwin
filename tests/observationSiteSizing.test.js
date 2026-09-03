import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateObservationSiteSize,
  canAutoResizeObservationSite,
  OBSERVATION_SITE_SIZE_MODES,
} from "../src/features/digitalTwin/editor/model/observationSiteSizing.js";
import { readFile } from "node:fs/promises";

const siteSettingsSource = await readFile(new URL("../src/features/digitalTwin/editor/constants/siteEnvironmentSettings.js", import.meta.url), "utf8");

function building(overrides = {}) {
  return {
    id: "BUILDING_1",
    parameters: { width: 20, depth: 10 },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

test("건축물 바닥 크기에 15% 또는 최소 4m 여백을 더한다", () => {
  const result = calculateObservationSiteSize(building());
  assert.deepEqual(result.footprint, { width: 20, depth: 10 });
  assert.equal(result.margin, 4);
  assert.equal(result.width, 28);
  assert.equal(result.depth, 20);
});

test("회전과 원점 이탈을 포함해 건축물이 부지 안에 들어오도록 계산한다", () => {
  const rotated = calculateObservationSiteSize(building({ rotation: { x: 0, y: Math.PI / 2, z: 0 } }));
  assert.ok(Math.abs(rotated.footprint.width - 10) < 1e-9);
  assert.ok(Math.abs(rotated.footprint.depth - 20) < 1e-9);
  assert.equal(rotated.width, 20);
  assert.equal(rotated.depth, 28);

  const moved = calculateObservationSiteSize(building({ position: { x: 6, y: 0, z: 0 } }));
  assert.equal(moved.width, 40);
});

test("자동 생성 부지만 대상 건축물 변경을 따라가고 사용자 수정 부지는 보호한다", () => {
  assert.equal(canAutoResizeObservationSite({
    sizeMode: OBSERVATION_SITE_SIZE_MODES.AUTO_BUILDING,
    autoFitBuildingId: "BUILDING_1",
  }, "BUILDING_1"), true);
  assert.equal(canAutoResizeObservationSite({
    sizeMode: OBSERVATION_SITE_SIZE_MODES.CUSTOM,
    autoFitBuildingId: null,
  }, "BUILDING_1"), false);
});

test("기존 기본 크기는 자동 부지로 전환 가능하고 비기본 크기는 사용자 수정으로 보호한다", () => {
  assert.match(siteSettingsSource, /matchesLegacyDefault/);
  assert.match(siteSettingsSource, /hasStoredSize && !matchesLegacyDefault/);
  assert.match(siteSettingsSource, /OBSERVATION_SITE_SIZE_MODES\.CUSTOM/);
});
