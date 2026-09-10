import { useCallback, useEffect, useMemo, useState } from "react";
import { LAYOUT_STORAGE_KEY } from "@/features/digitalTwin/editor/model/layoutInitialization";
import { ChevronRightIcon, CloseIcon } from "@/components/icons/actionIcons";
import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import WorldTreePanel from "../viewer/WorldTreePanel";
import { createWorldTree, getTreeAncestors, worldNodeKey } from "../viewer/worldTreeModel";
import { getBuildingObservationData } from "../viewer/buildingObservationData";
import { normalizeFloorDisplayGap } from "@/features/digitalTwin/editor/model/floorDisplay";
import WorldMenu from "../viewer/WorldMenu";
import ObservationHeader from "../viewer/ObservationHeader";
import portalStyles from "../viewer/ObservationPage.module.css";
import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";
import EquipmentObservationScene from "@/features/digitalTwin/editor/three/EquipmentObservationScene";
import { normalizeHierarchy } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { resolveSiteEnvironmentFromLayout } from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import { DEFAULT_GRID_SETTINGS } from "@/features/digitalTwin/editor/constants/gridSettings";
import { DISABLED_TRANSFORM_TOOLS } from "@/features/digitalTwin/editor/constants/transformTools";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { getProjectDetails, PROJECT_STORAGE_KEY, readProjects } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import viewerStyles from "./ProjectViewerPage.module.css";

const EMPTY_ITEMS = [];
const METRIC_LABELS = { TEMPERATURE: "온도", PRESSURE: "압력", VIBRATION: "진동", NOISE: "소음", POWER: "전력", FLOW: "유량", VIDEO: "영상" };

export default function ProjectViewerPage({ projectId }) {
  const [result, setResult] = useState(() => {
    try {
      const project = readProjects().projects.find((item) => item.id === projectId);
      return project ? { project } : { error: "프로젝트를 찾을 수 없습니다." };
    } catch (error) { return { error: error.message }; }
  });
  useEffect(() => {
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
  }, [projectId]);
  return result.project ? <SavedWorldViewer project={result.project} /> : <main className={styles.page}><div className={styles.main}><p role="alert" className={styles.notice}>{result.error}</p><button className={styles.back} onClick={() => navigateTo("/projects")}>프로젝트 목록</button></div></main>;
}

