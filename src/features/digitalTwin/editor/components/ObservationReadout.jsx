import { observationReadings } from "../model/observationReadings";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ObservationReadout({ point, sensors, readings, now, preview = false }) {
  const rows = observationReadings(point, sensors, readings, now, preview).filter((row) => row.visible !== false);
  return <div className={styles.roiReadout} aria-label={`${point.name} 측정값`}>
    {!rows.length && <p className={styles.help}>표시할 측정 항목이 없습니다.</p>}
    {rows.map((row) => <div key={row.id} data-level={row.state.level}>
      <span title={row.name}>{row.name}</span><strong>{row.value === null ? "수신 대기" : `${row.value} ${row.unit ?? ""}`}</strong>
      {row.value !== null && <small>{row.preview ? "테스트 · " : ""}{row.state.label}</small>}
    </div>)}
  </div>;
}
