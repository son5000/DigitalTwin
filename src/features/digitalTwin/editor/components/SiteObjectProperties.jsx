import {
  MAX_TREE_COUNT,
  SITE_CREATION_TEMPLATE_MAP,
  SITE_MATERIAL_OPTIONS,
  SITE_OBJECT_GEOMETRY_MODES,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { DeleteIcon } from "@/components/icons";

import NumericField from "./NumericField";
import { ObjectVariantSelector } from "./ObjectLibrary";
import styles from "./SiteObjectProperties.module.css";

const COLOR_PRESETS = ["#455A64", "#607D8B", "#78909C", "#9E9E9E", "#D7CCC8", "#795548", "#8D6E63", "#558B2F", "#2E7D32", "#00838F", "#1565C0", "#F9A825"];

export default function SiteObjectProperties({ object, onChange, onDelete }) {
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const colorControlRef = useRef(null);

  useEffect(() => {
    if (!isColorPaletteOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!colorControlRef.current?.contains(event.target)) setIsColorPaletteOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isColorPaletteOpen]);

  if (!object) return null;
  const template = SITE_CREATION_TEMPLATE_MAP[object.type];
  const isRepeated = object.geometryMode === SITE_OBJECT_GEOMETRY_MODES.CLUSTER;
  const hasSpacing = [SITE_OBJECT_GEOMETRY_MODES.CLUSTER, SITE_OBJECT_GEOMETRY_MODES.PERIMETER].includes(object.geometryMode);
  const isLinear = object.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR;

  return (
    <section className={styles.panel} aria-label={`${template.name} 속성`}>
      <header className={styles.heading}>
        <span>환경 요소 / {template.name}</span>
        <h2>{object.name}</h2>
      </header>

      <div className={styles.section}>
        <h3>기본 정보</h3>
        <label><span>이름</span><input value={object.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label><span>재질</span><select value={object.appearance.material} onChange={(event) => onChange({ appearance: { material: event.target.value } })}>{SITE_MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className={styles.color} ref={colorControlRef}>
          <span>색상</span>
          <button
            type="button"
            className={styles.colorTrigger}
            aria-haspopup="dialog"
            aria-expanded={isColorPaletteOpen}
            onClick={() => setIsColorPaletteOpen((open) => !open)}
          >
            <i style={{ backgroundColor: object.appearance.color }} aria-hidden="true" />
            <code>{object.appearance.color.toUpperCase()}</code>
          </button>
          {isColorPaletteOpen ? (
            <div className={styles.colorPalette} role="dialog" aria-label="오브젝트 색상 팔레트">
              <div className={styles.colorSwatches}>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`${color} 색상 적용`}
                    aria-pressed={object.appearance.color.toLowerCase() === color.toLowerCase()}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange({ appearance: { color } })}
                  />
                ))}
              </div>
              <label className={styles.colorHex}>
                <span>HEX</span>
                <input value={object.appearance.color.toUpperCase()} onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange({ appearance: { color: event.target.value } })} />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <ObjectVariantSelector
        definition={template}
        value={object.variants}
        onChange={(variants) => onChange({ variants })}
      />

      <div className={styles.section}>
        <h3>{isLinear ? "경로와 폭" : "크기"}</h3>
        <div className={styles.fields}>
          <NumericField label={isLinear ? "경로 영역 가로" : "가로"} value={object.dimensions.width} min={0.1} unit="m" onChange={(width) => onChange({ dimensions: { width } })} />
          <NumericField label={isLinear ? "폭" : "세로"} value={isLinear ? object.path.width : object.dimensions.depth} min={0.1} unit="m" onChange={(value) => onChange(isLinear ? { path: { width: value } } : { dimensions: { depth: value } })} />
          <NumericField label="높이" value={object.dimensions.height} min={0.02} unit="m" onChange={(height) => onChange({ dimensions: { height } })} />
          {isRepeated && <NumericField
            label="개수"
            value={object.parameters.count}
            min={1}
            max={object.assetKind === "VEGETATION" ? MAX_TREE_COUNT : 64}
            step={1}
            unit="개"
            onChange={(count) => onChange({ parameters: { count } })}
          />}
          {hasSpacing && <NumericField label="기둥 간격" value={object.parameters.spacing} min={0.5} unit="m" onChange={(spacing) => onChange({ parameters: { spacing } })} />}
        </div>
      </div>

      <div className={styles.section}>
        <h3>위치와 회전</h3>
        <div className={styles.fields}>
          <NumericField label="위치 X" value={object.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Y" value={object.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="위치 Z" value={object.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField label="회전 Y" value={object.rotation.y * 180 / Math.PI} unit="°" onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })} />
        </div>
      </div>

      <button type="button" className={styles.deleteButton} onClick={onDelete}><DeleteIcon size={16} /> 환경 요소 삭제</button>
    </section>
  );
}
import { useEffect, useRef, useState } from "react";
