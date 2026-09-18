import NumericField from "./NumericField";
import {
  DEFAULT_TERRAIN_BRUSH,
  TERRAIN_BRUSH_SHAPES,
  TERRAIN_EDIT_TOOLS,
  TERRAIN_EDIT_MODES,
  isTerrainColorTool,
  isTerrainFootprintTool,
  isTerrainAreaProfile,
  getTerrainAreaProfile,
  applyTerrainArea,
} from "@/features/digitalTwin/editor/terrain/TerrainEditor";
import { TERRAIN_MATERIALS } from "@/features/digitalTwin/editor/terrain/TerrainModel";

import styles from "./TerrainEditorPanel.module.css";

const TOOLS = [
  [TERRAIN_EDIT_TOOLS.REMOVE_GROUND, "부지 삭제"],
  [TERRAIN_EDIT_TOOLS.RESTORE_GROUND, "부지 복원"],
  [TERRAIN_EDIT_TOOLS.RAISE, "올리기"],
  [TERRAIN_EDIT_TOOLS.LOWER, "낮추기"],
  [TERRAIN_EDIT_TOOLS.FLATTEN, "평탄화"],
  [TERRAIN_EDIT_TOOLS.SMOOTH, "다듬기"],
  [TERRAIN_EDIT_TOOLS.SET_HEIGHT, "높이 지정"],
  [TERRAIN_EDIT_TOOLS.SLOPE, "경사로"],
  [TERRAIN_EDIT_TOOLS.HILL, "언덕"],
  [TERRAIN_EDIT_TOOLS.PAINT, "셀 색칠"],
  [TERRAIN_EDIT_TOOLS.ERASE, "색상 지우기"],
];

const SHAPES = [
  [TERRAIN_BRUSH_SHAPES.CIRCLE, "원형"],
  [TERRAIN_BRUSH_SHAPES.SQUARE, "사각형"],
  [TERRAIN_BRUSH_SHAPES.FREE, "자유형"],
];

function GradientFields({ endColor, direction, onChange }) {
  return <>
    <label className={styles.selectField}><span>끝 색상</span>
      <input type="color" value={endColor} onChange={(event) => onChange({ endColor: event.target.value })} />
    </label>
    <label className={styles.selectField}><span>그라데이션 방향</span>
      <select value={direction} onChange={(event) => onChange({ direction: event.target.value })}>
        <option value="POSITIVE_X">X− → X+</option><option value="NEGATIVE_X">X+ → X−</option>
        <option value="POSITIVE_Z">Z− → Z+</option><option value="NEGATIVE_Z">Z+ → Z−</option>
      </select>
    </label>
  </>;
}

