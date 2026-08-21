import NumericField from "./NumericField";
import styles from "./WorldProperties.module.css";

export default function WorldProperties({ world, onChange }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>BASE WORLD</span>
        <h2>World Settings</h2>
      </div>
      <div className={styles.fields}>
        <NumericField
          label="Width"
          value={world.width}
          min={3}
          unit="m"
          onChange={(width) => onChange({ width })}
        />
        <NumericField
          label="Depth"
          value={world.depth}
          min={3}
          unit="m"
          onChange={(depth) => onChange({ depth })}
        />
        <NumericField
          label="Wall H"
          value={world.wallHeight}
          min={1}
          unit="m"
          onChange={(wallHeight) => onChange({ wallHeight })}
        />
      </div>
    </section>
  );
}
