import { OBSERVATION_METRICS } from "../model/observationMetrics.js";
import { isImageObservationMetric } from "../model/imageObservation.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ObservationMetricChoices({ values, onChange }) {
  const image = values.some(isImageObservationMetric);
  return <div className={styles.roiEditor}>
    {[false,true].map((imageGroup) => <fieldset key={String(imageGroup)} className={styles.metricChoices}>
      <legend>{imageGroup ? "영상 분석 · 단독 선택" : "공간 관측 · 복수 선택"}</legend>
      {Object.entries(OBSERVATION_METRICS).filter(([id])=>isImageObservationMetric(id) === imageGroup).map(([id,[label]]) =>
        <label key={id} className={styles.check}><input type="checkbox" checked={values.includes(id)}
          disabled={!values.includes(id) && (image || (imageGroup && values.length > 0))}
          onChange={(event)=>onChange(event.target.checked ? [...values,id] : values.filter((value)=>value !== id))} />{label}</label>)}
    </fieldset>)}
    <p className={styles.help}>게이지·스위치 등 영상 분석은 비전 텍스처에 연결된 평면 영역을 사용합니다. 다른 항목으로 바꾸려면 현재 선택을 먼저 해제하세요.</p>
  </div>;
}
