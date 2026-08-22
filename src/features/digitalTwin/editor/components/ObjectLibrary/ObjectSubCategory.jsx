import ObjectItem from "./ObjectItem";
import styles from "./ObjectLibrary.module.css";

export default function ObjectSubCategory({ label, definitions, activeTemplateId, onSelect }) {
  if (!definitions.length) return null;
  return (
    <section className={styles.subcategory}>
      <header><span>{label}</span><small>{definitions.length}</small></header>
      <div className={styles.itemList}>
        {definitions.map((definition) => (
          <ObjectItem
            key={definition.id}
            definition={definition}
            active={definition.id === activeTemplateId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
