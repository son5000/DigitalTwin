import { useRef } from "react";

import { BLOCK_EDIT_TOOLS, setBlockCell } from "./blockBuildingModel";
import styles from "./CustomBuildingEditor.module.css";

const GRID_RADIUS = 10;
const CELL_PIXELS = 26;
const VIEW_SIZE = CELL_PIXELS * GRID_RADIUS * 2;

export default function BlockGridEditor2D({ grid, level, tool, onChange }) {
  const draggingRef = useRef(false);
  const occupied = new Set(grid.cells.filter((cell) => cell.level === level).map((cell) => `${cell.x}:${cell.z}`));
  const cells = [];
  for (let z = -GRID_RADIUS; z < GRID_RADIUS; z += 1) for (let x = -GRID_RADIUS; x < GRID_RADIUS; x += 1) cells.push({ x, z });

  function paint(cell) {
    onChange(setBlockCell(grid, { ...cell, level }, tool === BLOCK_EDIT_TOOLS.ADD));
  }

  return <div className={styles.planCanvas}>
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} role="application" aria-label={`${level + 1}층 블록 격자 편집기`} onPointerUp={() => { draggingRef.current = false; }} onPointerLeave={() => { draggingRef.current = false; }}>
      <rect width={VIEW_SIZE} height={VIEW_SIZE} className={styles.planBackground} />
      {cells.map((cell) => {
        const active = occupied.has(`${cell.x}:${cell.z}`);
        return <rect key={`${cell.x}:${cell.z}`} x={(cell.x + GRID_RADIUS) * CELL_PIXELS + 1} y={(cell.z + GRID_RADIUS) * CELL_PIXELS + 1} width={CELL_PIXELS - 2} height={CELL_PIXELS - 2} className={active ? styles.blockCellActive : styles.blockCell} role="button" tabIndex="0" aria-label={`${cell.x}, ${cell.z} 셀 ${active ? "사용 중" : "비어 있음"}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draggingRef.current = true; paint(cell); }} onPointerEnter={() => { if (draggingRef.current) paint(cell); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") paint(cell); }} />;
      })}
    </svg>
    <span className={styles.scaleBadge}>셀 {grid.cellSize}m · {level + 1}층 · {tool === BLOCK_EDIT_TOOLS.ADD ? "추가" : "제거"}</span>
  </div>;
}
