import test from "node:test";
import assert from "node:assert/strict";

import { isFloorShadowEnabled } from "../src/features/digitalTwin/editor/model/shadowPolicy.js";

test("일반 보기에서는 모든 층의 기존 그림자를 유지한다", () => {
  assert.equal(isFloorShadowEnabled({ shadowEnabled: true, floorDisplayGap: 0, selectedFloorId: "f2", floorId: "f1" }), true);
});

test("층 펼쳐보기에서는 선택 층만 그림자를 생성하고 수신한다", () => {
  assert.equal(isFloorShadowEnabled({ shadowEnabled: true, floorDisplayGap: 2, selectedFloorId: "f2", floorId: "f2" }), true);
  assert.equal(isFloorShadowEnabled({ shadowEnabled: true, floorDisplayGap: 2, selectedFloorId: "f2", floorId: "f1" }), false);
  assert.equal(isFloorShadowEnabled({ shadowEnabled: true, floorDisplayGap: 2, selectedFloorId: null, floorId: "f1" }), false);
});

test("환경설정이 꺼지면 보기 상태와 무관하게 그림자를 비활성화한다", () => {
  assert.equal(isFloorShadowEnabled({ shadowEnabled: false, floorDisplayGap: 0, selectedFloorId: "f1", floorId: "f1" }), false);
});
