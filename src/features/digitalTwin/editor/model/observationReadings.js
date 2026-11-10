import { normalizeObservationPoint } from "./equipmentDetailModel.js";
import { getSensorReadingState } from "./equipmentSetup.js";
import { isFreshMeasurement } from "./monitoringContract.js";
import { parseTemperatureCsv, temperatureSummary } from "./thermalFrame.js";
import { assessRules, generalRulesFor, gaugeAngleForValue, gaugeValueForAngle, LED_COLORS, stateLabel, statePair } from "./observationProfiles.js";

const temperatureCache = new WeakMap();
function roiTemperatures(reading) {
  if (!reading || reading.temperatureScope !== "ROI") return null;
  if (!temperatureCache.has(reading)) {
    let summary = null;
    try { summary = reading.temperatureSummary ?? temperatureSummary(reading.temperatureGrid ?? parseTemperatureCsv(reading.temperatureCsv)); }
    catch { /* Invalid matrices must remain missing data, never become zero. */ }
    temperatureCache.set(reading, summary);
  }
  return temperatureCache.get(reading);
}

function generalObservationReadings(point, item, readings, now, preview) {
  const matches = preview ? [] : readings.filter((reading) => (reading.roiId === point.id || reading.observationPointId === point.id)
    && reading.equipmentId === point.equipmentId && reading.revision === (point.revision ?? 0)
    && reading.measurementId === item.id && ["ultrasound.db", "TEMPERATURE"].includes(reading.metric)
    && isFreshMeasurement(reading, now));
  const latest = (metric) => matches.filter((reading) => reading.metric === metric)
    .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
  const row = (key, name, unit, value, metric, statistic = null, extra = {}) => {
    const number = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
    return { ...item, id: `${item.id}:${key}`, measurementId: item.id, metric, name, unit, value: number,
      state: assessRules(number, generalRulesFor(item, metric, statistic)), preview: false, ...extra };
  };
  const ultrasound = latest("ultrasound.db");
  const thermal = latest("TEMPERATURE");
  const summary = roiTemperatures(thermal);
  const meanDb = Number.isFinite(ultrasound?.averageDb) ? ultrasound.averageDb : null;
  return [row("ultrasound.db", meanDb !== null || ultrasound?.aggregation === "SPATIAL_MEAN" ? "평균 초음파" : "초음파", "dB", meanDb ?? ultrasound?.value, "ultrasound.db", null,
    { spectrum: ultrasound?.spectrum ?? null, waveform: ultrasound?.waveform ?? null,
      measuredAt: ultrasound?.measuredAt ?? null, sourceNames: ultrasound?.sourceNames ?? [] }),
    ...[["max", "최고 온도"], ["min", "최저 온도"], ["average", "평균 온도"]]
      .map(([statistic, name]) => row(`TEMPERATURE:${statistic}`, name, "°C",
        summary?.[statistic] ?? (statistic === "average" ? thermal?.value : null), "TEMPERATURE", statistic,
        { measuredAt: thermal?.measuredAt ?? null, sourceNames: thermal?.sourceNames ?? [],
          temperatureScale: thermal?.temperatureScale ?? null }))];
}

export function observationReadings(point, sensors = [], readings = [], now = Date.now(), preview = false) {
  return normalizeObservationPoint(point).measurements.flatMap((item) => {
    if (item.metric === "GENERAL") return generalObservationReadings(point, item, readings, now, preview);
    const sensor = sensors.find((sensor) => sensor.id === item.sensorId);
    const reading = readings.filter((reading) => (reading.roiId === point.id || reading.observationPointId === point.id)
      && reading.equipmentId === point.equipmentId && reading.revision === (point.revision ?? 0)
      && reading.measurementId === item.id && (item.metric === "ultrasound.db" || reading.dataSource === "SIMULATION"
        || (sensor?.serverSensorId && reading.sensorId === sensor.serverSensorId))
      && isFreshMeasurement(reading, now)).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
    if (["vision.switchState", "vision.valveState"].includes(item.metric) && !preview) {
      const profile = item.analysisConfig ?? {};
      const pair = statePair(profile.pairId ?? (item.metric === "vision.valveState" ? "OPEN_CLOSED" : "POWER"));
      const comparison = reading?.value === null || reading?.value === undefined ? null : Number(reading.value);
      const code = reading?.stateCode && [pair[1], pair[2]].includes(reading.stateCode) ? reading.stateCode
        : ![pair[1], pair[2]].includes(profile.referenceState) ? null
          : comparison === 0 ? profile.referenceState : comparison === 1 ? pair.slice(1).find((value) => value !== profile.referenceState) : null;
      const level = code ? profile.levels?.[code] ?? "NORMAL" : "EMPTY";
      return { ...item, value: code ? (code === profile.referenceState ? 0 : 1) : null,
        displayValue: code ? stateLabel(code) : null, state: code ? { level, label: { NORMAL: "정상", WARNING: "주의", DANGER: "이상" }[level] } : { level: "EMPTY", label: "수신 대기" } };
    }
    if (item.metric === "vision.ledState" && !preview) {
      const colorKey = reading?.colorKey ?? reading?.color?.key;
      const mapping = item.analysisConfig?.colors?.find((entry) => entry.colorKey === colorKey);
      const color = LED_COLORS.find((entry) => entry.id === colorKey);
      const level = mapping?.level ?? "IDLE";
      return { ...item, value: mapping ? 1 : null, colorKey,
        displayValue: mapping ? `${color?.label ?? colorKey} · ${stateLabel(mapping.stateCode)}` : colorKey ? "미설정 색상" : null,
        state: { level: colorKey ? level : "EMPTY", label: colorKey ? { NORMAL: "정상", WARNING: "주의", DANGER: "이상", IDLE: "기준 미설정" }[level] : "수신 대기" } };
    }
    if (item.metric === "TEMPERATURE" && !preview) {
      const summary = roiTemperatures(reading);
      return [["max", "최고 온도"], ["min", "최저 온도"], ["average", "평균 온도"]].map(([statistic, name]) => {
        const value = summary?.[statistic] ?? null;
        const state = getSensorReadingState(item, value);
        return { ...item, id: `${item.id}:${statistic}`, measurementId: item.id, name, statistic, value, state, unit: "°C", sampleCount: summary?.count ?? 0, preview: false };
      });
    }
    const value = preview ? item.previewValue : item.metric === "vision.gaugeValue" && reading?.value == null
      ? gaugeValueForAngle(item.analysisConfig?.scale, reading?.needleAngleDeg) : reading?.value;
    const state = item.metric === "vision.gaugeValue" ? assessRules(value == null ? null : Number(value), item.rules) : getSensorReadingState(item, value);
    return { ...item, value: state.level === "EMPTY" ? null : Number(value), state, preview: preview && state.level !== "EMPTY",
      ...(item.metric === "vision.gaugeValue" ? { needleAngleDeg: Number.isFinite(reading?.needleAngleDeg) ? reading.needleAngleDeg : gaugeAngleForValue(item.analysisConfig?.scale, Number(value)) } : {}) };
  });
}

export function observationStatus(rows) {
  return rows.find((row) => row.state.level === "DANGER")?.state
    ?? rows.find((row) => row.state.level === "WARNING")?.state
    ?? rows.find((row) => row.state.level === "NORMAL")?.state
    ?? rows.find((row) => row.state.level === "IDLE")?.state
    ?? rows.find((row) => row.state.level === "EMPTY")?.state
    ?? rows[0]?.state ?? { level: "EMPTY", label: "데이터 없음" };
}
