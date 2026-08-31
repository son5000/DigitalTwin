import assert from "node:assert/strict";
import test from "node:test";

import {
  createUserTextureBinding,
  normalizeUserTexture,
  supportsUserTextureFile,
} from "../src/features/digitalTwin/editor/model/userTexture.js";

test("사용자 텍스처 설정은 안정적인 ID와 안전한 기본값만 저장한다", () => {
  const binding = createUserTextureBinding("TEXTURE_1", "ROOF");
  assert.equal(binding.textureAssetId, "TEXTURE_1");
  assert.equal(binding.target, "ROOF");
  assert.deepEqual(binding.repeat, { x: 1, y: 1 });
  assert.equal("blob" in binding, false);
  assert.equal("objectUrl" in binding, false);
});

test("잘못된 텍스처 숫자와 래핑 값은 정규화한다", () => {
  const binding = normalizeUserTexture({
    textureAssetId: "TEXTURE_2",
    repeat: { x: 0, y: "2" },
    offset: { x: "bad", y: 0.25 },
    scale: -3,
    wrap: "INVALID",
  });
  assert.deepEqual(binding.repeat, { x: 0.01, y: 2 });
  assert.deepEqual(binding.offset, { x: 0, y: 0.25 });
  assert.equal(binding.scale, 0.01);
  assert.equal(binding.wrap, "REPEAT");
});

test("안전한 래스터 이미지 형식만 허용한다", () => {
  assert.equal(supportsUserTextureFile({ type: "image/jpeg" }), true);
  assert.equal(supportsUserTextureFile({ type: "image/png" }), true);
  assert.equal(supportsUserTextureFile({ type: "image/webp" }), true);
  assert.equal(supportsUserTextureFile({ type: "image/svg+xml" }), false);
});
