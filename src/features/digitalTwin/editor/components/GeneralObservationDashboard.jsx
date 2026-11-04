import { useEffect, useMemo, useRef, useState } from "react";
import { monitoringApiBase, requestPointAudio } from "../api/monitoringClient.js";
import { roiAudioSelection } from "../model/roiMonitoring.js";
import { DEFAULT_FREQUENCY_BANDS } from "../model/observationProfiles.js";
import styles from "./GeneralObservationDashboard.module.css";

function spectrumBins(spectrum) {
  const bins = Array.isArray(spectrum) ? spectrum : spectrum?.bins;
  if (!Array.isArray(bins)) return [];
  return bins.slice(0, 4096).map((bin) => ({
    frequencyHz: Number(Array.isArray(bin) ? bin[0] : bin.frequencyHz),
    levelDb: Number(Array.isArray(bin) ? bin[1] : bin.levelDb),
  })).filter((bin) => Number.isFinite(bin.frequencyHz) && bin.frequencyHz >= 0 && Number.isFinite(bin.levelDb))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
}

export default function GeneralObservationDashboard({ roi, point, rows, equipment, projectId, model }) {
  const item = point.measurements.find((entry) => entry.metric === "GENERAL");
  const bands = item?.analysisConfig?.bands ?? DEFAULT_FREQUENCY_BANDS;
  const [bandId, setBandId] = useState("");
  const [listening, setListening] = useState(false);
  const [audio, setAudio] = useState(null);
  const [error, setError] = useState("");
  const audioRef = useRef(null), queuedAudio = useRef(null);
  const band = bands.find((entry) => entry.id === bandId);
  const bins = useMemo(() => spectrumBins(rows.find((entry) => entry.metric === "ultrasound.db")?.spectrum), [rows]);
  const visible = bins.filter((entry) => !band || entry.frequencyHz >= band.fromHz && entry.frequencyHz <= band.toHz);
  const sampled = visible.filter((_, index) => index % Math.max(1, Math.ceil(visible.length / 256)) === 0);
  const minDb = visible.length ? Math.floor(Math.min(...visible.map((entry) => entry.levelDb)) / 10) * 10 : 0;
  const maxDb = visible.length ? Math.ceil(Math.max(...visible.map((entry) => entry.levelDb), minDb + 10) / 10) * 10 : 100;
  const minHz = visible[0]?.frequencyHz ?? 0, maxHz = visible.at(-1)?.frequencyHz ?? 1;
  const trace = sampled.map((entry, index) => `${index ? "L" : "M"}${36 + (entry.frequencyHz - minHz) / Math.max(1, maxHz - minHz) * 580},${150 - (entry.levelDb - minDb) / Math.max(1, maxDb - minDb) * 130}`).join(" ");
  useEffect(() => {
    if (!listening || !monitoringApiBase) return undefined;
    const controller = new AbortController();
    let active = true, timer;
    const request = async () => {
      try {
        const selection = roiAudioSelection(roi, equipment);
        const result = await requestPointAudio(projectId, roi.equipmentId, { ...selection, model,
          ...(band ? { frequencyRangeHz: [band.fromHz, band.toHz] } : {}) }, controller.signal);
        if (active) {
          if (!audioRef.current || audioRef.current.ended || audioRef.current.paused) setAudio(result);
          else queuedAudio.current = result;
          setError("");
        }
      } catch (issue) { if (active && !controller.signal.aborted) setError(issue.message); }
      finally { if (active) timer = setTimeout(request, 3000); }
    };
    void request();
    return () => { active = false; clearTimeout(timer); controller.abort(); queuedAudio.current = null; };
  }, [listening, band, roi, equipment, projectId, model]);
  return <section className={styles.section} aria-label="주파수와 소리">
    <div className={styles.heading}><strong>초음파 주파수</strong><label>들을 대역<select value={bandId} onChange={(event) => { setBandId(event.target.value); setAudio(null); }}>
      <option value="">전체 대역</option>{bands.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.fromHz.toLocaleString()}–{entry.toHz.toLocaleString()} Hz</option>)}
    </select></label></div>
    {visible.length ? <svg className={styles.chart} viewBox="0 0 640 180" role="img" aria-label={`${band?.name ?? "전체 대역"} FFT 주파수 그래프, ${visible.length}개 측정 구간`}>
      <path d="M36 20 V150 H616" className={styles.axis} /><path d={trace} className={styles.trace} />
      <text x="36" y="170">{Math.round(minHz).toLocaleString()} Hz</text><text x="616" y="170" textAnchor="end">{Math.round(maxHz).toLocaleString()} Hz</text>
      <text x="8" y="25">{maxDb}</text><text x="8" y="150">{minDb}</text>
    </svg> : <p className={styles.empty}>이 영역의 FFT 주파수 데이터 수신 대기</p>}
    <div className={styles.audioRow}><button type="button" disabled={!monitoringApiBase} aria-pressed={listening} onClick={() => { setListening((value) => !value); setAudio(null); queuedAudio.current = null; }}>{listening ? "듣기 중지" : "이 영역의 소리 듣기"}</button>
      {!monitoringApiBase && <small>관측 서버 연결 후 소리를 들을 수 있습니다.</small>}</div>
    {listening && audio?.url && <audio ref={audioRef} key={`${audio.url}:${audio.measuredAt ?? ""}`} controls autoPlay src={audio.url} aria-label={`${band?.name ?? "전체 대역"} 관측 소리`} onEnded={() => { setAudio(queuedAudio.current); queuedAudio.current = null; }} />}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
