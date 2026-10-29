import { useEffect, useState } from "react";
import { getSensorFrame, monitoringApiBase } from "../api/monitoringClient";
import { activeVisionSample } from "../model/sensorImageTransform";
import { activeThermalSample, loadThermalSample } from "../model/thermalFrame";

export default function useSensorProjectionFrames(sensors = []) {
  // Moving a sensor must neither restart requests nor reload its scene.
  const key = JSON.stringify(sensors.filter((sensor) => sensor.textureProjection?.enabled).flatMap((sensor) => {
    const kind = sensor.textureProjection.kind === "THERMAL" ? "THERMAL" : "VISION";
    const sample = kind === "THERMAL" && activeThermalSample(sensor);
    if (sample) return [[sensor.id, sensor.serverSensorId, kind, sample.loadedAt]];
    return monitoringApiBase && sensor.serverSensorId && sensor.dataSource !== "DEMO" && !(kind === "VISION" && activeVisionSample(sensor))
      ? [[sensor.id, sensor.serverSensorId, kind, null]] : [];
  }));
  const [state, setState] = useState({ key: "", frames: [] });
  useEffect(() => {
    const selected = JSON.parse(key);
    if (!selected.length) return;
    const controller = new AbortController(); let timer;
    async function refresh() {
      const results = await Promise.allSettled(selected.map(async ([bindingId, sensorId, kind, loadedAt]) => {
        try {
          if (loadedAt) {
            const temperatureGrid = await loadThermalSample();
            return { bindingId, sensorId, kind, loadedAt, sample: true, dataSource: "SAMPLE", temperatureGrid,
              resolution: { width: temperatureGrid.width, height: temperatureGrid.height } };
          }
          return { ...await getSensorFrame(sensorId, controller.signal, kind), bindingId, kind };
        } catch (error) { return { bindingId, kind, error: error.message, quality: "ERROR" }; }
      }));
      if (controller.signal.aborted) return;
      setState({ key, frames: results.filter((result) => result.status === "fulfilled").map(({ value }) => ({ ...value, quality: value.quality ?? "GOOD" })) });
      if (selected.some((item) => !item[3])) timer = setTimeout(refresh, 5000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key]);
  return state.key === key ? state.frames : [];
}
