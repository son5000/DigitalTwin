import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";

import styles from "./ViewModeToggle.module.css";

export default function ViewModeToggle({ value, onChange, disabled = false, topAligned = false, sceneMetaAligned = false }) {
  return (
    <div className={`${styles.toggle} ${topAligned ? styles.topAligned : ""} ${sceneMetaAligned ? styles.sceneMetaAligned : ""}`} role="group" aria-label="월드 보기 방식" data-camera-safe-ui>
      <button type="button" title="2D 평면도" aria-label="2D 평면도" disabled={disabled} className={value === VIEW_MODES.LAYOUT_2D ? styles.active : ""} aria-pressed={value === VIEW_MODES.LAYOUT_2D} onClick={() => onChange(VIEW_MODES.LAYOUT_2D)}>2D</button>
      <button type="button" title="3D 공간 보기" aria-label="3D 공간 보기" disabled={disabled} className={value === VIEW_MODES.VIEW_3D ? styles.active : ""} aria-pressed={value === VIEW_MODES.VIEW_3D} onClick={() => onChange(VIEW_MODES.VIEW_3D)}>3D</button>
    </div>
  );
}
