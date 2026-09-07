import { useMemo, useState } from "react";

import { navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { demoAssets } from "@/features/portal/portalContent";

import AssetDetailPanel from "./AssetDetailPanel";
import ObservationHeader from "./ObservationHeader";
import ObservationSidebar from "./ObservationSidebar";
import ViewerSlot from "./ViewerSlot";
import styles from "./ObservationPage.module.css";

export default function ObservationPage() {
  const [theme, setTheme] = useState("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState("world");
  const [selectedAssetId, setSelectedAssetId] = useState(demoAssets[1].id);
  const [query, setQuery] = useState("");
  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    return keyword ? demoAssets.filter((asset) => `${asset.name} ${asset.location}`.toLocaleLowerCase("ko").includes(keyword)) : demoAssets;
  }, [query]);
  const selectedAsset = demoAssets.find((asset) => asset.id === selectedAssetId) ?? demoAssets[0];

  return <div className={styles.page} data-theme={theme}>
    <ObservationHeader theme={theme} onHome={() => navigateTo("/")} onMenuToggle={() => setMobileMenuOpen((value) => !value)} onThemeToggle={() => setTheme((value) => value === "dark" ? "light" : "dark")} />
    <div className={`${styles.body} ${sidebarCollapsed ? styles.bodyCollapsed : ""} ${detailOpen ? "" : styles.bodyDetailClosed}`}>
      <ObservationSidebar assets={filteredAssets} activeMenu={activeMenu} collapsed={sidebarCollapsed} mobileOpen={mobileMenuOpen} query={query} selectedAssetId={selectedAssetId}
        onActiveMenuChange={setActiveMenu} onAssetSelect={(id) => { setSelectedAssetId(id); setDetailOpen(true); setMobileMenuOpen(false); }} onCollapse={() => { setSidebarCollapsed((value) => !value); setMobileMenuOpen(false); }} onLogout={() => navigateTo("/")} onQueryChange={setQuery} />
      {mobileMenuOpen && <button type="button" className={styles.mobileScrim} onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기" />}
      <ViewerSlot assets={demoAssets} selectedAssetId={selectedAsset.id} detailOpen={detailOpen} onAssetSelect={setSelectedAssetId} onDetailOpen={() => setDetailOpen(true)} />
      <AssetDetailPanel asset={selectedAsset} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  </div>;
}
