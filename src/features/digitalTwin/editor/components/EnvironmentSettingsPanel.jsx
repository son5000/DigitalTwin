import {
  SITE_BACKGROUND_THEME_OPTIONS,
  SITE_GROUND_MATERIAL_OPTIONS,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";

import { GROUND_VIEW_MODES } from "@/features/digitalTwin/editor/model/undergroundModel";

import NumericField from "./NumericField";
import styles from "./EnvironmentSettingsPanel.module.css";

const GROUND_VIEW_OPTIONS = Object.freeze([
  [GROUND_VIEW_MODES.VISIBLE, "지면 표시"],
  [GROUND_VIEW_MODES.TRANSLUCENT, "지면 반투명"],
  [GROUND_VIEW_MODES.SECTION, "지면 단면"],
  [GROUND_VIEW_MODES.HIDDEN, "지면 숨기기"],
]);

export default function EnvironmentSettingsPanel({ environment, boundaryNotice, groundViewMode, onChange, onGroundViewModeChange }) {
  return (
    <section className={styles.panel} aria-label="환경 설정">
      <div className={styles.section}>
        <h3>부지 크기</h3>
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
        {boundaryNotice ? <p className={styles.boundaryNotice} role="status">{boundaryNotice}</p> : null}
      </div>

      <div className={styles.section}>
        <h3>배경 테마</h3>
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
            </button>
          ))}
        </div>
      </div>
      {groundViewMode && onGroundViewModeChange ? (
        <div className={styles.section}>
          <h3>지면 보기</h3>
          <div className={styles.viewModeGrid} role="group" aria-label="지면 보기 방식">
            {GROUND_VIEW_OPTIONS.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={groundViewMode === mode ? styles.activeViewMode : ""}
                aria-pressed={groundViewMode === mode}
                onClick={() => onGroundViewModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
