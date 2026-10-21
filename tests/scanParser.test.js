import test from "node:test";
import assert from "node:assert/strict";
import { parseScan, parseScanSource } from "../src/features/digitalTwin/editor/three/scanParser.worker.js";
import { restoreScanGeometry } from "../src/features/digitalTwin/editor/three/scanWorkerClient.js";
import { parseObjStream } from "../src/features/digitalTwin/editor/three/scanObjStream.js";

const buffer = (text) => new TextEncoder().encode(text).buffer;
test("업로드 Blob은 임시 URL fetch 없이 OBJ·PLY를 해석한다", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("업로드 파일에 네트워크 요청이 발생했습니다."); });
  const obj = new Blob(["v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n"]);
  const ply = new Blob(["ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n1 2 3\n"]);
  assert.equal((await parseScanSource({ type: "OBJ", blob: obj })).geometries[0].kind, "Mesh");
  const point = (await parseScanSource({ type: "PLY", blob: ply })).geometries[0];
  assert.equal(point.kind, "Points");
  assert.deepEqual([...point.attributes.position.array], [1, 2, 3]);
});
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

test("분할 OBJ 읽기는 음수 인덱스·UV·법선·재질·다각형을 유지한다", async () => {
  const text = "o panel\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nvn 0 0 1\nusemtl paint\ns off\nf -4/1/1 -3/2/1 -2/3/1 -1/4/1\nusemtl trim\ns 1\nf 1/1 2/2 3/3\n";
  const old = parseScan("OBJ", buffer(text)).geometries[0];
  const streamed = parseScan("OBJ", null, await parseObjStream(new Blob([text]))).geometries[0];
  for (const key of ["position", "uv", "normal"]) assert.deepEqual(streamed.attributes[key].array, old.attributes[key].array);
  assert.deepEqual(streamed.groups, old.groups);
  assert.deepEqual(streamed.materials.map(({ name, flatShading }) => ({ name, flatShading })), old.materials.map(({ name, flatShading }) => ({ name, flatShading })));
  assert.deepEqual(streamed.box, old.box);
});

test("OBJ 청크 경계·CRLF·연속 행과 정점 색상을 보존한다", async () => {
  const text = "o 색상\r\nv 0 0 0 1 0 0\r\nv 1 0 0 0 1 0\r\nv 0 1 0 0 0 1\r\nf 1 2 \\\r\n3\r\n";
  const bytes = new TextEncoder().encode(text);
  const source = { stream: () => new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }) };
  const [result] = await parseObjStream(source);
  assert.equal(result.geometry.attributes.position.count, 3);
  assert.deepEqual([...result.geometry.attributes.color.array], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual([...result.geometry.attributes.normal.array], [0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.equal(await parseObjStream(new Blob(["v 0 0 0\np 1\n"])), null);
  await assert.rejects(parseObjStream(new Blob(["v 0 0 0\nf 1 2 3\n"])), /정점 참조/);
});
