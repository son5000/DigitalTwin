import { useMemo, useState } from "react";

import {
  ALIGNMENT_UNITS, ASSET_SOURCE_TYPES, ASSET_TYPES, ASSET_USAGE_TYPES, EQUIPMENT_DISPLAY_MODES,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";

import NumericField from "./NumericField";
import { EQUIPMENT_SETUP_STEPS, getEquipmentSetup, updateEquipmentSetup, getSetupStepIssue } from "../model/equipmentSetup";
import styles from "./MonitoringSettingsPanel.module.css";

const STATUS_TEXT = { DONE: "완료", SKIPPED: "건너뜀", PENDING: "미완료" };
const METRICS = ["TEMPERATURE", "PRESSURE", "VIBRATION", "NOISE", "POWER", "FLOW", "VIDEO"];
const PROTOCOLS = ["MQTT", "HTTP", "WEBSOCKET", "RTSP", "MANUAL"];
const ASSET_USAGE_LABELS = Object.freeze({ MODEL: "실제 모델", POINT_CLOUD: "포인트클라우드", REFERENCE_IMAGE: "참조 이미지", TEXTURE: "텍스처", CAMERA_FRAME: "카메라 관측 이미지" });
const DISPLAY_MODE_LABELS = Object.freeze({ PROXY: "프록시만 표시", ACTUAL: "실제 모델만 표시", COMPARE: "프록시와 실제 모델 비교", POINT_CLOUD: "포인트클라우드 표시" });
const STATUS_LABELS = Object.freeze({ READY: "준비됨", PENDING: "대기 중", LOADING: "불러오는 중", ERROR: "오류", MISSING: "파일 없음" });
const METRIC_LABELS = Object.freeze({ TEMPERATURE: "온도", PRESSURE: "압력", VIBRATION: "진동", NOISE: "소음", POWER: "전력", FLOW: "유량", VIDEO: "영상" });
const PROTOCOL_LABELS = Object.freeze({ MQTT: "MQTT", HTTP: "HTTP", WEBSOCKET: "웹소켓", RTSP: "RTSP", MANUAL: "수동 입력" });
const SENSOR_TYPE_LABELS = Object.freeze({ SENSOR: "센서", CAMERA: "비전 카메라" });

function VectorFields({ label, value, onChange, step = 0.01 }) {
  return <div className={styles.vectorGroup}><strong>{label}</strong><div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={axis.toUpperCase()} value={value?.[axis] ?? 0} step={step} onChange={(next) => onChange({ [axis]: next })} />)}</div></div>;
}

