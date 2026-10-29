import { getRoiReading, isObservationRoi, roiToObservationPoint, ROI_METRICS, ROI_STATUSES } from "../model/roiMonitoring.js";
import { observationReadings, observationStatus } from "../model/observationReadings.js";
import styles from "./MonitoringRoiWorkspace.module.css";

const CONNECTION_LABELS = {
  CONNECTED: "데이터 연결됨", CONNECTING: "데이터 연결 중", RECONNECTING: "데이터 재연결 중",
  DISCONNECTED: "데이터 연결 대기", ERROR: "데이터 연결 오류", DEMO: "예시 데이터 · 실측 아님",
};

function formatValue(row) {
  if (row.value === null) return "수신 대기";
  if (row.metric === "vision.switchState" && [0, 1].includes(row.value)) return row.value === 1 ? "ON" : "OFF";
  return `${Number(row.value.toFixed(2))}${row.unit ? ` ${row.unit}` : ""}`;
}

export default function RoiDashboard({ roi, sensors = [], readings, now, connection, demo, geometryChanged, onEdit }) {
  const point = isObservationRoi(roi) ? roiToObservationPoint(roi) : null;
  const validReadings = geometryChanged ? [] : readings;
  const legacy = point ? null : getRoiReading(roi, validReadings.find((item) => item.roiId === roi.id), now);
  const allRows = point ? observationReadings(point, sensors, validReadings, now) : [];
  const state = point ? observationStatus(allRows) : { level: legacy.status, label: ROI_STATUSES[legacy.status].label };
  const rows = point ? allRows.filter((row) => row.visible !== false) : ROI_METRICS.filter((metric) => roi.displayMetrics.includes(metric.id)).map((metric) => ({
    id: metric.id, metric: metric.id, name: metric.label, unit: metric.unit, value: legacy.values[metric.id], state,
  }));
  const receivedCount = rows.filter((row) => row.value !== null).length;
  return <section className={styles.dashboard} aria-label={`${roi.name} 대시보드`}>
    <div className={styles.dashboardHeading}>
      <div><h2>{roi.name}</h2><span data-status={state.level}>{state.label}</span></div>
      <button type="button" onClick={onEdit} aria-label={`${roi.name} 설정`}>설정</button>
    </div>
    <div className={styles.dashboardSummary}>
      <span>{demo ? CONNECTION_LABELS.DEMO : CONNECTION_LABELS[connection] ?? "데이터 연결 대기"}</span>
      <strong>수신 {receivedCount} / {rows.length}</strong>
    </div>
    {geometryChanged && <p className={styles.error} role="alert">모델이 변경되어 측정값을 표시할 수 없습니다. 설정에서 관측 영역을 확인하세요.</p>}
    <dl className={styles.metricCards}>
      {rows.map((row) => <div key={row.id} data-status={row.state.level}>
        <dt>{row.name}</dt>
        <dd data-empty={row.value === null}>{formatValue(row)}</dd>
        <dd className={styles.metricMeta}>
          <span>{point ? sensors.find((sensor) => sensor.id === row.sensorId)?.name ?? "연결 센서 없음" : "영역 측정값"}</span>
          <span>{row.value === null ? "데이터 없음" : row.state.label}</span>
        </dd>
      </div>)}
    </dl>
    {!rows.length && <p className={styles.hint}>표시할 측정 항목이 없습니다. 설정에서 항목을 지정하세요.</p>}
    {rows.length > 0 && receivedCount < rows.length && <p className={styles.hint}>수신 대기 항목은 유효한 최신 측정값이 없습니다.</p>}
    {legacy?.measuredAt && <small className={styles.hint}>최근 측정 {new Date(legacy.measuredAt).toLocaleString("ko-KR")}</small>}
    {point && <dl className={styles.geometrySummary}>
      <div><dt>관측 영역</dt><dd>{point.geometryType === "PLANE" ? "평면" : "구체"}</dd></div>
      <div><dt>{point.geometryType === "PLANE" ? "가로 × 세로" : "반경"}</dt><dd>{point.geometryType === "PLANE" ? `${point.planeWidth.toFixed(2)} × ${point.planeHeight.toFixed(2)} m` : `${point.radius.toFixed(2)} m`}</dd></div>
    </dl>}
  </section>;
}
