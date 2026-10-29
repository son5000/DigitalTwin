import { isFreshMeasurement, mediaUrl } from "./monitoringContract.js";
import { activeVisionSample, normalizeSensorProjection } from "./sensorImageTransform.js";
import { activeThermalSample, isTemperatureFrame } from "./thermalFrame.js";
export { normalizeSensorProjection } from "./sensorImageTransform.js";
export { validTemperatureGrid, temperaturePixels } from "./thermalFrame.js";

export function sensorProjectionFrame(sensor, records, now = Date.now(), demo = false) {
  const settings = normalizeSensorProjection(sensor.textureProjection);
  const sample = settings.kind === "VISION" && activeVisionSample(sensor);
  if (sample) return { url: sample.url, kind: "VISION", dataSource: "SAMPLE", sample: true, loadedAt: sample.loadedAt };
  const thermalSample = settings.kind === "THERMAL" && activeThermalSample(sensor);
  if (thermalSample) return (records ?? []).find((record) => record.bindingId === sensor.id && record.kind === "THERMAL"
    && record.sample === true && record.loadedAt === thermalSample.loadedAt && isTemperatureFrame(record.temperatureGrid)) ?? null;
  const matches = (records ?? []).filter((record) => record.kind === settings.kind
    && !record.sample && record.dataSource !== "SAMPLE"
    && ((sensor.serverSensorId && record.sensorId === sensor.serverSensorId) || record.bindingId === sensor.id)
    && isFreshMeasurement(record, now));
  const record = matches.sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
  if (record && (mediaUrl(record.url, demo) || (settings.kind === "THERMAL" && isTemperatureFrame(record.temperatureGrid)))) return record;
  if (settings.kind === "VISION" && mediaUrl(sensor.frameUrl, sensor.dataSource === "DEMO")
    && isFreshMeasurement({ measuredAt: sensor.frameMeasuredAt, quality: "GOOD" }, now)) return { url: sensor.frameUrl, measuredAt: sensor.frameMeasuredAt, kind: "VISION", quality: "GOOD" };
  return null;
}
