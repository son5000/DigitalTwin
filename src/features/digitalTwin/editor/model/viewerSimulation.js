import { gaugeAngleForValue, LED_COLORS, statePair } from "./observationProfiles.js";
import { getSensorCapabilities } from "./equipmentDetailModel.js";
import { getEnclosure, getEnclosureDoorLabel, getEnclosureScanSlot } from "./equipmentEnclosure.js";
import { getEquipmentCoordinateFrame, modelToReference, modelToScanSlot, scanSlotForModelPosition } from "./equipmentCoordinateFrame.js";
import { isObservationRoi, roiToObservationPoint } from "./roiMonitoring.js";
import { temperatureSummary } from "./thermalFrame.js";

const generalRois = (rois) => rois.filter((roi) => isObservationRoi(roi)
  && roi.measurements?.some((item) => item.metric === "GENERAL"));

export function createSimulationZones(equipment, rois = []) {
  const observations = generalRois(rois);
  const enclosure = getEnclosure(equipment);
  if (enclosure.enabled) {
    return ["FRONT", "REAR"].flatMap((side) => {
      const doorSet = side === "FRONT" ? enclosure : enclosure.rear;
      return Array.from({ length: doorSet.doorCount }, (_, index) => {
        const slot = getEnclosureScanSlot(equipment, index, side);
        if (!slot) return null;
        const included = observations.filter((roi) => scanSlotForModelPosition(equipment, roi.surface.center)?.id === slot.id);
        const anchor = included[0]?.surface.center ? modelToScanSlot(included[0].surface.center, slot) : null;
        const position = { x: anchor?.x ?? slot.dimensions.width / 2, y: anchor?.y ?? slot.dimensions.height / 2, z: 0 };
        return { id: slot.id, label: `${side === "FRONT" ? "앞" : "뒤"} ${getEnclosureDoorLabel(doorSet, index)}`,
          position, coordinateSpace: "SCAN_SLOT", scanSlot: { side, index },
          roiIds: included.map((roi) => roi.id), anchorName: included[0]?.name ?? "구획 중앙", side, index };
      }).filter(Boolean);
    });
  }
  const frame = getEquipmentCoordinateFrame(equipment);
  const referencePosition = (modelPosition) => {
    const position = modelToReference(modelPosition, frame);
    return { x: position.x, y: position.y, z: 0 };
  };
  const coordinates = frame ? { coordinateFrame: frame } : {};
  if (observations.length) return observations.map((roi) => ({ id: `ROI:${roi.id}`, label: roi.name,
    position: referencePosition(Object.fromEntries(["x", "y", "z"].map((axis, i) => [axis, roi.surface.center[i]]))),
    ...coordinates, roiIds: [roi.id], anchorName: roi.name }));
  return [{ id: "EQUIPMENT", label: "설비 중앙", position: referencePosition({ x: 0, y: (equipment?.dimensions?.height ?? 1) / 2, z: 0 }),
    ...coordinates, roiIds: [], anchorName: "설비 중앙" }];
}

export function rotatingSimulationZones(zones, count, startIndex = 0, manualIds = []) {
  if (!zones.length) return [];
  if (count === "MANUAL") return zones.filter((zone) => manualIds.includes(zone.id)).map((zone) => zone.id);
  const size = count === "ALL" ? zones.length : Math.min(zones.length, Math.max(1, Number(count) || 1));
  return Array.from({ length: size }, (_, offset) => zones[(startIndex + offset) % zones.length].id);
}

export function simulationTemperatureGrid(average, sequence = 0, cameraIndex = 0) {
  const width = 96, height = 72;
  const pattern = Math.abs(cameraIndex) % 5;
  const hotCenters = [[.7, .42], [.31, .34], [.56, .67], [.78, .7], [.43, .48]];
  const coolCenters = [[.25, .66], [.74, .72], [.2, .27], [.35, .35], [.76, .23]];
  const [hotX, hotY] = hotCenters[pattern], [coolX, coolY] = coolCenters[pattern];
  const raw = Array.from({ length: width * height }, (_, index) => {
    const x = index % width / width, y = Math.floor(index / width) / height;
    const hot = Math.exp(-(((x - hotX) / (.13 + pattern * .012)) ** 2 + ((y - hotY) / .2) ** 2) * 2);
    const cool = Math.exp(-(((x - coolX) / .22) ** 2 + ((y - coolY) / .18) ** 2) * 2);
    return hot * (20 + pattern * 2) - cool * (6 + pattern)
      + Math.sin(x * (17 + pattern * 2) + y * 11 + sequence * .4 + cameraIndex * .8) * 1.4;
  });
  const offset = average - raw.reduce((sum, value) => sum + value, 0) / raw.length;
  const values = raw.map((value) => Number((value + offset).toFixed(2)));
  return { width, height, values };
}

