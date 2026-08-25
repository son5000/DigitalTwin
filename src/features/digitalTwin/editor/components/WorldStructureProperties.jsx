import {
  FLOOR_MATERIAL_PRESET_IDS,
  getMaterialPreset,
  getMaterialPresetId,
  SPACE_MATERIAL_PRESET_IDS,
  WALL_MATERIAL_PRESET_IDS,
} from "@/features/digitalTwin/editor/constants/materialPresets";
import { WORLD_STRUCTURE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { degreesToRadians, radiansToDegrees } from "@/features/digitalTwin/editor/utils/editorMath";
import { getStairSegments } from "@/features/digitalTwin/editor/utils/stairStructure";
import { StructureIcon } from "@/components/icons";

import NumericField from "./NumericField";
import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import PropertySection from "./PropertySection";
import styles from "./WorldStructureProperties.module.css";

export default function WorldStructureProperties({ structure, spaces, floors = [], currentFloorId, worldLocked, onChange }) {
  if (!structure) {
    return (
      <section className={styles.empty}>
        <span aria-hidden="true"><StructureIcon size={34} /></span>
        <strong>월드 구조물</strong>
        <h2>선택된 구조물 없음</h2>
      </section>
    );
  }

  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];
  const disabled = worldLocked || structure.locked;
  const stairSegments = structure.type === "STAIR" ? getStairSegments(structure, floors) : [];
  const appearancePresetIds = ["WALL", "PARTITION", "TEMPORARY_WALL"].includes(structure.type)
    ? WALL_MATERIAL_PRESET_IDS
    : definition.group === "FLOOR"
      ? FLOOR_MATERIAL_PRESET_IDS
      : definition.group === "SPACE"
        ? SPACE_MATERIAL_PRESET_IDS
        : undefined;
  const materialPreset = getMaterialPreset(getMaterialPresetId(structure.appearance));

  return (
    <section className={styles.properties}>
      {worldLocked && <p className={styles.lockNotice}>월드 구조물 전체가 잠겨 있습니다.</p>}

      <PropertySection title="기본 정보" summary={definition.nameKo} defaultOpen>
        <label className={styles.textField}><span>이름</span><input type="text" disabled={disabled} value={structure.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        {structure.type === "ROOM" ? <label className={styles.textField}><span>공간 용도</span><input type="text" disabled={disabled} value={structure.usage ?? ""} placeholder="예: 사무실, 회의실, 창고" onChange={(event) => onChange({ usage: event.target.value })} /></label> : null}
        {definition.variants && (
          <label className={styles.textField}><span>형태</span><select disabled={disabled} value={structure.variant} onChange={(event) => {
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
      </PropertySection>

      <PropertySection title="크기" defaultOpen>
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

      <PropertySection title="배치" defaultOpen>
        <label className={styles.groundSnap}>
          <span>
            <input
              type="checkbox"
              checked={structure.groundSnap}
              disabled={disabled}
              onChange={(event) => onChange({ groundSnap: event.target.checked })}
            />
            <strong>바닥 스냅</strong>
          </span>
        </label>
        <NumericField label="X" value={structure.position.x} step={0.1} unit="m" disabled={disabled} onChange={(x) => onChange({ position: { x } })} />
        <NumericField label="Elevation (Y)" value={structure.position.y} step={0.1} unit="m" disabled={disabled || structure.groundSnap} onChange={(y) => onChange({ position: { y } })} />
        <NumericField label="Z" value={structure.position.z} step={0.1} unit="m" disabled={disabled} onChange={(z) => onChange({ position: { z } })} />
        <NumericField label="Rotation Y" value={radiansToDegrees(structure.rotation.y)} step={1} unit="deg" disabled={disabled} onChange={(value) => onChange({ rotation: { y: degreesToRadians(value) } })} />
        <label className={styles.textField}><span>상위 공간</span><select disabled={disabled} value={structure.spaceId} onChange={(event) => onChange({ spaceId: event.target.value })}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
      </PropertySection>

      {definition.isVertical ? (
        <PropertySection title="연결 층" summary="수직 구조" defaultOpen>
          {structure.type === "STAIR" ? (
            <>
              <label className={styles.textField}><span>계단 유형</span><select disabled value={structure.stairType ?? "STRAIGHT"}><option value="STRAIGHT">직선형</option></select></label>
            </>
          ) : <label className={styles.textField}><span>진행 방향</span><select disabled={disabled} value={structure.direction ?? "UP"} onChange={(event) => onChange({ direction: event.target.value })}><option value="UP">상향</option><option value="DOWN">하향</option><option value="BOTH">상·하향</option></select></label>}
          <label className={styles.textField}>
            <span>적용 범위</span>
            <select value={structure.type === "STAIR" ? "RANGE" : structure.applicationScope?.mode ?? "RANGE"} disabled={disabled || structure.type === "STAIR"} onChange={(event) => onChange({ applicationScope: { ...structure.applicationScope, mode: event.target.value } })}>
              {structure.type !== "STAIR" ? <option value="CURRENT">현재 층</option> : null}
              {structure.type !== "STAIR" ? <option value="SELECTED">선택 층</option> : null}
              <option value="RANGE">층 범위</option>
              {structure.type !== "STAIR" ? <option value="ALL">전체 층</option> : null}
            </select>
          </label>
          {structure.type === "STAIR" || (structure.applicationScope?.mode ?? "RANGE") === "RANGE" ? (
            <>
              <label className={styles.textField}><span>시작 층</span><select disabled={disabled} value={structure.applicationScope?.startFloorId ?? currentFloorId ?? ""} onChange={(event) => onChange({ applicationScope: { ...structure.applicationScope, startFloorId: event.target.value } })}>{floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label>
              <label className={styles.textField}><span>종료 층</span><select disabled={disabled} value={structure.applicationScope?.endFloorId ?? floors.at(-1)?.id ?? currentFloorId ?? ""} onChange={(event) => onChange({ applicationScope: { ...structure.applicationScope, endFloorId: event.target.value } })}>{floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label>
            </>
          ) : null}
          {(structure.applicationScope?.mode ?? "RANGE") === "SELECTED" ? (
            <div className={styles.floorChecks}>
              {floors.map((floor) => {
                const selectedIds = structure.applicationScope?.floorIds ?? [];
                return <label key={floor.id} className={styles.check}><input type="checkbox" disabled={disabled} checked={selectedIds.includes(floor.id)} onChange={(event) => onChange({ applicationScope: { ...structure.applicationScope, floorIds: event.target.checked ? [...selectedIds, floor.id] : selectedIds.filter((id) => id !== floor.id) } })} /><span>{floor.name}</span></label>;
              })}
            </div>
          ) : null}
          <p>연결 층: {(structure.applicationScope?.connectedFloorIds ?? []).map((id) => floors.find((floor) => floor.id === id)?.name ?? id).join(", ") || "없음"}</p>
          {structure.type === "STAIR" ? stairSegments.map((segment) => (
            <p key={segment.id}>{floors.find((floor) => floor.id === segment.lowerFloorId)?.name} → {floors.find((floor) => floor.id === segment.upperFloorId)?.name}: {segment.riserCount}단 · 실제 단높이 {segment.actualRiserHeight.toFixed(3)}m · 진행 {segment.runLength.toFixed(2)}m</p>
          )) : null}
        </PropertySection>
      ) : null}

      <PropertySection title="재질" summary={materialPreset.label} defaultOpen>
        <MaterialAppearanceEditor
          appearance={structure.appearance}
          disabled={disabled}
          presetIds={appearancePresetIds}
          onChange={(appearance) => onChange({ appearance })}
        />
      </PropertySection>

      <PropertySection title="표시 및 잠금" summary={structure.locked ? "잠김" : "편집 가능"}>
        <label className={styles.check}><input type="checkbox" checked={structure.visible} onChange={(event) => onChange({ visible: event.target.checked })} /><span>표시</span></label>
        <label className={styles.check}><input type="checkbox" disabled={worldLocked} checked={structure.locked} onChange={(event) => onChange({ locked: event.target.checked })} /><span>개별 잠금</span></label>
      </PropertySection>
    </section>
  );
}
