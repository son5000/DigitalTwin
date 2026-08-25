import { useState } from "react";

import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

const METRICS = ["TEMPERATURE", "PRESSURE", "VIBRATION", "NOISE", "POWER", "FLOW", "VIDEO"];
const PROTOCOLS = ["MQTT", "HTTP", "WEBSOCKET", "RTSP", "MANUAL"];

export default function MonitoringSettingsPanel({
  equipment, selectedEquipmentId, observationPoints, devices, bindings,
  selectedPoint, selectedDevice, selectedBinding,
  onEquipmentSelect, onAddPoint, onSelectPoint, onUpdatePoint,
  onAddDevice, onSelectDevice, onUpdateDevice,
  onAddBinding, onSelectBinding, onUpdateBinding,
}) {
  const [tab, setTab] = useState("TARGET");
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId) ?? equipment[0] ?? null;
  const equipmentPoints = observationPoints.filter((item) => item.equipmentId === selectedEquipment?.id);
  const equipmentDevices = devices.filter((item) => item.equipmentId === selectedEquipment?.id);
  const equipmentBindings = bindings.filter((item) => item.equipmentId === selectedEquipment?.id);

  return (
    <section className={styles.panel}>
      <header><span>MONITORING CONFIGURATION</span><h2>설비 관측 설정</h2></header>
      <label className={styles.field}><span>관측 설비</span><select value={selectedEquipment?.id ?? ""} onChange={(event) => onEquipmentSelect(event.target.value)}>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.floorId}</option>)}</select></label>
      <div className={styles.tabs} role="tablist">
        <button type="button" aria-selected={tab === "TARGET"} onClick={() => setTab("TARGET")}>관측 대상</button>
        <button type="button" aria-selected={tab === "DEVICE"} onClick={() => setTab("DEVICE")}>센서·카메라</button>
        <button type="button" aria-selected={tab === "BINDING"} onClick={() => setTab("BINDING")}>데이터 수신</button>
      </div>

      {tab === "TARGET" ? <div className={styles.content}>
        <div className={styles.actionRow}><button type="button" disabled={!selectedEquipment} onClick={() => onAddPoint(selectedEquipment?.id, { x: 0, y: selectedEquipment?.dimensions.height / 2 || 0.5, z: 0 })}>바운딩 박스 기준 지점 추가</button></div>
        <div className={styles.itemList}>{equipmentPoints.map((point) => <button type="button" key={point.id} aria-pressed={selectedPoint?.id === point.id} onClick={() => onSelectPoint(point.id)}>{point.name}<small>{point.metric} · {point.unit}</small></button>)}</div>
        {selectedPoint ? <>
          <label className={styles.field}><span>지점 이름</span><input value={selectedPoint.name} onChange={(event) => onUpdatePoint(selectedPoint.id, { name: event.target.value })} /></label>
          <label className={styles.field}><span>설명</span><textarea value={selectedPoint.description} onChange={(event) => onUpdatePoint(selectedPoint.id, { description: event.target.value })} /></label>
          <label className={styles.field}><span>관측 부위</span><select value={selectedPoint.targetPartId ?? ""} onChange={(event) => onUpdatePoint(selectedPoint.id, { targetPartId: event.target.value || null })}><option value="">설비 전체 / 사용자 지정 표면</option>{(selectedEquipment?.parts ?? []).map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>
          <label className={styles.field}><span>관측 항목</span><select value={selectedPoint.metric} onChange={(event) => onUpdatePoint(selectedPoint.id, { metric: event.target.value })}>{METRICS.map((metric) => <option key={metric}>{metric}</option>)}</select></label>
          <label className={styles.field}><span>단위</span><input value={selectedPoint.unit} onChange={(event) => onUpdatePoint(selectedPoint.id, { unit: event.target.value })} /></label>
          <div className={styles.rangeGrid}><NumericField label="정상 최대" value={selectedPoint.normalRange.max} onChange={(max) => onUpdatePoint(selectedPoint.id, { normalRange: { max } })} /><NumericField label="경고 최대" value={selectedPoint.warningRange.max} onChange={(max) => onUpdatePoint(selectedPoint.id, { warningRange: { max } })} /><NumericField label="위험 최대" value={selectedPoint.dangerRange.max} onChange={(max) => onUpdatePoint(selectedPoint.id, { dangerRange: { max } })} /></div>
        </> : null}
      </div> : null}

      {tab === "DEVICE" ? <div className={styles.content}>
        <div className={styles.actionRow}><button type="button" disabled={!selectedEquipment} onClick={() => onAddDevice(selectedEquipment?.id, "SENSOR")}>센서 추가</button><button type="button" disabled={!selectedEquipment} onClick={() => onAddDevice(selectedEquipment?.id, "CAMERA")}>카메라 추가</button></div>
        <div className={styles.itemList}>{equipmentDevices.map((device) => <button type="button" key={device.id} aria-pressed={selectedDevice?.id === device.id} onClick={() => onSelectDevice(device.id)}>{device.name}<small>{device.sourceType} · {device.identifier || "ID 미지정"}</small></button>)}</div>
        {selectedDevice ? <>
          <label className={styles.field}><span>장치 종류</span><select value={selectedDevice.sourceType} onChange={(event) => onUpdateDevice(selectedDevice.id, { sourceType: event.target.value })}><option value="SENSOR">센서</option><option value="CAMERA">카메라</option></select></label>
          <label className={styles.field}><span>장치 이름</span><input value={selectedDevice.name} onChange={(event) => onUpdateDevice(selectedDevice.id, { name: event.target.value })} /></label>
          <label className={styles.field}><span>현실 장치 식별자</span><input value={selectedDevice.identifier} onChange={(event) => onUpdateDevice(selectedDevice.id, { identifier: event.target.value })} /></label>
          <div className={styles.rangeGrid}><NumericField label="위치 X" value={selectedDevice.position.x} unit="m" onChange={(x) => onUpdateDevice(selectedDevice.id, { position: { x } })} /><NumericField label="위치 Y" value={selectedDevice.position.y} unit="m" onChange={(y) => onUpdateDevice(selectedDevice.id, { position: { y } })} /><NumericField label="위치 Z" value={selectedDevice.position.z} unit="m" onChange={(z) => onUpdateDevice(selectedDevice.id, { position: { z } })} /></div>
          <div className={styles.rangeGrid}><NumericField label="방향 X" value={selectedDevice.rotation.x} unit="rad" onChange={(x) => onUpdateDevice(selectedDevice.id, { rotation: { x } })} /><NumericField label="방향 Y" value={selectedDevice.rotation.y} unit="rad" onChange={(y) => onUpdateDevice(selectedDevice.id, { rotation: { y } })} /><NumericField label="방향 Z" value={selectedDevice.rotation.z} unit="rad" onChange={(z) => onUpdateDevice(selectedDevice.id, { rotation: { z } })} /><NumericField label="관측 범위" value={selectedDevice.range} unit="m" onChange={(range) => onUpdateDevice(selectedDevice.id, { range })} /></div>
          {selectedDevice.sourceType === "CAMERA" ? <NumericField label="카메라 FOV" value={selectedDevice.fov} min={10} unit="°" onChange={(fov) => onUpdateDevice(selectedDevice.id, { fov })} /> : null}
        </> : null}
      </div> : null}

      {tab === "BINDING" ? <div className={styles.content}>
        <button type="button" className={styles.primaryAction} disabled={!selectedEquipment || !equipmentDevices.length || !equipmentPoints.length} onClick={() => onAddBinding({ equipmentId: selectedEquipment.id, observationPointId: equipmentPoints[0].id, targetPartId: equipmentPoints[0].targetPartId, sourceDeviceId: equipmentDevices[0].id, metric: equipmentPoints[0].metric, unit: equipmentPoints[0].unit })}>관측값 바인딩 추가</button>
        <div className={styles.itemList}>{equipmentBindings.map((binding) => <button type="button" key={binding.id} aria-pressed={selectedBinding?.id === binding.id} onClick={() => onSelectBinding(binding.id)}>{binding.metric}<small>{binding.sourceType} · {binding.protocol}</small></button>)}</div>
        {selectedBinding ? <>
          <label className={styles.check}><input type="checkbox" checked={selectedBinding.enabled} onChange={(event) => onUpdateBinding(selectedBinding.id, { enabled: event.target.checked })} /><span>수신 활성화</span></label>
          <label className={styles.field}><span>관측 지점</span><select value={selectedBinding.observationPointId ?? ""} onChange={(event) => { const point = equipmentPoints.find((item) => item.id === event.target.value); onUpdateBinding(selectedBinding.id, { observationPointId: event.target.value, targetPartId: point?.targetPartId ?? null }); }}>{equipmentPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</select></label>
          <label className={styles.field}><span>소스 장치</span><select value={selectedBinding.sourceDeviceId} onChange={(event) => onUpdateBinding(selectedBinding.id, { sourceDeviceId: event.target.value, sourceType: equipmentDevices.find((item) => item.id === event.target.value)?.sourceType ?? "SENSOR" })}>{equipmentDevices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          <label className={styles.field}><span>관측 항목</span><select value={selectedBinding.metric} onChange={(event) => onUpdateBinding(selectedBinding.id, { metric: event.target.value })}>{METRICS.map((metric) => <option key={metric}>{metric}</option>)}</select></label>
          <label className={styles.field}><span>단위</span><input value={selectedBinding.unit} onChange={(event) => onUpdateBinding(selectedBinding.id, { unit: event.target.value })} /></label>
          <label className={styles.field}><span>프로토콜</span><select value={selectedBinding.protocol} onChange={(event) => onUpdateBinding(selectedBinding.id, { protocol: event.target.value })}>{PROTOCOLS.map((protocol) => <option key={protocol}>{protocol}</option>)}</select></label>
          <label className={styles.field}><span>Endpoint</span><input value={selectedBinding.endpoint} onChange={(event) => onUpdateBinding(selectedBinding.id, { endpoint: event.target.value })} /></label>
          <label className={styles.field}><span>Topic / Path</span><input value={selectedBinding.topicOrPath} onChange={(event) => onUpdateBinding(selectedBinding.id, { topicOrPath: event.target.value })} /></label>
          <label className={styles.field}><span>Value Path</span><input value={selectedBinding.valuePath} onChange={(event) => onUpdateBinding(selectedBinding.id, { valuePath: event.target.value })} /></label>
          <label className={styles.field}><span>Transform</span><input value={selectedBinding.transform} onChange={(event) => onUpdateBinding(selectedBinding.id, { transform: event.target.value })} /></label>
          <NumericField label="Polling Interval" value={selectedBinding.pollingInterval} min={100} step={100} unit="ms" onChange={(pollingInterval) => onUpdateBinding(selectedBinding.id, { pollingInterval })} />
          <div className={styles.rangeGrid}><NumericField label="정상 최대" value={selectedBinding.normalRange.max} onChange={(max) => onUpdateBinding(selectedBinding.id, { normalRange: { max } })} /><NumericField label="경고 최대" value={selectedBinding.warningRange.max} onChange={(max) => onUpdateBinding(selectedBinding.id, { warningRange: { max } })} /><NumericField label="위험 최대" value={selectedBinding.dangerRange.max} onChange={(max) => onUpdateBinding(selectedBinding.id, { dangerRange: { max } })} /></div>
          <div className={styles.preview}><span>샘플 데이터 미리보기</span><strong>{selectedBinding.metric === "VIDEO" ? "RTSP 프레임 대기" : `${(42.3).toFixed(1)} ${selectedBinding.unit}`}</strong><code>{`{ "value": 42.3, "path": "${selectedBinding.valuePath}" }`}</code></div>
        </> : null}
      </div> : null}
    </section>
  );
}
