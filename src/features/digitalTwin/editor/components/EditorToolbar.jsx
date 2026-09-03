import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  formatGridResolution,
  GRID_CELL_SIZE_OPTIONS,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import {
  MOVE_AXIS_MODES,
  ROTATION_AXIS_MODES,
  normalizeMoveAxisMode,
  normalizeRotationAxisMode,
} from "@/features/digitalTwin/editor/constants/transformTools";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { GROUND_VIEW_MODES } from "@/features/digitalTwin/editor/model/undergroundModel";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { ToolbarButton, ToolbarDivider, ToolbarGroup, ToolbarIcon } from "./ToolbarPrimitives";
import { TOOLBAR_ACTION_IDS } from "./toolbarActionDefinitions";

import styles from "./EditorToolbar.module.css";

const PANEL_TOOL_CONFIG = {
  SPACE: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "오브젝트", iconKey: "objects" }],
    secondary: [
      { id: WORLD_PANEL_IDS.OBJECT_LIST, label: "오브젝트 목록", iconKey: "object-list" },
      { id: WORLD_PANEL_IDS.TERRAIN, label: "지형 고도", iconKey: "terrain" },
      { id: WORLD_PANEL_IDS.SETTINGS, label: "부지 설정", iconKey: "settings" },
    ],
    trailing: [
      { id: WORLD_PANEL_IDS.DETAILS, label: "오브젝트 설정", iconKey: "details", requiresSelection: true },
    ],
  },
  INTERIOR: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "도면 도구", iconKey: "objects" }],
    secondary: [],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "구조 상세", iconKey: "details", requiresSelection: true }],
  },
  EQUIPMENT: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "설비", iconKey: "equipment" }],
    secondary: [],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "설비 상세", iconKey: "details", requiresSelection: true }],
  },
  FLOOR: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "오브젝트", iconKey: "objects" }],
    secondary: [{ id: WORLD_PANEL_IDS.OBJECT_LIST, label: "오브젝트 목록", iconKey: "object-list" }],
    trailing: [{ id: WORLD_PANEL_IDS.DETAILS, label: "선택 항목 설정", iconKey: "details", requiresSelection: true }],
  },
  CUSTOM_BUILDING: {
    leading: [{ id: WORLD_PANEL_IDS.OBJECTS, label: "형상 도구", iconKey: "objects" }],
    secondary: [{ id: WORLD_PANEL_IDS.OBJECT_LIST, label: "물리 요소", iconKey: "object-list" }],
    trailing: [
      { id: WORLD_PANEL_IDS.SETTINGS, label: "건축물 설정", iconKey: "settings" },
      { id: WORLD_PANEL_IDS.DETAILS, label: "선택 요소 설정", iconKey: "details", requiresSelection: true },
    ],
  },
};

const MOVE_AXIS_UI = Object.freeze({
  [MOVE_AXIS_MODES.XYZ]: { label: "전체 이동", badge: "XYZ", actionId: TOOLBAR_ACTION_IDS.MOVE },
  [MOVE_AXIS_MODES.OFF]: { label: "이동 꺼짐", badge: "꺼짐", actionId: TOOLBAR_ACTION_IDS.MOVE_OFF },
  [MOVE_AXIS_MODES.PLANAR]: { label: "평면 이동", badge: "평면", actionId: TOOLBAR_ACTION_IDS.MOVE_PLANAR },
});

function MoveAxisButton({ transformTools, disabled, onClick }) {
  const mode = normalizeMoveAxisMode(transformTools);
  const config = MOVE_AXIS_UI[mode];
  const enabled = mode !== MOVE_AXIS_MODES.OFF;
  const label = `이동: ${config.label}`;
  return (
    <ToolbarButton
      actionId={config.actionId}
      label={label}
      badge={config.badge}
      active={enabled}
      pressed={enabled}
      disabled={disabled}
      disabledReason="이동할 오브젝트를 먼저 선택하세요"
      data-move-axis-mode={mode}
      onClick={onClick}
    />
  );
}

const ROTATION_AXIS_UI = Object.freeze({
  [ROTATION_AXIS_MODES.OFF]: { label: "회전 꺼짐", badge: "꺼짐" },
  [ROTATION_AXIS_MODES.Y]: { label: "Y축 회전", badge: "Y" },
  [ROTATION_AXIS_MODES.XY]: { label: "X·Y축 회전", badge: "XY" },
  [ROTATION_AXIS_MODES.XYZ]: { label: "X·Y·Z축 회전", badge: "XYZ" },
});

