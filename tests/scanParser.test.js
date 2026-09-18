import test from "node:test";
import assert from "node:assert/strict";
import { parseScan } from "../src/features/digitalTwin/editor/three/scanParser.worker.js";
import { restoreScanGeometry } from "../src/features/digitalTwin/editor/three/scanWorkerClient.js";

const buffer = (text) => new TextEncoder().encode(text).buffer;
test("OBJ 파싱은 재질 그룹과 UV를 보존하고 전송 가능한 버퍼를 반환한다", () => {
  const result = parseScan("OBJ", buffer("v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nusemtl paint\nf 1/1 2/2 3/3\n"));
  assert.equal(result.geometries[0].materials[0].name, "paint");
  const geometry = restoreScanGeometry(result.geometries[0]);
  assert.equal(geometry.attributes.position.count, 3);
  assert.equal(geometry.attributes.uv.count, 3);
  assert.equal(geometry.boundingBox.max.x, 1);
  assert.ok(result.transfers.includes(geometry.attributes.position.array.buffer));
  geometry.dispose();
});

test("PLY 메시 법선은 Worker에서 생성하고 점군은 Points로 유지한다", () => {
  const header = "ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\n";
  const vertices = "0 0 0\n1 0 0\n0 1 0\n";
  const mesh = parseScan("PLY", buffer(header + "element face 1\nproperty list uchar int vertex_indices\nend_header\n" + vertices + "3 0 1 2\n")).geometries[0];
  assert.equal(mesh.kind, "Mesh");
  assert.equal(mesh.attributes.normal.array.length, 9);
  const points = parseScan("PLY", buffer(header + "end_header\n" + vertices)).geometries[0];
  assert.equal(points.kind, "Points");
});

test("빈 OBJ는 기존 형상으로 복구할 수 있는 오류를 반환한다", () => {
  assert.throws(() => parseScan("OBJ", buffer("")), /EMPTY_MODEL/);
});
