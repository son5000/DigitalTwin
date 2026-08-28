import assert from "node:assert/strict";
import test from "node:test";

import {
  findSitePathMagneticSnap,
  getConnectableSitePathEndpoints,
  resolveSitePathNetwork,
  resolveSitePathJunctions,
  SITE_PATH_JUNCTION_TYPES,
} from "../src/features/digitalTwin/editor/utils/sitePathConnections.js";

function pathObject(id, profile, position, points, width = 4, rotationY = 0) {
  return {
    id,
    profile,
    visible: true,
    position: { x: position.x, y: position.y ?? 0, z: position.z },
    rotation: { x: 0, y: rotationY, z: 0 },
    dimensions: { width: 10, height: 0.08, depth: width },
    path: { width, points },
    appearance: { color: "#4e565b", material: "ASPHALT" },
    parameters: {},
  };
}

test("서로 다른 도로의 맞닿은 끝점은 하나의 직선 연결부가 된다", () => {
  const objects = [
    pathObject("A", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]),
    pathObject("B", "ROAD", { x: 10, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]),
  ];
  const junctions = resolveSitePathJunctions(objects);

  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].straight, true);
  assert.deepEqual(junctions[0].center, { x: 5, y: 0.08, z: 0 });
  assert.deepEqual(new Set(junctions[0].endpoints.map((endpoint) => endpoint.objectId)), new Set(["A", "B"]));
});

test("도로와 인도는 같은 위치에서도 서로 자동 결합하지 않는다", () => {
  const objects = [
    pathObject("ROAD", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]),
    pathObject("WALK", "WALKWAY", { x: 10, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 2.4),
  ];

  assert.equal(resolveSitePathJunctions(objects).length, 0);
});

test("회전된 인도의 끝점도 월드 좌표로 변환되어 연결된다", () => {
  const objects = [
    pathObject("A", "WALKWAY", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 2.4),
    pathObject("B", "WALKWAY", { x: 5, z: -5 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 2.4, Math.PI / 2),
  ];
  const junctions = resolveSitePathJunctions(objects);

  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].straight, false);
});

test("세 갈래 도로 끝점은 하나의 T자 연결부로 클러스터링된다", () => {
  const objects = [
    pathObject("LEFT", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]),
    pathObject("RIGHT", "ROAD", { x: 10, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]),
    pathObject("BOTTOM", "ROAD", { x: 5, z: -5 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 4, Math.PI / 2),
  ];
  const junctions = resolveSitePathJunctions(objects);

  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].straight, false);
  assert.equal(junctions[0].endpoints.length, 3);
});

test("연결 가능한 경로는 각 오브젝트의 양 끝점만 노출한다", () => {
  const endpoints = getConnectableSitePathEndpoints([
    pathObject("A", "ROAD", { x: 2, z: 3 }, [{ x: -4, z: 0 }, { x: 0, z: 2 }, { x: 4, z: 0 }]),
  ]);

  assert.equal(endpoints.length, 2);
  assert.deepEqual(endpoints.map((endpoint) => endpoint.endpointIndex), [0, 2]);
});

test("회전한 도로의 가까운 끝점은 기존 도로 끝점으로 자석 스냅된다", () => {
  const fixed = pathObject("FIXED", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]);
  const rotating = pathObject(
    "ROTATING",
    "ROAD",
    { x: 5.6, z: -5.4 },
    [{ x: -5, z: 0 }, { x: 5, z: 0 }],
    4,
    Math.PI / 2,
  );

  const snap = findSitePathMagneticSnap(rotating, [fixed, rotating]);

  assert.ok(snap);
  assert.equal(snap.profile, "ROAD");
  assert.ok(Math.abs(snap.offset.x + 0.6) < 1e-9);
  assert.ok(Math.abs(snap.offset.z - 0.4) < 1e-9);
  assert.equal(snap.targetEndpoint.objectId, "FIXED");
});

test("같은 방향으로 겹치는 도로 끝점은 의도치 않게 자석 스냅되지 않는다", () => {
  const fixed = pathObject("FIXED", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]);
  const overlapping = pathObject("OVERLAP", "ROAD", { x: 0.3, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]);

  assert.equal(findSitePathMagneticSnap(overlapping, [fixed, overlapping]), null);
});

