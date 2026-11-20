import test from "node:test";
import assert from "node:assert/strict";
import { selectProjectList } from "../src/features/portal/projects/projectListView.js";

const local = (id, name, savedAt, extra = {}) => ({ id, layout: { name, savedAt }, ...extra });
const remote = (projectId, name, updatedAt, extra = {}) => ({ projectId, name, updatedAt, ...extra });
const keys = (list) => list.items.map((item) => item.key);

test("local and server cards share newest-first order without duplicate linked projects or source mutation", () => {
  const locals = [local("old", "이전", "2026-11-01"), local("new", "최신", "2026-11-19", { serverProjectId: "linked" })];
  const servers = [remote("linked", "서버 사본", "2026-11-20"), remote("middle", "중간", "2026-11-10"), remote("external", "외부 사본", "2026-11-20", { externalProjectId: "old" })];
  const before = structuredClone({ locals, servers });
  const list = selectProjectList(locals, servers);
  assert.equal(list.total, 3);
  assert.deepEqual(keys(list), ["local:new", "server:middle", "local:old"]);
  assert.deepEqual({ locals, servers }, before);
  assert.deepEqual(keys(selectProjectList(locals, servers, { sort: "updated-asc" })), ["local:old", "server:middle", "local:new"]);
});

test("name search trims input, ignores case, uses legacy display names and preserves total count", () => {
  const locals = [local("pump", "Pump 10", "2026-11-19"), { id: "legacy", layout: { hierarchy: { nodes: [{ type: "SITE", name: "한글 현장" }] } } }];
  const servers = [remote("pump2", "PUMP 2", "2026-11-18")];
  const list = selectProjectList(locals, servers, { query: "  pump  ", sort: "name-asc" });
  assert.equal(list.total, 3);
  assert.deepEqual(keys(list), ["server:pump2", "local:pump"]);
  assert.deepEqual(keys(selectProjectList(locals, servers, { query: "pump", sort: "name-desc" })), ["local:pump", "server:pump2"]);
  assert.deepEqual(keys(selectProjectList(locals, servers, { query: "한글".normalize("NFD") })), ["local:legacy"]);
  assert.equal(selectProjectList(locals, servers, { query: "없는 이름" }).items.length, 0);
  assert.equal(selectProjectList(locals, servers, { query: " " }).items.length, 3);
});

test("missing dates sort last and equal timestamps use stable name order", () => {
  const locals = [local("missing", "A", undefined), local("b", "B", "2026-11-19T09:00:00+09:00")];
  const servers = [remote("invalid", "D", "invalid"), remote("c", "C", "2026-11-19T00:00:00Z")];
  for (const sort of ["updated-desc", "updated-asc"]) {
    assert.deepEqual(keys(selectProjectList(locals, servers, { sort })), ["local:b", "server:c", "local:missing", "server:invalid"]);
  }
});
