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
        <option value="SPHERE">입체 범위</option><option value="PLANE">평면 사각형</option>
      </select></label>
      <p className={styles.help}>{textureKind ? `${image ? "카메라 영상" : "열화상 영상"}이 보이는 부분을 선택하면 촬영한 카메라가 자동으로 연결됩니다.` : "선택한 위치에서 수신되는 값을 확인합니다. 센서를 따로 고를 필요는 없습니다."}</p>
      {!available && <p className={styles.requirements}>3단계에서 {image ? "비전" : "열화상"} 카메라 영상을 먼저 설정하세요.</p>}
      <button type="button" className={styles.primaryAction} disabled={!available} onClick={place}>{textureKind ? `${image ? "카메라" : "열화상"} 영상에서 영역 지정` : "설비 위에 영역 지정"}</button>
    </>}
  </fieldset>;
}
