import * as THREE from "three";

import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { generateBasicShape } from "@/features/digitalTwin/editor/generators/BasicShapeGenerator";
import { generateCabinet } from "@/features/digitalTwin/editor/generators/CabinetGenerator";
import { generateDuct } from "@/features/digitalTwin/editor/generators/DuctGenerator";
import { generateMechanical } from "@/features/digitalTwin/editor/generators/MechanicalGenerator";
import { generatePipe } from "@/features/digitalTwin/editor/generators/PipeGenerator";
import { generateTank } from "@/features/digitalTwin/editor/generators/TankGenerator";
import { generateSemanticEquipment } from "@/features/digitalTwin/editor/generators/SemanticEquipmentGenerator";

const CATEGORY_GENERATORS = {
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

export function getEquipmentGeometrySignature(
  equipment,
  { selected = false, colliding = false, dimmed = false, theme = "dark", viewerTranslucent = true } = {},
) {
  return [
    equipment.shapeTemplateId,
    equipment.name,
    JSON.stringify(equipment.dimensions),
    JSON.stringify(equipment.parameters),
    JSON.stringify(equipment.appearance),
    JSON.stringify(equipment.appearanceSlots),
    selected,
    colliding,
    dimmed,
    viewerTranslucent,
    theme,
  ].join("|");
}

export function getEquipmentBatchKey(equipment, { theme = "dark", viewerTranslucent = true } = {}) {
  return [
    equipment.shapeTemplateId,
    JSON.stringify(equipment.dimensions),
    JSON.stringify(equipment.parameters),
    JSON.stringify(equipment.appearance),
    JSON.stringify(equipment.appearanceSlots),
    viewerTranslucent,
    theme,
  ].join("|");
}

export function createEquipmentObject(
  equipment,
  { selected = false, colliding = false, dimmed = false, theme = "dark", viewerTranslucent = true, enableLod = true } = {},
) {
  const sceneTheme = SCENE_THEMES[theme];
  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[equipment.shapeTemplateId];
  const edgeColor = selected
    ? sceneTheme.selection
    : colliding
      ? sceneTheme.collision
      : sceneTheme.equipmentEdge;
  const generator = CATEGORY_GENERATORS[template?.category] ?? generateBasicShape;
  const sourceAppearance = viewerTranslucent
    ? equipment.appearance
    : { ...equipment.appearance, opacity: 1 };
  const appearance = dimmed
    ? { ...sourceAppearance, opacity: Math.max(0.08, (sourceAppearance.opacity ?? 1) * 0.5) }
    : sourceAppearance;
  const visual = generator({
    type: equipment.shapeTemplateId,
    dimensions: equipment.dimensions,
    parameters: equipment.parameters,
    appearance,
    appearanceSlots: equipment.appearanceSlots,
    label: equipment.name,
    edgeColor,
    sceneTheme,
    showEdges: appearance.showEdges || selected || colliding,
  });

  const equipmentGroup = new THREE.Group();
  equipmentGroup.name = equipment.name;
  equipmentGroup.visible = equipment.visible;
  equipmentGroup.userData.equipmentId = equipment.id;
  equipmentGroup.userData.domain = "EQUIPMENT";
  equipmentGroup.userData.geometrySignature = getEquipmentGeometrySignature(
    equipment,
    { selected, colliding, dimmed, theme, viewerTranslucent },
  );
  if (template?.lod && !selected && enableLod) {
    const lod = new THREE.LOD();
    const lowMaterial = new THREE.MeshStandardMaterial({
      color: appearance.color,
      roughness: appearance.roughness ?? 0.6,
      metalness: appearance.metalness ?? 0.1,
      transparent: (appearance.opacity ?? 1) < 1,
      opacity: appearance.opacity ?? 1,
    });
    const lowProxy = new THREE.Mesh(
      new THREE.BoxGeometry(equipment.dimensions.width, equipment.dimensions.height, equipment.dimensions.depth),
      lowMaterial,
    );
    lowProxy.position.y = equipment.dimensions.height / 2;
    lowProxy.castShadow = true;
    lowProxy.receiveShadow = true;
    lod.addLevel(visual, 0);
    lod.addLevel(lowProxy, template.lod.mediumDistance);
    equipmentGroup.add(lod);
  } else {
    equipmentGroup.add(visual);
  }
  equipmentGroup.position.set(equipment.position.x, equipment.position.y, equipment.position.z);
  equipmentGroup.rotation.set(equipment.rotation.x, equipment.rotation.y, equipment.rotation.z);
  return equipmentGroup;
}
