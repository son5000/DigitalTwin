import { GridViewIcon, SunIcon, ThemeIcon } from "@/components/icons/actionIcons";
import Brand from "@/features/portal/components/Brand";
import { portalContent } from "@/features/portal/portalContent";

import styles from "./ObservationPage.module.css";

export default function ObservationHeader({ theme, onHome, onMenuToggle, onThemeToggle, projectName = portalContent.project, connectionLabel = "데이터 연결됨", connected = true, notificationCount = 3, operatorName = portalContent.operator }) {
  const lightMode = theme === "light";

  return <header className={styles.header}>
    <div className={styles.headerStart}>
      <button type="button" className={`${styles.iconButton} ${styles.mobileMenuButton}`} onClick={onMenuToggle} aria-label="좌측 메뉴 열기">
        <GridViewIcon size={19} />
      </button>
      <Brand onClick={(event) => { event.preventDefault(); onHome(); }} />
      <span className={styles.headerDivider} />
      <div className={styles.breadcrumb}><span>프로젝트</span><strong>{projectName}</strong></div>
    </div>
    <div className={styles.headerEnd}>
      <span className={styles.connection}>{connected && <i />} {connectionLabel}</span>
      <button type="button" className={styles.iconButton} onClick={onThemeToggle} aria-label={lightMode ? "다크 모드로 전환" : "라이트 모드로 전환"}>
        {lightMode ? <ThemeIcon size={18} /> : <SunIcon size={18} />}
      </button>
      {notificationCount > 0 && <button type="button" className={`${styles.iconButton} ${styles.notification}`} aria-label={`알림 ${notificationCount}개`}><span aria-hidden="true">!</span><b>{notificationCount}</b></button>}
      {operatorName && <div className={styles.avatar} aria-label={`${operatorName} 운영자`}>{operatorName}</div>}
    </div>
  </header>;
}
