import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";

import styles from "./BuildingDetailNavigator.module.css";

export default function BuildingDetailNavigator({
  buildings,
  selectedBuildingId,
  isSaving,
  hasUnsavedChanges,
  onPrevious,
  onNext,
}) {
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedIndex = buildings.findIndex((building) => building.id === selectedBuildingId);

  return (
    <section className={styles.navigator} aria-label="선택 건축물 설정">
      <div className={styles.currentTarget}>
        <span>{selectedBuilding ? `${selectedIndex + 1}/${buildings.length} · ${selectedBuilding.name}` : "건축물 미선택"}</span>
        <span className={styles.saveState} data-saving={isSaving || undefined}>
          {isSaving ? "저장 중" : hasUnsavedChanges ? "변경됨" : "저장됨"}
        </span>
      </div>

      <div className={styles.sequenceActions}>
        <button type="button" aria-label="이전 건축물" title="이전 건축물" disabled={selectedIndex <= 0 || isSaving} onClick={onPrevious}>
          <ArrowLeftIcon size={15} />
        </button>
        <button type="button" aria-label="다음 건축물" title="다음 건축물" disabled={selectedIndex < 0 || selectedIndex >= buildings.length - 1 || isSaving} onClick={onNext}>
          <ArrowRightIcon size={15} />
        </button>
      </div>
    </section>
  );
}
