import { useState } from "react";
import { CloseIcon, GridViewIcon } from "@/components/icons/actionIcons";
import {
  AssetRegistryIcon,
  DetailPanelIcon,
  MaintenanceTicketIcon,
  NavigationPanelIcon,
  NotificationCenterIcon,
  OperationsHubIcon,
  OperationsReportIcon,
  ProfileBadgeIcon,
  ProjectListIcon,
  SupportTeamIcon,
  ViewerSettingsIcon,
} from "./WorldMenuIcons";
import styles from "./ObservationPage.module.css";

export default function WorldMenu({ open, onToggle, sidebarOpen, onSidebarToggle, detailOpen, onDetailToggle, activeService, onServiceChange, onHome, notificationCount = 0 }) {
  const [operationsOpen, setOperationsOpen] = useState(false);
  const serviceItem = (item) => ({
    ...item,
    active: activeService === item.id,
    action: () => {
      onServiceChange?.(activeService === item.id ? null : item.id);
      setOperationsOpen(false);
    },
  });
  const panelItems = [
    { label: "좌측 탐색 패널", icon: NavigationPanelIcon, tone: "cyan", active: sidebarOpen, action: onSidebarToggle },
    { label: "우측 상세 패널", icon: DetailPanelIcon, tone: "violet", active: detailOpen, action: onDetailToggle },
  ];
  const operationsItems = [
    { id: "assets", label: "자산 관리", icon: AssetRegistryIcon, tone: "emerald" },
    { id: "people", label: "담당자·AS센터 관리", icon: SupportTeamIcon, tone: "indigo" },
    { id: "tickets", label: "고장·정비 접수", icon: MaintenanceTicketIcon, tone: "orange" },
    { id: "reports", label: "운영 보고서", icon: OperationsReportIcon, tone: "sky" },
  ].map(serviceItem);
  const utilityItems = [
    { id: "notifications", label: `알림 ${notificationCount}개`, icon: NotificationCenterIcon, tone: "rose", badge: notificationCount },
    { id: "settings", label: "뷰어 설정", icon: ViewerSettingsIcon, tone: "gold" },
    { id: "profile", label: "마이페이지", icon: ProfileBadgeIcon, tone: "magenta" },
    { label: "프로젝트 목록으로 돌아가기", icon: ProjectListIcon, tone: "slate", action: onHome },
  ].map((item) => item.id ? serviceItem(item) : item);
  const operationsActive = operationsItems.some((item) => item.active);
  const renderItem = ({ label, icon: Icon, tone, active, action, badge }) => <button key={label} type="button" className={styles.appIcon} data-tone={tone} title={label} aria-label={label} aria-pressed={active} disabled={!action} onClick={action}>
    <Icon size={24} />{badge > 0 && <b className={styles.unreadBadge}>{badge}</b>}
  </button>;

  return <nav className={styles.worldMenu} aria-label="월드 도구">
    <button type="button" className={styles.appIcon} data-tone="brand" title={open ? "월드 메뉴 닫기" : "월드 메뉴 열기"} aria-label={open ? "월드 메뉴 닫기" : "월드 메뉴 열기"} aria-expanded={open} aria-controls="world-menu-items" onClick={() => { if (open) setOperationsOpen(false); onToggle(); }}>
      {open ? <CloseIcon size={24} /> : <GridViewIcon size={24} />}
    </button>
    <div id="world-menu-items" className={styles.worldMenuItems} hidden={!open}>
      {panelItems.map(renderItem)}
      <div className={styles.worldMenuGroup}>
        <button type="button" className={`${styles.appIcon} ${styles.operationsButton}`} data-tone="operations" title={operationsOpen ? "운영 메뉴 닫기" : "운영 메뉴 열기"} aria-label={operationsOpen ? "운영 메뉴 닫기" : "운영 메뉴 열기"} aria-pressed={operationsActive} aria-expanded={operationsOpen} aria-controls="world-operations-items" onClick={() => setOperationsOpen((value) => !value)}>
          <OperationsHubIcon size={26} />
        </button>
        <div id="world-operations-items" className={styles.worldSubmenu} role="group" aria-label="운영" hidden={!operationsOpen}>
          {operationsItems.map(renderItem)}
        </div>
      </div>
      {utilityItems.map(renderItem)}
    </div>
  </nav>;
}
