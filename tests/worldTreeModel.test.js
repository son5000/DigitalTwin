import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorldTree, getTreeAncestors, getViewerEquipmentContext, toggleTreeNode, worldNodeKey } from "../src/features/portal/viewer/worldTreeModel.js";

test("저장된 층·방 소유권은 기존 건물 직속 설비의 부모를 갱신하고 중복 없이 유지한다", () => {
  const layout = {
    observationWorkflow: { scopeType: "BUILDING" },
    hierarchy: { activeRoomId: "room", nodes: [
      { id: "building", type: "BUILDING" },
      { id: "b1", type: "FLOOR", parentId: "building", level: -1 },
      { id: "f1", type: "FLOOR", parentId: "building", level: 1 },
      { id: "room", type: "ROOM", parentId: "f1" },
      { id: "underground", type: "EQUIPMENT", parentId: "building" },
      { id: "in-room", type: "EQUIPMENT", parentId: "building" },
    ] },
    equipmentByFloorId: {
      b1: [{ id: "underground", floorId: "b1", name: "2층이라는 이름은 무시" }],
      f1: [{ id: "floor-only" }, { id: "missing-room", roomId: "absent", floorId: "f1" }],
    },
    roomScenes: { room: { equipment: [{ id: "in-room" }] } },
    equipment: [{ id: "underground" }, { id: "in-room" }, { id: "parent-only", parentId: "b1" }],
  };
  const saved = structuredClone(layout);
  const tree = createWorldTree(layout);
  const node = (type, id) => tree.nodes.get(worldNodeKey(type, id));
  for (const [id, type, parent] of [
    ["underground", "FLOOR", "b1"], ["floor-only", "FLOOR", "f1"],
    ["missing-room", "FLOOR", "f1"], ["in-room", "ROOM", "room"], ["parent-only", "FLOOR", "b1"],
  ]) assert.equal(node("EQUIPMENT", id).parentKey, worldNodeKey(type, parent));
  const visited = [];
  function walk(item) { visited.push(item.key); item.children.forEach(walk); }
  tree.roots.forEach(walk);
  assert.equal(new Set(visited).size, visited.length);
  assert.equal(visited.length, tree.nodes.size);
  assert.deepEqual(getTreeAncestors(tree, worldNodeKey("EQUIPMENT", "in-room")),
    [worldNodeKey("ROOM", "room"), worldNodeKey("FLOOR", "f1"), worldNodeKey("BUILDING", "building")]);
  const expanded = new Set(visited);
  const collapsed = toggleTreeNode(expanded, worldNodeKey("FLOOR", "f1"));
  assert.equal(collapsed.has(worldNodeKey("FLOOR", "f1")), false);
  assert.equal(toggleTreeNode(collapsed, worldNodeKey("FLOOR", "f1")).has(worldNodeKey("FLOOR", "f1")), true);
  assert.deepEqual(layout, saved);
  const context = getViewerEquipmentContext(tree, node("EQUIPMENT", "in-room"));
  assert.equal(context.floor.id, "f1");
  assert.equal(context.building.id, "building");
  assert.equal(context.outdoor, false);
});

test("외부 설비와 구성요소의 상세 대상은 기존 객체 ID로 해석하고 도로는 설비로 취급하지 않는다", () => {
  const tree = createWorldTree({ hierarchy: { nodes: [{ id: "site", type: "SITE" }] },
    siteObjects: [{ id: "outdoor", assetKind: "OUTDOOR_EQUIPMENT", parentId: "site" }, { id: "road", assetKind: "SURFACE", parentId: "site" },
      { id: "tree", assetKind: "VEGETATION", parentId: "site" }],
    equipment: [{ id: "equipment", parts: [{ id: "part" }] }],
  });
  const context = getViewerEquipmentContext(tree, tree.nodes.get(worldNodeKey("SITE_OBJECT", "outdoor")));
  assert.equal(context.outdoor, true);
  assert.equal(context.item.id, "outdoor");
  assert.equal(context.floor, undefined);
  assert.equal(tree.nodes.has(worldNodeKey("SITE_OBJECT", "road")), false);
  assert.equal(tree.nodes.has(worldNodeKey("SITE_OBJECT", "tree")), false);
  assert.deepEqual(tree.siteObjects.map((item) => item.id), ["outdoor", "road", "tree"]);
  assert.equal(getViewerEquipmentContext(tree, tree.nodes.get(worldNodeKey("SITE_OBJECT", "road"))), null);
  assert.equal(getViewerEquipmentContext(tree, tree.nodes.get(worldNodeKey("PART", "part", "equipment"))).item.id, "equipment");
});

test("소속 없는 설비는 미분류로 유지하고 구성요소 key와 단일·다중 설비 루트는 보존한다", () => {
  const equipment = [{ id: "loose", parts: [{ id: "part" }] }];
  const layout = { hierarchy: { nodes: [{ id: "building", type: "BUILDING" }] }, equipment };
  const tree = createWorldTree(layout);
  assert.equal(tree.nodes.get(worldNodeKey("EQUIPMENT", "loose")).parentKey, "viewer:unclassified");
  assert.equal(tree.nodes.get(worldNodeKey("PART", "part", "loose")).parentKey, worldNodeKey("EQUIPMENT", "loose"));
  for (const scopeType of ["SINGLE_EQUIPMENT", "MULTI_EQUIPMENT"]) {
    const scoped = createWorldTree({ ...layout, observationWorkflow: { scopeType } });
    assert.ok(scoped.root);
    assert.ok(scoped.nodes.has(worldNodeKey("EQUIPMENT", "loose")));
  }
});
