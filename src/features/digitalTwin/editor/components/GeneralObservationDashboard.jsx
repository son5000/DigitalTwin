import { useEffect, useMemo, useRef, useState } from "react";
import { monitoringApiBase, requestPointAudio } from "../api/monitoringClient.js";
import { roiAudioSelection } from "../model/roiMonitoring.js";
import { DEFAULT_FREQUENCY_BANDS } from "../model/observationProfiles.js";
import { demoAudioBlob } from "../model/monitoringDemo.js";
import styles from "./GeneralObservationDashboard.module.css";

const MAX_FREQUENCY_HZ = 48000;

function spectrumBins(spectrum) {
  const bins = Array.isArray(spectrum) ? spectrum : spectrum?.bins;
  if (!Array.isArray(bins)) return [];
  return bins.slice(0, 4096).map((bin) => ({
    frequencyHz: Number(Array.isArray(bin) ? bin[0] : bin.frequencyHz),
    levelDb: Number(Array.isArray(bin) ? bin[1] : bin.levelDb),
  })).filter((bin) => Number.isFinite(bin.frequencyHz) && bin.frequencyHz >= 0
    && bin.frequencyHz <= MAX_FREQUENCY_HZ && Number.isFinite(bin.levelDb))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
}

function waveformData(waveform, peakHz) {
  const raw = Array.isArray(waveform) ? waveform : waveform?.samples;
  if (!Array.isArray(raw) || !raw.length) return null;
  const sampleRateHz = Number(waveform?.sampleRateHz);
  const periodSamples = sampleRateHz > 0 && peakHz > 0 ? sampleRateHz / peakHz : 24;
  const windowSize = Math.min(raw.length, Math.max(64, Math.min(512, Math.round(periodSamples * 14))));
  const samples = raw.slice(0, windowSize).map(Number).filter(Number.isFinite);
  if (!samples.length) return null;
  const amplitude = Math.max(...samples.map(Math.abs));
  const scale = amplitude > 1 ? amplitude <= 32768 ? 32768 : amplitude : 1;
  return { samples: samples.map((value) => Math.max(-1, Math.min(1, value / scale))),
    durationMs: sampleRateHz > 0 ? samples.length / sampleRateHz * 1000 : null };
}

function formatTemperature(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function receivedTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? `${date.toLocaleTimeString("ko-KR", { hour12: false })} 갱신` : "";
}

