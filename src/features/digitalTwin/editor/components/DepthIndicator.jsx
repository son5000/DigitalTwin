import { EDITOR_DEPTH_META } from "@/features/digitalTwin/editor/constants/editorNavigation";

import styles from "./DepthIndicator.module.css";

export default function DepthIndicator({ depth, path }) {
  const meta = EDITOR_DEPTH_META[depth];
  if (!meta) return null;

  return (
    <aside className={styles.indicator} aria-label={`현재 편집 단계: 레벨 ${meta.level} ${meta.label}`}>
      <span className={styles.level}>LEVEL {meta.level}</span>
      <span className={styles.copy}>
        <strong>{meta.label}</strong>
        <small>{path.at(-1)?.name ?? meta.description}</small>
      </span>
    </aside>
  );
}
