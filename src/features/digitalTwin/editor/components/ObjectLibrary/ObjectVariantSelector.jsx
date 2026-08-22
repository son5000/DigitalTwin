import styles from "./ObjectLibrary.module.css";

export default function ObjectVariantSelector({ definition, value, onChange }) {
  if (!definition?.variantGroups?.length) return null;
  return (
    <section className={styles.variants} aria-label={`${definition.name} Variant`}>
      <header><span>Object Variant</span><strong>{definition.name}</strong></header>
      <div className={styles.variantGrid}>
        {definition.variantGroups.map((group) => (
          <label key={group.id}>
            <span>{group.label}</span>
            <select
              value={value?.[group.id] ?? definition.defaultVariants?.[group.id] ?? group.options[0]?.id}
              onChange={(event) => onChange({ ...value, [group.id]: event.target.value })}
            >
              {group.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
