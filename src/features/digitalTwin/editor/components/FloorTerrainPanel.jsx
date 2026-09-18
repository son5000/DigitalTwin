import { useState } from "react";
import TerrainEditorPanel from "./TerrainEditorPanel";
import { GROUND_VIEW_MODES } from "../model/undergroundModel";
import styles from "./TerrainEditorPanel.module.css";

export default function FloorTerrainPanel({ floor, floors, environment, brush, gridCellSize, onBrushChange, onEnvironmentChange, onApplyRange, groundViewMode, onGroundViewModeChange, areaSelection, onAreaSelectionChange }) {
  const [startId, setStartId] = useState(floor.id);
  const [endId, setEndId] = useState(floor.id);
  const [message, setMessage] = useState("");
  return <>
    <p className={styles.help}>{floor.name}의 부지를 편집합니다. 높이는 해당 층 바닥 기준 상대 높이입니다.</p>
    <TerrainEditorPanel environment={environment} brush={brush} gridCellSize={gridCellSize} onBrushChange={onBrushChange} onEnvironmentChange={onEnvironmentChange} areaSelection={areaSelection} onAreaSelectionChange={onAreaSelectionChange} />
    <div className={styles.panel}>
      <label className={styles.selectField}><span>부지 표시</span><select value={groundViewMode} onChange={(event) => onGroundViewModeChange(event.target.value)}>
        <option value={GROUND_VIEW_MODES.VISIBLE}>표시</option><option value={GROUND_VIEW_MODES.TRANSLUCENT}>반투명</option><option value={GROUND_VIEW_MODES.SECTION}>지하 단면</option><option value={GROUND_VIEW_MODES.HIDDEN}>숨김</option>
      </select></label>
      <div className={styles.section}>
        <p className={styles.help}>현재 층의 부지 모양·색상·고도를 선택한 층 범위에 일괄 적용합니다.</p>
        {[["시작 층", startId, setStartId], ["끝 층", endId, setEndId]].map(([label, value, change]) => <label className={styles.selectField} key={label}><span>{label}</span>
          <select value={value} onChange={(event) => { change(event.target.value); setMessage(""); }}>{floors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        </label>)}
        <div className={styles.segmented}><button type="button" onClick={() => { onApplyRange(startId, endId); setMessage("선택한 층 범위에 부지 설정을 적용했습니다."); }}>층 범위에 일괄 적용</button></div>
        <p className={styles.help} role="status">{message}</p>
      </div>
    </div>
  </>;
}
