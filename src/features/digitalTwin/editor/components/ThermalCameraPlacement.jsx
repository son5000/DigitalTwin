import { useState } from "react";
import { estimateVerticalFov } from "../model/thermalFrame";
import NumericField from "./NumericField";
import SensorMountFields from "./SensorMountFields";
import styles from "./MonitoringSettingsPanel.module.css";

export default function ThermalCameraPlacement({ sensor, equipment, onChange, cameraController, workspaceController }) {
  const [message, setMessage] = useState("");
  const [height, setHeight] = useState(2);
  const [distance, setDistance] = useState(3);
  const estimate = estimateVerticalFov(height, distance);
  const update = (changes) => onChange(sensor.id, changes);
  return <fieldset className={styles.settingsGroup}><legend>카메라 설치 위치·화각 맞추기</legend>
    <p className={styles.help}>열화상에 보이는 설비 모서리·부품과 3D 화면을 비교하세요. 한 장의 온도 이미지로 설치 위치가 자동 계산되지는 않습니다.</p>
    <div className={styles.actionRow}>
      <button type="button" onClick={() => {
        const placed = cameraController?.current?.placeSensorFromView?.(sensor.id);
        if (placed) workspaceController?.current?.setSensorView?.(sensor.id);
        setMessage(placed ? "현재 시점에 카메라를 배치했습니다. 이미지와 비교하며 위치·방향·화각을 조절하세요." : "설비 모델 로딩이 완료된 후 다시 시도하세요.");
      }}>현재 3D 시점에 카메라 배치</button>
      <button type="button" onClick={() => workspaceController?.current?.setSensorView?.(sensor.id)}>센서 정면 보기</button>
      <button type="button" onClick={() => workspaceController?.current?.setSensorView?.(null)}>자유 시점</button>
    </div>
    {message && <p role="status" className={styles.help}>{message}</p>}
    <details className={styles.transformDetails}><summary>설치 좌표·방향 미세 조정</summary>
      <SensorMountFields sensor={sensor} equipment={equipment} onChange={onChange} />
      <fieldset className={styles.settingsGroup}><legend>방향</legend><div className={styles.axisGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`${axis.toUpperCase()}축`} unit="°" displayPrecision={2} step={.1} value={(sensor.rotation?.[axis] ?? 0) * 180 / Math.PI} onChange={(value) => update({ rotation: { [axis]: value * Math.PI / 180 } })} />)}</div></fieldset>
    </details>
    <div className={styles.rangeGrid}>
      <NumericField label="세로 화각" unit="°" min={10} displayPrecision={2} value={sensor.fieldOfView} onChange={(value) => update({ fieldOfView: Math.max(10, Math.min(160, value)) })} />
      <NumericField label="종횡비" min={.2} displayPrecision={2} value={sensor.aspectRatio} onChange={(value) => update({ aspectRatio: Math.max(.2, value) })} />
      <NumericField label="근거리 기준" unit="m" min={.01} displayPrecision={2} value={sensor.near} onChange={(value) => update({ near: Math.max(.01, Math.min(sensor.far - .1, value)) })} />
      <NumericField label="투영 끝 거리" unit="m" min={.2} displayPrecision={2} value={sensor.far} onChange={(value) => update({ far: Math.max(sensor.near + .1, value) })} />
    </div>
    <p className={styles.help}>표면이 근거리 기준보다 가까우면 잘리지 않도록 표시 범위를 자동 조정합니다. 투영 끝 거리와 화각 밖에는 표시하지 않습니다.</p>
    <details className={styles.transformDetails}><summary>실측 치수로 화각 추정</summary>
      <p className={styles.help}>카메라가 평면을 정면으로 볼 때, 이미지 세로 전체에 해당하는 실제 높이와 카메라까지의 수직 거리를 입력하세요. 단위는 m입니다.</p>
      <div className={styles.rangeGrid}><NumericField label="화면 전체의 실제 높이" unit="m" min={.01} displayPrecision={2} value={height} onChange={setHeight} /><NumericField label="카메라와 평면 사이 거리" unit="m" min={.01} displayPrecision={2} value={distance} onChange={setDistance} /></div>
      <p className={styles.help}>추정 세로 화각 · {estimate ? `${estimate.toFixed(2)}°` : "양수를 입력하세요"}</p>
      <button type="button" disabled={!estimate || estimate < 10 || estimate > 160} onClick={() => update({ fieldOfView: estimate })}>추정 화각 적용</button>
    </details>
    <p className={styles.help}>설치 좌표·방향·화각과 색상·영상 보정값은 프로젝트 저장 시 함께 보관됩니다.</p>
  </fieldset>;
}