export default function TerrainEditorPanel({ environment, brush = DEFAULT_TERRAIN_BRUSH, gridCellSize = 1, onBrushChange, onEnvironmentChange, areaSelection, onAreaSelectionChange }) {
  const terrain = environment.terrain;
  const areaMode = brush.mode === TERRAIN_EDIT_MODES.AREA;
  const colorTool = isTerrainColorTool(brush);
  const footprintTool = isTerrainFootprintTool(brush);
  const profileTool = isTerrainAreaProfile(brush);
  const profile = profileTool && areaSelection ? getTerrainAreaProfile(terrain, areaSelection.start, areaSelection.end, brush) : null;
  const changeBrush = (changes) => {
    const next = { ...brush, ...changes };
    if (!isTerrainAreaProfile(next)) onAreaSelectionChange?.(null);
    onBrushChange(next);
  };
  const changeTerrain = (changes) => onEnvironmentChange({ terrain: { ...terrain, ...changes } });
  return (
    <section className={styles.panel} aria-label="지형 고도 편집">
      <div className={`${styles.segmented} ${styles.modeSwitch}`} role="group" aria-label="지형 편집 모드">
        {[[TERRAIN_EDIT_MODES.BRUSH, "브러시 편집"], [TERRAIN_EDIT_MODES.AREA, "영역 선택 편집"]].map(([id, label]) => (
          <button key={id} type="button" className={(brush.mode ?? TERRAIN_EDIT_MODES.BRUSH) === id ? styles.active : ""}
            aria-pressed={(brush.mode ?? TERRAIN_EDIT_MODES.BRUSH) === id}
            onClick={() => changeBrush({ mode: id, ...(id === TERRAIN_EDIT_MODES.BRUSH ? { paintMode: "SOLID" } : {}) })}>{label}</button>
        ))}
      </div>
      <p className={styles.help}>{profileTool ? "높이·경사율 설정 후 영역을 드래그하고 놓으면 적용됩니다. 선택을 유지한 채 값을 바꾸고 다시 적용할 수 있습니다. 드래그 중 Esc로 취소합니다." : areaMode ? "드래그로 사각 영역을 선택하고 놓으면 한 번 적용합니다. Esc로 취소할 수 있습니다." : brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? "시작점에서 끝점까지 드래그하면 설정한 높이로 경사로를 만듭니다. 브러시 크기는 경사로 폭입니다." : brush.tool === TERRAIN_EDIT_TOOLS.HILL ? "클릭하거나 드래그하면 지면 위로 둥근 언덕을 만듭니다." : footprintTool ? "그리드 셀을 클릭하거나 드래그해 부지 자체를 삭제·복원합니다." : colorTool ? "셀을 클릭하거나 드래그해 색상을 편집합니다." : "지면을 드래그해 브러시로 높이를 편집합니다."}</p>
      <div className={styles.toolGrid} role="toolbar" aria-label="지형 편집 도구">
        {TOOLS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={brush.tool === id ? styles.active : ""}
            aria-pressed={brush.tool === id}
            onClick={() => changeBrush({ tool: id })}
          >{areaMode && id === TERRAIN_EDIT_TOOLS.SLOPE ? "경사로" : label}</button>
        ))}
      </div>

      <div className={styles.section}>
        {!areaMode && !colorTool && !footprintTool ? <div className={styles.segmented} role="group" aria-label="브러시 영역 형태">
          {SHAPES.map(([id, label]) => (
            <button key={id} type="button" className={brush.shape === id ? styles.active : ""} aria-pressed={brush.shape === id} onClick={() => changeBrush({ shape: id })}>{label}</button>
          ))}
        </div> : null}
        {colorTool ? <>
          <p className={styles.help}>현재 부지 그리드: {gridCellSize}m · 색상은 지형 높이와 별도로 저장됩니다.</p>
          {brush.tool === TERRAIN_EDIT_TOOLS.PAINT ? <>
          <label className={styles.selectField}><span>색칠 방식</span>
            <select value={brush.paintMode ?? "SOLID"} onChange={(event) => changeBrush({ paintMode: event.target.value,
              ...(event.target.value === "GRADIENT" ? { mode: TERRAIN_EDIT_MODES.AREA } : {}) })}>
              <option value="SOLID">단색</option><option value="GRADIENT">그라데이션</option>
            </select>
          </label>
          <label className={styles.selectField}><span>{brush.paintMode === "GRADIENT" ? "시작 색상" : "셀 색상"}</span>
            <input type="color" value={brush.color ?? DEFAULT_TERRAIN_BRUSH.color} onChange={(event) => changeBrush({ color: event.target.value })} />
          </label>
          {brush.paintMode === "GRADIENT" ? <>
            <GradientFields endColor={brush.gradientEndColor ?? DEFAULT_TERRAIN_BRUSH.gradientEndColor} direction={brush.gradientDirection ?? "POSITIVE_X"}
              onChange={(changes) => changeBrush({ gradientEndColor: changes.endColor ?? brush.gradientEndColor, gradientDirection: changes.direction ?? brush.gradientDirection })} />
            <p className={styles.help}>드래그한 전체 영역에 두 색상이 부드럽게 이어집니다. 브러시 편집으로 전환하면 단색 색칠로 바뀝니다.</p>
          </> : null}
          </> : null}
          <div className={styles.swatches}>
            {[['#4e565d', '도로'], ['#b9bec2', '인도'], ['#627c63', '녹지'], ['#e7c44b', '노란 표시'], ['#f2f2ed', '흰 표시']].map(([color, label]) => (
              <button key={color} type="button" title={label} aria-label={`${label} 색상`} style={{ backgroundColor: color }}
                onClick={() => changeBrush({ color, tool: TERRAIN_EDIT_TOOLS.PAINT })} />
            ))}
          </div>
        </> : null}
        {!colorTool && !footprintTool ? <>
        <div className={styles.fieldGrid}>
          {!areaMode ? <><NumericField label="브러시 크기" value={brush.size} min={1} max={80} step={1} unit="m" onChange={(size) => changeBrush({ size })} />
          <NumericField label="강도" value={brush.strength} min={0.05} max={2} step={0.05} onChange={(strength) => changeBrush({ strength })} />
          <NumericField label="감쇠" value={brush.falloff} min={0} max={1} step={0.05} onChange={(falloff) => changeBrush({ falloff })} /></> : null}
          {areaMode && [TERRAIN_EDIT_TOOLS.RAISE, TERRAIN_EDIT_TOOLS.LOWER].includes(brush.tool) ?
            <NumericField label="변경 높이" value={brush.heightStep ?? 1} min={0.01} max={80} step={0.1} unit="m" onChange={(heightStep) => changeBrush({ heightStep })} /> : null}
          {!profileTool && (brush.tool === TERRAIN_EDIT_TOOLS.SET_HEIGHT || (brush.tool === TERRAIN_EDIT_TOOLS.SLOPE && brush.heightInput !== "GRADE")) ? (
            <NumericField label={brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? "종료 높이" : "목표 높이"} value={brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? brush.endHeight ?? brush.targetHeight : brush.targetHeight} min={-40} max={80} step={0.1} unit="m" onChange={(targetHeight) => changeBrush({ targetHeight, endHeight: targetHeight })} />
          ) : null}
          {!profileTool && brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? (
            <NumericField label="시작 높이" value={brush.startHeight ?? 0} min={-40} max={80} step={0.1} unit="m" onChange={(startHeight) => changeBrush({ startHeight })} />
          ) : null}
          {!areaMode && brush.tool === TERRAIN_EDIT_TOOLS.HILL ? <NumericField label="언덕 높이" value={brush.hillHeight ?? 3} min={0.1} step={0.1} unit="m" onChange={(hillHeight) => changeBrush({ hillHeight })} /> : null}
          {!areaMode && brush.tool === TERRAIN_EDIT_TOOLS.SLOPE && brush.heightInput === "GRADE" ? <NumericField label="경사율" value={brush.gradePercent ?? 10} step={0.1} unit="%" onChange={(gradePercent) => changeBrush({ gradePercent })} /> : null}
        </div>
        {!areaMode && brush.tool === TERRAIN_EDIT_TOOLS.SLOPE ? <label className={styles.selectField}><span>높이 설정 방식</span>
          <select value={brush.heightInput ?? "HEIGHTS"} onChange={(event) => changeBrush({ heightInput: event.target.value })}>
            <option value="HEIGHTS">시작·끝 높이 지정</option><option value="GRADE">시작 높이 + 경사율</option>
          </select>
        </label> : null}
        {profileTool ? <>
          <label className={styles.selectField}><span>시작 → 끝 방향</span>
            <select value={brush.direction ?? "POSITIVE_Z"} onChange={(event) => changeBrush({ direction: event.target.value })}>
              <option value="POSITIVE_Z">Z− → Z+</option><option value="NEGATIVE_Z">Z+ → Z−</option>
              <option value="POSITIVE_X">X− → X+</option><option value="NEGATIVE_X">X+ → X−</option>
            </select>
          </label>
          <label className={styles.selectField}><span>높이 설정 방식</span>
            <select value={brush.heightInput ?? "HEIGHTS"} onChange={(event) => changeBrush({ heightInput: event.target.value,
              ...(profile ? { endHeight: profile.endHeight, gradePercent: profile.gradePercent } : {}) })}>
              <option value="HEIGHTS">시작·끝 높이 지정</option><option value="GRADE">시작 높이 + 경사율</option>
            </select>
          </label>
          <div className={styles.fieldGrid}>
            <NumericField label="시작 높이" value={brush.startHeight ?? 0} step={0.1} unit="m" onChange={(startHeight) => changeBrush({ startHeight })} />
            {brush.heightInput === "GRADE"
              ? <NumericField label="경사율" value={brush.gradePercent ?? 10} step={0.1} unit="%" onChange={(gradePercent) => changeBrush({ gradePercent })} />
              : <NumericField label="끝 높이" value={brush.endHeight ?? brush.targetHeight} step={0.1} unit="m" onChange={(endHeight) => changeBrush({ endHeight })} />}
            {brush.tool === TERRAIN_EDIT_TOOLS.HILL ? <NumericField label="중앙 솟음 높이" value={brush.hillHeight ?? 3} min={0} step={0.1} unit="m" onChange={(hillHeight) => changeBrush({ hillHeight })} /> : null}
          </div>
          <p className={styles.help}>경사율 = (끝 높이 − 시작 높이) ÷ 수평 길이 × 100. 음수는 내리막입니다.{brush.tool === TERRAIN_EDIT_TOOLS.HILL ? " 언덕은 이 경사면 중앙을 지정한 높이만큼 둥글게 올립니다." : ""}</p>
          {profile ? <p className={styles.help} role="status">
            선택 영역 {(profile.bounds.maxX - profile.bounds.minX).toFixed(2)} × {(profile.bounds.maxZ - profile.bounds.minZ).toFixed(2)} m · 수평 길이 {profile.length.toFixed(2)} m<br />
            시작 (X {profile.startPoint.x.toFixed(2)}, Z {profile.startPoint.z.toFixed(2)}): {profile.startHeight.toFixed(2)} m<br />
            끝 (X {profile.endPoint.x.toFixed(2)}, Z {profile.endPoint.z.toFixed(2)}): {profile.endHeight.toFixed(2)} m · 경사율 {profile.gradePercent.toFixed(2)}%
          </p> : <p className={styles.help}>화면에서 적용할 영역을 먼저 선택하세요.</p>}
          {profile && !profile.valid ? <p className={styles.help} role="alert">{!profile.hasHillInterior ? "언덕은 가로·세로 각각 지형 격자 2칸 이상을 선택하세요. 작은 언덕은 지형 해상도를 낮춰 격자를 촘촘하게 만들 수 있습니다." : "높이는 중앙 솟음을 포함해 −80~80 m 범위로 설정하세요."}</p> : null}
          <div className={`${styles.segmented} ${styles.modeSwitch}`}>
            <button type="button" disabled={!profile?.valid} onClick={() => {
              changeTerrain(applyTerrainArea(terrain, areaSelection.start, areaSelection.end, brush, environment.width, environment.depth));
              onAreaSelectionChange?.(null);
            }}>선택 영역에 적용</button>
            <button type="button" disabled={!areaSelection} onClick={() => onAreaSelectionChange?.(null)}>선택 취소</button>
          </div>
        </> : null}
        {areaMode ? <p className={styles.help}>높이 영역은 지형 해상도에 맞춰 선택되며 경계 바깥은 인접 지형으로 이어집니다. 언덕은 중앙이 솟도록 가로·세로 최소 2칸을 사용합니다.</p> : null}
        {!areaMode && brush.tool === TERRAIN_EDIT_TOOLS.HILL ? <p className={styles.help}>작은 브러시는 언덕이 표현되도록 지형 격자 2칸 크기까지 보정됩니다.</p> : null}
        </> : null}
      </div>

      <div className={styles.section}>
        <label className={styles.selectField}><span>부지 모양</span>
          <select value={terrain.shape ?? "RECTANGLE"} onChange={(event) => changeTerrain({ shape: event.target.value })}>
            <option value="RECTANGLE">사각형 / 그리드 편집</option><option value="CIRCLE">원형</option>
          </select>
        </label>
        <label className={styles.selectField}><span>부지 전체 색칠 방식</span>
          <select value={terrain.colorGradient ? "GRADIENT" : "SOLID"} onChange={(event) => changeTerrain({
            colorGradient: event.target.value === "GRADIENT" ? { minX: -environment.width / 2, maxX: environment.width / 2,
              minZ: -environment.depth / 2, maxZ: environment.depth / 2, endColor: DEFAULT_TERRAIN_BRUSH.gradientEndColor, direction: "POSITIVE_X" } : null,
            showHeightColors: false,
          })}>
            <option value="SOLID">단색</option><option value="GRADIENT">그라데이션</option>
          </select>
        </label>
        <label className={styles.selectField}><span>{terrain.colorGradient ? "부지 전체 시작 색상" : "부지 전체 색상"}</span>
          <input type="color" value={terrain.color ?? TERRAIN_MATERIALS[terrain.material].color} onChange={(event) => changeTerrain({ color: event.target.value })} />
        </label>
        {terrain.colorGradient ? <GradientFields endColor={terrain.colorGradient.endColor} direction={terrain.colorGradient.direction}
          onChange={(changes) => changeTerrain({ colorGradient: { ...terrain.colorGradient, ...changes } })} /> : null}
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
