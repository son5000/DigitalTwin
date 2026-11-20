import { isObservationRoi, validateRoi } from "../../digitalTwin/editor/model/roiMonitoring.js";

// Opaque preservation only: never call the monitoring save/register APIs.
export function retainedRois(records = [], layout = {}) {
  if (!Array.isArray(records)) throw new Error("별도 ROI 원문은 배열이어야 합니다.");
  const points = new Set((layout.observationConfig?.observationPoints ?? layout.observationPoints ?? []).map((point) => point.id));
  const seen = new Set();
  return records.filter((roi) => {
    validateRoi(roi);
    if (seen.has(roi.id)) throw new Error("별도 ROI 원문에 중복 ID가 있습니다.");
    seen.add(roi.id);
    return !points.has(roi.id) && !isObservationRoi(roi);
  });
}