test("회전한 도로 끝점은 기존 도로의 중간에도 T자 형태로 자석 스냅된다", () => {
  const fixed = pathObject("FIXED", "ROAD", { x: 0, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }]);
  const branch = pathObject(
    "BRANCH",
    "ROAD",
    { x: 0.7, z: -5.6 },
    [{ x: -5, z: 0 }, { x: 5, z: 0 }],
    4,
    Math.PI / 2,
  );

  const snap = findSitePathMagneticSnap(branch, [fixed, branch]);

  assert.ok(snap);
  assert.equal(snap.targetSegment.objectId, "FIXED");
  assert.ok(Math.abs(snap.offset.x) < 1e-9);
  assert.ok(Math.abs(snap.offset.z - 0.6) < 1e-9);
});

test("도로 끝점이 다른 도로의 중간에 닿으면 T자 연결부가 생성된다", () => {
  const fixed = pathObject("FIXED", "ROAD", { x: 0, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }]);
  const branch = pathObject(
    "BRANCH",
    "ROAD",
    { x: 0, z: -5 },
    [{ x: -5, z: 0 }, { x: 5, z: 0 }],
    4,
    Math.PI / 2,
  );

  const junctions = resolveSitePathJunctions([fixed, branch]);

  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].straight, false);
  assert.equal(junctions[0].endpoints.length, 3);
  assert.deepEqual(junctions[0].center, { x: 0, y: 0.08, z: 0 });
});

test("서로 다른 폭의 직선 도로 연결부는 원이 아닌 폭 전이 폴리곤을 만든다", () => {
  const network = resolveSitePathNetwork([
    pathObject("WIDE", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 7),
    pathObject("NARROW", "ROAD", { x: 10, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 4),
  ]);

  assert.equal(network.junctions[0].type, SITE_PATH_JUNCTION_TYPES.STRAIGHT);
  assert.equal(network.junctions[0].polygon.length, 4);
  assert.equal(network.junctions[0].width, 7);
});

test("90도와 임의 각도 끝점 연결을 각각 L자와 곡선으로 판정한다", () => {
  const horizontal = pathObject("BASE", "ROAD", { x: 0, z: 0 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }]);
  const rightAngle = pathObject("RIGHT", "ROAD", { x: 5, z: -5 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 4, Math.PI / 2);
  const angled = pathObject("ANGLE", "ROAD", { x: 9.330127, z: -2.5 }, [{ x: -5, z: 0 }, { x: 5, z: 0 }], 4, Math.PI / 6);

  const lJunction = resolveSitePathJunctions([horizontal, rightAngle])[0];
  const curvedJunction = resolveSitePathJunctions([horizontal, angled])[0];
  assert.equal(lJunction.type, SITE_PATH_JUNCTION_TYPES.L_CORNER);
  assert.ok(lJunction.polygon.length > 4);
  assert.equal(curvedJunction.type, SITE_PATH_JUNCTION_TYPES.CURVE);
});

test("두 도로의 중간 교차는 십자 교차로와 양쪽 차선 제거 범위를 만든다", () => {
  const horizontal = pathObject("H", "ROAD", { x: 0, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }], 6);
  const vertical = pathObject("V", "ROAD", { x: 0, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }], 4, Math.PI / 2);
  const network = resolveSitePathNetwork([horizontal, vertical]);

  assert.equal(network.junctions.length, 1);
  assert.equal(network.junctions[0].type, SITE_PATH_JUNCTION_TYPES.CROSS);
  assert.equal(network.junctions[0].objectIds.length, 2);
  assert.equal(network.renderContextsByObjectId.H.segmentTrims[0][0].type, SITE_PATH_JUNCTION_TYPES.CROSS);
  assert.equal(network.renderContextsByObjectId.V.segmentTrims[0][0].type, SITE_PATH_JUNCTION_TYPES.CROSS);
  assert.ok(network.nodes.some((node) => node.type === SITE_PATH_JUNCTION_TYPES.CROSS));
});

test("표면 높이가 다른 동일 종류 도로는 교차해도 자동 연결하지 않는다", () => {
  const ground = pathObject("GROUND", "ROAD", { x: 0, y: 0, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }]);
  const bridge = pathObject("BRIDGE", "ROAD", { x: 0, y: 1.2, z: 0 }, [{ x: -10, z: 0 }, { x: 10, z: 0 }], 4, Math.PI / 2);

  assert.equal(resolveSitePathJunctions([ground, bridge]).length, 0);
});

test("같은 방향으로 평행하게 겹친 도로는 연결 노드를 만들지 않는다", () => {
  const left = pathObject("LEFT", "ROAD", { x: 0, z: 0 }, [{ x: -6, z: 0 }, { x: 6, z: 0 }]);
  const right = pathObject("RIGHT", "ROAD", { x: 0.4, z: 0 }, [{ x: -6, z: 0 }, { x: 6, z: 0 }]);

  assert.equal(resolveSitePathJunctions([left, right]).length, 0);
});
