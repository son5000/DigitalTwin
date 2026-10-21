import { useSyncExternalStore } from "react";
import { getScanLoadState, subscribeScanLoadState } from "../../digitalTwin/editor/three/scanLoadState";

import styles from "../projects/ProjectViewerPage.module.css";

export default function ScanLoadStatus({ equipmentId, popup = false }) {
  const state = useSyncExternalStore(subscribeScanLoadState, () => getScanLoadState(equipmentId));
  if (!state || (popup && !state.includes("불러오는 중"))) return null;
  if (popup) return <div className={styles.scanLoading} role="status" aria-live="polite" aria-busy="true">모델을 불러오는 중입니다<span className={styles.loadingDots} aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></div>;
  return <p role="status" aria-live="polite">{state}</p>;
}
