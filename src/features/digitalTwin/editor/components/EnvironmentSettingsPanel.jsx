import {
  SITE_BACKGROUND_THEME_OPTIONS,
  SITE_GROUND_MATERIAL_OPTIONS,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";

import NumericField from "./NumericField";
import styles from "./EnvironmentSettingsPanel.module.css";

export default function EnvironmentSettingsPanel({ environment, onChange }) {
  return (
    <section className={styles.panel} aria-label="환경 설정">
      <header className={styles.heading}>
        <span>STEP 1</span>
        <h2>환경 설정</h2>
        <p>전체 부지의 기준이 되는 지면과 배경을 설정합니다.</p>
      </header>

      <div className={styles.section}>
        <h3>지면 영역</h3>
        <div className={styles.fieldGrid}>
          <NumericField label="가로" value={environment.width} min={20} max={400} unit="m" onChange={(width) => onChange({ width })} />
          <NumericField label="세로" value={environment.depth} min={20} max={400} unit="m" onChange={(depth) => onChange({ depth })} />
        </div>
        <label className={styles.selectField}>
          <span>지면 재질</span>
          <select value={environment.groundMaterial} onChange={(event) => onChange({ groundMaterial: event.target.value })}>
            {SITE_GROUND_MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.section}>
        <h3>Background Theme</h3>
        <div className={styles.themeGrid}>
          {SITE_BACKGROUND_THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={environment.backgroundTheme === option.id ? styles.activeTheme : ""}
              aria-pressed={environment.backgroundTheme === option.id}
              onClick={() => onChange({ backgroundTheme: option.id })}
            >
              <span className={styles.preview} data-theme-preview={option.id} />
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
