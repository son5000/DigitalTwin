import { normalizeFloorSurfaceStyle } from "@/features/digitalTwin/editor/constants/floorSurfaceStyles";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";

export function createFloorSurfaceMaterial(floorStyle) {
  return createPresetMaterial(normalizeFloorSurfaceStyle(floorStyle));
}
