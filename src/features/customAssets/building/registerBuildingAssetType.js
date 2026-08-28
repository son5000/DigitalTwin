import { registerCustomAssetType } from "../core/customAssetRegistry";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes";
import { validateCustomBuilding } from "./buildingValidator";
import { createCustomBuildingGroup } from "./buildingRenderer";

registerCustomAssetType(CUSTOM_ASSET_TYPES.BUILDING, {
  label: "건축물",
  route: "/custom/buildings",
  renderer: createCustomBuildingGroup,
  validate: validateCustomBuilding,
});

