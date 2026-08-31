import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const thumbnailDirectory = path.resolve("public/assets/object-thumbnails");
const manifestPath = path.join(thumbnailDirectory, "manifest.json");

async function readPngSize(filePath) {
  const buffer = await readFile(filePath);
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("카탈로그의 모든 실제 모델 썸네일은 512px PNG로 생성된다", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = new Set(await readdir(thumbnailDirectory));

  assert.equal(manifest.count, manifest.ids.length);
  assert.equal(new Set(manifest.ids).size, manifest.ids.length);
  assert.equal(manifest.width, 512);
  assert.equal(manifest.height, 512);

  for (const id of manifest.ids) {
    const fileName = `${id}.png`;
    assert.ok(files.has(fileName), `${fileName} 누락`);
    assert.deepEqual(await readPngSize(path.join(thumbnailDirectory, fileName)), {
      width: 512,
      height: 512,
    });
  }

  assert.ok(files.has("_fallback.png"));
  assert.deepEqual(await readPngSize(path.join(thumbnailDirectory, "_fallback.png")), {
    width: 512,
    height: 512,
  });
});

test("공용 카탈로그 UI는 안전한 thumbnailSource만 img에 전달한다", async () => {
  const thumbnailComponent = await readFile(
    path.resolve("src/features/digitalTwin/editor/components/CatalogThumbnail.jsx"),
    "utf8",
  );
  const sharedConsumers = await Promise.all([
    "src/features/digitalTwin/editor/components/ObjectLibrary/ObjectPreview.jsx",
    "src/features/digitalTwin/editor/components/ObjectModelThumbnail.jsx",
    "src/features/digitalTwin/editor/components/FloorWorkspaceCatalog.jsx",
    "src/features/digitalTwin/editor/components/EquipmentLibrary.jsx",
  ].map((filePath) => readFile(path.resolve(filePath), "utf8")));

  assert.match(thumbnailComponent, /definition\?\.thumbnailSource/);
  assert.match(thumbnailComponent, /source\.startsWith\("\/assets\/object-thumbnails\/"\)/);
  assert.match(thumbnailComponent, /!source\.startsWith\("procedural:"\)/);
  assert.ok(sharedConsumers.every((source) => source.includes("ObjectModelThumbnail") || source.includes("CatalogThumbnail")));
  assert.ok(sharedConsumers.every((source) => !/<img[^>]+procedural:/s.test(source)));
});
