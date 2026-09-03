import { CloseIcon } from "@/components/icons";

import styles from "./FloatingPanel.module.css";

export default function FloatingPanel({ open, title, side = "right", docked = false, topAligned = false, contentScrollable = true, onClose, children }) {
  if (!open) return null;

  return (
    <aside className={`${styles.panel} ${styles[side]} ${docked ? styles.docked : ""} ${topAligned ? styles.topAligned : ""}`} data-editor-panel data-camera-obstacle-ui={topAligned ? "true" : undefined} aria-label={title} onWheel={(event) => event.stopPropagation()}>
      <header className={styles.header}>
        <h2>{title}</h2>
        {onClose ? <button type="button" aria-label={`${title} 닫기`} onClick={onClose}><CloseIcon size={18} /></button> : null}
      </header>
      <div className={`${styles.content} ${contentScrollable ? "" : styles.contentContained}`}>{children}</div>
    </aside>
  );
}