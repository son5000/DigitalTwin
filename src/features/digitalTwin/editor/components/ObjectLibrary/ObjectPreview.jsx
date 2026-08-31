import CatalogThumbnail from "@/features/digitalTwin/editor/components/CatalogThumbnail";

import styles from "./ObjectLibrary.module.css";

export default function ObjectPreview({ definition, compact = false }) {
  return (
    <span className={`${styles.preview} ${compact ? styles.previewCompact : ""}`} aria-hidden="true">
      <CatalogThumbnail definition={definition} className={styles.previewImage} />
    </span>
  );
}
