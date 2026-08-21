import { useMemo, useState } from "react";

import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_SHAPE_TEMPLATE_MAP,
  EQUIPMENT_SHAPE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";

import styles from "./EquipmentLibrary.module.css";

function TemplateCard({ template, activeTemplateId, favoriteTemplateIds, viewMode, onSelect, onToggleFavorite }) {
  const isActive = template.id === activeTemplateId;
  const isFavorite = favoriteTemplateIds.includes(template.id);

  return (
    <article className={`${styles.card} ${styles[viewMode]} ${isActive ? styles.active : ""}`}>
      <button
        type="button"
        className={styles.selectButton}
        aria-pressed={isActive}
        title={`${template.nameKo} (${template.name}) 배치`}
        onClick={() => onSelect(template.id)}
      >
        <span className={styles.thumbnail} aria-hidden="true">{template.icon}</span>
        <span className={styles.cardText}>
          <strong>{template.nameKo}</strong>
          <small>{template.name}</small>
        </span>
        <span className={styles.addMark}>{isActive ? "×" : "+"}</span>
      </button>
      <button
        type="button"
        className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteActive : ""}`}
        aria-label={`${template.nameKo} ${isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
        aria-pressed={isFavorite}
        title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        onClick={() => onToggleFavorite(template.id)}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </article>
  );
}

export default function EquipmentLibrary({
  activeTemplateId,
  favoriteTemplateIds,
  recentTemplateIds,
  onSelect,
  onToggleFavorite,
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredTemplates = useMemo(
    () => EQUIPMENT_SHAPE_TEMPLATES.filter((template) => {
      const matchesCategory = categoryId === "ALL" || template.category === categoryId;
      const searchText = [template.name, template.nameKo, template.id, ...template.keywords]
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      return matchesCategory && (!normalizedQuery || searchText.includes(normalizedQuery));
    }),
    [categoryId, normalizedQuery],
  );
  const favoriteTemplates = favoriteTemplateIds
    .map((id) => EQUIPMENT_SHAPE_TEMPLATE_MAP[id])
    .filter(Boolean);
  const recentTemplates = recentTemplateIds
    .map((id) => EQUIPMENT_SHAPE_TEMPLATE_MAP[id])
    .filter(Boolean)
    .slice(0, 5);
  const showQuickSections = categoryId === "ALL" && !normalizedQuery;

  function renderCards(templates) {
    return templates.map((template) => (
      <TemplateCard
        key={template.id}
        template={template}
        activeTemplateId={activeTemplateId}
        favoriteTemplateIds={favoriteTemplateIds}
        viewMode={viewMode}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
      />
    ));
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>설비 라이브러리</span>
          <h2>설비 카탈로그</h2>
        </div>
        <span className={styles.count}>{filteredTemplates.length}</span>
      </div>

      <label className={styles.searchField}>
        <span className={styles.visuallyHidden}>설비 검색</span>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          placeholder="배관, pipe, pump…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className={styles.filters}>
        <label>
          <span className={styles.visuallyHidden}>카테고리</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {EQUIPMENT_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameKo} · {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.viewToggle} aria-label="카탈로그 보기 방식">
          <button type="button" className={viewMode === "grid" ? styles.toggleActive : ""} aria-label="그리드 보기" title="그리드 보기" onClick={() => setViewMode("grid")}>▦</button>
          <button type="button" className={viewMode === "list" ? styles.toggleActive : ""} aria-label="목록 보기" title="목록 보기" onClick={() => setViewMode("list")}>☷</button>
        </div>
      </div>

      <div className={styles.catalogScroll}>
        {showQuickSections && favoriteTemplates.length > 0 && (
          <section className={styles.quickSection}>
            <h3>즐겨찾기</h3>
            <div className={`${styles.library} ${styles[viewMode]}`}>{renderCards(favoriteTemplates)}</div>
          </section>
        )}
        {showQuickSections && recentTemplates.length > 0 && (
          <section className={styles.quickSection}>
            <h3>최근 사용</h3>
            <div className={`${styles.library} ${styles[viewMode]}`}>{renderCards(recentTemplates)}</div>
          </section>
        )}

        <section className={styles.quickSection}>
          <h3>{normalizedQuery ? `검색 결과 “${query.trim()}”` : "전체 카탈로그"}</h3>
          {filteredTemplates.length > 0 ? (
            <div className={`${styles.library} ${styles[viewMode]}`}>{renderCards(filteredTemplates)}</div>
          ) : (
            <p className={styles.empty}>일치하는 설비가 없습니다.</p>
          )}
        </section>
      </div>

      <p className={styles.help}>타입을 고른 뒤 중앙 바닥을 클릭하여 배치합니다.</p>
    </section>
  );
}
