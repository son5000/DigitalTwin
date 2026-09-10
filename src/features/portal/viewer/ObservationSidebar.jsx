import { ChevronRightIcon, SearchIcon } from "@/components/icons/actionIcons";
import { BuildingIcon, EquipmentIcon, WorldIcon } from "@/components/icons/hierarchyIcons";
import { SafetyIcon } from "@/components/icons/objectIcons";
import { assetStatuses, portalContent } from "@/features/portal/portalContent";

import styles from "./ObservationPage.module.css";

const MENU_ITEMS = [
  { id: "world", label: "월드 관측", icon: WorldIcon, badge: "실시간" },
  { id: "space", label: "공간 탐색", icon: BuildingIcon },
  { id: "assets", label: "설비 목록", icon: EquipmentIcon, count: "248" },
  { id: "events", label: "이벤트", icon: SafetyIcon, count: "3", danger: true },
];

export default function ObservationSidebar({ assets, activeMenu, collapsed, query, selectedAssetId, onActiveMenuChange, onAssetSelect, onCollapse, onLogout, onQueryChange }) {
  return <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`} aria-label="관측 메뉴" inert={collapsed}>
    <div className={styles.workspace}>
      <button type="button" className={styles.collapseButton} onClick={onCollapse} aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"} aria-expanded={!collapsed}><ChevronRightIcon size={16} /></button>
      <span>워크스페이스</span><strong>{portalContent.project}</strong><small>고객사 · {portalContent.customer}</small>
    </div>
    <label className={styles.search}><SearchIcon size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="공간·설비 검색" aria-label="공간과 설비 검색" /></label>
    <nav className={styles.menu} aria-label="관측 기능">
      {MENU_ITEMS.map((item) => {
        const Icon = item.icon;
        return <button type="button" key={item.id} className={activeMenu === item.id ? styles.menuActive : ""} onClick={() => onActiveMenuChange(item.id)} aria-pressed={activeMenu === item.id}>
          <Icon size={18} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}{item.count && <em className={item.danger ? styles.dangerCount : ""}>{item.count}</em>}
        </button>;
      })}
    </nav>
    <section className={styles.assetList} aria-label="관측 설비 목록">
      <div><span>관측 설비</span><b>{assets.length}</b></div>
      {assets.map((asset) => <button type="button" key={asset.id} className={selectedAssetId === asset.id ? styles.assetActive : ""} onClick={() => onAssetSelect(asset.id)} aria-pressed={selectedAssetId === asset.id}>
        <i style={{ "--status": assetStatuses[asset.status].color }} /><span><strong>{asset.name}</strong><small>{asset.location}</small></span><em>{assetStatuses[asset.status].label}</em>
      </button>)}
    </section>
    <div className={styles.sidebarFooter}><button type="button" onClick={onLogout}>프로젝트 목록으로</button></div>
  </aside>;
}
