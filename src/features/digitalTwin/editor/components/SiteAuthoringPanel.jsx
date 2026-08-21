import { SITE_CREATION_TEMPLATES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";

import styles from "./SiteAuthoringPanel.module.css";

export default function SiteAuthoringPanel({
  areaSelection,
  activeTemplateId,
  buildings,
  siteObjects,
  selectedSiteObjectId,
  onClearArea,
  onSelectTemplate,
  onSelectSiteObject,
}) {
  const activeTemplate = SITE_CREATION_TEMPLATES.find((template) => template.id === activeTemplateId);

  return (
    <section className={styles.panel} aria-label="부지 구성 도구">
      <header className={styles.heading}>
        <div>
          <span>부지 구성</span>
          <h2>{activeTemplate ? `${activeTemplate.name} 배치 중` : "오브젝트 또는 영역 선택"}</h2>
        </div>
      </header>

      <div className={styles.workflow}>
        <span className={areaSelection || activeTemplate ? styles.complete : styles.current}>1 영역 또는 오브젝트 선택</span>
        <i>→</i>
        <span className={areaSelection || activeTemplate ? styles.current : ""}>2 그리드에 배치</span>
        <i>→</i>
        <span>3 속성 조정</span>
      </div>

      <div className={styles.areaSummary}>
        {areaSelection ? (
          <>
            <div>
              <span>선택한 영역</span>
              <strong>{areaSelection.width.toFixed(1)} × {areaSelection.depth.toFixed(1)} m</strong>
            </div>
            <button type="button" onClick={onClearArea}>다시 선택</button>
          </>
        ) : (
          <p>{activeTemplate ? `${activeTemplate.name} 미리보기를 그리드 위에서 클릭해 배치하세요.` : "오브젝트를 먼저 고르거나 툴바에서 영역 선택을 사용하세요."}</p>
        )}
      </div>

      <div className={styles.templateGrid} aria-label="생성할 구조물">
        {SITE_CREATION_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className={template.id === activeTemplateId ? styles.activeTemplate : ""}
            aria-pressed={template.id === activeTemplateId}
            title={areaSelection ? `${template.name} 생성` : `${template.name}을 커서에 붙여 배치`}
            onClick={() => onSelectTemplate(template.id)}
          >
            <span aria-hidden="true">{template.icon}</span>
            <strong>{template.name}</strong>
            <small>{template.category}</small>
          </button>
        ))}
      </div>

      <details className={styles.objectList}>
        <summary>부지 오브젝트 <strong>{buildings.length + siteObjects.length}</strong></summary>
        {buildings.length + siteObjects.length === 0 ? (
          <p>아직 생성된 건물이나 환경 요소가 없습니다.</p>
        ) : (
          <div>
            {siteObjects.map((object) => (
              <button
                key={object.id}
                type="button"
                className={object.id === selectedSiteObjectId ? styles.selectedObject : ""}
                onClick={() => onSelectSiteObject(object.id)}
              >
                <span>{SITE_CREATION_TEMPLATES.find((template) => template.id === object.type)?.name ?? object.type}</span>
                <strong>{object.name}</strong>
              </button>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