function RotationAxisButton({ transformTools, disabled, onClick }) {
  const mode = normalizeRotationAxisMode(transformTools);
  const config = ROTATION_AXIS_UI[mode];
  const enabled = mode !== ROTATION_AXIS_MODES.OFF;
  return (
    <ToolbarButton
      actionId={TOOLBAR_ACTION_IDS.ROTATE}
      label={`회전: ${config.label}`}
      badge={config.badge}
      active={enabled}
      pressed={enabled}
      disabled={disabled}
      disabledReason="회전할 오브젝트를 먼저 선택하세요"
      data-rotation-axis-mode={mode}
      onClick={onClick}
    />
  );
}

function ModeSelector({ editorMode, onEditorModeChange }) {
  return (
    <ToolbarGroup label="편집 영역">
      <ToolbarButton iconKey="world" label="월드 편집" active={editorMode === EDITOR_MODES.WORLD} pressed={editorMode === EDITOR_MODES.WORLD} onClick={() => onEditorModeChange(EDITOR_MODES.WORLD)} />
      <ToolbarButton iconKey="equipment" label="설비 편집" active={editorMode === EDITOR_MODES.EQUIPMENT} pressed={editorMode === EDITOR_MODES.EQUIPMENT} onClick={() => onEditorModeChange(EDITOR_MODES.EQUIPMENT)} />
      <ToolbarButton iconKey="viewer" label="뷰어" active={editorMode === EDITOR_MODES.VIEWER} pressed={editorMode === EDITOR_MODES.VIEWER} onClick={() => onEditorModeChange(EDITOR_MODES.VIEWER)} />
    </ToolbarGroup>
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
        <ToolbarIcon iconKey="snap" label="그리드 스냅" />
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

const GROUND_VIEW_ACTIONS = Object.freeze([
  [GROUND_VIEW_MODES.VISIBLE, TOOLBAR_ACTION_IDS.GROUND_VISIBLE],
  [GROUND_VIEW_MODES.TRANSLUCENT, TOOLBAR_ACTION_IDS.GROUND_TRANSLUCENT],
  [GROUND_VIEW_MODES.SECTION, TOOLBAR_ACTION_IDS.GROUND_SECTION],
  [GROUND_VIEW_MODES.HIDDEN, TOOLBAR_ACTION_IDS.GROUND_HIDDEN],
]);

function GroundViewMenu({ value, onChange }) {
  return (
    <div className={styles.menuSection} role="group" aria-label="지면 보기 방식">
      <span className={styles.menuHeading}>지면 보기</span>
      {GROUND_VIEW_ACTIONS.map(([mode, actionId]) => (
        <ToolbarButton
          key={mode}
          menuItem
          actionId={actionId}
          active={value === mode}
          pressed={value === mode}
          onClick={() => onChange?.(mode)}
        />
      ))}
    </div>
  );
}

function OverflowActions({
  hasSelection,
  secondaryActions = [],
  showSelectionActions = true,
  saveStatus,
  showShadowToggle,
  showGroundViewControl,
  showBuildingIsolationToggle,
  buildingIsolationEnabled,
  buildingIsolationAvailable,
  viewerTranslucent,
  viewerTransparencyLabel,
  shadowEnabled,
  groundViewMode,
  onShadowEnabledChange,
  onGroundViewModeChange,
  onBuildingIsolationChange,
  onViewerTransparencyChange,
  onDuplicate,
  onDelete,
  onReset,
  onLoad,
  onSave,
}) {
  return (
    <details className={styles.overflow}>
      <summary aria-label="더 보기" title="더 보기" data-tooltip="더 보기"><ToolbarIcon iconKey="more" label="더 보기" /></summary>
      <div className={styles.overflowMenu}>
        {saveStatus ? <span className={styles.saveStatus}>{saveStatus}</span> : null}
        {showBuildingIsolationToggle || typeof viewerTranslucent === "boolean" ? (
          <div className={styles.mobileOnly} role="group" aria-label="보기·가시성">
            {showBuildingIsolationToggle ? <ToolbarButton
              menuItem
              actionId={TOOLBAR_ACTION_IDS.FOCUS_BUILDING}
              active={buildingIsolationEnabled}
              pressed={buildingIsolationEnabled}
              disabled={!buildingIsolationAvailable}
              disabledReason="건축물을 먼저 선택하세요"
              onClick={() => onBuildingIsolationChange?.(!buildingIsolationEnabled)}
            /> : null}
            {typeof viewerTranslucent === "boolean" ? <ToolbarButton
              menuItem
              actionId={TOOLBAR_ACTION_IDS.BUILDING_TRANSPARENCY}
              label={viewerTransparencyLabel}
              active={viewerTranslucent}
              pressed={viewerTranslucent}
              onClick={() => onViewerTransparencyChange?.(!viewerTranslucent)}
            /> : null}
          </div>
        ) : null}
        {secondaryActions.length ? <div className={styles.menuSection} role="group" aria-label="기타 설정">{secondaryActions}</div> : null}
        {secondaryActions.length ? <ToolbarDivider /> : null}
        {showShadowToggle ? (
          <ToolbarButton
            menuItem
            actionId={TOOLBAR_ACTION_IDS.SHADOW}
            label={`그림자 표시 ${shadowEnabled ? "끄기" : "켜기"}`}
            active={shadowEnabled}
            pressed={shadowEnabled}
            onClick={() => onShadowEnabledChange?.(!shadowEnabled)}
          />
        ) : null}
        {showGroundViewControl ? <GroundViewMenu value={groundViewMode} onChange={onGroundViewModeChange} /> : null}
        {showShadowToggle || showGroundViewControl ? <ToolbarDivider /> : null}
        {showSelectionActions ? (
          <>
            <ToolbarButton menuItem iconKey="duplicate" label="복제" shortcut="Ctrl+D" disabled={!hasSelection} disabledReason="복제할 항목을 먼저 선택하세요" onClick={onDuplicate} />
            <ToolbarButton menuItem iconKey="delete" label="삭제" shortcut="Delete" disabled={!hasSelection} disabledReason="삭제할 항목을 먼저 선택하세요" onClick={onDelete} />
            <ToolbarDivider />
          </>
        ) : null}
        <ToolbarButton menuItem iconKey="reset" label="초기화" onClick={onReset} />
        <ToolbarButton menuItem iconKey="import" label="불러오기" onClick={onLoad} />
        <ToolbarButton menuItem iconKey="save" label="저장" onClick={onSave} />
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
  showMovementPathTool = false,
  showBuildingIsolationToggle = false,
  buildingIsolationEnabled = false,
  buildingIsolationAvailable = false,
  showShadowToggle = false,
  showGroundViewControl = false,
  groundViewMode = GROUND_VIEW_MODES.VISIBLE,
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
  onMovementPathEdit,
  onBuildingIsolationChange,
  onShadowEnabledChange,
  onGroundViewModeChange,
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
    const panelTools = PANEL_TOOL_CONFIG[panelMode] ?? { leading: [], secondary: [], trailing: [] };
    const renderPanelTool = (tool, menuItem = false) => {
      const active = activePanelId === tool.id;
      return (
        <ToolbarButton
          key={tool.id}
          menuItem={menuItem}
          iconKey={tool.iconKey}
          label={tool.label}
          active={active}
          pressed={active}
          disabled={tool.requiresSelection && !hasSelection}
          disabledReason={tool.requiresSelection ? "설정할 항목을 먼저 선택하세요" : ""}
          onClick={() => onPanelChange?.(active ? null : tool.id)}
        />
      );
    };

    return (
      <nav className={styles.toolbar} aria-label={`${hierarchyScopeLabel} 도구`}>
        {panelTools.leading.length ? <ToolbarGroup label="기타 설정">{panelTools.leading.map((tool) => renderPanelTool(tool))}</ToolbarGroup> : null}
        {panelTools.leading.length ? <ToolbarDivider /> : null}
        <ToolbarGroup label="선택·변형">
          {showSiteInteractionTools ? <ToolbarButton
            actionId={TOOLBAR_ACTION_IDS.NAVIGATE}
            active={siteInteractionMode === SITE_INTERACTION_MODES.NAVIGATE}
            pressed={siteInteractionMode === SITE_INTERACTION_MODES.NAVIGATE}
            onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.NAVIGATE)}
          /> : null}
          {showSiteInteractionTools ? <ToolbarButton
            actionId={TOOLBAR_ACTION_IDS.AREA_SELECT}
            active={siteInteractionMode === SITE_INTERACTION_MODES.AREA_SELECT}
            pressed={siteInteractionMode === SITE_INTERACTION_MODES.AREA_SELECT}
            onClick={() => onSiteInteractionModeChange(SITE_INTERACTION_MODES.AREA_SELECT)}
          /> : null}
          <MoveAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("translate")} />
          <RotationAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("rotate")} />
        </ToolbarGroup>
        {showMovementPathTool ? <><ToolbarDivider /><ToolbarGroup label="경로·애니메이션">
          <ToolbarButton
            actionId={TOOLBAR_ACTION_IDS.MOVEMENT_PATH}
            label={siteInteractionMode === SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH ? "이동경로 편집 완료" : "이동경로 편집"}
            active={siteInteractionMode === SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH}
            pressed={siteInteractionMode === SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH}
            onClick={onMovementPathEdit}
          />
        </ToolbarGroup></> : null}
        {showBuildingIsolationToggle || typeof viewerTranslucent === "boolean" ? (
          <><ToolbarDivider /><ToolbarGroup label="보기·가시성" className={styles.responsiveSecondary}>
            {showBuildingIsolationToggle ? (
            <ToolbarButton
              actionId={TOOLBAR_ACTION_IDS.FOCUS_BUILDING}
              active={buildingIsolationEnabled}
              pressed={buildingIsolationEnabled}
              disabled={!buildingIsolationAvailable}
              disabledReason="건축물을 먼저 선택하세요"
              onClick={() => onBuildingIsolationChange?.(!buildingIsolationEnabled)}
            />
            ) : null}
            {typeof viewerTranslucent === "boolean" ? (
            <ToolbarButton
              actionId={TOOLBAR_ACTION_IDS.BUILDING_TRANSPARENCY}
              label={viewerTransparencyLabel}
              active={viewerTranslucent}
              pressed={viewerTranslucent}
              onClick={() => onViewerTransparencyChange?.(!viewerTranslucent)}
            />
            ) : null}
          </ToolbarGroup></>
        ) : null}
        {panelTools.trailing.length ? <><ToolbarDivider /><ToolbarGroup label="층·건축물">{panelTools.trailing.map((tool) => renderPanelTool(tool))}</ToolbarGroup></> : null}
        <ToolbarDivider />
        <ToolbarGroup label="편집 이력">
          <ToolbarButton actionId={TOOLBAR_ACTION_IDS.UNDO} disabled={!canUndo} disabledReason="되돌릴 작업이 없습니다" onClick={onUndo} />
          <ToolbarButton actionId={TOOLBAR_ACTION_IDS.REDO} disabled={!canRedo} disabledReason="다시 실행할 작업이 없습니다" onClick={onRedo} />
        </ToolbarGroup>
        <ToolbarDivider />
        <GridSnapControl enabled={gridSnapEnabled} snapSize={snapSize} onToggle={onGridSnapChange} onSnapSizeChange={onSnapSizeChange} />
        <ToolbarDivider />
        <OverflowActions
          hasSelection={hasSelection}
          secondaryActions={panelTools.secondary.map((tool) => renderPanelTool(tool, true))}
          showSelectionActions={showSelectionActions}
          saveStatus={saveStatus}
          showShadowToggle={showShadowToggle}
          showGroundViewControl={showGroundViewControl}
          showBuildingIsolationToggle={showBuildingIsolationToggle}
          buildingIsolationEnabled={buildingIsolationEnabled}
          buildingIsolationAvailable={buildingIsolationAvailable}
          viewerTranslucent={viewerTranslucent}
          viewerTransparencyLabel={viewerTransparencyLabel}
          shadowEnabled={shadowEnabled}
          groundViewMode={groundViewMode}
          onShadowEnabledChange={onShadowEnabledChange}
          onGroundViewModeChange={onGroundViewModeChange}
          onBuildingIsolationChange={onBuildingIsolationChange}
          onViewerTransparencyChange={onViewerTransparencyChange}
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
      <ToolbarDivider />
      <ToolbarGroup label="편집 이력">
        <ToolbarButton actionId={TOOLBAR_ACTION_IDS.UNDO} disabled={!canUndo} disabledReason="되돌릴 작업이 없습니다" onClick={onUndo} />
        <ToolbarButton actionId={TOOLBAR_ACTION_IDS.REDO} disabled={!canRedo} disabledReason="다시 실행할 작업이 없습니다" onClick={onRedo} />
      </ToolbarGroup>
      <ToolbarDivider />
      <ToolbarGroup label="보기·가시성">
        <ToolbarButton iconKey="layout-2d" label="2D 배치" active={viewMode === VIEW_MODES.LAYOUT_2D} pressed={viewMode === VIEW_MODES.LAYOUT_2D} onClick={() => onViewModeChange(VIEW_MODES.LAYOUT_2D)} />
        <ToolbarButton iconKey="view-3d" label="3D 보기" active={viewMode === VIEW_MODES.VIEW_3D} pressed={viewMode === VIEW_MODES.VIEW_3D} onClick={() => onViewModeChange(VIEW_MODES.VIEW_3D)} />
      </ToolbarGroup>

      {!isViewer ? (
        <>
          <ToolbarDivider />
          <ToolbarGroup label="선택·변형">
            <MoveAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("translate")} />
            <RotationAxisButton transformTools={transformTools} disabled={!hasTransformSelection} onClick={() => onTransformToolToggle("rotate")} />
          </ToolbarGroup>
          <ToolbarDivider />
          <GridSnapControl enabled={gridSnapEnabled} snapSize={snapSize} onToggle={onGridSnapChange} onSnapSizeChange={onSnapSizeChange} />
          {editorMode === EDITOR_MODES.WORLD ? (
            <ToolbarButton iconKey={worldLocked ? "lock" : "unlock"} label={worldLocked ? "월드 잠금 해제" : "월드 잠금"} active={worldLocked} pressed={worldLocked} onClick={() => onToggleWorldLock(!worldLocked)} />
          ) : null}
          <ToolbarDivider />
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
