import { ENCLOSURE_WALLS, getEnclosure, getEnclosureDoor, getEnclosureDoorLabel, getEnclosureScanSlot, resizeEnclosureDoor } from "../model/equipmentEnclosure";
import NumericField from "./NumericField";
import { getEquipmentModelMode } from "../model/equipmentSetup.js";
import styles from "./MonitoringSettingsPanel.module.css";


function DoorSetFields({ equipment, side, onChange, onSizeChange }) {
  const enclosure = getEnclosure(equipment), c = side === "REAR" ? enclosure.rear : enclosure;
  const stacked = c.doorLayout === "STACKED";
  function doorChange(index, changes) { onChange({ doors: c.doors.map((door, i) => i === index ? { ...door, ...changes } : door) }); }
  return <fieldset className={styles.settingsGroup}><legend>{side === "REAR" ? "뒷면 문" : "앞면 문"}</legend>
    <label className={styles.field}><span>문 수</span><select value={c.doorCount} onChange={(event) => { const doorCount = Number(event.target.value); onChange({ doorCount, doorRatios: null, stackOrder: doorCount > 2 ? "BOTTOM_UP" : c.stackOrder }); }}>{Array.from({ length: 6 }, (_, count) => <option value={count} key={count}>{count === 0 ? "문 없음" : `${count}개`}</option>)}</select></label>
    {c.doorCount > 1 && <><label className={styles.field}><span>문 배치</span><select value={c.doorLayout} onChange={(event) => onChange({ doorLayout: event.target.value, doorRatios: null, stackOrder: c.doorCount > 2 && event.target.value === "STACKED" ? "BOTTOM_UP" : c.stackOrder })}><option value="SIDE_BY_SIDE">좌우로 배치</option><option value="STACKED">아래에서 위로 배치</option></select></label><p className={styles.help}>{stacked ? "층별 높이를 바꾸면 다른 층 높이는 유지되고 외관 전체 높이가 맞춰집니다." : "문 가로폭을 바꾸면 이웃한 문의 폭이 맞춰집니다."}</p></>}
    {stacked && c.doorCount > 1 && <div className={styles.drawerHeightGrid} role="group" aria-label={`${side === "REAR" ? "뒷면" : "앞면"} 층별 높이`}>
      {c.doors.slice(0, c.doorCount).map((_, index) => <NumericField key={index} displayPrecision={1} label={`${getEnclosureDoorLabel(c, index)} 내부 높이`} unit="cm" value={(getEnclosureScanSlot(equipment, index, side)?.dimensions.height ?? 0) * 100} min={1} step={.1} onChange={(value) => onSizeChange(side, index, value / 100)} />)}
    </div>}
    {c.doors.slice(0, c.doorCount).map((door, index) => <details className={styles.settingsGroup} key={index}><summary>{getEnclosureDoorLabel(c, index)} · {door.open ? "열림" : "닫힘"}</summary>
      {c.doorCount > 1 && !stacked && <NumericField displayPrecision={1} label="가로" unit="cm" value={getEnclosureDoor(equipment, index, side).width * 100} min={1} step={.1} onChange={(value) => onSizeChange(side, index, value / 100)} />}
      <label className={styles.field}><span>경첩 위치 · 해당 면을 바라본 기준</span><select value={door.hinge} onChange={(event) => doorChange(index, { hinge: event.target.value })}><option value="LEFT">왼쪽</option><option value="RIGHT">오른쪽</option><option value="TOP">위쪽</option><option value="BOTTOM">아래쪽</option></select></label>
      <label className={styles.field}><span>열리는 쪽</span><select value={door.swing} onChange={(event) => doorChange(index, { swing: event.target.value })}><option value="OUTWARD">캐비넷 바깥쪽</option><option value="INWARD">캐비넷 안쪽</option></select></label>
      <NumericField displayPrecision={2} label="열림 각도" unit="°" value={door.angle} min={0} step={1} onChange={(value) => doorChange(index, { angle: Math.min(180, Math.max(0, value)) })} />
      <div className={styles.actionRow}><button type="button" aria-pressed={!door.open} onClick={() => doorChange(index, { open: false })}>닫힘</button><button type="button" aria-pressed={door.open} onClick={() => doorChange(index, { open: true })}>열림</button></div>
      <label className={styles.check}><input type="checkbox" checked={door.hideWhenOpen} onChange={(event) => doorChange(index, { hideWhenOpen: event.target.checked })} />열었을 때 문 숨기기</label>
    </details>)}
  </fieldset>;
}

