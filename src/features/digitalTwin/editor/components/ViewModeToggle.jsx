import { Layout2DIcon, View3DIcon } from "@/components/icons";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";

import styles from "./ViewModeToggle.module.css";

export default function ViewModeToggle({ value, onChange }) {
  return (
    <div className={styles.toggle} role="group" aria-label="월드 보기 방식">
      <button type="button" className={value === VIEW_MODES.LAYOUT_2D ? styles.active : ""} aria-pressed={value === VIEW_MODES.LAYOUT_2D} onClick={() => onChange(VIEW_MODES.LAYOUT_2D)}><Layout2DIcon size={17} />2D</button>
      <button type="button" className={value === VIEW_MODES.VIEW_3D ? styles.active : ""} aria-pressed={value === VIEW_MODES.VIEW_3D} onClick={() => onChange(VIEW_MODES.VIEW_3D)}><View3DIcon size={17} />3D</button>
    </div>
  );
}
