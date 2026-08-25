import {
  createMaterialAppearance,
  getMaterialPresetId,
  MATERIAL_PRESETS,
  normalizeMaterialAppearance,
} from "@/features/digitalTwin/editor/constants/materialPresets";

import styles from "./MaterialAppearanceEditor.module.css";

const RANGE_FIELDS = [
  { key: "roughness", label: "거칠기", min: 0, max: 1, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
  { key: "metalness", label: "금속성", min: 0, max: 1, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
  { key: "reflectivity", label: "반사 정도", min: 0, max: 1, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
  { key: "opacity", label: "불투명도", min: 0.05, max: 1, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
  { key: "textureScale", label: "패턴 반복", min: 0.25, max: 8, step: 0.05, format: (value) => `${value.toFixed(2)}×` },
  { key: "textureRotation", label: "패턴 회전", min: 0, max: 360, step: 1, format: (value) => `${Math.round(value)}°` },
  { key: "bumpStrength", label: "표면 요철", min: 0, max: 0.8, step: 0.01, format: (value) => value.toFixed(2) },
  { key: "aging", label: "오염·노후화", min: 0, max: 1, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
];

export default function MaterialAppearanceEditor({
  appearance,
  onChange,
  showEdges = false,
  presetIds,
  disabled = false,
  hidePresetSelector = false,
  compact = false,
}) {
  const normalized = normalizeMaterialAppearance(appearance);
  const presetId = getMaterialPresetId(appearance);
  const scopedPresets = presetIds?.length
    ? MATERIAL_PRESETS.filter((item) => presetIds.includes(item.id))
    : MATERIAL_PRESETS;
  const availablePresets = scopedPresets.some((item) => item.id === presetId)
    ? scopedPresets
    : [...scopedPresets, MATERIAL_PRESETS.find((item) => item.id === presetId)].filter(Boolean);
  const categories = [...new Set(availablePresets.map((item) => item.category))];

  return (
    <div className={`${styles.editor} ${compact ? styles.compact : ""}`}>
      {!hidePresetSelector ? <label className={styles.field}>
        <span>재질 프리셋</span>
        <select disabled={disabled} value={presetId} onChange={(event) => onChange(createMaterialAppearance(event.target.value))}>
          {categories.map((category) => (
            <optgroup key={category} label={category}>
              {availablePresets.filter((item) => item.category === category).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label> : null}
      <label className={styles.field}>
        <span>기본 색상</span>
        <span className={styles.colorInputs}>
          <input type="color" disabled={disabled} value={normalized.color} aria-label="재질 색상" onChange={(event) => onChange({ color: event.target.value })} />
          <input type="text" disabled={disabled} value={normalized.color.toUpperCase()} aria-label="재질 색상 HEX" onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange({ color: event.target.value })} />
        </span>
      </label>
      <div className={styles.rangeGrid}>
        {RANGE_FIELDS.map((field) => (
          <label key={field.key} className={styles.rangeField}>
            <span><span>{field.label}</span><output>{field.format(normalized[field.key])}</output></span>
            <input type="range" disabled={disabled} min={field.min} max={field.max} step={field.step} value={normalized[field.key]} onChange={(event) => onChange({ [field.key]: Number(event.target.value) })} />
          </label>
        ))}
      </div>
      {showEdges ? <label className={styles.checkField}><input type="checkbox" disabled={disabled} checked={appearance.showEdges ?? true} onChange={(event) => onChange({ showEdges: event.target.checked })} /><span>외곽선 표시</span></label> : null}
    </div>
  );
}