export default function MonitoringSettingsPanel({
  equipment, selectedEquipmentId, assetBindings, sensorBindings, observationPoints, serverBindings,
  selectedAsset: assetSelection, selectedPoint: pointSelection, selectedSensor: sensorSelection, selectedServer: serverSelection,
  onAddAsset, onSelectAsset, onUpdateAsset,
  onAddPoint, onSelectPoint, onUpdatePoint,
  onAddSensor, onSelectSensor, onUpdateSensor,
  onAddServer, onSelectServer, onUpdateServer,
  onUpdateEquipment, onUploadAssetFiles, viewerPreset, onEquipmentRepresentationChange, onViewerPresetChange, uploadNotice,
}) {
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stepError, setStepError] = useState("");
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId) ?? null;
  const scopedAssets = useMemo(() => assetBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [assetBindings, selectedEquipment?.id]);
  const scopedSensors = useMemo(() => sensorBindings.filter((item) => item.equipmentIds.includes(selectedEquipment?.id)), [selectedEquipment?.id, sensorBindings]);
  const scopedPoints = useMemo(() => observationPoints.filter((item) => item.equipmentId === selectedEquipment?.id), [observationPoints, selectedEquipment?.id]);
  const scopedServers = useMemo(() => serverBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [selectedEquipment?.id, serverBindings]);

  if (!selectedEquipment) return <section className={styles.panel}><div className={styles.emptyState}><strong>관측 설비를 등록하세요</strong><p>왼쪽 작업 화면의 ‘설비 추가’에서 카탈로그 설비를 선택하거나 OBJ·PLY 파일을 직접 등록할 수 있습니다.</p></div></section>;
  const selectedAsset = scopedAssets.find((item) => item.id === assetSelection?.id);
  const selectedSensor = scopedSensors.find((item) => item.id === sensorSelection?.id);
  const selectedPoint = scopedPoints.find((item) => item.id === pointSelection?.id);
  const selectedServer = scopedServers.find((item) => item.id === serverSelection?.id);
  const alignment = selectedAsset?.alignmentTransform;
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
    <header><span>{stepIndex + 1} / 5 단계 · 완료 {setup.completed} · 건너뜀 {setup.skipped}</span><h2>{selectedEquipment.name}</h2><p>{step.description}</p><progress aria-label="설비 설정 완료 단계" value={setup.completed} max={5} /></header>
    <nav className={styles.tabs} aria-label="설비별 설정 단계">{EQUIPMENT_SETUP_STEPS.map(({ id, label }, index) => <button key={id} type="button" aria-current={tab === id ? "step" : undefined} onClick={() => setStep(id)}>{index + 1}. {label}<small>{STATUS_TEXT[setup.steps[id]]}</small></button>)}</nav>
    <div className={styles.stepBody}>

    {tab === "BASIC" ? <div className={styles.content}>
      {[["name", "설비명"], ["model", "모델명"], ["manufacturer", "제조사"], ["serialNumber", "일련번호"], ["assetTag", "자산 번호"]].map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input value={key === "name" ? selectedEquipment.name : selectedEquipment.metadata?.[key] ?? ""} onChange={(event) => onUpdateEquipment?.(key === "name" ? { name: event.target.value } : { metadata: { [key]: event.target.value } })} /></label>)}
      <label className={styles.field}><span>설비 설명</span><textarea value={selectedEquipment.metadata?.description ?? ""} onChange={(event) => onUpdateEquipment?.({ metadata: { description: event.target.value } })} /></label>
      <label className={styles.uploadButton}>대표 사진 등록 (2MB 이하)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} /></label>
      {photoError && <p role="alert">{photoError}</p>}
      {selectedEquipment.metadata?.representativeImage && <div className={styles.photo}><img src={selectedEquipment.metadata.representativeImage} alt={`${selectedEquipment.name} 대표 사진`} /><button type="button" onClick={() => onUpdateEquipment?.({ metadata: { representativeImage: null } })}>사진 제거</button></div>}
      <dl className={styles.summary}><div><dt>설비 ID</dt><dd>{selectedEquipment.id}</dd></div><div><dt>템플릿</dt><dd>{UNIFIED_EQUIPMENT_TEMPLATE_MAP[selectedEquipment.shapeTemplateId]?.nameKo ?? selectedEquipment.shapeTemplateId}</dd></div><div><dt>층</dt><dd>{selectedEquipment.floorId}</dd></div><div><dt>연결 현황</dt><dd>자산 {scopedAssets.length} · 센서 {scopedSensors.length} · 포인트 {scopedPoints.length}</dd></div></dl>
      <label className={styles.field}><span>현실 좌표계</span><select value={selectedEquipment.metadata?.coordinateSystem ?? "LOCAL_METERS"} onChange={(event) => onUpdateEquipment?.({ metadata: { coordinateSystem: event.target.value } })}><option value="LOCAL_METERS">로컬 미터 좌표</option><option value="SITE_METERS">부지 기준 미터 좌표</option><option value="CUSTOM">사용자 정의 좌표</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={selectedEquipment.showNameLabel === true} onChange={(event) => onUpdateEquipment?.({ showNameLabel: event.target.checked })} /><span>이름표 표시</span></label>
      <VectorFields label="현실세계 기준 위치 (m)" value={selectedEquipment.position} onChange={(position) => onUpdateEquipment?.({ position })} />
      <p className={styles.help}>프록시 모델은 설비 배치와 충돌 판정의 기준으로 유지하며 실제 자산은 별도의 정합 변환값으로만 보정됩니다.</p>
    </div> : null}

    {tab === "ASSET" ? <div className={styles.content}>
      <p className={styles.help}>OBJ + MTL + 텍스처를 함께 선택하거나 PLY를 등록하세요. 파일은 현재 브라우저에 저장됩니다. 모델을 다시 등록하면 새 모델로 교체됩니다.</p>
      <label className={styles.field}><span>뷰어에서 이 설비 표시</span><select value={viewerPreset?.equipmentRepresentation?.overrides?.[selectedEquipment.id] ?? "AUTO"} onChange={(event) => onEquipmentRepresentationChange?.(selectedEquipment.id, event.target.value)}><option value="AUTO">전역 설정 사용</option><option value="SIMPLIFIED">기본 도형 모델</option><option value="DETAILED">3D 스캔 모델</option><option value="DISTANCE">가까우면 스캔 · 멀면 도형</option></select></label>
      <NumericField label="자동 상세 전환 거리 (공통)" value={viewerPreset?.equipmentRepresentation?.autoDetailDistance ?? 12} min={1} unit="m" onChange={(autoDetailDistance) => onViewerPresetChange?.({ equipmentRepresentation: { autoDetailDistance } })} />
      {uploading && <p role="status">파일 저장 중…</p>}{uploadNotice && <p role="status" className={styles.help}>{uploadNotice}</p>}
      <div className={styles.actionRow}><label className={styles.uploadButton}>사용자 파일 연결<input type="file" disabled={uploading} multiple accept=".obj,.ply,.mtl,.jpg,.jpeg,.png,.webp" onChange={uploadFile} /></label><button type="button" onClick={() => onAddAsset(selectedEquipment.id, { name: "서버 자산", sourceType: ASSET_SOURCE_TYPES.SERVER_KEY, sourceKey: "asset/cabinet/latest", assetType: ASSET_TYPES.OBJ, usageType: ASSET_USAGE_TYPES.MODEL, status: "PENDING" })}>서버 자산 키 추가</button></div>
      <div className={styles.itemList}>{scopedAssets.map((asset) => <button type="button" key={asset.id} aria-pressed={selectedAsset?.id === asset.id} onClick={() => onSelectAsset(asset.id)}><span>{asset.name}</span><small>{asset.assetType} · {ASSET_USAGE_LABELS[asset.usageType] ?? asset.usageType} · {STATUS_LABELS[asset.status] ?? asset.status}</small></button>)}</div>
      {selectedAsset ? <><label className={styles.field}><span>사용 용도</span><select value={selectedAsset.usageType} onChange={(event) => onUpdateAsset(selectedAsset.id, { usageType: event.target.value })}>{Object.values(ASSET_USAGE_TYPES).map((value) => <option key={value} value={value}>{ASSET_USAGE_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>보기 모드</span><select value={selectedAsset.displayMode} onChange={(event) => onUpdateAsset(selectedAsset.id, { displayMode: event.target.value })}>{Object.entries(DISPLAY_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}><span>소스 키 / 주소</span><input value={selectedAsset.sourceKey} onChange={(event) => onUpdateAsset(selectedAsset.id, { sourceKey: event.target.value })} /></label></> : <p className={styles.help}>연결된 자산을 선택하세요.</p>}
    </div> : null}

    {tab === "REVIEW" ? <div className={styles.content}>
      <div className={styles.review}>{EQUIPMENT_SETUP_STEPS.slice(0, -1).map(({ id, label }) => <button type="button" key={id} onClick={() => setStep(id)}>{label} · {STATUS_TEXT[setup.steps[id]]} →</button>)}</div>
      <p className={styles.help}>설정 검토 단계입니다. 완료 표시는 통신 성공을 의미하지 않습니다. 실제 수신에는 백엔드 연결이 필요합니다.</p>
      <button type="button" className={styles.primaryAction} disabled={!scopedSensors.length || !scopedPoints.length} onClick={() => onAddServer({ equipmentId: selectedEquipment.id, observationPointId: scopedPoints[0].id, sourceDeviceId: scopedSensors[0].id, metric: scopedPoints[0].metric, unit: scopedPoints[0].unit })}>센서 데이터 연결 추가</button>
      <div className={styles.itemList}>{scopedServers.map((binding) => <button type="button" key={binding.id} aria-pressed={selectedServer?.id === binding.id} onClick={() => onSelectServer(binding.id)}><span>{METRIC_LABELS[binding.metric] ?? binding.metric}</span><small>{PROTOCOL_LABELS[binding.protocol] ?? binding.protocol} · {binding.serverKey || "키 미지정"}</small></button>)}</div>
      {selectedServer ? <><label className={styles.field}><span>연결 센서</span><select value={selectedServer.sourceDeviceId ?? ""} onChange={(event) => onUpdateServer(selectedServer.id, { sourceDeviceId: event.target.value })}>{scopedSensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.name}</option>)}</select></label><label className={styles.field}><span>관측 항목</span><select value={selectedServer.observationPointId ?? ""} onChange={(event) => { const point = scopedPoints.find((item) => item.id === event.target.value); if (point) onUpdateServer(selectedServer.id, { observationPointId: point.id, metric: point.metric, unit: point.unit }); }}>{scopedPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</select></label><label className={styles.field}><span>값 경로</span><input value={selectedServer.valuePath ?? "$.value"} onChange={(event) => onUpdateServer(selectedServer.id, { valuePath: event.target.value })} /></label><label className={styles.field}><span>서버 키</span><input value={selectedServer.serverKey ?? ""} onChange={(event) => onUpdateServer(selectedServer.id, { serverKey: event.target.value })} /></label><label className={styles.field}><span>프로토콜</span><select value={selectedServer.protocol} onChange={(event) => onUpdateServer(selectedServer.id, { protocol: event.target.value })}>{PROTOCOLS.map((value) => <option key={value} value={value}>{PROTOCOL_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>연결 주소</span><input value={selectedServer.endpoint} onChange={(event) => onUpdateServer(selectedServer.id, { endpoint: event.target.value })} /></label><label className={styles.field}><span>토픽 / 경로</span><input value={selectedServer.topicOrPath} onChange={(event) => onUpdateServer(selectedServer.id, { topicOrPath: event.target.value })} /></label><p className={styles.help}>연결 대기 · 실시간 수신값 없음</p></> : null}
    </div> : null}

    {tab === "SENSOR" ? <div className={styles.content}>
      <p className={styles.help}>센서 배치 보기에서 관측 이미지와 모델을 비교해 위치·방향·화각을 맞추세요. 자동 위치 역산에는 카메라 보정값과 이미지·모델 대응점이 필요합니다.</p>
      {selectedSensor && <>
        <label className={styles.field}><span>관측 장치 종류</span><select value={selectedSensor.deviceKind ?? (selectedSensor.sensorType === "CAMERA" ? "VISION" : "GENERIC")} onChange={(event) => onUpdateSensor(selectedSensor.id, { deviceKind: event.target.value, sensorType: ["VISION", "THERMAL"].includes(event.target.value) ? "CAMERA" : "SENSOR" })}><option value="VISION">비전 카메라</option><option value="THERMAL">열화상 카메라</option><option value="ULTRASONIC">초음파 센서</option><option value="GENERIC">일반 센서</option></select></label>
        <label className={styles.field}><span>스틸컷 이미지 URL</span><input type="url" placeholder="https://…/latest.jpg" value={selectedSensor.frameUrl ?? ""} onChange={(event) => onUpdateSensor(selectedSensor.id, { frameUrl: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={selectedSensor.calibrationConfirmed === true} onChange={(event) => onUpdateSensor(selectedSensor.id, { calibrationConfirmed: event.target.checked })} />위치·화각 수동 보정 확인</label>
      </>}
      <div className={styles.actionRow}><button type="button" onClick={() => onAddSensor(selectedEquipment.id, "SENSOR")}>센서 추가</button><button type="button" onClick={() => onAddSensor(selectedEquipment.id, "CAMERA")}>비전 카메라 추가</button></div>
      <div className={styles.itemList}>{scopedSensors.map((sensor) => <button type="button" key={sensor.id} aria-pressed={selectedSensor?.id === sensor.id} onClick={() => onSelectSensor(sensor.id)}><span>{sensor.name}</span><small>{SENSOR_TYPE_LABELS[sensor.sensorType] ?? sensor.sensorType} · {sensor.serverKey || "키 미지정"}</small></button>)}</div>
      {selectedSensor ? <><label className={styles.field}><span>이름</span><input value={selectedSensor.name} onChange={(event) => onUpdateSensor(selectedSensor.id, { name: event.target.value })} /></label><label className={styles.field}><span>센서 ID·연결 키</span><input value={selectedSensor.serverKey} onChange={(event) => onUpdateSensor(selectedSensor.id, { serverKey: event.target.value })} /></label><label className={styles.field}><span>장착 방식</span><select value={selectedSensor.mountMode} onChange={(event) => onUpdateSensor(selectedSensor.id, { mountMode: event.target.value })}><option value="WORLD">월드 고정</option><option value="EQUIPMENT">설비 부착</option></select></label><VectorFields label="실제 위치 (m)" value={selectedSensor.position} onChange={(position) => onUpdateSensor(selectedSensor.id, { position })} /><VectorFields label="실제 방향·회전 (라디안)" value={selectedSensor.rotation} onChange={(rotation) => onUpdateSensor(selectedSensor.id, { rotation })} />{selectedSensor.sensorType === "CAMERA" ? <div className={styles.rangeGrid}><NumericField label="화각" value={selectedSensor.fieldOfView} min={10} unit="°" onChange={(fieldOfView) => onUpdateSensor(selectedSensor.id, { fieldOfView })} /><NumericField label="종횡비" value={selectedSensor.aspectRatio} min={0.2} onChange={(aspectRatio) => onUpdateSensor(selectedSensor.id, { aspectRatio })} /><NumericField label="근거리" value={selectedSensor.near} min={0.01} unit="m" onChange={(near) => onUpdateSensor(selectedSensor.id, { near })} /><NumericField label="관측 거리" value={selectedSensor.far} min={0.1} unit="m" onChange={(far) => onUpdateSensor(selectedSensor.id, { far })} /></div> : null}<div className={styles.vectorGroup}><strong>수집 데이터 항목</strong><div className={styles.checkGrid}>{scopedPoints.map((point) => { const checked = point.sensorIds?.includes(selectedSensor.id); return <label key={point.id} className={styles.check}><input type="checkbox" checked={checked} onChange={(event) => onUpdatePoint(point.id, { sensorIds: event.target.checked ? [...new Set([...(point.sensorIds ?? []), selectedSensor.id])] : (point.sensorIds ?? []).filter((id) => id !== selectedSensor.id) })} /><span>{METRIC_LABELS[point.metric] ?? point.metric}</span></label>; })}</div>{!scopedPoints.length ? <p className={styles.help}>관측 포인트를 먼저 추가하면 센서별 수집 항목을 연결할 수 있습니다.</p> : null}</div><p className={styles.help}>월드 센서 화면에서 센서를 선택한 뒤 이동·회전 도구로 직접 조정할 수 있습니다.</p></> : null}
    </div> : null}

    {tab === "POINT" ? <div className={styles.content}>
      {selectedPoint && <>
        <label className={styles.field}><span>표시 단위</span><input value={selectedPoint.unit ?? ""} onChange={(event) => onUpdatePoint(selectedPoint.id, { unit: event.target.value })} /></label>
        <label className={styles.field}><span>경보 효과</span><select value={selectedPoint.alertIcon ?? ""} onChange={(event) => onUpdatePoint(selectedPoint.id, { alertIcon: event.target.value })}><option value="">측정 항목에 맞게 자동</option><option value="🔥">🔥 고온</option><option value="⚠️">⚠️ 경고</option><option value="〰️">〰️ 진동</option><option value="📷">📷 영상</option></select></label>
        <div className={styles.checkGrid}>{scopedSensors.map((sensor) => <label key={sensor.id} className={styles.check}><input type="checkbox" checked={selectedPoint.sensorIds?.includes(sensor.id) ?? false} onChange={(event) => onUpdatePoint(selectedPoint.id, { sensorIds: event.target.checked ? [...new Set([...(selectedPoint.sensorIds ?? []), sensor.id])] : (selectedPoint.sensorIds ?? []).filter((id) => id !== sensor.id) })} />{sensor.name}</label>)}</div>
        <NumericField label="효과 확인용 테스트 값 (실측 아님)" value={selectedPoint.previewValue ?? 0} onChange={(previewValue) => onUpdatePoint(selectedPoint.id, { previewValue })} />
      </>}
      <button type="button" className={styles.primaryAction} onClick={() => onAddPoint(selectedEquipment.id, { x: 0, y: selectedEquipment.dimensions.height / 2, z: 0 })}>설비 중심에 관측 포인트 추가</button>
      <div className={styles.itemList}>{scopedPoints.map((point) => <button type="button" key={point.id} aria-pressed={selectedPoint?.id === point.id} onClick={() => onSelectPoint(point.id)}><span>{point.name}</span><small>{METRIC_LABELS[point.metric] ?? point.metric} · 센서 {point.sensorIds.length}</small></button>)}</div>
      {selectedPoint ? <><label className={styles.field}><span>이름</span><input value={selectedPoint.name} onChange={(event) => onUpdatePoint(selectedPoint.id, { name: event.target.value })} /></label><label className={styles.field}><span>관측 항목</span><select value={selectedPoint.metric} onChange={(event) => onUpdatePoint(selectedPoint.id, { metric: event.target.value })}>{METRICS.map((value) => <option key={value} value={value}>{METRIC_LABELS[value] ?? value}</option>)}</select></label><VectorFields label="설비 기준 위치" value={selectedPoint.localPosition} onChange={(localPosition) => onUpdatePoint(selectedPoint.id, { localPosition })} /><VectorFields label="표면 법선" value={selectedPoint.targetNormal} onChange={(targetNormal) => onUpdatePoint(selectedPoint.id, { targetNormal })} /><div className={styles.vectorGroup}><strong>상태 임계치</strong><div className={styles.rangeGrid}><NumericField label="정상 상한" value={selectedPoint.normalRange?.max ?? 60} onChange={(value) => onUpdatePoint(selectedPoint.id, { normalRange: { max: value }, warningRange: { min: value } })} /><NumericField label="주의 상한" value={selectedPoint.warningRange?.max ?? 80} onChange={(value) => onUpdatePoint(selectedPoint.id, { warningRange: { max: value }, dangerRange: { min: value } })} /><NumericField label="위험 상한" value={selectedPoint.dangerRange?.max ?? 120} onChange={(value) => onUpdatePoint(selectedPoint.id, { dangerRange: { max: value } })} /></div></div></> : null}
    </div> : null}

    {tab === "ASSET" ? <div className={styles.content}>{selectedAsset && alignment ? <>
      <label className={styles.field}><span>원본 단위</span><select value={alignment.unit} onChange={(event) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { unit: event.target.value } })}>{Object.values(ALIGNMENT_UNITS).map((value) => <option key={value}>{value.toLowerCase()}</option>)}</select></label>
      <div className={styles.checkGrid}>{[["autoCentered", "자동 중심 정렬"], ["floorAligned", "바닥 기준 정렬"], ["fitToProxy", "Proxy 크기 자동 맞춤"], ["completed", "정합 완료"]].map(([key, label]) => <label key={key} className={styles.check}><input type="checkbox" checked={alignment[key]} onChange={(event) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { [key]: event.target.checked } })} /><span>{label}</span></label>)}</div>
      <VectorFields label="위치 (m)" value={alignment.position} onChange={(position) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { position } })} /><VectorFields label="회전 (라디안)" value={alignment.rotation} onChange={(rotation) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { rotation } })} /><VectorFields label="크기 비율" value={alignment.scale} onChange={(scale) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { scale } })} step={0.05} />
      <button type="button" className={styles.primaryAction} onClick={() => onUpdateAsset(selectedAsset.id, { alignmentTransform: { unit: ALIGNMENT_UNITS.MM, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, autoCentered: true, floorAligned: true, fitToProxy: true, completed: false }, displayMode: EQUIPMENT_DISPLAY_MODES.COMPARE })}>정합값 초기화</button>
    </> : <p className={styles.help}>3D·2D 자산 탭에서 정합할 자산을 선택하세요.</p>}</div> : null}
    </div>
    <footer className={styles.stepFooter}>
      {stepError && <p role="alert">{stepError}</p>}
      <p>이전: {EQUIPMENT_SETUP_STEPS[stepIndex - 1]?.label ?? "없음"} · 다음: {EQUIPMENT_SETUP_STEPS[stepIndex + 1]?.label ?? "설정 검토 완료"}</p>
      <div><button type="button" disabled={stepIndex === 0} onClick={() => setStep(EQUIPMENT_SETUP_STEPS[stepIndex - 1].id)}>이전</button><button type="button" onClick={() => setStep(tab, "SKIPPED")}>건너뛰기</button><button type="button" onClick={() => setStep(tab, "PENDING")}>다시 편집</button><button type="button" disabled={uploading || (tab === "BASIC" && !selectedEquipment.name.trim())} onClick={() => setStep(tab, "DONE")}>{stepIndex === 4 ? "검토 완료" : "완료 후 다음"}</button></div>
      <small>입력은 편집 내용에 반영됩니다. 프로젝트 저장으로 보관하세요. 모든 단계는 다시 수정할 수 있습니다.</small>
    </footer>
  </section>;
}
