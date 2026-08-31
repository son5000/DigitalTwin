import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  formatGridResolution,
  GRID_CELL_SIZE_OPTIONS,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import {
  MOVE_AXIS_MODES,
  normalizeMoveAxisMode,
} from "@/features/digitalTwin/editor/constants/transformTools";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import {
  AreaSelectIcon,
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  EquipmentIcon,
  FocusBuildingIcon,
  GridViewIcon,
  ImportIcon,
  Layout2DIcon,
  ListViewIcon,
  LockIcon,
  MoreIcon,
  MoveIcon,
  MoveOffIcon,
  MovePlanarIcon,
  NavigateIcon,
  ResetIcon,
  RedoIcon,
  RotateIcon,
  SaveIcon,
  SelectIcon,
  ShadowIcon,
  SnapIcon,
  TransparencyLayersIcon,
  UndoIcon,
  UnlockIcon,
  View3DIcon,
  ViewerIcon,
  WorldIcon,
} from "@/components/icons";

import styles from "./EditorToolbar.module.css";

const PANEL_TOOL_CONFIG = {
  SPACE: {
    leading: [
      { id: WORLD_PANEL_IDS.OBJECTS, label: "오브젝트", icon: GridViewIcon },
      { id: WORLD_PANEL_IDS.OBJECT_LIST, label: "오브젝트 목록", icon: ListViewIcon },
    ],
    trailing: [
      { id: WORLD_PANEL_IDS.TERRAIN, label: "지형 고도", icon: AreaSelectIcon },
      { id: WORLD_PANEL_IDS.SETTINGS, label: "부지 설정", icon: EditIcon },
      { id: WORLD_PANEL_IDS.DETAILS, label: "오브젝트 설정", icon: SelectIcon, requiresSelection: true },
    ],
  },
  INTERIOR: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "도면 도구", icon: GridViewIcon }],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "구조 상세", icon: SelectIcon, requiresSelection: true }],
  },
  EQUIPMENT: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "설비", icon: GridViewIcon }],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "설비 상세", icon: SelectIcon, requiresSelection: true }],
  },
  FLOOR: {
    leading: [
      { id: WORLD_PANEL_IDS.OBJECTS, label: "오브젝트", icon: GridViewIcon },
      { id: WORLD_PANEL_IDS.OBJECT_LIST, label: "오브젝트 목록", icon: ListViewIcon },
    ],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "선택 항목 설정", icon: SelectIcon, requiresSelection: true }],
  },
  CUSTOM_BUILDING: {
    leading: [
      { id: WORLD_PANEL_IDS.OBJECTS, label: "형상 도구", icon: GridViewIcon },
      { id: WORLD_PANEL_IDS.OBJECT_LIST, label: "물리 요소", icon: ListViewIcon },
    ],
    trailing: [
      { id: WORLD_PANEL_IDS.SETTINGS, label: "건축물 설정", icon: EditIcon },
      { id: WORLD_PANEL_IDS.DETAILS, label: "선택 요소 설정", icon: SelectIcon, requiresSelection: true },
    ],
  },
};

const MOVE_AXIS_UI = Object.freeze({
  [MOVE_AXIS_MODES.XYZ]: { label: "전체 이동", badge: "XYZ", icon: MoveIcon },
  [MOVE_AXIS_MODES.OFF]: { label: "이동 꺼짐", badge: "꺼짐", icon: MoveOffIcon },
  [MOVE_AXIS_MODES.PLANAR]: { label: "평면 이동", badge: "평면", icon: MovePlanarIcon },
});

