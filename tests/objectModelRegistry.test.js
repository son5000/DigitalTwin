import assert from "node:assert/strict";
import test from "node:test";

import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_SHAPE_TEMPLATES,
} from "../src/features/digitalTwin/editor/constants/equipmentShapeTemplates.js";
import {
  LEGACY_OBJECT_MODEL_ALIASES,
  resolveObjectModelId,
} from "../src/features/digitalTwin/editor/constants/objectModelRegistry.js";
import {
  WORLD_STRUCTURE_TEMPLATES,
} from "../src/features/digitalTwin/editor/constants/worldStructureTemplates.js";

const visibleStructures = WORLD_STRUCTURE_TEMPLATES.filter((template) => !template.legacyOnly && template.id !== "CUSTOM_STRUCTURE");
const visibleEquipment = EQUIPMENT_SHAPE_TEMPLATES.filter((template) => !template.legacyOnly);

test("모든 신규 배치 모델은 데이터 기반 레지스트리 메타데이터를 가진다", () => {
  [...visibleStructures, ...visibleEquipment].forEach((model) => {
    assert.equal(model.modelId, model.id);
    assert.ok(model.objectType);
    assert.ok(model.objectTypeLabel);
    assert.ok(model.description);
    assert.ok(model.placement);
    assert.ok(model.modelSource.startsWith("procedural:"));
    assert.ok(model.thumbnailSource.startsWith("/assets/object-thumbnails/"));
    assert.ok(!model.thumbnailSource.startsWith("procedural:"));
    assert.ok(model.lod.mediumDistance > 0);
    assert.ok(Array.isArray(model.materialSlots));
  });
});

test("고빈도 가구 유형은 각각 다섯 개 이상의 실질 모델을 제공한다", () => {
  ["DESK", "CHAIR", "TABLE", "SOFA", "STORAGE"].forEach((familyId) => {
    const models = visibleStructures.filter((template) => template.objectType === familyId);
    assert.ok(models.length >= 5, `${familyId}: ${models.length}`);
    assert.equal(new Set(models.map((model) => model.subtype)).size, models.length);
  });
});

test("공개 설비 카테고리는 세 개 이상의 모델을 가지며 원시 도형은 숨긴다", () => {
  EQUIPMENT_CATEGORIES.filter((category) => !["ALL", "BASIC", "CUSTOM"].includes(category.id)).forEach((category) => {
    assert.ok(visibleEquipment.filter((model) => model.category === category.id).length >= 3, category.id);
  });
  assert.equal(visibleEquipment.some((model) => ["BASIC", "CUSTOM"].includes(model.category)), false);
});

test("기존 가구 ID는 신규 기본 모델로 연결된다", () => {
  Object.entries(LEGACY_OBJECT_MODEL_ALIASES).forEach(([legacyId, modelId]) => {
    assert.equal(resolveObjectModelId(legacyId), modelId);
    assert.ok(WORLD_STRUCTURE_TEMPLATES.some((template) => template.id === modelId));
  });
});
