import { CloseIcon } from "@/components/icons";

import styles from "./FloatingPanel.module.css";

export default function FloatingPanel({ open, title, eyebrow, side = "right", onClose, children }) {
  if (!open) return null;

  return (
    <aside className={`${styles.panel} ${styles[side]}`} aria-label={title}>
      <header className={styles.header}>
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" aria-label={`${title} 닫기`} onClick={onClose}><CloseIcon size={18} /></button>
      </header>
      <div className={styles.content}>{children}</div>
    </aside>
  );
}
