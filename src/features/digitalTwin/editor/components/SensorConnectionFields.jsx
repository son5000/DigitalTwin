import { useEffect, useRef, useState } from "react";
import { readProjects } from "@/features/portal/projects/projectRepository";
import { projectApiBase } from "@/features/portal/projects/projectConfigurationApi";
import { lookupSensor, monitoringApiBase, saveSensorCalibration } from "../api/monitoringClient";
import { calibrationPayload, downloadMonitoringJson, validateCalibration } from "../model/monitoringContract";
import { demoSensor } from "../model/monitoringDemo";
import styles from "./MonitoringSettingsPanel.module.css";
import { referenceFrameKey } from "../model/equipmentCoordinateFrame.js";
import { sensorLookupChanges, sensorLookupErrorMessage, sensorSerialChanges } from "../model/sensorLookup.js";

export default function SensorConnectionFields({ sensor, equipment, sensors, assets, onChange, section = "all" }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), [sensor.id, equipment.id]);
  const connected = Boolean(sensor.serverSensorId);
  const demoConnection = sensor.dataSource === "DEMO";
  const projectId = readProjects().activeId;
  const payload = calibrationPayload(projectId, equipment, sensor, assets);
  const configured = sensor.calibration?.signature === JSON.stringify(payload);
  const frameKey = referenceFrameKey(payload.coordinateFrame);
  const confirmed = sensor.calibrationConfirmed === true && (!payload.coordinateFrame || sensor.calibrationConfirmationFrame === frameKey) && (!(sensor.surfaceMount || sensor.scanSlotMount) || sensor.calibrationConfirmationModel === payload.model.version);
  async function connect(demo = false) {
    if (busy || connected) return;
    const serialNumber = sensor.serialNumber?.trim();
    if (!serialNumber) { setMessage("시리얼 번호를 입력하세요."); return; }
    const testCase = serialNumber === "testcase";
    const useDemo = demo || testCase;
    if (!testCase && sensors.some((item) => item.id !== sensor.id && item.serialNumber?.trim() === serialNumber)) { setMessage("이미 등록된 시리얼 번호입니다. 센서는 하나의 설비에만 연결할 수 있습니다."); return; }
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage("");
    try {
      const result = testCase ? { id: `demo:testcase:${sensor.id}`, serialNumber, equipmentId: equipment.id }
        : demo ? demoSensor(serialNumber, equipment.id, sensor.deviceKind ?? "VISION") : await lookupSensor(serialNumber, equipment.id, request.signal);
      if (request.signal.aborted) return;
      if (sensors.some((item) => item.id !== sensor.id && item.serverSensorId != null && String(item.serverSensorId) === result.id))
        throw new Error("이미 등록된 센서입니다. 기존 센서 연결을 확인하세요.");
      onChange(sensor.id, sensorLookupChanges(result, sensor, equipment.id, useDemo));
    } catch (error) { if (!request.signal.aborted) setMessage(sensorLookupErrorMessage(error)); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function save() {
    setMessage("");
    try {
      validateCalibration(payload);
      if (!confirmed) throw new Error("위치·화각 수동 보정 확인을 먼저 선택하세요.");
      setBusy(true);
      const request = new AbortController(); controller.current = request;
      const remote = monitoringApiBase && !projectApiBase && sensor.dataSource !== "DEMO";
      let storedRemotely = false;
      let result = { revision: sensor.calibration?.revision ?? 0 };
      if (remote) try {
        result = await saveSensorCalibration(payload, result.revision, request.signal);
        storedRemotely = true;
      } catch { /* Keep the validated calibration in the local project on failure. */ }
      if (request.signal.aborted) return;
      onChange(sensor.id, { calibration: { ...result, payload, signature: JSON.stringify(payload), savedAt: new Date().toISOString(), storage: storedRemotely ? "SERVER" : "LOCAL" } });
      setMessage(storedRemotely ? "센서 보정값을 서버에 저장했습니다." : "센서 보정값을 로컬 구성에 보관했습니다. 프로젝트 저장·ZIP 내보내기에 포함됩니다.");
    } catch (error) { if (!controller.current?.signal.aborted) setMessage(error.message); }
    finally { if (!controller.current?.signal.aborted) setBusy(false); }
  }
  return <div className={styles.content}>
    {section !== "calibration" && <>
    <label className={styles.field} data-setup-field="sensor-serial"><span>센서 시리얼 번호 · 필수</span><input required value={sensor.serialNumber ?? ""} disabled={busy} onChange={(event) => {
      const value = event.target.value.trim();
      if (value !== sensor.serialNumber) { setMessage(""); onChange(sensor.id, sensorSerialChanges(value)); }
    }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void connect(); } }} /></label>
    {connected ? <div className={styles.sensorConnectionStatus} data-setup-field="sensor-lookup" role="status" aria-atomic="true">
      <div><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg><strong>{demoConnection ? "테스트 연결 완료" : "연결 확인 완료"}</strong></div>
      <span>{demoConnection ? "화면 검토용 가상 센서입니다." : "설치 위치에서 센서를 배치하세요."}</span>
    </div> : <>
      <button type="button" data-setup-field="sensor-lookup" disabled={busy || !sensor.serialNumber?.trim()} onClick={() => connect()}>{busy ? "확인 중…" : "센서 확인"}</button>
      {!monitoringApiBase && <button type="button" disabled={busy || !sensor.serialNumber} onClick={() => connect(true)}>입력한 번호로 예시 센서 연결</button>}
    </>}
    {connected ? <dl className={styles.summary} aria-label="확인된 센서 연결">
      <div><dt>{demoConnection ? "예시 센서" : "센서 ID"}</dt><dd>{sensor.serverSensorId}</dd></div>
      <div><dt>사용 설비</dt><dd>{equipment.name || equipment.id}</dd></div>
    </dl> : <p className={styles.help}>센서 존재 여부와 다른 설비의 연결 여부를 확인합니다.</p>}
    <p className={styles.help}>{connected ? "다른 센서를 사용하려면 시리얼 번호를 변경하세요." : "에디터에서는 연결과 배치를 설정합니다. 실시간 값과 통신 상태는 뷰어에서 확인하세요."}</p>
    </>}
    {section !== "connection" && <>
    <label className={styles.check} data-setup-field="sensor-calibration"><input type="checkbox" required checked={confirmed} onChange={(event) => onChange(sensor.id, { calibrationConfirmed: event.target.checked, calibrationConfirmationModel: payload.model.version, calibrationConfirmationFrame: frameKey })} />위치·화각 수동 보정 확인 · 필수</label>
    <button type="button" disabled={busy || !sensor.serverSensorId} onClick={save}>보정값 저장{monitoringApiBase && !projectApiBase && sensor.dataSource !== "DEMO" ? "·서버 전송" : "·로컬"}</button>
    <button type="button" onClick={() => { try { downloadMonitoringJson("sensor-calibration.json", validateCalibration(payload)); setMessage("현재 보정 좌표를 내보냈습니다."); } catch (error) { setMessage(error.message); } }}>보정 좌표 내보내기</button>
    <p className={styles.help}>{configured ? `보정 저장됨 · ${sensor.calibration.storage === "SERVER" ? "서버" : "브라우저"}` : "위치와 방향을 확인한 뒤 다시 저장하세요."}</p>
    </>}
    {message && <p role="status" className={styles.help}>{message}</p>}
  </div>;
}
