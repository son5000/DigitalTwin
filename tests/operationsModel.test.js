import test from "node:test";
import assert from "node:assert/strict";
import { createOperationsReport, emptyOperations, getOperationsDirectory, ingestNotifications, mergeOperationsAssets, operationsKey, readOperations, reportCsv, saveOperationRecord, updateNotification, updateOperations } from "../src/features/portal/viewer/operationsModel.js";
import { createWorldTree } from "../src/features/portal/viewer/worldTreeModel.js";

const storage = () => { const entries = new Map(); return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }; };
const ticket = { title: "팬 이상음", assetId: "fan-1", status: "접수", priority: "높음", description: "진동 및 소음 점검 요청" };

test("operations remain isolated by project and corrupt or full storage does not discard records", () => {
  const db = storage();
  updateOperations(db, "A", (data) => saveOperationRecord(data, "tickets", ticket, "김담당"));
  assert.equal(readOperations(db, "A").tickets.length, 1);
  assert.equal(readOperations(db, "B").tickets.length, 0);
  const before = db.getItem(operationsKey("A"));
  assert.throws(() => updateOperations({ ...db, setItem: () => { throw new Error("QuotaExceeded"); } }, "A", (data) => ({ ...data, tickets: [] })));
  assert.equal(db.getItem(operationsKey("A")), before);
  db.setItem(operationsKey("B"), "{broken");
  assert.throws(() => updateOperations(db, "B", () => emptyOperations()));
  assert.equal(db.getItem(operationsKey("B")), "{broken");
});

test("ticket completion requires a resolution and keeps actor and transition history", () => {
  let data = saveOperationRecord(emptyOperations(), "tickets", ticket, "접수자", "2026-09-10T00:00:00Z");
  assert.throws(() => saveOperationRecord(data, "tickets", { ...data.tickets[0], status: "완료" }));
  assert.throws(() => saveOperationRecord(data, "tickets", { ...ticket, assetId: "", locationId: "" }));
  data = saveOperationRecord(data, "tickets", { ...data.tickets[0], status: "처리 중", managerId: "staff" }, "담당자");
  data = saveOperationRecord(data, "tickets", { ...data.tickets[0], status: "완료", resolution: "베어링 교체" }, "담당자");
  assert.equal(data.tickets.length, 1);
  assert.equal(data.tickets[0].createdAt, "2026-09-10T00:00:00Z");
  assert.deepEqual(data.tickets[0].history.map((item) => item.action), ["등록", "접수 → 처리 중", "처리 중 → 완료"]);
  assert.equal(data.tickets[0].history[2].note, "베어링 교체");
});

test("acknowledgments survive reload, closing needs a reason, and changed events retain prior history", () => {
  const event = { id: "alarm-1", title: "온도 경고", severity: "warning", message: "온도 80도", time: "2026-09-10T12:00:00Z" };
  let data = ingestNotifications(emptyOperations(), [event]);
  const id = data.notifications[0].id;
  data = updateNotification(data, id, "확인", "운영자");
  assert.equal(ingestNotifications(data, [event]), data);
  assert.throws(() => updateNotification(data, id, "종결", "운영자"));
  data = updateNotification(data, id, "종결", "운영자", "냉각 후 정상 확인");
  data = ingestNotifications(data, [{ ...event, message: "온도 90도" }]);
  assert.equal(data.notifications.length, 2);
  assert.equal(data.notifications[0].status, "종결");
  assert.equal(data.notifications[1].status, "미확인");
  assert.equal(data.notifications[0].history.length, 3);
});

test("directory follows room and floor ownership, not duplicated names, and preserves metadata of removed assets", () => {
  const tree = createWorldTree({ hierarchy: { nodes: [
    { id: "site", type: "SITE", name: "공장" }, { id: "building", type: "BUILDING", parentId: "site", name: "A동" },
    { id: "b1", type: "FLOOR", parentId: "building", name: "B1" }, { id: "room", type: "ROOM", parentId: "b1", name: "기계실" },
  ] }, observationWorkflow: { scopeType: "SITE" }, equipmentByFloorId: { b1: [{ id: "fan", name: "팬", roomId: "room" }] } });
  const directory = getOperationsDirectory(tree);
  assert.equal(directory.assets[0].location, "공장 / A동 / B1 / 기계실");
  const asset = directory.assets[0];
  const merged = mergeOperationsAssets([{ ...asset, location: "변경된 실제 위치" }], [{ ...asset, status: "점검 필요", managerId: "staff" }]);
  assert.equal(merged[0].location, "변경된 실제 위치");
  assert.equal(merged[0].managerId, "staff");
  assert.equal(mergeOperationsAssets([], merged)[0].missing, true);
});

test("contact suspension preserves saved asset and location assignments", () => {
  let data = saveOperationRecord(emptyOperations(), "people", { name: "정비팀", kind: "담당자", targets: ["fan", "b1"] });
  data = saveOperationRecord(data, "people", { ...data.people[0], archived: true });
  data = saveOperationRecord(data, "people", { ...data.people[0], archived: false });
  assert.deepEqual(data.people[0].targets, ["fan", "b1"]);
  assert.equal(data.people[0].archived, false);
  assert.equal(data.people[0].history.length, 3);
});

test("reports include the selected period and freeze records; CSV prevents spreadsheet formulas", () => {
  let data = saveOperationRecord(emptyOperations(), "tickets", ticket, "담당자", "2026-09-10T12:00:00Z");
  data = saveOperationRecord(data, "tickets", { ...ticket, title: "이전 접수" }, "담당자", "2026-08-10T12:00:00Z");
  const report = createOperationsReport(data, [{ id: "fan", name: '=HYPERLINK("bad")', status: "정상" }], { title: "9월 보고서", from: "2026-09-01", to: "2026-09-30", author: "담당자" });
  assert.equal(report.tickets.length, 1);
  data.tickets[0].status = "완료";
  assert.equal(report.tickets[0].status, "접수");
  assert.ok(reportCsv(report).includes("\"'=HYPERLINK"));
  assert.throws(() => createOperationsReport(data, [], { title: "역전 기간", from: "2026-09-30", to: "2026-09-01" }));
});
