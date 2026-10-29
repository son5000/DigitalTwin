import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";

import styles from "./FloatingPanel.module.css";

export default function FloatingPanel({ open, title, description, contentKey, side = "right", docked = false, topAligned = false, contentScrollable = true, hideHeader = false, onClose, children }) {
  const contentRef = useRef(null);
  useEffect(() => {
    if (open && contentRef.current) contentRef.current.scrollTop = 0;
  }, [open, contentKey]);
  if (!open) return null;

  return (
    <aside className={`${styles.panel} ${styles[side]} ${docked ? styles.docked : ""} ${topAligned ? styles.topAligned : ""} ${hideHeader ? styles.headerless : ""}`} data-editor-panel data-camera-obstacle-ui={topAligned ? "true" : undefined} aria-label={title} onWheel={(event) => event.stopPropagation()}>
      {!hideHeader && <header className={styles.header}>
        <div className={styles.heading}><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {onClose ? <button type="button" aria-label={`${title} 닫기`} onClick={onClose}><CloseIcon size={18} /></button> : null}
      </header>}
      <div ref={contentRef} className={`${styles.content} ${contentScrollable ? "" : styles.contentContained}`}>{children}</div>
    </aside>
  );
}
