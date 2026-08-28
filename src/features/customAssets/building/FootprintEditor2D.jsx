import { useMemo, useRef, useState } from "react";

import styles from "./CustomBuildingEditor.module.css";

const VIEW_SIZE = 520;
const PADDING = 54;

function pathData(points, transform) {
  return points.map((point, index) => `${index ? "L" : "M"} ${transform.x(point.x)} ${transform.z(point.z)}`).join(" ") + " Z";
}

export default function FootprintEditor2D({ footprint, selectedVertexIndex, snapEnabled, orthogonalEnabled, onSelectVertex, onChange }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const transform = useMemo(() => {
    const allPoints = [...footprint.points, ...(footprint.holes ?? []).flat()];
    const xs = allPoints.map((item) => item.x);
    const zs = allPoints.map((item) => item.z);
    const minX = Math.min(...xs, -5);
    const maxX = Math.max(...xs, 5);
    const minZ = Math.min(...zs, -5);
    const maxZ = Math.max(...zs, 5);
    const scale = Math.min((VIEW_SIZE - PADDING * 2) / (maxX - minX || 1), (VIEW_SIZE - PADDING * 2) / (maxZ - minZ || 1));
    return {
      scale,
      x: (value) => VIEW_SIZE / 2 + value * scale,
      z: (value) => VIEW_SIZE / 2 + value * scale,
      inverseX: (value) => (value - VIEW_SIZE / 2) / scale,
      inverseZ: (value) => (value - VIEW_SIZE / 2) / scale,
    };
  }, [footprint.holes, footprint.points]);

  function updateFromPointer(event) {
    if (!dragging || selectedVertexIndex == null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let x = transform.inverseX((event.clientX - rect.left) * VIEW_SIZE / rect.width);
    let z = transform.inverseZ((event.clientY - rect.top) * VIEW_SIZE / rect.height);
    if (snapEnabled) {
      x = Math.round(x * 2) / 2;
      z = Math.round(z * 2) / 2;
    }
    if (orthogonalEnabled) {
      const previous = footprint.points[(selectedVertexIndex - 1 + footprint.points.length) % footprint.points.length];
      if (Math.abs(x - previous.x) < Math.abs(z - previous.z)) x = previous.x;
      else z = previous.z;
    }
    onChange({ ...footprint, templateId: "FREE_POLYGON", points: footprint.points.map((point, index) => index === selectedVertexIndex ? { x, z } : point) });
  }

  const gridLines = Array.from({ length: 21 }, (_, index) => (index - 10) * 2);
  return (
    <div className={styles.planCanvas}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        role="application"
        aria-label="건축물 평면 꼭짓점 편집기"
        onPointerMove={updateFromPointer}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <rect width={VIEW_SIZE} height={VIEW_SIZE} className={styles.planBackground} />
        {gridLines.map((value) => <line key={`x-${value}`} x1={transform.x(value)} y1="0" x2={transform.x(value)} y2={VIEW_SIZE} className={value === 0 ? styles.axisLine : styles.gridLine} />)}
        {gridLines.map((value) => <line key={`z-${value}`} x1="0" y1={transform.z(value)} x2={VIEW_SIZE} y2={transform.z(value)} className={value === 0 ? styles.axisLine : styles.gridLine} />)}
        <path d={pathData(footprint.points, transform)} className={styles.footprintShape} />
        {(footprint.holes ?? []).map((hole, index) => <path key={index} d={pathData(hole, transform)} className={styles.holeShape} />)}
        {footprint.points.map((point, index) => (
          <circle
            key={`${index}-${point.x}-${point.z}`}
            cx={transform.x(point.x)}
            cy={transform.z(point.z)}
            r={index === selectedVertexIndex ? 8 : 6}
            className={index === selectedVertexIndex ? styles.vertexSelected : styles.vertex}
            role="button"
            aria-label={`꼭짓점 ${index + 1}`}
            tabIndex="0"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onSelectVertex(index); setDragging(true); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectVertex(index); }}
          />
        ))}
      </svg>
      <span className={styles.scaleBadge}>격자 2m · 스냅 {snapEnabled ? "0.5m" : "꺼짐"}</span>
    </div>
  );
}
