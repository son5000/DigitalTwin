import { useSyncExternalStore } from "react";
import { getScanLoadState, subscribeScanLoadState } from "../../digitalTwin/editor/three/scanLoadState";
import styles from "./ViewerLoadingScreen.module.css";

export default function ViewerLoadingScreen({ equipmentId, projectName, projectLoading = false }) {
  const scanStatus = useSyncExternalStore(subscribeScanLoadState, () => getScanLoadState(equipmentId));
  const counts = /스캔 (\d+)\/(\d+)개/.exec(scanStatus);
  const loaded = counts ? Number(counts[1]) : 0;
  const total = counts ? Number(counts[2]) : 0;
  const scanning = Boolean(scanStatus && (scanStatus.includes("불러오는 중") || scanStatus.includes("표시 중")));
  const progress = scanning && total > 0 ? Math.round(loaded / total * 100) : null;
  const detail = projectLoading ? "프로젝트 화면을 준비하고 있습니다." : "화면 구성 중입니다.";

  return <div className={`${styles.backdrop} ${projectLoading ? styles.fullPage : ""}`} role="status" aria-live="polite" aria-busy="true">
    <div className={styles.panel}>
      {projectName && <p className={styles.project}>{projectName}</p>}
      <h1>관제 화면 준비 중</h1>
      <p className={styles.detail}>{detail}</p>
      <div className={styles.track} role="progressbar" aria-label={detail}
        aria-valuemin={progress === null ? undefined : 0} aria-valuemax={progress === null ? undefined : 100}
        aria-valuenow={progress ?? undefined}>
        <span className={progress === null ? styles.indeterminate : styles.determinate} style={progress === null ? undefined : { width: `${progress}%` }} />
      </div>
    </div>
  </div>;
}
