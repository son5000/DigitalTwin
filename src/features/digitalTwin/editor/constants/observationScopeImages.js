import { OBSERVATION_SCOPE_TYPES } from "@/features/digitalTwin/editor/model/observationWorkflow";

const OBSERVATION_SCOPE_ASSET_ROOT = "/assets/observation-scope";

export const OBSERVATION_SCOPE_IMAGE_FALLBACK = `${OBSERVATION_SCOPE_ASSET_ROOT}/fallback.webp`;

export const OBSERVATION_SCOPE_IMAGES = Object.freeze({
  [OBSERVATION_SCOPE_TYPES.SITE]: `${OBSERVATION_SCOPE_ASSET_ROOT}/site.webp`,
  [OBSERVATION_SCOPE_TYPES.BUILDING]: `${OBSERVATION_SCOPE_ASSET_ROOT}/building.webp`,
  [OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT]: `${OBSERVATION_SCOPE_ASSET_ROOT}/single-equipment.webp`,
  [OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT]: `${OBSERVATION_SCOPE_ASSET_ROOT}/multi-equipment.webp`,
  [OBSERVATION_SCOPE_TYPES.CUSTOM]: `${OBSERVATION_SCOPE_ASSET_ROOT}/custom.webp`,
});

export function applyObservationScopeImageFallback(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = OBSERVATION_SCOPE_IMAGE_FALLBACK;
}