export default function GeneralObservationDashboard({ roi, point, rows, equipment, projectId, model, demo = false, overview = false }) {
  const item = point?.measurements.find((entry) => entry.metric === "GENERAL");
  const bands = item?.analysisConfig?.bands ?? DEFAULT_FREQUENCY_BANDS;
  const [bandId, setBandId] = useState("");
  const [listening, setListening] = useState(false);
  const [audio, setAudio] = useState(null);
  const [error, setError] = useState("");
  const audioRef = useRef(null), queuedAudio = useRef(null);
  const band = bands.find((entry) => entry.id === bandId);
  const ultrasound = rows.find((entry) => entry.metric === "ultrasound.db");
  const temperatures = Object.fromEntries(rows.filter((entry) => entry.metric === "TEMPERATURE")
    .map((entry) => [entry.id.split(":").at(-1), entry]));
  const minimum = temperatures.min?.value, average = temperatures.average?.value, maximum = temperatures.max?.value;
  const hasTemperature = [minimum, maximum].every(Number.isFinite);
  const averageMarker = hasTemperature && Number.isFinite(average) && maximum > minimum
    ? Math.max(0, Math.min(100, (maximum - average) / (maximum - minimum) * 100)) : 50;
  const averagePosition = Math.max(22, Math.min(78, averageMarker));
  const temperatureSources = temperatures.average?.sourceNames ?? temperatures.max?.sourceNames ?? [];
  const bins = useMemo(() => spectrumBins(ultrasound?.spectrum), [ultrasound?.spectrum]);
  const sampled = bins.filter((_, index) => index % Math.max(1, Math.ceil(bins.length / 256)) === 0);
  const minDb = bins.length ? Math.floor(Math.min(...bins.map((entry) => entry.levelDb)) / 10) * 10 : 0;
  const maxDb = bins.length ? Math.ceil(Math.max(...bins.map((entry) => entry.levelDb), minDb + 10) / 10) * 10 : 100;
  const peak = bins.reduce((current, entry) => !current || entry.levelDb > current.levelDb ? entry : current, null);
  const waveform = useMemo(() => waveformData(ultrasound?.waveform, peak?.frequencyHz), [ultrasound?.waveform, peak?.frequencyHz]);
  const spectrumX = (hz) => 32 + hz / MAX_FREQUENCY_HZ * 274;
  const spectrumY = (db) => 108 - (db - minDb) / Math.max(1, maxDb - minDb) * 88;
  const trace = sampled.map((entry, index) => `${index ? "L" : "M"}${spectrumX(entry.frequencyHz)},${spectrumY(entry.levelDb)}`).join(" ");
  const area = sampled.length ? `${trace} L${spectrumX(sampled.at(-1).frequencyHz)},108 L${spectrumX(sampled[0].frequencyHz)},108 Z` : "";
  const waveformTrace = waveform?.samples.map((value, index) => `${index ? "L" : "M"}${32 + index / Math.max(1, waveform.samples.length - 1) * 274},${55 - value * 37}`).join(" ");
  const signalValue = ultrasound?.value;
  useEffect(() => {
    if (!listening || overview || !monitoringApiBase || demo) return undefined;
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
  }, [listening, band, roi, equipment, projectId, model, demo, overview]);
  useEffect(() => {
    if (!listening || overview || !demo || !signalValue) return undefined;
    const url = URL.createObjectURL(demoAudioBlob());
    let active = true;
    queueMicrotask(() => { if (active) setAudio({ url, measuredAt: new Date().toISOString() }); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [listening, demo, bandId, signalValue, overview]);
  return <div className={styles.dashboard}>
    <section className={styles.section} aria-label="관측 영역 열화상">
      <div className={styles.heading}><strong>{overview ? "화면 온도" : "열화상"}</strong><small>{temperatureSources.length ? temperatureSources.join(", ") : overview ? "시점 내 분포" : "영역 온도"}</small></div>
      {hasTemperature ? <div className={styles.thermalReadout}>
        <div className={styles.palette} aria-hidden="true"><span className={styles.paletteBar} /><span className={styles.averageTick} style={{ top: `${averageMarker}%` }} /></div>
        <dl className={styles.temperatureValues}>
          <div className={styles.temperatureMax}><dt>최고</dt><dd>{formatTemperature(maximum)}<small> °C</small></dd></div>
          <div className={styles.temperatureAverage} style={{ top: `${averagePosition}%` }}><dt>평균</dt><dd>{formatTemperature(average)}<small> °C</small></dd></div>
          <div className={styles.temperatureMin}><dt>최저</dt><dd>{formatTemperature(minimum)}<small> °C</small></dd></div>
        </dl>
      </div> : <p className={styles.empty}>이 영역의 온도 데이터 수신 대기</p>}
      {hasTemperature && temperatures.average?.measuredAt && <small className={styles.receivedAt}>{receivedTime(temperatures.average.measuredAt)}</small>}
    </section>
    <section className={styles.section} aria-label="관측 영역 초음파">
      <div className={styles.heading}><strong>{overview ? "중앙 초음파" : "초음파"}</strong><span className={styles.signalValue} data-empty={signalValue == null}>{signalValue == null ? "수신 대기" : <>{Number(signalValue).toFixed(1)} <small>dB</small></>}</span></div>
      {(ultrasound?.sourceNames?.length > 0 || ultrasound?.measuredAt) && <small className={styles.receivedAt}>{[ultrasound?.sourceNames?.join(", "), receivedTime(ultrasound?.measuredAt)].filter(Boolean).join(" · ")}</small>}
      <div className={styles.chartHeading}><strong>FFT 스펙트럼</strong><span>0–48 kHz</span></div>
      {bins.length ? <>
        <svg className={styles.chart} viewBox="0 0 320 140" role="img" aria-label={`초음파 FFT 스펙트럼, 0부터 48 kHz, 최대 신호 ${(peak.frequencyHz / 1000).toFixed(1)} kHz, ${peak.levelDb.toFixed(1)} dB`}>
          <defs><linearGradient id="roi-spectrum-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--portal-blue, #53c5e4)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--portal-blue, #53c5e4)" stopOpacity="0" /></linearGradient></defs>
          {[minDb, (minDb + maxDb) / 2, maxDb].map((db) => <g key={db}><path d={`M32 ${spectrumY(db)} H306`} className={styles.grid} /><text x="27" y={spectrumY(db) + 3} textAnchor="end">{db}</text></g>)}
          {[0, 12, 24, 36, 48].map((khz) => <g key={khz}><path d={`M${spectrumX(khz * 1000)} 20 V108`} className={styles.grid} /><text x={spectrumX(khz * 1000)} y="127" textAnchor={khz === 0 ? "start" : khz === 48 ? "end" : "middle"}>{khz}</text></g>)}
          <path d="M32 108 H306" className={styles.axis} /><path d={area} fill="url(#roi-spectrum-fill)" />
          <path d={trace} className={styles.trace} />
          <path d={`M${spectrumX(peak.frequencyHz)} ${spectrumY(peak.levelDb)} V108`} className={styles.peakGuide} />
          <circle cx={spectrumX(peak.frequencyHz)} cy={spectrumY(peak.levelDb)} r="3.5" className={styles.peakDot} />
          <text x="32" y="12">dB</text><text x="306" y="138" textAnchor="end">kHz</text>
        </svg>
        <div className={styles.peakReadout}><span>최대 신호</span><strong>{(peak.frequencyHz / 1000).toFixed(1)} kHz</strong><span>{peak.levelDb.toFixed(1)} dB</span></div>
      </> : <p className={styles.empty}>FFT 데이터 수신 대기 · 0–48 kHz</p>}
      <div className={styles.chartHeading}><strong>신호 파형</strong><span>{waveform?.durationMs ? `${waveform.durationMs.toFixed(2)} ms 구간` : "시간 흐름"}</span></div>
      {waveform ? <svg className={styles.chart} viewBox="0 0 320 110" role="img" aria-label={waveform.durationMs ? `초음파 신호 파형, ${waveform.durationMs.toFixed(2)} 밀리초 구간` : "초음파 신호 파형"}>
        {[18, 55, 92].map((y) => <path key={y} d={`M32 ${y} H306`} className={y === 55 ? styles.zeroLine : styles.grid} />)}
        {[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><path d={`M${32 + fraction * 274} 18 V92`} className={styles.grid} /><text x={32 + fraction * 274} y="106" textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{waveform.durationMs ? (fraction * waveform.durationMs).toFixed(2) : Math.round(fraction * 100)}</text></g>)}
        <path d={waveformTrace} className={styles.waveformLine} />
        <text x="27" y="21" textAnchor="end">+1</text><text x="27" y="58" textAnchor="end">0</text><text x="27" y="95" textAnchor="end">−1</text>
      </svg> : <p className={styles.empty}>파형 데이터 수신 대기</p>}
      {!overview && <div className={styles.audioRow}><label>들을 대역<select value={bandId} onChange={(event) => { setBandId(event.target.value); setAudio(null); }}>
        <option value="">전체 대역</option>{bands.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.fromHz.toLocaleString()}–{entry.toHz.toLocaleString()} Hz</option>)}
      </select></label><button type="button" disabled={!demo && !monitoringApiBase} aria-pressed={listening} onClick={() => { setListening((value) => !value); setAudio(null); queuedAudio.current = null; }}>{listening ? "듣기 중지" : "소리 듣기"}</button></div>}
      {!overview && !demo && !monitoringApiBase && <small className={styles.sourceNames}>관측 서버 연결 후 소리를 들을 수 있습니다.</small>}
      {!overview && listening && (!demo || signalValue != null) && audio?.url && <audio ref={audioRef} key={`${audio.url}:${audio.measuredAt ?? ""}`} controls autoPlay loop={demo} src={audio.url} aria-label={`${band?.name ?? "전체 대역"} 관측 소리`} onEnded={() => { setAudio(queuedAudio.current); queuedAudio.current = null; }} />}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  </div>;
}
