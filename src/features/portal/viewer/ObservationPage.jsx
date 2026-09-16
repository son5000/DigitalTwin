import { useMemo, useState } from "react";

import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { assetStatuses, demoAssets, portalContent } from "@/features/portal/portalContent";

import AssetDetailPanel from "./AssetDetailPanel";
import WorldMenu from "./WorldMenu";
import ObservationSidebar from "./ObservationSidebar";
import ViewerServicePanel from "./ViewerServicePanel";
import { navigateViewerService } from "./operationsNavigation";
import useViewerOperations from "./useViewerOperations";
import { readViewerPreferences } from "./operationsModel.js";
import ViewerSlot from "./ViewerSlot";
import styles from "./ObservationPage.module.css";

export default function ObservationPage({ operationsSection = null, operationsRecord = null }) {
  const [theme, setTheme] = useState(() => readViewerPreferences("demo").theme || "dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const activeService = operationsSection;
  const setActiveService = navigateViewerService;
  const [activeMenu, setActiveMenu] = useState("world");
  const [selectedAssetId, setSelectedAssetId] = useState(demoAssets[1].id);
  const [query, setQuery] = useState("");
  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    return keyword ? demoAssets.filter((asset) => `${asset.name} ${asset.location}`.toLocaleLowerCase("ko").includes(keyword)) : demoAssets;
  }, [query]);
  const selectedAsset = demoAssets.find((asset) => asset.id === selectedAssetId) ?? demoAssets[0];
  const notifications = useMemo(() => demoAssets.filter((asset) => asset.status !== "normal").map((asset) => ({
    id: asset.id, assetId: asset.id, severity: asset.status, title: `${asset.name} · ${assetStatuses[asset.status].label}`, message: asset.summary, time: asset.event,
  })), []);
  const operations = useViewerOperations("demo", notifications);
  const directory = useMemo(() => ({ assets: demoAssets.map((item) => ({ id: item.id, worldKey: item.id, name: item.name, location: item.location, status: item.status === "normal" ? "정상" : "점검 필요" })), locations: [] }), []);

  function toggleSidebar() { setSidebarCollapsed((value) => !value); }
  function toggleMenu() {
    setMobileMenuOpen((value) => !value);
    if (mobileMenuOpen) { setSidebarCollapsed(true); setDetailOpen(false); setActiveService(null); }
  }
  function goHome() {
    if (window.confirm("관측 화면을 나가 프로젝트 목록으로 돌아가시겠습니까?")) navigateTo("/projects");
  }

  return <div className={styles.page} data-theme={theme}>
    <div className={activeService ? styles.worldViewInactive : undefined} inert={Boolean(activeService)} aria-hidden={activeService ? true : undefined}>
    <WorldMenu open={mobileMenuOpen} onToggle={toggleMenu} sidebarOpen={!sidebarCollapsed} onSidebarToggle={toggleSidebar}
      detailOpen={detailOpen} onDetailToggle={() => { setActiveService(null); setDetailOpen((value) => !value); }}
      activeService={activeService} onServiceChange={setActiveService}
      onHome={goHome} notificationCount={operations.data.notifications.filter((item) => item.status === "미확인").length} />

    <div className={`${styles.body} ${sidebarCollapsed ? styles.bodyCollapsed : ""} ${detailOpen ? "" : styles.bodyDetailClosed}`}>
      <ObservationSidebar assets={filteredAssets} activeMenu={activeMenu} collapsed={sidebarCollapsed} query={query} selectedAssetId={selectedAssetId}
        onActiveMenuChange={setActiveMenu} onAssetSelect={(id) => { setSelectedAssetId(id); setDetailOpen(true); }} onCollapse={toggleSidebar} onLogout={goHome} onQueryChange={setQuery} />
      <ViewerSlot zoom={zoom} onZoomChange={setZoom} assets={demoAssets} selectedAssetId={selectedAsset.id} onAssetSelect={setSelectedAssetId} />
      <AssetDetailPanel asset={selectedAsset} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
    </div>
    <ViewerServicePanel active={activeService} initialRecord={operationsRecord} onNavigate={navigateViewerService} onClose={() => setActiveService(null)} operations={operations} directory={directory} onLocate={(id) => { setSelectedAssetId(id); setDetailOpen(true); }} projectName={portalContent.project}
      operatorName={portalContent.operator} theme={theme} onThemeChange={setTheme} onReset={() => setZoom(1)} onProjects={goHome} />
  </div>;
}
