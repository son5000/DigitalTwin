import { useMemo, useState } from "react";

import { ASSET_TYPES, EQUIPMENT_DISPLAY_MODES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import {
  EQUIPMENT_DISPLAY_OVERRIDES,
  EQUIPMENT_GLOBAL_DISPLAY_MODES,
  EQUIPMENT_REPRESENTATIONS,
  resolveEquipmentRepresentation,
} from "@/features/digitalTwin/editor/model/viewerPreset";
import EquipmentAssetViewer from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";
import { EQUIPMENT_SETUP_STEPS, getEquipmentSetup, updateEquipmentSetup } from "../model/equipmentSetup";
import SensorFramePreview from "./SensorFramePreview";

import styles from "./EquipmentDetailWorkspace.module.css";

const GLOBAL_MODE_LABELS = Object.freeze({ SIMPLIFIED: "간략 보기", REALISTIC: "현실 보기", AUTO: "자동 최적화", CUSTOM: "사용자 지정" });
const OVERRIDE_LABELS = Object.freeze({ AUTO: "전역 설정 사용", SIMPLIFIED: "간략 모델", DETAILED: "상세 모델", DISTANCE: "거리별 자동" });

export default function EquipmentDetailWorkspace({
  equipment, equipmentCount = 0, assetBindings = [], selectedAsset, overviewView, equipmentPicker,
  equipmentList = [], onSelectEquipment, sensorBindings = [], observationPoints = [],
  listOpen, onCloseList, onSetupStepChange, worldView, selectedSensor,
  viewerPreset, groundViewMode, transformTools, theme, onAddEquipment, onAlignmentChange,
  onViewerPresetChange, onEquipmentRepresentationChange,
}) {
  const [viewChoice, setViewChoice] = useState(null);
  const setup = getEquipmentSetup(equipment);
  const currentStepIndex = EQUIPMENT_SETUP_STEPS.findIndex((step) => step.id === setup.currentStep);
  const sensorStep = ["SENSOR", "POINT"].includes(setup.currentStep);
  const viewKey = `${equipment?.id}:${setup.currentStep}`;
  const viewMode = viewChoice?.key === viewKey ? viewChoice.mode : sensorStep ? "SENSORS" : "SELECTED";
  function setViewMode(mode) { setViewChoice({ key: viewKey, mode }); }
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const filteredEquipment = equipmentList.filter((item) => (!locationFilter || item.locationLabel === locationFilter)
    && `${item.name} ${item.locationLabel}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedIndex = equipmentList.findIndex((item) => item.id === equipment?.id);
  function selectEquipment(id) { setViewMode("SELECTED"); onSelectEquipment?.(id); }
  const renderableAsset = useMemo(() => {
    const selected = selectedAsset?.equipmentId === equipment?.id ? selectedAsset : null;
    if (selected && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(selected.assetType)) return selected;
    return assetBindings.filter((asset) => asset.equipmentId === equipment?.id && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(asset.assetType)).at(-1) ?? null;
  }, [assetBindings, equipment?.id, selectedAsset]);
  const representation = resolveEquipmentRepresentation({ preset: viewerPreset, equipmentId: equipment?.id, hasDetailedModel: Boolean(renderableAsset), selected: true, distance: 0 });
  const forcedDisplayMode = setup.currentStep === "ASSET" && renderableAsset ? renderableAsset.displayMode : representation === EQUIPMENT_REPRESENTATIONS.DETAILED
    ? renderableAsset?.assetType === ASSET_TYPES.PLY ? EQUIPMENT_DISPLAY_MODES.POINT_CLOUD : EQUIPMENT_DISPLAY_MODES.ACTUAL
    : EQUIPMENT_DISPLAY_MODES.PROXY;
  const globalMode = viewerPreset?.equipmentRepresentation?.globalMode ?? EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO;
  const equipmentOverride = viewerPreset?.equipmentRepresentation?.overrides?.[equipment?.id] ?? EQUIPMENT_DISPLAY_OVERRIDES.AUTO;
  const detailFocus = viewerPreset?.detailFocusEquipmentId === equipment?.id;
  if (!equipment) return <section className={`${styles.workspace} ${styles.emptyWorkspace}`} aria-label="설비 상세 시작 화면">{equipmentPicker}</section>;

  return (
    <section className={styles.workspace} aria-label="설비 상세 작업 화면">
      <nav className={styles.setupProgress} data-camera-safe-ui aria-label="설비 설정 진행 순서">
        <header><strong>{equipment.name}</strong><span>{currentStepIndex + 1} / 5 단계 · 완료 {setup.completed} · 건너뜀 {setup.skipped}</span></header>
        <div>{EQUIPMENT_SETUP_STEPS.map(({ id, label }, index) => <button type="button" key={id} aria-current={setup.currentStep === id ? "step" : undefined} onClick={() => onSetupStepChange?.(updateEquipmentSetup(equipment, id))}>{index + 1}. {label}<small>{setup.steps[id] === "DONE" ? "완료" : setup.steps[id] === "SKIPPED" ? "건너뜀" : setup.currentStep === id ? "진행 중" : "미완료"}</small></button>)}</div>
      </nav>
      {listOpen && <aside className={styles.equipmentList} data-camera-safe-ui="left" aria-label="월드 전체 설비 목록">
        <header><strong>전체 설비 {equipmentList.length}개</strong><button type="button" aria-label="설비 목록 닫기" onClick={onCloseList}>닫기</button></header>
        <input aria-label="상세 설정 설비 검색" placeholder="설비명·위치 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="설비 위치 필터" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">모든 위치</option>{[...new Set(equipmentList.map((item) => item.locationLabel))].map((location) => <option key={location}>{location}</option>)}</select>
        <div className={styles.equipmentNavigation}><button type="button" disabled={selectedIndex <= 0} onClick={() => selectEquipment(equipmentList[selectedIndex - 1].id)}>이전</button><span>{selectedIndex + 1} / {equipmentList.length}</span><button type="button" disabled={selectedIndex >= equipmentList.length - 1} onClick={() => selectEquipment(equipmentList[selectedIndex + 1].id)}>다음</button></div>
        <div className={styles.equipmentItems}>{filteredEquipment.map((item) => {
          const assets = assetBindings.filter((binding) => binding.equipmentId === item.id).length;
          const sensors = sensorBindings.filter((binding) => binding.equipmentIds?.includes(item.id)).length;
          const points = observationPoints.filter((point) => point.equipmentId === item.id).length;
          const progress = getEquipmentSetup(item);
          return <button key={item.id} type="button" aria-current={item.id === equipment.id ? "true" : undefined} onClick={() => selectEquipment(item.id)}><strong>{item.name}</strong><small>{item.locationLabel}</small><span>완료 {progress.completed}/5 · 건너뜀 {progress.skipped}</span><span>자산 {assets} · 센서 {sensors} · 포인트 {points}</span></button>;
        })}{!filteredEquipment.length && <p>검색 결과가 없습니다.</p>}</div>
      </aside>}
      <div className={styles.viewerMode} data-camera-safe-ui role="group" aria-label="설비 화면 맞춤">
        <label><span>표시 방식</span><select value={globalMode} onChange={(event) => onViewerPresetChange?.({ equipmentRepresentation: { globalMode: event.target.value } })}>{Object.entries(GLOBAL_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>현재 설비</span><select value={equipmentOverride} onChange={(event) => onEquipmentRepresentationChange?.(equipment.id, event.target.value)}>{Object.entries(OVERRIDE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" aria-pressed={viewMode === "SELECTED"} onClick={() => setViewMode("SELECTED")}>선택 설비 맞춤</button>
        <button type="button" aria-pressed={viewMode === "ALL"} disabled={equipmentCount < 2} onClick={() => setViewMode("ALL")}>전체 설비 맞춤</button>
        <button type="button" aria-pressed={viewMode === "SENSORS"} onClick={() => setViewMode("SENSORS")}>센서 배치 보기</button>
        <button type="button" aria-pressed={detailFocus} disabled={!renderableAsset || forcedDisplayMode === EQUIPMENT_DISPLAY_MODES.PROXY} onClick={() => { setViewMode("SELECTED"); onViewerPresetChange?.({ detailFocusEquipmentId: detailFocus ? null : equipment.id }); }}>{detailFocus ? "상세 보기 종료" : "상세 모델 확대"}</button>
        <button type="button" onClick={onAddEquipment}>설비 추가</button>
      </div>
      <div className={styles.viewer} aria-label="실제 설비 3D 뷰어">
        {viewMode === "SENSORS" && worldView ? worldView : viewMode === "ALL" && overviewView ? overviewView : <EquipmentAssetViewer equipment={equipment} binding={renderableAsset} forcedDisplayMode={forcedDisplayMode} focusDetail={detailFocus} groundViewMode={groundViewMode} transformTools={transformTools} theme={theme} onAlignmentChange={onAlignmentChange} />}
      </div>
      {sensorStep && selectedSensor?.equipmentIds?.includes(equipment.id) && <SensorFramePreview key={selectedSensor.id} sensor={selectedSensor} />}
      {equipmentPicker}
    </section>
  );
}
