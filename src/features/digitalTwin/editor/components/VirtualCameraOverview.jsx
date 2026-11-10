import { isFreshMeasurement } from "../model/monitoringContract.js";
import GeneralObservationDashboard from "./GeneralObservationDashboard.jsx";
import styles from "./VirtualCameraOverview.module.css";

export default function VirtualCameraOverview({ camera, sample, hotspots = [], equipmentId, modelVersion, now }) {
  if (!sample || sample.cameraId !== camera?.id) return <p>관측 데이터를 불러오는 중입니다.</p>;
  const summary = sample.temperature?.summary;
  const center = sample.center && [sample.center.x, sample.center.y, sample.center.z];
  const nearby = center ? hotspots.filter((item) => item.equipmentId === equipmentId
    && (!item.modelVersion || item.modelVersion === modelVersion)
    && Number.isFinite(item.db) && isFreshMeasurement(item, now)
    && Array.isArray(item.position) && item.position.length === 3
    && Math.hypot(...item.position.map((value, index) => value - center[index])) <= Math.max(.08, item.radius ?? 0)) : [];
  const unique = [...new Map(nearby.map((item) => [item.id ?? JSON.stringify([item.position, item.db, item.measuredAt]), item])).values()];
  const latest = unique.sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
  const averageDb = unique.length ? 10 * Math.log10(unique.reduce((sum, item) => sum + 10 ** (item.db / 10), 0) / unique.length) : null;
  const temperatureRows = [["max", summary?.max], ["min", summary?.min], ["average", summary?.average]]
    .map(([statistic, value]) => ({ id: `camera:TEMPERATURE:${statistic}`, metric: "TEMPERATURE", value: value ?? null,
      measuredAt: sample.temperature?.measuredAt ?? null, temperatureScale: sample.temperature?.temperatureScale ?? null }));
  const rows = [{ id: "camera:ultrasound.db", metric: "ultrasound.db", value: averageDb,
    measuredAt: latest?.measuredAt ?? null, spectrum: latest?.spectrum ?? null, waveform: latest?.waveform ?? null },
  ...temperatureRows];
  return <div className={styles.overview}>
    <p className={styles.description}>화면에 보이는 온도 분포와 시점 중앙의 초음파 신호입니다.</p>
    <GeneralObservationDashboard overview compact rows={rows} />
  </div>;
}
