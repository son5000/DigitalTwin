import {
  formatGridResolution,
  GRID_CELL_SIZE_OPTIONS,
  getGridRegionsForScope,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { AddIcon, DeleteIcon } from "@/components/icons";

import NumericField from "./NumericField";
import styles from "./GridSettingsPanel.module.css";

export default function GridSettingsPanel({
  gridSettings,
  scopeId,
  scopeLabel,
  onToggle,
  onBaseSizeChange,
  onAddRegion,
  onUpdateRegion,
  onRemoveRegion,
}) {
  const regions = getGridRegionsForScope(gridSettings, scopeId);

  return (
    <section className={styles.panel} aria-label="그리드 스냅 설정">
      <div className={styles.heading}>
        <div>
          <span>편집 그리드</span>
          <h2>그리드 스냅</h2>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={gridSettings.enabled}
          className={`${styles.toggle} ${gridSettings.enabled ? styles.enabled : ""}`}
          onClick={() => onToggle(!gridSettings.enabled)}
        >
          {gridSettings.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className={styles.baseControl}>
        <label>
          <span>기본 셀</span>
          <select value={gridSettings.baseSize} onChange={(event) => onBaseSizeChange(Number(event.target.value))}>
            {GRID_CELL_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{formatGridResolution(size)}</option>
            ))}
          </select>
        </label>
      </div>

      <details className={styles.regions}>
        <summary>
          <span>세부 그리드 영역</span>
          <strong>{regions.length}</strong>
        </summary>
        <div className={styles.regionIntro}>
          <span>{scopeLabel}</span>
          <button type="button" onClick={() => onAddRegion(scopeId)}><AddIcon size={15} /> 영역</button>
        </div>
        {regions.length === 0 ? (
          <p className={styles.empty}>세부 영역을 추가하면 해당 범위에서 더 작은 그리드 단위를 사용합니다.</p>
        ) : (
          <div className={styles.regionList}>
            {regions.map((region) => (
              <article key={region.id} className={styles.regionCard}>
                <div className={styles.regionHeader}>
                  <input
                    aria-label="영역 이름"
                    value={region.name}
                    onChange={(event) => onUpdateRegion(region.id, { name: event.target.value })}
                  />
                  <label className={styles.regionEnabled}>
                    <input
                      type="checkbox"
                      checked={region.enabled}
                      onChange={(event) => onUpdateRegion(region.id, { enabled: event.target.checked })}
                    />
                    사용
                  </label>
                </div>
                <label className={styles.cellSize}>
                  <span>셀 크기</span>
                  <select value={region.cellSize} onChange={(event) => onUpdateRegion(region.id, { cellSize: Number(event.target.value) })}>
                    {GRID_CELL_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{formatGridResolution(size)}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.fields}>
                  <NumericField label="중심 X" value={region.center.x} unit="m" onChange={(x) => onUpdateRegion(region.id, { center: { x } })} />
                  <NumericField label="중심 Z" value={region.center.z} unit="m" onChange={(z) => onUpdateRegion(region.id, { center: { z } })} />
                  <NumericField label="가로" value={region.size.width} min={0.1} unit="m" onChange={(width) => onUpdateRegion(region.id, { size: { width } })} />
                  <NumericField label="세로" value={region.size.depth} min={0.1} unit="m" onChange={(depth) => onUpdateRegion(region.id, { size: { depth } })} />
                </div>
                <button type="button" className={styles.removeButton} onClick={() => onRemoveRegion(region.id)}><DeleteIcon size={15} /> 영역 삭제</button>
              </article>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
