import { useEffect, useRef, useState } from "react";
import { requestPointAudio } from "../api/monitoringClient";
import { demoAudioBlob } from "../model/monitoringDemo";
import { MONITORING_MODES } from "../model/monitoringContract";
import { roiAudioSelection } from "../model/roiMonitoring.js";
import styles from "./MonitoringRoiWorkspace.module.css";

const STATUS = { DISCONNECTED: "서버 미연결", CONNECTING: "연결 중", CONNECTED: "수신 중", RECONNECTING: "재연결 중", ERROR: "연결 오류", DEMO: "예시 모드 · 실측 아님" };
export default function MonitoringDataPanel({ projectId, equipmentId, telemetry, mode, setMode, opacity, setOpacity, point, picking, setPicking, fps, layerError, model, sensorView, availability, rois, onRoiSelect, onClose }) {
  const [source, setSource] = useState("SURFACE");
  const [roiId, setRoiId] = useState("");
  const [processing, setProcessing] = useState("AUDIBLE");
  const [audio, setAudio] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const pending = useRef(null), audioObjectUrl = useRef(null);
  const selectedRoi = rois.find((roi) => roi.id === roiId);
  const selection = source === "ROI" ? selectedRoi ? roiAudioSelection(selectedRoi) : null : point;
  const pointKey = JSON.stringify([selection, equipmentId, telemetry.demo, processing]);
  useEffect(() => () => { pending.current?.abort(); if (audioObjectUrl.current) URL.revokeObjectURL(audioObjectUrl.current); }, [pointKey]);
  async function listen() {
    pending.current?.abort(); const request = new AbortController(); pending.current = request;
    setBusy(pointKey); setError(""); setAudio(null);
    try {
      if (audioObjectUrl.current) { URL.revokeObjectURL(audioObjectUrl.current); audioObjectUrl.current = null; }
      let result;
      if (telemetry.demo) { const url = URL.createObjectURL(demoAudioBlob(processing)); audioObjectUrl.current = url; result = { url }; }
      else result = await requestPointAudio(projectId, equipmentId, { ...selection, model }, processing, request.signal);
      if (!request.signal.aborted) setAudio({ ...result, key: pointKey });
    } catch (issue) { if (!request.signal.aborted) setError(issue.message); }
    finally { if (!request.signal.aborted) setBusy(null); }
  }
  const currentAudio = audio?.key === pointKey ? audio : null;
  const currentBusy = busy === pointKey;
  return <>
    <header><strong>관측 데이터</strong><button type="button" aria-label="관측 데이터 닫기" onClick={onClose}>닫기</button></header>
    <div className={styles.modeButtons} role="group" aria-label="관측 데이터 표시">{Object.entries(MONITORING_MODES).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>
    {["VISION", "THERMAL"].includes(mode) && <label>영상 투명도<input aria-label="영상 투명도" type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>}
    {mode === "THERMAL" && <p className={styles.hint}>{telemetry.demo ? "예시 색상: 파랑 → 빨강 → 노랑" : telemetry.legend ? `온도 범위 ${telemetry.legend.min} ~ ${telemetry.legend.max} ℃` : "온도 범례 수신 대기"}</p>}
    {!telemetry.demo && mode !== "MODEL" && !availability[mode] && <p role="status" className={styles.hint}>선택한 관측 데이터 수신 대기</p>}
    {(layerError || telemetry.error) && <p className={styles.error} role="alert">{layerError || telemetry.error}</p>}
    <hr />
    <strong>선택 위치 소리 듣기</strong>
    <select aria-label="소리 선택 방식" value={source} onChange={(event) => { setSource(event.target.value); setPicking(false); onRoiSelect(event.target.value === "ROI" ? roiId : ""); setError(""); }}><option value="SURFACE">3D 표면에서 위치 선택</option><option value="ROI">ROI 목록에서 영역 선택</option></select>
    {source === "SURFACE" ? <>
      <button type="button" disabled={!equipmentId || sensorView} aria-pressed={picking} onClick={() => setPicking(!picking)}>{picking ? "위치 선택 취소" : point ? "3D 표면에서 다시 선택" : "3D 표면에서 위치 선택"}</button>
      {sensorView && <p className={styles.hint}>자유 시점에서 위치를 선택하세요.</p>}
      {point && <small className={styles.hint}>선택 위치 · {point.position.map((value) => value.toFixed(2)).join(", ")} m</small>}
    </> : <>
      <select aria-label="소리를 들을 ROI" value={selectedRoi?.id ?? ""} onChange={(event) => { setRoiId(event.target.value); onRoiSelect(event.target.value); }}><option value="">관측 영역 선택</option>{rois.map((roi) => <option key={roi.id} value={roi.id}>{roi.name}</option>)}</select>
      {!rois.length && <p className={styles.hint}>저장된 ROI가 없습니다.</p>}
    </>}
    <button type="button" disabled={!selection || currentBusy} onClick={listen}>{currentBusy ? "음원 요청 중…" : telemetry.demo ? "예시 음원 준비" : source === "ROI" ? "선택 ROI 소리 듣기" : "선택 위치 소리 듣기"}</button>
    {currentAudio && <><audio key={`${pointKey}:${currentAudio.url}`} controls src={currentAudio.url} preload="metadata" aria-label={telemetry.demo ? "합성 예시 음원" : "선택 위치 음원"} onError={() => setError("음원을 재생할 수 없습니다. 서버의 오디오 형식을 확인하세요.")} /><small>{telemetry.demo ? "합성 테스트 톤 · 실제 위치의 소리가 아닙니다." : "서버에서 처리한 음원입니다."}</small></>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <details className={styles.moreOptions}><summary>추가 옵션 · {STATUS[telemetry.status]}</summary>
    <label>음원 처리<select value={processing} onChange={(event) => setProcessing(event.target.value)}><option value="AUDIBLE">가청 음원</option><option value="HETERODYNE">초음파 가청 변환</option></select></label>
    <label className={styles.check}><input type="checkbox" checked={telemetry.demo} onChange={(event) => telemetry.setDemo(event.target.checked)} />예시 데이터 · 실측 아님</label>
    <p className={styles.hint}>렌더링 {fps === null ? "측정 중" : `${fps} fps`}</p>
    </details>
    <details className={styles.moreOptions}><summary>경고 이벤트 · {telemetry.alarms.filter((alarm) => !alarm.acknowledgedAt).length}건</summary>
    {telemetry.demo && <button type="button" onClick={telemetry.simulateAlarm}>경고 수신 시험</button>}
    {!telemetry.alarms.length && <p className={styles.hint}>수신한 경고 이벤트가 없습니다.</p>}
    <div className={styles.list}>{telemetry.alarms.map((alarm) => <article key={alarm.id} data-status={alarm.severity}><strong>{alarm.severity === "DANGER" ? "위험" : "주의"} · {alarm.name ?? alarm.roiId ?? "설비"}</strong><p>{alarm.message}</p><small>{new Date(alarm.occurredAt).toLocaleTimeString("ko-KR")}</small><button type="button" disabled={Boolean(alarm.acknowledgedAt)} onClick={async () => { try { await telemetry.acknowledge(alarm); } catch (issue) { setError(issue.message); } }}>{alarm.acknowledgedAt ? "확인됨" : "경고 확인"}</button></article>)}</div>
    </details>
  </>;
}
