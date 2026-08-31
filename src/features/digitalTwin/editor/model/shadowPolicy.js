export function isFloorShadowEnabled({ shadowEnabled, floorDisplayGap, selectedFloorId, floorId }) {
  if (!shadowEnabled) return false;
  if (!(Number(floorDisplayGap) > 0)) return true;
  return Boolean(selectedFloorId) && floorId === selectedFloorId;
}
