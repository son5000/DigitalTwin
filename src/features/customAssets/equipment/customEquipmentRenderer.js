import * as THREE from "three";

import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import { generateBasicShape } from "@/features/digitalTwin/editor/generators/BasicShapeGenerator";
import { generateCabinet } from "@/features/digitalTwin/editor/generators/CabinetGenerator";
import { generateDuct } from "@/features/digitalTwin/editor/generators/DuctGenerator";
import { generateMechanical } from "@/features/digitalTwin/editor/generators/MechanicalGenerator";
import { generateTank } from "@/features/digitalTwin/editor/generators/TankGenerator";
import { generateSemanticEquipment } from "@/features/digitalTwin/editor/generators/SemanticEquipmentGenerator";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { generatePipe } from "@/features/digitalTwin/editor/generators/PipeGenerator";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";
import { getCustomEquipmentPartDimensions, getPartWorldPort } from "./customEquipmentModel.js";

const PART_GENERATORS = {
  BASIC: generateBasicShape,
  CABINET: generateCabinet,
  MECHANICAL: generateMechanical,
  PIPE: generatePipe,
  DUCT: generateDuct,
  TANK: generateTank,
  SAFETY: generateSemanticEquipment,
  SENSOR: generateSemanticEquipment,
  UTILITY: generateSemanticEquipment,
  CUSTOM: generateBasicShape,
};

function createCross(part, edgeColor, selected) {
  const { width, depth } = getCustomEquipmentPartDimensions(part.type, part.parameters, part.dimensions);
  const radius = part.parameters.diameter / 2;
  const material = createPresetMaterial({ ...part.appearance, emissive: selected ? edgeColor : 0x000000, emissiveIntensity: selected ? 0.18 : 0 });
  const group = new THREE.Group();
  [[width, 0], [depth, Math.PI / 2]].forEach(([length, rotationY]) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 20);
    geometry.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material.clone()); mesh.rotation.y = rotationY; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  });
  return group;
}

function createPartVisual(part, { selected, edgeColor }) {
  if (part.type === "PIPE_CROSS") return createCross(part, edgeColor, selected);
  const template = UNIFIED_EQUIPMENT_TEMPLATE_MAP[part.templateId];
  const dimensions = getCustomEquipmentPartDimensions(part.type, part.parameters, part.dimensions);
  const generator = part.partKind === "PIPE"
    ? generatePipe
    : PART_GENERATORS[template?.generatorKey ?? template?.floorCategory ?? template?.category] ?? generateBasicShape;
  return generator({
    type: part.templateId,
    profile: template?.profile,
    dimensions,
    parameters: part.parameters,
    appearance: part.appearance,
    appearanceSlots: part.appearanceSlots,
    edgeColor,
    sceneTheme: SCENE_THEMES.dark,
    label: null,
    showEdges: selected,
  });
}

function addPortMarkers(root, asset, selectedPartId, selectedPortId, edgeColor) {
  asset.parts.forEach((part) => part.ports.forEach((port) => {
    const worldPort = getPartWorldPort(part, port.id); const selected = part.id === selectedPartId && port.id === selectedPortId;
    const material = new THREE.MeshBasicMaterial({ color: selected ? 0x38bdf8 : port.connectedTo ? 0x2563eb : 0x7dd3fc, transparent: true, opacity: port.connectedTo ? 0.55 : 0.95, depthTest: false });
    const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.055, port.diameter * 0.32), 12, 8), material);
    marker.position.copy(worldPort.position); marker.renderOrder = 20; marker.userData = { customEquipmentPartId: part.id, customEquipmentPortId: port.id, portMarker: true }; root.add(marker);
    if (selected) {
      const arrow = new THREE.ArrowHelper(worldPort.direction, worldPort.position, Math.max(0.35, port.diameter * 2), edgeColor, 0.12, 0.07); arrow.userData = { customEquipmentPartId: part.id, customEquipmentPortId: port.id, portMarker: true }; root.add(arrow);
    }
  }));
}

export function createCustomEquipmentGroup(asset, {
  selectedPartId = null, selectedPartIds = [], selectedPortId = null, showPorts = false, exposeParts = false,
  edgeColor = SCENE_THEMES.dark.equipmentEdge, selectionColor = SCENE_THEMES.dark.selection,
  opacity = 1, previewPartId = null, scale = { x: 1, y: 1, z: 1 }, equipmentId = null,
} = {}) {
  const root = new THREE.Group(); root.name = asset.name; root.userData = { customAssetId: asset.id, equipmentId, customEquipment: true };
  const selectedIds = new Set(selectedPartIds);
  asset.parts.forEach((part) => {
    const holder = new THREE.Group(); const selected = selectedPartId === part.id || selectedIds.has(part.id);
    holder.name = part.name; holder.position.set(part.position.x - (asset.origin?.x ?? 0), part.position.y - (asset.origin?.y ?? 0), part.position.z - (asset.origin?.z ?? 0)); holder.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
    holder.userData = exposeParts ? { customEquipmentPartId: part.id } : { equipmentId, customAssetId: asset.id };
    const visual = createPartVisual(part, { selected, edgeColor: selected ? selectionColor : edgeColor });
    visual.traverse((object) => { object.userData = { ...object.userData, ...holder.userData }; const partOpacity = part.id === previewPartId ? 0.38 : opacity; if (object.material && partOpacity < 1) { const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => { material.transparent = true; material.opacity *= partOpacity; material.depthWrite = partOpacity >= 1; }); } });
    holder.add(visual); root.add(holder);
  });
  if (showPorts) {
    const markerRoot = new THREE.Group(); markerRoot.position.set(-(asset.origin?.x ?? 0), -(asset.origin?.y ?? 0), -(asset.origin?.z ?? 0)); addPortMarkers(markerRoot, asset, selectedPartId, selectedPortId, selectionColor); root.add(markerRoot);
  }
  const assetTransform = asset.transform ?? {}; root.position.set(assetTransform.position?.x ?? 0, assetTransform.position?.y ?? 0, assetTransform.position?.z ?? 0); root.rotation.set(assetTransform.rotation?.x ?? 0, assetTransform.rotation?.y ?? 0, assetTransform.rotation?.z ?? 0);
  root.scale.set((scale.x ?? 1) * (assetTransform.scale?.x ?? 1), (scale.y ?? 1) * (assetTransform.scale?.y ?? 1), (scale.z ?? 1) * (assetTransform.scale?.z ?? 1)); return root;
}
