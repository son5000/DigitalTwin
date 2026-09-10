import Brand from "@/features/portal/components/Brand";
import { portalContent } from "@/features/portal/portalContent";

import styles from "./ObservationPage.module.css";

export default function ObservationHeader({ onHome, projectName = portalContent.project, connectionLabel = "데이터 연결됨", connected = true, operatorName = portalContent.operator }) {

  return <header className={styles.header}>
    <div className={styles.headerStart}>
      <Brand onClick={(event) => { event.preventDefault(); onHome(); }} />
      <span className={styles.headerDivider} />
      <div className={styles.breadcrumb}><span>프로젝트</span><strong>{projectName}</strong></div>
    </div>
    <div className={styles.headerEnd}>
      <span className={styles.connection}>{connected && <i />} {connectionLabel}</span>
      {operatorName && <div className={styles.avatar} aria-label={`${operatorName} 운영자`}>{operatorName}</div>}
    </div>
  </header>;
}
