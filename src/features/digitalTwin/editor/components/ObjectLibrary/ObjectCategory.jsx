import { ChevronDownIcon } from "@/components/icons";
import CatalogCategoryThumbnail from "@/features/digitalTwin/editor/components/CatalogCategoryThumbnail";

import ObjectSubCategory from "./ObjectSubCategory";
import styles from "./ObjectLibrary.module.css";

export default function ObjectCategory({ category, definitions, open, activeTemplateId, onToggle, onSelect }) {
  return (
    <section className={`${styles.category} ${open ? styles.categoryOpen : ""}`}>
      <button
        type="button"
        className={styles.categoryTrigger}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.categoryIcon} aria-hidden="true"><CatalogCategoryThumbnail categoryId={category.id} /></span>
        <span className={styles.categoryText}><strong>{category.name}</strong></span>
        <span className={styles.categoryCount}>{definitions.length}</span>
        <ChevronDownIcon size={16} className={styles.chevron} />
      </button>
      <div className={styles.categoryBody} aria-hidden={!open} inert={!open}>
        <div className={styles.categoryBodyInner}>
          {category.subcategories.map((subcategory) => (
            <ObjectSubCategory
              key={subcategory.id}
              label={subcategory.label}
              definitions={definitions.filter((definition) => definition.subcategoryId === subcategory.id)}
              activeTemplateId={activeTemplateId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
