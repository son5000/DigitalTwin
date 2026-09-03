import * as THREE from "three";

import { OBJECT_LIBRARY_DEFINITIONS } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import { WORLD_STRUCTURE_TEMPLATES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { createSiteObjectFromArea } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { normalizeEquipmentInstance } from "@/features/digitalTwin/editor/utils/templateParameters";
import { createBuildingObject } from "@/features/digitalTwin/editor/world/BuildingFactory";
import { createSiteEnvironmentObject } from "@/features/digitalTwin/editor/world/SiteEnvironmentFactory";
import { createWorldStructureObject } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

const SIZE = 512;
const BACKGROUND = 0xe8edf1;
const definitionMap = new Map();
OBJECT_LIBRARY_DEFINITIONS.forEach((definition) => definitionMap.set(definition.id, { definition, domain: "SITE" }));
WORLD_STRUCTURE_TEMPLATES.forEach((definition) => definitionMap.set(definition.id, { definition, domain: "STRUCTURE" }));
Object.entries(UNIFIED_EQUIPMENT_TEMPLATE_MAP).forEach(([id, definition]) => definitionMap.set(id, { definition, domain: "EQUIPMENT" }));

function createBuilding(definition) {
  const floorCount = Math.max(1, Number(definition.parameters?.floorCount) || 1);
  const floorHeight = Math.max(2.4, Number(definition.parameters?.floorHeight) || 3.6);
  const building = {
    id: `THUMBNAIL_${definition.id}`,
    name: definition.nameKo ?? definition.name,
    templateId: definition.id,
    profile: definition.profile,
    parameters: {
      width: definition.width,
      depth: definition.depth,
      floorCount,
      floorHeight,
      stairCount: definition.parameters?.stairCount ?? 1,
      roofType: definition.parameters?.roofType ?? definition.defaultVariants?.roofStyle ?? "FLAT",
    },
    variants: definition.defaultVariants ?? {},
    appearance: { materialPreset: definition.material === "METAL" ? "PAINTED_METAL" : "CONCRETE", color: definition.color, opacity: 1, showEdges: true },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    showNameLabel: false,
    visible: true,
  };
  const floors = Array.from({ length: floorCount }, (_, index) => ({ id: `${building.id}_F${index + 1}`, parentId: building.id, level: index + 1 }));
  return createBuildingObject(building, floors, {
    selected: false,
    expanded: false,
    theme: "light",
    viewerTranslucent: false,
    selectionColor: "#3984A8",
    floorColor: "#CCD5D9",
    edgeColor: "#394B53",
  });
}

function createStructure(definition) {
  return createWorldStructureObject({
    id: `THUMBNAIL_${definition.id}`,
    type: definition.id,
    structureType: definition.id,
    name: definition.nameKo,
    variant: definition.variants?.[0] ?? "DEFAULT",
    parameters: { ...definition.defaultParameters },
    appearance: { ...definition.defaultAppearance },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    locked: false,
  }, { selected: false, theme: "light", sceneTheme: SCENE_THEMES.light });
}

function createEquipment(definition) {
  const equipment = normalizeEquipmentInstance({
    id: `THUMBNAIL_${definition.id}`,
    name: definition.nameKo,
    shapeTemplateId: definition.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    locked: false,
  }, definition);
  return createEquipmentObject(equipment, { selected: false, theme: "light", viewerTranslucent: false, enableLod: false });
}

function createSiteObject(definition) {
  if (definition.createsBuilding) return createBuilding(definition);
  const object = createSiteObjectFromArea(definition.id, {
    center: { x: 0, z: 0 },
    width: definition.width,
    depth: definition.depth,
  }, 1, { modelTemplateId: definition.id });
  return createSiteEnvironmentObject(object, {
    selected: false,
    theme: "light",
    selectionColor: "#3984A8",
    edgeColor: "#394B53",
  });
}

function createVisual(id) {
  const entry = definitionMap.get(id);
  if (!entry) throw new Error(`알 수 없는 templateId: ${id}`);
  if (entry.domain === "EQUIPMENT") return createEquipment(entry.definition);
  if (entry.domain === "STRUCTURE") return createStructure(entry.definition);
  return createSiteObject(entry.definition);
}

function frameObject(camera, object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(1, 1, 1));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.5);
  const distance = radius * 2.15;
  camera.position.set(center.x + distance * 0.86, center.y + distance * 0.68, center.z + distance * 0.96);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 20;
  camera.lookAt(center.x, center.y + size.y * 0.04, center.z);
  camera.updateProjectionMatrix();
  return box.min.y;
}

async function renderThumbnail(id) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(1);
  renderer.setClearColor(BACKGROUND, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.body.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7780, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(8, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xaed8ee, 1.1);
  fill.position.set(-8, 6, -5);
  scene.add(fill);

  const visual = createVisual(id);
  visual.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  scene.add(visual);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
  const groundY = frameObject(camera, visual);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0xd6dde1, roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY - 0.015;
  ground.receiveShadow = true;
  scene.add(ground);
  renderer.render(scene, camera);
  await new Promise((resolve) => requestAnimationFrame(() => { renderer.render(scene, camera); resolve(); }));
  const blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, "image/png"));
  scene.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose?.();
    });
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return blob;
}

async function generateAll(domain = null) {
  const ids = [...definitionMap.entries()]
    .filter(([, entry]) => !domain || entry.domain === domain)
    .map(([id]) => id)
    .sort();
  const failures = [];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    document.title = `썸네일 ${index + 1}/${ids.length} · ${id}`;
    try {
      const blob = await renderThumbnail(id);
      const response = await fetch("http://127.0.0.1:4179/thumbnail", { method: "POST", headers: { "x-template-id": id }, body: blob });
      if (!response.ok) throw new Error(await response.text());
    } catch (error) {
      failures.push({ id, message: error.message });
    }
  }
  await fetch("http://127.0.0.1:4179/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: ids.length, failures, ids }) });
  window.__thumbnailStatus = { count: ids.length, failures, complete: true };
  document.title = `완료 · ${ids.length - failures.length}/${ids.length}`;
}

window.__thumbnailIds = [...definitionMap.keys()].sort();
const params = new URLSearchParams(location.search);
if (params.get("generate") === "all") generateAll(params.get("domain")?.toUpperCase() || null);
else renderThumbnail(params.get("id") ?? window.__thumbnailIds[0]);
