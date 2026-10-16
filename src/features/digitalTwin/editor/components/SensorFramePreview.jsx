import { useEffect, useRef, useState } from "react";
import { getSensorFrame } from "../api/monitoringClient";
import { mediaUrl } from "../model/monitoringContract";
import styles from "./EquipmentDetailWorkspace.module.css";

export default function SensorFramePreview({ sensor, sensorView, onSensorViewChange }) {
  const [frame, setFrame] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const demo = sensor.dataSource === "DEMO";
  const latest = frame?.sensorId === sensor.serverSensorId ? frame : { url: sensor.frameUrl, measuredAt: sensor.frameMeasuredAt };
  const source = mediaUrl(latest.url, demo);
  async function refresh() {
    requestRef.current?.abort(); const request = new AbortController(); requestRef.current = request;
    setBusy(true); setError("");
    try { const value = await getSensorFrame(sensor.serverSensorId, request.signal); if (!request.signal.aborted) setFrame(value); }
    catch (issue) { if (!request.signal.aborted) setError(issue.message); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  return <aside className={styles.framePreview} data-camera-safe-ui aria-label="센서 스틸컷 비교">
    <header><strong>{sensor.name} · {demo ? "예시 영상" : "관측 이미지"}</strong><button type="button" disabled={!sensor.serverSensorId || demo || busy} onClick={refresh}>{busy ? "조회 중…" : "최신 영상 조회"}</button></header>
    {source ? <img key={source} src={source} alt={`${sensor.name} ${demo ? "예시 이미지 · 실측 아님" : "관측 이미지"}`} onError={() => setError("이미지를 불러오지 못했습니다. 주소와 서버 접근 권한을 확인하세요.")} /> : <p>시리얼 번호로 센서를 조회하면 관측 영상을 표시합니다.</p>}
    {latest.measuredAt && <small>촬영 {new Date(latest.measuredAt).toLocaleString("ko-KR")}</small>}
    {error && <p role="alert">{error}</p>}
    <button type="button" aria-pressed={sensorView} onClick={() => onSensorViewChange?.(!sensorView)}>{sensorView ? "자유 시점으로 돌아가기" : "센서 시점으로 비교"}</button>
    <small>{sensorView ? "센서 위치·회전·화각을 조정하면 3D 시점도 함께 움직입니다. 여백은 영상 종횡비를 맞추기 위한 영역입니다." : "관측 영상과 센서 시점의 3D 모델을 비교해 위치·방향을 보정하세요."}</small>
  </aside>;
}
