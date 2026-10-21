import ObservationRoiFields from "./ObservationRoiFields";
import SensorProjectionFields from "./SensorProjectionFields";
import SensorMountFields from "./SensorMountFields";
import { flipSensorRotation } from "../three/sensorCamera";
import { useMemo, useState } from "react";

import {
  SENSOR_CAPABILITIES, getSensorCapabilities, sensorCapabilityLabel, sensorHasImaging, getSensorMarkerDiameter, ASSET_SOURCE_TYPES, ASSET_TYPES, ASSET_USAGE_TYPES,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";

import NumericField from "./NumericField";
import { EQUIPMENT_SETUP_STEPS, getEquipmentSetup, updateEquipmentSetup, getSetupStepIssue } from "../model/equipmentSetup";
import styles from "./MonitoringSettingsPanel.module.css";
import SensorConnectionFields from "./SensorConnectionFields";
import EquipmentAssetFilesPanel from "./EquipmentAssetFilesPanel";
import EquipmentModelSetupPanel from "./EquipmentModelSetupPanel";

const STATUS_TEXT = { DONE: "완료", SKIPPED: "건너뜀", PENDING: "미완료" };

const PROTOCOLS = ["MQTT", "HTTP", "WEBSOCKET", "RTSP", "MANUAL"];
const ASSET_USAGE_LABELS = Object.freeze({ MODEL: "실제 모델", POINT_CLOUD: "포인트클라우드", REFERENCE_IMAGE: "참조 이미지", TEXTURE: "텍스처", CAMERA_FRAME: "카메라 관측 이미지" });
const STATUS_LABELS = Object.freeze({ READY: "준비됨", PENDING: "대기 중", LOADING: "불러오는 중", ERROR: "오류", MISSING: "파일 없음" });
const METRIC_LABELS = Object.freeze({ TEMPERATURE: "온도", PRESSURE: "압력", VIBRATION: "진동", NOISE: "소음", POWER: "전력", FLOW: "유량", VIDEO: "영상" });
const PROTOCOL_LABELS = Object.freeze({ MQTT: "MQTT", HTTP: "HTTP", WEBSOCKET: "웹소켓", RTSP: "RTSP", MANUAL: "수동 입력" });

function VectorFields({ label, value, onChange, step = 0.01 }) {
  return <div className={styles.vectorGroup}><strong>{label}</strong><div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={axis.toUpperCase()} value={value?.[axis] ?? 0} step={step} onChange={(next) => onChange({ [axis]: next })} />)}</div></div>;
}

