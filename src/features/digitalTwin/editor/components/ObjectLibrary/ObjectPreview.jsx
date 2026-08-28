import { ObjectLibraryIcon } from "@/components/icons";

import styles from "./ObjectLibrary.module.css";

export default function ObjectPreview({ definition, compact = false }) {
  return (
    <span className={`${styles.preview} ${compact ? styles.previewCompact : ""}`} aria-hidden="true">
      {definition.thumbnail
        ? <img className={styles.previewImage} src={definition.thumbnail} alt="" loading="lazy" />
        : <ObjectLibraryIcon definition={definition} size={compact ? 18 : 23} />}
    </span>
  );
}
