import { useMemo, useState } from "react";

import {
  ALIGNMENT_UNITS, ASSET_SOURCE_TYPES, ASSET_TYPES, ASSET_USAGE_TYPES, EQUIPMENT_DISPLAY_MODES,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";

import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

const TABS = [["BASIC", "기본 정보"], ["ASSET", "3D·2D 자산"], ["SERVER", "서버 연결"], ["SENSOR", "센서·카메라"], ["POINT", "관측 포인트"], ["ALIGN", "정합·보정"]];
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
  selectedAsset, selectedPoint, selectedSensor, selectedServer,
  onAddAsset, onSelectAsset, onUpdateAsset,
  onAddPoint, onSelectPoint, onUpdatePoint,
  onAddSensor, onSelectSensor, onUpdateSensor,
  onAddServer, onSelectServer, onUpdateServer,
}) {
  const [tab, setTab] = useState("BASIC");
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId) ?? null;
  const scopedAssets = useMemo(() => assetBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [assetBindings, selectedEquipment?.id]);
  const scopedSensors = useMemo(() => sensorBindings.filter((item) => item.equipmentIds.includes(selectedEquipment?.id)), [selectedEquipment?.id, sensorBindings]);
  const scopedPoints = useMemo(() => observationPoints.filter((item) => item.equipmentId === selectedEquipment?.id), [observationPoints, selectedEquipment?.id]);
  const scopedServers = useMemo(() => serverBindings.filter((item) => item.equipmentId === selectedEquipment?.id), [selectedEquipment?.id, serverBindings]);

  if (!selectedEquipment) return <section className={styles.panel}><div className={styles.emptyState}><strong>설비를 먼저 선택하세요</strong><p>‘도면·설비’에서 설비를 선택한 뒤 설비 상세로 이동하면 실제 자산, 센서, 관측 포인트를 해당 설비 ID로 불러옵니다.</p></div></section>;
  const alignment = selectedAsset?.alignmentTransform;

  function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    onAddAsset(selectedEquipment.id, { name: file.name, fileName: file.name, sourceKey: file.name, objectUrl: URL.createObjectURL(file), sourceType: ASSET_SOURCE_TYPES.UPLOAD });
    event.target.value = "";
  }

  return <section className={styles.panel}>
    <header><span>설비 상세 · {selectedEquipment.id}</span><h2>설비 상세</h2><p>{selectedEquipment.name}의 프록시, 실제 스캔 자산, 현실 센서와 서버 키를 연결합니다.</p></header>
    <div className={styles.tabs} role="tablist">{TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>

    {tab === "BASIC" ? <div className={styles.content}>
      <dl className={styles.summary}><div><dt>설비 ID</dt><dd>{selectedEquipment.id}</dd></div><div><dt>템플릿</dt><dd>{EQUIPMENT_SHAPE_TEMPLATE_MAP[selectedEquipment.shapeTemplateId]?.nameKo ?? selectedEquipment.shapeTemplateId}</dd></div><div><dt>층</dt><dd>{selectedEquipment.floorId}</dd></div><div><dt>연결 현황</dt><dd>자산 {scopedAssets.length} · 센서 {scopedSensors.length} · 포인트 {scopedPoints.length}</dd></div></dl>
      <p className={styles.help}>프록시 모델은 설비 배치와 충돌 판정의 기준으로 유지하며 실제 자산은 별도의 정합 변환값으로만 보정됩니다.</p>
    </div> : null}

    {tab === "ASSET" ? <div className={styles.content}>
      <div className={styles.actionRow}><label className={styles.uploadButton}>사용자 파일 연결<input type="file" accept=".obj,.ply,.jpg,.jpeg,.png" onChange={uploadFile} /></label><button type="button" onClick={() => onAddAsset(selectedEquipment.id, { name: "서버 자산", sourceType: ASSET_SOURCE_TYPES.SERVER_KEY, sourceKey: "asset/cabinet/latest", assetType: ASSET_TYPES.OBJ, usageType: ASSET_USAGE_TYPES.MODEL, status: "PENDING" })}>서버 자산 키 추가</button></div>
      <div className={styles.itemList}>{scopedAssets.map((asset) => <button type="button" key={asset.id} aria-pressed={selectedAsset?.id === asset.id} onClick={() => onSelectAsset(asset.id)}><span>{asset.name}</span><small>{asset.assetType} · {ASSET_USAGE_LABELS[asset.usageType] ?? asset.usageType} · {STATUS_LABELS[asset.status] ?? asset.status}</small></button>)}</div>
      {selectedAsset ? <><label className={styles.field}><span>사용 용도</span><select value={selectedAsset.usageType} onChange={(event) => onUpdateAsset(selectedAsset.id, { usageType: event.target.value })}>{Object.values(ASSET_USAGE_TYPES).map((value) => <option key={value} value={value}>{ASSET_USAGE_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>보기 모드</span><select value={selectedAsset.displayMode} onChange={(event) => onUpdateAsset(selectedAsset.id, { displayMode: event.target.value })}>{Object.entries(DISPLAY_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}><span>소스 키 / 주소</span><input value={selectedAsset.sourceKey} onChange={(event) => onUpdateAsset(selectedAsset.id, { sourceKey: event.target.value })} /></label></> : <p className={styles.help}>연결된 자산을 선택하세요.</p>}
    </div> : null}

    {tab === "SERVER" ? <div className={styles.content}>
      <button type="button" className={styles.primaryAction} disabled={!scopedSensors.length || !scopedPoints.length} onClick={() => onAddServer({ equipmentId: selectedEquipment.id, observationPointId: scopedPoints[0].id, sourceDeviceId: scopedSensors[0].id, metric: scopedPoints[0].metric, unit: scopedPoints[0].unit })}>센서 데이터 연결 추가</button>
      <div className={styles.itemList}>{scopedServers.map((binding) => <button type="button" key={binding.id} aria-pressed={selectedServer?.id === binding.id} onClick={() => onSelectServer(binding.id)}><span>{METRIC_LABELS[binding.metric] ?? binding.metric}</span><small>{PROTOCOL_LABELS[binding.protocol] ?? binding.protocol} · {binding.serverKey || "키 미지정"}</small></button>)}</div>
      {selectedServer ? <><label className={styles.field}><span>서버 키</span><input value={selectedServer.serverKey ?? ""} onChange={(event) => onUpdateServer(selectedServer.id, { serverKey: event.target.value })} /></label><label className={styles.field}><span>프로토콜</span><select value={selectedServer.protocol} onChange={(event) => onUpdateServer(selectedServer.id, { protocol: event.target.value })}>{PROTOCOLS.map((value) => <option key={value} value={value}>{PROTOCOL_LABELS[value] ?? value}</option>)}</select></label><label className={styles.field}><span>연결 주소</span><input value={selectedServer.endpoint} onChange={(event) => onUpdateServer(selectedServer.id, { endpoint: event.target.value })} /></label><label className={styles.field}><span>토픽 / 경로</span><input value={selectedServer.topicOrPath} onChange={(event) => onUpdateServer(selectedServer.id, { topicOrPath: event.target.value })} /></label><div className={styles.preview}><span>백엔드 미연결 데모</span><strong>42.3 {selectedServer.unit}</strong><code>{`{ "assetKey": "${selectedServer.serverKey}", "value": 42.3 }`}</code></div></> : null}
    </div> : null}

    {tab === "SENSOR" ? <div className={styles.content}>
      <div className={styles.actionRow}><button type="button" onClick={() => onAddSensor(selectedEquipment.id, "SENSOR")}>센서 추가</button><button type="button" onClick={() => onAddSensor(selectedEquipment.id, "CAMERA")}>비전 카메라 추가</button></div>
      <div className={styles.itemList}>{scopedSensors.map((sensor) => <button type="button" key={sensor.id} aria-pressed={selectedSensor?.id === sensor.id} onClick={() => onSelectSensor(sensor.id)}><span>{sensor.name}</span><small>{SENSOR_TYPE_LABELS[sensor.sensorType] ?? sensor.sensorType} · {sensor.serverKey || "키 미지정"}</small></button>)}</div>
      {selectedSensor ? <><label className={styles.field}><span>이름</span><input value={selectedSensor.name} onChange={(event) => onUpdateSensor(selectedSensor.id, { name: event.target.value })} /></label><label className={styles.field}><span>서버 키</span><input value={selectedSensor.serverKey} onChange={(event) => onUpdateSensor(selectedSensor.id, { serverKey: event.target.value })} /></label><label className={styles.field}><span>장착 방식</span><select value={selectedSensor.mountMode} onChange={(event) => onUpdateSensor(selectedSensor.id, { mountMode: event.target.value })}><option value="WORLD">월드 고정</option><option value="EQUIPMENT">설비 부착</option></select></label><VectorFields label="위치 (m)" value={selectedSensor.position} onChange={(position) => onUpdateSensor(selectedSensor.id, { position })} /><VectorFields label="회전 (라디안)" value={selectedSensor.rotation} onChange={(rotation) => onUpdateSensor(selectedSensor.id, { rotation })} />{selectedSensor.sensorType === "CAMERA" ? <div className={styles.rangeGrid}><NumericField label="화각" value={selectedSensor.fieldOfView} min={10} unit="°" onChange={(fieldOfView) => onUpdateSensor(selectedSensor.id, { fieldOfView })} /><NumericField label="종횡비" value={selectedSensor.aspectRatio} min={0.2} onChange={(aspectRatio) => onUpdateSensor(selectedSensor.id, { aspectRatio })} /><NumericField label="근거리" value={selectedSensor.near} min={0.01} unit="m" onChange={(near) => onUpdateSensor(selectedSensor.id, { near })} /><NumericField label="원거리" value={selectedSensor.far} min={0.1} unit="m" onChange={(far) => onUpdateSensor(selectedSensor.id, { far })} /></div> : null}</> : null}
    </div> : null}

    {tab === "POINT" ? <div className={styles.content}>
      <button type="button" className={styles.primaryAction} onClick={() => onAddPoint(selectedEquipment.id, { x: 0, y: selectedEquipment.dimensions.height / 2, z: 0 })}>설비 중심에 관측 포인트 추가</button>
      <div className={styles.itemList}>{scopedPoints.map((point) => <button type="button" key={point.id} aria-pressed={selectedPoint?.id === point.id} onClick={() => onSelectPoint(point.id)}><span>{point.name}</span><small>{METRIC_LABELS[point.metric] ?? point.metric} · 센서 {point.sensorIds.length}</small></button>)}</div>
      {selectedPoint ? <><label className={styles.field}><span>이름</span><input value={selectedPoint.name} onChange={(event) => onUpdatePoint(selectedPoint.id, { name: event.target.value })} /></label><label className={styles.field}><span>관측 항목</span><select value={selectedPoint.metric} onChange={(event) => onUpdatePoint(selectedPoint.id, { metric: event.target.value })}>{METRICS.map((value) => <option key={value} value={value}>{METRIC_LABELS[value] ?? value}</option>)}</select></label><VectorFields label="설비 기준 위치" value={selectedPoint.localPosition} onChange={(localPosition) => onUpdatePoint(selectedPoint.id, { localPosition })} /><VectorFields label="표면 법선" value={selectedPoint.targetNormal} onChange={(targetNormal) => onUpdatePoint(selectedPoint.id, { targetNormal })} /></> : null}
    </div> : null}

    {tab === "ALIGN" ? <div className={styles.content}>{selectedAsset && alignment ? <>
      <label className={styles.field}><span>원본 단위</span><select value={alignment.unit} onChange={(event) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { unit: event.target.value } })}>{Object.values(ALIGNMENT_UNITS).map((value) => <option key={value}>{value.toLowerCase()}</option>)}</select></label>
      <div className={styles.checkGrid}>{[["autoCentered", "자동 중심 정렬"], ["floorAligned", "바닥 기준 정렬"], ["fitToProxy", "Proxy 크기 자동 맞춤"], ["completed", "정합 완료"]].map(([key, label]) => <label key={key} className={styles.check}><input type="checkbox" checked={alignment[key]} onChange={(event) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { [key]: event.target.checked } })} /><span>{label}</span></label>)}</div>
      <VectorFields label="위치 (m)" value={alignment.position} onChange={(position) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { position } })} /><VectorFields label="회전 (라디안)" value={alignment.rotation} onChange={(rotation) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { rotation } })} /><VectorFields label="크기 비율" value={alignment.scale} onChange={(scale) => onUpdateAsset(selectedAsset.id, { alignmentTransform: { scale } })} step={0.05} />
      <button type="button" className={styles.primaryAction} onClick={() => onUpdateAsset(selectedAsset.id, { alignmentTransform: { unit: ALIGNMENT_UNITS.MM, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, autoCentered: true, floorAligned: true, fitToProxy: true, completed: false }, displayMode: EQUIPMENT_DISPLAY_MODES.COMPARE })}>정합값 초기화</button>
    </> : <p className={styles.help}>3D·2D 자산 탭에서 정합할 자산을 선택하세요.</p>}</div> : null}
  </section>;
}
