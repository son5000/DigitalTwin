import { ArrowLeftIcon, CloseIcon, GridViewIcon, ListViewIcon, SunIcon, ThemeIcon } from "@/components/icons/actionIcons";
import { EquipmentIcon } from "@/components/icons/hierarchyIcons";
import { SafetyIcon } from "@/components/icons/objectIcons";
import { FloorSelectIcon, ResetIcon, Layout2DIcon } from "@/components/icons/toolbarIcons";
import styles from "./ObservationPage.module.css";

export default function WorldMenu({ open, onToggle, sidebarOpen, onSidebarToggle, detailOpen, onDetailToggle, topOpen, onTopToggle, bottomOpen, onBottomToggle, theme, onThemeToggle, onHome, notificationCount = 0, notificationsActive = false, onNotifications, onReset }) {
  const items = [
    { label: "상단 프로젝트·보기 패널", icon: Layout2DIcon, tone: "blue", active: topOpen, action: onTopToggle },
    { label: "좌측 탐색 패널", icon: ListViewIcon, tone: "teal", active: sidebarOpen, action: onSidebarToggle },
    { label: "우측 상세 패널", icon: EquipmentIcon, tone: "purple", active: detailOpen, action: onDetailToggle },
    { label: "하단 정보·층 패널", icon: FloorSelectIcon, tone: "amber", active: bottomOpen, action: onBottomToggle },
    { label: `알림 ${notificationCount}개`, icon: SafetyIcon, tone: "red", active: notificationsActive, action: onNotifications, badge: notificationCount },
    { label: theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환", icon: theme === "light" ? ThemeIcon : SunIcon, tone: "slate", action: onThemeToggle },
    { label: "보기 초기화", icon: ResetIcon, tone: "teal", action: onReset },
    { label: "프로젝트 목록으로 돌아가기", icon: ArrowLeftIcon, tone: "slate", action: onHome },
  ];

  return <nav className={styles.worldMenu} aria-label="월드 도구">
    <button type="button" className={styles.appIcon} data-tone="blue" title={open ? "월드 메뉴 닫기" : "월드 메뉴 열기"} aria-label={open ? "월드 메뉴 닫기" : "월드 메뉴 열기"} aria-expanded={open} aria-controls="world-menu-items" onClick={onToggle}>
      {open ? <CloseIcon size={24} /> : <GridViewIcon size={24} />}
    </button>
    <div id="world-menu-items" className={styles.worldMenuItems} hidden={!open}>
      {items.map(({ label, icon: Icon, tone, active, action, badge }) => <button key={label} type="button" className={styles.appIcon} data-tone={tone} title={label} aria-label={label} aria-pressed={active} disabled={!action} onClick={action}>
        <Icon size={23} />{badge > 0 && <b className={styles.unreadBadge}>{badge}</b>}
      </button>)}
    </div>
  </nav>;
}
