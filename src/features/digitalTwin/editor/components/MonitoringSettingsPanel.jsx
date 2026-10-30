import ObservationRoiFields from "./ObservationRoiFields";
import SensorProjectionFields from "./SensorProjectionFields";
import SensorMountFields from "./SensorMountFields";
import SensorAppearanceFields from "./SensorAppearanceFields";
import SensorHeatmapFields from "./SensorHeatmapFields";
import { flipSensorRotation } from "../three/sensorCamera";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  SENSOR_DEVICE_CAPABILITIES, getSensorCapabilities, sensorCapabilityLabel, sensorHasImaging, getSensorMarkerDiameter,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import { CloseIcon } from "@/components/icons";

import NumericField from "./NumericField";
import { EQUIPMENT_SETUP_STEPS, SETUP_REQUIREMENTS, getEquipmentSetup, updateEquipmentSetup, getSetupStepValidation } from "../model/equipmentSetup";
import styles from "./MonitoringSettingsPanel.module.css";
import SensorConnectionFields from "./SensorConnectionFields";
import EquipmentAssetFilesPanel from "./EquipmentAssetFilesPanel";
import EquipmentModelSetupPanel from "./EquipmentModelSetupPanel";

const STATUS_TEXT = { DONE: "완료", SKIPPED: "건너뜀", PENDING: "미완료" };


