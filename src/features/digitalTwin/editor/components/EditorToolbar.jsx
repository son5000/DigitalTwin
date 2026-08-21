import {
  GRID_SNAP_OPTIONS,
  TRANSFORM_MODES,
  VIEW_MODES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";

import styles from "./EditorToolbar.module.css";

function ToolbarButton({ children, active = false, ...buttonProps }) {
  return (
    <button type="button" className={`${styles.button} ${active ? styles.active : ""}`} {...buttonProps}>
      {children}
    </button>
  );
}

function ModeSelector({ editorMode, onEditorModeChange }) {
  return (
    <div className={styles.modeGroup} aria-label="Edit Context">
      <span className={styles.groupLabel}>CONTEXT</span>
      <ToolbarButton active={editorMode === EDITOR_MODES.WORLD} onClick={() => onEditorModeChange(EDITOR_MODES.WORLD)}>▧ World Edit</ToolbarButton>
      <ToolbarButton active={editorMode === EDITOR_MODES.EQUIPMENT} onClick={() => onEditorModeChange(EDITOR_MODES.EQUIPMENT)}>◇ Equipment Edit</ToolbarButton>
      <ToolbarButton active={editorMode === EDITOR_MODES.VIEWER} onClick={() => onEditorModeChange(EDITOR_MODES.VIEWER)}>◉ Viewer</ToolbarButton>
    </div>
  );
}

export default function EditorToolbar({
  editorMode,
  viewMode,
  transformMode,
  snapSize,
  hasSelection,
  worldLocked,
  saveStatus,
  onEditorModeChange,
  onViewModeChange,
  onTransformModeChange,
  onSnapSizeChange,
  onToggleWorldLock,
  onDuplicate,
  onDelete,
  onReset,
  onLoad,
  onSave,
}) {
  const isViewer = editorMode === EDITOR_MODES.VIEWER;

  return (
    <footer className={`${styles.toolbar} ${isViewer ? styles.viewerToolbar : ""}`}>
      <ModeSelector editorMode={editorMode} onEditorModeChange={onEditorModeChange} />
      <div className={styles.divider} />
      <div className={styles.group}>
        <span className={styles.groupLabel}>VIEW</span>
        <ToolbarButton active={viewMode === VIEW_MODES.LAYOUT_2D} onClick={() => onViewModeChange(VIEW_MODES.LAYOUT_2D)}>2D Layout</ToolbarButton>
        <ToolbarButton active={viewMode === VIEW_MODES.VIEW_3D} onClick={() => onViewModeChange(VIEW_MODES.VIEW_3D)}>3D View</ToolbarButton>
      </div>

      {!isViewer && (
        <>
          <div className={styles.divider} />
          <div className={styles.group}>
            <span className={styles.groupLabel}>TRANSFORM</span>
            <ToolbarButton active={transformMode === TRANSFORM_MODES.TRANSLATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.TRANSLATE)}>Move <kbd>W</kbd></ToolbarButton>
            <ToolbarButton active={transformMode === TRANSFORM_MODES.ROTATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.ROTATE)}>Rotate <kbd>E</kbd></ToolbarButton>
          </div>
          <label className={styles.snapControl}>
            <span>SNAP</span>
            <select value={snapSize} onChange={(event) => onSnapSizeChange(Number(event.target.value))}>
              {GRID_SNAP_OPTIONS.map((snapOption) => <option key={snapOption} value={snapOption}>{snapOption} m</option>)}
            </select>
          </label>
          {editorMode === EDITOR_MODES.WORLD && (
            <ToolbarButton active={worldLocked} onClick={() => onToggleWorldLock(!worldLocked)}>{worldLocked ? "World Locked" : "Lock World"}</ToolbarButton>
          )}
        </>
      )}

      <div className={styles.spacer} />
      {!isViewer && saveStatus && <span className={styles.saveStatus}>{saveStatus}</span>}
      {!isViewer && (
        <div className={styles.group}>
          <ToolbarButton disabled={!hasSelection} onClick={onDuplicate}>Duplicate</ToolbarButton>
          <ToolbarButton disabled={!hasSelection} onClick={onDelete}>Delete</ToolbarButton>
          <ToolbarButton onClick={onReset}>Reset</ToolbarButton>
          <ToolbarButton onClick={onLoad}>Load</ToolbarButton>
          <button type="button" className={styles.primaryButton} onClick={onSave}>Save Layout</button>
        </div>
      )}
    </footer>
  );
}