function SavedWorldViewer({ project }) {
  const { layout } = project;
  const tree = useMemo(() => createWorldTree(layout, getRuntimeCustomAsset), [layout]);
  const details = getProjectDetails({ ...project, layout: { ...layout, hierarchy: { nodes: tree.hierarchy }, equipmentByFloorId: { viewer: tree.equipment }, observationWorkflow: { ...layout.observationWorkflow, scopeType: tree.scope } } });
  const [selectedBuildingId, setSelectedBuildingId] = useState(tree.scope === "BUILDING" ? tree.root?.id : layout.observationWorkflow?.viewerSettings?.focusBuildingId ?? null);
  const [selectedSiteObjectId, setSelectedSiteObjectId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [observedBuildingId, setObservedBuildingId] = useState(null);
  const [floorDisplayGap, setFloorDisplayGap] = useState(0);
  const [wallOpacity, setWallOpacity] = useState(0.1);
  const [equipmentId, setEquipmentId] = useState(tree.scope === "SINGLE_EQUIPMENT" ? tree.root?.id : layout.observationWorkflow?.viewerSettings?.activeEquipmentId ?? null);
  const equipmentScope = tree.scope.includes("EQUIPMENT");
  const [showEquipment, setShowEquipment] = useState(equipmentScope);
  const [theme, setTheme] = useState("light");
  const snapshotRequest = useMemo(() => ({ scope: tree.scope, targetId: tree.root?.id, theme }), [tree, theme]);
  const [snapshot, setSnapshot] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [cameraControls, setCameraControls] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [treeSelection, setTreeSelection] = useState(() => ({ key: equipmentScope && equipmentId ? worldNodeKey("EQUIPMENT", equipmentId) : selectedBuildingId ? worldNodeKey("BUILDING", selectedBuildingId) : tree.root?.key, version: 0 }));
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [viewMode, setViewMode] = useState(VIEW_MODES.VIEW_3D);
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
  const selectedBuilding = !showEquipment ? model.buildings.find((building) => building.id === selectedBuildingId) : null;
  const buildingDetails = useMemo(() => getBuildingObservationData(layout, selectedBuilding, tree.hierarchy), [layout, selectedBuilding, tree.hierarchy]);
  const buildingObservation = useMemo(() => ({
    data: observedBuildingId === selectedBuildingId ? buildingDetails : null,
    floorId: selectedFloorId, gap: floorDisplayGap, opacity: wallOpacity, theme, selectionVersion: treeSelection.version,
  }), [buildingDetails, observedBuildingId, selectedBuildingId, selectedFloorId, floorDisplayGap, wallOpacity, theme, treeSelection.version]);
  const floorDetails = buildingDetails?.floors.find((floor) => floor.id === selectedFloorId);
  const activeEquipment = model.equipment.find((item) => item.id === equipmentId) ?? model.equipment[0];
  const selectedSpace = model.floors.find((item) => item.id === selectedFloorId)
    ?? model.siteObjects.find((item) => item.id === selectedSiteObjectId)
    ?? model.buildings.find((item) => item.id === selectedBuildingId);
  const selectedItem = showEquipment ? activeEquipment : selectedSpace;
  const sensors = showEquipment ? model.sensors.filter((item) => item.equipmentIds?.includes(activeEquipment?.id)) : model.sensors;
  const points = showEquipment ? model.points.filter((item) => item.equipmentId === activeEquipment?.id) : model.points;
  const markSelected = useCallback((key) => setTreeSelection((current) => ({ key, version: current.version + 1 })), []);
  const selectBuilding = useCallback((id) => {
    setWallOpacity(0.1); setFloorDisplayGap(0);
    setSelectedBuildingId(id); setSelectedSiteObjectId(null); setSelectedFloorId(null);
    setObservedBuildingId(id); setDetailOpen(Boolean(id));
    if (id) { setViewMode(VIEW_MODES.VIEW_3D); setShowEquipment(false); }
    markSelected(id ? worldNodeKey("BUILDING", id) : null);
  }, [markSelected]);
  const selectSiteObject = useCallback((id) => { setObservedBuildingId(null); setSelectedSiteObjectId(id); setSelectedBuildingId(null); setSelectedFloorId(null); markSelected(id ? worldNodeKey("SITE_OBJECT", id) : null); }, [markSelected]);
  const selectFloor = useCallback((id) => {
    setWallOpacity(id ? 0 : 0.1); setFloorDisplayGap(id ? 7 : 0);
    setSelectedFloorId(id); setSelectedSiteObjectId(null);
    setSelectedBuildingId(model.floors.find((item) => item.id === id)?.parentId ?? null);
    if (!equipmentScope && id) {
      setObservedBuildingId(model.floors.find((item) => item.id === id)?.parentId ?? null);
      setDetailOpen(true); setViewMode(VIEW_MODES.VIEW_3D); setShowEquipment(false);
    }
    markSelected(id ? worldNodeKey("FLOOR", id) : null);
  }, [equipmentScope, markSelected, model.floors]);
  const selectEquipment = useCallback((id, partId = null) => {
    setObservedBuildingId(null);
    setEquipmentId(id); setSelectedPartId(partId); setSelectedSensorId(null); setShowEquipment(true);
    markSelected(id ? worldNodeKey(partId ? "PART" : "EQUIPMENT", partId ?? id, partId ? id : undefined) : null);
  }, [markSelected]);
  const selectSensor = useCallback((id) => { setSelectedSensorId(id); }, []);

  function selectTreeNode(node) {
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

  function toggleSidebar() { setSidebarCollapsed((value) => !value); }
  function toggleMenu() {
    setMobileMenuOpen((value) => !value);
    if (mobileMenuOpen) { setSidebarCollapsed(true); setDetailOpen(false); setTopOpen(false); setBottomOpen(false); }
  }
  function goHome() {
    if (window.confirm("관측 화면을 나가 프로젝트 목록으로 돌아가시겠습니까?")) navigateTo("/projects");
  }

  return <div className={portalStyles.page} data-theme={theme}>
    <WorldMenu open={mobileMenuOpen} onToggle={toggleMenu} sidebarOpen={!sidebarCollapsed} onSidebarToggle={toggleSidebar}
      detailOpen={detailOpen} onDetailToggle={() => setDetailOpen((value) => !value)} topOpen={topOpen} onTopToggle={() => setTopOpen((value) => !value)}
      bottomOpen={bottomOpen} onBottomToggle={() => setBottomOpen((value) => !value)} theme={theme} onThemeToggle={() => setTheme((value) => value === "light" ? "dark" : "light")}
      onHome={goHome} onReset={() => { if (observedBuildingId) selectBuilding(null); else cameraControls?.reset(); }} />
    <div className={portalStyles.topPanel} hidden={!topOpen}>
      <ObservationHeader projectName={details.name} connectionLabel="실시간 데이터 수신 대기" connected={false} operatorName="" onHome={goHome} />
    </div>
    <div className={`${portalStyles.body} ${sidebarCollapsed ? portalStyles.bodyCollapsed : ""} ${detailOpen ? "" : portalStyles.bodyDetailClosed}`}>
      <aside className={`${portalStyles.sidebar} ${sidebarCollapsed ? portalStyles.sidebarCollapsed : ""}`} data-camera-safe-ui={!sidebarCollapsed ? "left" : undefined} aria-label="프로젝트 관측 메뉴" inert={sidebarCollapsed}>
        <div className={portalStyles.workspace}>
          <button type="button" className={portalStyles.collapseButton} onClick={toggleSidebar} aria-label={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"} aria-expanded={!sidebarCollapsed}><ChevronRightIcon size={16} /></button>
          <span>워크스페이스</span><strong>{details.name}</strong><small>{tree.config.label}</small>
        </div>
        <WorldTreePanel tree={tree} snapshot={snapshot?.request === snapshotRequest ? snapshot : null} selectedKey={treeSelection.key} selectionVersion={treeSelection.version} onSelect={selectTreeNode} />
        <div className={portalStyles.sidebarFooter}><button type="button" onClick={goHome}>프로젝트 목록으로</button></div>
      </aside>
      <main className={viewerStyles.world} data-scene-area aria-label={`${details.name} 관측 뷰어`}>
        <div className={viewerStyles.toolbar} hidden={!topOpen}>
          <div className={viewerStyles.viewModes}>
            {observedBuildingId ? <strong>건축물 상세 관측</strong> : showEquipment ? <strong>설비 관측</strong> : [[VIEW_MODES.VIEW_3D, "3D 월드"], [VIEW_MODES.LAYOUT_2D, "2D 도면"]].map(([mode, label]) => <button type="button" key={mode} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>{label}</button>)}
          </div>
          <button type="button" aria-expanded={detailOpen} onClick={() => setDetailOpen((value) => !value)}>{detailOpen ? "상세 패널 닫기" : "상세 패널 열기"}</button>
        </div>
        <div className={viewerStyles.scene}>
          {showEquipment ? model.equipment.length ? <EquipmentObservationScene equipmentList={model.equipment} focusEquipmentId={equipmentId} selectedPartId={selectedPartId} onEquipmentSelect={selectEquipment}
            snapshotRequest={equipmentScope ? snapshotRequest : null} onSnapshot={setSnapshot}
            sensors={model.sensors} observationPoints={model.points} assetBindings={layout.equipmentAssetBindings ?? EMPTY_ITEMS}
            viewerPreset={layout.viewerPreset} selectedSensorId={selectedSensorId} onSensorSelect={selectSensor} transformTools={DISABLED_TRANSFORM_TOOLS} theme={theme} onCameraControlsChange={setCameraControls} onZoomChange={setZoom} /> : <p className={viewerStyles.empty}>등록된 설비가 없습니다. 프로젝트 목록에서 편집하기로 설비를 추가하세요.</p>
            : <SiteOverviewScene {...model} showSceneControls={false} onCameraControlsChange={setCameraControls} onZoomChange={setZoom} selectedBuildingId={selectedBuildingId} selectedSiteObjectId={selectedSiteObjectId} selectedFloorId={selectedFloorId}
              buildingObservation={buildingObservation} snapshotRequest={!equipmentScope ? snapshotRequest : null} onSnapshot={setSnapshot}
              interactionMode={SITE_INTERACTION_MODES.NAVIGATE} viewMode={viewMode} theme={theme} transformTools={DISABLED_TRANSFORM_TOOLS} gridSettings={DEFAULT_GRID_SETTINGS}
              onSelectBuilding={selectBuilding} onSelectSiteObject={selectSiteObject} onSelectFloor={selectFloor} onEnterBuilding={selectBuilding} onEnterFloor={selectFloor} />}
        </div>
        <div className={portalStyles.zoom} aria-label="월드 줌"><button type="button" title="확대" aria-label="확대" disabled={!cameraControls} onClick={() => cameraControls.zoomBy(1.25)}>+</button><output aria-label="현재 줌 비율">{zoom}%</output><button type="button" title="축소" aria-label="축소" disabled={!cameraControls} onClick={() => cameraControls.zoomBy(0.8)}>−</button></div>
        <footer className={viewerStyles.worldFooter} hidden={!bottomOpen}><span>{selectedItem?.name || details.name}</span><span>최근 저장 · {details.modified}</span></footer>
      </main>
      <aside className={`${portalStyles.detailPanel} ${detailOpen ? portalStyles.detailPanelOpen : ""}`} data-camera-safe-ui={detailOpen ? "right" : undefined} aria-label={buildingDetails ? "건축물 상세 정보" : "관측 지표"} inert={!detailOpen}>
        <div className={portalStyles.detailHeader}>
          <div><span>{buildingDetails ? "건축물 상세 관측" : showEquipment ? "선택 설비" : "월드 관측"}</span><h2>{buildingDetails?.building.name || selectedItem?.name || details.name}</h2><p>{buildingDetails ? "저장된 도면과 층별 설비" : showEquipment ? "설비별 센서 및 관측 항목" : "프로젝트 전체 관측 현황"}</p></div>
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
          <header><span>{showEquipment ? "선택 설비 요약" : "프로젝트 요약"}</span><small>저장된 구성</small></header>
          <div className={portalStyles.metricGrid}><div><span>등록 센서</span><strong>{sensors.length}<em>개</em></strong></div><div><span>관측 포인트</span><strong>{points.length}<em>개</em></strong></div></div>
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
            }}><span>{sensor.name || "센서"}<small>{sensor.sensorType === "CAMERA" ? "카메라" : "센서"}</small></span><em>수신 대기</em></button>
          </li>)}</ul>
          {!sensors.length && <p className={viewerStyles.empty}>등록된 센서가 없습니다.</p>}
        </section>
        </>}
      </aside>
    </div>
  </div>;
}
