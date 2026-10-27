import NumericField from "./NumericField";
import { HEATMAP_PALETTES, HEATMAP_STYLES, normalizeHeatmap } from "../model/sensorHeatmap.js";
import { getEquipmentCoordinateFrame, modelToReference, referenceToModel } from "../model/equipmentCoordinateFrame.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorHeatmapFields({ sensor, equipment, onChange, controller }) {
  const config = normalizeHeatmap(sensor.heatmap);
  const frame = getEquipmentCoordinateFrame(equipment);
  const position = modelToReference(config.position, frame);
  const update = (changes) => onChange(sensor.id, { heatmap: { equipmentId: equipment.id, ...changes } });
  return <fieldset className={styles.settingsGroup}>
    <legend>초음파 소음 위치 · 히트맵</legend>
    <p className={styles.help}>백엔드에서 받은 소음 발생 좌표에 표시할 모양을 설정합니다. 크기는 표시 반경이며 실제 소음 범위나 측정값이 아닙니다.</p>
    <div className={styles.rangeGrid}>
      <NumericField label="표시 반경" unit="m" min={.01} max={10} step={.01} value={config.radius} onChange={(radius) => update({ radius })} />
      <label className={styles.field}><span>디자인</span><select value={config.style} onChange={(event) => update({ style: event.target.value })}>{Object.entries(HEATMAP_STYLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <label className={styles.field}><span>색상</span><select value={config.palette} onChange={(event) => update({ palette: event.target.value })}>{Object.entries(HEATMAP_PALETTES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
    <div className={styles.heatmapLegend} style={{ background: `linear-gradient(to right, ${HEATMAP_PALETTES[config.palette].colors.join(",")})` }} role="img" aria-label="외곽에서 중심으로 히트맵 색상" />
    <small className={styles.help}>외곽 → 중심 · 색상은 거리 기반 표시 효과이며 dB 척도가 아닙니다.</small>
    <label className={styles.field}><span>불투명도 · {Math.round(config.opacity * 100)}%</span><input type="range" min=".1" max="1" step=".05" value={config.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
    <NumericField label="중심 집중도" min={.3} max={4} step={.1} value={config.falloff} onChange={(falloff) => update({ falloff })} />
    <fieldset className={styles.settingsGroup}><legend>샘플 미리보기 · 실측 아님</legend>
      <label className={styles.check}><input type="checkbox" checked={config.preview} onChange={(event) => update({ preview: event.target.checked })} />선택한 센서의 샘플을 월드에 표시</label>
      <button type="button" onClick={() => controller?.current?.placeHeatmap(sensor.id, (point, normal) => update({ position: point, normal, preview: true }))}>모델에서 샘플 위치 지정</button>
      <p className={styles.help}>모델 표면을 클릭하면 해당 면의 방향으로 표시합니다. 샘플은 센서 설정 단계에서만 보이며 관제 데이터로 전송하지 않습니다.</p>
      <details className={styles.transformDetails}><summary>샘플 좌표·방향 직접 입력</summary>
        <p className={styles.help}>{frame ? `설비 기준좌표 v${frame.version}` : "모델 좌표"} · m</p>
        <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`샘플 ${axis.toUpperCase()}`} unit="m" step={.01} value={position[axis]} onChange={(value) => update({ position: referenceToModel({ ...position, [axis]: value }, frame) })} />)}</div>
        <div className={styles.actionRow}>{[["정면", { x: 0, y: 0, z: 1 }], ["윗면", { x: 0, y: 1, z: 0 }], ["옆면", { x: 1, y: 0, z: 0 }]].map(([label, normal]) => <button key={label} type="button" onClick={() => update({ normal })}>{label}</button>)}</div>
      </details>
    </fieldset>
  </fieldset>;
}
