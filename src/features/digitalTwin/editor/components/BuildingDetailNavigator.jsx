import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { BUILDING_SETTING_STATUS } from "@/features/digitalTwin/editor/constants/buildingDetail";

import styles from "./BuildingDetailNavigator.module.css";

export default function BuildingDetailNavigator({
  buildings,
  selectedBuildingId,
  statusById,
  selectedStatus,
  isSaving,
  hasUnsavedChanges,
  onPrevious,
  onNext,
  onComplete,
}) {
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedIndex = buildings.findIndex((building) => building.id === selectedBuildingId);
  const completeCount = buildings.filter(
    (building) => statusById[building.id] === BUILDING_SETTING_STATUS.COMPLETE,
  ).length;
  const isComplete = selectedStatus === BUILDING_SETTING_STATUS.COMPLETE;

  return (
    <section className={styles.navigator} aria-label="선택 건축물 설정">
      <div className={styles.currentTarget}>
        <span>{completeCount}/{buildings.length} 완료</span>
        <span className={styles.saveState} data-saving={isSaving || undefined}>
          {isSaving ? "저장 중" : hasUnsavedChanges ? "변경됨" : "저장됨"}
        </span>
      </div>

      <div className={styles.sequenceActions}>
        <button type="button" aria-label="이전 건축물" title="이전 건축물" disabled={selectedIndex <= 0 || isSaving} onClick={onPrevious}>
          <ArrowLeftIcon size={15} />
        </button>
        <button
          type="button"
          className={isComplete ? styles.completedButton : styles.completeButton}
          disabled={!selectedBuilding || isSaving}
          onClick={onComplete}
        >
          <CheckIcon size={15} />
          {isComplete ? "설정 완료됨" : "설정 완료"}
        </button>
        <button type="button" aria-label="다음 건축물" title="다음 건축물" disabled={selectedIndex < 0 || selectedIndex >= buildings.length - 1 || isSaving} onClick={onNext}>
          <ArrowRightIcon size={15} />
        </button>
      </div>
    </section>
  );
}
