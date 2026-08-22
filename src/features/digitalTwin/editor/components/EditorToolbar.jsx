import {
  TRANSFORM_MODES,
  VIEW_MODES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  formatGridResolution,
  GRID_CELL_SIZE_OPTIONS,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import {
  AreaSelectIcon,
  BuildingIcon,
  DeleteIcon,
  DuplicateIcon,
  EquipmentIcon,
  FloorIcon,
  ImportIcon,
  Layout2DIcon,
  LockIcon,
  MoreIcon,
  MoveIcon,
  NavigateIcon,
  ResetIcon,
  RedoIcon,
  RotateIcon,
  SaveIcon,
  SiteIcon,
  SnapIcon,
  UndoIcon,
  UnlockIcon,
  View3DIcon,
  ViewerIcon,
  WorldIcon,
} from "@/components/icons";

import styles from "./EditorToolbar.module.css";

function ToolbarButton({ icon, label, shortcut, active = false, menuItem = false, ...buttonProps }) {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ""} ${menuItem ? styles.menuItem : ""}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      data-tooltip={shortcut ? `${label} · ${shortcut}` : label}
      {...buttonProps}
    >
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      {menuItem ? <span className={styles.menuLabel}>{label}</span> : null}
      {menuItem && shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function Divider() {
  return <span className={styles.divider} aria-hidden="true" />;
}

function ModeSelector({ editorMode, onEditorModeChange }) {
  return (
    <div className={styles.group} aria-label="편집 영역">
      <ToolbarButton icon={<WorldIcon />} label="월드 편집" active={editorMode === EDITOR_MODES.WORLD} onClick={() => onEditorModeChange(EDITOR_MODES.WORLD)} />
      <ToolbarButton icon={<EquipmentIcon />} label="설비 편집" active={editorMode === EDITOR_MODES.EQUIPMENT} onClick={() => onEditorModeChange(EDITOR_MODES.EQUIPMENT)} />
      <ToolbarButton icon={<ViewerIcon />} label="뷰어" active={editorMode === EDITOR_MODES.VIEWER} onClick={() => onEditorModeChange(EDITOR_MODES.VIEWER)} />
    </div>
  );
}

function GridSnapControl({ enabled, snapSize, onToggle, onSnapSizeChange }) {
  return (
    <div className={styles.snapControl}>
      <button
        type="button"
        role="switch"
        aria-label={`그리드 스냅 ${enabled ? "끄기" : "켜기"}`}
        aria-checked={enabled}
        title={`그리드 스냅 ${enabled ? "켜짐" : "꺼짐"}`}
        data-tooltip={`그리드 스냅 · ${enabled ? "켜짐" : "꺼짐"}`}
        className={`${styles.snapToggle} ${enabled ? styles.snapEnabled : ""}`}
        onClick={() => onToggle(!enabled)}
      >
        <SnapIcon size={20} />
      </button>
      <label className={styles.snapSize} title={`스냅 간격 ${formatGridResolution(snapSize)}`} data-tooltip={`스냅 간격 · ${formatGridResolution(snapSize)}`}>
        <span className={styles.srOnly}>그리드 셀 크기</span>
        <select
          aria-label="그리드 셀 크기"
          value={snapSize}
          disabled={!enabled}
          onChange={(event) => onSnapSizeChange(Number(event.target.value))}
        >
          {GRID_CELL_SIZE_OPTIONS.map((snapOption) => (
            <option key={snapOption} value={snapOption}>{formatGridResolution(snapOption)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function OverflowActions({
  hasSelection,
  showSelectionActions = true,
  saveStatus,
  onDuplicate,
  onDelete,
  onReset,
  onLoad,
  onSave,
}) {
  return (
    <details className={styles.overflow}>
      <summary aria-label="더 보기" title="더 보기" data-tooltip="더 보기"><MoreIcon size={20} /></summary>
      <div className={styles.overflowMenu}>
        {saveStatus ? <span className={styles.saveStatus}>{saveStatus}</span> : null}
        {showSelectionActions ? (
          <>
            <ToolbarButton menuItem icon={<DuplicateIcon />} label="복제" shortcut="Ctrl+D" disabled={!hasSelection} onClick={onDuplicate} />
            <ToolbarButton menuItem icon={<DeleteIcon />} label="삭제" shortcut="Delete" disabled={!hasSelection} onClick={onDelete} />
            <Divider />
          </>
        ) : null}
        <ToolbarButton menuItem icon={<ResetIcon />} label="초기화" onClick={onReset} />
        <ToolbarButton menuItem icon={<ImportIcon />} label="불러오기" onClick={onLoad} />
        <ToolbarButton menuItem icon={<SaveIcon />} label="저장" onClick={onSave} />
      </div>
    </details>
  );
}

export default function EditorToolbar({
  hierarchyScope = false,
  focusedScope = false,
  hierarchyScopeLabel = "부지 편집",
  contextIcon = "SITE",
  showSelectionActions = false,
  showSiteInteractionTools = false,
  siteInteractionMode = SITE_INTERACTION_MODES.NAVIGATE,
  editorMode,
  viewMode,
  transformMode,
  snapSize,
  gridSnapEnabled,
  hasSelection,
  worldLocked,
  saveStatus,
  canUndo,
  canRedo,
  onEditorModeChange,
  onSiteInteractionModeChange,
  onViewModeChange,
  onTransformModeChange,
  onSnapSizeChange,
  onGridSnapChange,
  onToggleWorldLock,
  onDuplicate,
  onDelete,
  onReset,
  onLoad,
  onSave,
  onUndo,
  onRedo,
}) {
  const isViewer = editorMode === EDITOR_MODES.VIEWER;

  if (hierarchyScope || focusedScope) {
    const contextIconElement = contextIcon === "EQUIPMENT"
      ? <EquipmentIcon />
      : contextIcon === "BUILDING"
        ? <BuildingIcon />
        : contextIcon === "FLOOR"
          ? <FloorIcon />
          : <SiteIcon />;
    return (
      <nav className={styles.toolbar} aria-label={`${hierarchyScopeLabel} 도구`}>
        <span className={styles.contextBadge} title={hierarchyScopeLabel} data-tooltip={hierarchyScopeLabel} aria-label={hierarchyScopeLabel}>
          {contextIconElement}
        </span>
        <Divider />
        <ToolbarButton icon={<UndoIcon />} label="되돌리기" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
        <ToolbarButton icon={<RedoIcon />} label="다시 실행" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo} />
        {showSiteInteractionTools ? (
          <>
            <Divider />
            <div className={styles.group} aria-label="월드 조작 방식">
              <ToolbarButton
                icon={<NavigateIcon />}
                label="월드 이동/회전"
                active={siteInteractionMode === SITE_INTERACTION_MODES.NAVIGATE}
                onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.NAVIGATE)}
              />
              <ToolbarButton
                icon={<AreaSelectIcon />}
                label="영역 선택"
                active={siteInteractionMode === SITE_INTERACTION_MODES.AREA_SELECT}
                onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.AREA_SELECT)}
              />
            </div>
          </>
        ) : null}
        <Divider />
        <div className={styles.group} aria-label="이동과 회전">
          <ToolbarButton icon={<MoveIcon />} label="이동" shortcut="W" active={transformMode === TRANSFORM_MODES.TRANSLATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.TRANSLATE)} />
          <ToolbarButton icon={<RotateIcon />} label="회전" shortcut="E" active={transformMode === TRANSFORM_MODES.ROTATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.ROTATE)} />
        </div>
        <Divider />
        <GridSnapControl enabled={gridSnapEnabled} snapSize={snapSize} onToggle={onGridSnapChange} onSnapSizeChange={onSnapSizeChange} />
        <Divider />
        <OverflowActions
          hasSelection={hasSelection}
          showSelectionActions={showSelectionActions}
          saveStatus={saveStatus}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onReset={onReset}
          onLoad={onLoad}
          onSave={onSave}
        />
      </nav>
    );
  }

  return (
    <nav className={`${styles.toolbar} ${isViewer ? styles.viewerToolbar : ""}`} aria-label="월드 편집 도구">
      <ModeSelector editorMode={editorMode} onEditorModeChange={onEditorModeChange} />
      <Divider />
      <ToolbarButton icon={<UndoIcon />} label="되돌리기" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
      <ToolbarButton icon={<RedoIcon />} label="다시 실행" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo} />
      <Divider />
      <div className={styles.group} aria-label="보기 방식">
        <ToolbarButton icon={<Layout2DIcon />} label="2D 배치" active={viewMode === VIEW_MODES.LAYOUT_2D} onClick={() => onViewModeChange(VIEW_MODES.LAYOUT_2D)} />
        <ToolbarButton icon={<View3DIcon />} label="3D 보기" active={viewMode === VIEW_MODES.VIEW_3D} onClick={() => onViewModeChange(VIEW_MODES.VIEW_3D)} />
      </div>

      {!isViewer ? (
        <>
          <Divider />
          <div className={styles.group} aria-label="이동과 회전">
            <ToolbarButton icon={<MoveIcon />} label="이동" shortcut="W" active={transformMode === TRANSFORM_MODES.TRANSLATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.TRANSLATE)} />
            <ToolbarButton icon={<RotateIcon />} label="회전" shortcut="E" active={transformMode === TRANSFORM_MODES.ROTATE} disabled={!hasSelection} onClick={() => onTransformModeChange(TRANSFORM_MODES.ROTATE)} />
          </div>
          <Divider />
          <GridSnapControl enabled={gridSnapEnabled} snapSize={snapSize} onToggle={onGridSnapChange} onSnapSizeChange={onSnapSizeChange} />
          {editorMode === EDITOR_MODES.WORLD ? (
            <ToolbarButton icon={worldLocked ? <LockIcon /> : <UnlockIcon />} label={worldLocked ? "월드 잠금 해제" : "월드 잠금"} active={worldLocked} onClick={() => onToggleWorldLock(!worldLocked)} />
          ) : null}
          <Divider />
          <OverflowActions
            hasSelection={hasSelection}
            saveStatus={saveStatus}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onReset={onReset}
            onLoad={onLoad}
            onSave={onSave}
          />
        </>
      ) : null}
    </nav>
  );
}
