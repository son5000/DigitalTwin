import * as THREE from "three";

import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { generateBasicShape } from "@/features/digitalTwin/editor/generators/BasicShapeGenerator";
import { generateCabinet } from "@/features/digitalTwin/editor/generators/CabinetGenerator";
import { generateDuct } from "@/features/digitalTwin/editor/generators/DuctGenerator";
import { generateMechanical } from "@/features/digitalTwin/editor/generators/MechanicalGenerator";
import { generatePipe } from "@/features/digitalTwin/editor/generators/PipeGenerator";
import { generateTank } from "@/features/digitalTwin/editor/generators/TankGenerator";

const CATEGORY_GENERATORS = {
  BASIC: generateBasicShape,
  CABINET: generateCabinet,
  MECHANICAL: generateMechanical,
  PIPE: generatePipe,
  DUCT: generateDuct,
  TANK: generateTank,
  SAFETY: generateBasicShape,
  SENSOR: generateBasicShape,
  UTILITY: generateBasicShape,
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
    selected,
    colliding,
    dimmed,
    viewerTranslucent,
    theme,
  ].join("|");
}

export function createEquipmentObject(
  equipment,
  { selected = false, colliding = false, dimmed = false, theme = "dark", viewerTranslucent = true } = {},
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
  equipmentGroup.add(visual);
  equipmentGroup.position.set(equipment.position.x, equipment.position.y, equipment.position.z);
  equipmentGroup.rotation.set(equipment.rotation.x, equipment.rotation.y, equipment.rotation.z);
  return equipmentGroup;
}
