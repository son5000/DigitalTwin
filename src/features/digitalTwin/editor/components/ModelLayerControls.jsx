import styles from "./ModelLayerControls.module.css";

export default function ModelLayerControls({ value = {}, onChange, hasScan, scanDefault = true, shapeDefault = true, shapeOpacity = 1 }) {
  return <details className={styles.controls} data-camera-safe-ui>
    <summary>모델 표시</summary>
    {[["ACTUAL", "스캔", hasScan, scanDefault, 1], ["PROXY", "도형", true, shapeDefault, shapeOpacity]].map(([key, label, available, visible, opacity]) => available && <div key={key} className={styles.row}>
      <label><input type="checkbox" checked={value[key]?.visible ?? visible} onChange={(event) => onChange({ ...value, [key]: { ...value[key], visible: event.target.checked } })} />{label}</label>
      <label><span>불투명도 {Math.round((value[key]?.opacity ?? opacity) * 100)}%</span><input aria-label={`${label} 불투명도`} type="range" min="0" max="100" step="1" value={Math.round((value[key]?.opacity ?? opacity) * 100)} onChange={(event) => onChange({ ...value, [key]: { ...value[key], opacity: Number(event.target.value) / 100 } })} /></label>
    </div>)}
  </details>;
}
