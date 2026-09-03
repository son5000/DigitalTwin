export const OBSERVATION_SITE_SIZE_MODES = Object.freeze({
  DEFAULT: "DEFAULT",
  AUTO_BUILDING: "AUTO_BUILDING",
  CUSTOM: "CUSTOM",
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function roundUp(value, unit = 0.5) {
  return Math.ceil(value / unit) * unit;
}

export function calculateObservationSiteSize(building, options = {}) {
  const width = Math.max(0, finite(building?.parameters?.width ?? building?.dimensions?.width));
  const depth = Math.max(0, finite(building?.parameters?.depth ?? building?.dimensions?.depth));
  const rotationY = finite(building?.rotation?.y);
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const footprint = {
    width: width * cosine + depth * sine,
    depth: width * sine + depth * cosine,
  };
  const marginRatio = Math.min(0.2, Math.max(0.1, finite(options.marginRatio, 0.15)));
  const minimumMargin = Math.max(0, finite(options.minimumMargin, 4));
  const margin = Math.max(minimumMargin, Math.max(footprint.width, footprint.depth) * marginRatio);
  const positionX = Math.abs(finite(building?.position?.x));
  const positionZ = Math.abs(finite(building?.position?.z));
  return {
    width: Math.min(400, Math.max(20, roundUp(2 * (positionX + footprint.width / 2 + margin)))),
    depth: Math.min(400, Math.max(20, roundUp(2 * (positionZ + footprint.depth / 2 + margin)))),
    footprint,
    margin,
  };
}

export function canAutoResizeObservationSite(environment, buildingId) {
  return environment?.sizeMode === OBSERVATION_SITE_SIZE_MODES.AUTO_BUILDING
    && environment?.autoFitBuildingId === buildingId;
}
