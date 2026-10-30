import NumericField from "./NumericField.jsx";
import { imageObservationIssue, resolveImageObservation } from "../model/imageObservation.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ImageObservationFields({ point, equipment, sensors, onChange }) {
  const resolved = resolveImageObservation(point,equipment,sensors);
  const issue = imageObservationIssue(point,equipment,sensors), rect = point.imageBinding?.sourceRect;
  return <fieldset className={styles.settingsGroup} data-setup-field="roi-image-binding">
    <legend>비전 이미지에 연결된 영역</legend>
    <p className={styles.help}>월드에서 영역을 선택하고 이동 화살표를 드래그할 수 있습니다. 이미지를 벗어난 이동은 취소됩니다. 위치와 크기는 왼쪽 위를 기준으로 원본 이미지에 저장되며, 아래 표시만 소수점 한 자리로 줄입니다.</p>
    {point.imageBinding && <p className={styles.help}>{sensors.find((s)=>s.id===point.imageBinding.sensorId)?.name ?? "연결 해제된 카메라"} · 원본 {point.imageBinding.originalImage?.width} × {point.imageBinding.originalImage?.height}px</p>}
    {rect && <div className={styles.rangeGrid}>{[["x","왼쪽"],["y","위쪽"],["width","가로"],["height","세로"]].map(([key,label])=><NumericField displayPrecision={1} key={key} label={label} unit="%" min={key === "width" || key === "height" ? .01 : 0} max={100} step={.1} value={rect[key]*100}
      onChange={(value)=>onChange(point.id,{imageBinding:{...point.imageBinding,sourceRect:{...rect,[key]:value/100}}})} />)}</div>}
    {issue && <p role="alert" className={styles.requirements}>{issue}</p>}
    <p className={styles.help}>카메라는 선택한 텍스처에서 자동 연결됩니다. 연결을 바꾸려면 ‘월드에서 영역 다시 지정’을 사용하세요.</p>
    {resolved.imageAnalysis && <details><summary>백엔드 분석 좌표</summary><p className={styles.help}>가공 전 원본 이미지 · 왼쪽 위 원점 · 좌상/우상/우하/좌하 순서</p>
      <ol className={styles.coordinateList}>{resolved.imageAnalysis.source.pixels?.map(([x,y],i)=><li key={i}>X {x.toFixed(2)} · Y {y.toFixed(2)}px</li>)}</ol>
    </details>}
  </fieldset>;
}
