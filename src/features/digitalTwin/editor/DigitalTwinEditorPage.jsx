import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowRightIcon, MoonIcon, SaveIcon, SunIcon, WorldIcon } from "@/components/icons";
import { navigateTo as navigateToAppRoute } from "@/features/customAssets/core/customAssetNavigation";
import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import { CUSTOM_BUILDING_CREATE_ID } from "@/features/customAssets/core/customAssetTypes";
import { loadLayout, saveLayout } from "@/features/digitalTwin/editor/api/layoutRepository";
import BuildingDetailNavigator from "@/features/digitalTwin/editor/components/BuildingDetailNavigator";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import EnvironmentSettingsPanel from "@/features/digitalTwin/editor/components/EnvironmentSettingsPanel";
import EquipmentProperties from "@/features/digitalTwin/editor/components/EquipmentProperties";
import EquipmentDetailWorkspace from "@/features/digitalTwin/editor/components/EquipmentDetailWorkspace";
import FloatingPanel from "@/features/digitalTwin/editor/components/FloatingPanel";
import FloorObjectList from "@/features/digitalTwin/editor/components/FloorObjectList";
import FloorPlanNavigator from "@/features/digitalTwin/editor/components/FloorPlanNavigator";
import FloorWorkspaceCatalog from "@/features/digitalTwin/editor/components/FloorWorkspaceCatalog";
import MonitoringSettingsPanel from "@/features/digitalTwin/editor/components/MonitoringSettingsPanel";
import ObjectDetailPanel from "@/features/digitalTwin/editor/components/ObjectDetailPanel";
import SiteAuthoringPanel from "@/features/digitalTwin/editor/components/SiteAuthoringPanel";
import TerrainEditorPanel from "@/features/digitalTwin/editor/components/TerrainEditorPanel";
import ViewModeToggle from "@/features/digitalTwin/editor/components/ViewModeToggle";
import WorldHierarchyPanel from "@/features/digitalTwin/editor/components/WorldHierarchyPanel";
import WorldStructureProperties from "@/features/digitalTwin/editor/components/WorldStructureProperties";
import WorldWorkspaceNavigation from "@/features/digitalTwin/editor/components/WorldWorkspaceNavigation";
import {
  BUILDING_SETTING_STATUS,
  getOverallBuildingSettingStatus,
} from "@/features/digitalTwin/editor/constants/buildingDetail";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getDefaultObjectVariants, OBJECT_LIBRARY_DEFINITION_MAP } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { intersectAreaWithSite } from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { ENVIRONMENT_TEMPLATE_IDS, getWizardStepIndex, WORLD_WIZARD_STEP_IDS, WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";
import { EDITOR_MODES, WORLD_STRUCTURE_TEMPLATES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import FloorPlan3DScene from "@/features/digitalTwin/editor/three/FloorPlan3DScene";
import FloorPlanScene from "@/features/digitalTwin/editor/three/FloorPlanScene";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";
import { DEFAULT_TERRAIN_BRUSH } from "@/features/digitalTwin/editor/terrain/TerrainEditor";

import styles from "./DigitalTwinEditorPage.module.css";

const FLOOR_PLAN_TEMPLATE_IDS = Object.freeze(
  WORLD_STRUCTURE_TEMPLATES
    .filter((template) => !template.legacyOnly && !["FLOOR_REGION", "CUSTOM_STRUCTURE"].includes(template.id))
    .map((template) => template.id),
);
const WORKSPACE_VIEWS = Object.freeze({ PLAN_2D: "PLAN_2D", SPACE_3D: "SPACE_3D" });
const WORKSPACE_MODES = Object.freeze({ PLAN: "PLAN", EQUIPMENT: "EQUIPMENT" });
const VIEW_SCOPES = Object.freeze({ FLOOR: "FLOOR", BUILDING: "BUILDING" });

function isFormTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export default function DigitalTwinEditorPage({ customAssetRevision = "" }) {
  const editor = useDigitalTwinEditorState();
  const { theme, toggleTheme } = useEditorTheme();
  const [wizardStepId, setWizardStepId] = useState(WORLD_WIZARD_STEP_IDS.COMPOSITION);
  const [saveStatus, setSaveStatus] = useState("");
  const [activeFloatingPanelId, setActiveFloatingPanelId] = useState(null);
  const [siteAreaSelection, setSiteAreaSelection] = useState(null);
  const [siteInteractionMode, setSiteInteractionMode] = useState(SITE_INTERACTION_MODES.NAVIGATE);
  const [activeSiteTemplateId, setActiveSiteTemplateId] = useState(null);
  const [activeSiteVariants, setActiveSiteVariants] = useState({});
  const [sitePlacementNotice, setSitePlacementNotice] = useState("");
  const [terrainBrush, setTerrainBrush] = useState(DEFAULT_TERRAIN_BRUSH);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [buildingFocusMode, setBuildingFocusMode] = useState(false);
  const [showFloorReference, setShowFloorReference] = useState(false);
  const [referenceFloorId, setReferenceFloorId] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(WORKSPACE_VIEWS.PLAN_2D);
  const [workspaceMode, setWorkspaceMode] = useState(WORKSPACE_MODES.PLAN);
  const [viewScope, setViewScope] = useState(VIEW_SCOPES.FLOOR);
  const [equipmentTargetFloorIds, setEquipmentTargetFloorIds] = useState([]);
  const [buildingsTranslucent, setBuildingsTranslucent] = useState(false);
  const [equipmentTranslucent, setEquipmentTranslucent] = useState(true);
  const buildingSaveRequestRef = useRef(0);
  const siteWorldCameraStateRef = useRef(null);
  const layoutReadyRef = useRef(false);

  const {
    updateSiteEnvironment, resetLayout, hydrateLayout, updateBuilding,
    addSiteObjectFromArea, addSiteObjectsFromArea, selectSiteObject, updateSiteObject,
    duplicateSelectedSiteEntity, removeSelectedSiteObject, deleteHierarchyNode,
    selectBuilding, navigateToSite, navigateToFloor, selectFloorInBuilding,
    clearSelection, setViewMode, toggleTransformTool, setSnapSize, setGridSnapEnabled,
    setWorldStructuresLocked, undo, redo,
    selectFloorPlanTemplate, addFloorPlanStructure, updateFloorPlanStructure,
    selectFloorPlanStructure, removeSelectedFloorPlanStructure, duplicateSelectedFloorPlanStructure,
    copyFloorPlanFromFloor, applyFloorPlanToFloors, applyFloorStyleToFloors, toggleFloorPlanVisibilityFilter,
    selectSpatialEntity, setFloorFootprintMode, updateFloorFootprintVertex,
    appendFloorFootprintVertex, deleteFloorFootprintVertex, appendFloorFootprintRegion,
    appendFloorFootprintHole, combineFloorFootprintRegions, subtractFloorFootprintRegions,
    createElevationZone, changeElevationZone, divideElevationZone,
    createRoom, changeRoom, changeSharedWall, createDoor, changeDoor, deleteDoor,
    selectFloorEquipmentTemplate, addFloorEquipment, updateFloorEquipment, selectFloorEquipment,
    removeSelectedFloorEquipment, duplicateSelectedFloorEquipment,
    addObservationPoint, updateObservationPoint, selectObservationPoint,
    ensureEquipmentDetail, addAssetBinding, updateAssetBinding, selectAssetBinding,
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
  const referenceFloor = useMemo(() => (
    buildingFloors.find((floor) => floor.id === referenceFloorId && floor.id !== selectedFloor?.id)
    ?? buildingFloors.find((floor) => floor.id !== selectedFloor?.id)
    ?? null
  ), [buildingFloors, referenceFloorId, selectedFloor?.id]);
  const referenceFloorStructures = useMemo(
    () => referenceFloor ? editor.floorPlansById[referenceFloor.id]?.structures ?? [] : [],
    [editor.floorPlansById, referenceFloor],
  );
  const currentFloorSpaces = editor.floorPlanStructures.filter((item) => ["ROOM", "CORRIDOR"].includes(item.type));
  const buildingFloorPlanStructures = useMemo(() => {
    const floorStructures = buildingFloors.flatMap((floor) => (
      (editor.floorPlansById[floor.id]?.structures ?? []).map((structure) => ({
        ...structure,
        floorId: structure.floorId ?? floor.id,
      }))
    ));
    const verticalStructures = editor.verticalStructuresByBuildingId[focusedBuilding?.id] ?? [];
    return [...floorStructures, ...verticalStructures];
  }, [buildingFloors, editor.floorPlansById, editor.verticalStructuresByBuildingId, focusedBuilding?.id]);
  const environmentSiteObjects = useMemo(() => editor.siteObjects.filter((item) => ENVIRONMENT_TEMPLATE_IDS.includes(item.type)), [editor.siteObjects]);
  const buildingSettingStatusById = useMemo(
    () => Object.fromEntries(editor.buildings.map((building) => [building.id, getOverallBuildingSettingStatus(building)])),
    [editor.buildings],
  );
  const selectedBuildingStatus = getOverallBuildingSettingStatus(focusedBuilding);
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
    if (layoutReadyRef.current) return;
    layoutReadyRef.current = true;
    const saved = loadLayout();
    if (saved) hydrateLayout(saved);
  }, [hydrateLayout]);

  useEffect(() => {
    if (!layoutReadyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      try {
        saveLayout(editor.layoutDocument);
      } catch {
        // The manual save status remains the user-facing recovery path.
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editor.layoutDocument]);

  useEffect(() => {
    const pendingTemplateId = sessionStorage.getItem("digital-twin:pending-custom-template");
    if (!pendingTemplateId || !OBJECT_LIBRARY_DEFINITION_MAP[pendingTemplateId]) return;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem("digital-twin:pending-custom-template");
      setWizardStepId(WORLD_WIZARD_STEP_IDS.COMPOSITION);
      setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS);
      setActiveSiteTemplateId(pendingTemplateId);
      setActiveSiteVariants(getDefaultObjectVariants(OBJECT_LIBRARY_DEFINITION_MAP[pendingTemplateId]));
      setSiteInteractionMode(SITE_INTERACTION_MODES.PLACE_OBJECT);
      navigateToSite();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customAssetRevision, navigateToSite]);

  useEffect(() => {
    editor.buildings.forEach((building) => {
      if (!building.customAssetId || building.customAssetAutoUpdate === false) return;
      const customAsset = getRuntimeCustomAsset(building.customAssetId);
      if (!customAsset || customAsset.status !== "ready") return;
      if (
        customAsset.revision === building.customAssetRevision
        && customAsset.updatedAt === building.customAssetSnapshot?.updatedAt
      ) return;
      const scale = building.customAssetScale ?? {
        x: building.parameters.width / Math.max(0.01, building.customAssetSnapshot?.bounds?.width ?? customAsset.bounds.width),
        y: 1,
        z: building.parameters.depth / Math.max(0.01, building.customAssetSnapshot?.bounds?.depth ?? customAsset.bounds.depth),
      };
      updateBuilding(building.id, {
        customAssetRevision: customAsset.revision,
        customAssetSnapshot: structuredClone(customAsset),
        customAssetScale: scale,
        parameters: {
          width: customAsset.bounds.width * scale.x,
          depth: customAsset.bounds.depth * scale.z,
          floorCount: customAsset.metrics.floorCount,
          floorHeight: customAsset.levels?.[0]?.height ?? customAsset.sections[0]?.floorHeight ?? building.parameters.floorHeight,
        },
      });
    });
  }, [customAssetRevision, editor.buildings, updateBuilding]);

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

  const resetSiteInteraction = useCallback((mode = SITE_INTERACTION_MODES.NAVIGATE) => {
    setSiteInteractionMode(mode);
    setActiveSiteTemplateId(null);
    setActiveSiteVariants({});
    setSiteAreaSelection(null);
    setSitePlacementNotice("");
  }, []);
  const clearSitePlacement = useCallback(() => {
    resetSiteInteraction();
    selectBuilding(null);
    selectSiteObject(null);
    setBuildingFocusMode(false);
  }, [resetSiteInteraction, selectBuilding, selectSiteObject]);
  const clearFloorPlacement = useCallback(() => {
    selectFloorPlanTemplate(null);
    selectFloorEquipmentTemplate(null);
  }, [selectFloorEquipmentTemplate, selectFloorPlanTemplate]);
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
  const handleFloatingPanelChange = useCallback((panelId) => {
    if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT) clearSitePlacement();
    if (isCompositionStep && panelId === WORLD_PANEL_IDS.TERRAIN) {
      resetSiteInteraction(SITE_INTERACTION_MODES.EDIT_TERRAIN);
      selectBuilding(null);
      selectSiteObject(null);
      setBuildingFocusMode(false);
    } else if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.EDIT_TERRAIN) {
      resetSiteInteraction();
    }
    if (isFloorWorkspaceStep && panelId !== WORLD_PANEL_IDS.OBJECTS) clearFloorPlacement();
    setActiveFloatingPanelId(panelId);
  }, [clearFloorPlacement, clearSitePlacement, isCompositionStep, isFloorWorkspaceStep, resetSiteInteraction, selectBuilding, selectSiteObject, siteInteractionMode]);
  const handleFloatingPanelClose = useCallback(() => {
    if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.EDIT_TERRAIN) resetSiteInteraction();
    setActiveFloatingPanelId(null);
  }, [isCompositionStep, resetSiteInteraction, siteInteractionMode]);
  const handleCompositionViewModeChange = useCallback((mode) => {
    if (siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT) clearSitePlacement();
    setViewMode(mode);
  }, [clearSitePlacement, setViewMode, siteInteractionMode]);
  const handleUndo = useCallback(() => {
    if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT) clearSitePlacement();
    if (isFloorWorkspaceStep) clearFloorPlacement();
    undo();
  }, [clearFloorPlacement, clearSitePlacement, isCompositionStep, isFloorWorkspaceStep, siteInteractionMode, undo]);
  const handleRedo = useCallback(() => {
    if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT) clearSitePlacement();
    if (isFloorWorkspaceStep) clearFloorPlacement();
    redo();
  }, [clearFloorPlacement, clearSitePlacement, isCompositionStep, isFloorWorkspaceStep, redo, siteInteractionMode]);
  const handleSiteTemplateSelect = useCallback((templateId) => {
    if (templateId === CUSTOM_BUILDING_CREATE_ID) {
      navigateToAppRoute("/custom/buildings/new");
      return;
    }
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
    selectBuilding(null);
    selectSiteObject(null);
    setBuildingFocusMode(false);
    setSitePlacementNotice("오브젝트 1개를 배치했습니다.");
  }, [activeSiteVariants, addSiteObjectFromArea, selectBuilding, selectSiteObject]);
  const completeAreaPlacement = useCallback((templateId, area, variants = activeSiteVariants) => {
    if (!templateId || !area) return null;
    const result = addSiteObjectsFromArea(templateId, area, variants);
    setSitePlacementNotice(result.canPlace ? `${result.count}개 오브젝트를 배치했습니다.` : result.message);
    if (result.canPlace) {
      selectBuilding(null);
      selectSiteObject(null);
      setBuildingFocusMode(false);
      setSiteAreaSelection(null);
    }
    return result;
  }, [activeSiteVariants, addSiteObjectsFromArea, selectBuilding, selectSiteObject]);
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
    updateBuilding(selectedBuildingId, { ...changes, settingStatus: BUILDING_SETTING_STATUS.IN_PROGRESS });
    setHasUnsavedChanges(true);
  }, [selectedBuildingId, updateBuilding]);
  const handleBuildingComplete = useCallback(() => {
    if (!selectedBuildingId) return;
    updateBuilding(selectedBuildingId, { settingStatus: BUILDING_SETTING_STATUS.COMPLETE });
    setHasUnsavedChanges(true);
  }, [selectedBuildingId, updateBuilding]);
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
    return addFloorPlanStructure(templateId, position, { buildingId: focusedBuilding?.id, floorId: selectedFloor?.id });
  }, [addFloorPlanStructure, focusedBuilding?.id, selectedFloor?.id]);
  const handlePlanSelect = useCallback((id) => {
    selectFloorPlanTemplate(null);
    if (id) setWorkspaceMode(WORKSPACE_MODES.PLAN);
    selectFloorPlanStructure(id);
    setActiveFloatingPanelId(id ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [selectFloorPlanStructure, selectFloorPlanTemplate]);
  const handleSpatialSelect = useCallback((entity) => {
    selectFloorPlanTemplate(null);
    selectFloorPlanStructure(null);
    selectSpatialEntity(entity);
    if (entity) setWorkspaceMode(WORKSPACE_MODES.PLAN);
    setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS);
  }, [selectFloorPlanStructure, selectFloorPlanTemplate, selectSpatialEntity]);
  const handlePlanChange = useCallback((changes) => {
    if (editor.selectedFloorPlanStructureId) updateFloorPlanStructure(editor.selectedFloorPlanStructureId, changes);
  }, [editor.selectedFloorPlanStructureId, updateFloorPlanStructure]);
  const handleFloorEquipmentAdd = useCallback((templateId, position) => {
    const targetFloorIds = [...new Set([selectedFloor?.id, ...equipmentTargetFloorIds].filter(Boolean))];
    return addFloorEquipment(templateId, position, { floorId: selectedFloor?.id, targetFloorIds });
  }, [addFloorEquipment, equipmentTargetFloorIds, selectedFloor?.id]);
  const handleFloorEquipmentSelect = useCallback((id) => {
    selectFloorPlanTemplate(null);
    selectFloorEquipmentTemplate(null);
    if (id) setWorkspaceMode(WORKSPACE_MODES.EQUIPMENT);
    selectFloorEquipment(id);
    setActiveFloatingPanelId(id ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [selectFloorEquipment, selectFloorEquipmentTemplate, selectFloorPlanTemplate]);
  const handleFloorEquipmentChange = useCallback((changes) => {
    if (editor.selectedFloorEquipmentId) updateFloorEquipment(editor.selectedFloorEquipmentId, changes);
  }, [editor.selectedFloorEquipmentId, updateFloorEquipment]);
  const handleWorkspaceModeChange = useCallback((mode) => {
    if (mode === workspaceMode) {
      setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS);
      return;
    }
    setWorkspaceMode(mode);
    setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS);
    if (mode === WORKSPACE_MODES.PLAN) {
      selectFloorEquipmentTemplate(null);
      selectFloorEquipment(null);
    } else {
      selectFloorPlanTemplate(null);
      selectFloorPlanStructure(null);
    }
  }, [selectFloorEquipment, selectFloorEquipmentTemplate, selectFloorPlanStructure, selectFloorPlanTemplate, workspaceMode]);

  const enterStep = useCallback((stepId) => {
    if (stepId === WORLD_WIZARD_STEP_IDS.MONITORING && editor.selectedFloorEquipment) ensureEquipmentDetail(editor.selectedFloorEquipment);
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
  }, [editor.floors, editor.selectedFloorEquipment, ensureEquipmentDetail, focusedBuilding?.id, navigateToFloor, navigateToSite, resetSiteInteraction, selectedFloor]);
  const handlePrimaryAction = useCallback(() => {
    if (isCompositionStep) {
      if (incompleteBuildingCount > 0 && !window.confirm(`설정이 완료되지 않은 건축물이 ${incompleteBuildingCount}개 있습니다. 그래도 이동하시겠습니까?`)) return;
      enterStep(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT);
    } else if (isFloorWorkspaceStep) {
      enterStep(WORLD_WIZARD_STEP_IDS.MONITORING);
    } else {
      try {
        const payload = saveLayout(editor.layoutDocument);
        setSaveStatus(`설비 상세 저장 · ${new Date(payload.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
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
    setSaveStatus("새 월드로 초기화했습니다");
  }, [enterStep, resetLayout]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (isCompositionStep) clearSitePlacement();
        if (isFloorWorkspaceStep) clearFloorPlacement();
        clearSelection();
        selectFloorPlanStructure(null);
        selectFloorEquipment(null);
        setActiveFloatingPanelId(null);
        return;
      }
      if (isFormTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? handleRedo() : handleUndo();
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
  }, [clearFloorPlacement, clearSelection, clearSitePlacement, duplicateSelectedFloorEquipment, duplicateSelectedFloorPlanStructure, duplicateSelectedSiteEntity, handleDeleteSiteSelection, handleRedo, handleUndo, isCompositionStep, isFloorWorkspaceStep, removeSelectedFloorEquipment, removeSelectedFloorPlanStructure, selectFloorEquipment, selectFloorPlanStructure, toggleTransformTool, workspaceMode]);

  const primaryDisabled = (isCompositionStep && editor.buildings.length === 0) || ((isFloorWorkspaceStep || isMonitoringStep) && !selectedFloor);
  const stageContext = isCompositionStep
    ? `${editor.siteEnvironment.width.toFixed(0)} × ${editor.siteEnvironment.depth.toFixed(0)} m · 건축물 ${editor.buildings.length} · 환경 ${environmentSiteObjects.length}`
    : `${focusedBuilding?.name ?? "건축물 미선택"} · ${selectedFloor?.name ?? "층 미선택"}`;
  const panelTitle = isCompositionStep
    ? activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? "오브젝트 배치" : activeFloatingPanelId === WORLD_PANEL_IDS.OBJECT_LIST ? "오브젝트 목록" : activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? "부지 설정" : activeFloatingPanelId === WORLD_PANEL_IDS.TERRAIN ? "지형 고도 편집" : "오브젝트 설정"
    : isFloorWorkspaceStep
      ? activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS
        ? "오브젝트"
        : activeFloatingPanelId === WORLD_PANEL_IDS.OBJECT_LIST
          ? "오브젝트 목록"
          : workspaceMode === WORKSPACE_MODES.PLAN
            ? editor.selectedFloorPlanStructure?.name ?? "구조 설정"
            : editor.selectedFloorEquipment?.name ?? "설비 설정"
      : "설비 상세";
  const panelOpen = isMonitoringStep || (Boolean(activeFloatingPanelId) && (!isCompositionStep || activeFloatingPanelId !== WORLD_PANEL_IDS.DETAILS || hasSiteSelection));
  const targetFloorIds = equipmentTargetFloorIds.filter((id) => buildingFloors.some((floor) => floor.id === id) && id !== selectedFloor?.id);
  const floorNavigator = isFloorWorkspaceStep ? (
    <FloorPlanNavigator
      embedded
      building={focusedBuilding}
      floors={buildingFloors}
      currentFloorId={selectedFloor?.id}
      floorPlansById={editor.floorPlansById}
      showFloorReference={showFloorReference}
      referenceFloorId={referenceFloor?.id ?? ""}
      onFloorChange={navigateToFloor}
      onCopyFloorPlan={copyFloorPlanFromFloor}
      onApplyToFloors={applyFloorPlanToFloors}
      onApplyFloorStyle={applyFloorStyleToFloors}
      onReferenceFloorChange={setReferenceFloorId}
      onShowFloorReferenceChange={setShowFloorReference}
      spatialPlan={editor.activeFloorSpatialPlan}
      structures={editor.floorPlanStructures}
      equipment={editor.activeFloorEquipment}
      selectedSpatialEntity={editor.selectedSpatialEntity}
      spatialActions={{
        selectSpatialEntity,
        setFloorFootprintMode,
        updateFloorFootprintVertex,
        appendFloorFootprintVertex,
        deleteFloorFootprintVertex,
        appendFloorFootprintRegion,
        appendFloorFootprintHole,
        combineFloorFootprintRegions,
        subtractFloorFootprintRegions,
        createElevationZone,
        changeElevationZone,
        divideElevationZone,
        createRoom,
        changeRoom,
        changeSharedWall,
        createDoor,
        changeDoor,
        deleteDoor,
      }}
    />
  ) : null;

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

      <div
        className={styles.workspace}
        style={{
          "--editor-overlay-right-safe": panelOpen
            ? "calc(var(--editor-overlay-panel-width) + (var(--editor-overlay-gap) * 2))"
            : "var(--editor-overlay-gap)",
          "--editor-overlay-mobile-bottom-safe": panelOpen
            ? "calc(40% + 86px)"
            : "74px",
          "--scene-status-right": panelOpen
            ? "calc(var(--editor-overlay-panel-width) + (var(--editor-overlay-gap) * 2))"
            : "var(--editor-overlay-gap)",
          "--floor-view-toggle-offset": isFloorWorkspaceStep
            ? "calc(var(--view-toggle-inline-size) + 8px)"
            : "0px",
        }}
      >
        <div className={styles.sceneArea} data-scene-area>
          <div className={styles.topNavigationRow} data-camera-safe-ui>
            <div className={styles.workspaceNavigation}><WorldWorkspaceNavigation activeViewId={wizardStepId} onViewChange={enterStep} /></div>
            <section className={styles.stageGuide} aria-label="현재 화면 작업"><button type="button" disabled={primaryDisabled} title={primaryDisabled ? "건축물과 층을 먼저 선택하세요" : wizardStep.primaryLabel} onClick={handlePrimaryAction}>{isMonitoringStep ? <SaveIcon size={16} /> : <ArrowRightIcon size={16} />}<span>{isMonitoringStep ? "저장" : "다음"}</span></button></section>
          </div>

          {isFloorWorkspaceStep && workspaceView === WORKSPACE_VIEWS.SPACE_3D ? (
            <div className={styles.workspaceControls} data-camera-safe-ui>
              <div role="group" aria-label="3D 표시 범위"><button type="button" className={viewScope === VIEW_SCOPES.FLOOR ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.FLOOR)}>현재 층</button><button type="button" className={viewScope === VIEW_SCOPES.BUILDING ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.BUILDING)}>전체 건축물</button></div>
            </div>
          ) : null}

          <div key={wizardStepId} className={styles.sceneTransition}>
            {isCompositionStep ? (
              <SiteOverviewScene
                siteEnvironment={editor.siteEnvironment} buildings={editor.buildings} floors={editor.floors} siteObjects={editor.siteObjects}
                selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId}
                selectedFloorId={null}
                interiorBuildingId={null}
                focusRequestKey={editor.navigationContext.transitionId} focusMode={buildingFocusMode} cameraStateRef={siteWorldCameraStateRef}
                buildingsTranslucent={buildingsTranslucent}
                interactionMode={siteInteractionMode} placementTemplateId={activeSiteTemplateId} placementVariants={activeSiteVariants}
                areaSelection={siteAreaSelection} theme={theme} viewMode={editor.viewMode} transformTools={editor.transformTools}
                gridSettings={editor.gridSettings} gridScopeId={editor.hierarchy.rootId}
                onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect}
                onUpdateBuilding={(id, changes) => id === selectedBuildingId ? handleBuildingChange(changes) : updateBuilding(id, changes)}
                onUpdateSiteObject={updateSiteObject} onEnterBuilding={handleSiteBuildingSelect} onSelectFloor={selectFloorInBuilding}
                onEnterFloor={(floorId) => { navigateToFloor(floorId); setWizardStepId(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT); setBuildingFocusMode(false); resetSiteInteraction(); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}
                onAreaSelectionChange={setSiteAreaSelection} onPlaceTemplate={handleSiteTemplatePlace} onPlaceTemplateArea={completeAreaPlacement} onCancelPlacement={clearSitePlacement}
                terrainBrush={terrainBrush} onTerrainChange={(terrain) => updateSiteEnvironment({ terrain })}
              />
            ) : isFloorWorkspaceStep && workspaceView === WORKSPACE_VIEWS.PLAN_2D ? (
              <FloorPlanScene
                building={focusedBuilding} floor={selectedFloor} floors={buildingFloors} structures={editor.floorPlanStructures}
                verticalStructures={editor.activeVerticalStructures} selectedStructureId={editor.selectedFloorPlanStructureId}
                activeTemplateId={workspaceMode === WORKSPACE_MODES.PLAN ? editor.activeFloorPlanTemplateId : null}
                transformTools={editor.transformTools} gridSettings={editor.gridSettings} theme={theme}
                floorStyle={editor.floorPlansById[selectedFloor?.id]?.floorStyle}
                spatialPlan={editor.activeFloorSpatialPlan} selectedSpatialEntity={editor.selectedSpatialEntity} onSpatialSelect={handleSpatialSelect}
                showFloorReference={showFloorReference && Boolean(referenceFloor)} referenceFloorStructures={referenceFloorStructures} referenceFloorName={referenceFloor?.name}
                buildingVerticalStructureCount={editor.verticalStructuresByBuildingId[focusedBuilding?.id]?.length ?? 0}
                onAdd={handlePlanAdd} onSelect={handlePlanSelect} onTransform={updateFloorPlanStructure}
                editMode={workspaceMode} equipmentInstances={editor.activeFloorEquipment}
                equipmentTranslucent={equipmentTranslucent}
                selectedEquipmentId={editor.selectedFloorEquipmentId}
                activeEquipmentTemplateId={workspaceMode === WORKSPACE_MODES.EQUIPMENT ? editor.activeFloorEquipmentTemplateId : null}
                onEquipmentAdd={handleFloorEquipmentAdd} onEquipmentSelect={handleFloorEquipmentSelect} onEquipmentTransform={updateFloorEquipment}
                onCancelPlacement={clearFloorPlacement}
                externalStatus={editor.floorPlanValidationMessage}
              />
            ) : isMonitoringStep ? (
              <EquipmentDetailWorkspace
                equipment={editor.selectedFloorEquipment}
                assetBindings={editor.equipmentAssetBindings}
                selectedAsset={editor.selectedAssetBinding}
                selectedSensor={editor.selectedSensorBinding}
                onAlignmentChange={(changes) => editor.selectedAssetBinding && updateAssetBinding(editor.selectedAssetBinding.id, { alignmentTransform: changes })}
                worldView={<FloorPlan3DScene
                  building={focusedBuilding} floors={buildingFloors} currentFloor={selectedFloor}
                  floorPlansById={editor.floorPlansById} verticalStructures={editor.verticalStructuresByBuildingId[focusedBuilding?.id] ?? []}
                  equipmentByFloorId={editor.equipmentByFloorId} viewScope={VIEW_SCOPES.BUILDING}
                  editMode={WORKSPACE_MODES.EQUIPMENT} selectedStructureId={null} selectedEquipmentId={editor.selectedFloorEquipmentId}
                  equipmentTranslucent theme={theme} observationPoints={editor.observationPoints}
                  monitoringDevices={editor.sensorBindings} monitoringBindings={editor.serverBindings} monitoringMode
                  transformTools={editor.transformTools} onEquipmentSelect={handleFloorEquipmentSelect} onObservationPointAdd={addObservationPoint}
                />}
              />
            ) : (
              <FloorPlan3DScene
                building={focusedBuilding} floors={buildingFloors} currentFloor={selectedFloor}
                floorPlansById={editor.floorPlansById} verticalStructures={editor.verticalStructuresByBuildingId[focusedBuilding?.id] ?? []}
                equipmentByFloorId={editor.equipmentByFloorId} viewScope={isMonitoringStep ? VIEW_SCOPES.BUILDING : viewScope}
                editMode={workspaceMode} activePlanTemplateId={isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN ? editor.activeFloorPlanTemplateId : null}
                activeEquipmentTemplateId={isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.EQUIPMENT ? editor.activeFloorEquipmentTemplateId : null}
                selectedStructureId={editor.selectedFloorPlanStructureId} selectedEquipmentId={editor.selectedFloorEquipmentId}
                selectedSpatialEntity={editor.selectedSpatialEntity} onSpatialSelect={handleSpatialSelect}
                equipmentTranslucent={isFloorWorkspaceStep ? equipmentTranslucent : true}
                theme={theme} observationPoints={editor.observationPoints} monitoringDevices={editor.monitoringDevices}
                monitoringBindings={editor.monitoringBindings} monitoringMode={isMonitoringStep}
                transformTools={editor.transformTools}
                onPlanTransform={updateFloorPlanStructure} onEquipmentTransform={updateFloorEquipment}
                onPlanAdd={handlePlanAdd} onEquipmentAdd={handleFloorEquipmentAdd}
                onPlanSelect={handlePlanSelect} onEquipmentSelect={handleFloorEquipmentSelect} onObservationPointAdd={addObservationPoint}
                onCancelPlacement={clearFloorPlacement}
                externalStatus={editor.floorPlanValidationMessage}
              />
            )}
          </div>

          <EditorToolbar
            focusedScope hierarchyScopeLabel={wizardStep.contextLabel}
            panelMode={isCompositionStep ? "SPACE" : isFloorWorkspaceStep ? "FLOOR" : null}
            activePanelId={activeFloatingPanelId} onPanelChange={handleFloatingPanelChange}
            viewerTranslucent={isCompositionStep ? buildingsTranslucent : isFloorWorkspaceStep ? equipmentTranslucent : undefined}
            viewerTransparencyLabel={isCompositionStep
              ? `건축물 반투명 보기 ${buildingsTranslucent ? "끄기" : "켜기"}`
              : `설비 반투명 보기 ${equipmentTranslucent ? "끄기" : "켜기"}`}
            onViewerTransparencyChange={isCompositionStep ? setBuildingsTranslucent : setEquipmentTranslucent}
            showSelectionActions={!isMonitoringStep} showSiteInteractionTools={isCompositionStep}
            siteInteractionMode={siteInteractionMode} editorMode={workspaceMode === WORKSPACE_MODES.PLAN ? EDITOR_MODES.WORLD : EDITOR_MODES.EQUIPMENT}
            viewMode={isCompositionStep ? editor.viewMode : workspaceView === WORKSPACE_VIEWS.PLAN_2D ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D}
            transformTools={editor.transformTools} snapSize={editor.snapSize} gridSnapEnabled={editor.gridSettings.enabled}
            hasSelection={isCompositionStep ? hasSiteSelection : Boolean(activeWorkspaceSelection)} worldLocked={false}
            saveStatus={saveStatus} canUndo={editor.canUndo} canRedo={editor.canRedo}
            onEditorModeChange={() => {}} onSiteInteractionModeChange={handleSiteInteractionModeChange} onViewModeChange={isCompositionStep ? handleCompositionViewModeChange : setViewMode}
            onTransformToolToggle={(tool) => { if (isFloorWorkspaceStep) clearFloorPlacement(); toggleTransformTool(tool); }} onSnapSizeChange={setSnapSize} onGridSnapChange={setGridSnapEnabled}
            onToggleWorldLock={setWorldStructuresLocked}
            onDuplicate={isCompositionStep ? duplicateSelectedSiteEntity : workspaceMode === WORKSPACE_MODES.PLAN ? duplicateSelectedFloorPlanStructure : duplicateSelectedFloorEquipment}
            onDelete={isCompositionStep ? handleDeleteSiteSelection : workspaceMode === WORKSPACE_MODES.PLAN ? removeSelectedFloorPlanStructure : removeSelectedFloorEquipment}
            onReset={handleReset} onLoad={handleLoad} onSave={handlePrimaryAction} onUndo={handleUndo} onRedo={handleRedo}
          />
          {isCompositionStep || isFloorWorkspaceStep ? (
            <ViewModeToggle
              topAligned={isCompositionStep}
              sceneMetaAligned={isFloorWorkspaceStep}
              value={isCompositionStep ? editor.viewMode : workspaceView === WORKSPACE_VIEWS.PLAN_2D ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D}
              onChange={isCompositionStep
                ? handleCompositionViewModeChange
                : (mode) => { clearFloorPlacement(); setWorkspaceView(mode === VIEW_MODES.LAYOUT_2D ? WORKSPACE_VIEWS.PLAN_2D : WORKSPACE_VIEWS.SPACE_3D); }}
            />
          ) : null}
        </div>

        <div className={styles.floatingPanelHost}>
          <FloatingPanel open={panelOpen} title={panelTitle} topAligned onClose={isMonitoringStep ? undefined : handleFloatingPanelClose}>
            {isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <SiteAuthoringPanel areaSelection={siteAreaSelection} placementPlan={sitePlacementPlan} placementNotice={sitePlacementNotice} activeTemplateId={activeSiteTemplateId} activeVariants={activeSiteVariants} onClearArea={resetSiteInteraction} onConfirmAreaPlacement={() => completeAreaPlacement(activeSiteTemplateId, siteAreaSelection)} onSelectTemplate={handleSiteTemplateSelect} onVariantsChange={setActiveSiteVariants} />
            ) : isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.SETTINGS ? (
              <EnvironmentSettingsPanel environment={editor.siteEnvironment} boundaryNotice={editor.siteBoundaryNotice} onChange={handleSiteEnvironmentChange} />
            ) : isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.TERRAIN ? (
              <TerrainEditorPanel environment={editor.siteEnvironment} brush={terrainBrush} onBrushChange={setTerrainBrush} onEnvironmentChange={handleSiteEnvironmentChange} />
            ) : isCompositionStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECT_LIST ? (
              <WorldHierarchyPanel buildings={editor.buildings} siteObjects={editor.siteObjects} selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId} onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect} />
            ) : isCompositionStep ? (
              <>
                {editor.selectedBuilding ? <BuildingDetailNavigator buildings={editor.buildings} selectedBuildingId={editor.selectedBuilding.id} statusById={buildingSettingStatusById} selectedStatus={selectedBuildingStatus} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} onPrevious={() => handleAdjacentBuilding(-1)} onNext={() => handleAdjacentBuilding(1)} onComplete={handleBuildingComplete} /> : null}
                <ObjectDetailPanel building={editor.selectedBuilding} siteObject={editor.selectedSiteObject} siteEnvironment={editor.siteEnvironment} siteObjects={editor.siteObjects} floorCount={buildingFloors.length} floorPlanSummary={editor.floorPlanSummaryByBuildingId[focusedBuilding?.id]} onBuildingChange={handleBuildingChange} onOpenFloorPlans={() => enterStep(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT)} onSiteObjectChange={(changes) => editor.selectedSiteObjectId && updateSiteObject(editor.selectedSiteObjectId, changes)} onDeleteSiteObject={handleDeleteSiteSelection} />
              </>
            ) : isFloorWorkspaceStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECTS ? (
              <FloorWorkspaceCatalog
                mode={workspaceMode}
                onModeChange={handleWorkspaceModeChange}
                allowedStructureTemplateIds={FLOOR_PLAN_TEMPLATE_IDS}
                activeStructureTemplateId={editor.activeFloorPlanTemplateId}
                activeEquipmentTemplateId={editor.activeFloorEquipmentTemplateId}
                favoriteTemplateIds={editor.favoriteTemplateIds}
                floors={buildingFloors}
                currentFloorId={selectedFloor?.id}
                targetFloorIds={targetFloorIds}
                onTargetFloorIdsChange={setEquipmentTargetFloorIds}
                floorNavigator={floorNavigator}
                onSelectStructureTemplate={(id) => { handleWorkspaceModeChange(WORKSPACE_MODES.PLAN); selectFloorPlanTemplate(id); }}
                onSelectEquipmentTemplate={(id) => { handleWorkspaceModeChange(WORKSPACE_MODES.EQUIPMENT); selectFloorEquipmentTemplate(id); }}
                onToggleFavorite={toggleFavorite}
              />
            ) : isFloorWorkspaceStep && activeFloatingPanelId === WORLD_PANEL_IDS.OBJECT_LIST ? (
              <FloorObjectList
                floors={buildingFloors}
                structures={buildingFloorPlanStructures}
                equipment={editor.buildingFloorEquipment}
                selectedStructureId={editor.selectedFloorPlanStructureId}
                selectedEquipmentId={editor.selectedFloorEquipmentId}
                visibilityFilters={editor.floorPlanVisibilityFilters}
                onSelectStructure={(structure) => {
                  const targetFloorId = structure.floorId
                    ?? structure.applicationScope?.connectedFloorIds?.[0]
                    ?? selectedFloor?.id;
                  if (targetFloorId && targetFloorId !== selectedFloor?.id) navigateToFloor(targetFloorId);
                  setWorkspaceMode(WORKSPACE_MODES.PLAN);
                  handlePlanSelect(structure.id);
                }}
                onSelectEquipment={(item) => {
                  if (item.floorId && item.floorId !== selectedFloor?.id) navigateToFloor(item.floorId);
                  setWorkspaceMode(WORKSPACE_MODES.EQUIPMENT);
                  handleFloorEquipmentSelect(item.id);
                }}
                onToggleVisibility={toggleFloorPlanVisibilityFilter}
              />
            ) : isFloorWorkspaceStep && workspaceMode === WORKSPACE_MODES.PLAN ? (
              <WorldStructureProperties structure={editor.selectedFloorPlanStructure} spaces={focusedBuilding ? [{ id: focusedBuilding.id, name: focusedBuilding.name }] : []} floors={buildingFloors} currentFloorId={selectedFloor?.id} worldLocked={false} onChange={handlePlanChange} />
            ) : isFloorWorkspaceStep ? (
              <EquipmentProperties equipment={editor.selectedFloorEquipment} detailAsset={null} hasCollision={false} snapCandidate={null} placementOnly floors={buildingFloors} spaces={currentFloorSpaces} onChange={handleFloorEquipmentChange} />
            ) : (
              <MonitoringSettingsPanel
                equipment={editor.buildingFloorEquipment} selectedEquipmentId={editor.selectedFloorEquipmentId}
                assetBindings={editor.equipmentAssetBindings} sensorBindings={editor.sensorBindings} observationPoints={editor.observationPoints} serverBindings={editor.serverBindings}
                selectedAsset={editor.selectedAssetBinding} selectedPoint={editor.selectedObservationPoint} selectedSensor={editor.selectedSensorBinding} selectedServer={editor.selectedServerBinding}
                onAddAsset={addAssetBinding} onSelectAsset={selectAssetBinding} onUpdateAsset={updateAssetBinding}
                onAddPoint={addObservationPoint} onSelectPoint={selectObservationPoint} onUpdatePoint={updateObservationPoint}
                onAddSensor={addMonitoringDevice} onSelectSensor={selectMonitoringDevice} onUpdateSensor={updateMonitoringDevice}
                onAddServer={addMonitoringBinding} onSelectServer={selectMonitoringBinding} onUpdateServer={updateMonitoringBinding}
              />
            )}
          </FloatingPanel>
        </div>
      </div>
    </main>
  );
}
