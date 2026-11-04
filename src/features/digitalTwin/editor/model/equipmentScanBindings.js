import { getEnclosureScanSlot } from "./equipmentEnclosure.js";

const isScan = (binding) => ["OBJ", "PLY"].includes(binding.assetType);

export function equipmentScanBindings(equipment, assets = []) {
  const scans = assets.filter((binding) => binding.equipmentId === equipment?.id && isScan(binding));
  const byDoor = new Map();
  scans.forEach((binding) => {
    if (binding.scanSlot && getEnclosureScanSlot(equipment, binding.scanSlot.index, binding.scanSlot.side))
      byDoor.set(`${binding.scanSlot.side}:${binding.scanSlot.index}`, binding);
  });
  const assigned = [...byDoor.values()];
  return assigned.length ? assigned : scans.filter((binding) => !binding.scanSlot).slice(-1);
}

export function scanBindingForDoor(assets, equipmentId, side, index) {
  return assets.findLast((binding) => binding.equipmentId === equipmentId && isScan(binding)
    && binding.scanSlot?.side === side && binding.scanSlot.index === index);
}