export function simulationSpectrum(levelDb, peakHz, sequence = 0) {
  return Array.from({ length: 129 }, (_, index) => {
    const frequencyHz = index * 375;
    const peak = Math.exp(-(((frequencyHz - peakHz) / 6500) ** 2));
    return { frequencyHz, levelDb: Number((Math.max(0, levelDb - 34 + peak * 31 + Math.sin(index * 1.7 + sequence) * 2)).toFixed(1)) };
  });
}

function simulationWaveform(peakHz, sequence = 0) {
  const sampleRateHz = 96000;
  const frequencyHz = Math.max(1000, Math.min(40000, peakHz));
  const samples = Array.from({ length: 960 }, (_, index) => {
    const time = index / sampleRateHz;
    const envelope = 0.62 + 0.2 * Math.sin(index / 110 + sequence * 0.5);
    return Number((envelope * (0.72 * Math.sin(2 * Math.PI * frequencyHz * time)
      + 0.18 * Math.sin(2 * Math.PI * frequencyHz * 0.47 * time + sequence))).toFixed(3));
  });
  return { sampleRateHz, samples };
}

export function createSimulationSnapshot({ equipmentId, modelVersion, rois, selectedRoiId, sensors, zones = [], activeZoneIds = [], temperatureGrid, thermalGrids = {}, levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor, sequence, measuredAt, alarm }) {
  const selected = rois.find((roi) => roi.id === selectedRoiId && roi.equipmentId === equipmentId);
  const grid = temperatureGrid ?? simulationTemperatureGrid(averageTemperature, sequence);
  const summary = temperatureSummary(grid);
  const activeZones = zones.filter((zone) => activeZoneIds.includes(zone.id));
  const baselineDb = Math.max(20, Math.min(35, levelDb - 36));
  const signals = new Map();
  const signalFor = (db) => {
    if (!signals.has(db)) signals.set(db, { spectrum: simulationSpectrum(db, peakHz, sequence), waveform: simulationWaveform(peakHz, sequence) });
    return signals.get(db);
  };
  const readings = rois.flatMap((roi) => {
    if (!isObservationRoi(roi)) return [];
    const point = roiToObservationPoint(roi);
    const zone = zones.find((entry) => entry.roiIds.includes(roi.id));
    const activeIndex = activeZones.findIndex((entry) => entry.id === zone?.id);
    const receivedDb = activeIndex < 0 ? baselineDb : Math.min(140, levelDb + (activeIndex % 3 - 1) * 1.5);
    const common = { equipmentId, roiId: roi.id, observationPointId: roi.id, revision: point.revision ?? 0,
      measuredAt, staleAfterMs: 60000, quality: "GOOD", dataSource: "SIMULATION" };
    return point.measurements.flatMap((item) => {
      if (item.metric !== "GENERAL" && roi.id !== selectedRoiId) return [];
      const base = { ...common, measurementId: item.id };
      if (item.metric === "GENERAL") return [
        { ...base, metric: "ultrasound.db", value: receivedDb, averageDb: receivedDb, aggregation: "SPATIAL_MEAN",
          ...signalFor(receivedDb) },
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
    });
  });
  if (selected && !isObservationRoi(selected)) readings.push({
    equipmentId, roiId: selected.id, revision: selected.revision ?? 0, measuredAt,
    staleAfterMs: 60000, quality: "GOOD", dataSource: "SIMULATION",
    values: { "temperature.max": summary.max, "temperature.min": summary.min,
      "temperature.avg": summary.average, "ultrasound.db": levelDb }, status: "NORMAL",
  });
  const hotspots = activeZones.flatMap((zone) => ["PROXY", "ACTUAL"].map((representation) => ({
    id: `simulation:${zone.id}:${representation}`, equipmentId, modelVersion, representation,
    measuredAt, staleAfterMs: 1200, quality: "GOOD", dataSource: "SIMULATION", position: [zone.position.x, zone.position.y, 0],
    ...(zone.coordinateSpace === "SCAN_SLOT" ? { coordinateSpace: "SCAN_SLOT", scanSlot: zone.scanSlot, normal: [0, 0, 1] } : {}),
    ...(zone.coordinateFrame ? { coordinateFrame: zone.coordinateFrame, normal: [0, 0, 1] } : {}),
    db: levelDb, radius: .16, ...signalFor(levelDb),
  })));
  const frames = sensors.filter((sensor) => getSensorCapabilities(sensor).includes("THERMAL")
    && (sensor.textureProjection?.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId).map((sensor) => ({
      bindingId: sensor.id, sensorId: sensor.serverSensorId, kind: "THERMAL",
      measuredAt, staleAfterMs: 60000, quality: "GOOD", dataSource: "SIMULATION",
      temperatureGrid: thermalGrids[sensor.id] ?? grid,
    }));
  return { readings, hotspots, frames, grid, alarms: alarm ? [{ id: `simulation:${alarm.sequence}`, roiId: selectedRoiId,
    name: selected?.name ?? "설비", severity: alarm.severity, occurredAt: alarm.measuredAt,
    message: "개발자 테스트 도구에서 주입한 경고입니다.", dataSource: "SIMULATION" }] : [] };
}
