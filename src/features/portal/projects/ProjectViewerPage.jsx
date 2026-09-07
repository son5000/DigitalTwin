import { useCallback, useMemo, useState } from "react";
import { ChevronRightIcon, CloseIcon, SearchIcon } from "@/components/icons/actionIcons";
import { EquipmentIcon, WorldIcon } from "@/components/icons/hierarchyIcons";
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
import { getProjectDetails, readProjects } from "./projectRepository";
import styles from "./ProjectsPage.module.css";
import viewerStyles from "./ProjectViewerPage.module.css";

const METRIC_LABELS = { TEMPERATURE: "온도", PRESSURE: "압력", VIBRATION: "진동", NOISE: "소음", POWER: "전력", FLOW: "유량", VIDEO: "영상" };

export default function ProjectViewerPage({ projectId }) {
  const [result] = useState(() => {
    try {
      const project = readProjects().projects.find((item) => item.id === projectId);
      return project ? { project } : { error: "프로젝트를 찾을 수 없습니다." };
    } catch (error) { return { error: error.message }; }
  });
  return result.project ? <SavedWorldViewer project={result.project} /> : <main className={styles.page}><div className={styles.main}><p role="alert" className={styles.notice}>{result.error}</p><button className={styles.back} onClick={() => navigateTo("/projects")}>프로젝트 목록</button></div></main>;
}

