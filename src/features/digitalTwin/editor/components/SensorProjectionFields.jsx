import { getEnclosureSurfaces } from "../model/equipmentEnclosure";
import { normalizeSensorProjection } from "../model/sensorProjection";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorProjectionFields({ sensor, equipment, onChange }) {
  const p = normalizeSensorProjection(sensor.textureProjection);
  const surfaces = getEnclosureSurfaces(equipment);
  const update = (changes) => onChange(sensor.id, { textureProjection: { ...p, ...changes } });
  return <fieldset className={styles.settingsGroup}><legend>관측 영상을 표면에 표시</legend>
    <label className={styles.check}><input type="checkbox" checked={p.enabled} onChange={(event) => update({ enabled: event.target.checked })} />영상·온도 분포 입히기</label>
    {p.enabled && <>
      <label className={styles.field}><span>표시할 데이터</span><select value={p.kind} onChange={(event) => update({ kind: event.target.value })}><option value="VISION">비전 영상</option><option value="THERMAL">열화상·온도 분포</option></select></label>
      <label className={styles.field}><span>적용할 모델</span><select value={p.target} onChange={(event) => update({ target: event.target.value, meshPath: null, meshName: "" })}><option value="ACTUAL">스캔</option><option value="PROXY">도형</option><option value="BOTH">스캔 + 도형</option></select></label>
      {p.target !== "ACTUAL" && <label className={styles.field}><span>도형 적용면</span><select value={p.surfaceId} onChange={(event) => update({ surfaceId: event.target.value })}><option value="">카메라에 보이는 면</option>{p.surfaceId && !surfaces.some((s) => s.id === p.surfaceId) && <option value={p.surfaceId}>적용면을 다시 선택하세요</option>}{surfaces.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
      {p.meshPath !== null && <p className={styles.help}>선택한 스캔 부분: {p.meshName || "이름 없음"} <button type="button" onClick={() => update({ meshPath: null, meshName: "" })}>전체로 변경</button></p>}
      <p className={styles.help}>3D 화면의 ‘영상 적용면 선택’으로 부분을 고르세요. 센서의 방향·화각·관측 거리에 맞춰 표시됩니다.</p>
      <label className={styles.field}><span>영상 불투명도 · {Math.round(p.opacity * 100)}%</span><input type="range" min="0" max="1" step=".01" value={p.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
      <div className={styles.rangeGrid}>{[["scaleX", "가로 늘림", .05, .05], ["scaleY", "세로 늘림", .05, .05], ["offsetX", "좌우 이동", -2, .01], ["offsetY", "상하 이동", -2, .01], ["rotation", "영상 회전", -180, 1]].map(([key, label, min, step]) => <NumericField key={key} label={label} value={p[key]} min={min} step={step} unit={key === "rotation" ? "°" : undefined} onChange={(value) => update({ [key]: value })} />)}</div>
      <div className={styles.actionRow}><button type="button" onClick={() => update({ scaleX: p.scaleX * 1.1, scaleY: p.scaleY * 1.1 })}>확대</button><button type="button" onClick={() => update({ scaleX: p.scaleX / 1.1, scaleY: p.scaleY / 1.1 })}>축소</button><button type="button" onClick={() => update({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 })}>맞춤 초기화</button></div>
      <details><summary>영상 잘라내기</summary><div className={styles.rangeGrid}>{[["cropX", "왼쪽 시작"], ["cropY", "아래쪽 시작"], ["cropWidth", "사용 가로"], ["cropHeight", "사용 세로"]].map(([key, label]) => <NumericField key={key} label={label} unit="%" value={p[key] * 100} min={0} step={1} onChange={(value) => update({ [key]: value / 100 })} />)}</div></details>
      {p.kind === "THERMAL" && <><div className={styles.rangeGrid}><NumericField label="낮은 온도" unit="°C" value={p.temperatureMin} onChange={(value) => update({ temperatureMin: value })} /><NumericField label="높은 온도" unit="°C" value={p.temperatureMax} onChange={(value) => update({ temperatureMax: value })} /></div><p className={styles.help}>온도 배열을 받으면 낮은 온도는 파랑, 높은 온도는 빨강으로 표시합니다. 열화상 이미지는 받은 색상으로 표시합니다.</p>{p.temperatureMax <= p.temperatureMin && <p role="alert">높은 온도를 낮은 온도보다 크게 입력하세요.</p>}</>}
    </>}
  </fieldset>;
}
