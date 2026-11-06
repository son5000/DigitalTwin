import { useEffect, useRef } from "react";
import { temperaturePixels } from "../model/thermalFrame.js";
import styles from "./ViewerThermalPreview.module.css";

export default function ViewerThermalPreview({ grid, summary }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!grid || !summary || !canvasRef.current) return;
    const pixels = temperaturePixels(grid, summary.min, summary.max, "JET", false);
    if (!pixels) return;
    const canvas = canvasRef.current;
    canvas.width = grid.width; canvas.height = grid.height;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels), grid.width, grid.height), 0, 0);
  }, [grid, summary]);
  if (!grid || !summary) return null;
  return <div className={styles.preview}>
    <canvas ref={canvasRef} role="img" aria-label={`열화상 온도 분포, 최저 ${summary.min.toFixed(1)}도, 최고 ${summary.max.toFixed(1)}도`} />
    <div className={styles.scale} aria-label="온도 색상 범위"><span>{summary.min.toFixed(1)} ℃</span><i /><span>{summary.max.toFixed(1)} ℃</span></div>
  </div>;
}
