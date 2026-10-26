import { useEffect, useState } from "react";
import { getSensorFrame, monitoringApiBase } from "../api/monitoringClient";
import { activeVisionSample } from "../model/sensorImageTransform";

export default function useSensorProjectionFrames(sensors = []) {
  // Moving a sensor must neither restart requests nor reload its scene.
  const key = JSON.stringify(sensors.filter((sensor) => sensor.textureProjection?.enabled && sensor.serverSensorId && sensor.dataSource !== "DEMO"
    && !(sensor.textureProjection.kind !== "THERMAL" && activeVisionSample(sensor)))
    .map((sensor) => [sensor.id, sensor.serverSensorId, sensor.textureProjection.kind === "THERMAL" ? "THERMAL" : "VISION"]));
  const [state, setState] = useState({ key: "", frames: [] });
  useEffect(() => {
    const selected = JSON.parse(key);
    if (!monitoringApiBase || !selected.length) return;
    const controller = new AbortController(); let timer;
    async function refresh() {
      const results = await Promise.allSettled(selected.map(async ([bindingId, sensorId, kind]) => ({ ...await getSensorFrame(sensorId, controller.signal, kind), bindingId, kind })));
      if (controller.signal.aborted) return;
      setState({ key, frames: results.filter((result) => result.status === "fulfilled").map(({ value }) => ({ ...value, quality: value.quality ?? "GOOD" })) });
      timer = setTimeout(refresh, 5000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key]);
  return state.key === key ? state.frames : [];
}
