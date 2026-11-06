import { useEffect, useMemo, useRef, useState } from "react";
import { requestPointAudio } from "../api/monitoringClient";
import { getEquipmentCoordinateFrame, modelToReference, modelToScanSlot, scanSlotForModelPosition, scanSlotFrame } from "../model/equipmentCoordinateFrame.js";
import { roiAudioSelection } from "../model/roiMonitoring.js";
import { isObservationRoi, roiToObservationPoint } from "../model/roiMonitoring.js";
import { observationReadings } from "../model/observationReadings.js";
import { demoAudioBlob } from "../model/monitoringDemo.js";
import ViewerThermalPreview from "./ViewerThermalPreview.jsx";
import styles from "./MonitoringRoiWorkspace.module.css";

const STATUS = { DISCONNECTED: "서버 미연결", CONNECTING: "연결 중", CONNECTED: "수신 중", RECONNECTING: "재연결 중", ERROR: "연결 오류", DEMO: "수신 중" };
export default function MonitoringDataPanel({ section = "AUDIO", equipment, projectId, equipmentId, telemetry, opacity, setOpacity, point, picking, setPicking, layerError, model, sensorView, availability, thermalReadouts = [], rois, readings = [], sensors = [], simulationTargetRoiId = "", onSimulationTargetChange, onRoiSelect, onClose }) {
  const [source, setSource] = useState("ROI");
  const [roiId, setRoiId] = useState("");
  const [audio, setAudio] = useState(null);
  const [listening, setListening] = useState(true);
  const [volume, setVolume] = useState(.8);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef(null), queuedAudio = useRef(null), requestSequence = useRef(0);
  const selectedRoi = rois.find((roi) => roi.id === (telemetry.simulated ? simulationTargetRoiId : roiId));
  const audioReading = selectedRoi && isObservationRoi(selectedRoi)
    ? observationReadings(roiToObservationPoint(selectedRoi), sensors, readings, telemetry.now).find((row) => row.metric === "ultrasound.db") : null;
  const spectrum = Array.isArray(audioReading?.spectrum) ? audioReading.spectrum : audioReading?.spectrum?.bins ?? [];
  const sampledSpectrum = spectrum.filter((_, index) => index % Math.max(1, Math.ceil(spectrum.length / 48)) === 0);
  const spectrumTrace = sampledSpectrum.map((entry, index) => {
    const level = Number(Array.isArray(entry) ? entry[1] : entry.levelDb);
    return `${index ? "L" : "M"}${8 + index / Math.max(1, sampledSpectrum.length - 1) * 272},${94 - Math.min(100, Math.max(0, level)) * .8}`;
  }).join(" ");
  const coordinateFrame = useMemo(() => getEquipmentCoordinateFrame(equipment), [equipment]);
  const referencePoint = useMemo(() => {
    if (!point) return point;
    const slot = scanSlotForModelPosition(equipment, point.position);
    return { ...point,
      ...(coordinateFrame ? { schemaVersion: 2, coordinateFrame, position: Object.values(modelToReference(point.position, coordinateFrame)) } : {}),
      ...(slot ? { scanSlot: { side: slot.side, index: slot.index }, slotFrame: scanSlotFrame(equipment, slot),
        slotPosition: Object.values(modelToScanSlot(point.position, slot)) } : {}) };
  }, [point, coordinateFrame, equipment]);
  const selection = useMemo(() => source === "ROI" ? selectedRoi ? roiAudioSelection(selectedRoi, equipment) : null : referencePoint, [source, selectedRoi, equipment, referencePoint]);
  const pointKey = JSON.stringify([selection, equipmentId]);
  useEffect(() => {
    if (section !== "AUDIO" || !selection || !listening || telemetry.simulated) return;
    const controller = new AbortController();
    let active = true, timer, lastRevision = "";
    const poll = async () => {
      try {
        const result = await requestPointAudio(projectId, equipmentId, { ...selection, model }, controller.signal);
        if (!active) return;
        const revision = JSON.stringify([result.url, result.measuredAt ?? null]);
        if (revision !== lastRevision) {
          lastRevision = revision;
          const next = { ...result, key: pointKey, sequence: ++requestSequence.current };
          if (!audioRef.current || audioRef.current.ended || audioRef.current.paused) setAudio(next);
          else queuedAudio.current = next;
        }
        setError("");
      } catch (issue) { if (active && !controller.signal.aborted) setError(issue.message); }
      finally { if (active) timer = setTimeout(poll, 3000); }
    };
    queueMicrotask(() => { if (active) void poll(); });
    return () => { active = false; clearTimeout(timer); controller.abort(); queuedAudio.current = null; };
  }, [section, selection, listening, projectId, equipmentId, model, pointKey, telemetry.simulated]);
  useEffect(() => {
    if (section !== "AUDIO" || !selection || !listening || !telemetry.simulated || (source === "ROI" && audioReading?.value == null)) return undefined;
    const url = URL.createObjectURL(demoAudioBlob());
    queueMicrotask(() => setAudio({ url, key: pointKey, sequence: ++requestSequence.current }));
    return () => URL.revokeObjectURL(url);
  }, [section, pointKey, selection, listening, telemetry.simulated, audioReading?.value, source]);
  const currentAudio = listening && (!telemetry.simulated || (source === "SURFACE" || audioReading?.value != null)) && audio?.key === pointKey ? audio : null;
  useEffect(() => { if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.muted = muted; } }, [volume, muted, currentAudio]);
  const title = { AUDIO: "소리 듣기", THERMAL: "열화상", ALARMS: "경고 이벤트" }[section];
  return <>
    <header className={styles.panelHeader}><strong>{title}</strong><button type="button" aria-label={`${title} 닫기`} onClick={onClose}>닫기</button></header>
    {section === "ALARMS" && <p className={styles.connectionStatus} role="status">{STATUS[telemetry.status]}</p>}
    {section === "THERMAL" && <>
      {thermalReadouts.map((item) => <section key={item.id} className={styles.thermalReadout} aria-label={thermalReadouts.length > 1 ? `${item.identifier} 온도 분포` : "열화상 온도 분포"}>
        {thermalReadouts.length > 1 && <div className={styles.thermalReadoutHeading}><span>{item.identifier}</span>{item.measuredAt && <small>{new Date(item.measuredAt).toLocaleTimeString("ko-KR")}</small>}</div>}
        {item.summary ? <dl className={styles.thermalMetrics}>
          <div><dt>최저</dt><dd>{item.summary.min.toFixed(1)}<small> ℃</small></dd></div>
          <div><dt>평균</dt><dd>{item.summary.average.toFixed(1)}<small> ℃</small></dd></div>
          <div><dt>최고</dt><dd>{item.summary.max.toFixed(1)}<small> ℃</small></dd></div>
        </dl> : <p className={styles.hint}>온도 픽셀 데이터가 없어 온도 지표를 표시할 수 없습니다.</p>}
        <ViewerThermalPreview grid={item.grid} summary={item.summary} />
      </section>)}
      {!thermalReadouts.length && <p className={styles.hint}>{telemetry.legend ? `온도 범위 ${telemetry.legend.min} ~ ${telemetry.legend.max} ℃` : "열화상 데이터 수신 대기"}</p>}
      {!availability.THERMAL && thermalReadouts.length > 0 && <p role="status" className={styles.hint}>최신 열화상 수신 대기</p>}
    </>}
    {(layerError || (section === "ALARMS" && telemetry.error)) && <p className={styles.error} role="alert">{layerError || telemetry.error}</p>}
    {section === "AUDIO" && <>
    <p className={styles.hint}>표면이나 관측 영역을 선택할 때마다 해당 위치의 소리를 새로 요청해 재생합니다.</p>
    <select aria-label="소리 선택 방식" value={source} onChange={(event) => { const next = event.target.value; setSource(next); setPicking(next === "SURFACE" && Boolean(equipmentId) && !sensorView); onRoiSelect(next === "ROI" ? roiId : ""); setError(""); }}><option value="SURFACE">3D 표면에서 위치 선택</option><option value="ROI">ROI 목록에서 영역 선택</option></select>
    <div className={styles.audioSourceDetail}>
    {source === "SURFACE" ? <>
      <button type="button" disabled={!equipmentId || sensorView} aria-pressed={picking} onClick={() => setPicking(!picking)}>{picking ? "위치 선택 일시 중지" : "3D 표면 선택 재개"}</button>
      {sensorView && <p className={styles.hint}>자유 시점에서 위치를 선택하세요.</p>}
      {point && <small className={styles.hint}>선택 위치 · {referencePoint.position.map((value) => value.toFixed(2)).join(", ")} m</small>}
    </> : <>
      <label>소리를 들을 영역<select aria-label="소리를 들을 ROI" value={selectedRoi?.id ?? ""} onChange={(event) => { setRoiId(event.target.value); onSimulationTargetChange?.(event.target.value); onRoiSelect(event.target.value); }}><option value="">관측 영역 선택</option>{rois.map((roi) => <option key={roi.id} value={roi.id}>{roi.name}</option>)}</select></label>
      {!rois.length && <p className={styles.hint}>저장된 ROI가 없습니다.</p>}
    </>}
    </div>
    {source === "ROI" && audioReading?.value !== null && audioReading?.value !== undefined && <div className={styles.audioSignal} role="status"><span>선택 영역의 초음파</span><strong>{audioReading.value.toFixed(1)} <small>dB</small></strong><small>{audioReading.state?.label ?? "수신 중"}</small></div>}
    {source === "ROI" && sampledSpectrum.length > 1 && <div className={styles.audioSpectrum}><div><strong>주파수 분포</strong><small>0–100 kHz · dB</small></div><svg viewBox="0 0 288 112" role="img" aria-label={`초음파 FFT 주파수 분포, ${sampledSpectrum.length}개 구간`}><path d="M8 14 V94 H280" className={styles.audioSpectrumAxis} /><path d={spectrumTrace} className={styles.audioSpectrumTrace} /><text x="8" y="108">0</text><text x="280" y="108" textAnchor="end">100 kHz</text></svg></div>}
    <div className={styles.audioPlayback}>
      <button type="button" disabled={!selection} aria-pressed={listening} onClick={() => { if (listening) { setAudio(null); queuedAudio.current = null; setError(""); } setListening(!listening); }}>{listening ? "듣기 일시정지" : "듣기 재개"}</button>
      <label>볼륨 · {muted ? "음소거" : `${Math.round(volume * 100)}%`}<input aria-label="초음파 볼륨" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
      <button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)}>{muted ? "음소거 해제" : "음소거"}</button>
    </div>
    {selection && listening && !currentAudio && !error && <p className={styles.hint} role="status">새 음원을 기다리는 중입니다.</p>}
    {currentAudio && <audio ref={audioRef} key={`${pointKey}:${currentAudio.sequence}`} controls autoPlay loop={telemetry.simulated} src={currentAudio.url} preload="metadata" aria-label="선택 위치 음원" onEnded={() => { setAudio(queuedAudio.current); queuedAudio.current = null; }} onCanPlay={(event) => { void event.currentTarget.play().catch((issue) => { if (issue.name === "NotAllowedError") setError("브라우저가 자동 재생을 차단했습니다. 재생 버튼을 눌러주세요."); }); }} onError={() => setError("음원을 재생할 수 없습니다. 서버의 오디오 형식을 확인하세요.")} />}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {section === "ALARMS" && <>
    <strong>미확인 경고 {telemetry.alarms.filter((alarm) => !alarm.acknowledgedAt).length}건</strong>
    {!telemetry.alarms.length && <p className={styles.hint}>수신한 경고 이벤트가 없습니다.</p>}
    <div className={styles.list}>{telemetry.alarms.map((alarm) => <article key={alarm.id} data-status={alarm.severity}><strong>{alarm.severity === "DANGER" ? "위험" : "주의"} · {alarm.name ?? alarm.roiId ?? "설비"}</strong><p>{alarm.message}</p><small>{new Date(alarm.occurredAt).toLocaleTimeString("ko-KR")}</small><button type="button" disabled={Boolean(alarm.acknowledgedAt)} onClick={async () => { try { await telemetry.acknowledge(alarm); } catch (issue) { setError(issue.message); } }}>{alarm.acknowledgedAt ? "확인됨" : "경고 확인"}</button></article>)}</div>
    </>}
    {section === "THERMAL" && <label className={styles.thermalOpacity}>열화상 불투명도 · {Math.round(opacity * 100)}%<input aria-label="열화상 불투명도" type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>}
  </>;
}