function SavedWorldViewer({ project }) {
  const { layout } = project;
  const details = getProjectDetails(project);
  const [selectedBuildingId, setSelectedBuildingId] = useState(layout.observationWorkflow?.viewerSettings?.focusBuildingId ?? null);
  const [selectedSiteObjectId, setSelectedSiteObjectId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [equipmentId, setEquipmentId] = useState(layout.observationWorkflow?.viewerSettings?.activeEquipmentId ?? null);
  const equipmentScope = ["SINGLE_EQUIPMENT", "MULTI_EQUIPMENT"].includes(layout.observationWorkflow?.scopeType);
  const [showEquipment, setShowEquipment] = useState(equipmentScope);
  const [theme, setTheme] = useState("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(() => !window.matchMedia("(max-width: 800px)").matches);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState(VIEW_MODES.VIEW_3D);
  const [selectedSensorId, setSelectedSensorId] = useState(null);
  const model = useMemo(() => {
    const hierarchy = normalizeHierarchy(layout.hierarchy);
    return {
      siteEnvironment: resolveSiteEnvironmentFromLayout(layout),
      buildings: hierarchy.nodes.filter((node) => node.type === "BUILDING"),
      floors: hierarchy.nodes.filter((node) => node.type === "FLOOR"),
      siteObjects: layout.siteObjects ?? [],
      equipment: Object.values(layout.equipmentByFloorId ?? {}).flat(),
      sensors: layout.sensorBindings ?? [],
      points: layout.observationPoints ?? [],
    };
  }, [layout]);
  const activeEquipment = model.equipment.find((item) => item.id === equipmentId) ?? model.equipment[0];
  const selectedSpace = model.floors.find((item) => item.id === selectedFloorId)
    ?? model.siteObjects.find((item) => item.id === selectedSiteObjectId)
    ?? model.buildings.find((item) => item.id === selectedBuildingId);
  const selectedItem = showEquipment ? activeEquipment : selectedSpace;
  const sensors = showEquipment ? model.sensors.filter((item) => item.equipmentIds?.includes(activeEquipment?.id)) : model.sensors;
  const points = showEquipment ? model.points.filter((item) => item.equipmentId === activeEquipment?.id) : model.points;
  const keyword = query.trim().toLocaleLowerCase("ko");
  const items = (showEquipment ? model.equipment : [...model.buildings, ...model.siteObjects]).filter((item) => (item.name ?? "").toLocaleLowerCase("ko").includes(keyword));
  const selectBuilding = useCallback((id) => { setSelectedBuildingId(id); setSelectedSiteObjectId(null); setSelectedFloorId(null); if (id) setDetailOpen(true); }, []);
  const selectSiteObject = useCallback((id) => { setSelectedSiteObjectId(id); setSelectedBuildingId(null); setSelectedFloorId(null); if (id) setDetailOpen(true); }, []);
  const selectFloor = useCallback((id) => { setSelectedFloorId(id); setSelectedSiteObjectId(null); if (id) setDetailOpen(true); }, []);
  const selectSensor = useCallback((id) => { setSelectedSensorId(id); if (id) setDetailOpen(true); }, []);

  function changeView(equipmentView) {
    setShowEquipment(equipmentView);
    setQuery("");
    setSelectedSensorId(null);
  }

  function selectItem(item) {
    if (showEquipment) { setEquipmentId(item.id); setSelectedSensorId(null); }
    else if (model.buildings.some((building) => building.id === item.id)) selectBuilding(item.id);
    else selectSiteObject(item.id);
    setDetailOpen(true);
    setMobileMenuOpen(false);
  }

  return <div className={portalStyles.page} data-theme={theme}>
    <ObservationHeader theme={theme} projectName={details.name} connectionLabel="실시간 데이터 수신 대기" connected={false} notificationCount={0} operatorName=""
      onHome={() => navigateTo("/projects")} onMenuToggle={() => setMobileMenuOpen((value) => !value)} onThemeToggle={() => setTheme((value) => value === "light" ? "dark" : "light")} />
    <div className={`${portalStyles.body} ${sidebarCollapsed ? portalStyles.bodyCollapsed : ""} ${detailOpen ? "" : portalStyles.bodyDetailClosed}`}>
      <aside className={`${portalStyles.sidebar} ${sidebarCollapsed ? portalStyles.sidebarCollapsed : ""} ${mobileMenuOpen ? portalStyles.sidebarMobileOpen : ""}`} aria-label="프로젝트 관측 메뉴">
        <div className={portalStyles.workspace}>
          <button type="button" className={portalStyles.collapseButton} onClick={() => { setSidebarCollapsed((value) => !value); setMobileMenuOpen(false); }} aria-label={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"} aria-expanded={!sidebarCollapsed}><ChevronRightIcon size={16} /></button>
          <span>워크스페이스</span><strong>{details.name}</strong><small>{details.scope}</small>
        </div>
        <nav className={portalStyles.menu} aria-label="관측 범위">
          {!equipmentScope && <button type="button" className={!showEquipment ? portalStyles.menuActive : ""} aria-pressed={!showEquipment} onClick={() => changeView(false)} title="월드 관측"><WorldIcon size={18} /><span>월드 관측</span></button>}
          <button type="button" className={showEquipment ? portalStyles.menuActive : ""} aria-pressed={showEquipment} onClick={() => changeView(true)} title="설비 관측"><EquipmentIcon size={18} /><span>설비 관측</span><em>{model.equipment.length}</em></button>
        </nav>
        <div className={`${portalStyles.assetList} ${viewerStyles.inventory}`}>
          <div><span>프로젝트 요약</span><b>저장 기준</b></div>
          <dl className={viewerStyles.summaryGrid}>
            {[["건축물", model.buildings.length], ["층", model.floors.length], ["설비", model.equipment.length], ["센서", model.sensors.length]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
          </dl>
        </div>
        <label className={portalStyles.search}><SearchIcon size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showEquipment ? "설비 검색" : "공간 검색"} aria-label={showEquipment ? "설비 검색" : "공간 검색"} /></label>
        <section className={portalStyles.assetList} aria-label={showEquipment ? "관측 설비 목록" : "공간 목록"}>
          <div><span>{showEquipment ? "관측 설비" : "공간 탐색"}</span><b>{items.length}</b></div>
          {items.map((item) => <button type="button" key={item.id} className={selectedItem?.id === item.id ? portalStyles.assetActive : ""} aria-pressed={selectedItem?.id === item.id} onClick={() => selectItem(item)}>
            <i style={{ "--status": "var(--portal-blue)" }} /><span><strong>{item.name || "이름 없음"}</strong><small>{showEquipment ? "설비 관측" : "월드 공간"}</small></span><ChevronRightIcon size={14} />
          </button>)}
          {!items.length && <p className={viewerStyles.empty}>{keyword ? "검색 결과가 없습니다." : "등록된 항목이 없습니다."}</p>}
        </section>
        <div className={portalStyles.sidebarFooter}><button type="button" onClick={() => navigateTo("/projects")}>프로젝트 목록으로</button></div>
      </aside>
      {mobileMenuOpen && <button type="button" className={portalStyles.mobileScrim} onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기" />}
      <main className={viewerStyles.world} aria-label={`${details.name} 관측 뷰어`}>
        <div className={viewerStyles.toolbar}>
          <div className={viewerStyles.viewModes}>
            {showEquipment ? <strong>설비 관측</strong> : [[VIEW_MODES.VIEW_3D, "3D 월드"], [VIEW_MODES.LAYOUT_2D, "2D 도면"]].map(([mode, label]) => <button type="button" key={mode} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>{label}</button>)}
          </div>
          <button type="button" aria-expanded={detailOpen} onClick={() => setDetailOpen((value) => !value)}>{detailOpen ? "지표 패널 닫기" : "지표 패널 열기"}</button>
        </div>
        <div className={viewerStyles.scene}>
          {showEquipment ? model.equipment.length ? <EquipmentObservationScene equipmentList={model.equipment} focusEquipmentId={activeEquipment?.id}
            sensors={model.sensors} observationPoints={model.points} assetBindings={layout.equipmentAssetBindings ?? []}
            viewerPreset={layout.viewerPreset} selectedSensorId={selectedSensorId} onSensorSelect={selectSensor} transformTools={DISABLED_TRANSFORM_TOOLS} theme={theme} /> : <p className={viewerStyles.empty}>등록된 설비가 없습니다. 프로젝트 목록에서 편집하기로 설비를 추가하세요.</p>
            : <SiteOverviewScene {...model} selectedBuildingId={selectedBuildingId} selectedSiteObjectId={selectedSiteObjectId} selectedFloorId={selectedFloorId}
              interactionMode={SITE_INTERACTION_MODES.NAVIGATE} viewMode={viewMode} theme={theme} transformTools={DISABLED_TRANSFORM_TOOLS} gridSettings={DEFAULT_GRID_SETTINGS}
              onSelectBuilding={selectBuilding} onSelectSiteObject={selectSiteObject} onSelectFloor={selectFloor} onEnterBuilding={selectBuilding} onEnterFloor={selectFloor} />}
        </div>
        <footer className={viewerStyles.worldFooter}><span>{selectedItem?.name || details.name}</span><span>최근 저장 · {details.modified}</span></footer>
      </main>
      <aside className={`${portalStyles.detailPanel} ${detailOpen ? portalStyles.detailPanelOpen : ""}`} aria-label="관측 지표" inert={!detailOpen}>
        <div className={portalStyles.detailHeader}>
          <div><span>{showEquipment ? "선택 설비" : "월드 관측"}</span><h2>{selectedItem?.name || details.name}</h2><p>{showEquipment ? "설비별 센서 및 관측 항목" : "프로젝트 전체 관측 현황"}</p></div>
          <button type="button" className={portalStyles.iconButton} onClick={() => setDetailOpen(false)} aria-label="상세 패널 닫기"><CloseIcon size={18} /></button>
        </div>
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
              if (host) { setEquipmentId(host.id); setShowEquipment(true); setQuery(""); }
              setSelectedSensorId(sensor.id);
            }}><span>{sensor.name || "센서"}<small>{sensor.sensorType === "CAMERA" ? "카메라" : "센서"}</small></span><em>수신 대기</em></button>
          </li>)}</ul>
          {!sensors.length && <p className={viewerStyles.empty}>등록된 센서가 없습니다.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
