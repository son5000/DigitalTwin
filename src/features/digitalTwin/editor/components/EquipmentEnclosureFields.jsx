import { ENCLOSURE_WALLS, getEnclosure, getEnclosureDoor, getEnclosureDoorLabel } from "../model/equipmentEnclosure";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";


function DoorSetFields({ equipment, side, onChange }) {
  const enclosure = getEnclosure(equipment), c = side === "REAR" ? enclosure.rear : enclosure;
  const stacked = c.doorLayout === "STACKED";
  function doorChange(index, changes) { onChange({ doors: c.doors.map((door, i) => i === index ? { ...door, ...changes } : door) }); }
  function sizeChange(index, value) {
    const span = (stacked ? enclosure.height : enclosure.width) - 2 * enclosure.thickness;
    const size = Math.max(.001, Math.min(span - .001, value));
    onChange({ [stacked ? "upperDoorRatio" : "leftDoorRatio"]: (index === 0 ? size : span - size) / span });
  }
  return <fieldset className={styles.settingsGroup}><legend>{side === "REAR" ? "뒷면 문" : "앞면 문"}</legend>
    <label className={styles.field}><span>문 구성</span><select value={c.doorCount} onChange={(event) => onChange({ doorCount: Number(event.target.value) })}><option value={0}>문 없음</option><option value={1}>한 짝</option><option value={2}>두 짝</option></select></label>
    {c.doorCount === 2 && <><label className={styles.field}><span>문 배치</span><select value={c.doorLayout} onChange={(event) => onChange({ doorLayout: event.target.value })}><option value="SIDE_BY_SIDE">좌우 두 짝</option><option value="STACKED">위아래 두 짝</option></select></label><p className={styles.help}>한쪽 크기를 바꾸면 나머지가 맞춰집니다.</p></>}
    {c.doors.slice(0, c.doorCount).map((door, index) => <fieldset className={styles.settingsGroup} key={index}><legend>{getEnclosureDoorLabel(c, index)}</legend>
      {c.doorCount === 2 && <NumericField displayPrecision={2} label={stacked ? "높이" : "가로"} unit="m" value={getEnclosureDoor(equipment, index, side)[stacked ? "height" : "width"]} min={.001} step={.01} onChange={(value) => sizeChange(index, value)} />}
      <label className={styles.field}><span>경첩 위치 · 해당 면을 바라본 기준</span><select value={door.hinge} onChange={(event) => doorChange(index, { hinge: event.target.value })}><option value="LEFT">왼쪽</option><option value="RIGHT">오른쪽</option><option value="TOP">위쪽</option><option value="BOTTOM">아래쪽</option></select></label>
      <label className={styles.field}><span>열리는 쪽</span><select value={door.swing} onChange={(event) => doorChange(index, { swing: event.target.value })}><option value="OUTWARD">캐비넷 바깥쪽</option><option value="INWARD">캐비넷 안쪽</option></select></label>
      <NumericField displayPrecision={2} label="열림 각도" unit="°" value={door.angle} min={0} step={1} onChange={(value) => doorChange(index, { angle: Math.min(180, Math.max(0, value)) })} />
      <div className={styles.actionRow}><button type="button" aria-pressed={!door.open} onClick={() => doorChange(index, { open: false })}>닫힘</button><button type="button" aria-pressed={door.open} onClick={() => doorChange(index, { open: true })}>열림</button></div>
      <label className={styles.check}><input type="checkbox" checked={door.hideWhenOpen} onChange={(event) => doorChange(index, { hideWhenOpen: event.target.checked })} />열었을 때 문 숨기기</label>
    </fieldset>)}
  </fieldset>;
}

export default function EquipmentEnclosureFields({ equipment, binding, onUpdateEquipment, onUpdateAsset, onEquipmentRepresentationChange }) {
  const c = getEnclosure(equipment);
  const mode = !binding || binding.displayMode === "PROXY" ? "SHAPE" : binding.includeProxy || binding.displayMode === "COMPARE" ? "BOTH" : "SCAN";
  function update(changes) { onUpdateEquipment({ enclosure: { ...equipment.enclosure, ...changes } }); }
  function composition(value) {
    if (binding) onUpdateAsset(binding.id, { displayMode: value === "SHAPE" ? "PROXY" : value === "BOTH" ? "COMPARE" : "ACTUAL", includeProxy: value === "BOTH" });
    onEquipmentRepresentationChange(equipment.id, value === "SHAPE" ? "SIMPLIFIED" : "DETAILED");
  }
  return <fieldset className={styles.settingsGroup}>
    <legend>모델 구성·외관</legend>
    <label className={styles.field}><span>표시할 모델</span><select value={mode} onChange={(event) => composition(event.target.value)}>
      <option value="SCAN" disabled={!binding}>스캔</option><option value="SHAPE">외관 도형</option><option value="BOTH" disabled={!binding}>스캔 + 외관 도형</option>
    </select></label>
    <p className={styles.help}>내부만 스캔했다면 외관 도형을 함께 사용하세요. 관제 화면에도 적용됩니다.</p>
    {["BOTH", "SHAPE"].includes(mode) && <>
      <label className={styles.field}><span>외관 형태</span><select value={c.enabled ? "CABINET" : "EXISTING"} onChange={(event) => update({ enabled: event.target.value === "CABINET" })}><option value="EXISTING">기존 설비 도형</option><option value="CABINET">캐비넷 · 벽과 문 구성</option></select></label>
      {c.enabled && <>
        <h4 className={styles.subsectionTitle}>외관 크기</h4>
        <div className={styles.axisGrid}>{[["width", "X축"], ["height", "Y축"], ["depth", "Z축"]].map(([key, label]) => <NumericField displayPrecision={2} key={key} label={label} unit="m" value={c[key]} min={.05} step={.01} onChange={(value) => update({ [key]: Math.max(.05, value) })} />)}</div>
        <NumericField displayPrecision={2} label="판 두께" unit="cm" value={c.thickness * 100} min={.1} step={.1} onChange={(value) => update({ thickness: Math.max(.001, value / 100) })} />
        <div className={styles.checkGrid}>{Object.entries(ENCLOSURE_WALLS).filter(([id]) => !(id === "front" && c.doorCount) && !(id === "back" && c.rear.doorCount)).map(([id, label]) => <label className={styles.check} key={id}><input type="checkbox" checked={c.walls[id]} onChange={(event) => update({ walls: { ...c.walls, [id]: event.target.checked } })} />{label}</label>)}</div>
        <label className={styles.field}><span>외관 색상</span><input type="color" value={c.color} onChange={(event) => update({ color: event.target.value })} /></label>
        <label className={styles.field}><span>불투명도 · {Math.round(c.opacity * 100)}%</span><input type="range" min=".05" max="1" step=".05" value={c.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
        <DoorSetFields equipment={equipment} side="FRONT" onChange={update} />
        <DoorSetFields equipment={equipment} side="REAR" onChange={(changes) => update({ rear: { ...c.rear, ...changes } })} />
        {(c.doorCount > 0 || c.rear.doorCount > 0) && <><label className={styles.check}><input type="checkbox" checked={c.interactive} onChange={(event) => update({ interactive: event.target.checked })} />화면에서 문 열기·닫기 허용</label><p className={styles.help}>설정한 상태로 시작합니다. 문을 숨겨도 센서는 열린 문을 따라갑니다.</p></>}
      </>}
    </>}
  </fieldset>;
}
