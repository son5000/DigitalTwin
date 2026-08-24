import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowRightIcon, MoonIcon, SaveIcon, SunIcon, WorldIcon } from "@/components/icons";
import { loadLayout, saveLayout } from "@/features/digitalTwin/editor/api/layoutRepository";
import BuildingDetailNavigator from "@/features/digitalTwin/editor/components/BuildingDetailNavigator";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import EnvironmentSettingsPanel from "@/features/digitalTwin/editor/components/EnvironmentSettingsPanel";
import EquipmentLibrary from "@/features/digitalTwin/editor/components/EquipmentLibrary";
import EquipmentProperties from "@/features/digitalTwin/editor/components/EquipmentProperties";
import FloatingPanel from "@/features/digitalTwin/editor/components/FloatingPanel";
import FloorPlanNavigator from "@/features/digitalTwin/editor/components/FloorPlanNavigator";
import MonitoringSettingsPanel from "@/features/digitalTwin/editor/components/MonitoringSettingsPanel";
import ObjectDetailPanel from "@/features/digitalTwin/editor/components/ObjectDetailPanel";
import SiteAuthoringPanel from "@/features/digitalTwin/editor/components/SiteAuthoringPanel";
import ViewModeToggle from "@/features/digitalTwin/editor/components/ViewModeToggle";
import WorldHierarchyPanel from "@/features/digitalTwin/editor/components/WorldHierarchyPanel";
import WorldPanelRail from "@/features/digitalTwin/editor/components/WorldPanelRail";
import WorldStructureLibrary from "@/features/digitalTwin/editor/components/WorldStructureLibrary";
import WorldStructureProperties from "@/features/digitalTwin/editor/components/WorldStructureProperties";
import WorldWizardStepper from "@/features/digitalTwin/editor/components/WorldWizardStepper";
import {
  BUILDING_SETTINGS_TABS,
  BUILDING_SETTING_STATUS,
  BUILDING_VIEW_MODES,
  getBuildingSettingStatus,
  getOverallBuildingSettingStatus,
} from "@/features/digitalTwin/editor/constants/buildingDetail";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getDefaultObjectVariants, OBJECT_LIBRARY_DEFINITION_MAP } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { intersectAreaWithSite } from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { ENVIRONMENT_TEMPLATE_IDS, getWizardStepIndex, WORLD_WIZARD_STEP_IDS, WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import FloorPlan3DScene from "@/features/digitalTwin/editor/three/FloorPlan3DScene";
import FloorPlanScene from "@/features/digitalTwin/editor/three/FloorPlanScene";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";

import styles from "./DigitalTwinEditorPage.module.css";

const FLOOR_PLAN_TEMPLATE_IDS = Object.freeze(["ROOM", "CORRIDOR", "WALL", "DOOR", "PASSAGE", "STAIR", "STAIRWELL", "ELEVATOR", "SHAFT"]);
const WORKSPACE_VIEWS = Object.freeze({ PLAN_2D: "PLAN_2D", SPACE_3D: "SPACE_3D" });
const WORKSPACE_MODES = Object.freeze({ PLAN: "PLAN", EQUIPMENT: "EQUIPMENT" });
const VIEW_SCOPES = Object.freeze({ FLOOR: "FLOOR", BUILDING: "BUILDING" });

function isFormTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export default function DigitalTwinEditorPage() {
  const editor = useDigitalTwinEditorState();
  const { theme, toggleTheme } = useEditorTheme();
  const [wizardStepId, setWizardStepId] = useState(WORLD_WIZARD_STEP_IDS.COMPOSITION);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [activeFloatingPanelId, setActiveFloatingPanelId] = useState(null);
  const [siteAreaSelection, setSiteAreaSelection] = useState(null);
  const [siteInteractionMode, setSiteInteractionMode] = useState(SITE_INTERACTION_MODES.NAVIGATE);
  const [activeSiteTemplateId, setActiveSiteTemplateId] = useState(null);
  const [activeSiteVariants, setActiveSiteVariants] = useState({});
  const [sitePlacementNotice, setSitePlacementNotice] = useState("");
  const [isBuildingListOpen, setIsBuildingListOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [buildingSettingsTab, setBuildingSettingsTab] = useState(BUILDING_SETTINGS_TABS.EXTERIOR);
  const [buildingViewMode, setBuildingViewMode] = useState(BUILDING_VIEW_MODES.EXTERIOR);
  const [buildingFocusMode, setBuildingFocusMode] = useState(false);
  const [showLowerFloorReference, setShowLowerFloorReference] = useState(false);
  const [workspaceView, setWorkspaceView] = useState(WORKSPACE_VIEWS.PLAN_2D);
  const [workspaceMode, setWorkspaceMode] = useState(WORKSPACE_MODES.PLAN);
  const [viewScope, setViewScope] = useState(VIEW_SCOPES.FLOOR);
  const [equipmentTargetFloorIds, setEquipmentTargetFloorIds] = useState([]);
  const buildingSaveRequestRef = useRef(0);
  const siteWorldCameraStateRef = useRef(null);

  const {
    updateSiteEnvironment, resetLayout, hydrateLayout, updateBuilding,
    addSiteObjectFromArea, addSiteObjectsFromArea, selectSiteObject, updateSiteObject,
    duplicateSelectedSiteEntity, removeSelectedSiteObject, deleteHierarchyNode,
    selectBuilding, navigateToSite, navigateToFloor, selectFloorInBuilding,
    clearSelection, setViewMode, toggleTransformTool, setSnapSize, setGridSnapEnabled,
    setWorldStructuresLocked, undo, redo,
    selectFloorPlanTemplate, addFloorPlanStructure, updateFloorPlanStructure,
    selectFloorPlanStructure, removeSelectedFloorPlanStructure, duplicateSelectedFloorPlanStructure,
    copyPreviousFloorPlan, applyFloorPlanToFloors, toggleFloorPlanVisibilityFilter,
    selectFloorEquipmentTemplate, addFloorEquipment, updateFloorEquipment, selectFloorEquipment,
    removeSelectedFloorEquipment, duplicateSelectedFloorEquipment,
    addObservationPoint, updateObservationPoint, selectObservationPoint,
    addMonitoringDevice, updateMonitoringDevice, selectMonitoringDevice,
    addMonitoringBinding, updateMonitoringBinding, selectMonitoringBinding,
    toggleFavorite,
  } = editor.actions;

  const wizardStepIndex = getWizardStepIndex(wizardStepId);
  const wizardStep = WORLD_WIZARD_STEPS[wizardStepIndex];
  const isCompositionStep = wizardStepId === WORLD_WIZARD_STEP_IDS.COMPOSITION;
  const isFloorWorkspaceStep = wizardStepId === WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT;
  const isMonitoringStep = wizardStepId === WORLD_WIZARD_STEP_IDS.MONITORING;
  const focusedBuilding = editor.selectedBuilding ?? editor.currentBuilding ?? editor.buildings[0] ?? null;
  const selectedBuildingId = focusedBuilding?.id ?? null;
  const buildingFloors = useMemo(
    () => editor.floors.filter((floor) => floor.parentId === focusedBuilding?.id).sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    [editor.floors, focusedBuilding?.id],
  );
  const selectedFloor = editor.currentFloor?.parentId === focusedBuilding?.id ? editor.currentFloor : buildingFloors[0] ?? null;
  const lowerFloorStructures = useMemo(() => {
    const index = buildingFloors.findIndex((floor) => floor.id === selectedFloor?.id);
    return index > 0 ? editor.floorPlansById[buildingFloors[index - 1].id]?.structures ?? [] : [];
  }, [buildingFloors, editor.floorPlansById, selectedFloor?.id]);
  const currentFloorSpaces = editor.floorPlanStructures.filter((item) => ["ROOM", "CORRIDOR"].includes(item.type));
  const environmentSiteObjects = useMemo(() => editor.siteObjects.filter((item) => ENVIRONMENT_TEMPLATE_IDS.includes(item.type)), [editor.siteObjects]);
  const buildingSettingStatusById = useMemo(
    () => Object.fromEntries(editor.buildings.map((building) => [building.id, getOverallBuildingSettingStatus(building)])),
    [editor.buildings],
  );
  const selectedBuildingTabStatus = getBuildingSettingStatus(focusedBuilding, buildingSettingsTab);
  const incompleteBuildingCount = editor.buildings.filter((building) => buildingSettingStatusById[building.id] !== BUILDING_SETTING_STATUS.COMPLETE).length;
  const hasSiteSelection = Boolean(editor.selectedBuilding || editor.selectedSiteObject);
  const activeWorkspaceSelection = workspaceMode === WORKSPACE_MODES.PLAN ? editor.selectedFloorPlanStructure : editor.selectedFloorEquipment;
  const sitePlacementPlan = useMemo(() => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[activeSiteTemplateId];
    if (!siteAreaSelection || !definition) return null;
    const area = intersectAreaWithSite(siteAreaSelection, editor.siteEnvironment);
    return area ? placeObjectsInArea({ area, object: definition, gridEnabled: editor.gridSettings.enabled, cellSize: area.cellSize ?? editor.gridSettings.baseSize }) : null;
  }, [activeSiteTemplateId, editor.gridSettings.baseSize, editor.gridSettings.enabled, editor.siteEnvironment, siteAreaSelection]);

  useEffect(() => {
    if (!isCompositionStep || !hasUnsavedChanges) return undefined;
    const requestId = ++buildingSaveRequestRef.current;
    const timerId = window.setTimeout(() => {
      setIsSaving(true);
      try {
        const payload = saveLayout(editor.layoutDocument);
        if (requestId === buildingSaveRequestRef.current) {
          setHasUnsavedChanges(false);
          setSaveStatus(`건축물 자동 저장 · ${new Date(payload.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
        }
      } catch {
        if (requestId === buildingSaveRequestRef.current) setSaveStatus("건축물 설정을 자동 저장하지 못했습니다");
      } finally {
        if (requestId === buildingSaveRequestRef.current) setIsSaving(false);
      }
    }, 350);
    return () => window.clearTimeout(timerId);
  }, [editor.layoutDocument, hasUnsavedChanges, isCompositionStep]);

  useEffect(() => {
    if (!isMonitoringStep || editor.selectedFloorEquipmentId || editor.buildingFloorEquipment.length === 0) return;
    selectFloorEquipment(editor.buildingFloorEquipment[0].id);
  }, [editor.buildingFloorEquipment, editor.selectedFloorEquipmentId, isMonitoringStep, selectFloorEquipment]);

  const resetSiteInteraction = useCallback((mode = SITE_INTERACTION_MODES.NAVIGATE) => {
    setSiteInteractionMode(mode);
    setActiveSiteTemplateId(null);
    setActiveSiteVariants({});
    setSiteAreaSelection(null);
    setSitePlacementNotice("");
  }, []);
  const handleSiteEnvironmentChange = useCallback((changes) => {
    const next = { ...editor.siteEnvironment, ...changes };
    setSiteAreaSelection((current) => current ? intersectAreaWithSite(current, next) : null);
    updateSiteEnvironment(changes);
  }, [editor.siteEnvironment, updateSiteEnvironment]);
  const handleSiteInteractionModeChange = useCallback((mode) => {
    resetSiteInteraction(mode);
    selectBuilding(null);
    selectSiteObject(null);
    setBuildingFocusMode(false);
    setActiveFloatingPanelId(null);
  }, [resetSiteInteraction, selectBuilding, selectSiteObject]);
  const handleSiteTemplateSelect = useCallback((templateId) => {
    const same = siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT && activeSiteTemplateId === templateId;
    setActiveSiteTemplateId(same ? null : templateId);
    setActiveSiteVariants(same ? {} : getDefaultObjectVariants(OBJECT_LIBRARY_DEFINITION_MAP[templateId]));
    setSiteInteractionMode(same ? SITE_INTERACTION_MODES.NAVIGATE : SITE_INTERACTION_MODES.PLACE_OBJECT);
    setSitePlacementNotice("");
    selectBuilding(null);
    selectSiteObject(null);
    setBuildingFocusMode(false);
  }, [activeSiteTemplateId, selectBuilding, selectSiteObject, siteInteractionMode]);
  const handleSiteTemplatePlace = useCallback((templateId, area, variants = activeSiteVariants) => {
    const id = templateId && area ? addSiteObjectFromArea(templateId, area, variants) : null;
    if (!id) return;
    setSitePlacementNotice("오브젝트 1개를 배치했습니다.");
    resetSiteInteraction();
    setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
  }, [activeSiteVariants, addSiteObjectFromArea, resetSiteInteraction]);
  const completeAreaPlacement = useCallback((templateId, area, variants = activeSiteVariants) => {
    if (!templateId || !area) return null;
    const result = addSiteObjectsFromArea(templateId, area, variants);
    setSitePlacementNotice(result.canPlace ? `${result.count}개 오브젝트를 배치했습니다.` : result.message);
    if (result.canPlace) {
      resetSiteInteraction();
      setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    }
    return result;
  }, [activeSiteVariants, addSiteObjectsFromArea, resetSiteInteraction]);
  const handleSiteBuildingSelect = useCallback((buildingId) => {
    resetSiteInteraction();
    selectBuilding(buildingId);
    setBuildingFocusMode(Boolean(buildingId));
    setActiveFloatingPanelId(buildingId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectBuilding]);
  const handleSiteObjectSelect = useCallback((objectId) => {
    resetSiteInteraction();
    selectSiteObject(objectId);
    setBuildingFocusMode(false);
    setActiveFloatingPanelId(objectId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectSiteObject]);
  const handleBuildingChange = useCallback((changes) => {
    if (!selectedBuildingId) return;
    updateBuilding(selectedBuildingId, { ...changes, settingStatus: { exterior: BUILDING_SETTING_STATUS.IN_PROGRESS } });
    setHasUnsavedChanges(true);
  }, [selectedBuildingId, updateBuilding]);
  const handleBuildingTabChange = useCallback((tab) => {
    setBuildingSettingsTab(tab);
    setBuildingViewMode(tab === BUILDING_SETTINGS_TABS.INTERIOR ? BUILDING_VIEW_MODES.INTERIOR : BUILDING_VIEW_MODES.EXTERIOR);
  }, []);
  const handleBuildingComplete = useCallback(() => {
    if (!selectedBuildingId) return;
    const key = buildingSettingsTab === BUILDING_SETTINGS_TABS.INTERIOR ? "interiorBasics" : "exterior";
    updateBuilding(selectedBuildingId, { settingStatus: { [key]: BUILDING_SETTING_STATUS.COMPLETE } });
    setHasUnsavedChanges(true);
  }, [buildingSettingsTab, selectedBuildingId, updateBuilding]);
  const handleAdjacentBuilding = useCallback((offset) => {
    const index = editor.buildings.findIndex((item) => item.id === selectedBuildingId);
    const next = editor.buildings[index + offset];
    if (next) handleSiteBuildingSelect(next.id);
  }, [editor.buildings, handleSiteBuildingSelect, selectedBuildingId]);
  const handleDeleteSiteSelection = useCallback(() => {
    if (editor.selectedSiteObject) removeSelectedSiteObject();
    else if (editor.selectedBuilding) deleteHierarchyNode(editor.selectedBuilding.id);
    setBuildingFocusMode(false);
    setActiveFloatingPanelId(null);
  }, [deleteHierarchyNode, editor.selectedBuilding, editor.selectedSiteObject, removeSelectedSiteObject]);

  const handlePlanAdd = useCallback((templateId, position) => {
    const id = addFloorPlanStructure(templateId, position, { buildingId: focusedBuilding?.id, floorId: selectedFloor?.id });
    if (id) setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    return id;
  }, [addFloorPlanStructure, focusedBuilding?.id, selectedFloor?.id]);
  const handlePlanSelect = useCallback((id) => {
    selectFloorPlanStructure(id);
    setActiveFloatingPanelId(id ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [selectFloorPlanStructure]);
  const handlePlanChange = useCallback((changes) => {
    if (editor.selectedFloorPlanStructureId) updateFloorPlanStructure(editor.selectedFloorPlanStructureId, changes);
  }, [editor.selectedFloorPlanStructureId, updateFloorPlanStructure]);
  const handleFloorEquipmentAdd = useCallback((templateId, position) => {
    const targetFloorIds = [...new Set([selectedFloor?.id, ...equipmentTargetFloorIds].filter(Boolean))];
    const ids = addFloorEquipment(templateId, position, { floorId: selectedFloor?.id, targetFloorIds });
    if (ids.length) setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    return ids;
  }, [addFloorEquipment, equipmentTargetFloorIds, selectedFloor?.id]);
  const handleFloorEquipmentSelect = useCallback((id) => {
    selectFloorEquipment(id);
    setActiveFloatingPanelId(id ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [selectFloorEquipment]);
  const handleFloorEquipmentChange = useCallback((changes) => {
    if (editor.selectedFloorEquipmentId) updateFloorEquipment(editor.selectedFloorEquipmentId, changes);
  }, [editor.selectedFloorEquipmentId, updateFloorEquipment]);

  const enterStep = useCallback((stepId, allowForward = true) => {
    const targetIndex = getWizardStepIndex(stepId);
    if (!allowForward && targetIndex > furthestStepIndex) return;
    setFurthestStepIndex((current) => Math.max(current, targetIndex));
    setWizardStepId(stepId);
    resetSiteInteraction();
    setBuildingFocusMode(false);
    if (stepId === WORLD_WIZARD_STEP_IDS.COMPOSITION) {
      navigateToSite();
      setActiveFloatingPanelId(null);
      return;
    }
    const floor = selectedFloor ?? editor.floors.find((item) => item.parentId === focusedBuilding?.id);
    if (floor) navigateToFloor(floor.id);
    setActiveFloatingPanelId(stepId === WORLD_WIZARD_STEP_IDS.MONITORING ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [editor.floors, focusedBuilding?.id, furthestStepIndex, navigateToFloor, navigateToSite, resetSiteInteraction, selectedFloor]);
  const handlePrimaryAction = useCallback(() => {
    if (isCompositionStep) {
      if (incompleteBuildingCount > 0 && !window.confirm(`설정이 완료되지 않은 건축물이 ${incompleteBuildingCount}개 있습니다. 그래도 이동하시겠습니까?`)) return;
      enterStep(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT);
    } else if (isFloorWorkspaceStep) {
      enterStep(WORLD_WIZARD_STEP_IDS.MONITORING);
    } else {
      try {
        const payload = saveLayout(editor.layoutDocument);
        setSaveStatus(`관측 설정 저장 · ${new Date(payload.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setSaveStatus("저장하지 못했습니다");
      }
    }
  }, [editor.layoutDocument, enterStep, incompleteBuildingCount, isCompositionStep, isFloorWorkspaceStep]);
  const handleLoad = useCallback(() => {
    const saved = loadLayout();
    setSaveStatus(saved && hydrateLayout(saved) ? "저장된 월드를 불러왔습니다" : "저장된 배치가 없습니다");
    enterStep(WORLD_WIZARD_STEP_IDS.COMPOSITION);
  }, [enterStep, hydrateLayout]);
  const handleReset = useCallback(() => {
    resetLayout();
    enterStep(WORLD_WIZARD_STEP_IDS.COMPOSITION);
    setFurthestStepIndex(0);
    setSaveStatus("새 월드로 초기화했습니다");
  }, [enterStep, resetLayout]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        clearSelection();
        selectFloorPlanStructure(null);
        selectFloorEquipment(null);
        setActiveFloatingPanelId(null);
        return;
      }
      if (isFormTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (isCompositionStep) handleDeleteSiteSelection();
        else if (isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN) removeSelectedFloorPlanStructure();
        else if (isFloorWorkspaceStep) removeSelectedFloorEquipment();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (isCompositionStep) duplicateSelectedSiteEntity();
        else if (workspaceMode === WORKSPACE_MODES.PLAN) duplicateSelectedFloorPlanStructure();
        else duplicateSelectedFloorEquipment();
      }
      if (event.key.toLowerCase() === "w") toggleTransformTool("translate");
      if (event.key.toLowerCase() === "e") toggleTransformTool("rotate");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, duplicateSelectedFloorEquipment, duplicateSelectedFloorPlanStructure, duplicateSelectedSiteEntity, handleDeleteSiteSelection, isCompositionStep, isFloorWorkspaceStep, redo, removeSelectedFloorEquipment, removeSelectedFloorPlanStructure, selectFloorEquipment, selectFloorPlanStructure, toggleTransformTool, undo, workspaceMode]);

  const primaryDisabled = (isCompositionStep && editor.buildings.length === 0) || ((isFloorWorkspaceStep || isMonitoringStep) && !selectedFloor);
  const contextIcon = isCompositionStep ? "SITE" : isFloorWorkspaceStep ? "FLOOR" : "EQUIPMENT";
  const stageContext = isCompositionStep
    ? `${editor.siteEnvironment.width.toFixed(0)} × ${editor.siteEnvironment.depth.toFixed(0)} m · 건축물 ${editor.buildings.length} · 환경 ${environmentSiteObjects.length}`
    : `${focusedBuilding?.name ?? "건축물 미선택"} · ${selectedFloor?.name ?? "층 미선택"}`;
  const panelTitle = isCompositionStep
    ? activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? "Object Library" : activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? "Site Settings" : activeFloatingPanelId === WORLD_PANEL_IDS.HIERARCHY ? "Hierarchy" : "Building / Object Settings"
    : isFloorWorkspaceStep
      ? activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (workspaceMode === WORKSPACE_MODES.PLAN ? "Floor Plan Tools" : "Equipment Library") : (workspaceMode === WORKSPACE_MODES.PLAN ? "Plan Element Detail" : "Equipment Placement Detail")
      : "Equipment Monitoring";
  const panelOpen = isMonitoringStep || (Boolean(activeFloatingPanelId) && (!isCompositionStep || activeFloatingPanelId !== WORLD_PANEL_IDS.DETAILS || hasSiteSelection));
  const targetFloorIds = equipmentTargetFloorIds.filter((id) => buildingFloors.some((floor) => floor.id === id) && id !== selectedFloor?.id);

  return (
    <main className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true"><WorldIcon size={24} /></div>
        <div className={styles.headerMeta}><span>{stageContext}</span></div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}
          title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}
        >
          <span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={19} /> : <SunIcon size={19} />}</span>
        </button>
      </header>

      <div className={styles.workspace}>
        <div className={styles.sceneArea} data-scene-area>
          <div className={styles.topNavigationRow} data-camera-safe-ui>
            <div className={styles.stepNavigation}><WorldWizardStepper activeStepId={wizardStepId} furthestStepIndex={furthestStepIndex} onStepChange={(id) => enterStep(id, false)} /></div>
            <section className={styles.stageGuide}><div className={styles.stageIdentity}><span>{wizardStepIndex + 1}</span><h2>{wizardStep.label}</h2></div><button type="button" disabled={primaryDisabled} title={primaryDisabled ? "건축물과 층을 먼저 선택하세요" : wizardStep.primaryLabel} onClick={handlePrimaryAction}>{isMonitoringStep ? <SaveIcon size={16} /> : <ArrowRightIcon size={16} />}<span>{isMonitoringStep ? "저장" : "다음"}</span></button></section>
          </div>

          {isFloorWorkspaceStep ? (
            <div className={styles.workspaceControls} data-camera-safe-ui>
              <div role="group" aria-label="편집 모드"><button type="button" className={workspaceMode === WORKSPACE_MODES.PLAN ? styles.activeControl : ""} onClick={() => { setWorkspaceMode(WORKSPACE_MODES.PLAN); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}>도면 편집</button><button type="button" className={workspaceMode === WORKSPACE_MODES.EQUIPMENT ? styles.activeControl : ""} onClick={() => { setWorkspaceMode(WORKSPACE_MODES.EQUIPMENT); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}>설비 배치</button></div>
              <div role="group" aria-label="보기 방식"><button type="button" className={workspaceView === WORKSPACE_VIEWS.PLAN_2D ? styles.activeControl : ""} onClick={() => setWorkspaceView(WORKSPACE_VIEWS.PLAN_2D)}>2D 평면도</button><button type="button" className={workspaceView === WORKSPACE_VIEWS.SPACE_3D ? styles.activeControl : ""} onClick={() => setWorkspaceView(WORKSPACE_VIEWS.SPACE_3D)}>3D 공간 보기</button></div>
              {workspaceView === WORKSPACE_VIEWS.SPACE_3D ? <div role="group" aria-label="3D 표시 범위"><button type="button" className={viewScope === VIEW_SCOPES.FLOOR ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.FLOOR)}>현재 층</button><button type="button" className={viewScope === VIEW_SCOPES.BUILDING ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.BUILDING)}>전체 건축물</button></div> : null}
            </div>
          ) : null}

          <div key={wizardStepId} className={styles.sceneTransition}>
            {isCompositionStep ? (
              <SiteOverviewScene
                siteEnvironment={editor.siteEnvironment} buildings={editor.buildings} floors={editor.floors} siteObjects={editor.siteObjects}
                selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId}
                selectedFloorId={buildingViewMode === BUILDING_VIEW_MODES.INTERIOR ? selectedFloor?.id : null}
                interiorBuildingId={buildingViewMode === BUILDING_VIEW_MODES.INTERIOR ? editor.selectedBuilding?.id ?? null : null}
                focusRequestKey={editor.navigationContext.transitionId} focusMode={buildingFocusMode} cameraStateRef={siteWorldCameraStateRef}
                interactionMode={siteInteractionMode} placementTemplateId={activeSiteTemplateId} placementVariants={activeSiteVariants}
                areaSelection={siteAreaSelection} theme={theme} viewMode={editor.viewMode} transformTools={editor.transformTools}
                gridSettings={editor.gridSettings} gridScopeId={editor.hierarchy.rootId}
                onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect}
                onUpdateBuilding={(id, changes) => id === selectedBuildingId ? handleBuildingChange(changes) : updateBuilding(id, changes)}
                onUpdateSiteObject={updateSiteObject} onEnterBuilding={handleSiteBuildingSelect} onSelectFloor={selectFloorInBuilding}
                onEnterFloor={(floorId) => { navigateToFloor(floorId); setFurthestStepIndex((current) => Math.max(current, 1)); setWizardStepId(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT); setBuildingFocusMode(false); resetSiteInteraction(); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}
                onAreaSelectionChange={setSiteAreaSelection} onPlaceTemplate={handleSiteTemplatePlace} onPlaceTemplateArea={completeAreaPlacement}
              />
            ) : isFloorWorkspaceStep && workspaceView === WORKSPACE_VIEWS.PLAN_2D ? (
              <FloorPlanScene
                building={focusedBuilding} floor={selectedFloor} floors={buildingFloors} structures={editor.floorPlanStructures}
                verticalStructures={editor.activeVerticalStructures} selectedStructureId={editor.selectedFloorPlanStructureId}
                activeTemplateId={workspaceMode === WORKSPACE_MODES.PLAN ? editor.activeFloorPlanTemplateId : null}
                transformTools={editor.transformTools} gridSettings={editor.gridSettings} theme={theme}
                showLowerFloorReference={showLowerFloorReference} lowerFloorStructures={lowerFloorStructures}
                buildingVerticalStructureCount={editor.verticalStructuresByBuildingId[focusedBuilding?.id]?.length ?? 0}
                onAdd={handlePlanAdd} onSelect={handlePlanSelect} onTransform={updateFloorPlanStructure}
                editMode={workspaceMode} equipmentInstances={editor.activeFloorEquipment}
                selectedEquipmentId={editor.selectedFloorEquipmentId}
                activeEquipmentTemplateId={workspaceMode === WORKSPACE_MODES.EQUIPMENT ? editor.activeFloorEquipmentTemplateId : null}
                onEquipmentAdd={handleFloorEquipmentAdd} onEquipmentSelect={handleFloorEquipmentSelect} onEquipmentTransform={updateFloorEquipment}
                externalStatus={editor.floorPlanValidationMessage}
              />
            ) : (
              <FloorPlan3DScene
                building={focusedBuilding} floors={buildingFloors} currentFloor={selectedFloor}
                floorPlansById={editor.floorPlansById} verticalStructures={editor.verticalStructuresByBuildingId[focusedBuilding?.id] ?? []}
                equipmentByFloorId={editor.equipmentByFloorId} viewScope={isMonitoringStep ? VIEW_SCOPES.BUILDING : viewScope}
                editMode={workspaceMode} activePlanTemplateId={isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN ? editor.activeFloorPlanTemplateId : null}
                activeEquipmentTemplateId={isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.EQUIPMENT ? editor.activeFloorEquipmentTemplateId : null}
                selectedStructureId={editor.selectedFloorPlanStructureId} selectedEquipmentId={editor.selectedFloorEquipmentId}
                theme={theme} observationPoints={editor.observationPoints} monitoringDevices={editor.monitoringDevices}
                monitoringBindings={editor.monitoringBindings} monitoringMode={isMonitoringStep}
                transformTools={editor.transformTools}
                onPlanTransform={updateFloorPlanStructure} onEquipmentTransform={updateFloorEquipment}
                onPlanAdd={handlePlanAdd} onEquipmentAdd={handleFloorEquipmentAdd}
                onPlanSelect={handlePlanSelect} onEquipmentSelect={handleFloorEquipmentSelect} onObservationPointAdd={addObservationPoint}
                externalStatus={editor.floorPlanValidationMessage}
              />
            )}
          </div>

          <EditorToolbar
            focusedScope hierarchyScopeLabel={wizardStep.contextLabel} contextIcon={contextIcon}
            showSelectionActions={!isMonitoringStep} showSiteInteractionTools={isCompositionStep}
            siteInteractionMode={siteInteractionMode} editorMode={workspaceMode === WORKSPACE_MODES.PLAN ? EDITOR_MODES.WORLD : EDITOR_MODES.EQUIPMENT}
            viewMode={isCompositionStep ? editor.viewMode : workspaceView === WORKSPACE_VIEWS.PLAN_2D ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D}
            transformTools={editor.transformTools} snapSize={editor.snapSize} gridSnapEnabled={editor.gridSettings.enabled}
            hasSelection={isCompositionStep ? hasSiteSelection : Boolean(activeWorkspaceSelection)} worldLocked={false}
            saveStatus={saveStatus} canUndo={editor.canUndo} canRedo={editor.canRedo}
            onEditorModeChange={() => {}} onSiteInteractionModeChange={handleSiteInteractionModeChange} onViewModeChange={setViewMode}
            onTransformToolToggle={toggleTransformTool} onSnapSizeChange={setSnapSize} onGridSnapChange={setGridSnapEnabled}
            onToggleWorldLock={setWorldStructuresLocked}
            onDuplicate={isCompositionStep ? duplicateSelectedSiteEntity : workspaceMode === WORKSPACE_MODES.PLAN ? duplicateSelectedFloorPlanStructure : duplicateSelectedFloorEquipment}
            onDelete={isCompositionStep ? handleDeleteSiteSelection : workspaceMode === WORKSPACE_MODES.PLAN ? removeSelectedFloorPlanStructure : removeSelectedFloorEquipment}
            onReset={handleReset} onLoad={handleLoad} onSave={handlePrimaryAction} onUndo={undo} onRedo={redo}
          />
          {isCompositionStep ? <ViewModeToggle value={editor.viewMode} onChange={setViewMode} /> : null}
          {isCompositionStep ? <WorldPanelRail activePanelId={activeFloatingPanelId} hasSelection={hasSiteSelection} onPanelChange={setActiveFloatingPanelId} /> : null}
          {isFloorWorkspaceStep ? <WorldPanelRail mode={workspaceMode === WORKSPACE_MODES.PLAN ? "INTERIOR" : "EQUIPMENT"} activePanelId={activeFloatingPanelId} hasSelection={Boolean(activeWorkspaceSelection)} onPanelChange={setActiveFloatingPanelId} /> : null}
          {isFloorWorkspaceStep ? <FloorPlanNavigator building={focusedBuilding} floors={buildingFloors} currentFloorId={selectedFloor?.id} floorPlansById={editor.floorPlansById} showLowerFloorReference={showLowerFloorReference} onFloorChange={navigateToFloor} onCopyPrevious={copyPreviousFloorPlan} onApplyToFloors={applyFloorPlanToFloors} onShowLowerFloorReferenceChange={setShowLowerFloorReference} /> : null}
        </div>

        <div className={styles.floatingPanelHost}>
          <FloatingPanel open={panelOpen} title={panelTitle} eyebrow={wizardStep.contextLabel} topAligned onClose={isMonitoringStep ? undefined : () => setActiveFloatingPanelId(null)}>
            {isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <SiteAuthoringPanel areaSelection={siteAreaSelection} placementPlan={sitePlacementPlan} placementNotice={sitePlacementNotice} activeTemplateId={activeSiteTemplateId} activeVariants={activeSiteVariants} buildings={editor.buildings} siteObjects={editor.siteObjects} selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId} headingLabel="월드 오브젝트" onClearArea={resetSiteInteraction} onConfirmAreaPlacement={() => completeAreaPlacement(activeSiteTemplateId, siteAreaSelection)} onSelectTemplate={handleSiteTemplateSelect} onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} onVariantsChange={setActiveSiteVariants} />
            ) : isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? (
              <EnvironmentSettingsPanel environment={editor.siteEnvironment} boundaryNotice={editor.siteBoundaryNotice} onChange={handleSiteEnvironmentChange} />
            ) : isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.HIERARCHY ? (
              <WorldHierarchyPanel buildings={editor.buildings} siteObjects={editor.siteObjects} selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId} onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} />
            ) : isCompositionStep ? (
              <>
                {editor.selectedBuilding ? <BuildingDetailNavigator buildings={editor.buildings} selectedBuildingId={editor.selectedBuilding.id} statusById={buildingSettingStatusById} activeTab={buildingSettingsTab} selectedTabStatus={selectedBuildingTabStatus} isOpen={isBuildingListOpen} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} onToggle={() => setIsBuildingListOpen((current) => !current)} onSelect={handleSiteBuildingSelect} onPrevious={() => handleAdjacentBuilding(-1)} onNext={() => handleAdjacentBuilding(1)} onComplete={handleBuildingComplete} /> : null}
                <ObjectDetailPanel building={editor.selectedBuilding} siteObject={editor.selectedSiteObject} floorCount={buildingFloors.length} buildingSettingsTab={buildingSettingsTab} floorPlanSummary={editor.floorPlanSummaryByBuildingId[focusedBuilding?.id]} onBuildingSettingsTabChange={handleBuildingTabChange} onBuildingChange={handleBuildingChange} onOpenFloorPlans={() => enterStep(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT)} onSiteObjectChange={(changes) => editor.selectedSiteObjectId && updateSiteObject(editor.selectedSiteObjectId, changes)} onDeleteSiteObject={handleDeleteSiteSelection} />
              </>
            ) : isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <WorldStructureLibrary activeTemplateId={editor.activeFloorPlanTemplateId} structures={editor.floorPlanStructures} equipment={[]} selectedStructureId={editor.selectedFloorPlanStructureId} visibilityFilters={editor.floorPlanVisibilityFilters} worldLocked={false} activeRoomName={`${focusedBuilding?.name ?? "건축물"} / ${selectedFloor?.name ?? "층"}`} allowedTemplateIds={FLOOR_PLAN_TEMPLATE_IDS} title="층별 도면 도구" eyebrow="FLOOR PLAN EDITOR" badge="도면" treeTitle="현재 층 도면 요소" baseNodeLabel="잠금 기준면" help="도구를 선택한 뒤 현재 층 footprint 안을 클릭해 배치합니다." showLockControl={false} onSelectTemplate={(id) => { selectFloorPlanTemplate(id); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }} onSelectStructure={handlePlanSelect} onSelectEquipment={() => {}} onToggleVisibility={toggleFloorPlanVisibilityFilter} onToggleWorldLock={() => {}} />
            ) : isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN ? (
              <WorldStructureProperties structure={editor.selectedFloorPlanStructure} spaces={focusedBuilding ? [{ id: focusedBuilding.id, name: focusedBuilding.name }] : []} floors={buildingFloors} currentFloorId={selectedFloor?.id} worldLocked={false} onChange={handlePlanChange} />
            ) : isFloorWorkspaceStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <EquipmentLibrary activeTemplateId={editor.activeFloorEquipmentTemplateId} favoriteTemplateIds={editor.favoriteTemplateIds} recentTemplateIds={editor.recentTemplateIds} floors={buildingFloors} currentFloorId={selectedFloor?.id} targetFloorIds={targetFloorIds} onTargetFloorIdsChange={setEquipmentTargetFloorIds} onSelect={(id) => { selectFloorEquipmentTemplate(id); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }} onToggleFavorite={toggleFavorite} />
            ) : isFloorWorkspaceStep ? (
              <EquipmentProperties equipment={editor.selectedFloorEquipment} detailAsset={null} hasCollision={false} snapCandidate={null} placementOnly floors={buildingFloors} spaces={currentFloorSpaces} onChange={handleFloorEquipmentChange} />
            ) : (
              <MonitoringSettingsPanel equipment={editor.buildingFloorEquipment} selectedEquipmentId={editor.selectedFloorEquipmentId} observationPoints={editor.observationPoints} devices={editor.monitoringDevices} bindings={editor.monitoringBindings} selectedPoint={editor.selectedObservationPoint} selectedDevice={editor.selectedMonitoringDevice} selectedBinding={editor.selectedMonitoringBinding} onEquipmentSelect={selectFloorEquipment} onAddPoint={addObservationPoint} onSelectPoint={selectObservationPoint} onUpdatePoint={updateObservationPoint} onAddDevice={addMonitoringDevice} onSelectDevice={selectMonitoringDevice} onUpdateDevice={updateMonitoringDevice} onAddBinding={addMonitoringBinding} onSelectBinding={selectMonitoringBinding} onUpdateBinding={updateMonitoringBinding} />
            )}
          </FloatingPanel>
        </div>
      </div>
    </main>
  );
}
