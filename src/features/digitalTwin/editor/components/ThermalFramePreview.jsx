import { useState } from "react";
import { thermalGradient } from "../model/thermalFrame";
import NumericField from "./NumericField";
import styles from "./ThermalFramePreview.module.css";

export default function ThermalFramePreview({ grid, source, summary, settings }) {
  const [pixel, setPixel] = useState({ x: 0, y: 0 });
  if (!grid || !summary || !source) return null;
  const x = Math.max(0, Math.min(grid.width - 1, Math.round(pixel.x)));
  const y = Math.max(0, Math.min(grid.height - 1, Math.round(pixel.y)));
  const temperature = grid.values[y * grid.width + x];
  const pickPixel = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPixel({ x: Math.floor((event.clientX - rect.left) / rect.width * grid.width), y: Math.floor((event.clientY - rect.top) / rect.height * grid.height) });
  };
  return <div className={styles.preview}>
    <button type="button" className={styles.image} onClick={pickPixel} aria-label="열화상 원본에서 온도를 확인할 픽셀 선택. 아래 X, Y 입력으로도 선택할 수 있습니다.">
      <img src={source} alt={`온도 분포 원본 ${grid.width} × ${grid.height}픽셀`} />
      <span className={styles.crosshair} style={{ left: `${(x + .5) / grid.width * 100}%`, top: `${(y + .5) / grid.height * 100}%` }} />
    </button>
    <div className={styles.legend}><span>{summary.min.toFixed(2)}°C</span><i style={{ background: thermalGradient(settings.palette) }} /><span>{summary.max.toFixed(2)}°C</span></div>
    <p>{grid.width} × {grid.height}px · 최저 {summary.min.toFixed(2)} / 최고 {summary.max.toFixed(2)} / 평균 {summary.average.toFixed(2)}°C</p>
    <div className={styles.pixel}>
      <NumericField label="X 픽셀" min={0} step={1} displayPrecision={0} value={x} onChange={(value) => setPixel({ x: Math.min(grid.width - 1, Math.max(0, Math.round(value))), y })} />
      <NumericField label="Y 픽셀" min={0} step={1} displayPrecision={0} value={y} onChange={(value) => setPixel({ x, y: Math.min(grid.height - 1, Math.max(0, Math.round(value))) })} />
      <output aria-live="polite">{temperature === null ? "결측" : `${temperature.toFixed(2)}°C`}</output>
    </div>
    <p>원본 이미지의 왼쪽 위가 (0, 0)입니다. 이미지 또는 좌표를 선택해 온도를 확인하세요.</p>
  </div>;
}
