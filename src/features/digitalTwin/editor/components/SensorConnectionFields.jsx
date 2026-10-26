import { useEffect, useRef, useState } from "react";
import { getSensorCapabilities } from "../model/equipmentDetailModel";
import { readProjects } from "@/features/portal/projects/projectRepository";
import { lookupSensor, monitoringApiBase, saveSensorCalibration } from "../api/monitoringClient";
import { calibrationPayload, downloadMonitoringJson, validateCalibration } from "../model/monitoringContract";
import { demoSensor } from "../model/monitoringDemo";
import styles from "./MonitoringSettingsPanel.module.css";
import { referenceFrameKey } from "../model/equipmentCoordinateFrame.js";

export default function SensorConnectionFields({ sensor, equipment, sensors, assets, onChange, section = "all" }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const projectId = readProjects().activeId;
  const payload = calibrationPayload(projectId, equipment, sensor, assets);
  const configured = sensor.calibration?.signature === JSON.stringify(payload);
  const frameKey = referenceFrameKey(payload.coordinateFrame);
  const confirmed = sensor.calibrationConfirmed === true && (!payload.coordinateFrame || sensor.calibrationConfirmationFrame === frameKey) && (!sensor.surfaceMount || sensor.calibrationConfirmationModel === payload.model.version);
  async function connect(demo = false) {
    const serialNumber = sensor.serialNumber?.trim();
    if (!serialNumber) { setMessage("시리얼 번호를 입력하세요."); return; }
    if (sensors.some((item) => item.id !== sensor.id && item.serialNumber === serialNumber)) { setMessage("이미 등록된 시리얼 번호입니다. 센서는 하나의 설비에만 연결할 수 있습니다."); return; }
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage("");
    try {
      const result = demo ? demoSensor(serialNumber, equipment.id, sensor.deviceKind ?? "VISION") : await lookupSensor(serialNumber, equipment.id, request.signal);
      if (request.signal.aborted) return;
      onChange(sensor.id, { serverSensorId: result.id, serverKey: result.serverKey ?? result.id, serialNumber,
        capabilities: sensor.capabilities?.length ? sensor.capabilities : getSensorCapabilities(result), equipmentIds: [equipment.id], deviceKind: result.deviceKind ?? sensor.deviceKind, sensorType: result.sensorType ?? sensor.sensorType,
        frameUrl: result.frameUrl ?? "", frameMeasuredAt: result.frameMeasuredAt ?? null, dataSource: demo ? "DEMO" : "SERVER",
        connectionStatus: result.connectionStatus ?? "CONNECTED", reportedCapabilities: result.capabilities ?? [],
        fieldOfView: result.fieldOfView ?? sensor.fieldOfView, aspectRatio: result.aspectRatio ?? sensor.aspectRatio,
        resolution: result.resolution ?? null, intrinsics: result.intrinsics ?? null, intrinsicCalibrationId: result.intrinsicCalibrationId ?? null,
        calibration: null, calibrationConfirmed: false });
      setMessage(demo ? "예시 센서입니다. 영상과 신호는 실측이 아닙니다." : "센서를 조회했습니다. 설치 위치를 설정하고 이미지·텍스처에서 수신 영상을 편집하세요.");
    } catch (error) { if (!request.signal.aborted) setMessage(error.message); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function save() {
    setMessage("");
    try {
      validateCalibration(payload);
      if (!confirmed) throw new Error("위치·화각 수동 보정 확인을 먼저 선택하세요.");
      setBusy(true);
      const request = new AbortController(); controller.current = request;
      const remote = monitoringApiBase && sensor.dataSource !== "DEMO";
      const result = remote ? await saveSensorCalibration(payload, sensor.calibration?.revision ?? 0, request.signal) : { revision: sensor.calibration?.revision ?? 0 };
      if (request.signal.aborted) return;
      onChange(sensor.id, { calibration: { ...result, payload, signature: JSON.stringify(payload), savedAt: new Date().toISOString(), storage: remote ? "SERVER" : "LOCAL" } });
      setMessage(remote ? "센서 보정값을 서버에 저장했습니다." : "이 브라우저에만 보관했습니다. 서버에는 저장되지 않았습니다.");
    } catch (error) { if (!controller.current?.signal.aborted) setMessage(error.message); }
    finally { if (!controller.current?.signal.aborted) setBusy(false); }
  }
  return <div className={styles.content}>
    {section !== "calibration" && <>
    <label className={styles.field}><span>센서 시리얼 번호</span><input value={sensor.serialNumber ?? ""} disabled={busy} onChange={(event) => {
      setMessage(""); onChange(sensor.id, { serialNumber: event.target.value.trim(), serverSensorId: null, serverKey: "", frameUrl: "", frameMeasuredAt: null, dataSource: null, calibration: null, calibrationConfirmed: false });
    }} /></label>
    <button type="button" disabled={busy || !sensor.serialNumber} onClick={() => connect()}>{busy ? "처리 중…" : "시리얼 번호로 센서 조회"}</button>
    {!monitoringApiBase && <button type="button" disabled={busy || !sensor.serialNumber} onClick={() => connect(true)}>입력한 번호로 예시 센서 연결</button>}
    <p className={styles.help}>{sensor.serverSensorId ? `${sensor.dataSource === "DEMO" ? "예시 연결" : "조회된 센서"} · ${sensor.serverSensorId}` : "센서 조회 대기"}</p>
    </>}
    {section !== "connection" && <>
    <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={(event) => onChange(sensor.id, { calibrationConfirmed: event.target.checked, calibrationConfirmationModel: payload.model.version, calibrationConfirmationFrame: frameKey })} />위치·화각 수동 보정 확인</label>
    <button type="button" disabled={busy || !sensor.serverSensorId} onClick={save}>보정값 저장{monitoringApiBase && sensor.dataSource !== "DEMO" ? "·서버 전송" : "·로컬"}</button>
    <button type="button" onClick={() => { try { downloadMonitoringJson("sensor-calibration.json", validateCalibration(payload)); setMessage("현재 보정 좌표를 내보냈습니다."); } catch (error) { setMessage(error.message); } }}>보정 좌표 내보내기</button>
    <p className={styles.help}>{configured ? `보정 저장됨 · ${sensor.calibration.storage === "SERVER" ? "서버" : "브라우저"}` : "위치와 방향을 확인한 뒤 다시 저장하세요."}</p>
    </>}
    {message && <p role="status" className={styles.help}>{message}</p>}
  </div>;
}
