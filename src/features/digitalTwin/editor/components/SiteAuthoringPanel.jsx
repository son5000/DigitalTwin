import { SITE_CREATION_TEMPLATES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { getObjectLibraryDefinitions } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { ObjectLibrary } from "@/features/digitalTwin/editor/components/ObjectLibrary";
import { ArrowRightIcon, SiteTemplateIcon } from "@/components/icons";

import styles from "./SiteAuthoringPanel.module.css";

export default function SiteAuthoringPanel({
  areaSelection,
  placementPlan,
  placementNotice,
  activeTemplateId,
  activeVariants,
  allowedTemplateIds,
  buildings,
  siteObjects,
  selectedBuildingId,
  selectedSiteObjectId,
  headingLabel = "부지 구성",
  onClearArea,
  onConfirmAreaPlacement,
  onSelectTemplate,
  onSelectBuilding,
  onSelectSiteObject,
  onVariantsChange,
}) {
  const activeTemplate = SITE_CREATION_TEMPLATES.find((template) => template.id === activeTemplateId);
  const templates = getObjectLibraryDefinitions(allowedTemplateIds);
  const visibleSiteObjects = allowedTemplateIds?.length
    ? siteObjects.filter((object) => allowedTemplateIds.includes(object.type))
    : siteObjects;

  return (
    <section className={styles.panel} aria-label="부지 구성 도구">
      <header className={styles.heading}>
        <div>
          <span>{headingLabel}</span>
          <h2>{activeTemplate ? `${activeTemplate.name} 배치 중` : "오브젝트 또는 영역 선택"}</h2>
        </div>
      </header>

      <div className={styles.workflow}>
        <span className={areaSelection || activeTemplate ? styles.complete : styles.current}>1 영역 또는 오브젝트 선택</span>
        <i><ArrowRightIcon size={13} /></i>
        <span className={areaSelection || activeTemplate ? styles.current : ""}>2 그리드에 배치</span>
        <i><ArrowRightIcon size={13} /></i>
        <span>3 속성 조정</span>
      </div>

      <div className={styles.areaSummary}>
        {areaSelection ? (
          <>
            <div className={styles.areaDetails}>
              <span>선택한 영역</span>
              <strong>{areaSelection.width.toFixed(1)} × {areaSelection.depth.toFixed(1)} m</strong>
              {activeTemplate && placementPlan ? (
                <small className={placementPlan.canPlace ? styles.placementReady : styles.placementBlocked}>
                  {placementPlan.canPlace
                    ? `예상 ${placementPlan.columns} × ${placementPlan.rows} · ${placementPlan.count}개`
                    : placementPlan.message}
                </small>
              ) : <small>배치할 오브젝트를 선택하세요.</small>}
            </div>
            <div className={styles.areaActions}>
              {activeTemplate && placementPlan ? (
                <button type="button" className={styles.confirmPlacement} disabled={!placementPlan.canPlace} onClick={onConfirmAreaPlacement}>
                  {placementPlan.canPlace ? `${placementPlan.count}개 배치` : "배치 불가"}
                </button>
              ) : null}
              <button type="button" onClick={onClearArea}>다시 선택</button>
            </div>
          </>
        ) : (
          <p>{activeTemplate ? `${activeTemplate.name}: 클릭하면 1개, 드래그하면 선택 영역에 최대 개수를 배치합니다.` : "오브젝트를 먼저 고르거나 툴바에서 영역 선택을 사용하세요."}</p>
        )}
      </div>
      {placementNotice ? <p className={styles.placementNotice} role="status">{placementNotice}</p> : null}

      <ObjectLibrary
        definitions={templates}
        activeTemplateId={activeTemplateId}
        activeVariants={activeVariants}
        onSelect={onSelectTemplate}
        onVariantsChange={onVariantsChange}
      />

      <details className={styles.objectList}>
        <summary>부지 오브젝트 <strong>{buildings.length + visibleSiteObjects.length}</strong></summary>
        {buildings.length + visibleSiteObjects.length === 0 ? (
          <p>아직 생성된 건물이나 환경 요소가 없습니다.</p>
        ) : (
          <div>
            {buildings.map((building) => (
              <button
                key={building.id}
                type="button"
                className={building.id === selectedBuildingId ? styles.selectedObject : ""}
                onClick={() => onSelectBuilding?.(building.id)}
              >
                <span><SiteTemplateIcon template={SITE_CREATION_TEMPLATES[0]} size={16} />핵심 건축물</span>
                <strong>{building.name}</strong>
              </button>
            ))}
            {visibleSiteObjects.map((object) => {
              const template = SITE_CREATION_TEMPLATES.find((item) => item.id === object.type);
              return (
                <button
                  key={object.id}
                  type="button"
                  className={object.id === selectedSiteObjectId ? styles.selectedObject : ""}
                  onClick={() => onSelectSiteObject(object.id)}
                >
                  <span><SiteTemplateIcon template={template} size={16} />{template?.name ?? object.type}</span>
                  <strong>{object.name}</strong>
                </button>
              );
            })}
          </div>
        )}
      </details>
    </section>
  );
}
