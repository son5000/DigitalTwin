import styles from "./PropertySection.module.css";

export default function PropertySection({ title, summary, defaultOpen = false, children }) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {summary && <small>{summary}</small>}
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
