import { normalizeObservationPoint } from "./equipmentDetailModel.js";
import { getSensorReadingState } from "./equipmentSetup.js";
import { isFreshMeasurement } from "./monitoringContract.js";
import { parseTemperatureCsv, temperatureSummary } from "./thermalFrame.js";

const temperatureCache = new WeakMap();
function roiTemperatures(reading) {
  if (!reading || reading.temperatureScope !== "ROI") return null;
  if (!temperatureCache.has(reading)) {
    let summary = null;
    try { summary = temperatureSummary(reading.temperatureGrid ?? parseTemperatureCsv(reading.temperatureCsv)); }
    catch { /* Invalid matrices must remain missing data, never become zero. */ }
    temperatureCache.set(reading, summary);
  }
  return temperatureCache.get(reading);
}

function generalObservationReadings(point, item, readings, now, preview) {
  const waiting = { ...item, value: null, state: getSensorReadingState(item, null), preview: false };
  if (preview) return [waiting];
  const matches = readings.filter((reading) => (reading.roiId === point.id || reading.observationPointId === point.id)
    && reading.equipmentId === point.equipmentId && reading.revision === (point.revision ?? 0)
    && reading.measurementId === item.id && ["ultrasound.db", "TEMPERATURE"].includes(reading.metric)
    && isFreshMeasurement(reading, now));
  const latest = (metric) => matches.filter((reading) => reading.metric === metric)
    .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
  const row = (key, name, unit, value) => {
    const number = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
    return { ...item, id: `${item.id}:${key}`, measurementId: item.id, metric: key, name, unit, value: number,
      state: number === null ? getSensorReadingState(item, null) : { level: "NORMAL", label: "수신", icon: "●" }, preview: false };
  };
  const result = [];
  const ultrasound = latest("ultrasound.db");
  if (ultrasound) result.push(row("ultrasound.db", "초음파", "dB", ultrasound.value));
  const thermal = latest("TEMPERATURE");
  if (thermal) {
    const summary = roiTemperatures(thermal);
    if (summary) result.push(...[["max", "최고 온도"], ["min", "최저 온도"], ["average", "평균 온도"]]
      .map(([statistic, name]) => row(`TEMPERATURE:${statistic}`, name, "°C", summary[statistic])));
    else result.push(row("TEMPERATURE", "온도", "°C", thermal.value));
  }
  return result.length ? result : [waiting];
}

export function observationReadings(point, sensors = [], readings = [], now = Date.now(), preview = false) {
  return normalizeObservationPoint(point).measurements.flatMap((item) => {
    if (item.metric === "GENERAL") return generalObservationReadings(point, item, readings, now, preview);
    const sensor = sensors.find((sensor) => sensor.id === item.sensorId);
    const reading = readings.filter((reading) => (reading.roiId === point.id || reading.observationPointId === point.id)
      && reading.equipmentId === point.equipmentId && reading.revision === (point.revision ?? 0)
      && reading.measurementId === item.id && (item.metric === "ultrasound.db" || (sensor?.serverSensorId && reading.sensorId === sensor.serverSensorId))
      && isFreshMeasurement(reading, now)).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
    if (item.metric === "TEMPERATURE" && !preview) {
      const summary = roiTemperatures(reading);
      return [["max", "최고 온도"], ["min", "최저 온도"], ["average", "평균 온도"]].map(([statistic, name]) => {
        const value = summary?.[statistic] ?? null;
        const state = getSensorReadingState(item, value);
        return { ...item, id: `${item.id}:${statistic}`, measurementId: item.id, name, statistic, value, state, unit: "°C", sampleCount: summary?.count ?? 0, preview: false };
      });
    }
    const value = preview ? item.previewValue : reading?.value;
    const state = getSensorReadingState(item, value);
    return { ...item, value: state.level === "EMPTY" ? null : Number(value), state, preview: preview && state.level !== "EMPTY" };
  });
}

export function observationStatus(rows) {
  return rows.find((row) => row.state.level === "DANGER")?.state
    ?? rows.find((row) => row.state.level === "WARNING")?.state
    ?? rows.find((row) => row.state.level === "EMPTY")?.state
    ?? rows[0]?.state ?? { level: "EMPTY", label: "데이터 없음" };
}
