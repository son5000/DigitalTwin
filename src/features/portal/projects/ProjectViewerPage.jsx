import monitoringStyles from "../../digitalTwin/editor/components/MonitoringRoiWorkspace.module.css";
import ModelLayerControls from "../../digitalTwin/editor/components/ModelLayerControls";
import { ViewerOverlayContext } from "../../digitalTwin/editor/components/viewerOverlayContext";
import { sensorCapabilityLabel } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LAYOUT_STORAGE_KEY } from "@/features/digitalTwin/editor/model/layoutInitialization";
import { ChevronRightIcon, CloseIcon } from "@/components/icons/actionIcons";
import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import WorldTreePanel from "../viewer/WorldTreePanel";
import ScanLoadStatus from "../viewer/ScanLoadStatus";
import { createEquipmentRoiTree, createWorldTree, getTreeAncestors, getViewerEquipmentContext, worldNodeKey } from "../viewer/worldTreeModel";
import { getBuildingObservationData } from "../viewer/buildingObservationData";
import { normalizeFloorDisplayGap, resolveFloorSelectionGap } from "@/features/digitalTwin/editor/model/floorDisplay";
import WorldMenu from "../viewer/WorldMenu";
import ViewerServicePanel from "../viewer/ViewerServicePanel";
import { navigateViewerService } from "../viewer/operationsNavigation";
import useViewerOperations from "../viewer/useViewerOperations";
import { getOperationsDirectory, readViewerPreferences } from "../viewer/operationsModel.js";
import portalStyles from "../viewer/ObservationPage.module.css";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import MonitoringRoiWorkspace from "@/features/digitalTwin/editor/components/MonitoringRoiWorkspace";
import EquipmentObservationScene from "@/features/digitalTwin/editor/three/EquipmentObservationScene";
import { withClosedEnclosureDoors } from "@/features/digitalTwin/editor/model/equipmentEnclosure";
import { getFloorTerrainEnvironment } from "@/features/digitalTwin/editor/terrain/floorTerrain";
import useRoiMonitoring from "@/features/digitalTwin/editor/store/useRoiMonitoring";
import { viewerLink } from "@/features/digitalTwin/editor/model/roiMonitoring";
import { loadMonitoringProject, monitoringApiBase } from "@/features/digitalTwin/editor/api/roiRepository";
import { normalizeHierarchy } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { resolveSiteEnvironmentFromLayout } from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import { DEFAULT_GRID_SETTINGS } from "@/features/digitalTwin/editor/constants/gridSettings";
import { DISABLED_TRANSFORM_TOOLS } from "@/features/digitalTwin/editor/constants/transformTools";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { MOVEMENT_PLAYBACK_STATES } from "@/features/digitalTwin/editor/model/movementPath";
import { getProjectDetails, PROJECT_STORAGE_KEY, readProjects } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import viewerStyles from "./ProjectViewerPage.module.css";

const EMPTY_ITEMS = [];
const VIEWER_MOVEMENT_PLAYBACK = { status: MOVEMENT_PLAYBACK_STATES.PLAYING, currentTime: 0, revision: 0 };
const VIEWER_MOVEMENT_PAUSED = { status: MOVEMENT_PLAYBACK_STATES.PAUSED, currentTime: 0, revision: 0 };
const METRIC_LABELS = { TEMPERATURE: "온도", PRESSURE: "압력", VIBRATION: "진동", NOISE: "소음", POWER: "전력", FLOW: "유량", VIDEO: "영상" };

export default function ProjectViewerPage({ projectId, requestedEquipmentId = null, operationsSection = null, operationsRecord = null }) {
  const [result, setResult] = useState(() => {
    try {
      const project = readProjects().projects.find((item) => item.id === projectId);
      if (monitoringApiBase && project?.storageMode !== "LOCAL") return { loading: true };
      return project ? { project } : { error: "프로젝트를 찾을 수 없습니다." };
    } catch (error) { return { error: error.message }; }
  });
  const localImport = result.project?.storageMode === "LOCAL";
  useEffect(() => {
    if (!monitoringApiBase || localImport) return;
    const controller = new AbortController();
    loadMonitoringProject(projectId, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
      .then((project) => { if (!controller.signal.aborted) setResult({ project }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ error: error.message }); });
    return () => controller.abort();
  }, [projectId, localImport]);
  useEffect(() => {
    if (monitoringApiBase && !localImport) return;
    let timer;
    function refresh(event) {
      if (![LAYOUT_STORAGE_KEY, PROJECT_STORAGE_KEY].includes(event.key)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const project = readProjects().projects.find((item) => item.id === projectId);
          if (project) setResult((current) => JSON.stringify(current.project) === JSON.stringify(project) ? current : { project });
        } catch { /* Preserve the displayed world if another tab is still saving. */ }
      }, 350);
    }
    window.addEventListener("storage", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("storage", refresh); };
  }, [projectId, localImport]);
  if (result.loading) return <main className={styles.page}><p role="status">프로젝트를 불러오는 중입니다.</p></main>;
  return result.project ? <SavedWorldViewer project={result.project} requestedEquipmentId={requestedEquipmentId} operationsSection={operationsSection} operationsRecord={operationsRecord} /> : <main className={styles.page}><div className={styles.main}><p role="alert" className={styles.notice}>{result.error}</p><button className={styles.back} onClick={() => navigateTo("/projects")}>프로젝트 목록</button></div></main>;
}

