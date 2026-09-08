import { registerCustomAssetType } from "../core/customAssetRegistry.js";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes.js";
import { createCustomEquipmentGroup } from "./customEquipmentRenderer.js";
import { validateCustomEquipment } from "./equipmentValidator.js";

registerCustomAssetType(CUSTOM_ASSET_TYPES.EQUIPMENT, { label: "설비", route: "/custom/equipment", renderer: createCustomEquipmentGroup, validate: validateCustomEquipment });
