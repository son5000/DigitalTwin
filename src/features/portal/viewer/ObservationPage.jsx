import { useMemo, useState } from "react";

import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { demoAssets } from "@/features/portal/portalContent";

import AssetDetailPanel from "./AssetDetailPanel";
import WorldMenu from "./WorldMenu";
import ObservationHeader from "./ObservationHeader";
import ObservationSidebar from "./ObservationSidebar";
import ViewerSlot from "./ViewerSlot";
import styles from "./ObservationPage.module.css";

export default function ObservationPage() {
  const [theme, setTheme] = useState("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [topOpen, setTopOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("world");
  const [selectedAssetId, setSelectedAssetId] = useState(demoAssets[1].id);
  const [query, setQuery] = useState("");
  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    return keyword ? demoAssets.filter((asset) => `${asset.name} ${asset.location}`.toLocaleLowerCase("ko").includes(keyword)) : demoAssets;
  }, [query]);
  const selectedAsset = demoAssets.find((asset) => asset.id === selectedAssetId) ?? demoAssets[0];

  function toggleSidebar() { setSidebarCollapsed((value) => !value); }
  function toggleMenu() {
    setMobileMenuOpen((value) => !value);
    if (mobileMenuOpen) { setSidebarCollapsed(true); setDetailOpen(false); setTopOpen(false); setBottomOpen(false); }
  }
  function goHome() {
    if (window.confirm("관측 화면을 나가 프로젝트 목록으로 돌아가시겠습니까?")) navigateTo("/projects");
  }

  return <div className={styles.page} data-theme={theme}>
    <WorldMenu open={mobileMenuOpen} onToggle={toggleMenu} sidebarOpen={!sidebarCollapsed} onSidebarToggle={toggleSidebar}
      detailOpen={detailOpen} onDetailToggle={() => setDetailOpen((value) => !value)} topOpen={topOpen} onTopToggle={() => setTopOpen((value) => !value)}
      bottomOpen={bottomOpen} onBottomToggle={() => setBottomOpen((value) => !value)} theme={theme} onThemeToggle={() => setTheme((value) => value === "dark" ? "light" : "dark")}
      onHome={goHome} onReset={() => setZoom(1)} notificationCount={3} notificationsActive={!sidebarCollapsed && activeMenu === "events"}
      onNotifications={() => { if (!sidebarCollapsed && activeMenu === "events") setSidebarCollapsed(true); else { setActiveMenu("events"); setSidebarCollapsed(false); } }} />
    <div className={styles.topPanel} hidden={!topOpen}>
      <ObservationHeader onHome={goHome} />
    </div>
    <div className={`${styles.body} ${sidebarCollapsed ? styles.bodyCollapsed : ""} ${detailOpen ? "" : styles.bodyDetailClosed}`}>
      <ObservationSidebar assets={filteredAssets} activeMenu={activeMenu} collapsed={sidebarCollapsed} query={query} selectedAssetId={selectedAssetId}
        onActiveMenuChange={setActiveMenu} onAssetSelect={(id) => { setSelectedAssetId(id); setDetailOpen(true); }} onCollapse={toggleSidebar} onLogout={goHome} onQueryChange={setQuery} />
      <ViewerSlot zoom={zoom} onZoomChange={setZoom} assets={demoAssets} selectedAssetId={selectedAsset.id} topOpen={topOpen} bottomOpen={bottomOpen} onAssetSelect={setSelectedAssetId} />
      <AssetDetailPanel asset={selectedAsset} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  </div>;
}
