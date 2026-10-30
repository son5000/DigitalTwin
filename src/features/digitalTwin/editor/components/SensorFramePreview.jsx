import { sensorHasImaging, getSensorCapabilities } from "../model/equipmentDetailModel";
import { useEffect, useRef, useState } from "react";
import { getSensorFrame } from "../api/monitoringClient";
import { mediaUrl } from "../model/monitoringContract";
import { activeVisionSample, normalizeSensorProjection } from "../model/sensorImageTransform";
import { activeThermalSample } from "../model/thermalFrame";
import useSensorProjectionFrames from "../store/useSensorProjectionFrames";
import useThermalImage from "../store/useThermalImage";
import styles from "./EquipmentDetailWorkspace.module.css";

export default function SensorFramePreview({ sensor, sensorView, onSensorViewChange }) {
  const [frame, setFrame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const imaging = sensorHasImaging(sensor);
  const demo = sensor.dataSource === "DEMO";
  const capabilities = getSensorCapabilities(sensor);
  const projection = normalizeSensorProjection({ kind: capabilities.includes("THERMAL") && !capabilities.includes("VISION") ? "THERMAL" : "VISION", ...sensor.textureProjection });
  const sample = projection.kind === "THERMAL" ? activeThermalSample(sensor) : activeVisionSample(sensor);
  const samples = useSensorProjectionFrames(projection.kind === "THERMAL" && sample ? [{ ...sensor, textureProjection: { ...projection, enabled: true } }] : []);
  const latest = sample ? projection.kind === "THERMAL" ? samples[0] ?? {} : sample
    : frame && frame.sensorId === sensor.serverSensorId && frame.kind === projection.kind ? frame : projection.kind === "VISION" ? { url: sensor.frameUrl, measuredAt: sensor.frameMeasuredAt } : {};
  const thermal = useThermalImage(latest.temperatureGrid, projection);
  const source = thermal.source || mediaUrl(latest.url, demo);
  async function refresh() {
    requestRef.current?.abort(); const request = new AbortController(); requestRef.current = request;
    setBusy(true); setError("");
    try { const value = await getSensorFrame(sensor.serverSensorId, request.signal, projection.kind); if (!request.signal.aborted) setFrame({ ...value, kind: projection.kind }); }
    catch (issue) { if (!request.signal.aborted) setError(issue.message); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  return <aside className={styles.framePreview} data-camera-safe-ui aria-label="센서 방향·관측 이미지 확인">
    <header><strong>{sensor.name} · {imaging ? sample ? "샘플 테스트" : demo ? "예시 영상" : "관측 이미지" : "정면 방향 확인"}</strong>{imaging && <button type="button" disabled={!sensor.serverSensorId || demo || sample || busy} onClick={refresh}>{busy ? "조회 중…" : "최신 영상 조회"}</button>}</header>
    {imaging && (source ? <img key={source} src={source} alt={`${sensor.name} ${sample ? "샘플 이미지 · 실시간 수신 아님" : demo ? "예시 이미지 · 실측 아님" : "관측 이미지"}`} onError={() => setError("이미지를 불러오지 못했습니다. 주소와 서버 접근 권한을 확인하세요.")} /> : <p>{sample ? "열화상 샘플을 불러오는 중입니다." : projection.kind === "THERMAL" ? "이미지·텍스처에서 열화상 CSV 샘플을 불러오거나 서버를 연결하세요." : "시리얼 번호로 센서를 조회하면 관측 영상을 표시합니다."}</p>)}
    {thermal.summary && <small>최저 {thermal.summary.min.toFixed(2)} / 최고 {thermal.summary.max.toFixed(2)}°C · 색상 범위 자동 적용</small>}
    {latest.error && <p role="alert">{latest.error}</p>}
    {latest.measuredAt && <small>촬영 {new Date(latest.measuredAt).toLocaleString("ko-KR")}</small>}
    {sample && <small>샘플 이미지 · 실시간 수신 아님</small>}
    {error && <p role="alert">{error}</p>}
    <button type="button" aria-pressed={sensorView} onClick={() => onSensorViewChange?.(!sensorView)}>{sensorView ? "자유 시점으로 돌아가기" : "센서 정면 시점 확인"}</button>
    <small>{sensorView ? "센서 위치·회전·화각을 조정하면 3D 시점도 함께 움직입니다. 여백은 영상 종횡비를 맞추기 위한 영역입니다." : "청록색 화살표가 센서의 정면입니다. 센서 정면 시점에서 바라보는 설비 위치를 확인하세요."}</small>
  </aside>;
}