function SavedWorldViewer({ project, requestedEquipmentId, operationsSection, operationsRecord }) {
  const { layout } = project;
  const [preferences] = useState(() => readViewerPreferences(project.id));
  const tree = useMemo(() => createWorldTree(layout, getRuntimeCustomAsset), [layout]);
  const linkedNode = requestedEquipmentId ? [...tree.nodes.values()].find((node) => node.id === requestedEquipmentId && getViewerEquipmentContext(tree, node)) : null;
  const monitoring = useRoiMonitoring(project.id);
  const [roiTarget, setRoiTarget] = useState(null);
  const [linkNotice, setLinkNotice] = useState("");
  const [copiedLink, setCopiedLink] = useState("");
  const directory = useMemo(() => getOperationsDirectory(tree), [tree]);
  const details = getProjectDetails({ ...project, layout: { ...layout, hierarchy: { nodes: tree.hierarchy }, equipmentByFloorId: { viewer: tree.equipment }, observationWorkflow: { ...layout.observationWorkflow, scopeType: tree.scope } } });
  const [selectedBuildingId, setSelectedBuildingId] = useState(tree.scope === "BUILDING" ? tree.root?.id : layout.observationWorkflow?.viewerSettings?.focusBuildingId ?? null);
  const [selectedSiteObjectId, setSelectedSiteObjectId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [observedBuildingId, setObservedBuildingId] = useState(null);
  const [floorDisplayGap, setFloorDisplayGap] = useState(0);
  const [wallOpacity, setWallOpacity] = useState(0.1);
  const [worldModelLayers, setWorldModelLayers] = useState({});
  const [equipmentId, setEquipmentId] = useState(linkedNode?.id ?? (tree.scope === "SINGLE_EQUIPMENT" ? tree.root?.id : tree.scope === "MULTI_EQUIPMENT" ? null : layout.observationWorkflow?.viewerSettings?.activeEquipmentId ?? null));
  const equipmentScope = tree.scope.includes("EQUIPMENT");
  const [showEquipment, setShowEquipment] = useState(equipmentScope);
  const [equipmentDetail, setEquipmentDetail] = useState(Boolean(linkedNode));
  // Single-equipment viewers already show the complete equipment scene.
  const isolatedEquipmentView = equipmentDetail && tree.scope !== "SINGLE_EQUIPMENT";
  const startsInSingleEquipmentView = tree.scope === "SINGLE_EQUIPMENT" || Boolean(linkedNode);
  const equipmentOverview = tree.scope === "MULTI_EQUIPMENT" && !equipmentDetail;
  const [theme, setTheme] = useState(preferences.theme === "dark" ? "dark" : "light");
  const snapshotScope = isolatedEquipmentView ? "SINGLE_EQUIPMENT" : tree.scope;
  const snapshotTargetId = isolatedEquipmentView ? equipmentId : tree.root?.id;
  const snapshotRequest = useMemo(() => ({ scope: snapshotScope, targetId: snapshotTargetId, theme, layout }), [snapshotScope, snapshotTargetId, theme, layout]);
  const [viewerCameraMemory] = useState(() => new Map());
  const [snapshot, setSnapshot] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => startsInSingleEquipmentView || window.matchMedia("(max-width: 1100px)").matches);
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia("(max-width: 1100px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const update = (event) => setCompactLayout(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState(startsInSingleEquipmentView ? "ROI" : null);
  const detailOpen = rightPanel === "DETAIL";
  const panelVisible = detailOpen || ((showEquipment || equipmentDetail) && ["ROI", "AUDIO", "THERMAL", "ALARMS"].includes(rightPanel));
  const sidebarVisible = !sidebarCollapsed && !(compactLayout && panelVisible);
  function setDetailOpen(value) {
    setRightPanel((current) => (typeof value === "function" ? value(current === "DETAIL") : value) ? "DETAIL" : null);
  }
  const activeService = operationsSection;
  const setActiveService = navigateViewerService;
  const [movementEnabled, setMovementEnabled] = useState(preferences.movementEnabled !== false);
  const [cameraControls, setCameraControls] = useState(null);
  const [controlsHost, setControlsHost] = useState(null);
  const [toolsHost, setToolsHost] = useState(null);
  const [panelHost, setPanelHost] = useState(null);
  const overlayLayoutRef = useRef(null);
  const overlayHosts = useMemo(() => ({ controls: controlsHost, tools: toolsHost, panel: panelHost }), [controlsHost, toolsHost, panelHost]);
  useEffect(() => {
    const layoutElement = overlayLayoutRef.current;
    if (!layoutElement || !controlsHost || !toolsHost) return;
    const controls = controlsHost.parentElement;
    const update = () => {
      layoutElement.style.setProperty("--controls-offset", `${controls.getBoundingClientRect().height + 8}px`);
      const toolsHeight = toolsHost.getBoundingClientRect().height;
      layoutElement.style.setProperty("--tools-offset", `${toolsHeight ? toolsHeight + 8 : 0}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(controls);
    observer.observe(toolsHost);
    update();
    return () => observer.disconnect();
  }, [controlsHost, toolsHost]);
  const [zoom, setZoom] = useState(100);
  const [treeSelection, setTreeSelection] = useState(() => ({ key: linkedNode?.key ?? (equipmentScope && equipmentId ? worldNodeKey("EQUIPMENT", equipmentId) : selectedBuildingId ? worldNodeKey("BUILDING", selectedBuildingId) : tree.root?.key), version: 0 }));
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [viewMode, setViewMode] = useState(preferences.viewMode === "2D" ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D);
  const [selectedSensorId, setSelectedSensorId] = useState(null);
  const model = useMemo(() => {
    const normalized = normalizeHierarchy({ ...layout.hierarchy, nodes: tree.hierarchy });
    const hierarchy = { nodes: tree.hierarchy.map((node) => normalized.nodes.find((item) => item.id === node.id) ?? node) };
    return {
      siteEnvironment: resolveSiteEnvironmentFromLayout(layout),
      buildings: hierarchy.nodes.filter((node) => node.type === "BUILDING"),
      floors: hierarchy.nodes.filter((node) => node.type === "FLOOR"),
      siteObjects: tree.siteObjects,
      equipment: tree.equipment,
      sensors: Array.isArray(layout.sensorBindings) ? layout.sensorBindings.filter(Boolean) : [],
      points: Array.isArray(layout.observationPoints) ? layout.observationPoints.filter(Boolean) : [],
    };
  }, [layout, tree]);
  const overviewEquipment = useMemo(() => model.equipment.filter((item) => item.visible !== false).map(withClosedEnclosureDoors), [model.equipment]);
  const terrainEnvironment = useMemo(() => {
    const ancestors = tree.root ? [tree.root, ...getTreeAncestors(tree, tree.root.key).map((key) => tree.nodes.get(key))] : [];
    const floorId = ancestors.find((node) => node.type === "FLOOR")?.id
      ?? tree.hierarchy.find((node) => node.id === tree.root?.parentId && node.type === "FLOOR")?.id
      ?? layout.hierarchy?.activeFloorId;
    const plan = layout.floorPlansById?.[floorId];
    return plan ? getFloorTerrainEnvironment(plan, model.siteEnvironment) : model.siteEnvironment;
  }, [layout, tree, model.siteEnvironment]);
  const equipmentContext = useMemo(() => getViewerEquipmentContext(tree, tree.nodes.get(treeSelection.key)), [tree, treeSelection.key]);
  const selectedBuilding = !showEquipment ? model.buildings.find((building) => building.id === selectedBuildingId) : null;
  const observationData = useMemo(() => getBuildingObservationData(layout, selectedBuilding, tree.hierarchy), [layout, selectedBuilding, tree.hierarchy]);
  const buildingDetails = equipmentContext ? null : observationData;
  const buildingObservation = useMemo(() => ({
    data: observedBuildingId === selectedBuildingId ? observationData : null,
    floorId: selectedFloorId, gap: floorDisplayGap, opacity: wallOpacity, theme, selectionVersion: treeSelection.version,
    equipmentId, modelLayers: worldModelLayers,
  }), [observationData, observedBuildingId, selectedBuildingId, selectedFloorId, floorDisplayGap, wallOpacity, theme, treeSelection.version, equipmentId, worldModelLayers]);
  const floorDetails = buildingDetails?.floors.find((floor) => floor.id === selectedFloorId);
  const activeEquipment = equipmentContext?.item ?? model.equipment.find((item) => item.id === equipmentId) ?? (equipmentScope ? model.equipment[0] : null);
  const sidebarEquipmentId = tree.scope === "SINGLE_EQUIPMENT" ? tree.root?.id : equipmentDetail ? activeEquipment?.id : null;
  const sidebarTree = useMemo(() => sidebarEquipmentId ? createEquipmentRoiTree(tree, sidebarEquipmentId, monitoring.rois) : tree, [tree, sidebarEquipmentId, monitoring.rois]);
  const representativeImage = sidebarEquipmentId ? sidebarTree.root?.item?.metadata?.representativeImage : layout.representativeImage;
  const sidebarRoiKey = roiTarget && rightPanel === "ROI" ? worldNodeKey("ROI", roiTarget.id, roiTarget.equipmentId) : null;
  const sidebarSelectedKey = sidebarTree.nodes.has(sidebarRoiKey) ? sidebarRoiKey : treeSelection.key;
  const detailEquipment = useMemo(() => {
    if (!isolatedEquipmentView) return model.equipment;
    if (!activeEquipment) return EMPTY_ITEMS;
    return [equipmentContext?.outdoor ? { ...activeEquipment, siteObject: activeEquipment } : activeEquipment];
  }, [isolatedEquipmentView, model.equipment, activeEquipment, equipmentContext?.outdoor]);
  const worldEquipment = useMemo(() => model.equipment.filter((item) =>
    !getViewerEquipmentContext(tree, tree.nodes.get(worldNodeKey("EQUIPMENT", item.id)))?.floor), [model.equipment, tree]);
  const equipmentFocus = useMemo(() => equipmentContext ? {
    item: equipmentContext.item, outdoor: equipmentContext.outdoor, version: treeSelection.version,
  } : null, [equipmentContext, treeSelection.version]);
  const selectedSpace = model.floors.find((item) => item.id === selectedFloorId)
    ?? model.siteObjects.find((item) => item.id === selectedSiteObjectId)
    ?? model.buildings.find((item) => item.id === selectedBuildingId);
  const selectedItem = equipmentContext || showEquipment ? activeEquipment : selectedSpace;
  const sensors = equipmentContext || showEquipment ? model.sensors.filter((item) => item.equipmentIds?.includes(activeEquipment?.id)) : model.sensors;
  const points = equipmentContext || showEquipment ? model.points.filter((item) => item.equipmentId === activeEquipment?.id) : model.points;
  const notifications = useMemo(() => {
    const entries = Array.isArray(layout.notifications) ? layout.notifications : Array.isArray(layout.events) ? layout.events : EMPTY_ITEMS;
    return entries.filter(Boolean).map((item, index) => ({
      id: item.id ?? `event-${index}`, severity: item.severity ?? item.status ?? "info",
      title: item.title ?? item.name ?? "운영 이벤트", message: item.message ?? item.description ?? "상세 내용을 확인해 주세요.",
      time: item.time ?? item.createdAt ?? item.occurredAt,
      assetId: [...tree.nodes.values()].find((node) => ["EQUIPMENT", "SITE_OBJECT"].includes(node.type) && node.id === (item.equipmentId ?? item.assetId))?.key,
    }));
  }, [layout, tree]);
  const operations = useViewerOperations(project.id, notifications);
  const markSelected = useCallback((key) => setTreeSelection((current) => ({ key, version: current.version + 1 })), []);
  const selectBuilding = useCallback((id) => {
    setEquipmentId(null); setEquipmentDetail(false);
    setWallOpacity(0.1); setFloorDisplayGap(0);
    setSelectedBuildingId(id); setSelectedSiteObjectId(null); setSelectedFloorId(null);
    setObservedBuildingId(id); setDetailOpen(Boolean(id));
    if (id) { setViewMode(VIEW_MODES.VIEW_3D); setShowEquipment(false); }
    markSelected(id ? worldNodeKey("BUILDING", id) : null);
  }, [markSelected]);
  const selectFloor = useCallback((id) => {
    setEquipmentId(null); setEquipmentDetail(false);
    setWallOpacity(id ? 0 : 0.1);
    setFloorDisplayGap((current) => resolveFloorSelectionGap({ currentGap: current, previousFloorId: selectedFloorId, nextFloorId: id }));
    setSelectedFloorId(id); setSelectedSiteObjectId(null);
    setSelectedBuildingId(model.floors.find((item) => item.id === id)?.parentId ?? null);
    if (!equipmentScope && id) {
      setObservedBuildingId(model.floors.find((item) => item.id === id)?.parentId ?? null);
      setDetailOpen(true); setViewMode(VIEW_MODES.VIEW_3D); setShowEquipment(false);
    }
    markSelected(id ? worldNodeKey("FLOOR", id) : null);
  }, [equipmentScope, markSelected, model.floors, selectedFloorId]);
  const selectEquipment = useCallback((id, partId = null, type = "EQUIPMENT") => {
    const key = id ? worldNodeKey(partId ? "PART" : type, partId ?? id, partId ? id : undefined) : null;
    const context = getViewerEquipmentContext(tree, tree.nodes.get(key));
    setEquipmentId(id); setSelectedPartId(partId); setSelectedSensorId(null);
    setEquipmentDetail((current) => Boolean(id) && (equipmentScope || current));
    if (id && equipmentScope) { setSidebarCollapsed(true); setRightPanel("ROI"); }
    else setDetailOpen(Boolean(id));
    setViewMode(VIEW_MODES.VIEW_3D); setShowEquipment(equipmentScope);
    if (!equipmentScope) {
      setObservedBuildingId(context?.building?.id ?? null);
      setSelectedBuildingId(context?.building?.id ?? null);
      setSelectedSiteObjectId(context?.outdoor ? id : null);
      if (context?.floor?.id !== selectedFloorId) {
        setSelectedFloorId(context?.floor?.id ?? null);
        setFloorDisplayGap((current) => resolveFloorSelectionGap({ currentGap: current, previousFloorId: selectedFloorId, nextFloorId: context?.floor?.id }));
        setWallOpacity(context?.floor ? 0 : 0.1);
      }
    }
    markSelected(key);
  }, [tree, equipmentScope, selectedFloorId, markSelected]);
  const selectSiteObject = useCallback((id) => {
    if (getViewerEquipmentContext(tree, tree.nodes.get(worldNodeKey("SITE_OBJECT", id)))) {
      selectEquipment(id, null, "SITE_OBJECT"); return;
    }
    setEquipmentId(null); setEquipmentDetail(false); setShowEquipment(false);
    setObservedBuildingId(null); setSelectedSiteObjectId(id); setSelectedBuildingId(null); setSelectedFloorId(null);
    markSelected(id ? worldNodeKey("SITE_OBJECT", id) : null);
  }, [tree, selectEquipment, markSelected]);
  const selectSensor = useCallback((id) => { setSelectedSensorId(id); }, []);

  function showParentSpace() {
    setEquipmentDetail(false); setShowEquipment(equipmentScope);
    setSelectedPartId(null); setSelectedSensorId(null); setRoiTarget(null); setRightPanel(null);
    if (equipmentScope) { setEquipmentId(null); markSelected(tree.root?.key); }
    else markSelected(equipmentContext?.node.key ?? tree.root?.key);
  }

  function selectTreeNode(node) {
    if (node.type === "ROI") {
      if (equipmentId !== node.equipmentId || !(showEquipment || equipmentDetail)) {
        selectEquipment(node.equipmentId, null, sidebarTree.root.type);
        setEquipmentDetail(true);
        setSidebarCollapsed(true);
      }
      // A fresh selection request also lets the same ROI be focused again.
      setRoiTarget(structuredClone(node.item)); setRightPanel("ROI");
      return;
    }
    if (node.type === "EQUIPMENT" || node.type === "PART") {
      selectEquipment(node.equipmentId ?? node.id, node.type === "PART" ? node.id : null);
      return;
    }
    setSelectedSensorId(null); setSelectedPartId(null);
    setShowEquipment(equipmentScope && ["ROOM", "FLOOR"].includes(node.type));
    if (node.type === "BUILDING") selectBuilding(node.id);
    else if (node.type === "SITE_OBJECT") selectSiteObject(node.id);
    else if (node.type === "FLOOR") selectFloor(node.id);
    else if (node.type === "ROOM") {
      const floor = getTreeAncestors(tree, node.key).map((key) => tree.nodes.get(key)).find((item) => item.type === "FLOOR");
      selectFloor(floor?.id ?? null);
    } else { selectBuilding(null); if (!observedBuildingId) cameraControls?.reset(); }
    if (equipmentScope) setEquipmentId(null);
    markSelected(node.key);
  }

  function toggleSidebar() {
    if (!sidebarVisible && compactLayout) setRightPanel(null);
    setSidebarCollapsed(sidebarVisible);
  }
  function toggleMenu() {
    setMobileMenuOpen((value) => !value);
  }
  function goHome() {
    if (window.confirm("관측 화면을 나가 프로젝트 목록으로 돌아가시겠습니까?")) navigateTo("/projects");
  }

  async function copyViewerLink(targetId) {
    const link = viewerLink(project.id, targetId);
    setCopiedLink(link);
    try { await navigator.clipboard.writeText(link); setLinkNotice("뷰어 링크를 복사했습니다."); }
    catch { setLinkNotice("아래 링크를 선택해 복사하세요."); }
  }
  if (requestedEquipmentId && !linkedNode) return <main className={styles.page}><p role="alert">이 프로젝트에서 링크의 설비를 찾을 수 없습니다.</p><a href={viewerLink(project.id)}>공간 전체 보기</a></main>;

  return <div className={portalStyles.page} data-theme={theme}>
    <div className={activeService ? portalStyles.worldViewInactive : undefined} inert={Boolean(activeService)} aria-hidden={activeService ? true : undefined}>
    <WorldMenu open={mobileMenuOpen} onToggle={toggleMenu} sidebarOpen={sidebarVisible} onSidebarToggle={toggleSidebar}
      detailOpen={detailOpen} onDetailToggle={() => setDetailOpen((value) => !value)}
      activeService={activeService} onServiceChange={setActiveService}
      onHome={goHome} notificationCount={operations.data.notifications.filter((item) => item.status === "미확인").length} />

    <ViewerOverlayContext value={overlayHosts}>
    <div ref={overlayLayoutRef} className={viewerStyles.layout} data-sidebar={sidebarVisible} data-panel={panelVisible}>
      <aside className={`${portalStyles.sidebar} ${sidebarVisible ? "" : portalStyles.sidebarCollapsed}`} data-camera-safe-ui={sidebarVisible ? "left" : undefined} aria-label="프로젝트 관측 메뉴" inert={!sidebarVisible}>
        <div className={portalStyles.workspace}>
          <button type="button" className={portalStyles.collapseButton} onClick={toggleSidebar} aria-label={sidebarVisible ? "메뉴 접기" : "메뉴 펼치기"} aria-expanded={sidebarVisible}><ChevronRightIcon size={16} /></button>
          <span>워크스페이스</span><strong>{details.name}</strong><small>{sidebarTree.config.label}</small>
        </div>
        {(isolatedEquipmentView || (!equipmentScope && equipmentContext)) && <nav className={viewerStyles.parentNavigation} aria-label="설비 관측 탐색">
          <button type="button" data-parent={isolatedEquipmentView} onClick={isolatedEquipmentView ? showParentSpace : () => { setEquipmentDetail(true); setSidebarCollapsed(true); setRightPanel("ROI"); }}><ChevronRightIcon size={14} />{isolatedEquipmentView ? tree.scope === "MULTI_EQUIPMENT" ? "전체 설비 보기" : "상위 공간 보기" : "설비 상세 보기"}</button>
        </nav>}
        {(showEquipment || equipmentDetail) && !detailEquipment.length && <p className={viewerStyles.empty} role="status">등록된 설비가 없습니다. 프로젝트 목록에서 편집하기로 설비를 추가하세요.</p>}
        <WorldTreePanel tree={sidebarTree} projectName={getProjectDetails(project).name} snapshot={snapshot?.request === snapshotRequest ? snapshot : null} representativeImage={representativeImage} selectedKey={sidebarSelectedKey} selectionVersion={treeSelection.version} onSelect={selectTreeNode} />

        <div className={portalStyles.sidebarFooter}><button type="button" onClick={goHome}>프로젝트 목록으로</button></div>
      </aside>
      <main className={viewerStyles.world} data-scene-area aria-label={`${details.name} 관측 뷰어`}>
        <div ref={setToolsHost} className={viewerStyles.sceneTools} />
        <div className={viewerStyles.scene}>
          <ScanLoadStatus equipmentId={equipmentId} popup />
          {equipmentOverview ? <EquipmentObservationScene key="equipment-overview" overview equipmentList={overviewEquipment} terrainEnvironment={terrainEnvironment} gridSettings={layout.gridSettings ?? DEFAULT_GRID_SETTINGS}
            onEquipmentSelect={selectEquipment} snapshotRequest={snapshotRequest} onSnapshot={setSnapshot} cameraMemory={viewerCameraMemory}
            theme={theme} onCameraControlsChange={setCameraControls} onZoomChange={setZoom} />
            : showEquipment || equipmentDetail ? detailEquipment.length ? <MonitoringRoiWorkspace key={equipmentId ?? "world"} projectId={project.id} initialRoi={roiTarget?.equipmentId === equipmentId ? roiTarget : null} activePanel={rightPanel} sharedPanelLayout onPanelChange={setRightPanel} equipmentList={detailEquipment} focusEquipmentId={equipmentId} selectedPartId={selectedPartId} onEquipmentSelect={isolatedEquipmentView ? undefined : selectEquipment}
            animateEquipmentFocus preserveWorldOnSelection={!selectedPartId} focusSelectionVersion={treeSelection.version} cameraMemory={viewerCameraMemory}
            snapshotRequest={snapshotRequest} onSnapshot={setSnapshot}
            sensors={model.sensors} observationPoints={model.points} assetBindings={layout.equipmentAssetBindings ?? EMPTY_ITEMS}
            viewerPreset={layout.viewerPreset} selectedSensorId={selectedSensorId} onSensorSelect={selectSensor} transformTools={DISABLED_TRANSFORM_TOOLS} theme={theme} onCameraControlsChange={setCameraControls} onZoomChange={setZoom} /> : null
            : <SiteOverviewScene {...model} enableObjectLod={false} movementPlayback={movementEnabled ? VIEWER_MOVEMENT_PLAYBACK : VIEWER_MOVEMENT_PAUSED} showSceneControls={false} onCameraControlsChange={setCameraControls} onZoomChange={setZoom} selectedBuildingId={selectedBuildingId} selectedSiteObjectId={selectedSiteObjectId} selectedFloorId={selectedFloorId}
              buildingObservation={buildingObservation} equipmentFocus={equipmentFocus} worldEquipment={worldEquipment} snapshotRequest={!equipmentScope ? snapshotRequest : null} onSnapshot={setSnapshot}
              equipmentAssetBindings={layout.equipmentAssetBindings ?? EMPTY_ITEMS} viewerPreset={layout.viewerPreset} modelLayers={worldModelLayers}
              interactionMode={SITE_INTERACTION_MODES.NAVIGATE} viewMode={viewMode} theme={theme} transformTools={DISABLED_TRANSFORM_TOOLS} gridSettings={DEFAULT_GRID_SETTINGS}
              onSelectBuilding={selectBuilding} onSelectEquipment={selectEquipment} onSelectFloor={selectFloor} onEnterBuilding={selectBuilding} onEnterFloor={selectFloor} />}
        </div>

        {!showEquipment && !equipmentDetail && activeEquipment && (layout.equipmentAssetBindings ?? []).some((binding) => binding.equipmentId === activeEquipment.id && ["OBJ", "PLY"].includes(binding.assetType)) && <ModelLayerControls hasScan value={worldModelLayers[activeEquipment.id]} onChange={(value) => setWorldModelLayers((current) => ({ ...current, [activeEquipment.id]: value }))} />}
        <div className={viewerStyles.controlDock} role="group" aria-label="뷰어 조작" data-camera-safe-ui>
          <div ref={setControlsHost} className={viewerStyles.controlItems} />
          <div className={portalStyles.zoom} role="group" aria-label="월드 줌"><button type="button" title="확대" aria-label="확대" disabled={!cameraControls} onClick={() => cameraControls.zoomBy(1.25)}>+</button><output aria-label="현재 줌 비율">{zoom}%</output><button type="button" title="축소" aria-label="축소" disabled={!cameraControls} onClick={() => cameraControls.zoomBy(0.8)}>−</button></div>
        </div>
      </main>
      <div ref={setPanelHost} className={viewerStyles.panelHost}>
      {detailOpen && <aside className={`${portalStyles.detailPanel} ${portalStyles.detailPanelOpen} ${monitoringStyles.viewerPanel}`} data-camera-safe-ui={detailOpen ? "right" : undefined} aria-label={buildingDetails ? "건축물 상세 정보" : "관측 지표"} inert={!detailOpen}>
        <div className={portalStyles.detailHeader}>
          <div><span>{buildingDetails ? "건축물 상세 관측" : equipmentContext || showEquipment ? "선택 설비" : "월드 관측"}</span><h2>{buildingDetails?.building.name || selectedItem?.name || details.name}</h2><p>{buildingDetails ? "저장된 도면과 층별 설비" : equipmentContext || showEquipment ? "설비별 센서 및 관측 항목" : "프로젝트 전체 관측 현황"}</p><ScanLoadStatus equipmentId={equipmentId} /></div>
          <button type="button" className={portalStyles.iconButton} onClick={() => setDetailOpen(false)} aria-label="상세 패널 닫기"><CloseIcon size={18} /></button>
        </div>
        {buildingDetails ? <>
          <section className={portalStyles.detailSection}>
            <header><span>건축물 기본 정보</span><small>저장 기준</small></header>
            <dl className={viewerStyles.summaryGrid}>
              <div><dt>층수</dt><dd>{buildingDetails.floors.length}</dd></div>
              <div><dt>설비</dt><dd>{buildingDetails.floors.reduce((count, floor) => count + floor.allEquipment.length, 0)}</dd></div>
              <div><dt>너비</dt><dd>{selectedBuilding.parameters?.width ?? "—"} m</dd></div>
              <div><dt>깊이</dt><dd>{selectedBuilding.parameters?.depth ?? "—"} m</dd></div>
            </dl>
          </section>
          <section className={`${portalStyles.detailSection} ${viewerStyles.buildingControls}`}>
            <header><span>관측 표시</span></header>
            <label>외벽 불투명도 <output>{Math.round(wallOpacity * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={wallOpacity} onChange={(event) => setWallOpacity(Number(event.target.value))} /></label>
            <label>층 분리 간격 <output>{floorDisplayGap.toFixed(1)} m</output><input type="range" min="0" max="12" step="0.5" value={floorDisplayGap} onChange={(event) => setFloorDisplayGap(normalizeFloorDisplayGap(event.target.value))} /></label>
            <div>
              <button type="button" onClick={() => setFloorDisplayGap(0)} disabled={!observedBuildingId || floorDisplayGap === 0}>층 분리 해제</button>
              {observedBuildingId ? <button type="button" onClick={() => selectBuilding(selectedBuildingId)}>건축물 전체 보기</button>
                : <button type="button" onClick={() => selectBuilding(selectedBuildingId)}>상세 관측</button>}
              <button type="button" onClick={() => selectBuilding(null)}>선택 해제</button>
            </div>
          </section>
          <section className={portalStyles.detailSection}>
            <header><span>층 목록</span><small>높이 순서</small></header>
            <ul className={viewerStyles.sensorList}>{[...buildingDetails.floors].reverse().map((floor) => <li key={floor.id}>
              <button type="button" aria-pressed={selectedFloorId === floor.id} onClick={() => selectFloor(floor.id)}><span>{floor.name}<small>{floor.summary}</small></span></button>
            </li>)}</ul>
            {!buildingDetails.floors.length && <p className={viewerStyles.empty}>저장된 층이 없습니다.</p>}
          </section>
          <section className={portalStyles.detailSection}>
            <header><span>{floorDetails?.name ?? "층별 현황"}</span></header>
            {floorDetails ? <>
              <p className={viewerStyles.empty}>{floorDetails.hasPlan ? "저장된 도면 표시 중" : "저장된 도면 없음"} · 공간 {floorDetails.spaces.length}개 · 설비 {floorDetails.allEquipment.length}개</p>
              <p className={viewerStyles.empty}>{floorDetails.facilities.join(" · ") || "공간·시설 정보 없음"}</p>
              <ul className={viewerStyles.equipmentNames}>{floorDetails.allEquipment.map((item, index) => <li key={item.id}>{item.name || `설비 ${index + 1}`}</li>)}</ul>
              {!floorDetails.allEquipment.length && <p className={viewerStyles.empty}>배치된 설비가 없습니다.</p>}
            </> : <p className={viewerStyles.empty}>층 또는 층 라벨을 선택하세요.</p>}
          </section>
        </> : <>
        <div className={viewerStyles.dataStatus}><i /><div><strong>실시간 데이터 수신 대기</strong><p>측정 데이터가 연결되면 상태와 추이를 확인할 수 있습니다.</p></div></div>
        <section className={portalStyles.detailSection}>
          <header><span>{equipmentContext || showEquipment ? "선택 설비 요약" : "프로젝트 요약"}</span><small>저장된 구성</small></header>
          <div className={portalStyles.metricGrid}><div><span>등록 센서</span><strong>{sensors.length}<em>개</em></strong></div><div><span>관측 영역</span><strong>{points.length}<em>개</em></strong></div></div>
        </section>
        <section className={portalStyles.detailSection}>
          <header><span>실시간 KPI</span><small>수신 대기</small></header>
          <div className={portalStyles.metricGrid}>{points.map((point) => <div key={point.id}><span>{point.name || METRIC_LABELS[point.metric] || point.metric}</span><strong>—</strong><small>{METRIC_LABELS[point.metric] || point.metric} · 수신 대기</small></div>)}</div>
          {!points.length && <p className={viewerStyles.empty}>등록된 관측 항목이 없습니다.</p>}
        </section>
        <section className={portalStyles.detailSection}>
          <header><span>측정 추이</span><small>수신 대기</small></header>
          <div className={viewerStyles.trendEmpty}>아직 수신된 측정 데이터가 없습니다.</div>
        </section>
        <section className={portalStyles.detailSection}>
          <header><span>등록 센서</span><b>{sensors.length}개</b></header>
          <ul className={viewerStyles.sensorList}>{sensors.map((sensor) => <li key={sensor.id}>
            <button type="button" aria-pressed={selectedSensorId === sensor.id} onClick={() => {
              const host = model.equipment.find((item) => sensor.equipmentIds?.includes(item.id));
              if (host) { selectEquipment(host.id); }
              setSelectedSensorId(sensor.id);
            }}><span>{sensor.name || "센서"}<small>{sensorCapabilityLabel(sensor)}</small></span><em>수신 대기</em></button>
          </li>)}</ul>
          {!sensors.length && <p className={viewerStyles.empty}>등록된 센서가 없습니다.</p>}
        </section>
        </>}
      </aside>}
      </div>
    </div>
    </ViewerOverlayContext>
    </div>
    <ViewerServicePanel active={activeService} initialRecord={operationsRecord} onNavigate={navigateViewerService} onClose={() => setActiveService(null)} operations={operations} directory={directory} onLocate={(key) => { const node = tree.nodes.get(key); if (node) selectTreeNode(node); }} projectName={details.name}
      viewerLinks={<>        <section className={viewerStyles.linkTools} aria-label="뷰어 링크"><button type="button" onClick={() => copyViewerLink()}>공간 링크 복사</button>
          {activeEquipment && <button type="button" onClick={() => copyViewerLink(activeEquipment.id)}>설비 링크 복사</button>}
          {linkNotice && <p role="status">{linkNotice}</p>}{copiedLink && <input aria-label="복사할 뷰어 링크" readOnly value={copiedLink} onFocus={(event) => event.target.select()} />}
        </section><p className={viewerStyles.empty}>공간 링크는 프로젝트의 기본 관측 화면을, 설비 링크는 선택한 설비의 상세 화면을 엽니다.</p></>}
      theme={theme} onThemeChange={setTheme} movementEnabled={movementEnabled} onMovementToggle={setMovementEnabled}
      viewMode={viewMode} onViewModeChange={setViewMode} onReset={() => { if (observedBuildingId) selectBuilding(null); else cameraControls?.reset(); }} onProjects={goHome} />
  </div>;
}
