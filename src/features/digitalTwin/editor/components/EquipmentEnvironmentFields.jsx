import { normalizeEquipmentEnvironment } from "../model/viewerPreset";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

export default function EquipmentEnvironmentFields({ equipmentId, viewerPreset, onChange }) {
  const saved = viewerPreset?.equipmentEnvironments?.[equipmentId];
  const value = normalizeEquipmentEnvironment(saved);
  const update = (changes) => onChange({ equipmentEnvironments: { ...viewerPreset?.equipmentEnvironments, [equipmentId]: { ...value, ...changes } } });
  return <fieldset className={styles.settingsGroup} id="equipment-environment-settings"><legend>6. 배경·지면 · 설비별 설정</legend>
    <p className={styles.help}>이 설비의 배경과 지면을 설정하세요. 프로젝트 저장 후 관제 화면에도 적용됩니다.</p>
    <div className={styles.rangeGrid}>{[["backgroundColor", "월드 배경색"], ["groundColor", "지면 색상"], ["gridColor", "격자 색상"]].map(([key, label]) => <label key={key} className={styles.field}><span>{label}</span><input type="color" value={value[key]} onChange={(event) => update({ [key]: event.target.value })} /><span>{value[key]}</span></label>)}</div>
    <label className={styles.field}><span>지면 표현 방식</span><select value={value.groundMode} onChange={(event) => update({ groundMode: event.target.value })}><option value="VISIBLE">불투명 지면</option><option value="TRANSLUCENT">반투명 지면</option><option value="SECTION">절반 단면</option><option value="HIDDEN">지면 숨김</option></select></label>
    {value.groundMode === "TRANSLUCENT" && <label className={styles.field}><span>지면 불투명도 · {Math.round(value.groundOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={value.groundOpacity} onChange={(event) => update({ groundOpacity: Number(event.target.value) })} /></label>}
    <div className={styles.rangeGrid}><NumericField displayPrecision={2} label="지면 한 변 길이" unit="m" min={0.1} value={value.groundSize} onChange={(groundSize) => update({ groundSize })} /><NumericField displayPrecision={2} label="지면 높이 Y" unit="m" value={value.groundHeight} onChange={(groundHeight) => update({ groundHeight })} /></div>
    <label className={styles.check}><input type="checkbox" checked={value.gridVisible} onChange={(event) => update({ gridVisible: event.target.checked })} />격자 표시 · 지면과 별도</label>
    <NumericField displayPrecision={2} label="격자 간격" unit="m" min={0.01} disabled={!value.gridVisible} value={value.gridSpacing} onChange={(gridSpacing) => update({ gridSpacing })} />
    <p className={styles.help}>지면을 숨겨도 격자는 표시할 수 있습니다.</p>
    <button type="button" disabled={!saved} onClick={() => onChange({ equipmentEnvironments: { ...viewerPreset?.equipmentEnvironments, [equipmentId]: null } })}>설비 전용 환경 해제</button>
  </fieldset>;
}