export default function EquipmentEnclosureFields({ equipment, bindings = [], onUpdateEquipment, onUpdateAsset, onEquipmentRepresentationChange }) {
  const c = getEnclosure(equipment);
  const mode = getEquipmentModelMode(equipment, bindings);
  function update(changes) { onUpdateEquipment({ enclosure: { ...equipment.enclosure, ...changes } }); }
  function resizeDoor(side, index, value) {
    const changes = resizeEnclosureDoor(equipment, side, index, value);
    if (changes) update(changes);
  }
  function composition(value) {
    for (const item of bindings) onUpdateAsset(item.id, { displayMode: value === "SHAPE" ? "PROXY" : value === "BOTH" ? "COMPARE" : "ACTUAL", includeProxy: value === "BOTH" });
    onUpdateEquipment({ metadata: { modelComposition: value, detailSetup: {
      ...equipment.metadata?.detailSetup,
      steps: { ...equipment.metadata?.detailSetup?.steps, ...(value === "BOTH" && mode !== "BOTH" ? { SCAN: "PENDING" } : {}) },
    } } });
    onEquipmentRepresentationChange(equipment.id, value === "SHAPE" ? "SIMPLIFIED" : "DETAILED");
  }
  return <fieldset className={styles.settingsGroup} data-setup-field="model-size">
    <legend>표시할 모델</legend>
    <label className={styles.field}><span>모델 구성</span><select value={mode} onChange={(event) => composition(event.target.value)}>
      <option value="SCAN">스캔</option><option value="SHAPE">외관 도형</option><option value="BOTH">스캔 + 외관 도형</option>
    </select></label>
    <p className={styles.help}>{mode === "BOTH" ? "먼저 외관과 문을 구성한 뒤 2.5단계에서 각 문 내부의 스캔을 연결하세요." : mode === "SCAN" ? "이 단계에서 스캔 파일의 크기와 위치를 맞추세요." : "외관 도형의 구조와 문을 설정하세요."}</p>
    {["BOTH", "SHAPE"].includes(mode) && <>
      <h4 className={styles.subsectionTitle}>외관 구조와 크기</h4>
      <label className={styles.field}><span>외관 형태</span><select value={c.enabled ? "CABINET" : "EXISTING"} onChange={(event) => update({ enabled: event.target.value === "CABINET" })}><option value="EXISTING">기존 설비 도형</option><option value="CABINET">캐비넷 · 벽과 문 구성</option></select></label>
      {c.enabled && <>
        <label className={styles.field}><span>캐비넷 구조</span><select value={c.bodyLayout} onChange={(event) => update({ bodyLayout: event.target.value,
          ...(event.target.value === "BACK_TO_BACK" && !c.rear.doorCount ? { rear: { ...c.rear, doorCount: 1 } } : {}) })}><option value="SINGLE">한 공간 · 앞뒤 연결</option><option value="BACK_TO_BACK">앞뒤 두 공간 · 가운데 칸막이</option></select></label>
        {c.bodyLayout === "BACK_TO_BACK" && <label className={styles.field}><span>앞쪽 공간 깊이 · {Math.round(c.frontDepthRatio * 100)}%</span><input type="range" min=".05" max=".95" step=".05" value={c.frontDepthRatio} onChange={(event) => update({ frontDepthRatio: Number(event.target.value) })} /></label>}
        <h4 className={styles.subsectionTitle}>외관 크기</h4>
        <div className={styles.axisGrid}>{[["width", "가로 X"], ["height", "높이 Y"], ["depth", "깊이 Z"]].map(([key, label]) => <NumericField displayPrecision={1} key={key} label={label} unit="cm" value={c[key] * 100} min={5} step={.1} onChange={(value) => update({ [key]: Math.max(.05, value / 100) })} />)}</div>
        <NumericField displayPrecision={2} label="판 두께" unit="cm" value={c.thickness * 100} min={.1} step={.1} onChange={(value) => update({ thickness: Math.max(.001, value / 100) })} />
        <div className={styles.checkGrid}>{Object.entries(ENCLOSURE_WALLS).filter(([id]) => !(id === "front" && c.doorCount) && !(id === "back" && c.rear.doorCount)).map(([id, label]) => <label className={styles.check} key={id}><input type="checkbox" checked={c.walls[id]} onChange={(event) => update({ walls: { ...c.walls, [id]: event.target.checked } })} />{label}</label>)}</div>
        <h4 className={styles.subsectionTitle}>문 구성</h4>
        <DoorSetFields equipment={equipment} side="FRONT" onChange={update} onSizeChange={resizeDoor} />
        <DoorSetFields equipment={equipment} side="REAR" onChange={(changes) => update({ rear: { ...c.rear, ...changes } })} onSizeChange={resizeDoor} />
        <h4 className={styles.subsectionTitle}>외관 표시</h4>
        <label className={styles.field}><span>외관 색상</span><input type="color" value={c.color} onChange={(event) => update({ color: event.target.value })} /></label>
        <label className={styles.field}><span>불투명도 · {Math.round(c.opacity * 100)}%</span><input type="range" min=".05" max="1" step=".05" value={c.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
        {(c.doorCount > 0 || c.rear.doorCount > 0) && <><label className={styles.check}><input type="checkbox" checked={c.interactive} onChange={(event) => update({ interactive: event.target.checked })} />화면에서 문 열기·닫기 허용</label><p className={styles.help}>설정한 상태로 시작합니다. 문을 숨겨도 센서는 열린 문을 따라갑니다.</p></>}
      </>}
    </>}
  </fieldset>;
}
