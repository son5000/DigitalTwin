import { useMemo, useRef, useState } from "react";

import { BUILDING_ENTITY_TYPES, BUILDING_VIEW_MODES, getMassWorldPoints, resolveConnectorPath } from "./buildingAssembly";
import styles from "./CustomBuildingEditor.module.css";

const VIEW_SIZE = 620;
const PADDING = 62;

function pathData(points, transform) {
  return points.map((point, index) => `${index ? "L" : "M"} ${transform.x(point.x)} ${transform.z(point.z)}`).join(" ") + " Z";
}

export default function AssemblyPlanEditor2D({ asset, selectedEntityIds, activeViewGroupId, viewMode, snapEnabled, onSelectEntity, onMoveMass }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const masses = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS && entity.visible !== false);
  const connectors = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR && entity.visible !== false);
  const activeGroup = asset.viewGroups.find((group) => group.id === activeViewGroupId) ?? null;
  const transform = useMemo(() => {
    const points = [...masses.flatMap(getMassWorldPoints), ...connectors.flatMap((connector) => resolveConnectorPath(asset, connector))];
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    const minX = Math.min(...xs, -10); const maxX = Math.max(...xs, 10);
    const minZ = Math.min(...zs, -10); const maxZ = Math.max(...zs, 10);
    const scale = Math.min((VIEW_SIZE - PADDING * 2) / Math.max(1, maxX - minX), (VIEW_SIZE - PADDING * 2) / Math.max(1, maxZ - minZ));
    const centerX = (minX + maxX) / 2; const centerZ = (minZ + maxZ) / 2;
    return {
      scale,
      x: (value) => VIEW_SIZE / 2 + (value - centerX) * scale,
      z: (value) => VIEW_SIZE / 2 + (value - centerZ) * scale,
      inverseX: (value) => (value - VIEW_SIZE / 2) / scale + centerX,
      inverseZ: (value) => (value - VIEW_SIZE / 2) / scale + centerZ,
    };
  }, [asset, connectors, masses]);

  function pointerPosition(event) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: transform.inverseX((event.clientX - rect.left) * VIEW_SIZE / rect.width),
      z: transform.inverseZ((event.clientY - rect.top) * VIEW_SIZE / rect.height),
    };
  }

  function move(event) {
    if (!drag) return;
    const point = pointerPosition(event);
    let x = drag.origin.x + point.x - drag.pointer.x;
    let z = drag.origin.z + point.z - drag.pointer.z;
    if (snapEnabled) { x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2; }
    onMoveMass(drag.entityId, { x, z });
  }

  function entityClass(entity) {
    const selected = selectedEntityIds.includes(entity.id);
    const included = !activeGroup || activeGroup.entityIds.includes(entity.id);
    if (selected) return styles.assemblyEntitySelected;
    if (!included && viewMode === BUILDING_VIEW_MODES.HIDE_OTHERS) return styles.assemblyEntityHidden;
    if (!included && viewMode === BUILDING_VIEW_MODES.GHOST_OTHERS) return styles.assemblyEntityGhost;
    return styles.assemblyEntity;
  }

  const gridLines = Array.from({ length: 25 }, (_, index) => (index - 12) * 4);
  return (
    <div className={styles.planCanvas}>
      <svg ref={svgRef} viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} role="application" aria-label="복합 건축물 매스 평면 편집기" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        <rect width={VIEW_SIZE} height={VIEW_SIZE} className={styles.planBackground} />
        {gridLines.map((value) => <line key={`x-${value}`} x1={transform.x(value)} y1="0" x2={transform.x(value)} y2={VIEW_SIZE} className={value === 0 ? styles.axisLine : styles.gridLine} />)}
        {gridLines.map((value) => <line key={`z-${value}`} x1="0" y1={transform.z(value)} x2={VIEW_SIZE} y2={transform.z(value)} className={value === 0 ? styles.axisLine : styles.gridLine} />)}
        {connectors.map((connector) => {
          const points = resolveConnectorPath(asset, connector);
          return <polyline key={connector.id} points={points.map((point) => `${transform.x(point.x)},${transform.z(point.z)}`).join(" ")} className={`${styles.connectorPath} ${entityClass(connector)}`} style={{ "--connector-width": Math.max(5, connector.width * transform.scale) }} onPointerDown={(event) => { event.stopPropagation(); onSelectEntity(connector.id, event.ctrlKey || event.metaKey); }} />;
        })}
        {masses.map((mass) => (
          <path
            key={mass.id}
            d={pathData(getMassWorldPoints(mass), transform)}
            className={entityClass(mass)}
            role="button"
            tabIndex="0"
            aria-label={`${mass.name} 매스`}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelectEntity(mass.id, event.ctrlKey || event.metaKey);
              setDrag({ entityId: mass.id, pointer: pointerPosition(event), origin: { x: mass.transform.position.x, z: mass.transform.position.z } });
            }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectEntity(mass.id, event.ctrlKey || event.metaKey); }}
          />
        ))}
      </svg>
      <span className={styles.scaleBadge}>복수 선택 Ctrl/⌘ · 이동 {snapEnabled ? "0.5m 스냅" : "자유"}</span>
    </div>
  );
}
