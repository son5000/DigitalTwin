import NumericField from "./NumericField";
import styles from "./WorldProperties.module.css";

export default function WorldProperties({ world, onChange }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>기본 월드</span>
        <h2>월드 설정</h2>
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
