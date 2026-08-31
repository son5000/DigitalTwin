import styles from "./CustomBuildingEditor.module.css";

const VIEW_SIZE = 520;
const SCALE = 13;

function pointFromEvent(event, snapEnabled) {
  const bounds = event.currentTarget.getBoundingClientRect();
  let x = ((event.clientX - bounds.left) * VIEW_SIZE / bounds.width - VIEW_SIZE / 2) / SCALE;
  let z = ((event.clientY - bounds.top) * VIEW_SIZE / bounds.height - VIEW_SIZE / 2) / SCALE;
  if (snapEnabled) { x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2; }
  return { x, z };
}

export default function OutlineDrawingEditor2D({ points, snapEnabled, onChange, onComplete, onCancel }) {
  const gridLines = Array.from({ length: 21 }, (_, index) => index * VIEW_SIZE / 20);
  const screen = (point) => `${VIEW_SIZE / 2 + point.x * SCALE},${VIEW_SIZE / 2 + point.z * SCALE}`;
  return <div className={styles.planCanvas}>
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} role="application" aria-label="건축물 외곽선 그리기" onPointerDown={(event) => onChange([...points, pointFromEvent(event, snapEnabled)])}>
      <rect width={VIEW_SIZE} height={VIEW_SIZE} className={styles.planBackground} />
      {gridLines.map((value) => <line key={`x-${value}`} x1={value} y1="0" x2={value} y2={VIEW_SIZE} className={value === VIEW_SIZE / 2 ? styles.axisLine : styles.gridLine} />)}
      {gridLines.map((value) => <line key={`z-${value}`} x1="0" y1={value} x2={VIEW_SIZE} y2={value} className={value === VIEW_SIZE / 2 ? styles.axisLine : styles.gridLine} />)}
      {points.length ? <polyline points={points.map(screen).join(" ")} className={styles.connectorPath} /> : null}
      {points.map((point, index) => <circle key={`${point.x}:${point.z}:${index}`} cx={VIEW_SIZE / 2 + point.x * SCALE} cy={VIEW_SIZE / 2 + point.z * SCALE} r="6" className={index === 0 ? styles.vertexSelected : styles.vertex} onPointerDown={(event) => { event.stopPropagation(); if (index === 0 && points.length >= 3) onComplete(points); }} />)}
    </svg>
    <div className={styles.scaleBadge}>점을 순서대로 선택 · 첫 점을 누르면 닫힘 · {snapEnabled ? "0.5m 스냅" : "자유"}</div>
    <div className={styles.drawingActions}><button type="button" disabled={points.length < 3} onClick={() => onComplete(points)}>외곽선 닫기</button><button type="button" disabled={!points.length} onClick={() => onChange(points.slice(0, -1))}>마지막 점 취소</button><button type="button" onClick={onCancel}>그리기 취소</button></div>
  </div>;
}