export default function MonitoringSettingsPanel({
  equipment, selectedEquipmentId, assetBindings, sensorBindings, observationPoints, serverBindings,
  selectedAsset: assetSelection, selectedPoint: pointSelection, selectedSensor: sensorSelection, selectedServer: serverSelection,
  onAddAsset, onSelectAsset, onUpdateAsset,
  onSelectPoint, onUpdatePoint, onRemovePoint,
  onAddSensor, onSelectSensor, onUpdateSensor,
  onAddServer, onSelectServer, onUpdateServer,
  workspaceViewControllerRef, cameraController, onUpdateEquipment, onUploadAssetFiles, viewerPreset, onEquipmentRepresentationChange, onViewerPresetChange, uploadNotice,
}) {
  const [sensorCount, setSensorCount] = useState(1);
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stepError, setStepError] = useState("");
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId) ?? null;
  const scopedAssets = useMemo(() => assetBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [assetBindings, selectedEquipment?.id]);
  const scopedSensors = useMemo(() => sensorBindings.filter((item) => item.equipmentIds.includes(selectedEquipment?.id)), [selectedEquipment?.id, sensorBindings]);
  const scopedPoints = useMemo(() => observationPoints.filter((item) => item.equipmentId === selectedEquipment?.id), [observationPoints, selectedEquipment?.id]);
  const scopedServers = useMemo(() => serverBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [selectedEquipment?.id, serverBindings]);

  if (!selectedEquipment) return <section className={styles.panel}><div className={styles.emptyState}><strong>관측 설비를 등록하세요</strong><p>상단 ‘설비 추가’에서 카탈로그 설비를 선택하거나 OBJ·PLY 파일을 직접 등록할 수 있습니다.</p></div></section>;
  const selectedAsset = scopedAssets.find((item) => item.id === assetSelection?.id);
  const modelAsset = ["OBJ", "PLY"].includes(selectedAsset?.assetType) ? selectedAsset : scopedAssets.filter((item) => ["OBJ", "PLY"].includes(item.assetType)).at(-1);
  const selectedSensor = scopedSensors.find((item) => item.id === sensorSelection?.id);
  const selectedPoint = scopedPoints.find((item) => item.id === pointSelection?.id);
  const selectedServer = scopedServers.find((item) => item.id === serverSelection?.id);
  const setup = getEquipmentSetup(selectedEquipment);
  const tab = setup.currentStep;
  const stepIndex = EQUIPMENT_SETUP_STEPS.findIndex((step) => step.id === tab);
  const step = EQUIPMENT_SETUP_STEPS[stepIndex];
  function setStep(id, status) {
    const issue = status === "DONE" ? getSetupStepIssue(id, { equipment: selectedEquipment, assets: scopedAssets, sensors: scopedSensors, points: scopedPoints }) : "";
    setStepError(issue);
    if (!issue) onUpdateEquipment?.({ metadata: { detailSetup: updateEquipmentSetup(selectedEquipment, id, status) } });
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

  return <section className={styles.panel}>
    <header><span>{stepIndex + 1} / 5 단계 · 완료 {setup.completed} · 건너뜀 {setup.skipped}</span><h2>{selectedEquipment.name}</h2><progress aria-label="설비 설정 완료 단계" value={setup.completed} max={5} /></header>
    <label className={styles.stepPicker}>
      <span>설정 단계</span>
      <select value={tab} onChange={(event) => setStep(event.target.value)}>
        {EQUIPMENT_SETUP_STEPS.map(({ id, label }, index) => <option key={id} value={id}>{index + 1}. {label} · {STATUS_TEXT[setup.steps[id]]}</option>)}
      </select>
    </label>
    <div className={styles.stepBody} key={tab}>
    <p className={styles.stepDescription}>{step.description}</p>

    {tab === "BASIC" ? <div className={styles.content}>
      <EquipmentAssetFilesPanel key={[modelAsset?.id, modelAsset?.assetId, modelAsset?.relatedSourceKey, modelAsset?.textureSourceKey].join(":")} binding={modelAsset} onUpdateAsset={onUpdateAsset} onUpload={uploadFile} uploading={uploading} uploadNotice={uploadNotice} />
      <fieldset className={styles.settingsGroup}><legend>설비 기본 정보</legend>
      {[["name", "설비명"], ["model", "모델명"], ["manufacturer", "제조사"], ["serialNumber", "일련번호"], ["assetTag", "자산 번호"]].map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input value={key === "name" ? selectedEquipment.name : selectedEquipment.metadata?.[key] ?? ""} onChange={(event) => onUpdateEquipment?.(key === "name" ? { name: event.target.value } : { metadata: { [key]: event.target.value } })} /></label>)}
      <label className={styles.field}><span>설비 설명</span><textarea value={selectedEquipment.metadata?.description ?? ""} onChange={(event) => onUpdateEquipment?.({ metadata: { description: event.target.value } })} /></label>
      <label className={styles.uploadButton}>대표 사진 등록 (2MB 이하)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} /></label>
      {photoError && <p role="alert">{photoError}</p>}
      {selectedEquipment.metadata?.representativeImage && <div className={styles.photo}><img src={selectedEquipment.metadata.representativeImage} alt={`${selectedEquipment.name} 대표 사진`} /><button type="button" onClick={() => onUpdateEquipment?.({ metadata: { representativeImage: null } })}>사진 제거</button></div>}
      <dl className={styles.summary}><div><dt>설비 ID</dt><dd>{selectedEquipment.id}</dd></div><div><dt>템플릿</dt><dd>{UNIFIED_EQUIPMENT_TEMPLATE_MAP[selectedEquipment.shapeTemplateId]?.nameKo ?? selectedEquipment.shapeTemplateId}</dd></div><div><dt>층</dt><dd>{selectedEquipment.floorId}</dd></div><div><dt>연결 현황</dt><dd>자산 {scopedAssets.length} · 센서 {scopedSensors.length} · 관측 영역 {scopedPoints.length}</dd></div></dl>
      </fieldset>
      <details className={styles.settingsGroup}><summary>설비 식별·좌표 정보</summary>
      <label className={styles.field}><span>현실 좌표계</span><select value={selectedEquipment.metadata?.coordinateSystem ?? "LOCAL_METERS"} onChange={(event) => onUpdateEquipment?.({ metadata: { coordinateSystem: event.target.value } })}><option value="LOCAL_METERS">로컬 미터 좌표</option><option value="SITE_METERS">부지 기준 미터 좌표</option><option value="CUSTOM">사용자 정의 좌표</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={selectedEquipment.showNameLabel === true} onChange={(event) => onUpdateEquipment?.({ showNameLabel: event.target.checked })} /><span>이름표 표시</span></label>
      <VectorFields label="현실세계 기준 위치 (m)" value={selectedEquipment.position} onChange={(position) => onUpdateEquipment?.({ position })} />
      <p className={styles.help}>스캔 모델의 위치와 크기를 맞춰도 설비의 배치 기준은 유지됩니다.</p>
      </details>
      <details className={styles.settingsGroup}><summary>고급 파일 연결·서버 자산</summary>
      <button type="button" onClick={() => onAddAsset(selectedEquipment.id, { name: "서버 자산", sourceType: ASSET_SOURCE_TYPES.SERVER_KEY, sourceKey: "asset/cabinet/latest", assetType: ASSET_TYPES.OBJ, usageType: ASSET_USAGE_TYPES.MODEL, status: "PENDING" })}>서버 자산 추가</button>
      <div className={styles.itemList}>{scopedAssets.map((asset) => <button type="button" key={asset.id} aria-pressed={selectedAsset?.id === asset.id} onClick={() => onSelectAsset(asset.id)}><span>{asset.name}</span><small>{asset.assetType} · {ASSET_USAGE_LABELS[asset.usageType] ?? asset.usageType} · {STATUS_LABELS[asset.status] ?? asset.status}</small></button>)}</div>
      {selectedAsset ? <><label className={styles.field}><span>사용 용도</span><select value={selectedAsset.usageType} onChange={(event) => onUpdateAsset(selectedAsset.id, { usageType: event.target.value })}>{Object.values(ASSET_USAGE_TYPES).map((value) => <option key={value} value={value}>{ASSET_USAGE_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>소스 키 / 주소</span><input value={selectedAsset.sourceKey} onChange={(event) => onUpdateAsset(selectedAsset.id, { sourceKey: event.target.value })} /></label></> : <p className={styles.help}>연결된 자산을 선택하세요.</p>}
      </details>
    </div> : null}

    {tab === "ASSET" ? <div className={styles.content}><EquipmentModelSetupPanel workspaceViewControllerRef={workspaceViewControllerRef} equipmentCount={equipment.length} equipment={selectedEquipment} binding={modelAsset} onUpdateEquipment={onUpdateEquipment} onUpdateAsset={onUpdateAsset} viewerPreset={viewerPreset} onViewerPresetChange={onViewerPresetChange} onEquipmentRepresentationChange={onEquipmentRepresentationChange} cameraController={cameraController} /></div> : null}

    {tab === "REVIEW" ? <div className={styles.content}>
      <div className={styles.review}>{EQUIPMENT_SETUP_STEPS.slice(0, -1).map(({ id, label }) => <button type="button" key={id} onClick={() => setStep(id)}>{label} · {STATUS_TEXT[setup.steps[id]]} →</button>)}</div>
      <p className={styles.help}>연결 정보를 확인하세요. 설정을 완료한 뒤 실제 측정값이 들어오는지도 확인해야 합니다.</p>
      <dl className={styles.summary}><div><dt>센서</dt><dd>{scopedSensors.length}개 · 서버 식별 완료 {scopedSensors.filter((sensor) => sensor.serverSensorId).length}개</dd></div><div><dt>관측 영역</dt><dd>{scopedPoints.length}개 · 표시 항목 {scopedPoints.reduce((n, point) => n + point.measurements.filter((item) => item.visible).length, 0)}개</dd></div></dl>
    </div> : null}

    {tab === "SENSOR" ? <div className={styles.content}>
      <div className={styles.rangeGrid}><NumericField displayPrecision={0} label="추가할 센서 수" min={1} step={1} value={sensorCount} onChange={(value) => setSensorCount(Math.max(1, Math.min(50, Math.floor(value))))} /></div><button type="button" className={styles.primaryAction} onClick={() => onAddSensor(selectedEquipment.id, "SENSOR", sensorCount)}>센서 {sensorCount}개 추가</button>
      <div className={styles.itemList}>{scopedSensors.map((sensor) => <button type="button" key={sensor.id} aria-pressed={selectedSensor?.id === sensor.id} onClick={() => onSelectSensor(sensor.id)}><span>{sensor.name}</span><small>{sensorCapabilityLabel(sensor)} · {sensor.serverKey || "키 미지정"}</small></button>)}</div>
      <p className={styles.help}>센서 이미지와 3D 모델을 비교하며 위치와 촬영 방향을 맞추세요.</p>
      {selectedSensor && <>
        <div className={styles.rangeGrid}><NumericField displayPrecision={1} label="센서 표시 지름" unit="cm" min={0.5} step={0.5} value={getSensorMarkerDiameter(selectedSensor) * 100} onChange={(value) => onUpdateSensor(selectedSensor.id, { markerDiameter: Math.max(0.005, Math.min(2, value / 100)) })} /></div>
        <p className={styles.help}>화면에 보이는 센서 표시 크기만 조절합니다.</p>
        <SensorConnectionFields key={selectedSensor.id} sensor={selectedSensor} equipment={selectedEquipment} sensors={sensorBindings} assets={scopedAssets} onChange={onUpdateSensor} />
        <fieldset className={styles.settingsGroup}><legend>센서 기능 · 복수 선택</legend><div className={styles.checkGrid}>{Object.entries(SENSOR_CAPABILITIES).map(([key, label]) => <label className={styles.check} key={key}><input type="checkbox" checked={getSensorCapabilities(selectedSensor).includes(key)} onChange={(event) => onUpdateSensor(selectedSensor.id, { capabilities: event.target.checked ? [...getSensorCapabilities(selectedSensor), key] : getSensorCapabilities(selectedSensor).filter((value) => value !== key) })} />{label}</label>)}</div><p className={styles.help}>이 센서로 측정할 항목을 모두 선택하세요.</p></fieldset>
        <label className={styles.field}><span>스틸컷 이미지 URL</span><input type="url" placeholder="https://…/latest.jpg" value={selectedSensor.frameUrl ?? ""} onChange={(event) => onUpdateSensor(selectedSensor.id, { frameUrl: event.target.value })} /></label>
      </>}
      {selectedSensor ? <><label className={styles.field}><span>이름</span><input value={selectedSensor.name} onChange={(event) => onUpdateSensor(selectedSensor.id, { name: event.target.value })} /></label><SensorMountFields equipment={selectedEquipment} sensor={selectedSensor} onChange={onUpdateSensor} /><fieldset className={styles.settingsGroup}><legend>센서 정면·바라보는 방향</legend><p className={styles.help}>청록색 화살표가 촬영 방향입니다. 회전 도구나 각도로 조절하세요.</p><div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={1} key={axis} label={`${axis.toUpperCase()}축 회전`} unit="°" step={1} value={(selectedSensor.rotation?.[axis] ?? 0) * 180 / Math.PI} onChange={(value) => onUpdateSensor(selectedSensor.id, { rotation: { [axis]: value * Math.PI / 180 } })} />)}</div><div className={styles.actionRow}><button type="button" onClick={() => onUpdateSensor(selectedSensor.id, { rotation: flipSensorRotation(selectedSensor.rotation) })}>정면·후면 뒤집기</button><button type="button" onClick={() => onUpdateSensor(selectedSensor.id, { rotation: { x: 0, y: 0, z: 0 } })}>방향 초기화</button></div></fieldset>{sensorHasImaging(selectedSensor) ? <div className={styles.rangeGrid}><NumericField displayPrecision={2} label="화각" value={selectedSensor.fieldOfView} min={10} unit="°" onChange={(fieldOfView) => onUpdateSensor(selectedSensor.id, { fieldOfView })} /><NumericField displayPrecision={2} label="종횡비" value={selectedSensor.aspectRatio} min={0.2} onChange={(aspectRatio) => onUpdateSensor(selectedSensor.id, { aspectRatio })} /><NumericField displayPrecision={2} label="근거리" value={selectedSensor.near} min={0.01} unit="m" onChange={(near) => onUpdateSensor(selectedSensor.id, { near })} /><NumericField displayPrecision={2} label="관측 거리" value={selectedSensor.far} min={0.1} unit="m" onChange={(far) => onUpdateSensor(selectedSensor.id, { far })} /></div> : null}<SensorProjectionFields sensor={selectedSensor} equipment={selectedEquipment} onChange={onUpdateSensor} /><p className={styles.help}>3D 화면에서 센서를 선택해 이동하거나 회전할 수 있습니다.</p></> : null}
    </div> : null}

    {tab === "SENSOR" && selectedSensor && <details className={styles.settingsGroup}><summary>데이터 수신 설정</summary>
      <button type="button" className={styles.primaryAction} disabled={!selectedSensor} onClick={() => onAddServer({ equipmentId: selectedEquipment.id, sourceDeviceId: selectedSensor.id })}>센서 데이터 연결 추가</button>
      <div className={styles.itemList}>{scopedServers.filter((binding) => binding.sourceDeviceId === selectedSensor?.id).map((binding) => <button type="button" key={binding.id} aria-pressed={selectedServer?.id === binding.id} onClick={() => onSelectServer(binding.id)}><span>{METRIC_LABELS[binding.metric] ?? binding.metric}</span><small>{PROTOCOL_LABELS[binding.protocol] ?? binding.protocol} · {binding.serverKey || "키 미지정"}</small></button>)}</div>
      {selectedServer?.sourceDeviceId === selectedSensor?.id ? <><label className={styles.field}><span>연결 센서</span><select value={selectedServer.sourceDeviceId ?? ""} onChange={(event) => onUpdateServer(selectedServer.id, { sourceDeviceId: event.target.value })}>{scopedSensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.name}</option>)}</select></label><label className={styles.field}><span>값 경로</span><input value={selectedServer.valuePath ?? "$.value"} onChange={(event) => onUpdateServer(selectedServer.id, { valuePath: event.target.value })} /></label><label className={styles.field}><span>서버 키</span><input value={selectedServer.serverKey ?? ""} onChange={(event) => onUpdateServer(selectedServer.id, { serverKey: event.target.value })} /></label><label className={styles.field}><span>프로토콜</span><select value={selectedServer.protocol} onChange={(event) => onUpdateServer(selectedServer.id, { protocol: event.target.value })}>{PROTOCOLS.map((value) => <option key={value} value={value}>{PROTOCOL_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>연결 주소</span><input value={selectedServer.endpoint} onChange={(event) => onUpdateServer(selectedServer.id, { endpoint: event.target.value })} /></label><label className={styles.field}><span>토픽 / 경로</span><input value={selectedServer.topicOrPath} onChange={(event) => onUpdateServer(selectedServer.id, { topicOrPath: event.target.value })} /></label><p className={styles.help}>연결 대기 · 실시간 수신값 없음</p></> : null}
</details>}

    {tab === "POINT" && <ObservationRoiFields points={scopedPoints} selectedPoint={selectedPoint} sensors={scopedSensors} onSelect={onSelectPoint} onChange={onUpdatePoint} onRemove={onRemovePoint} onPlace={() => workspaceViewControllerRef?.current?.placeRoi()} />}

    </div>
    <footer className={styles.stepFooter}>
      {stepError && <p role="alert">{stepError}</p>}
      <div><button type="button" disabled={stepIndex === 0} onClick={() => setStep(EQUIPMENT_SETUP_STEPS[stepIndex - 1].id)}>이전</button><button type="button" onClick={() => setStep(tab, "SKIPPED")}>건너뛰기</button><button type="button" onClick={() => setStep(tab, "PENDING")}>다시 편집</button><button type="button" disabled={uploading || (tab === "BASIC" && !selectedEquipment.name.trim())} onClick={() => setStep(tab, "DONE")}>{stepIndex === 4 ? "검토 완료" : "완료 후 다음"}</button></div>
      <small>입력 후 프로젝트를 저장해 보관하세요.</small>
    </footer>
  </section>;
}
