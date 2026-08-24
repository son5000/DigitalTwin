import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { BUILDING_TEMPLATES } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { BUILDING_SETTINGS_TABS, BUILDING_SETTING_STATUS } from "@/features/digitalTwin/editor/constants/buildingDetail";

import styles from "./BuildingDetailNavigator.module.css";

const STATUS_META = Object.freeze({
  [BUILDING_SETTING_STATUS.UNSET]: { label: "미설정", className: styles.unset },
  [BUILDING_SETTING_STATUS.IN_PROGRESS]: { label: "설정 중", className: styles.inProgress },
  [BUILDING_SETTING_STATUS.COMPLETE]: { label: "설정 완료", className: styles.complete },
});

function getBuildingTypeLabel(building) {
  return BUILDING_TEMPLATES.find((template) => template.id === building.templateId)?.name
    ?? building.templateId
    ?? "건축물";
}

export default function BuildingDetailNavigator({
  buildings,
  selectedBuildingId,
  statusById,
  activeTab,
  selectedTabStatus,
  isOpen,
  isSaving,
  hasUnsavedChanges,
  onToggle,
  onSelect,
  onPrevious,
  onNext,
  onComplete,
}) {
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedIndex = buildings.findIndex((building) => building.id === selectedBuildingId);
  const completeCount = buildings.filter(
    (building) => statusById[building.id] === BUILDING_SETTING_STATUS.COMPLETE,
  ).length;
  const currentTabLabel = activeTab === BUILDING_SETTINGS_TABS.INTERIOR ? "내부 기본" : "외관";

  return (
    <section className={styles.navigator} aria-label="건축물 상세 설정 대상">
      <div className={styles.currentTarget}>
        <div>
          <span>현재 설정 중인 건축물</span>
          <strong>{selectedBuilding?.name ?? "선택된 건축물 없음"}</strong>
        </div>
        <span className={styles.saveState} data-saving={isSaving || undefined}>
          {isSaving ? "자동 저장 중" : hasUnsavedChanges ? "변경사항 있음" : "자동 저장됨"}
        </span>
      </div>

      <div className={styles.summaryRow}>
        <span>{completeCount}/{buildings.length} 설정 완료</span>
        <button type="button" className={styles.toggleButton} aria-expanded={isOpen} onClick={onToggle}>
          {isOpen ? <ChevronDownIcon size={15} /> : <ChevronRightIcon size={15} />}
          건축물 목록
        </button>
      </div>

      {isOpen ? (
        buildings.length > 0 ? (
          <div className={styles.list}>
            {buildings.map((building) => {
              const active = building.id === selectedBuildingId;
              const status = statusById[building.id] ?? BUILDING_SETTING_STATUS.UNSET;
              const statusMeta = STATUS_META[status];
              return (
                <button
                  key={building.id}
                  type="button"
                  className={`${styles.listItem} ${active ? styles.active : ""}`}
                  aria-pressed={active}
                  onClick={() => onSelect(building.id)}
                >
                  <span className={styles.itemIcon}><BuildingIcon size={18} /></span>
                  <span className={styles.itemText}>
                    <strong>{building.name}</strong>
                    <span>{getBuildingTypeLabel(building)}</span>
                    <code title={building.id}>{building.id}</code>
                  </span>
                  <span className={`${styles.statusBadge} ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <BuildingIcon size={28} />
            <strong>배치된 건축물이 없습니다</strong>
            <span>월드 구성 단계에서 건축물을 먼저 배치하세요.</span>
          </div>
        )
      ) : null}

      <div className={styles.sequenceActions}>
        <button type="button" disabled={selectedIndex <= 0 || isSaving} onClick={onPrevious}>
          <ArrowLeftIcon size={15} /> 이전 건축물
        </button>
        <button
          type="button"
          className={selectedTabStatus === BUILDING_SETTING_STATUS.COMPLETE ? styles.completedButton : styles.completeButton}
          disabled={!selectedBuilding || isSaving}
          onClick={onComplete}
        >
          <CheckIcon size={15} />
          {selectedTabStatus === BUILDING_SETTING_STATUS.COMPLETE ? `${currentTabLabel} 완료됨` : `${currentTabLabel} 완료`}
        </button>
        <button type="button" disabled={selectedIndex < 0 || selectedIndex >= buildings.length - 1 || isSaving} onClick={onNext}>
          다음 건축물 <ArrowRightIcon size={15} />
        </button>
      </div>
    </section>
  );
}