function ToolbarButton({ icon, label, shortcut, badge, active = false, pressed, menuItem = false, ...buttonProps }) {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ""} ${menuItem ? styles.menuItem : ""}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      data-tooltip={shortcut ? `${label} · ${shortcut}` : label}
      aria-pressed={pressed}
      {...buttonProps}
    >
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      {badge ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
      {menuItem ? <span className={styles.menuLabel}>{label}</span> : null}
      {menuItem && shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function MoveAxisButton({ transformTools, disabled, onClick }) {
  const mode = normalizeMoveAxisMode(transformTools);
  const config = MOVE_AXIS_UI[mode];
  const Icon = config.icon;
  const enabled = mode !== MOVE_AXIS_MODES.OFF;
  const label = `이동: ${config.label}`;
  return (
    <ToolbarButton
      icon={<Icon />}
      label={label}
      shortcut="W"
      badge={config.badge}
      active={enabled}
      pressed={enabled}
      disabled={disabled}
      data-move-axis-mode={mode}
      onClick={onClick}
    />
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
  panelMode = null,
  activePanelId = null,
  viewerTranslucent,
  viewerTransparencyLabel = "반투명 보기",
  showSelectionActions = false,
  showSiteInteractionTools = false,
  showBuildingIsolationToggle = false,
  buildingIsolationEnabled = false,
  buildingIsolationAvailable = false,
  showShadowToggle = false,
  shadowEnabled = true,
  siteInteractionMode = SITE_INTERACTION_MODES.NAVIGATE,
  editorMode,
  viewMode,
  transformTools,
  snapSize,
  gridSnapEnabled,
  hasSelection,
  hasTransformSelection = hasSelection,
  worldLocked,
  saveStatus,
  canUndo,
  canRedo,
  onEditorModeChange,
  onPanelChange,
  onViewerTransparencyChange,
  onSiteInteractionModeChange,
  onBuildingIsolationChange,
  onShadowEnabledChange,
  onViewModeChange,
  onTransformToolToggle,
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
    const panelTools = PANEL_TOOL_CONFIG[panelMode] ?? { leading: [], trailing: [] };
    const renderPanelTool = (tool) => {
      const Icon = tool.icon;
      const active = activePanelId === tool.id;
      return (
        <ToolbarButton
          key={tool.id}
          icon={<Icon />}
          label={tool.label}
          active={active}
          pressed={active}
          disabled={tool.requiresSelection && !hasSelection}
          onClick={() => onPanelChange?.(active ? null : tool.id)}
        />
      );
    };

    return (
      <nav className={styles.toolbar} aria-label={`${hierarchyScopeLabel} 도구`}>
        {panelTools.leading.map(renderPanelTool)}
        {panelTools.leading.length ? <Divider /> : null}
        <div className={styles.group} aria-label="이동과 회전">
          <MoveAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("translate")} />
          <ToolbarButton icon={<RotateIcon />} label="회전" shortcut="E" active={transformTools.rotate} pressed={transformTools.rotate} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("rotate")} />
        </div>
        {showSiteInteractionTools ? (
          <div className={styles.group} aria-label="월드 조작 방식">
            <ToolbarButton
              icon={<NavigateIcon />}
              label="월드 회전"
              active={siteInteractionMode === SITE_INTERACTION_MODES.NAVIGATE}
              pressed={siteInteractionMode === SITE_INTERACTION_MODES.NAVIGATE}
              onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.NAVIGATE)}
            />
            <ToolbarButton
              icon={<AreaSelectIcon />}
              label="영역 선택"
              active={siteInteractionMode === SITE_INTERACTION_MODES.AREA_SELECT}
              pressed={siteInteractionMode === SITE_INTERACTION_MODES.AREA_SELECT}
              onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.AREA_SELECT)}
            />
          </div>
        ) : null}
        {showBuildingIsolationToggle ? (
          <>
            <Divider />
            <ToolbarButton
              icon={<FocusBuildingIcon />}
              label="선택 건축물만 보기"
              active={buildingIsolationEnabled}
              pressed={buildingIsolationEnabled}
              disabled={!buildingIsolationAvailable}
              title={buildingIsolationAvailable ? "선택 건축물만 보기" : "건축물을 선택하면 사용할 수 있습니다"}
              data-tooltip={buildingIsolationAvailable ? `선택 건축물만 보기 · ${buildingIsolationEnabled ? "켜짐" : "꺼짐"}` : "건축물을 먼저 선택하세요"}
              onClick={() => onBuildingIsolationChange?.(!buildingIsolationEnabled)}
            />
          </>
        ) : null}
        {typeof viewerTranslucent === "boolean" ? (
          <>
            <Divider />
            <ToolbarButton
              icon={<TransparencyLayersIcon />}
              label={viewerTransparencyLabel}
              active={viewerTranslucent}
              pressed={viewerTranslucent}
              onClick={() => onViewerTransparencyChange?.(!viewerTranslucent)}
            />
          </>
        ) : null}
        {showShadowToggle ? (
          <ToolbarButton
            icon={<ShadowIcon />}
            label={`그림자 표시 ${shadowEnabled ? "끄기" : "켜기"}`}
            active={shadowEnabled}
            pressed={shadowEnabled}
            data-tooltip={`그림자 표시 · ${shadowEnabled ? "켜짐" : "꺼짐"}`}
            onClick={() => onShadowEnabledChange?.(!shadowEnabled)}
          />
        ) : null}
        {panelTools.trailing.length ? <Divider /> : null}
        {panelTools.trailing.map(renderPanelTool)}
        <Divider />
        <div className={styles.group} aria-label="편집 이력">
          <ToolbarButton icon={<UndoIcon />} label="되돌리기" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
          <ToolbarButton icon={<RedoIcon />} label="다시 실행" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo} />
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
            <MoveAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("translate")} />
            <ToolbarButton icon={<RotateIcon />} label="Y축 회전" shortcut="E" active={transformTools.rotate} pressed={transformTools.rotate} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("rotate")} />
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
