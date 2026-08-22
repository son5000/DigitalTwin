import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ArrowRightIcon, MoonIcon, SaveIcon, SunIcon, WorldIcon } from "@/components/icons";
import { loadLayout, saveLayout } from "@/features/digitalTwin/editor/api/layoutRepository";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import EnvironmentSettingsPanel from "@/features/digitalTwin/editor/components/EnvironmentSettingsPanel";
import EquipmentLibrary from "@/features/digitalTwin/editor/components/EquipmentLibrary";
import EquipmentProperties from "@/features/digitalTwin/editor/components/EquipmentProperties";
import FloatingPanel from "@/features/digitalTwin/editor/components/FloatingPanel";
import ObjectDetailPanel from "@/features/digitalTwin/editor/components/ObjectDetailPanel";
import RoomLayoutProperties from "@/features/digitalTwin/editor/components/RoomLayoutProperties";
import SiteAuthoringPanel from "@/features/digitalTwin/editor/components/SiteAuthoringPanel";
import ViewModeToggle from "@/features/digitalTwin/editor/components/ViewModeToggle";
import WorldHierarchyPanel from "@/features/digitalTwin/editor/components/WorldHierarchyPanel";
import WorldPanelRail from "@/features/digitalTwin/editor/components/WorldPanelRail";
import WorldWizardStepper from "@/features/digitalTwin/editor/components/WorldWizardStepper";
import { EDITOR_DEPTHS } from "@/features/digitalTwin/editor/constants/editorNavigation";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import {
  getDefaultObjectVariants,
  OBJECT_LIBRARY_DEFINITION_MAP,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import {
  ENVIRONMENT_TEMPLATE_IDS,
  getWizardStepIndex,
  WORLD_WIZARD_STEP_IDS,
  WORLD_WIZARD_STEPS,
} from "@/features/digitalTwin/editor/constants/worldWizard";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import DigitalTwinScene from "@/features/digitalTwin/editor/three/DigitalTwinScene";
import FloorOverviewScene from "@/features/digitalTwin/editor/three/FloorOverviewScene";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";

import styles from "./DigitalTwinEditorPage.module.css";

const DetailView = lazy(() => import("@/features/digitalTwin/editor/components/DetailView"));
const PartEditor = lazy(() => import("@/features/digitalTwin/editor/components/PartEditor"));
const SITE_PLACEMENT_BEHAVIORS = Object.freeze({ SINGLE: "SINGLE", CONTINUOUS: "CONTINUOUS" });

function isFormTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement
    || target.isContentEditable;
}

