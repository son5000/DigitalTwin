import { useState } from "react";
import ObservationMetricChoices from "./ObservationMetricChoices.jsx";
import { OBSERVATION_METRICS } from "../model/observationMetrics.js";
import { createId } from "../model/equipmentDetailModel.js";
import { isImageObservationMetric } from "../model/imageObservation.js";
import { observationTextureKind } from "../model/observationSource.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ObservationCreationFields({ equipment, sensors, onPlace }) {
  const [metrics,setMetrics] = useState([]), [type,setType] = useState("SPHERE");
  const image = metrics.some(isImageObservationMetric);
  const textureKind = observationTextureKind(metrics.map((metric) => ({ metric })));
  const available = !textureKind || sensors.some((s) => s.equipmentIds?.includes(equipment.id)
    && s.textureProjection?.enabled && (s.textureProjection.kind ?? "VISION") === textureKind);
  function place() {
    onPlace({ geometryType:image ? "PLANE" : type, textureKind,
      measurements:metrics.map((metric)=>({ id:createId("ROI_VALUE"), name:OBSERVATION_METRICS[metric][0], metric,
        unit:OBSERVATION_METRICS[metric][1], sensorId:"", visible:true, rules:[] })) });
  }
  return <fieldset className={styles.settingsGroup}>
    <legend>새 관측 영역</legend>
    <strong>1. 관측할 항목</strong>
    <ObservationMetricChoices values={metrics} onChange={setMetrics} />
    {!!metrics.length && <>
      <label className={styles.field}><span>2. 영역 형태</span><select value={image ? "PLANE" : type} disabled={image} onChange={(e)=>setType(e.target.value)}>
        <option value="SPHERE">구체 · 3차원 범위</option><option value="PLANE">평면 · 사각 영역</option>
      </select></label>
      <p className={styles.help}>{textureKind ? `${image ? "비전" : "열화상"} 텍스처가 표시된 부분을 클릭하면 해당 카메라가 자동으로 연결됩니다.` : "설비 기준 위치로 관측합니다. 초음파 센서를 개별 연결하지 않습니다."}</p>
      {!available && <p className={styles.requirements}>3단계에서 {image ? "비전" : "열화상"} 카메라의 텍스처를 먼저 설정하세요.</p>}
      <button type="button" className={styles.primaryAction} disabled={!available} onClick={place}>{textureKind ? `${image ? "비전" : "열화상"} 텍스처 위에 영역 지정` : "모델 위에 영역 지정"}</button>
    </>}
  </fieldset>;
}
