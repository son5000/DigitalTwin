import { VERTICAL_PATH_MODES } from "./VerticalPathModel";

export function resolveCutFill(verticalPath, roadWidth = 6) {
  const samples = verticalPath?.points ?? [];
  const values = samples.map((sample) => sample.elevation - sample.terrainElevation);
  const cutDepth = Math.min(0, ...values, 0);
  const fillHeight = Math.max(0, ...values, 0);
  const sampleLength = verticalPath?.horizontalLength / Math.max(1, samples.length - 1);
  const cutVolume = values.reduce((total, value) => total + Math.max(0, -value) * roadWidth * sampleLength, 0);
  const fillVolume = values.reduce((total, value) => total + Math.max(0, value) * roadWidth * sampleLength, 0);
  return {
    cutDepth: Math.abs(cutDepth),
    fillHeight,
    cutVolume,
    fillVolume,
    needsSupports: verticalPath?.mode === VERTICAL_PATH_MODES.ELEVATED && fillHeight > 0.5,
    recommendation: fillHeight > 4 ? "교각 또는 옹벽 권장" : Math.abs(cutDepth) > 4 ? "절토 사면 검토" : "일반 사면 적용 가능",
  };
}