export default function DigitalTwinEditorPage() {
  const editor = useDigitalTwinEditorState();
  const { theme, toggleTheme } = useEditorTheme();
  const [wizardStepId, setWizardStepId] = useState(WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [activeFloatingPanelId, setActiveFloatingPanelId] = useState(null);
  const [detailViewEquipmentId, setDetailViewEquipmentId] = useState(null);
  const [partViewEquipmentId, setPartViewEquipmentId] = useState(null);
  const [selectedFloorRoomId, setSelectedFloorRoomId] = useState(null);
  const [siteAreaSelection, setSiteAreaSelection] = useState(null);
  const [siteInteractionMode, setSiteInteractionMode] = useState(SITE_INTERACTION_MODES.NAVIGATE);
  const [activeSiteTemplateId, setActiveSiteTemplateId] = useState(null);
  const [activeSiteVariants, setActiveSiteVariants] = useState({});
  const [sitePlacementNotice, setSitePlacementNotice] = useState("");
  const [sitePlacementBehavior] = useState(SITE_PLACEMENT_BEHAVIORS.SINGLE);
  const {
    addEquipment, updateEquipment, addEquipmentPart, updateEquipmentPart,
    duplicateEquipmentPart, removeEquipmentPart, commitPipeSnap,
    removeSelectedEquipment, duplicateSelectedEquipment, updateSiteEnvironment,
    registerDetailAsset, removeDetailAsset, updateDetailAsset, resetLayout,
    hydrateLayout, addRoomToFloor, deleteHierarchyNode, updateBuilding,
    addSiteObjectFromArea, addSiteObjectsFromArea, selectSiteObject, updateSiteObject, duplicateSelectedSiteEntity,
    removeSelectedSiteObject, updateRoomLayout, selectBuilding, navigateToSite,
    navigateToBuilding, selectFloorInBuilding, navigateToFloor, navigateToRoom,
    navigateToEquipment, selectTemplate, toggleFavorite, setEditorMode,
    addWorldStructure, updateWorldStructure, selectWorldStructure,
    setWorldStructuresLocked, selectEquipment, clearSelection, setViewMode,
    setTransformMode, setSnapSize, setGridSnapEnabled, undo, redo,
  } = editor.actions;

  const wizardStepIndex = getWizardStepIndex(wizardStepId);
  const wizardStep = WORLD_WIZARD_STEPS[wizardStepIndex];
  const isWorldCompositionStep = wizardStepId === WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION;
  const isBuildingDetailStep = wizardStepId === WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL;
  const isFloorEquipmentStep = wizardStepId === WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT;
  const isEquipmentDetailStep = wizardStepId === WORLD_WIZARD_STEP_IDS.EQUIPMENT_DETAIL;
  const isSiteScene = isWorldCompositionStep || isBuildingDetailStep;
  const isRoomScene = (isFloorEquipmentStep || isEquipmentDetailStep)
    && [EDITOR_DEPTHS.ROOM, EDITOR_DEPTHS.EQUIPMENT].includes(editor.navigationContext.currentDepth);
  const isFloorOverview = isFloorEquipmentStep && !isRoomScene;

  const focusedBuilding = editor.currentBuilding ?? editor.selectedBuilding ?? editor.buildings[0] ?? null;
  const selectedFloor = editor.currentFloor
    ?? editor.floors.find((floor) => floor.parentId === focusedBuilding?.id)
    ?? null;
  const floorRooms = useMemo(
    () => selectedFloor ? editor.rooms.filter((room) => room.parentId === selectedFloor.id) : [],
    [editor.rooms, selectedFloor],
  );
  const selectedFloorRoom = floorRooms.find((room) => room.id === selectedFloorRoomId) ?? floorRooms[0] ?? null;
  const selectedFloorRoomScene = selectedFloorRoom
    ? editor.layoutDocument.roomScenes[selectedFloorRoom.id]
    : null;
  const environmentSiteObjects = useMemo(
    () => editor.siteObjects.filter((object) => ENVIRONMENT_TEMPLATE_IDS.includes(object.type)),
    [editor.siteObjects],
  );
  const activeGridScopeId = isSiteScene
    ? editor.hierarchy.rootId
    : isFloorOverview
      ? selectedFloor?.id ?? editor.hierarchy.rootId
      : editor.activeRoom?.id ?? editor.hierarchy.rootId;
  const sitePlacementPlan = useMemo(() => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[activeSiteTemplateId];
    if (!siteAreaSelection || !definition) return null;
    return placeObjectsInArea({
      area: siteAreaSelection,
      object: definition,
      gridEnabled: editor.gridSettings.enabled,
      cellSize: siteAreaSelection.cellSize ?? editor.gridSettings.baseSize,
    });
  }, [activeSiteTemplateId, editor.gridSettings.baseSize, editor.gridSettings.enabled, siteAreaSelection]);

  const detailViewEquipment = useMemo(
    () => editor.equipmentInstances.find((equipment) => equipment.id === detailViewEquipmentId) ?? null,
    [detailViewEquipmentId, editor.equipmentInstances],
  );
  const detailViewAsset = useMemo(
    () => editor.detailAssets.find((asset) => asset.id === detailViewEquipment?.detailAssetId) ?? null,
    [detailViewEquipment?.detailAssetId, editor.detailAssets],
  );
  const partViewEquipment = useMemo(
    () => editor.equipmentInstances.find((equipment) => equipment.id === partViewEquipmentId) ?? null,
    [editor.equipmentInstances, partViewEquipmentId],
  );

  useEffect(() => {
    if ((isFloorEquipmentStep || isEquipmentDetailStep) && editor.editorMode !== EDITOR_MODES.EQUIPMENT) {
      setEditorMode(EDITOR_MODES.EQUIPMENT);
    }
  }, [editor.editorMode, isEquipmentDetailStep, isFloorEquipmentStep, setEditorMode]);

  const handleEquipmentChange = useCallback((changes) => {
    if (editor.selectedEquipmentId) updateEquipment(editor.selectedEquipmentId, changes);
  }, [editor.selectedEquipmentId, updateEquipment]);

  const handleEquipmentAdd = useCallback((templateId, position) => {
    addEquipment(templateId, position);
    setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
  }, [addEquipment]);

  const handleEquipmentSelect = useCallback((equipmentId) => {
    selectEquipment(equipmentId);
    setActiveFloatingPanelId(equipmentId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [selectEquipment]);

  const handleTemplateSelect = useCallback((templateId) => {
    selectTemplate(templateId);
    setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS);
  }, [selectTemplate]);

  const handleBuildingChange = useCallback((changes) => {
    if (focusedBuilding) updateBuilding(focusedBuilding.id, changes);
  }, [focusedBuilding, updateBuilding]);

  const handleSiteObjectChange = useCallback((changes) => {
    if (editor.selectedSiteObjectId) updateSiteObject(editor.selectedSiteObjectId, changes);
  }, [editor.selectedSiteObjectId, updateSiteObject]);

  const resetSiteInteraction = useCallback((mode = SITE_INTERACTION_MODES.NAVIGATE) => {
    setSiteInteractionMode(mode);
    setActiveSiteTemplateId(null);
    setActiveSiteVariants({});
    setSiteAreaSelection(null);
    setSitePlacementNotice("");
  }, []);

  const handleSiteInteractionModeChange = useCallback((mode) => {
    resetSiteInteraction(mode);
    selectBuilding(null);
    selectSiteObject(null);
    setActiveFloatingPanelId(null);
  }, [resetSiteInteraction, selectBuilding, selectSiteObject]);

  const handleSiteTemplateSelect = useCallback((templateId) => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[templateId];
    const resolvedVariants = templateId === activeSiteTemplateId
      ? activeSiteVariants
      : getDefaultObjectVariants(definition);
    const isSameTemplate = siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT
      && activeSiteTemplateId === templateId;
    setActiveSiteTemplateId(isSameTemplate ? null : templateId);
    setActiveSiteVariants(isSameTemplate ? {} : resolvedVariants);
    setSiteInteractionMode(isSameTemplate ? SITE_INTERACTION_MODES.NAVIGATE : SITE_INTERACTION_MODES.PLACE_OBJECT);
    setSitePlacementNotice("");
    selectBuilding(null);
    selectSiteObject(null);
  }, [activeSiteTemplateId, activeSiteVariants, selectBuilding, selectSiteObject, siteInteractionMode]);

  const handleSiteTemplatePlace = useCallback((templateId, area, variants = activeSiteVariants) => {
    if (!templateId || !area) return;
    const createdId = addSiteObjectFromArea(templateId, area, variants);
    if (!createdId) return;
    setSitePlacementNotice("오브젝트 1개를 배치했습니다.");
    setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    if (sitePlacementBehavior === SITE_PLACEMENT_BEHAVIORS.SINGLE) {
      setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
      setActiveSiteTemplateId(null);
      setActiveSiteVariants({});
      setSiteAreaSelection(null);
    }
  }, [activeSiteVariants, addSiteObjectFromArea, sitePlacementBehavior]);

  const completeAreaPlacement = useCallback((templateId, area, variants = activeSiteVariants) => {
    if (!templateId || !area) return null;
    const result = addSiteObjectsFromArea(templateId, area, variants);
    setSitePlacementNotice(result.canPlace
      ? `${result.count}개 오브젝트를 한 번의 작업으로 배치했습니다.`
      : result.message);
    if (result.canPlace) {
      setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
      setActiveSiteTemplateId(null);
      setActiveSiteVariants({});
      setSiteAreaSelection(null);
      setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    }
    return result;
  }, [activeSiteVariants, addSiteObjectsFromArea]);

  const handleConfirmAreaPlacement = useCallback(() => {
    completeAreaPlacement(activeSiteTemplateId, siteAreaSelection, activeSiteVariants);
  }, [activeSiteTemplateId, activeSiteVariants, completeAreaPlacement, siteAreaSelection]);

  const handleSiteTemplateAreaPlace = useCallback((templateId, area, variants = activeSiteVariants) => {
    return completeAreaPlacement(templateId, area, variants);
  }, [activeSiteVariants, completeAreaPlacement]);

  const handleSiteBuildingSelect = useCallback((buildingId) => {
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);
    selectBuilding(buildingId);
    setActiveFloatingPanelId(buildingId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectBuilding]);

  const handleSiteObjectSelect = useCallback((objectId) => {
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);
    selectSiteObject(objectId);
    setActiveFloatingPanelId(objectId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectSiteObject]);

  const handleSelectedSiteDelete = useCallback(() => {
    if (editor.selectedSiteObject) removeSelectedSiteObject();
    else if (editor.selectedBuilding) deleteHierarchyNode(editor.selectedBuilding.id);
    setActiveFloatingPanelId(null);
  }, [deleteHierarchyNode, editor.selectedBuilding, editor.selectedSiteObject, removeSelectedSiteObject]);

  const handleCloseObjectDetails = useCallback(() => {
    selectBuilding(null);
    selectSiteObject(null);
    setActiveFloatingPanelId(null);
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);
  }, [resetSiteInteraction, selectBuilding, selectSiteObject]);

  const handleFloorRoomChange = useCallback((changes) => {
    if (selectedFloorRoom) updateRoomLayout(selectedFloorRoom.id, changes);
  }, [selectedFloorRoom, updateRoomLayout]);

  const handleFloorRoomAdd = useCallback(() => {
    if (!selectedFloor) return;
    const roomId = addRoomToFloor(selectedFloor.id);
    if (roomId) setSelectedFloorRoomId(roomId);
  }, [addRoomToFloor, selectedFloor]);

  const handleSave = useCallback(() => {
    try {
      const payload = saveLayout(editor.layoutDocument);
      const savedTime = new Date(payload.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      setSaveStatus(`저장 완료 · ${savedTime}`);
    } catch {
      setSaveStatus("저장하지 못했습니다");
    }
  }, [editor.layoutDocument]);

  const handleLoad = useCallback(() => {
    try {
      const savedLayout = loadLayout();
      if (!savedLayout) {
        setSaveStatus("저장된 배치가 없습니다");
        return;
      }
      setSaveStatus(hydrateLayout(savedLayout) ? "저장된 월드를 불러왔습니다" : "잘못된 배치 데이터입니다");
      setWizardStepId(WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION);
      setFurthestStepIndex(0);
      setActiveFloatingPanelId(null);
    } catch {
      setSaveStatus("배치를 불러오지 못했습니다");
    }
  }, [hydrateLayout]);

  const handleReset = useCallback(() => {
    resetLayout();
    resetSiteInteraction();
    setWizardStepId(WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION);
    setFurthestStepIndex(0);
    setActiveFloatingPanelId(null);
    setSaveStatus("새 월드로 초기화했습니다");
  }, [resetLayout, resetSiteInteraction]);

  const applyWizardContext = useCallback((stepId) => {
    const targetIndex = getWizardStepIndex(stepId);
    if (targetIndex > furthestStepIndex) return;
    setWizardStepId(stepId);
    setActiveFloatingPanelId(stepId === WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION ? null : WORLD_PANEL_IDS.DETAILS);
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);

    if (stepId === WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION) {
      navigateToSite();
      clearSelection();
    } else if (stepId === WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL) {
      const building = editor.currentBuilding ?? editor.selectedBuilding ?? editor.buildings[0];
      if (building) navigateToBuilding(building.id);
    } else if (stepId === WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT) {
      const roomId = editor.navigationContext.currentRoomId ?? editor.activeRoom?.id;
      if (roomId) navigateToRoom(roomId);
      else {
        const building = editor.currentBuilding ?? editor.selectedBuilding ?? editor.buildings[0];
        const floor = editor.currentFloor ?? editor.floors.find((item) => item.parentId === building?.id);
        if (floor) navigateToFloor(floor.id);
      }
    } else if (stepId === WORLD_WIZARD_STEP_IDS.EQUIPMENT_DETAIL && editor.selectedEquipmentId) {
      navigateToEquipment(editor.selectedEquipmentId);
    }
  }, [clearSelection, editor.activeRoom?.id, editor.buildings, editor.currentBuilding, editor.currentFloor, editor.floors, editor.navigationContext.currentRoomId, editor.selectedBuilding, editor.selectedEquipmentId, furthestStepIndex, navigateToBuilding, navigateToEquipment, navigateToFloor, navigateToRoom, navigateToSite, resetSiteInteraction]);

  const advanceToStep = useCallback((stepId) => {
    const targetIndex = getWizardStepIndex(stepId);
    setFurthestStepIndex((current) => Math.max(current, targetIndex));
    setWizardStepId(stepId);
    setActiveFloatingPanelId(stepId === WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT ? WORLD_PANEL_IDS.OBJECTS : WORLD_PANEL_IDS.DETAILS);
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);

    if (stepId === WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION) navigateToSite();
    if (stepId === WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL) {
      const building = editor.selectedBuilding ?? editor.buildings[0];
      if (building) navigateToBuilding(building.id);
    }
    if (stepId === WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT) {
      const building = editor.currentBuilding ?? editor.selectedBuilding ?? editor.buildings[0];
      const floor = editor.currentFloor ?? editor.floors.find((item) => item.parentId === building?.id);
      if (floor) navigateToFloor(floor.id);
    }
    if (stepId === WORLD_WIZARD_STEP_IDS.EQUIPMENT_DETAIL && editor.selectedEquipmentId) {
      navigateToEquipment(editor.selectedEquipmentId);
    }
  }, [editor.buildings, editor.currentBuilding, editor.currentFloor, editor.floors, editor.selectedBuilding, editor.selectedEquipmentId, navigateToBuilding, navigateToEquipment, navigateToFloor, navigateToSite, resetSiteInteraction]);

  const handleEnterBuilding = useCallback((buildingId) => {
    selectBuilding(buildingId);
    navigateToBuilding(buildingId);
    setFurthestStepIndex((current) => Math.max(current, 1));
    setWizardStepId(WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL);
    setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
    resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);
  }, [navigateToBuilding, resetSiteInteraction, selectBuilding]);

  const handlePrimaryAction = useCallback(() => {
    if (isWorldCompositionStep) advanceToStep(WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL);
    else if (isBuildingDetailStep) advanceToStep(WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT);
    else if (isFloorEquipmentStep && !isRoomScene && selectedFloorRoom) navigateToRoom(selectedFloorRoom.id);
    else if (isFloorEquipmentStep && isRoomScene && editor.selectedEquipmentId) advanceToStep(WORLD_WIZARD_STEP_IDS.EQUIPMENT_DETAIL);
    else if (isEquipmentDetailStep) handleSave();
  }, [advanceToStep, editor.selectedEquipmentId, handleSave, isBuildingDetailStep, isEquipmentDetailStep, isFloorEquipmentStep, isRoomScene, isWorldCompositionStep, navigateToRoom, selectedFloorRoom]);

  const primaryActionDisabled = (isWorldCompositionStep && editor.buildings.length === 0)
    || (isBuildingDetailStep && !focusedBuilding)
    || (isFloorEquipmentStep && !isRoomScene && !selectedFloorRoom)
    || (isFloorEquipmentStep && isRoomScene && !editor.selectedEquipmentId)
    || (isEquipmentDetailStep && !editor.selectedEquipmentId);
  const primaryActionLabel = isFloorEquipmentStep
    ? isRoomScene
      ? editor.selectedEquipmentId ? "선택 설비 상세 설정" : "설비를 선택하세요"
      : selectedFloorRoom ? "선택 공간에서 설비 배치" : "공간을 선택하세요"
    : isWorldCompositionStep && editor.buildings.length === 0
      ? "핵심 건축물을 먼저 배치하세요"
      : wizardStep.primaryLabel;
  const primaryActionCompactLabel = isEquipmentDetailStep
    ? "저장"
    : primaryActionDisabled ? "선택 필요" : "다음";

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      if (event.key === "Escape") {
        resetSiteInteraction(SITE_INTERACTION_MODES.NAVIGATE);
        clearSelection();
        selectBuilding(null);
        selectSiteObject(null);
        setActiveFloatingPanelId(null);
        return;
      }
      if (isFormTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (isSiteScene) {
          handleSelectedSiteDelete();
        } else removeSelectedEquipment();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (isSiteScene) duplicateSelectedSiteEntity();
        else if (isRoomScene) duplicateSelectedEquipment();
      }
      if (event.key.toLowerCase() === "w") setTransformMode("translate");
      if (event.key.toLowerCase() === "e") setTransformMode("rotate");
    }
    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [clearSelection, duplicateSelectedEquipment, duplicateSelectedSiteEntity, handleSelectedSiteDelete, isRoomScene, isSiteScene, redo, removeSelectedEquipment, resetSiteInteraction, selectBuilding, selectSiteObject, setTransformMode, undo]);

  const contextIcon = isSiteScene ? (isBuildingDetailStep ? "BUILDING" : "SITE") : isFloorOverview ? "FLOOR" : "EQUIPMENT";
  const stageContext = isWorldCompositionStep
    ? `${editor.siteEnvironment.width.toFixed(0)} × ${editor.siteEnvironment.depth.toFixed(0)} m · 핵심 ${editor.buildings.length} · 환경 ${environmentSiteObjects.length}`
      : isBuildingDetailStep
        ? focusedBuilding?.name ?? "건축물 미선택"
        : isFloorOverview ? selectedFloor?.name ?? "층 미선택" : editor.activeRoom?.name ?? "공간 미선택";
  const renderedSiteBuildings = isBuildingDetailStep ? focusedBuilding ? [focusedBuilding] : [] : editor.buildings;
  const renderedSiteObjects = isWorldCompositionStep ? editor.siteObjects : [];
  const hasSiteSelection = Boolean(editor.selectedBuilding || editor.selectedSiteObject);
  const selectedBuildingFloorCount = editor.selectedBuilding
    ? editor.floors.filter((floor) => floor.parentId === editor.selectedBuilding.id).length
    : 0;
  const floatingPanelTitle = isWorldCompositionStep
    ? activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? "Object Library"
      : activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? "World Settings"
        : activeFloatingPanelId === WORLD_PANEL_IDS.HIERARCHY ? "Hierarchy"
          : "Object Detail"
    : isBuildingDetailStep ? "Building Detail"
      : isFloorOverview ? "Floor Settings"
        : activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? "Equipment Library" : "Equipment Detail";
  const floatingPanelOpen = isWorldCompositionStep
    ? Boolean(activeFloatingPanelId) && (activeFloatingPanelId !== WORLD_PANEL_IDS.DETAILS || hasSiteSelection)
    : Boolean(activeFloatingPanelId);

  return (
    <main className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true"><WorldIcon size={24} /></div>
        <div className={styles.titleBlock}><span>월드 구축 Wizard</span><h1>디지털 트윈 에디터</h1></div>
        <div className={styles.headerMeta}><span>{stageContext}</span><span className={styles.connectionStatus}>{saveStatus || "로컬 초안"}</span></div>
        <button type="button" className={styles.themeToggle} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 모드로 전환`} title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 모드`} onClick={toggleTheme}>
          <span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={17} /> : <SunIcon size={17} />}</span>
          {theme === EDITOR_THEMES.DARK ? "다크" : "라이트"}
        </button>
      </header>

      <div className={styles.workspace}>
        <div className={styles.sceneArea}>
          <div className={styles.stepNavigation}><WorldWizardStepper activeStepId={wizardStepId} furthestStepIndex={furthestStepIndex} onStepChange={applyWizardContext} /></div>
          <section className={styles.stageGuide} aria-label={wizardStep.title}>
            <div className={styles.stageIdentity}><span>{wizardStepIndex + 1}</span><h2>{wizardStep.label}</h2></div>
            <button type="button" aria-label={primaryActionLabel} title={primaryActionLabel} disabled={primaryActionDisabled} onClick={handlePrimaryAction}>
              {isEquipmentDetailStep ? <SaveIcon size={16} /> : <ArrowRightIcon size={16} />}
              <span>{primaryActionCompactLabel}</span>
            </button>
          </section>

          <div key={`${wizardStepId}-${isRoomScene ? "ROOM" : editor.navigationContext.currentDepth}`} className={styles.sceneTransition}>
            {isSiteScene ? (
              <SiteOverviewScene
                siteEnvironment={editor.siteEnvironment} buildings={renderedSiteBuildings} floors={editor.floors} siteObjects={renderedSiteObjects}
                selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId}
                selectedFloorId={isBuildingDetailStep ? editor.navigationContext.currentFloorId : null}
                focusedBuildingId={isBuildingDetailStep ? focusedBuilding?.id ?? null : null} focusRequestKey={editor.navigationContext.transitionId}
                interactionMode={isBuildingDetailStep ? SITE_INTERACTION_MODES.NAVIGATE : siteInteractionMode}
                placementTemplateId={isBuildingDetailStep ? null : activeSiteTemplateId} placementVariants={activeSiteVariants} areaSelection={siteAreaSelection}
                theme={theme} viewMode={editor.viewMode} transformMode={editor.transformMode} gridSettings={editor.gridSettings} gridScopeId={activeGridScopeId}
                onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} onUpdateBuilding={updateBuilding}
                onUpdateSiteObject={updateSiteObject} onEnterBuilding={handleEnterBuilding} onSelectFloor={selectFloorInBuilding}
                onEnterFloor={(floorId) => { navigateToFloor(floorId); setFurthestStepIndex((current) => Math.max(current, 2)); setWizardStepId(WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}
                onAreaSelectionChange={setSiteAreaSelection} onPlaceTemplate={handleSiteTemplatePlace} onPlaceTemplateArea={handleSiteTemplateAreaPlace}
              />
            ) : isFloorOverview ? (
              <FloorOverviewScene building={focusedBuilding} floor={selectedFloor} rooms={floorRooms} roomScenes={editor.layoutDocument.roomScenes} selectedRoomId={selectedFloorRoom?.id ?? null} theme={theme} transformMode={editor.transformMode} gridSettings={editor.gridSettings} gridScopeId={activeGridScopeId} onSelectRoom={setSelectedFloorRoomId} onUpdateRoom={updateRoomLayout} onEnterRoom={navigateToRoom} />
            ) : (
              <DigitalTwinScene world={editor.world} editorMode={EDITOR_MODES.EQUIPMENT} worldStructures={editor.worldStructures} equipmentInstances={editor.equipmentInstances} selectedWorldStructureId={editor.selectedWorldStructureId} selectedEquipmentId={editor.selectedEquipmentId} activeWorldTemplateId={null} activeTemplateId={isFloorEquipmentStep ? editor.activeTemplateId : null} worldStructuresLocked={editor.worldStructuresLocked} visibilityFilters={editor.visibilityFilters} theme={theme} viewMode={editor.viewMode} transformMode={editor.transformMode} gridSettings={editor.gridSettings} gridScopeId={activeGridScopeId} collisionIds={editor.collisionIds} pipeConnections={editor.pipeConnections} pipeSnapCandidate={editor.pipeSnapCandidate} onEquipmentAdd={handleEquipmentAdd} onEquipmentSelect={handleEquipmentSelect} onEquipmentTransform={updateEquipment} onEquipmentTransformEnd={commitPipeSnap} onWorldStructureAdd={addWorldStructure} onWorldStructureSelect={selectWorldStructure} onWorldStructureTransform={updateWorldStructure} />
            )}
          </div>

          <EditorToolbar focusedScope hierarchyScopeLabel={wizardStep.contextLabel} contextIcon={contextIcon} showSelectionActions={isSiteScene || isEquipmentDetailStep} showSiteInteractionTools={isWorldCompositionStep} siteInteractionMode={siteInteractionMode} editorMode={EDITOR_MODES.EQUIPMENT} viewMode={editor.viewMode} transformMode={editor.transformMode} snapSize={editor.snapSize} gridSnapEnabled={editor.gridSettings.enabled} hasSelection={isSiteScene ? hasSiteSelection : isFloorOverview ? Boolean(selectedFloorRoom) : Boolean(editor.selectedEquipment)} worldLocked={editor.worldStructuresLocked} saveStatus={saveStatus} canUndo={editor.canUndo} canRedo={editor.canRedo} onEditorModeChange={setEditorMode} onSiteInteractionModeChange={handleSiteInteractionModeChange} onViewModeChange={setViewMode} onTransformModeChange={setTransformMode} onSnapSizeChange={setSnapSize} onGridSnapChange={setGridSnapEnabled} onToggleWorldLock={setWorldStructuresLocked} onDuplicate={isSiteScene ? duplicateSelectedSiteEntity : duplicateSelectedEquipment} onDelete={isSiteScene ? handleSelectedSiteDelete : removeSelectedEquipment} onReset={handleReset} onLoad={handleLoad} onSave={handleSave} onUndo={undo} onRedo={redo} />
          <ViewModeToggle value={editor.viewMode} onChange={setViewMode} />

          {isWorldCompositionStep ? <WorldPanelRail activePanelId={activeFloatingPanelId} hasSelection={hasSiteSelection} onPanelChange={setActiveFloatingPanelId} /> : null}

          <FloatingPanel
            open={floatingPanelOpen}
            title={floatingPanelTitle}
            eyebrow={isWorldCompositionStep ? "WORLD EDITOR" : wizardStep.contextLabel}
            onClose={activeFloatingPanelId === WORLD_PANEL_IDS.DETAILS && isSiteScene ? handleCloseObjectDetails : () => setActiveFloatingPanelId(null)}
          >
            {isWorldCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <SiteAuthoringPanel areaSelection={siteAreaSelection} placementPlan={sitePlacementPlan} placementNotice={sitePlacementNotice} activeTemplateId={activeSiteTemplateId} activeVariants={activeSiteVariants} buildings={editor.buildings} siteObjects={editor.siteObjects} selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId} headingLabel="월드 오브젝트" onClearArea={() => resetSiteInteraction()} onConfirmAreaPlacement={handleConfirmAreaPlacement} onSelectTemplate={handleSiteTemplateSelect} onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} onVariantsChange={setActiveSiteVariants} />
            ) : isWorldCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? (
              <EnvironmentSettingsPanel environment={editor.siteEnvironment} onChange={updateSiteEnvironment} />
            ) : isWorldCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.HIERARCHY ? (
              <WorldHierarchyPanel buildings={editor.buildings} siteObjects={editor.siteObjects} selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId} onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} />
            ) : isSiteScene ? (
              <ObjectDetailPanel building={editor.selectedBuilding} siteObject={editor.selectedSiteObject} floorCount={selectedBuildingFloorCount} onBuildingChange={handleBuildingChange} onAddFloor={() => editor.selectedBuilding && updateBuilding(editor.selectedBuilding.id, { parameters: { floorCount: selectedBuildingFloorCount + 1 } })} onSiteObjectChange={handleSiteObjectChange} onDeleteSiteObject={handleSelectedSiteDelete} />
            ) : isFloorOverview ? (
              <RoomLayoutProperties room={selectedFloorRoom} scene={selectedFloorRoomScene} roomCount={floorRooms.length} showEnterAction={false} onChange={handleFloorRoomChange} onAddRoom={handleFloorRoomAdd} onEnterRoom={navigateToRoom} />
            ) : activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS && isFloorEquipmentStep ? (
              <EquipmentLibrary activeTemplateId={editor.activeTemplateId} favoriteTemplateIds={editor.favoriteTemplateIds} recentTemplateIds={editor.recentTemplateIds} onSelect={handleTemplateSelect} onToggleFavorite={toggleFavorite} />
            ) : (
              <EquipmentProperties equipment={editor.selectedEquipment} detailAsset={editor.selectedDetailAsset} hasCollision={editor.collisionIds.has(editor.selectedEquipmentId)} snapCandidate={editor.pipeSnapCandidate} onChange={handleEquipmentChange} onUpload={(file) => registerDetailAsset(editor.selectedEquipmentId, file)} onRemoveAsset={() => removeDetailAsset(editor.selectedEquipmentId)} onPreview={() => { navigateToEquipment(editor.selectedEquipmentId); setDetailViewEquipmentId(editor.selectedEquipmentId); }} onUpdateAsset={(changes) => updateDetailAsset(editor.selectedDetailAsset.id, changes)} onSnap={() => commitPipeSnap(editor.selectedEquipmentId)} onOpenPartEditor={() => { navigateToEquipment(editor.selectedEquipmentId); setPartViewEquipmentId(editor.selectedEquipmentId); }} />
            )}
          </FloatingPanel>
        </div>
      </div>

      {detailViewEquipment && detailViewAsset ? <Suspense fallback={<div className={styles.detailLoading}>상세 보기를 준비하는 중…</div>}><DetailView equipment={detailViewEquipment} asset={detailViewAsset} onClose={() => setDetailViewEquipmentId(null)} /></Suspense> : null}
      {partViewEquipment ? <Suspense fallback={<div className={styles.detailLoading}>파트 편집기를 준비하는 중…</div>}><PartEditor equipment={partViewEquipment} theme={theme} gridSettings={editor.gridSettings} onGridSnapChange={setGridSnapEnabled} onGridSizeChange={setSnapSize} onClose={() => setPartViewEquipmentId(null)} onAddPart={addEquipmentPart} onUpdatePart={updateEquipmentPart} onDuplicatePart={duplicateEquipmentPart} onRemovePart={removeEquipmentPart} /></Suspense> : null}
    </main>
  );
}
