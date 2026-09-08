import { registerCustomAssetValidator } from "../core/customAssetValidation.js";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes.js";

export function validateCustomEquipment(asset) {
  const issues = [];
  if (!asset.parts?.length) issues.push({ path: "parts", message: "설비에 부품을 하나 이상 추가하세요." });
  asset.parts?.forEach((part) => {
    if (!Number.isFinite(part.parameters?.diameter) || part.parameters.diameter <= 0) issues.push({ path: `parts.${part.id}.diameter`, message: `${part.name}의 지름이 올바르지 않습니다.` });
    part.ports?.forEach((port) => { if (port.connectedTo && !asset.parts.some((candidate) => candidate.id === port.connectedTo.partId && candidate.ports.some((item) => item.id === port.connectedTo.portId))) issues.push({ path: `parts.${part.id}.ports.${port.id}`, message: `${part.name}에 끊어진 연결 참조가 있습니다.` }); });
  });
  return issues;
}

registerCustomAssetValidator(CUSTOM_ASSET_TYPES.EQUIPMENT, validateCustomEquipment);
