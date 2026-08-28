import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { WORLD_STRUCTURE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { normalizeEquipmentInstance } from "@/features/digitalTwin/editor/utils/templateParameters";
import { createWorldStructureObject } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import { makePlacementPreviewTransparent } from "./placementPreview";

function createStructurePreview(templateId, theme) {
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[templateId];
  if (!definition || templateId === "FLOOR_REGION") return null;
  const structure = {
    id: "FLOOR_PLACEMENT_PREVIEW",
    type: templateId,
    structureType: templateId,
    name: definition.nameKo,
    variant: definition.variants?.[0] ?? "DEFAULT",
    parameters: { ...definition.defaultParameters },
    appearance: { ...definition.defaultAppearance },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    locked: false,
  };
  const preview = createWorldStructureObject(structure, { selected: true, theme, sceneTheme: SCENE_THEMES[theme] });
  preview.userData.placementElevation = definition.defaultPositionY ?? 0;
  return preview;
}

function createEquipmentPreview(templateId, theme) {
  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[templateId];
  if (!template) return null;
  const equipment = normalizeEquipmentInstance({
    id: "EQUIPMENT_PLACEMENT_PREVIEW",
    name: template.nameKo,
    shapeTemplateId: template.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    locked: true,
  }, template);
  const preview = createEquipmentObject(equipment, { selected: true, theme, viewerTranslucent: false });
  preview.userData.placementElevation = template.defaultPositionY ?? 0;
  return preview;
}

export function createFloorPlacementPreview(editMode, templateId, theme) {
  const preview = editMode === "EQUIPMENT"
    ? createEquipmentPreview(templateId, theme)
    : createStructurePreview(templateId, theme);
  return preview ? makePlacementPreviewTransparent(preview) : null;
}
