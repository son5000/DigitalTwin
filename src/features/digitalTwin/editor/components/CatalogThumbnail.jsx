import { useState } from "react";

import styles from "./CatalogThumbnail.module.css";

const CATALOG_THUMBNAIL_FALLBACK = "/assets/object-thumbnails/_fallback.png";

function isSafeThumbnailSource(source) {
  return typeof source === "string"
    && source.startsWith("/assets/object-thumbnails/")
    && !source.startsWith("procedural:");
}

export default function CatalogThumbnail({ definition, title, className = "" }) {
  const requestedSource = isSafeThumbnailSource(definition?.thumbnailSource)
    ? definition.thumbnailSource
    : CATALOG_THUMBNAIL_FALLBACK;
  const [failedSource, setFailedSource] = useState(null);
  const source = failedSource === requestedSource
    ? CATALOG_THUMBNAIL_FALLBACK
    : requestedSource;
  const name = title ?? definition?.nameKo ?? definition?.name ?? "오브젝트";

  return (
    <img
      className={`${styles.image} ${className}`}
      src={source}
      alt={`${name} 3D 모델 미리보기`}
      loading="lazy"
      onError={() => source !== CATALOG_THUMBNAIL_FALLBACK && setFailedSource(requestedSource)}
    />
  );
}
