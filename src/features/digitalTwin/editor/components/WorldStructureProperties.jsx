import {
  WORLD_STRUCTURE_MATERIALS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { degreesToRadians, radiansToDegrees } from "@/features/digitalTwin/editor/utils/editorMath";
import { getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import NumericField from "./NumericField";
import PropertySection from "./PropertySection";
import styles from "./WorldStructureProperties.module.css";

export default function WorldStructureProperties({ structure, spaces, worldLocked, onChange }) {
  if (!structure) {
    return (
      <section className={styles.empty}>
        <span aria-hidden="true">▧</span>
        <strong>WORLD STRUCTURE</strong>
        <h2>선택된 구조물 없음</h2>
        <p>World Edit Mode에서 공간 구조물을 선택하거나 새 구조물을 배치하세요.</p>
      </section>
    );
  }

  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];
  const dimensions = getWorldStructureDimensions(structure);
  const disabled = worldLocked || structure.locked;

  return (
    <section className={styles.properties}>
      <div className={styles.heading}>
        <div><span>WORLD STRUCTURE</span><h2>{structure.name}</h2></div>
        <span className={styles.badge}>WORLD</span>
      </div>
      {worldLocked && <p className={styles.lockNotice}>World Structure 전체가 잠겨 있습니다.</p>}

      <PropertySection title="Structure" summary={definition.name} defaultOpen>
        <label className={styles.textField}><span>Name</span><input type="text" disabled={disabled} value={structure.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        {definition.variants && (
          <label className={styles.textField}><span>Type</span><select disabled={disabled} value={structure.variant} onChange={(event) => {
            const variant = event.target.value;
            onChange({
              variant,
              appearance: variant === "GLASS"
                ? { materialPreset: "GLASS", opacity: 0.25 }
                : variant.includes("MESH") || variant.includes("FENCE")
                  ? { materialPreset: "MESH", opacity: 0.8 }
                  : {},
            });
          }}>{definition.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>
        )}
        <dl className={styles.dimensions}>
          <div><dt>Dimension</dt><dd>{dimensions.width.toFixed(3)} × {dimensions.depth.toFixed(3)} × {dimensions.height.toFixed(3)} m</dd></div>
          <div><dt>Type</dt><dd>{structure.type}</dd></div>
        </dl>
      </PropertySection>

      <PropertySection title="Geometry" summary="Parametric" defaultOpen>
        {definition.parameters.map((parameter) => (
          <NumericField
            key={parameter.key}
            label={parameter.label}
            value={structure.parameters[parameter.key] ?? 0}
            min={parameter.min}
            step={parameter.step}
            unit={parameter.unit}
            disabled={disabled}
            onChange={(value) => onChange({ parameters: { [parameter.key]: value } })}
          />
        ))}
      </PropertySection>

      <PropertySection title="Placement" summary="X / Y / Z" defaultOpen>
        <label className={styles.groundSnap}>
          <span>
            <input
              type="checkbox"
              checked={structure.groundSnap}
              disabled={disabled}
              onChange={(event) => onChange({ groundSnap: event.target.checked })}
            />
            <strong>Ground Snap</strong>
          </span>
          <small>
            {structure.groundSnap
              ? "Floor / Platform 표면에 자동 배치"
              : "X / Y / Z 자유 배치"}
          </small>
        </label>
        <NumericField label="X" value={structure.position.x} step={0.1} unit="m" disabled={disabled} onChange={(x) => onChange({ position: { x } })} />
        <NumericField label="Elevation (Y)" value={structure.position.y} step={0.1} unit="m" disabled={disabled || structure.groundSnap} onChange={(y) => onChange({ position: { y } })} />
        <NumericField label="Z" value={structure.position.z} step={0.1} unit="m" disabled={disabled} onChange={(z) => onChange({ position: { z } })} />
        <NumericField label="Rotation Y" value={radiansToDegrees(structure.rotation.y)} step={1} unit="deg" disabled={disabled} onChange={(value) => onChange({ rotation: { y: degreesToRadians(value) } })} />
        <label className={styles.textField}><span>Parent Space</span><select disabled={disabled} value={structure.spaceId} onChange={(event) => onChange({ spaceId: event.target.value })}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
      </PropertySection>

      <PropertySection title="Appearance" summary={structure.appearance.materialPreset} defaultOpen>
        <label className={styles.colorField}><span>Color</span><span><input type="color" disabled={disabled} value={structure.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} /><input type="text" disabled={disabled} value={structure.appearance.color.toUpperCase()} onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange({ appearance: { color: event.target.value } })} /></span></label>
        <label className={styles.textField}><span>Material</span><select disabled={disabled} value={structure.appearance.materialPreset} onChange={(event) => onChange({ appearance: { materialPreset: event.target.value } })}>{WORLD_STRUCTURE_MATERIALS.map((material) => <option key={material}>{material}</option>)}</select></label>
        <label className={styles.opacity}><span><span>Opacity</span><output>{Math.round(structure.appearance.opacity * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" disabled={disabled} value={structure.appearance.opacity} onChange={(event) => onChange({ appearance: { opacity: Number(event.target.value) } })} /></label>
      </PropertySection>

      <PropertySection title="Advanced" summary={structure.locked ? "Locked" : structure.spaceId}>
        <label className={styles.check}><input type="checkbox" checked={structure.visible} onChange={(event) => onChange({ visible: event.target.checked })} /><span>Visible</span></label>
        <label className={styles.check}><input type="checkbox" disabled={worldLocked} checked={structure.locked} onChange={(event) => onChange({ locked: event.target.checked })} /><span>Lock Individual</span></label>
        <p className={styles.objectId}>{structure.id}</p>
      </PropertySection>
    </section>
  );
}
