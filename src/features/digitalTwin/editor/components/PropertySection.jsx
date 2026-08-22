import styles from "./PropertySection.module.css";
import { ChevronDownIcon } from "@/components/icons";

export default function PropertySection({ title, summary, defaultOpen = false, children }) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {summary && <small>{summary}</small>}
        <span className={styles.chevron} aria-hidden="true"><ChevronDownIcon size={15} /></span>
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
