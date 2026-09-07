import { useMemo, useState } from "react";

import { ASSET_TYPES, EQUIPMENT_DISPLAY_MODES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import {
  EQUIPMENT_DISPLAY_OVERRIDES,
  EQUIPMENT_GLOBAL_DISPLAY_MODES,
  EQUIPMENT_REPRESENTATIONS,
  resolveEquipmentRepresentation,
} from "@/features/digitalTwin/editor/model/viewerPreset";
import EquipmentAssetViewer from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";

import styles from "./EquipmentDetailWorkspace.module.css";

const GLOBAL_MODE_LABELS = Object.freeze({ SIMPLIFIED: "간략 보기", REALISTIC: "현실 보기", AUTO: "자동 최적화", CUSTOM: "사용자 지정" });
const OVERRIDE_LABELS = Object.freeze({ AUTO: "전역 설정 사용", SIMPLIFIED: "간략 모델", DETAILED: "상세 모델" });

export default function EquipmentDetailWorkspace({
  equipment, equipmentCount = 0, assetBindings = [], selectedAsset, overviewView, equipmentPicker,
  viewerPreset, groundViewMode, transformTools, theme, onAddEquipment, onAlignmentChange,
  onViewerPresetChange, onEquipmentRepresentationChange,
}) {
  const [viewMode, setViewMode] = useState("SELECTED");
  const renderableAsset = useMemo(() => {
    const selected = selectedAsset?.equipmentId === equipment?.id ? selectedAsset : null;
    if (selected && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(selected.assetType)) return selected;
    return assetBindings.filter((asset) => asset.equipmentId === equipment?.id && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(asset.assetType)).at(-1) ?? null;
  }, [assetBindings, equipment?.id, selectedAsset]);
  const representation = resolveEquipmentRepresentation({ preset: viewerPreset, equipmentId: equipment?.id, hasDetailedModel: Boolean(renderableAsset), selected: true });
  const forcedDisplayMode = representation === EQUIPMENT_REPRESENTATIONS.DETAILED
    ? renderableAsset?.assetType === ASSET_TYPES.PLY ? EQUIPMENT_DISPLAY_MODES.POINT_CLOUD : EQUIPMENT_DISPLAY_MODES.ACTUAL
    : EQUIPMENT_DISPLAY_MODES.PROXY;
  const globalMode = viewerPreset?.equipmentRepresentation?.globalMode ?? EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO;
  const equipmentOverride = viewerPreset?.equipmentRepresentation?.overrides?.[equipment?.id] ?? EQUIPMENT_DISPLAY_OVERRIDES.AUTO;
  const detailFocus = viewerPreset?.detailFocusEquipmentId === equipment?.id;
  if (!equipment) return <section className={`${styles.workspace} ${styles.emptyWorkspace}`} aria-label="설비 상세 시작 화면">{equipmentPicker}</section>;

  return (
    <section className={styles.workspace} aria-label="설비 상세 작업 화면">
      <div className={styles.viewerMode} data-camera-safe-ui role="group" aria-label="설비 화면 맞춤">
        <label><span>표시 방식</span><select value={globalMode} onChange={(event) => onViewerPresetChange?.({ equipmentRepresentation: { globalMode: event.target.value } })}>{Object.entries(GLOBAL_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>현재 설비</span><select value={equipmentOverride} onChange={(event) => onEquipmentRepresentationChange?.(equipment.id, event.target.value)}>{Object.entries(OVERRIDE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" aria-pressed={viewMode === "SELECTED"} onClick={() => setViewMode("SELECTED")}>선택 설비 맞춤</button>
        <button type="button" aria-pressed={viewMode === "ALL"} disabled={equipmentCount < 2} onClick={() => setViewMode("ALL")}>전체 설비 맞춤</button>
        <button type="button" aria-pressed={detailFocus} disabled={!renderableAsset || forcedDisplayMode === EQUIPMENT_DISPLAY_MODES.PROXY} onClick={() => { setViewMode("SELECTED"); onViewerPresetChange?.({ detailFocusEquipmentId: detailFocus ? null : equipment.id }); }}>{detailFocus ? "상세 보기 종료" : "상세 모델 확대"}</button>
        <button type="button" onClick={onAddEquipment}>설비 추가</button>
      </div>
      <div className={styles.viewer} aria-label="실제 설비 3D 뷰어">
        {viewMode === "ALL" && overviewView ? overviewView : <EquipmentAssetViewer equipment={equipment} binding={renderableAsset} forcedDisplayMode={forcedDisplayMode} focusDetail={detailFocus} groundViewMode={groundViewMode} transformTools={transformTools} theme={theme} onAlignmentChange={onAlignmentChange} />}
      </div>
      {equipmentPicker}
    </section>
  );
}
