import { cloneElement, useEffect, useState } from "react";



import { EQUIPMENT_SETUP_STEPS, getEquipmentSetup, updateEquipmentSetup } from "../model/equipmentSetup";
import SensorFramePreview from "./SensorFramePreview";

import styles from "./EquipmentDetailWorkspace.module.css";

export default function EquipmentDetailWorkspace({
  workspaceViewControllerRef, cameraController, equipment, assetBindings = [], equipmentPicker, singleEquipment = false,
  equipmentList = [], onSelectEquipment, sensorBindings = [], observationPoints = [],
  listOpen, onCloseList, onSetupStepChange, worldView, selectedSensor,
  onAddEquipment, onAlignmentChange, pointOptions,
}) {
  const [viewChoice, setViewChoice] = useState(null);
  const [cameraMemory] = useState(() => new Map());
  const [cameraResetVersion, setCameraResetVersion] = useState(0);
  const [comparisonSensorId, setComparisonSensorId] = useState(null);
  const setup = getEquipmentSetup(equipment);
  const sensorStep = setup.currentStep === "SENSOR";
  const [placingRoi, setPlacingRoi] = useState(false);
  const viewKey = equipment?.id;
  const viewMode = viewChoice && viewChoice.key === viewKey ? viewChoice.mode : "SELECTED";
  function setViewMode(mode, resetCamera = true) {
    setViewChoice({ key: viewKey, mode });
    if (resetCamera) setCameraResetVersion((value) => value + 1);
  }
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const filteredEquipment = equipmentList.filter((item) => (!locationFilter || item.locationLabel === locationFilter)
    && `${item.name} ${item.locationLabel}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedIndex = equipmentList.findIndex((item) => item.id === equipment?.id);
  function selectEquipment(id) { setViewMode("SELECTED"); onSelectEquipment?.(id); }
  useEffect(() => {
    if (!workspaceViewControllerRef) return;
    const controller = { setView: (mode) => { setViewChoice({ key: viewKey, mode }); setCameraResetVersion((value) => value + 1); }, addEquipment: onAddEquipment,
      setSensorView: (sensorId) => { setViewChoice({ key: viewKey, mode: "SENSORS" }); setComparisonSensorId(sensorId); },
      placeRoi: (type = "SPHERE") => setPlacingRoi({ type, equipmentId: viewKey }),
      placeHeatmap: (sensorId, onPick) => setPlacingRoi({ sensorId, onPick, equipmentId: viewKey }) };
    workspaceViewControllerRef.current = controller;
    return () => { if (workspaceViewControllerRef.current === controller) workspaceViewControllerRef.current = null; };
  }, [workspaceViewControllerRef, viewKey, onAddEquipment]);
  if (!equipment) return <section className={`${styles.workspace} ${styles.emptyWorkspace}`} aria-label="설비 상세 시작 화면">{equipmentPicker}</section>;

  return (
    <section className={`${styles.workspace} ${singleEquipment ? styles.singleEquipment : ""}`} aria-label="설비 상세 작업 화면">
      <nav className={styles.setupProgress} data-camera-safe-ui aria-label="설비 설정 진행 순서">
        <div>{EQUIPMENT_SETUP_STEPS.map(({ id, label }, index) => <button type="button" key={id} aria-current={setup.currentStep === id ? "step" : undefined} onClick={() => onSetupStepChange?.(updateEquipmentSetup(equipment, id))}><span>{index + 1}. {label}</span><small>{setup.steps[id] === "DONE" ? "완료" : setup.steps[id] === "SKIPPED" ? "건너뜀" : setup.currentStep === id ? "진행 중" : "미완료"}</small></button>)}</div>
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
          return <button key={item.id} type="button" aria-current={item.id === equipment.id ? "true" : undefined} onClick={() => selectEquipment(item.id)}><strong>{item.name}</strong><small>{item.locationLabel}</small><span>완료 {progress.completed}/5 · 건너뜀 {progress.skipped}</span><span>자산 {assets} · 센서 {sensors} · 관측 영역 {points}</span></button>;
        })}{!filteredEquipment.length && <p>검색 결과가 없습니다.</p>}</div>
      </aside>}
      <div className={styles.viewer} aria-label="실제 설비 3D 뷰어">
        {worldView && cloneElement(worldView, { cameraMemory, cameraResetVersion, cameraScope: "DETAIL", cameraController, onAlignmentChange,
          ...(viewMode === "ALL" ? { equipment: null, equipmentList } : {}), editorStage: setup.currentStep,
          sensorViewId: sensorStep && comparisonSensorId === selectedSensor?.id ? comparisonSensorId : null,
          pointOptions: { ...pointOptions,
            editing: setup.currentStep === "POINT" || Boolean(sensorStep && placingRoi?.onPick && placingRoi.sensorId === selectedSensor?.id && placingRoi.equipmentId === equipment.id),
            placing: Boolean(placingRoi && placingRoi.equipmentId === equipment.id && (placingRoi.onPick ? sensorStep && placingRoi.sensorId === selectedSensor?.id : setup.currentStep === "POINT")),
            placementLabel: placingRoi?.onPick ? "모델 표면을 클릭해 히트맵 샘플 위치를 지정하세요. 실측 데이터가 아닙니다." : undefined,
            onAdd: (id, position, normal) => placingRoi?.onPick ? placingRoi.onPick(position, normal) : pointOptions?.onAdd?.(id, position, { geometryType: placingRoi?.type, targetNormal: normal }),
            onPlaced: () => setPlacingRoi(false) },
        })}
      </div>
      {sensorStep && selectedSensor?.equipmentIds?.includes(equipment.id) && <SensorFramePreview key={`${selectedSensor.id}:${selectedSensor.serverSensorId}`} sensor={selectedSensor} sensorView={comparisonSensorId === selectedSensor.id} onSensorViewChange={(active) => { setViewChoice({ key: viewKey, mode: "SENSORS" }); setComparisonSensorId(active ? selectedSensor.id : null); }} />}
      {equipmentPicker}
    </section>
  );
}
