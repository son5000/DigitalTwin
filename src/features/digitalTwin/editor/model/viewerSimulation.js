import { gaugeAngleForValue, LED_COLORS, statePair } from "./observationProfiles.js";
import { isObservationRoi, roiToObservationPoint } from "./roiMonitoring.js";
import { temperatureSummary } from "./thermalFrame.js";

export function simulationTemperatureGrid(average, sequence = 0) {
  const width = 96, height = 72;
  const raw = Array.from({ length: width * height }, (_, index) => {
    const x = index % width / width, y = Math.floor(index / width) / height;
    const hot = Math.exp(-(((x - .7) / .16) ** 2 + ((y - .42) / .22) ** 2) * 2);
    const cool = Math.exp(-(((x - .25) / .22) ** 2 + ((y - .66) / .18) ** 2) * 2);
    return hot * 20 - cool * 6 + Math.sin(x * 17 + y * 11 + sequence * .4) * 1.4;
  });
  const offset = average - raw.reduce((sum, value) => sum + value, 0) / raw.length;
  const values = raw.map((value) => Number((value + offset).toFixed(2)));
  return { width, height, values };
}

export function simulationSpectrum(levelDb, peakHz, sequence = 0) {
  return Array.from({ length: 129 }, (_, index) => {
    const frequencyHz = index * 800;
    const peak = Math.exp(-(((frequencyHz - peakHz) / 6500) ** 2));
    return { frequencyHz, levelDb: Number((Math.max(0, levelDb - 34 + peak * 31 + Math.sin(index * 1.7 + sequence) * 2)).toFixed(1)) };
  });
}

export function createSimulationSnapshot({ equipmentId, modelVersion, rois, selectedRoiId, sensors, levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor, sequence, measuredAt, alarm }) {
  const selected = rois.find((roi) => roi.id === selectedRoiId && roi.equipmentId === equipmentId);
  const point = selected && isObservationRoi(selected) ? roiToObservationPoint(selected) : null;
  const grid = simulationTemperatureGrid(averageTemperature, sequence);
  const summary = temperatureSummary(grid);
  const common = { equipmentId, roiId: selectedRoiId, observationPointId: selectedRoiId,
    revision: point?.revision ?? selected?.revision ?? 0, measuredAt, staleAfterMs: 60000, quality: "GOOD", dataSource: "SIMULATION" };
  const readings = point ? point.measurements.flatMap((item) => {
    const base = { ...common, measurementId: item.id };
    if (item.metric === "GENERAL") return [
      { ...base, metric: "ultrasound.db", value: levelDb, spectrum: simulationSpectrum(levelDb, peakHz, sequence) },
      { ...base, metric: "TEMPERATURE", value: summary.average, temperatureScope: "ROI", temperatureSummary: summary },
    ];
    if (item.metric === "vision.gaugeValue") return [{ ...base, metric: item.metric, sensorId: sensors.find((sensor) => sensor.id === item.sensorId)?.serverSensorId,
      value: gaugeValue, needleAngleDeg: gaugeAngleForValue(item.analysisConfig?.scale, gaugeValue) }];
    if (["vision.switchState", "vision.valveState"].includes(item.metric)) {
      const pair = statePair(item.analysisConfig?.pairId ?? (item.metric === "vision.valveState" ? "OPEN_CLOSED" : "POWER"));
      const reference = item.analysisConfig?.referenceState;
      const stateCode = alternateState ? pair.slice(1).find((code) => code !== reference) : reference;
      return [{ ...base, metric: item.metric, sensorId: sensors.find((sensor) => sensor.id === item.sensorId)?.serverSensorId, stateCode, value: alternateState ? 1 : 0 }];
    }
    if (item.metric === "vision.ledState") return [{ ...base, metric: item.metric, sensorId: sensors.find((sensor) => sensor.id === item.sensorId)?.serverSensorId,
      colorKey: LED_COLORS.some((color) => color.id === ledColor) ? ledColor : "GREEN", value: 1 }];
    if (item.metric === "TEMPERATURE") return [{ ...base, metric: item.metric, sensorId: sensors.find((sensor) => sensor.id === item.sensorId)?.serverSensorId,
      value: summary.average, temperatureScope: "ROI", temperatureSummary: summary }];
    return [];
  }) : selected ? [{ ...common, values: { "temperature.max": summary.max, "temperature.min": summary.min,
    "temperature.avg": summary.average, "ultrasound.db": levelDb }, status: "NORMAL" }] : [];
  const position = point?.localPosition;
  const hotspots = position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)
    ? ["PROXY", "ACTUAL"].map((representation) => ({ equipmentId, modelVersion, representation,
      measuredAt, staleAfterMs: 60000, quality: "GOOD", position: [position.x, position.y, position.z],
      db: levelDb, radius: Math.max(.06, Math.min(.5, point.radius ?? .12)) })) : [];
  const frames = sensors.filter((sensor) => sensor.textureProjection?.enabled && sensor.textureProjection.kind === "THERMAL"
    && (sensor.textureProjection.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId).map((sensor) => ({
      bindingId: sensor.id, sensorId: sensor.serverSensorId, kind: "THERMAL",
      measuredAt, staleAfterMs: 60000, quality: "GOOD", dataSource: "SIMULATION",
      temperatureGrid: grid,
    }));
  return { readings, hotspots, frames, grid, alarms: alarm ? [{ id: `simulation:${alarm.sequence}`, roiId: selectedRoiId,
    name: selected?.name ?? "설비", severity: alarm.severity, occurredAt: alarm.measuredAt,
    message: "개발자 테스트 도구에서 주입한 경고입니다.", dataSource: "SIMULATION" }] : [] };
}
