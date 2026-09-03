import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { describeEquipmentAssetFiles } from "../src/features/digitalTwin/editor/model/equipmentAssetFiles.js";

const source = await readFile(new URL("../src/features/digitalTwin/editor/model/equipmentAssetFiles.js", import.meta.url), "utf8");

test("설비 로컬 자산은 OBJ PLY MTL과 안전한 이미지 형식을 구분한다", () => {
  assert.match(source, /OBJ.*PLY.*MTL.*JPG.*JPEG.*PNG.*WEBP/);
  assert.match(source, /PRIMARY_EXTENSIONS/);
  assert.match(source, /POINT_CLOUD/);
});

test("설비 파일 레코드는 Blob을 레이아웃이 아닌 별도 저장소에 보관한다", () => {
  assert.match(source, /EQUIPMENT_ASSET_/);
  assert.match(source, /blob: file/);
  assert.match(source, /primaryFileName/);
});

function file(name, path = name) {
  return { name, webkitRelativePath: path, type: "application/octet-stream", size: 1 };
}

test("이미지를 먼저 선택해도 OBJ와 PLY를 3D 주 파일로 우선한다", () => {
  assert.equal(describeEquipmentAssetFiles([file("scan.jpg"), file("scan.obj")]).primary.name, "scan.obj");
  assert.equal(describeEquipmentAssetFiles([file("scan.jpg"), file("scan.ply")]).primary.name, "scan.ply");
});

test("OBJ 단독과 PLY 단독을 표시 가능한 자산으로 분류한다", () => {
  assert.equal(describeEquipmentAssetFiles([file("machine.obj")]).assetType, "OBJ");
  assert.equal(describeEquipmentAssetFiles([file("cloud.ply")]).assetType, "PLY");
});

test("OBJ MTL JPG와 PLY JPG의 보조 파일을 이름 기준으로 연결한다", () => {
  const obj = describeEquipmentAssetFiles([file("other.jpg"), file("pump.jpg"), file("pump.mtl"), file("pump.obj")]);
  const ply = describeEquipmentAssetFiles([file("tank.jpg"), file("tank.ply")]);

  assert.equal(obj.relatedMaterial.name, "pump.mtl");
  assert.equal(obj.relatedTexture.name, "pump.jpg");
  assert.equal(ply.relatedTexture.name, "tank.jpg");
});
