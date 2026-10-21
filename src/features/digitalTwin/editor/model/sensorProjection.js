import { isFreshMeasurement, mediaUrl } from "./monitoringContract.js";

const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeSensorProjection(source = {}) {
  return {
    enabled: source.enabled === true,
    kind: source.kind === "THERMAL" ? "THERMAL" : "VISION",
    target: ["ACTUAL", "PROXY", "BOTH"].includes(source.target) ? source.target : "PROXY",
    surfaceId: typeof source.surfaceId === "string" ? source.surfaceId : "",
    meshPath: typeof source.meshPath === "string" ? source.meshPath : null,
    meshName: typeof source.meshName === "string" ? source.meshName : "",
    opacity: number(source.opacity, 1, 0, 1),
    scaleX: number(source.scaleX, 1, .05, 20), scaleY: number(source.scaleY, 1, .05, 20),
    offsetX: number(source.offsetX, 0, -2, 2), offsetY: number(source.offsetY, 0, -2, 2),
    rotation: number(source.rotation, 0, -180, 180),
    cropX: number(source.cropX, 0, 0, .99), cropY: number(source.cropY, 0, 0, .99),
    cropWidth: number(source.cropWidth, 1, .01, 1), cropHeight: number(source.cropHeight, 1, .01, 1),
    temperatureMin: number(source.temperatureMin, 0, -273.15, 10000),
    temperatureMax: number(source.temperatureMax, 100, -273.14, 10001),
  };
}

export function validTemperatureGrid(grid) {
  return Number.isInteger(grid?.width) && Number.isInteger(grid?.height) && grid.width > 0 && grid.height > 0
    && grid.width <= 2048 && grid.height <= 2048 && grid.width * grid.height <= 1048576
    && Array.isArray(grid.values) && grid.values.length === grid.width * grid.height
    && grid.values.every((value) => value === null || Number.isFinite(value));
}

export function temperaturePixels(grid, min, max) {
  if (!validTemperatureGrid(grid) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  const pixels = new Uint8Array(grid.width * grid.height * 4);
  // Rows arrive top to bottom; WebGL texture coordinates start at the bottom.
  grid.values.forEach((value, index) => {
    if (value === null) return;
    const target = ((grid.height - 1 - Math.floor(index / grid.width)) * grid.width + index % grid.width) * 4;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    pixels[target] = Math.round(255 * Math.min(1, Math.max(0, 2 * t)));
    pixels[target + 1] = Math.round(255 * Math.max(0, 1 - Math.abs(2 * t - 1)));
    pixels[target + 2] = Math.round(255 * Math.max(0, 1 - 2 * t));
    pixels[target + 3] = 255;
  });
  return pixels;
}

export function sensorProjectionFrame(sensor, records, now = Date.now(), demo = false) {
  const settings = normalizeSensorProjection(sensor.textureProjection);
  const matches = (records ?? []).filter((record) => record.kind === settings.kind
    && ((sensor.serverSensorId && record.sensorId === sensor.serverSensorId) || record.bindingId === sensor.id)
    && isFreshMeasurement(record, now));
  const record = matches.sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
  if (record && (mediaUrl(record.url, demo) || (settings.kind === "THERMAL" && validTemperatureGrid(record.temperatureGrid)))) return record;
  if (settings.kind === "VISION" && mediaUrl(sensor.frameUrl, sensor.dataSource === "DEMO")
    && isFreshMeasurement({ measuredAt: sensor.frameMeasuredAt, quality: "GOOD" }, now)) return { url: sensor.frameUrl, measuredAt: sensor.frameMeasuredAt, kind: "VISION", quality: "GOOD" };
  return null;
}
