import { useMemo, useState } from "react";

import styles from "./FloorPlanNavigator.module.css";

export default function FloorPlanNavigator({
  building,
  floors,
  currentFloorId,
  floorPlansById,
  showLowerFloorReference,
  onFloorChange,
  onCopyPrevious,
  onApplyToFloors,
  onShowLowerFloorReferenceChange,
}) {
  const [selectedFloorIds, setSelectedFloorIds] = useState([]);
  const orderedFloors = useMemo(
    () => [...floors].sort((left, right) => (left.level ?? 0) - (right.level ?? 0)),
    [floors],
  );
  const currentIndex = orderedFloors.findIndex((floor) => floor.id === currentFloorId);

  const validSelectedFloorIds = selectedFloorIds.filter((id) => (
    id !== currentFloorId && orderedFloors.some((floor) => floor.id === id)
  ));

  function toggleTarget(floorId) {
    setSelectedFloorIds((ids) => ids.includes(floorId) ? ids.filter((id) => id !== floorId) : [...ids, floorId]);
  }

  return (
    <aside className={styles.panel} aria-label="층 목록과 도면 적용 범위">
      <header><span>현재 편집 건축물</span><h2>{building?.name ?? "건축물 미선택"}</h2></header>
      <div className={styles.currentFloor}><span>현재 층</span><strong>{orderedFloors[currentIndex]?.name ?? "-"}</strong></div>
      <div className={styles.floorList}>
        {orderedFloors.map((floor) => {
          const configured = (floorPlansById[floor.id]?.structures?.length ?? 0) > 0;
          const active = floor.id === currentFloorId;
          return (
            <div key={floor.id} className={`${styles.floorRow} ${active ? styles.active : ""}`}>
              <button type="button" onClick={() => onFloorChange(floor.id)}>
                <strong>{floor.name}</strong><span>{configured ? "도면 작성됨" : "미작성"} · EL {Number(floor.elevation ?? 0).toFixed(1)} m</span>
              </button>
              <label title="현재 도면을 이 층에 일괄 적용">
              <input type="checkbox" disabled={active} checked={validSelectedFloorIds.includes(floor.id)} onChange={() => toggleTarget(floor.id)} />
                <span className={styles.srOnly}>적용 대상</span>
              </label>
            </div>
          );
        })}
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={currentIndex <= 0} onClick={onCopyPrevious}>이전 층 도면 복사</button>
        <button type="button" disabled={validSelectedFloorIds.length === 0} onClick={() => onApplyToFloors(validSelectedFloorIds)}>선택 {validSelectedFloorIds.length}개 층 적용</button>
      </div>
      <label className={styles.referenceToggle}><input type="checkbox" checked={showLowerFloorReference} onChange={(event) => onShowLowerFloorReferenceChange(event.target.checked)} /><span>아래층 도면을 참조선으로 표시</span></label>
      <p>바닥은 건축물 footprint에서 자동 생성되며 이동·삭제할 수 없습니다.</p>
    </aside>
  );
}
