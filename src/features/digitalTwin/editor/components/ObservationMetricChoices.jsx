import { OBSERVATION_METRICS } from "../model/observationMetrics.js";
import { isImageObservationMetric } from "../model/imageObservation.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ObservationMetricChoices({ values, onChange, allowedMetrics = Object.keys(OBSERVATION_METRICS), compact = false }) {
  const choices = Object.entries(OBSERVATION_METRICS).filter(([id]) => allowedMetrics.includes(id));
  const activeValues = values.filter((id) => allowedMetrics.includes(id));
  const image = activeValues.some(isImageObservationMetric);
  if (compact) return <div className={styles.compactMetrics} role="group" aria-label="관측 항목">
    {choices.map(([id, [label]]) => <button key={id} type="button" aria-pressed={activeValues.includes(id)}
      onClick={() => onChange([id])}>{label}</button>)}
  </div>;
  return <div className={styles.roiEditor}>
    {[false,true].map((imageGroup) => <fieldset key={String(imageGroup)} className={styles.metricChoices}>
      <legend>{imageGroup ? "영상 분석 · 단독 선택" : "공간 관측 · 복수 선택"}</legend>
      {choices.filter(([id])=>isImageObservationMetric(id) === imageGroup).map(([id,[label]]) =>
        <label key={id} className={styles.check}><input type="checkbox" checked={activeValues.includes(id)}
          disabled={!activeValues.includes(id) && (image || (imageGroup && activeValues.length > 0))}
          onChange={(event)=>onChange(event.target.checked ? [...activeValues,id] : activeValues.filter((value)=>value !== id))} />{label}</label>)}
    </fieldset>)}
    <p className={styles.help}>게이지·스위치 등 영상 분석은 비전 텍스처에 연결된 평면 영역을 사용합니다. 다른 항목으로 바꾸려면 현재 선택을 먼저 해제하세요.</p>
  </div>;
}