export default function MonitoringSettingsPanel({
  equipment, selectedEquipmentId, assetBindings, sensorBindings, observationPoints,
  selectedAsset: assetSelection, selectedPoint: pointSelection, selectedSensor: sensorSelection,
  onUpdateAsset,
  onSelectPoint, onUpdatePoint, onRemovePoint,
  onAddSensor, onSelectSensor, onUpdateSensor, onRemoveSensor,
  workspaceViewControllerRef, cameraController, onUpdateEquipment, onUploadAssetFiles, viewerPreset, onEquipmentRepresentationChange, onViewerPresetChange, uploadNotice, onClose,
}) {
  const [sensorCount, setSensorCount] = useState(1);
  const [sensorSection, setSensorSection] = useState("TEXTURE");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [sensorRemovalNotice, setSensorRemovalNotice] = useState("");
  const sensorSelectRef = useRef(null);
  const panelRef = useRef(null);
  const errorId = useId();
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId) ?? null;
  const scopedAssets = useMemo(() => assetBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [assetBindings, selectedEquipment?.id]);
  const scopedSensors = useMemo(() => sensorBindings.filter((item) => item.equipmentIds.includes(selectedEquipment?.id)), [selectedEquipment?.id, sensorBindings]);
  const scopedPoints = useMemo(() => observationPoints.filter((item) => item.equipmentId === selectedEquipment?.id), [observationPoints, selectedEquipment?.id]);

  useEffect(() => {
    if (!stepError || stepError.equipmentId !== selectedEquipment?.id
      || stepError.step !== getEquipmentSetup(selectedEquipment).currentStep
      || (stepError.sensorId && stepError.sensorId !== sensorSelection?.id)
      || (stepError.pointId && stepError.pointId !== pointSelection?.id)) return;
    const panel = panelRef.current;
    const target = [...panel.querySelectorAll("[data-setup-field]")].find((element) => element.dataset.setupField === stepError.target);
    if (!target) return;
    // Open every enclosing disclosure before measuring; never scroll the world.
    for (let parent = target; parent && parent !== panel; parent = parent.parentElement) {
      if (parent.tagName === "DETAILS") parent.open = true;
    }
    target.dataset.validationError = "true";
    const control = target.matches("input,select,button,textarea") ? target : target.querySelector("input:not(:disabled),select:not(:disabled),button:not(:disabled),textarea:not(:disabled),summary");
    const focus = control ?? target;
    if (!control) target.tabIndex = -1;
    focus.setAttribute("aria-invalid", "true"); focus.setAttribute("aria-describedby", errorId);
    const request = requestAnimationFrame(() => {
      const host = panel.closest("[data-editor-panel]");
      // Browser focus/automation can scroll overflow:hidden dock ancestors.
      // Reset only this inspector's wrappers before positioning its own scroller.
      for (let wrapper = panel.parentElement; wrapper && host?.contains(wrapper); wrapper = wrapper.parentElement) wrapper.scrollTop = 0;
      let scroll = target.parentElement;
      while (scroll && scroll !== panel && !/(auto|scroll)/.test(getComputedStyle(scroll).overflowY)) scroll = scroll.parentElement;
      scroll ??= panel;
      const offset = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      scroll.scrollTo({ top: scroll.scrollTop + offset - 64, behavior: "instant" });
      focus.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(request); delete target.dataset.validationError;
      focus.removeAttribute("aria-invalid"); focus.removeAttribute("aria-describedby");
    };
  }, [stepError, selectedEquipment, sensorSelection?.id, pointSelection?.id, sensorSection, errorId]);

  if (!selectedEquipment) return <section className={styles.panel}><div className={styles.emptyState}><strong>관측 설비를 등록하세요</strong><p>상단 ‘설비 추가’에서 카탈로그 설비를 선택하거나 OBJ·PLY 파일을 직접 등록할 수 있습니다.</p></div></section>;
  const selectedAsset = scopedAssets.find((item) => item.id === assetSelection?.id);
  const modelAsset = ["OBJ", "PLY"].includes(selectedAsset?.assetType) ? selectedAsset : scopedAssets.filter((item) => ["OBJ", "PLY"].includes(item.assetType)).at(-1);
  const selectedSensor = scopedSensors.find((item) => item.id === sensorSelection?.id);
  const selectedPoint = scopedPoints.find((item) => item.id === pointSelection?.id);
  const setup = getEquipmentSetup(selectedEquipment);
  const tab = setup.currentStep;
  const stepIndex = EQUIPMENT_SETUP_STEPS.findIndex((step) => step.id === tab);
  const step = EQUIPMENT_SETUP_STEPS[stepIndex];
  function setStep(id, status) {
    const issue = status === "DONE" ? getSetupStepValidation(id, { equipment: selectedEquipment, assets: scopedAssets, sensors: scopedSensors, points: scopedPoints }) : null;
    setStepError(issue ? { ...issue, equipmentId: selectedEquipment.id } : null);
    if (issue) {
      if (issue.sensorId) onSelectSensor(issue.sensorId);
      if (issue.pointId) onSelectPoint(issue.pointId);
      if (issue.section) setSensorSection(issue.section);
      if (issue.step !== tab) onUpdateEquipment?.({ metadata: { detailSetup: updateEquipmentSetup(selectedEquipment, issue.step) } });
      return;
    }
    onUpdateEquipment?.({ metadata: { detailSetup: updateEquipmentSetup(selectedEquipment, id, status) } });
  }
  function uploadPhoto(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setPhotoError("JPG·PNG·WebP, 2MB 이하 사진을 선택하세요."); return; }
    setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => onUpdateEquipment?.({ metadata: { representativeImage: reader.result } });
    reader.onerror = () => setPhotoError("사진을 읽지 못했습니다.");
    reader.readAsDataURL(file);
  }

  async function uploadFile(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.target.value = "";
    setUploading(true);
    try { await onUploadAssetFiles?.(selectedEquipment.id, files); } finally { setUploading(false); }
  }

  return <section ref={panelRef} className={styles.panel} onChangeCapture={() => setStepError(null)}>
    <header>
      <div className={styles.panelHeading}><span>{stepIndex + 1} / 5 단계 · 완료 {setup.completed} · 건너뜀 {setup.skipped}</span><h2>{selectedEquipment.name}</h2></div>
      {onClose && <button type="button" className={styles.panelClose} aria-label="설비 상세 닫기" onClick={onClose}><CloseIcon size={18} /></button>}
      <progress aria-label="설비 설정 완료 단계" value={setup.completed} max={5} />
    </header>
    <label className={styles.stepPicker}>
      <span>설정 단계</span>
      <select value={tab} onChange={(event) => setStep(event.target.value)}>
        {EQUIPMENT_SETUP_STEPS.map(({ id, label }, index) => <option key={id} value={id}>{index + 1}. {label} · {STATUS_TEXT[setup.steps[id]]}</option>)}
      </select>
    </label>
    <div className={styles.stepBody} key={tab}>
    <p className={styles.stepDescription} data-setup-field="step-start">{step.description}</p>
    <p className={styles.requirements}>{SETUP_REQUIREMENTS[tab]}</p>

    {tab === "BASIC" ? <div className={styles.content}>
      <div data-setup-field="model-files"><EquipmentAssetFilesPanel key={[modelAsset?.id, modelAsset?.assetId, modelAsset?.relatedSourceKey, modelAsset?.textureSourceKey].join(":")} binding={modelAsset} onUpdateAsset={onUpdateAsset} onUpload={uploadFile} uploading={uploading} uploadNotice={uploadNotice} /></div>
      <fieldset className={styles.settingsGroup}><legend>설비 기본 정보</legend>
      {[["name", "설비명"], ["model", "모델명"], ["manufacturer", "제조사"], ["serialNumber", "일련번호"], ["assetTag", "자산 번호"]].map(([key, label]) => <label className={styles.field} key={key} data-setup-field={key === "name" ? "equipment-name" : undefined}><span>{label}{key === "name" ? " · 필수" : ""}</span><input required={key === "name"} value={key === "name" ? selectedEquipment.name : selectedEquipment.metadata?.[key] ?? ""} onChange={(event) => onUpdateEquipment?.(key === "name" ? { name: event.target.value } : { metadata: { [key]: event.target.value } })} /></label>)}
      <label className={styles.field}><span>설비 설명</span><textarea value={selectedEquipment.metadata?.description ?? ""} onChange={(event) => onUpdateEquipment?.({ metadata: { description: event.target.value } })} /></label>
      <label className={styles.uploadButton}>대표 사진 등록 (2MB 이하)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} /></label>
      {photoError && <p role="alert">{photoError}</p>}
      {selectedEquipment.metadata?.representativeImage && <div className={styles.photo}><img src={selectedEquipment.metadata.representativeImage} alt={`${selectedEquipment.name} 대표 사진`} /><button type="button" onClick={() => onUpdateEquipment?.({ metadata: { representativeImage: null } })}>사진 제거</button></div>}
      <dl className={styles.summary}><div><dt>설비 ID</dt><dd>{selectedEquipment.id}</dd></div><div><dt>템플릿</dt><dd>{UNIFIED_EQUIPMENT_TEMPLATE_MAP[selectedEquipment.shapeTemplateId]?.nameKo ?? selectedEquipment.shapeTemplateId}</dd></div><div><dt>층</dt><dd>{selectedEquipment.floorId}</dd></div><div><dt>연결 현황</dt><dd>자산 {scopedAssets.length} · 센서 {scopedSensors.length} · 관측 영역 {scopedPoints.length}</dd></div></dl>
      </fieldset>


    </div> : null}

    {tab === "ASSET" ? <div className={styles.content}><EquipmentModelSetupPanel workspaceViewControllerRef={workspaceViewControllerRef} equipmentCount={equipment.length} equipment={selectedEquipment} binding={modelAsset} onUpdateEquipment={onUpdateEquipment} onUpdateAsset={onUpdateAsset} viewerPreset={viewerPreset} onViewerPresetChange={onViewerPresetChange} onEquipmentRepresentationChange={onEquipmentRepresentationChange} cameraController={cameraController} /></div> : null}

    {tab === "REVIEW" ? <div className={styles.content}>
      <div className={styles.review}>{EQUIPMENT_SETUP_STEPS.slice(0, -1).map(({ id, label }) => <button type="button" key={id} onClick={() => setStep(id)}>{label} · {STATUS_TEXT[setup.steps[id]]} →</button>)}</div>
      <p className={styles.help}>연결 정보를 확인하세요. 설정을 완료한 뒤 실제 측정값이 들어오는지도 확인해야 합니다.</p>
      <dl className={styles.summary}><div><dt>센서</dt><dd>{scopedSensors.length}개 · 서버 식별 완료 {scopedSensors.filter((sensor) => sensor.serverSensorId).length}개</dd></div><div><dt>관측 영역</dt><dd>{scopedPoints.length}개 · 표시 항목 {scopedPoints.reduce((n, point) => n + point.measurements.filter((item) => item.visible).length, 0)}개</dd></div></dl>
    </div> : null}

    {tab === "SENSOR" ? <div className={styles.content}>
      <label className={styles.field}><span>편집할 센서 · {scopedSensors.length}개</span><select ref={sensorSelectRef} value={selectedSensor?.id ?? ""} onChange={(event) => { onSelectSensor(event.target.value); setSensorRemovalNotice(""); }}><option value="" disabled>센서를 선택하세요</option>{scopedSensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.name} · {sensorCapabilityLabel(sensor)}</option>)}</select></label>
      {selectedSensor && onRemoveSensor && <button type="button" className={styles.sensorRemoveAction} onClick={() => {
        if (!window.confirm(`‘${selectedSensor.name}’ 센서를 프로젝트에서 제거하시겠습니까?\n월드 표시와 이 센서의 데이터 연결이 제거됩니다.\nROI 영역·측정 항목·임계치는 유지되며, 다른 센서를 다시 연결할 수 있습니다.\n서버에 등록된 센서 원본은 삭제하지 않습니다.`)) return;
        onRemoveSensor(selectedSensor.id);
        onSelectSensor(scopedSensors.find((sensor) => sensor.id !== selectedSensor.id)?.id ?? null);
        setStepError(null);
        setSensorRemovalNotice(`‘${selectedSensor.name}’ 센서를 제거했습니다. 변경 사항은 프로젝트를 저장해 보관하세요.`);
        sensorSelectRef.current?.focus();
      }}>선택 센서 제거</button>}
      {sensorRemovalNotice && <p className={styles.help} role="status">{sensorRemovalNotice}</p>}
      <details className={styles.settingsGroup} data-setup-field="sensor-add" open={scopedSensors.length === 0 ? true : undefined}><summary>센서 추가</summary>
        <NumericField displayPrecision={0} label="추가할 센서 수" min={1} step={1} value={sensorCount} onChange={(value) => setSensorCount(Math.max(1, Math.min(50, Math.floor(value))))} />
        <div className={styles.actionRow}><button type="button" onClick={() => { onAddSensor(selectedEquipment.id, "SENSOR", sensorCount); setSensorSection("CONNECTION"); }}>일반 센서 추가</button><button type="button" className={styles.primaryAction} onClick={() => { onAddSensor(selectedEquipment.id, "CAMERA", sensorCount); setSensorSection("TEXTURE"); }}>비전카메라 추가</button></div>
      </details>
      {selectedSensor && <>
        <nav className={styles.sensorNavigation} aria-label="센서 설정 항목">
          {[["CONNECTION", "센서 연결"], ["PLACEMENT", "설치 위치"], ["TEXTURE", "이미지·텍스처"], ...(getSensorCapabilities(selectedSensor).includes("ULTRASONIC") ? [["HEATMAP", "소음 히트맵"]] : [])].map(([value, label]) => <button type="button" key={value} aria-pressed={sensorSection === value} onClick={() => setSensorSection(value)}>{label}</button>)}
        </nav>
        {sensorSection === "CONNECTION" && <fieldset className={styles.settingsGroup}><legend>센서 정보·서버 연결</legend>
          <label className={styles.field} data-setup-field="sensor-name"><span>센서 이름 · 필수</span><input required value={selectedSensor.name} onChange={(event) => onUpdateSensor(selectedSensor.id, { name: event.target.value })} /></label>
          <SensorConnectionFields key={selectedSensor.id} section="connection" sensor={selectedSensor} equipment={selectedEquipment} sensors={sensorBindings} assets={scopedAssets} onChange={onUpdateSensor} />
          <details className={styles.transformDetails}><summary>측정 기능 · 복수 선택</summary><div className={styles.checkGrid}>{Object.entries(SENSOR_DEVICE_CAPABILITIES).map(([key, label]) => <label className={styles.check} key={key}><input type="checkbox" checked={getSensorCapabilities(selectedSensor).includes(key)} onChange={(event) => {
            const capabilities = getSensorCapabilities(selectedSensor);
            const thermalAdded = key === "THERMAL" && event.target.checked;
            onUpdateSensor(selectedSensor.id, { capabilities: event.target.checked ? [...capabilities, key] : capabilities.filter((value) => value !== key),
              ...(thermalAdded && !sensorHasImaging(selectedSensor) && selectedSensor.appearance === "BOX_SENSOR" ? { appearance: "BULLET_CAMERA" } : {}),
              ...(thermalAdded && !capabilities.includes("VISION") ? { textureProjection: { ...selectedSensor.textureProjection, kind: "THERMAL" } } : {}) });
          }} />{label}</label>)}</div><p className={styles.help}>게이지·스위치 감지는 4단계에서 관측 영역별로 지정하세요.</p></details>
        </fieldset>}
        {sensorSection === "PLACEMENT" && <fieldset className={styles.settingsGroup}><legend>월드의 센서 설치 위치</legend>
          <SensorAppearanceFields sensor={selectedSensor} onChange={onUpdateSensor} />
          <p className={styles.help}>실제 설치 위치와 방향을 표시합니다. 비전 이미지의 크기·회전·적용면에는 영향을 주지 않습니다.</p>
          <SensorMountFields equipment={selectedEquipment} sensor={selectedSensor} onChange={onUpdateSensor} />
          <fieldset className={styles.settingsGroup}><legend>설치 방향</legend>
            <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={3} key={axis} label={`${axis.toUpperCase()}축 회전`} unit="°" step={.1} value={(selectedSensor.rotation?.[axis] ?? 0) * 180 / Math.PI} onChange={(value) => onUpdateSensor(selectedSensor.id, { rotation: { [axis]: value * Math.PI / 180 } })} />)}</div>
            <div className={styles.actionRow}><button type="button" onClick={() => onUpdateSensor(selectedSensor.id, { rotation: flipSensorRotation(selectedSensor.rotation) })}>정면·후면 뒤집기</button><button type="button" onClick={() => onUpdateSensor(selectedSensor.id, { rotation: { x: 0, y: 0, z: 0 } })}>방향 초기화</button></div>
          </fieldset>
          <NumericField displayPrecision={1} label="모형 표시 크기 · 가장 긴 변" unit="cm" min={0.5} step={0.5} value={getSensorMarkerDiameter(selectedSensor) * 100} onChange={(value) => onUpdateSensor(selectedSensor.id, { markerDiameter: Math.max(0.005, Math.min(2, value / 100)) })} />
          <details className={styles.transformDetails} data-setup-field="sensor-optics"><summary>장치 화각·설치 보정값 · 확인 필수</summary>
            {sensorHasImaging(selectedSensor) && <div className={styles.rangeGrid}><NumericField displayPrecision={2} label="화각" value={selectedSensor.fieldOfView} min={10} unit="°" onChange={(fieldOfView) => onUpdateSensor(selectedSensor.id, { fieldOfView })} /><NumericField displayPrecision={2} label="종횡비" value={selectedSensor.aspectRatio} min={0.2} onChange={(aspectRatio) => onUpdateSensor(selectedSensor.id, { aspectRatio })} /><NumericField displayPrecision={2} label="근거리" value={selectedSensor.near} min={0.01} unit="m" onChange={(near) => onUpdateSensor(selectedSensor.id, { near })} /><NumericField displayPrecision={2} label="관측 거리" value={selectedSensor.far} min={0.1} unit="m" onChange={(far) => onUpdateSensor(selectedSensor.id, { far })} /></div>}
            <SensorConnectionFields key={selectedSensor.id} section="calibration" sensor={selectedSensor} equipment={selectedEquipment} sensors={sensorBindings} assets={scopedAssets} onChange={onUpdateSensor} />
          </details>
        </fieldset>}
        {sensorSection === "HEATMAP" && (getSensorCapabilities(selectedSensor).includes("ULTRASONIC") ? <SensorHeatmapFields key={selectedSensor.id} sensor={selectedSensor} equipment={selectedEquipment} onChange={onUpdateSensor} controller={workspaceViewControllerRef} /> : <p className={styles.help}>센서 연결에서 초음파 기능을 선택하세요.</p>)}
        {sensorSection === "TEXTURE" && (sensorHasImaging(selectedSensor)
          ? <SensorProjectionFields key={selectedSensor.id} sensor={selectedSensor} equipment={selectedEquipment} assets={scopedAssets} onChange={onUpdateSensor} cameraController={cameraController} workspaceController={workspaceViewControllerRef} />
          : <p className={styles.help}>센서 연결에서 비전 또는 열화상 기능을 선택하면 이미지·텍스처를 설정할 수 있습니다.</p>)}
      </>}
    </div> : null}


    {tab === "POINT" && <ObservationRoiFields equipment={selectedEquipment} points={scopedPoints} selectedPoint={selectedPoint} sensors={scopedSensors} onSelect={onSelectPoint} onChange={onUpdatePoint} onRemove={onRemovePoint} onPlace={(type) => workspaceViewControllerRef?.current?.placeRoi(type)} />}

    </div>
    <footer className={styles.stepFooter}>
      {stepError?.equipmentId === selectedEquipment.id && stepError.step === tab && <p id={errorId} role="alert">{stepError.message}</p>}
      <div><button type="button" disabled={stepIndex === 0} onClick={() => setStep(EQUIPMENT_SETUP_STEPS[stepIndex - 1].id)}>이전</button><button type="button" onClick={() => setStep(tab, "SKIPPED")}>건너뛰기</button><button type="button" onClick={() => setStep(tab, "PENDING")}>다시 편집</button><button type="button" disabled={uploading} onClick={() => setStep(tab, "DONE")}>{stepIndex === 4 ? "검토 완료" : "완료 후 다음"}</button></div>
      <small>입력 후 프로젝트를 저장해 보관하세요.</small>
    </footer>
  </section>;
}
