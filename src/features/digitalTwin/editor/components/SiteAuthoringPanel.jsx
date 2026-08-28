import { getObjectLibraryDefinitions, OBJECT_LIBRARY_DEFINITION_MAP } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { ObjectLibrary } from "@/features/digitalTwin/editor/components/ObjectLibrary";

import styles from "./SiteAuthoringPanel.module.css";

export default function SiteAuthoringPanel({
  areaSelection,
  placementPlan,
  placementNotice,
  activeTemplateId,
  activeVariants,
  allowedTemplateIds,
  onClearArea,
  onConfirmAreaPlacement,
  onSelectTemplate,
  onVariantsChange,
}) {
  const activeTemplate = OBJECT_LIBRARY_DEFINITION_MAP[activeTemplateId];
  const templates = getObjectLibraryDefinitions(allowedTemplateIds);

  return (
    <section className={styles.panel} aria-label="부지 구성 도구">
      {areaSelection ? (
        <div className={styles.areaSummary}>
          <div className={styles.areaDetails}>
            <span>선택한 영역</span>
            <strong>{areaSelection.width.toFixed(1)} × {areaSelection.depth.toFixed(1)} m</strong>
            {activeTemplate && placementPlan ? (
              <small className={placementPlan.canPlace ? styles.placementReady : styles.placementBlocked}>
                {placementPlan.canPlace
                  ? `예상 ${placementPlan.columns} × ${placementPlan.rows} · ${placementPlan.count}개`
                  : placementPlan.message}
              </small>
            ) : null}
          </div>
          <div className={styles.areaActions}>
            {activeTemplate && placementPlan ? (
              <button type="button" className={styles.confirmPlacement} disabled={!placementPlan.canPlace} onClick={onConfirmAreaPlacement}>
                {placementPlan.canPlace ? `${placementPlan.count}개 배치` : "배치 불가"}
              </button>
            ) : null}
            <button type="button" onClick={onClearArea}>다시 선택</button>
          </div>
        </div>
      ) : null}
      {placementNotice ? <p className={styles.placementNotice} role="status">{placementNotice}</p> : null}

      <ObjectLibrary
        definitions={templates}
        activeTemplateId={activeTemplateId}
        activeVariants={activeVariants}
        onSelect={onSelectTemplate}
        onVariantsChange={onVariantsChange}
      />
    </section>
  );
}
