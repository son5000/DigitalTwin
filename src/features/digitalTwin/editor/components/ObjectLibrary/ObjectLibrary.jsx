import { useMemo, useState } from "react";

import { OBJECT_LIBRARY_CATEGORIES } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";

import ObjectCategory from "./ObjectCategory";
import ObjectLibrarySearch from "./ObjectLibrarySearch";
import ObjectPreview from "./ObjectPreview";
import ObjectVariantSelector from "./ObjectVariantSelector";
import styles from "./ObjectLibrary.module.css";

function matchesQuery(definition, normalizedQuery) {
  if (!normalizedQuery) return true;
  return [definition.name, definition.nameEn, definition.description, definition.id, ...definition.keywords]
    .join(" ")
    .toLocaleLowerCase("ko-KR")
    .includes(normalizedQuery);
}

export default function ObjectLibrary({ definitions, activeTemplateId, activeVariants, onSelect, onVariantsChange }) {
  const [query, setQuery] = useState("");
  const [openCategoryIds, setOpenCategoryIds] = useState([]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredDefinitions = useMemo(
    () => definitions.filter((definition) => matchesQuery(definition, normalizedQuery)),
    [definitions, normalizedQuery],
  );
  const activeDefinition = definitions.find((definition) => definition.id === activeTemplateId) ?? null;
  const visibleCategories = OBJECT_LIBRARY_CATEGORIES
    .map((category) => ({
      category,
      definitions: filteredDefinitions.filter((definition) => definition.categoryId === category.id),
    }))
    .filter((entry) => entry.definitions.length);
  function handleSelect(templateId) {
    onSelect(templateId);
  }

  function toggleCategory(categoryId) {
    setOpenCategoryIds((ids) => ids.includes(categoryId)
      ? ids.filter((id) => id !== categoryId)
      : [...ids, categoryId]);
  }

  return (
    <section className={styles.library} aria-label="Object Library">
      <header className={styles.libraryHeading}>
        <div><span>WORLD ASSET CATALOG</span><h2>Object Library</h2></div>
        <strong>{definitions.length}</strong>
      </header>
      <ObjectLibrarySearch value={query} resultCount={filteredDefinitions.length} onChange={setQuery} />

      {activeDefinition ? (
        <div className={styles.activeObject}>
          <ObjectPreview definition={activeDefinition} compact />
          <span><small>현재 배치</small><strong>{activeDefinition.name}</strong></span>
          <kbd>ESC</kbd>
        </div>
      ) : null}

      <div className={styles.categories}>
        {visibleCategories.length ? visibleCategories.map(({ category, definitions: items }) => (
          <ObjectCategory
            key={category.id}
            category={category}
            definitions={items}
            open={Boolean(normalizedQuery) || openCategoryIds.includes(category.id)}
            activeTemplateId={activeTemplateId}
            onToggle={() => toggleCategory(category.id)}
            onSelect={handleSelect}
          />
        )) : <p className={styles.empty}>검색 결과가 없습니다.</p>}
      </div>

      <ObjectVariantSelector
        definition={activeDefinition}
        value={activeVariants}
        onChange={onVariantsChange}
      />
      <p className={styles.help}>클릭 후 Scene에 배치하거나 항목을 Scene으로 드래그하세요.</p>
    </section>
  );
}
