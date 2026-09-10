import { ArrowRightIcon, CloseIcon } from "@/components/icons/actionIcons";
import { assetStatuses } from "@/features/portal/portalContent";

import styles from "./ObservationPage.module.css";

function Metric({ label, value, unit, note, emphasized = false }) {
  return <div><span>{label}</span><strong>{value} {unit && <em>{unit}</em>}</strong><small className={emphasized ? styles.metricEmphasis : ""}>{note}</small></div>;
}

export default function AssetDetailPanel({ asset, open, onClose }) {
  if (!asset) return null;
  const status = assetStatuses[asset.status];
  const maxTrend = Math.max(...asset.trend, 1);

  return <aside className={`${styles.detailPanel} ${open ? styles.detailPanelOpen : ""}`} aria-label="선택 설비 상세" inert={!open}>
    <div className={styles.detailHeader}>
      <div><span>선택 설비</span><h2>{asset.name}</h2><p>{asset.location}</p></div>
      <button type="button" className={styles.iconButton} onClick={onClose} aria-label="상세 패널 닫기"><CloseIcon size={18} /></button>
    </div>
    <div className={styles.statusCard} style={{ "--status": status.color }}><i>!</i><div><strong>{status.label} 상태</strong><p>{asset.summary}</p></div></div>
    <section className={styles.detailSection}>
      <header><span>현재 상태</span><small>14:32:18 기준</small></header>
      <div className={styles.metricGrid}>
        <Metric label="진동" value={asset.vibration} unit="mm/s" note={asset.change} emphasized={asset.status !== "normal"} />
        <Metric label="온도" value={asset.temperature} unit="°C" note="정상 범위" />
        <Metric label="가동률" value={asset.utilization} unit="%" note="최근 24시간" />
        <Metric label="최근 점검" value={asset.inspected} note="정기 점검 완료" />
      </div>
    </section>
    <section className={styles.detailSection}>
      <header><span>진동 추이</span><small>최근 80분</small></header>
      <div className={styles.trendChart} aria-label={`진동 추이: ${asset.trend.join(", ")}`} role="img">
        {asset.trend.map((value, index) => <i key={`${asset.id}-${index}`} style={{ height: `${Math.max(12, (value / maxTrend) * 100)}%` }} />)}
      </div>
    </section>
    <section className={styles.detailSection}>
      <header><span>연결 센서</span><b>3개</b></header>
      <ul className={styles.sensorList}>
        <li><i style={{ "--status": status.color }} /><span>VIB-{asset.sensorPrefix}-A<small>진동</small></span><b>{asset.vibration} mm/s</b></li>
        <li><i style={{ "--status": assetStatuses.normal.color }} /><span>TMP-{asset.sensorPrefix}-A<small>온도</small></span><b>{asset.temperature} °C</b></li>
        <li><i style={{ "--status": assetStatuses.normal.color }} /><span>RUN-{asset.sensorPrefix}-A<small>가동 상태</small></span><b>정상</b></li>
      </ul>
    </section>
    <button type="button" className={styles.detailAction}>설비 상세 정보 열기 <ArrowRightIcon size={16} /></button>
  </aside>;
}
