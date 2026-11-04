import NumericField from "./NumericField.jsx";
import { imageObservationIssue, resolveImageObservation } from "../model/imageObservation.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ImageObservationFields({ point, equipment, sensors, onChange }) {
  const resolved = resolveImageObservation(point,equipment,sensors);
  const issue = imageObservationIssue(point,equipment,sensors), rect = point.imageBinding?.sourceRect;
  return <fieldset className={styles.settingsGroup} data-setup-field="roi-image-binding">
    <legend>비전 이미지에 연결된 영역</legend>
    <p className={styles.help}>3D 화면에서 영역을 선택해 이동할 수 있습니다. 카메라 영상 밖으로는 옮길 수 없습니다. 위치와 크기는 사진의 왼쪽 위를 기준으로 저장됩니다.</p>
    {point.imageBinding && <p className={styles.help}>{sensors.find((s)=>s.id===point.imageBinding.sensorId)?.name ?? "연결 해제된 카메라"} · 원본 {point.imageBinding.originalImage?.width} × {point.imageBinding.originalImage?.height}px</p>}
    {rect && <div className={styles.rangeGrid}>{[["x","왼쪽"],["y","위쪽"],["width","가로"],["height","세로"]].map(([key,label])=><NumericField displayPrecision={1} key={key} label={label} unit="%" min={key === "width" || key === "height" ? .01 : 0} max={100} step={.1} value={rect[key]*100}
      onChange={(value)=>{ const binding = { ...point.imageBinding }; delete binding.sourceQuad; onChange(point.id,{imageBinding:{...binding,sourceRect:{...rect,[key]:value/100}}}); }} />)}</div>}
    {issue && <p role="alert" className={styles.requirements}>{issue}</p>}
    <p className={styles.help}>이 영역을 촬영한 카메라가 자동으로 연결됩니다. 다른 카메라 영상으로 바꾸려면 영역을 다시 그리세요.</p>
    {resolved.imageAnalysis && <details><summary>카메라 원본에서의 위치</summary><p className={styles.help}>원본 사진의 왼쪽 위부터 각 모서리의 위치를 표시합니다.</p>
      <ol className={styles.coordinateList}>{resolved.imageAnalysis.source.pixels?.map(([x,y],i)=><li key={i}>X {x.toFixed(2)} · Y {y.toFixed(2)}px</li>)}</ol>
    </details>}
  </fieldset>;
}
