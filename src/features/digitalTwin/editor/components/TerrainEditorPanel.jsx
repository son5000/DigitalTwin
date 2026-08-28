import NumericField from "./NumericField";
import {
  DEFAULT_TERRAIN_BRUSH,
  TERRAIN_BRUSH_SHAPES,
  TERRAIN_EDIT_TOOLS,
} from "@/features/digitalTwin/editor/terrain/TerrainEditor";
import { TERRAIN_MATERIALS } from "@/features/digitalTwin/editor/terrain/TerrainModel";

import styles from "./TerrainEditorPanel.module.css";

const TOOLS = [
  [TERRAIN_EDIT_TOOLS.RAISE, "올리기"],
  [TERRAIN_EDIT_TOOLS.LOWER, "낮추기"],
  [TERRAIN_EDIT_TOOLS.FLATTEN, "평탄화"],
  [TERRAIN_EDIT_TOOLS.SMOOTH, "다듬기"],
  [TERRAIN_EDIT_TOOLS.SET_HEIGHT, "높이 지정"],
  [TERRAIN_EDIT_TOOLS.SLOPE, "두 점 경사"],
];

const SHAPES = [
  [TERRAIN_BRUSH_SHAPES.CIRCLE, "원형"],
  [TERRAIN_BRUSH_SHAPES.SQUARE, "사각형"],
  [TERRAIN_BRUSH_SHAPES.FREE, "자유형"],
];

export default function TerrainEditorPanel({ environment, brush = DEFAULT_TERRAIN_BRUSH, onBrushChange, onEnvironmentChange }) {
  const terrain = environment.terrain;
  const changeBrush = (changes) => onBrushChange({ ...brush, ...changes });
  const changeTerrain = (changes) => onEnvironmentChange({ terrain: { ...terrain, ...changes } });
  return (
    <section className={styles.panel} aria-label="지형 고도 편집">
      <div className={styles.toolGrid} role="toolbar" aria-label="지형 편집 도구">
        {TOOLS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={brush.tool === id ? styles.active : ""}
            aria-pressed={brush.tool === id}
            onClick={() => changeBrush({ tool: id })}
          >{label}</button>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.segmented} role="group" aria-label="브러시 영역 형태">
          {SHAPES.map(([id, label]) => (
            <button key={id} type="button" className={brush.shape === id ? styles.active : ""} aria-pressed={brush.shape === id} onClick={() => changeBrush({ shape: id })}>{label}</button>
          ))}
        </div>
        <div className={styles.fieldGrid}>
          <NumericField label="브러시 크기" value={brush.size} min={1} max={80} step={1} unit="m" onChange={(size) => changeBrush({ size })} />
          <NumericField label="강도" value={brush.strength} min={0.05} max={2} step={0.05} onChange={(strength) => changeBrush({ strength })} />
          <NumericField label="감쇠" value={brush.falloff} min={0} max={1} step={0.05} onChange={(falloff) => changeBrush({ falloff })} />
          {[TERRAIN_EDIT_TOOLS.SET_HEIGHT, TERRAIN_EDIT_TOOLS.SLOPE].includes(brush.tool) ? (
            <NumericField label={brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? "종료 높이" : "목표 높이"} value={brush.targetHeight} min={-40} max={80} step={0.1} unit="m" onChange={(targetHeight) => changeBrush({ targetHeight, endHeight: targetHeight })} />
          ) : null}
          {brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? (
            <NumericField label="시작 높이" value={brush.startHeight ?? 0} min={-40} max={80} step={0.1} unit="m" onChange={(startHeight) => changeBrush({ startHeight })} />
          ) : null}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.selectField}>
          <span>지형 표면</span>
          <select value={terrain.material} onChange={(event) => onEnvironmentChange({ groundMaterial: event.target.value, terrain: { ...terrain, material: event.target.value } })}>
            {Object.values(TERRAIN_MATERIALS).map((material) => <option key={material.id} value={material.id}>{material.label}</option>)}
          </select>
        </label>
        <NumericField label="지형 해상도" value={terrain.resolution} min={1} max={10} step={0.5} unit="m" onChange={(resolution) => changeTerrain({ resolution })} />
        <label className={styles.switch}><input type="checkbox" checked={terrain.showContours} onChange={(event) => changeTerrain({ showContours: event.target.checked })} /><span>등고선</span></label>
        <label className={styles.switch}><input type="checkbox" checked={terrain.showHeightColors} onChange={(event) => changeTerrain({ showHeightColors: event.target.checked })} /><span>높이 색상</span></label>
      </div>
    </section>
  );
}
