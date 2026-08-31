import { CUSTOM_ASSET_SCHEMA_VERSION, CUSTOM_ASSET_STATUS, CUSTOM_ASSET_TYPES, createCustomAssetId } from "../core/customAssetTypes.js";
import { createComplexTowerAssembly } from "./buildingAssembly.js";
import { createBuildingFootprint } from "./buildingTemplates.js";
import { recalculateBuildingAsset } from "./buildingMetrics.js";
import { CUSTOM_BUILDING_AUTHORING_MODES, createDefaultBlockGrid, deriveBlockBuildingAsset } from "./blockBuildingModel.js";

function createSection({ startFloor, endFloor, width, depth, templateId, offset = { x: 0, z: 0 }, color = "#87979D" }) {
  return {
    id: `section-${crypto.randomUUID()}`,
    startFloor,
    endFloor,
    floorHeight: 3.6,
    footprint: createBuildingFootprint(templateId, width, depth),
    offset,
    rotation: 0,
    materialId: "facade-default",
    color,
  };
}

export function createDefaultCustomBuilding(templateId = "BLOCK") {
  const timestamp = new Date().toISOString();
  const sections = templateId === "BLOCK"
    ? []
    : templateId === "PODIUM_TOWER"
    ? [
      createSection({ startFloor: 1, endFloor: 4, width: 30, depth: 22, templateId: "RECTANGLE" }),
      createSection({ startFloor: 5, endFloor: 10, width: 18, depth: 16, templateId: "RECTANGLE", offset: { x: 2, z: 0 }, color: "#6F8793" }),
    ]
    : templateId === "STEPPED"
      ? [
        createSection({ startFloor: 1, endFloor: 4, width: 28, depth: 20, templateId: "STEPPED" }),
        createSection({ startFloor: 5, endFloor: 8, width: 20, depth: 15, templateId: "RECTANGLE", offset: { x: -2, z: -1 } }),
      ]
      : [createSection({ startFloor: 1, endFloor: 5, width: 24, depth: 16, templateId })];
  const building = {
    id: createCustomAssetId(),
    type: CUSTOM_ASSET_TYPES.BUILDING,
    schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION,
    revision: 1,
    name: "새 커스텀 건축물",
    description: "",
    tags: [],
    category: "업무시설",
    status: CUSTOM_ASSET_STATUS.DRAFT,
    thumbnail: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    unit: "m",
    floorHeight: 3.6,
    sections,
    materials: [
      { id: "facade-default", name: "기본 외벽", presetId: "CONCRETE", color: "#87979D", roughness: 0.76, metalness: 0.04 },
      { id: "roof-default", name: "기본 지붕", presetId: "PAINTED_METAL", color: "#5F7078", roughness: 0.56, metalness: 0.34 },
    ],
    bounds: { width: 0, depth: 0, height: 0 },
    metrics: { totalFloorAreaM2: 0, totalFloorAreaPyeong: 0, buildingAreaM2: 0, floorCount: 0 },
    authoringMode: templateId === "BLOCK" ? CUSTOM_BUILDING_AUTHORING_MODES.BLOCK : CUSTOM_BUILDING_AUTHORING_MODES.OUTLINE,
    ...(templateId === "BLOCK" ? { blockGrid: createDefaultBlockGrid() } : {}),
  };
  return recalculateBuildingAsset(templateId === "BLOCK" ? deriveBlockBuildingAsset(building) : building);
}

export function createComplexTowerCustomBuilding() {
  return recalculateBuildingAsset(createComplexTowerAssembly(createDefaultCustomBuilding("RECTANGLE")));
}
