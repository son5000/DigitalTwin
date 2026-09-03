import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArrowRightIcon, FloorGapIcon, FloorSelectIcon, MoonIcon, SaveIcon, SunIcon, WorldIcon } from "@/components/icons";
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
import MonitoringEquipmentPicker from "@/features/digitalTwin/editor/components/MonitoringEquipmentPicker";
import MovementTimeline from "@/features/digitalTwin/editor/components/MovementTimeline";
import ObservationScopeSelector from "@/features/digitalTwin/editor/components/ObservationScopeSelector";
import ObjectDetailPanel from "@/features/digitalTwin/editor/components/ObjectDetailPanel";
import SiteAuthoringPanel from "@/features/digitalTwin/editor/components/SiteAuthoringPanel";
import TerrainEditorPanel from "@/features/digitalTwin/editor/components/TerrainEditorPanel";
import ViewModeToggle from "@/features/digitalTwin/editor/components/ViewModeToggle";
import WorldHierarchyPanel from "@/features/digitalTwin/editor/components/WorldHierarchyPanel";
import WorldStructureProperties from "@/features/digitalTwin/editor/components/WorldStructureProperties";
import WorldWorkspaceNavigation from "@/features/digitalTwin/editor/components/WorldWorkspaceNavigation";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getDefaultObjectVariants, OBJECT_LIBRARY_DEFINITION_MAP } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import {
  formatFloorOptionLabel,
  normalizeFloorDisplayGap,
  sortFloorsByLevel,
} from "@/features/digitalTwin/editor/model/floorDisplay";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { intersectAreaWithSite } from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { ENVIRONMENT_TEMPLATE_IDS, getWizardStepIndex, WORLD_WIZARD_STEP_IDS, WORLD_WIZARD_STEPS } from "@/features/digitalTwin/editor/constants/worldWizard";
import { EDITOR_MODES, WORLD_STRUCTURE_TEMPLATES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorPreferences from "@/features/digitalTwin/editor/store/useEditorPreferences";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import FloorPlan3DScene from "@/features/digitalTwin/editor/three/FloorPlan3DScene";
import EquipmentObservationScene from "@/features/digitalTwin/editor/three/EquipmentObservationScene";
import FloorPlanScene from "@/features/digitalTwin/editor/three/FloorPlanScene";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";
import { DEFAULT_TERRAIN_BRUSH } from "@/features/digitalTwin/editor/terrain/TerrainEditor";
import {
  appendMovementWaypoint,
  changeMovementWaypoint,
  createDefaultMovementConfig,
  insertMovementWaypoint,
  isMovableSiteObject,
  MOVEMENT_PLAYBACK_STATES,
  normalizeMovementConfig,
  removeMovementWaypoint,
  validateMovementConfig,
} from "@/features/digitalTwin/editor/model/movementPath";
import { GROUND_VIEW_MODES } from "@/features/digitalTwin/editor/model/undergroundModel";
import {
  initializeLayout,
  LAYOUT_INITIALIZATION_STATUS,
} from "@/features/digitalTwin/editor/model/layoutInitialization";
import {
  getObservationScopeDefinition,
  normalizeObservationWorkflow,
  OBSERVATION_SCOPE_TYPES,
  resolveObservationEquipmentId,
} from "@/features/digitalTwin/editor/model/observationWorkflow";
import { equipmentAssetRepository } from "@/features/digitalTwin/editor/api/equipmentAssetRepository";
import { createLocalEquipmentAssetRecord } from "@/features/digitalTwin/editor/model/equipmentAssetFiles";
import { ASSET_SOURCE_TYPES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";

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
  const { editorPreferences, setShadowEnabled } = useEditorPreferences();
  const [wizardStepId, setWizardStepId] = useState(WORLD_WIZARD_STEP_IDS.COMPOSITION);
  const [layoutInitialization, setLayoutInitialization] = useState({
    status: LAYOUT_INITIALIZATION_STATUS.LOADING,
    message: "저장된 관측 구성을 확인하는 중입니다.",
  });
  const [layoutInitializationAttempt, setLayoutInitializationAttempt] = useState(0);
  const [showObservationScopeSelector, setShowObservationScopeSelector] = useState(false);
  const [monitoringEquipmentPickerOpen, setMonitoringEquipmentPickerOpen] = useState(false);
  const [monitoringEquipmentNotice, setMonitoringEquipmentNotice] = useState("");
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
  const [showOnlySelectedBuilding, setShowOnlySelectedBuilding] = useState(false);
  const [showFloorReference, setShowFloorReference] = useState(false);
  const [referenceFloorId, setReferenceFloorId] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(WORKSPACE_VIEWS.PLAN_2D);
  const [workspaceMode, setWorkspaceMode] = useState(WORKSPACE_MODES.PLAN);
  const [viewScope, setViewScope] = useState(VIEW_SCOPES.FLOOR);
  const [floorDisplayGap, setFloorDisplayGap] = useState(0);
  const [equipmentTargetFloorIds, setEquipmentTargetFloorIds] = useState([]);
  const [buildingsTranslucent, setBuildingsTranslucent] = useState(false);
  const [equipmentTranslucent, setEquipmentTranslucent] = useState(true);
  const [groundViewMode, setGroundViewMode] = useState(GROUND_VIEW_MODES.VISIBLE);
  const [movementPlayback, setMovementPlayback] = useState({ status: MOVEMENT_PLAYBACK_STATES.STOPPED, currentTime: 0, revision: 0 });
  const [movementPlaybackError, setMovementPlaybackError] = useState("");
  const movementClockRef = useRef({ currentTime: 0, duration: 0, status: MOVEMENT_PLAYBACK_STATES.STOPPED, onUiTimeChange: null });
  const buildingSaveRequestRef = useRef(0);
  const siteWorldCameraStateRef = useRef(null);
  const layoutReadyRef = useRef(false);
  const hydrateLayoutRef = useRef(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = window.__DIGITAL_TWIN_MOVEMENT_DEBUG__ ?? { activeRafLoops: 0, rafLoopStarts: 0 };
    debug.pageRenderCount = (debug.pageRenderCount ?? 0) + 1;
    window.__DIGITAL_TWIN_MOVEMENT_DEBUG__ = debug;
  });

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
    appendFloorFootprintHole, deleteFloorFootprintHole, drawFloorFootprintPolygon,
    combineFloorFootprintRegions, subtractFloorFootprintRegions,
    createElevationZone, changeElevationZone, divideElevationZone,
    createRoom, changeRoom, changeSharedWall, createDoor, changeDoor, deleteDoor,
    selectFloorEquipmentTemplate, addFloorEquipment, updateFloorEquipment, selectFloorEquipment,
    removeSelectedFloorEquipment, duplicateSelectedFloorEquipment,
    addObservationPoint, updateObservationPoint, selectObservationPoint,
    addAssetBinding, updateAssetBinding, selectAssetBinding,
    addMonitoringDevice, updateMonitoringDevice, selectMonitoringDevice,
    addMonitoringBinding, updateMonitoringBinding, selectMonitoringBinding,
    toggleFavorite,
    configureObservationWorkflow, extendObservationWorkflow, updateObservationViewerSettings,
  } = editor.actions;

  const activeWizardSteps = useMemo(() => {
    const ids = editor.observationWorkflow.activeStepIds?.length
      ? editor.observationWorkflow.activeStepIds
      : WORLD_WIZARD_STEPS.map((step) => step.id);
    const scopeDefinition = getObservationScopeDefinition(editor.observationWorkflow.scopeType);
    return ids.map((id, index) => {
      const step = WORLD_WIZARD_STEPS.find((item) => item.id === id);
      if (!step) return null;
      const scopeLabel = editor.observationWorkflow.scopeType === OBSERVATION_SCOPE_TYPES.BUILDING && id === WORLD_WIZARD_STEP_IDS.COMPOSITION
        ? "건물·층 설정"
        : editor.observationWorkflow.scopeType === OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT && id === WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT
          ? "설비 선택·배치"
          : scopeDefinition.stepLabels[index] ?? step.shortLabel;
      return { ...step, shortLabel: scopeLabel };
    }).filter(Boolean);
  }, [editor.observationWorkflow.activeStepIds, editor.observationWorkflow.scopeType]);
  const wizardStepIndex = Math.max(0, activeWizardSteps.findIndex((step) => step.id === wizardStepId));
  const wizardStep = activeWizardSteps[wizardStepIndex] ?? WORLD_WIZARD_STEPS[getWizardStepIndex(wizardStepId)];
  const isCompositionStep = wizardStepId === WORLD_WIZARD_STEP_IDS.COMPOSITION;
  const isFloorWorkspaceStep = wizardStepId === WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT;
  const isMonitoringStep = wizardStepId === WORLD_WIZARD_STEP_IDS.MONITORING;
  const userBuildings = useMemo(() => editor.buildings.filter((building) => !building.systemHost), [editor.buildings]);
  const isEmptyBuildingObservation = isCompositionStep
    && editor.observationWorkflow.scopeType === OBSERVATION_SCOPE_TYPES.BUILDING
    && userBuildings.length === 0;
  const focusedBuilding = editor.selectedBuilding ?? editor.currentBuilding ?? userBuildings[0] ?? editor.buildings[0] ?? null;
  const selectedBuildingId = focusedBuilding?.id ?? null;
  const buildingFloors = useMemo(
    () => sortFloorsByLevel(editor.floors.filter((floor) => floor.parentId === focusedBuilding?.id)),
    [editor.floors, focusedBuilding?.id],
  );
  const selectedFloor = editor.currentFloor?.parentId === focusedBuilding?.id
    ? editor.currentFloor
    : buildingFloors.find((floor) => Number(floor.level) === 1) ?? buildingFloors[0] ?? null;
  const aboveGroundFloorCount = buildingFloors.filter((floor) => Number(floor.level) > 0).length;
  const selectedMovableObject = isMovableSiteObject(editor.selectedSiteObject) ? editor.selectedSiteObject : null;
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
  const hasSiteSelection = Boolean(editor.selectedBuilding || editor.selectedSiteObject);
  const activeWorkspaceSelection = workspaceMode === WORKSPACE_MODES.PLAN ? editor.selectedFloorPlanStructure : editor.selectedFloorEquipment;
  const hasTransformSelection = isCompositionStep
    ? hasSiteSelection
    : isMonitoringStep
      ? Boolean(editor.selectedSensorBinding)
      : Boolean(isFloorWorkspaceStep && activeWorkspaceSelection);
  const handleFloorDisplayGapChange = useCallback((value) => {
    const nextGap = normalizeFloorDisplayGap(value);
    setFloorDisplayGap(nextGap);
    if (nextGap > 0) setViewScope(VIEW_SCOPES.BUILDING);
  }, []);
  const handleMovementEditStart = useCallback(() => {
    if (!editor.selectedSiteObjectId || !editor.selectedSiteObject) return;
    if (siteInteractionMode === SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH) {
      setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
      return;
    }
    const movement = editor.selectedSiteObject.movement
      ? normalizeMovementConfig(editor.selectedSiteObject.movement, editor.selectedSiteObject.position)
      : createDefaultMovementConfig(editor.selectedSiteObject.position);
    updateSiteObject(editor.selectedSiteObjectId, { movement: { ...movement, enabled: true } });
    setSiteInteractionMode(SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH);
    setMovementPlaybackError("");
    setMovementPlayback((current) => ({ ...current, status: MOVEMENT_PLAYBACK_STATES.PAUSED, currentTime: 0, revision: current.revision + 1 }));
  }, [editor.selectedSiteObject, editor.selectedSiteObjectId, siteInteractionMode, updateSiteObject]);
  const handleMovementEditComplete = useCallback(() => {
    setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
  }, []);
  const handleMovementWaypointAdd = useCallback((point) => {
    if (!editor.selectedSiteObjectId || !editor.selectedSiteObject) return;
    updateSiteObject(editor.selectedSiteObjectId, {
      movement: appendMovementWaypoint(editor.selectedSiteObject.movement, point, editor.selectedSiteObject.position),
    });
    setMovementPlaybackError("");
  }, [editor.selectedSiteObject, editor.selectedSiteObjectId, updateSiteObject]);
  const handleMovementWaypointChange = useCallback((waypointId, point) => {
    if (!editor.selectedSiteObjectId || !editor.selectedSiteObject) return;
    updateSiteObject(editor.selectedSiteObjectId, {
      movement: changeMovementWaypoint(editor.selectedSiteObject.movement, waypointId, point),
    });
    setMovementPlaybackError("");
  }, [editor.selectedSiteObject, editor.selectedSiteObjectId, updateSiteObject]);
  const handleMovementWaypointInsert = useCallback((index, point) => {
    if (!editor.selectedSiteObjectId || !editor.selectedSiteObject) return;
    updateSiteObject(editor.selectedSiteObjectId, { movement: insertMovementWaypoint(editor.selectedSiteObject.movement, index, point, editor.selectedSiteObject.position) });
    setMovementPlaybackError("");
  }, [editor.selectedSiteObject, editor.selectedSiteObjectId, updateSiteObject]);
  const handleMovementWaypointDelete = useCallback((waypointId) => {
    if (!editor.selectedSiteObjectId || !editor.selectedSiteObject) return;
    const result = removeMovementWaypoint(editor.selectedSiteObject.movement, waypointId);
    if (!result.removed) {
      setMovementPlaybackError("경로에는 경유점이 2개 이상 필요합니다.");
      return;
    }
    updateSiteObject(editor.selectedSiteObjectId, { movement: result.config });
    setMovementPlaybackError("");
  }, [editor.selectedSiteObject, editor.selectedSiteObjectId, updateSiteObject]);
  const handleMovementPlaybackChange = useCallback((nextPlayback) => {
    const object = editor.selectedSiteObject;
    if (nextPlayback.status === MOVEMENT_PLAYBACK_STATES.PLAYING) {
      if (!object || !isMovableSiteObject(object)) {
        setMovementPlaybackError("재생할 차량 또는 사람을 선택하세요.");
        return;
      }
      const validation = validateMovementConfig(object.movement);
      if (!validation.valid) {
        setMovementPlaybackError(validation.message);
        return;
      }
      if (!object.movement.enabled) updateSiteObject(object.id, { movement: { ...object.movement, enabled: true } });
      setMovementPlaybackError("");
      setMovementPlayback((current) => ({
        ...nextPlayback,
        objectId: object.id,
        currentTime: current.objectId && current.objectId !== object.id ? 0 : nextPlayback.currentTime,
      }));
      return;
    }
    setMovementPlaybackError("");
    setMovementPlayback((current) => ({ ...nextPlayback, objectId: current.objectId ?? object?.id ?? null }));
  }, [editor.selectedSiteObject, updateSiteObject]);
  const sitePlacementPlan = useMemo(() => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[activeSiteTemplateId];
    if (!siteAreaSelection || !definition) return null;
    const area = intersectAreaWithSite(siteAreaSelection, editor.siteEnvironment);
    return area ? placeObjectsInArea({ area, object: definition, gridEnabled: editor.gridSettings.enabled, cellSize: area.cellSize ?? editor.gridSettings.baseSize }) : null;
  }, [activeSiteTemplateId, editor.gridSettings.baseSize, editor.gridSettings.enabled, editor.siteEnvironment, siteAreaSelection]);

  useEffect(() => {
    hydrateLayoutRef.current = hydrateLayout;
  }, [hydrateLayout]);

  useEffect(() => {
    let cancelled = false;
    async function initializeEditor() {
      const result = await initializeLayout({ storage: window.localStorage });
      if (cancelled) return;
      if (result.status === LAYOUT_INITIALIZATION_STATUS.SUCCESS) {
        try {
          const hydrated = hydrateLayoutRef.current(result.layout);
          if (!hydrated) throw new Error("저장된 관측 구성의 구조가 올바르지 않습니다.");
          const workflow = normalizeObservationWorkflow(result.layout.observationWorkflow, { legacyLayout: !result.layout.observationWorkflow });
          setWizardStepId(workflow.activeStepIds[0] ?? WORLD_WIZARD_STEP_IDS.COMPOSITION);
          layoutReadyRef.current = true;
          setLayoutInitialization({ status: LAYOUT_INITIALIZATION_STATUS.SUCCESS, message: "로컬 관측 구성을 복원했습니다." });
          return;
        } catch {
          setLayoutInitialization({ status: LAYOUT_INITIALIZATION_STATUS.ERROR, message: "저장된 관측 구성의 일부가 손상되었습니다. 기존 데이터는 삭제되지 않았습니다." });
          return;
        }
      }
      if (result.status === LAYOUT_INITIALIZATION_STATUS.ERROR) {
        setLayoutInitialization({ status: result.status, message: result.message });
        return;
      }
      layoutReadyRef.current = true;
      setLayoutInitialization({ status: LAYOUT_INITIALIZATION_STATUS.EMPTY, message: "저장된 구성이 없어 새 관측 범위를 선택합니다." });
    }
    void initializeEditor();
    return () => { cancelled = true; };
  }, [layoutInitializationAttempt]);

  useEffect(() => {
    if (!editor.observationWorkflow.configured) return;
    if (editor.observationWorkflow.activeStepIds.includes(wizardStepId)) return;
    const timer = window.setTimeout(() => {
      setWizardStepId(editor.observationWorkflow.activeStepIds[0] ?? WORLD_WIZARD_STEP_IDS.MONITORING);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor.observationWorkflow.activeStepIds, editor.observationWorkflow.configured, wizardStepId]);

  useEffect(() => {
    if (!isMonitoringStep || !editor.observationWorkflow.configured) return undefined;
    const equipmentId = resolveObservationEquipmentId(editor.observationWorkflow, editor.allFloorEquipment, editor.selectedFloorEquipmentId);
    if (!equipmentId || equipmentId === editor.selectedFloorEquipmentId) return undefined;
    const timer = window.setTimeout(() => selectFloorEquipment(equipmentId), 0);
    return () => window.clearTimeout(timer);
  }, [editor.allFloorEquipment, editor.observationWorkflow, editor.selectedFloorEquipmentId, isMonitoringStep, selectFloorEquipment]);

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
    setShowOnlySelectedBuilding(false);
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
    setShowOnlySelectedBuilding(false);
    setActiveFloatingPanelId(null);
  }, [resetSiteInteraction, selectBuilding, selectSiteObject]);
  const handleFloatingPanelChange = useCallback((panelId) => {
    if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT) clearSitePlacement();
    if (isCompositionStep && panelId === WORLD_PANEL_IDS.TERRAIN) {
      resetSiteInteraction(SITE_INTERACTION_MODES.EDIT_TERRAIN);
      selectBuilding(null);
      selectSiteObject(null);
      setShowOnlySelectedBuilding(false);
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
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[templateId];
    const defaultVariants = getDefaultObjectVariants(definition);
    if (isEmptyBuildingObservation && definition?.createsBuilding) {
      const buildingId = addSiteObjectFromArea(templateId, {
        center: { x: 0, z: 0 },
        width: definition.width,
        depth: definition.depth,
      }, defaultVariants);
      if (buildingId) {
        setActiveSiteTemplateId(null);
        setActiveSiteVariants({});
        setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
        setSitePlacementNotice("건축물 크기에 맞춰 부지를 자동 생성했습니다.");
        setActiveFloatingPanelId(WORLD_PANEL_IDS.DETAILS);
        return;
      }
    }
    const same = siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT && activeSiteTemplateId === templateId;
    setActiveSiteTemplateId(same ? null : templateId);
    setActiveSiteVariants(same ? {} : defaultVariants);
    setSiteInteractionMode(same ? SITE_INTERACTION_MODES.NAVIGATE : SITE_INTERACTION_MODES.PLACE_OBJECT);
    setSitePlacementNotice("");
    selectBuilding(null);
    selectSiteObject(null);
    setShowOnlySelectedBuilding(false);
  }, [activeSiteTemplateId, addSiteObjectFromArea, isEmptyBuildingObservation, selectBuilding, selectSiteObject, siteInteractionMode]);
  const handleSiteTemplatePlace = useCallback((templateId, area, variants = activeSiteVariants) => {
    const id = templateId && area ? addSiteObjectFromArea(templateId, area, variants) : null;
    if (!id) return;
    selectBuilding(null);
    selectSiteObject(null);
    setShowOnlySelectedBuilding(false);
    setSitePlacementNotice("오브젝트 1개를 배치했습니다.");
  }, [activeSiteVariants, addSiteObjectFromArea, selectBuilding, selectSiteObject]);
  const completeAreaPlacement = useCallback((templateId, area, variants = activeSiteVariants) => {
    if (!templateId || !area) return null;
    const result = addSiteObjectsFromArea(templateId, area, variants);
    setSitePlacementNotice(result.canPlace ? `${result.count}개 오브젝트를 배치했습니다.` : result.message);
    if (result.canPlace) {
      selectBuilding(null);
      selectSiteObject(null);
      setShowOnlySelectedBuilding(false);
      setSiteAreaSelection(null);
    }
    return result;
  }, [activeSiteVariants, addSiteObjectsFromArea, selectBuilding, selectSiteObject]);
  const handleSiteBuildingSelect = useCallback((buildingId) => {
    resetSiteInteraction();
    selectBuilding(buildingId);
    if (!buildingId) setShowOnlySelectedBuilding(false);
    setActiveFloatingPanelId(buildingId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectBuilding]);
  const handleSiteObjectSelect = useCallback((objectId) => {
    resetSiteInteraction();
    selectSiteObject(objectId);
    setShowOnlySelectedBuilding(false);
    setActiveFloatingPanelId(objectId ? WORLD_PANEL_IDS.DETAILS : null);
  }, [resetSiteInteraction, selectSiteObject]);
  const handleBuildingChange = useCallback((changes) => {
    if (!selectedBuildingId) return;
    updateBuilding(selectedBuildingId, changes);
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
    setShowOnlySelectedBuilding(false);
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
    if (id && [OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT, OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT].includes(editor.observationWorkflow.scopeType)) {
      updateObservationViewerSettings({
        equipmentIds: [...new Set([...(editor.observationWorkflow.viewerSettings?.equipmentIds ?? []), id])],
        activeEquipmentId: id,
      });
    }
    setActiveFloatingPanelId(id ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [editor.observationWorkflow.scopeType, editor.observationWorkflow.viewerSettings?.equipmentIds, selectFloorEquipment, selectFloorEquipmentTemplate, selectFloorPlanTemplate, updateObservationViewerSettings]);
  const handleFloorEquipmentChange = useCallback((changes) => {
    if (editor.selectedFloorEquipmentId) updateFloorEquipment(editor.selectedFloorEquipmentId, changes);
  }, [editor.selectedFloorEquipmentId, updateFloorEquipment]);
  const handleMonitoringEquipmentAdd = useCallback((templateId) => {
    const floorId = selectedFloor?.id ?? editor.currentFloor?.id;
    if (!floorId) {
      setMonitoringEquipmentNotice("설비를 담을 기본 작업 공간을 준비하지 못했습니다. 관측 범위를 다시 선택해 주세요.");
      return null;
    }
    const spacing = Math.max(2, Number(editor.gridSettings.baseSize) || 1);
    const [equipmentId] = addFloorEquipment(templateId, { x: editor.allFloorEquipment.length * spacing, y: 0, z: 0 }, { floorId });
    if (!equipmentId) {
      setMonitoringEquipmentNotice("선택한 설비를 등록하지 못했습니다.");
      return null;
    }
    selectFloorEquipment(equipmentId);
    updateObservationViewerSettings({
      equipmentIds: [...new Set([...(editor.observationWorkflow.viewerSettings?.equipmentIds ?? []), equipmentId])],
      activeEquipmentId: equipmentId,
    });
    setMonitoringEquipmentNotice("관측 설비를 등록했습니다.");
    setMonitoringEquipmentPickerOpen(false);
    return equipmentId;
  }, [addFloorEquipment, editor.allFloorEquipment.length, editor.currentFloor?.id, editor.gridSettings.baseSize, editor.observationWorkflow.viewerSettings?.equipmentIds, selectFloorEquipment, selectedFloor?.id, updateObservationViewerSettings]);
  const handleMonitoringAssetFiles = useCallback(async (equipmentId, files) => {
    const prepared = createLocalEquipmentAssetRecord(files);
    if (!prepared.ok) {
      setMonitoringEquipmentNotice(prepared.message);
      return null;
    }
    try {
      await equipmentAssetRepository.put(prepared.record);
      const bindingId = addAssetBinding(equipmentId, {
        assetId: prepared.record.id,
        name: prepared.primary.name,
        fileName: prepared.primary.name,
        sourceKey: prepared.primary.name,
        relatedSourceKey: prepared.relatedMaterial?.name ?? null,
        textureSourceKey: prepared.relatedTexture?.name ?? null,
        sourceType: ASSET_SOURCE_TYPES.UPLOAD,
        assetType: prepared.assetType,
        usageType: prepared.usageType,
        displayMode: prepared.displayMode,
        status: "READY",
      });
      setMonitoringEquipmentNotice(`${prepared.primary.name} 파일을 이 브라우저에 저장하고 연결했습니다.`);
      return bindingId;
    } catch {
      setMonitoringEquipmentNotice("로컬 설비 파일을 저장하지 못했습니다. 브라우저 저장소 권한을 확인하세요.");
      return null;
    }
  }, [addAssetBinding]);
  const handleMonitoringNewAssetFiles = useCallback(async (files) => {
    const prepared = createLocalEquipmentAssetRecord(files);
    if (!prepared.ok) {
      setMonitoringEquipmentNotice(prepared.message);
      return;
    }
    const equipmentId = handleMonitoringEquipmentAdd("CABINET_SINGLE");
    if (!equipmentId) return;
    updateFloorEquipment(equipmentId, { name: prepared.primary.name.replace(/\.[^.]+$/, "") || "사용자 설비" });
    await handleMonitoringAssetFiles(equipmentId, files);
  }, [handleMonitoringAssetFiles, handleMonitoringEquipmentAdd, updateFloorEquipment]);
  const handleMonitoringEquipmentSelect = useCallback((equipmentId) => {
    handleFloorEquipmentSelect(equipmentId);
    updateObservationViewerSettings({ activeEquipmentId: equipmentId });
    setMonitoringEquipmentPickerOpen(false);
  }, [handleFloorEquipmentSelect, updateObservationViewerSettings]);
  const handleMonitoringDuplicate = useCallback(() => {
    const equipmentId = duplicateSelectedFloorEquipment();
    if (!equipmentId) return;
    updateObservationViewerSettings({
      equipmentIds: [...new Set([...(editor.observationWorkflow.viewerSettings?.equipmentIds ?? []), equipmentId])],
      activeEquipmentId: equipmentId,
    });
  }, [duplicateSelectedFloorEquipment, editor.observationWorkflow.viewerSettings?.equipmentIds, updateObservationViewerSettings]);
  const handleMonitoringDelete = useCallback(() => {
    const removedId = editor.selectedFloorEquipmentId;
    if (!removedId) return;
    const nextEquipment = editor.allFloorEquipment.find((item) => item.id !== removedId) ?? null;
    removeSelectedFloorEquipment();
    updateObservationViewerSettings({
      equipmentIds: (editor.observationWorkflow.viewerSettings?.equipmentIds ?? []).filter((id) => id !== removedId),
      activeEquipmentId: nextEquipment?.id ?? null,
    });
  }, [editor.allFloorEquipment, editor.observationWorkflow.viewerSettings?.equipmentIds, editor.selectedFloorEquipmentId, removeSelectedFloorEquipment, updateObservationViewerSettings]);
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
    if (!editor.observationWorkflow.activeStepIds.includes(stepId)) return;
    setWizardStepId(stepId);
    resetSiteInteraction();
    setShowOnlySelectedBuilding(false);
    if (stepId === WORLD_WIZARD_STEP_IDS.COMPOSITION) {
      navigateToSite();
      setActiveFloatingPanelId(null);
      return;
    }
    const floor = selectedFloor ?? editor.floors.find((item) => item.parentId === focusedBuilding?.id);
    if (floor) navigateToFloor(floor.id);
    setActiveFloatingPanelId(stepId === WORLD_WIZARD_STEP_IDS.MONITORING ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [editor.floors, editor.observationWorkflow.activeStepIds, focusedBuilding?.id, navigateToFloor, navigateToSite, resetSiteInteraction, selectedFloor]);
  const handleObservationScopeSelect = useCallback((scopeType, options = {}) => {
    const result = showObservationScopeSelector && editor.observationWorkflow.configured
      ? extendObservationWorkflow(scopeType, options)
      : configureObservationWorkflow(scopeType, options).workflow;
    const firstStepId = result.activeStepIds[0] ?? WORLD_WIZARD_STEP_IDS.MONITORING;
    setWizardStepId(firstStepId);
    setShowObservationScopeSelector(false);
    setActiveFloatingPanelId(firstStepId === WORLD_WIZARD_STEP_IDS.MONITORING ? WORLD_PANEL_IDS.DETAILS : WORLD_PANEL_IDS.OBJECTS);
  }, [configureObservationWorkflow, editor.observationWorkflow.configured, extendObservationWorkflow, showObservationScopeSelector]);
  const handlePrimaryAction = useCallback(() => {
    const currentIndex = activeWizardSteps.findIndex((step) => step.id === wizardStepId);
    const nextStep = activeWizardSteps[currentIndex + 1];
    if (nextStep) {
      enterStep(nextStep.id);
    } else {
      try {
        const payload = saveLayout(editor.layoutDocument);
        setSaveStatus(`설비 상세 저장 · ${new Date(payload.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setSaveStatus("저장하지 못했습니다");
      }
    }
  }, [activeWizardSteps, editor.layoutDocument, enterStep, wizardStepId]);
  const handleLoad = useCallback(() => {
    const saved = loadLayout();
    setSaveStatus(saved && hydrateLayout(saved) ? "저장된 월드를 불러왔습니다" : "저장된 배치가 없습니다");
  }, [hydrateLayout]);
  const handleReset = useCallback(() => {
    resetLayout();
    setWizardStepId(WORLD_WIZARD_STEP_IDS.COMPOSITION);
    setShowObservationScopeSelector(false);
    setSaveStatus("새 월드로 초기화했습니다");
  }, [resetLayout]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (isCompositionStep && siteInteractionMode === SITE_INTERACTION_MODES.EDIT_MOVEMENT_PATH) {
          event.preventDefault();
          handleMovementEditComplete();
          return;
        }
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
      if (hasTransformSelection && event.key.toLowerCase() === "w") toggleTransformTool("translate");
      if (hasTransformSelection && event.key.toLowerCase() === "e") toggleTransformTool("rotate");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearFloorPlacement, clearSelection, clearSitePlacement, duplicateSelectedFloorEquipment, duplicateSelectedFloorPlanStructure, duplicateSelectedSiteEntity, handleDeleteSiteSelection, handleMovementEditComplete, handleRedo, handleUndo, hasTransformSelection, isCompositionStep, isFloorWorkspaceStep, removeSelectedFloorEquipment, removeSelectedFloorPlanStructure, selectFloorEquipment, selectFloorPlanStructure, siteInteractionMode, toggleTransformTool, workspaceMode]);

  const hasNextWizardStep = wizardStepIndex < activeWizardSteps.length - 1;
  const primaryDisabled = hasNextWizardStep && ((isCompositionStep && userBuildings.length === 0) || ((isFloorWorkspaceStep || isMonitoringStep) && !selectedFloor));
  const stageContext = isCompositionStep
    ? `${editor.siteEnvironment.width.toFixed(0)} × ${editor.siteEnvironment.depth.toFixed(0)} m · 건축물 ${userBuildings.length} · 환경 ${environmentSiteObjects.length}`
    : isMonitoringStep
      ? `관측 설비 ${editor.allFloorEquipment.length}개 · ${editor.selectedFloorEquipment?.name ?? "설비 등록 필요"}`
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
        deleteFloorFootprintHole,
        drawFloorFootprintPolygon,
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

  if (layoutInitialization.status === LAYOUT_INITIALIZATION_STATUS.LOADING) {
    return <main className={styles.editor}><div className={styles.detailLoading} role="status">{layoutInitialization.message}</div></main>;
  }

  if (layoutInitialization.status === LAYOUT_INITIALIZATION_STATUS.ERROR) {
    return (
      <main className={styles.editor}>
        <section className={styles.initializationError} role="alert">
          <h1>관측 구성을 불러오지 못했습니다</h1>
          <p>{layoutInitialization.message}</p>
          <p>브라우저에 저장된 원본 데이터는 그대로 보존됩니다.</p>
          <div>
            <button type="button" onClick={() => {
              setLayoutInitialization({ status: LAYOUT_INITIALIZATION_STATUS.LOADING, message: "관측 구성을 다시 확인하는 중입니다." });
              setLayoutInitializationAttempt((attempt) => attempt + 1);
            }}>다시 시도</button>
            <button type="button" onClick={() => {
              layoutReadyRef.current = true;
              setLayoutInitialization({ status: LAYOUT_INITIALIZATION_STATUS.EMPTY, message: "새 관측 구성을 시작합니다." });
            }}>새 구성으로 계속</button>
          </div>
        </section>
      </main>
    );
  }

  if (!editor.observationWorkflow.configured || showObservationScopeSelector) {
    return (
      <main className={styles.editor}>
        <header className={styles.header}>
          <div className={styles.brandMark} aria-hidden="true"><WorldIcon size={24} /></div>
          <div className={styles.headerMeta}><span>{showObservationScopeSelector ? "관측 범위 확장" : "새 관측 프로젝트"}</span></div>
          <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}>
            <span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={19} /> : <SunIcon size={19} />}</span>
          </button>
        </header>
        <ObservationScopeSelector
          expansion={showObservationScopeSelector}
          currentScopeType={editor.observationWorkflow.scopeType}
          onSelect={handleObservationScopeSelect}
          onCancel={() => setShowObservationScopeSelector(false)}
        />
      </main>
    );
  }

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
        className={`${styles.workspace} ${isMonitoringStep ? styles.monitoringWorkspace : ""}`}
        style={{
          "--editor-overlay-right-safe": panelOpen && !isMonitoringStep
            ? "calc(var(--editor-overlay-panel-width) + (var(--editor-overlay-gap) * 2))"
            : "var(--editor-overlay-gap)",
          "--editor-overlay-mobile-bottom-safe": panelOpen
            ? "calc(40% + 86px)"
            : "74px",
          "--scene-status-right": panelOpen && !isMonitoringStep
            ? "calc(var(--editor-overlay-panel-width) + (var(--editor-overlay-gap) * 2))"
            : "var(--editor-overlay-gap)",
          "--floor-view-toggle-offset": isFloorWorkspaceStep
            ? "calc(var(--view-toggle-inline-size) + 8px)"
            : "0px",
        }}
      >
        <div className={styles.sceneArea} data-scene-area>
          <div className={styles.topNavigationRow} data-camera-safe-ui>
            <div className={styles.workspaceNavigation}><WorldWorkspaceNavigation activeViewId={wizardStepId} onViewChange={enterStep} steps={activeWizardSteps} /></div>
            <div className={styles.workflowControls}>
              {isMonitoringStep ? (
                <label>
                  <span>관측 설비</span>
                  <select
                    value={editor.selectedFloorEquipmentId ?? ""}
                    disabled={editor.allFloorEquipment.length === 0}
                    onChange={(event) => {
                      handleMonitoringEquipmentSelect(event.target.value || null);
                    }}
                  >
                    <option value="">설비를 선택하세요</option>
                    {editor.allFloorEquipment.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name}</option>)}
                  </select>
                </label>
              ) : null}
              {isMonitoringStep ? <button type="button" onClick={() => setMonitoringEquipmentPickerOpen(true)}>설비 추가</button> : null}
              <button type="button" className={styles.expandScopeButton} onClick={() => setShowObservationScopeSelector(true)}>관측 범위 확장</button>
            </div>
            <section className={styles.stageGuide} aria-label="현재 화면 작업"><button type="button" disabled={primaryDisabled} title={primaryDisabled ? "건축물과 층을 먼저 선택하세요" : wizardStep.primaryLabel} onClick={handlePrimaryAction}>{hasNextWizardStep ? <ArrowRightIcon size={16} /> : <SaveIcon size={16} />}<span>{hasNextWizardStep ? "다음" : "저장"}</span></button></section>
          </div>

          {isFloorWorkspaceStep ? (
            <div className={styles.workspaceControls} data-camera-safe-ui>
              <label className={styles.floorSelectControl}>
                <span className={styles.workspaceControlLabel}><FloorSelectIcon size={20} />층 선택</span>
                <select
                  value={selectedFloor?.id ?? ""}
                  disabled={!focusedBuilding || buildingFloors.length === 0}
                  aria-label="편집할 층 선택"
                  onChange={(event) => navigateToFloor(event.target.value)}
                >
                  {!selectedFloor ? <option value="">층을 선택하세요</option> : null}
                  {buildingFloors.map((floor, index) => (
                    <option key={floor.id} value={floor.id}>{formatFloorOptionLabel(floor, index + 1)}</option>
                  ))}
                </select>
              </label>
              {workspaceView === WORKSPACE_VIEWS.SPACE_3D ? (
                <div className={styles.workspaceControlGroup} role="group" aria-label="3D 표시 범위">
                  <button type="button" className={viewScope === VIEW_SCOPES.FLOOR ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.FLOOR)}>현재 층</button>
                  <button type="button" className={viewScope === VIEW_SCOPES.BUILDING ? styles.activeControl : ""} onClick={() => setViewScope(VIEW_SCOPES.BUILDING)}>전체 건축물</button>
                </div>
              ) : null}
              <div className={styles.workspaceControlGroup} role="group" aria-label="층 표시 간격 설정">
                <label className={styles.spreadControl}>
                  <span className={styles.workspaceControlLabel}><FloorGapIcon size={20} />층 간격</span>
                  <input type="range" min="0" max="12" step="0.5" value={floorDisplayGap} onChange={(event) => handleFloorDisplayGapChange(event.target.value)} />
                  <input type="number" min="0" max="12" step="0.5" value={floorDisplayGap} aria-label="층 표시 간격 미터" onChange={(event) => handleFloorDisplayGapChange(event.target.value)} />
                  <output>{floorDisplayGap.toFixed(1)} m</output>
                </label>
                <button type="button" disabled={floorDisplayGap === 0} onClick={() => handleFloorDisplayGapChange(0)}>초기화</button>
              </div>
            </div>
          ) : null}

          <div key={wizardStepId} className={styles.sceneTransition}>
            {isCompositionStep ? (
              <SiteOverviewScene
                siteEnvironment={editor.siteEnvironment} buildings={editor.buildings} floors={editor.floors} siteObjects={editor.siteObjects}
                selectedBuildingId={editor.selectedBuilding?.id ?? null} selectedSiteObjectId={editor.selectedSiteObjectId}
                selectedFloorId={null}
                interiorBuildingId={null}
                focusRequestKey={editor.navigationContext.transitionId} focusMode={showOnlySelectedBuilding} cameraStateRef={siteWorldCameraStateRef}
                buildingsTranslucent={buildingsTranslucent}
                groundViewMode={groundViewMode} movementPlayback={movementPlayback} movementClockRef={movementClockRef}
                interactionMode={siteInteractionMode} placementTemplateId={activeSiteTemplateId} placementVariants={activeSiteVariants}
                areaSelection={siteAreaSelection} theme={theme} viewMode={editor.viewMode} transformTools={editor.transformTools}
                gridSettings={editor.gridSettings} gridScopeId={editor.hierarchy.rootId}
                onSelectBuilding={handleSiteBuildingSelect} onSelectSiteObject={handleSiteObjectSelect}
                onUpdateBuilding={(id, changes) => id === selectedBuildingId ? handleBuildingChange(changes) : updateBuilding(id, changes)}
                onUpdateSiteObject={updateSiteObject} onEnterBuilding={handleSiteBuildingSelect} onSelectFloor={selectFloorInBuilding}
                onEnterFloor={(floorId) => { navigateToFloor(floorId); setWizardStepId(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT); setShowOnlySelectedBuilding(false); resetSiteInteraction(); setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS); }}
                onAreaSelectionChange={setSiteAreaSelection} onPlaceTemplate={handleSiteTemplatePlace} onPlaceTemplateArea={completeAreaPlacement} onCancelPlacement={clearSitePlacement}
                terrainBrush={terrainBrush} onTerrainChange={(terrain) => updateSiteEnvironment({ terrain })}
                onMovementWaypointAdd={handleMovementWaypointAdd}
                onMovementWaypointChange={handleMovementWaypointChange}
                onMovementWaypointInsert={handleMovementWaypointInsert}
                onMovementWaypointDelete={handleMovementWaypointDelete}
                onMovementEditComplete={handleMovementEditComplete}
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
                shadowEnabled={editorPreferences.shadowEnabled}
              />
            ) : isMonitoringStep ? (
              <EquipmentDetailWorkspace
                equipment={editor.selectedFloorEquipment}
                equipmentCount={editor.allFloorEquipment.length}
                assetBindings={editor.equipmentAssetBindings}
                selectedAsset={editor.selectedAssetBinding}
                selectedSensor={editor.selectedSensorBinding}
                theme={theme}
                onAddEquipment={() => setMonitoringEquipmentPickerOpen(true)}
                equipmentPicker={(monitoringEquipmentPickerOpen || !editor.selectedFloorEquipment) ? <MonitoringEquipmentPicker
                  equipment={editor.allFloorEquipment}
                  selectedEquipmentId={editor.selectedFloorEquipmentId}
                  required={!editor.selectedFloorEquipment}
                  notice={monitoringEquipmentNotice}
                  onClose={() => setMonitoringEquipmentPickerOpen(false)}
                  onSelect={handleMonitoringEquipmentSelect}
                  onAddTemplate={handleMonitoringEquipmentAdd}
                  onUploadAsset={handleMonitoringNewAssetFiles}
                /> : null}
                onAlignmentChange={(changes) => editor.selectedAssetBinding && updateAssetBinding(editor.selectedAssetBinding.id, { alignmentTransform: changes })}
                worldView={editor.selectedFloorEquipment ? <EquipmentObservationScene
                  equipment={editor.selectedFloorEquipment}
                  focusEquipmentId={editor.selectedFloorEquipment.id}
                  sensors={editor.sensorBindings}
                  observationPoints={editor.observationPoints}
                  bindings={editor.serverBindings}
                  selectedSensorId={editor.selectedSensorBinding?.id}
                  transformTools={editor.transformTools}
                  theme={theme}
                  onSensorSelect={selectMonitoringDevice}
                  onSensorChange={updateMonitoringDevice}
                /> : null}
                overviewView={<EquipmentObservationScene
                  equipmentList={editor.allFloorEquipment}
                  sensors={editor.sensorBindings}
                  observationPoints={editor.observationPoints}
                  bindings={editor.serverBindings}
                  selectedSensorId={editor.selectedSensorBinding?.id}
                  transformTools={editor.transformTools}
                  theme={theme}
                  onSensorSelect={selectMonitoringDevice}
                  onSensorChange={updateMonitoringDevice}
                />}
              />
            ) : (
              <FloorPlan3DScene
                building={focusedBuilding} floors={buildingFloors} currentFloor={selectedFloor}
                floorPlansById={editor.floorPlansById} verticalStructures={editor.verticalStructuresByBuildingId[focusedBuilding?.id] ?? []}
                equipmentByFloorId={editor.equipmentByFloorId} viewScope={isMonitoringStep ? VIEW_SCOPES.BUILDING : viewScope}
                floorDisplayGap={isFloorWorkspaceStep && viewScope === VIEW_SCOPES.BUILDING ? floorDisplayGap : 0} onFloorSelect={navigateToFloor}
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
                shadowEnabled={editorPreferences.shadowEnabled}
                groundViewMode={groundViewMode}
              />
            )}
          </div>

          {isEmptyBuildingObservation ? (
            <section className={styles.observationBuildingEmpty} data-camera-safe-ui aria-labelledby="observation-building-empty-title">
              <span>건물 중심 관측</span>
              <h2 id="observation-building-empty-title">관측할 건축물을 선택하세요</h2>
              <p>오브젝트 목록에서 건축물을 선택하면 실제 바닥 크기를 기준으로 여유 공간을 포함한 부지를 자동 생성합니다.</p>
              <button type="button" onClick={() => setActiveFloatingPanelId(WORLD_PANEL_IDS.OBJECTS)}>건축물 선택</button>
            </section>
          ) : null}

          <EditorToolbar
            focusedScope hierarchyScopeLabel={wizardStep.contextLabel}
            panelMode={isCompositionStep ? "SPACE" : isFloorWorkspaceStep ? "FLOOR" : null}
            activePanelId={activeFloatingPanelId} onPanelChange={handleFloatingPanelChange}
            viewerTranslucent={isCompositionStep ? buildingsTranslucent : isFloorWorkspaceStep ? equipmentTranslucent : undefined}
            viewerTransparencyLabel={isCompositionStep
              ? `건축물 반투명 보기 ${buildingsTranslucent ? "끄기" : "켜기"}`
              : `설비 반투명 보기 ${equipmentTranslucent ? "끄기" : "켜기"}`}
            onViewerTransparencyChange={isCompositionStep ? setBuildingsTranslucent : setEquipmentTranslucent}
            showSelectionActions showSiteInteractionTools={isCompositionStep}
            showMovementPathTool={Boolean(isCompositionStep && selectedMovableObject)}
            onMovementPathEdit={handleMovementEditStart}
            showBuildingIsolationToggle={isCompositionStep}
            buildingIsolationEnabled={showOnlySelectedBuilding}
            buildingIsolationAvailable={Boolean(editor.selectedBuilding)}
            showShadowToggle={isFloorWorkspaceStep || isMonitoringStep}
            showGroundViewControl={isCompositionStep || isFloorWorkspaceStep || isMonitoringStep}
            groundViewMode={groundViewMode}
            onGroundViewModeChange={setGroundViewMode}
            shadowEnabled={editorPreferences.shadowEnabled}
            onShadowEnabledChange={setShadowEnabled}
            onBuildingIsolationChange={(enabled) => {
              resetSiteInteraction();
              setShowOnlySelectedBuilding(Boolean(enabled && editor.selectedBuilding));
            }}
            siteInteractionMode={siteInteractionMode} editorMode={workspaceMode === WORKSPACE_MODES.PLAN ? EDITOR_MODES.WORLD : EDITOR_MODES.EQUIPMENT}
            viewMode={isCompositionStep ? editor.viewMode : workspaceView === WORKSPACE_VIEWS.PLAN_2D ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D}
            transformTools={editor.transformTools} snapSize={editor.snapSize} gridSnapEnabled={editor.gridSettings.enabled}
            hasSelection={isCompositionStep ? hasSiteSelection : isMonitoringStep ? Boolean(editor.selectedFloorEquipment) : Boolean(activeWorkspaceSelection)} worldLocked={false}
            saveStatus={saveStatus} canUndo={editor.canUndo} canRedo={editor.canRedo}
            onEditorModeChange={() => {}} onSiteInteractionModeChange={handleSiteInteractionModeChange} onViewModeChange={isCompositionStep ? handleCompositionViewModeChange : setViewMode}
            onTransformToolToggle={(tool) => { if (isFloorWorkspaceStep) clearFloorPlacement(); toggleTransformTool(tool); }} onSnapSizeChange={setSnapSize} onGridSnapChange={setGridSnapEnabled}
            onToggleWorldLock={setWorldStructuresLocked}
            onDuplicate={isCompositionStep ? duplicateSelectedSiteEntity : isMonitoringStep ? handleMonitoringDuplicate : workspaceMode === WORKSPACE_MODES.PLAN ? duplicateSelectedFloorPlanStructure : duplicateSelectedFloorEquipment}
            onDelete={isCompositionStep ? handleDeleteSiteSelection : isMonitoringStep ? handleMonitoringDelete : workspaceMode === WORKSPACE_MODES.PLAN ? removeSelectedFloorPlanStructure : removeSelectedFloorEquipment}
            onReset={handleReset} onLoad={handleLoad} onSave={handlePrimaryAction} onUndo={handleUndo} onRedo={handleRedo}
          />
          {isCompositionStep && selectedMovableObject?.movement ? <MovementTimeline key={selectedMovableObject.id} object={selectedMovableObject} playback={movementPlayback} movementClockRef={movementClockRef} error={movementPlaybackError} onChange={handleMovementPlaybackChange} /> : null}
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
          <FloatingPanel open={panelOpen} title={panelTitle} docked={isMonitoringStep} topAligned={!isMonitoringStep} contentScrollable={!isMonitoringStep} onClose={isMonitoringStep ? undefined : handleFloatingPanelClose}>
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
                {editor.selectedBuilding ? <BuildingDetailNavigator buildings={editor.buildings} selectedBuildingId={editor.selectedBuilding.id} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} onPrevious={() => handleAdjacentBuilding(-1)} onNext={() => handleAdjacentBuilding(1)} /> : null}
                <ObjectDetailPanel building={editor.selectedBuilding} siteObject={editor.selectedSiteObject} siteEnvironment={editor.siteEnvironment} siteObjects={editor.siteObjects} buildings={editor.buildings} floors={editor.floors} floorCount={aboveGroundFloorCount} floorPlanSummary={editor.floorPlanSummaryByBuildingId[focusedBuilding?.id]} onBuildingChange={handleBuildingChange} onOpenFloorPlans={() => enterStep(WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT)} onSiteObjectChange={(changes) => editor.selectedSiteObjectId && updateSiteObject(editor.selectedSiteObjectId, changes)} onMovementEditStart={handleMovementEditStart} onDeleteSiteObject={handleDeleteSiteSelection} />
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
                equipment={editor.allFloorEquipment} selectedEquipmentId={editor.selectedFloorEquipmentId}
                assetBindings={editor.equipmentAssetBindings} sensorBindings={editor.sensorBindings} observationPoints={editor.observationPoints} serverBindings={editor.serverBindings}
                selectedAsset={editor.selectedAssetBinding} selectedPoint={editor.selectedObservationPoint} selectedSensor={editor.selectedSensorBinding} selectedServer={editor.selectedServerBinding}
                onAddAsset={addAssetBinding} onSelectAsset={selectAssetBinding} onUpdateAsset={updateAssetBinding}
                onAddPoint={addObservationPoint} onSelectPoint={selectObservationPoint} onUpdatePoint={updateObservationPoint}
                onAddSensor={addMonitoringDevice} onSelectSensor={selectMonitoringDevice} onUpdateSensor={updateMonitoringDevice}
                onAddServer={addMonitoringBinding} onSelectServer={selectMonitoringBinding} onUpdateServer={updateMonitoringBinding}
                onUpdateEquipment={handleFloorEquipmentChange}
                onUploadAssetFiles={handleMonitoringAssetFiles}
              />
            )}
          </FloatingPanel>
        </div>
      </div>
    </main>
  );
}
