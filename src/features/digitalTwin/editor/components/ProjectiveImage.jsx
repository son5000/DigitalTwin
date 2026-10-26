import { useEffect, useRef } from "react";
import { imageCssMatrix, multiply3, UNIT_QUAD } from "../model/imageHomography";
import styles from "./ImageTransformEditor.module.css";

// CSS matrix3d performs the same homogeneous divide as the Three.js shader.
// Resize changes only pixel units, never the saved UV mapping.
export default function ProjectiveImage({ source, transform, opacity, bounds = [0, 0, 1, 1] }) {
  const host = useRef(null), image = useRef(null);
  const { cropX, cropY, cropWidth, cropHeight } = transform.parameters;
  const polygon = (transform.perspective.enabled ? transform.perspective.source : UNIT_QUAD)
    .map(([u, v]) => `${(cropX + u * cropWidth) * 100}% ${(1 - cropY - v * cropHeight) * 100}%`).join(",");
  const matrixKey = JSON.stringify(transform.sourceUvToTargetUv), boundsKey = JSON.stringify(bounds);
  useEffect(() => {
    const element = host.current, img = image.current;
    const [left, bottom, width, height] = JSON.parse(boundsKey);
    const toView = [1 / width, 0, -left / width, 0, 1 / height, -bottom / height, 0, 0, 1];
    const matrix = multiply3(toView, JSON.parse(matrixKey));
    const resize = () => {
      if (element.clientWidth && element.clientHeight) img.style.transform = imageCssMatrix(matrix, element.clientWidth, element.clientHeight);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => observer.disconnect();
  }, [matrixKey, boundsKey]);
  const [left, bottom, w, h] = bounds;
  return <div ref={host} className={styles.projectiveImage} aria-hidden="true" style={{ clipPath: `inset(${(bottom + h - 1) / h * 100}% ${(left + w - 1) / w * 100}% ${-bottom / h * 100}% ${-left / w * 100}%)` }}>
    <img ref={image} src={source} alt="" draggable={false} style={{ clipPath: `polygon(${polygon})`, opacity }} />
  </div>;
}
