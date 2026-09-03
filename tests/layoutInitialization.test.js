import assert from "node:assert/strict";
import test from "node:test";

import { initializeLayout, LAYOUT_INITIALIZATION_STATUS, readLocalLayout } from "../src/features/digitalTwin/editor/model/layoutInitialization.js";

function storageWith(value) { return { getItem: () => value }; }

test("정상 로컬 관측 구성을 복원한다", () => {
  const result = readLocalLayout(storageWith(JSON.stringify({ version: 17, hierarchy: {} })));
  assert.equal(result.status, LAYOUT_INITIALIZATION_STATUS.SUCCESS);
  assert.equal(result.layout.version, 17);
});

test("저장 데이터가 없으면 빈 상태로 종료한다", () => {
  const result = readLocalLayout(storageWith(null));
  assert.equal(result.status, LAYOUT_INITIALIZATION_STATUS.EMPTY);
  assert.equal(result.layout, null);
});

test("손상된 로컬 데이터는 삭제하지 않고 오류 상태로 반환한다", () => {
  let removed = false;
  const result = readLocalLayout({ getItem: () => "{broken", removeItem: () => { removed = true; } });
  assert.equal(result.status, LAYOUT_INITIALIZATION_STATUS.ERROR);
  assert.equal(result.errorCode, "CORRUPT_LOCAL_DATA");
  assert.equal(removed, false);
});

test("서버 미구현과 네트워크 실패는 로컬 구성으로 폴백한다", async () => {
  const result = await initializeLayout({ storage: storageWith(JSON.stringify({ version: 17 })), remoteLoader: () => Promise.reject(new Error("NOT_IMPLEMENTED")) });
  assert.equal(result.status, LAYOUT_INITIALIZATION_STATUS.SUCCESS);
  assert.equal(result.source, "LOCAL");
  assert.equal(result.fallbackReason, "REMOTE_ERROR");
});

test("응답 없는 서버는 제한 시간 후 로컬 모드로 전환한다", async () => {
  const startedAt = Date.now();
  const result = await initializeLayout({ storage: storageWith(JSON.stringify({ version: 17 })), remoteLoader: () => new Promise(() => {}), timeoutMs: 20 });
  assert.equal(result.status, LAYOUT_INITIALIZATION_STATUS.SUCCESS);
  assert.equal(result.fallbackReason, "REMOTE_TIMEOUT");
  assert.ok(Date.now() - startedAt < 500);
});