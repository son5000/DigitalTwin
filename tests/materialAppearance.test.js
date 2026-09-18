import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";
import { MATERIAL_PRESETS, createMaterialAppearance, normalizeMaterialAppearance,
  FLOOR_MATERIAL_PRESET_IDS, WALL_MATERIAL_PRESET_IDS, SPACE_MATERIAL_PRESET_IDS, EQUIPMENT_MATERIAL_PRESET_IDS,
} from "../src/features/digitalTwin/editor/constants/materialPresets.js";

let server, createPresetMaterial, releaseSharedMaterial, createSiteEnvironmentObject, normalizeSiteObject, disposeObject3D;
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  ({ createPresetMaterial, releaseSharedMaterial } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/presetMaterial.js"));
  ({ createSiteEnvironmentObject } = await server.ssrLoadModule("/src/features/digitalTwin/editor/world/SiteEnvironmentFactory.js"));
  ({ normalizeSiteObject } = await server.ssrLoadModule("/src/features/digitalTwin/editor/constants/siteEnvironmentTemplates.js"));
  ({ disposeObject3D } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/disposeObject3D.js"));
});
after(async () => { await server?.close(); });

test("단색은 모든 공통 재질 목록에 있으며 저장된 색과 불투명도를 유지하고 이전 패턴을 제거한다", () => {
  for (const list of [FLOOR_MATERIAL_PRESET_IDS, WALL_MATERIAL_PRESET_IDS, SPACE_MATERIAL_PRESET_IDS, EQUIPMENT_MATERIAL_PRESET_IDS]) assert.ok(list.includes("SOLID_COLOR"));
  for (const color of ["#ffffff", "#000000", "#127bef", "#e82a91"]) {
    const appearance = normalizeMaterialAppearance(JSON.parse(JSON.stringify({
      ...createMaterialAppearance("STEEL"), materialPresetId: "SOLID_COLOR", color, opacity: 0.6, aging: 1,
    })));
    const material = createPresetMaterial(appearance);
    assert.equal(material.color.getHexString(), color.slice(1));
    assert.equal(material.opacity, 0.6);
    assert.equal(material.map, null);
    assert.equal(material.bumpMap, null);
    assert.equal(material.metalness, 0);
    assert.equal(material.transmission, 0);
    releaseSharedMaterial(material);
  }
});

test("흰색 재질의 무늬는 회색 바탕을 곱하지 않고 요철과 금속 반사광은 유지한다", () => {
  for (const preset of MATERIAL_PRESETS) {
    const material = createPresetMaterial(createMaterialAppearance(preset.id, { color: "#ffffff", aging: 0 }));
    assert.equal(material.color.getHexString(), "ffffff", preset.id);
    assert.equal(material.envMap.mapping, THREE.EquirectangularReflectionMapping, preset.id);
    if (material.map) {
      const data = material.map.image.data;
      const mean = data.filter((_, i) => i % 4 === 0).reduce((sum, value) => sum + value, 0) / (data.length / 4);
      assert.ok(mean > 235, `${preset.id}: ${mean}`);
      for (let i = 0; i < data.length; i += 4) assert.equal(data[i], data[i + 2], preset.id);
    }
    if (preset.bumpStrength > 0) assert.ok(material.bumpMap, preset.id);
    assert.equal(material.metalness, preset.metalness, preset.id);
    releaseSharedMaterial(material);
  }
});

test("단색과 패턴 재질의 캐시는 분리되며 흰색 보정이 유리 투명도와 노후화를 지우지 않는다", () => {
  const solid = createPresetMaterial({ material: "SOLID_COLOR", color: "#ffffff" });
  const painted = createPresetMaterial({ material: "PAINT", color: "#ffffff" });
  const glass = createPresetMaterial({ material: "GLASS", color: "#ffffff" });
  const dirty = createPresetMaterial({ material: "CONCRETE", color: "#ffffff", aging: 1 });
  assert.notEqual(solid, painted);
  assert.equal(solid.map, null);
  assert.ok(painted.map);
  assert.equal(glass.opacity, 0.34);
  assert.equal(glass.transmission, 0.72);
  assert.ok(dirty.map.image.data.some((value, index) => index % 4 === 0 && value < 210));
  [solid, painted, glass, dirty].forEach(releaseSharedMaterial);
});

test("공간구성 오브젝트의 단색은 저장 복원 후에도 렌더 재질에 적용된다", () => {
  const object = normalizeSiteObject({ id: "solid-box", type: "GENERIC_BOX", appearance: { material: "SOLID_COLOR", color: "#ffffff" } });
  const restored = normalizeSiteObject(JSON.parse(JSON.stringify(object)));
  const group = createSiteEnvironmentObject(restored, { selected: false, theme: "light", edgeColor: 0x333333, selectionColor: 0xff7900 });
  let body;
  group.traverse((child) => { if (child.isMesh) body = child; });
  assert.ok(body);
  assert.equal(body.material.color.getHexString(), "ffffff");
  assert.equal(body.material.map, null);
  assert.equal(body.material.metalness, 0);
  disposeObject3D(group);
});
