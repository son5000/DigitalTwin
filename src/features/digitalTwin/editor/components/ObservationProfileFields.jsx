import { DEFAULT_FREQUENCY_BANDS, LED_COLORS, OBSERVATION_STATES, STATE_PAIRS, stateLabel, statePair } from "../model/observationProfiles.js";
import styles from "./ObservationProfileFields.module.css";

const chooseNumber = (value) => value === "" ? "" : Number(value);
const LEVELS = [["NORMAL", "정상"], ["WARNING", "주의"], ["DANGER", "이상"]];
const RULE_TARGETS = [
  ["ultrasound.db", null, "초음파 (dB)"], ["TEMPERATURE", "max", "최고 온도 (℃)"],
  ["TEMPERATURE", "average", "평균 온도 (℃)"], ["TEMPERATURE", "min", "최저 온도 (℃)"],
];

function referenceFrame(point) {
  const image = point.imageBinding?.originalImage;
  return image ? { ...image, sourceRect: point.imageBinding.sourceRect, sourceQuad: point.imageBinding.sourceQuad ?? null,
    coordinateOrigin: "TOP_LEFT" } : null;
}

export default function ObservationProfileFields({ point, item, onChange, onCaptureReference, captureBusy = false }) {
  const profile = item.analysisConfig ?? {};
  const updateProfile = (changes) => onChange({ analysisConfig: { schemaVersion: 1, ...profile, ...changes } });
  if (item.metric === "GENERAL") {
    const bands = profile.bands ?? DEFAULT_FREQUENCY_BANDS;
    return <div className={styles.profile}>
      <div className={styles.sectionTitle}><strong>초음파·온도 판정</strong><small>값이 기준에 해당하면 주의 또는 이상으로 표시합니다.</small></div>
      {(item.rules ?? []).map((rule, index) => <div className={styles.rule} key={index}>
        <select aria-label={`판정 기준 ${index + 1} 항목`} value={`${rule.metric}:${rule.statistic ?? ""}`} onChange={(event) => {
          const [metric, statistic] = event.target.value.split(":");
          onChange({ rules: item.rules.map((entry, i) => i === index ? { ...entry, metric, statistic: statistic || null } : entry) });
        }}>{RULE_TARGETS.map(([metric, statistic, label]) => <option key={`${metric}:${statistic}`} value={`${metric}:${statistic ?? ""}`}>{label}</option>)}</select>
        <select aria-label={`판정 기준 ${index + 1} 조건`} value={rule.operator} onChange={(event) => onChange({ rules: item.rules.map((entry, i) => i === index ? { ...entry, operator: event.target.value } : entry) })}>
          <option value="gte">이상</option><option value="gt">초과</option><option value="lte">이하</option><option value="lt">미만</option>
        </select>
        <input aria-label={`판정 기준 ${index + 1} 값`} type="number" required step="any" placeholder="기준값" value={rule.threshold ?? ""} onChange={(event) => onChange({ rules: item.rules.map((entry, i) => i === index ? { ...entry, threshold: chooseNumber(event.target.value) } : entry) })} />
        <select aria-label={`판정 기준 ${index + 1} 단계`} value={rule.severity} onChange={(event) => onChange({ rules: item.rules.map((entry, i) => i === index ? { ...entry, severity: event.target.value } : entry) })}>
          {LEVELS.slice(1).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <button type="button" aria-label={`판정 기준 ${index + 1} 삭제`} onClick={() => onChange({ rules: item.rules.filter((_, i) => i !== index) })}>삭제</button>
      </div>)}
      <button type="button" onClick={() => onChange({ rules: [...(item.rules ?? []), { metric: "ultrasound.db", statistic: null, operator: "gte", threshold: "", severity: "WARNING" }] })}>판정 기준 추가</button>
      <div className={styles.sectionTitle}><strong>주파수별 듣기·그래프</strong><small>서버가 제공하는 주파수 범위를 나눠서 조회합니다.</small></div>
      {bands.map((band, index) => <div className={styles.band} key={band.id}>
        <input aria-label={`주파수 대역 ${index + 1} 이름`} value={band.name} onChange={(event) => updateProfile({ bands: bands.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) })} />
        <label>시작 Hz<input type="number" min="0" step="1" value={band.fromHz} onChange={(event) => updateProfile({ bands: bands.map((entry, i) => i === index ? { ...entry, fromHz: chooseNumber(event.target.value) } : entry) })} /></label>
        <label>끝 Hz<input type="number" min="1" step="1" value={band.toHz} onChange={(event) => updateProfile({ bands: bands.map((entry, i) => i === index ? { ...entry, toHz: chooseNumber(event.target.value) } : entry) })} /></label>
        <button type="button" aria-label={`${band.name} 삭제`} onClick={() => updateProfile({ bands: bands.filter((_, i) => i !== index) })}>삭제</button>
      </div>)}
      <button type="button" onClick={() => updateProfile({ bands: [...bands, { id: crypto.randomUUID(), name: `대역 ${bands.length + 1}`, fromHz: 0, toHz: 20000 }] })}>주파수 대역 추가</button>
    </div>;
  }
  if (item.metric === "vision.gaugeValue") {
    const scale = profile.scale ?? {};
    const setScale = (key, value) => updateProfile({ scale: { ...scale, [key]: chooseNumber(value) } });
    return <div className={styles.profile}>
      <div className={styles.sectionTitle}><strong>게이지 눈금 보정</strong><small>바늘의 시작·끝 각도와 해당 값을 입력하세요. 경보 기준값과 각도는 서로 연동됩니다.</small></div>
      <div className={styles.gaugeGrid}>
        <label>시작 각도 (°)<input type="number" required step="any" value={scale.startAngleDeg ?? ""} onChange={(event) => setScale("startAngleDeg", event.target.value)} /></label>
        <label>시작 값<input type="number" required step="any" value={scale.startValue ?? ""} onChange={(event) => setScale("startValue", event.target.value)} /></label>
        <label>끝 각도 (°)<input type="number" required step="any" value={scale.endAngleDeg ?? ""} onChange={(event) => setScale("endAngleDeg", event.target.value)} /></label>
        <label>끝 값<input type="number" required step="any" value={scale.endValue ?? ""} onChange={(event) => setScale("endValue", event.target.value)} /></label>
      </div>
    </div>;
  }
  if (["vision.switchState", "vision.valveState"].includes(item.metric)) {
    const pair = statePair(profile.pairId ?? (item.metric === "vision.valveState" ? "OPEN_CLOSED" : "POWER"));
    const [, first, second] = pair;
    const levels = profile.levels ?? { [first]: "NORMAL", [second]: "WARNING" };
    return <div className={styles.profile}>
      <div className={styles.sectionTitle}><strong>현재 영상의 기준 상태</strong><small>지금 보이는 모습을 알려주면 서버가 이후 화면과 비교할 수 있습니다.</small></div>
      <label>판독할 두 상태<select value={pair[0]} onChange={(event) => { const [, a, b] = statePair(event.target.value);
        updateProfile({ pairId: event.target.value, referenceState: "", levels: { [a]: "NORMAL", [b]: "WARNING" }, referenceFrame: null }); }}>
        {STATE_PAIRS.map(([id, a, b]) => <option value={id} key={id}>{stateLabel(a)} / {stateLabel(b)}</option>)}
      </select></label>
      <label>현재 보이는 상태<select required value={profile.referenceState ?? ""} onChange={(event) => updateProfile({ pairId: pair[0], referenceState: event.target.value,
        levels, referenceFrame: onCaptureReference ? null : profile.referenceFrame ?? referenceFrame(point) })}>
        <option value="">선택하세요</option><option value={first}>{stateLabel(first)}</option><option value={second}>{stateLabel(second)}</option>
      </select></label>
      <div className={styles.gaugeGrid}>{[first, second].map((code) => <label key={code}>{stateLabel(code)}일 때 판정<select value={levels[code] ?? "NORMAL"} onChange={(event) => updateProfile({ pairId: pair[0], levels: { ...levels, [code]: event.target.value } })}>
        {LEVELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>)}</div>
      {profile.referenceState && <p className={styles.note}>기준 사진: {profile.referenceFrame?.name ?? point.imageBinding?.originalImage?.name ?? "촬영 이미지 필요"}</p>}
      {onCaptureReference && <button type="button" disabled={captureBusy || !profile.referenceState} onClick={() => onCaptureReference(item.id)}>{captureBusy ? "기준 사진 저장 중…" : "현재 카메라 영상을 기준 사진으로 저장"}</button>}
    </div>;
  }
  if (item.metric === "vision.ledState") {
    const colors = profile.colors ?? [];
    const available = LED_COLORS.filter((color) => !colors.some((entry) => entry.colorKey === color.id));
    return <div className={styles.profile}>
      <div className={styles.sectionTitle}><strong>LED 색상별 상태</strong><small>사용할 색을 추가하고 감지했을 때의 상태와 판정을 지정하세요.</small></div>
      {colors.map((entry, index) => { const color = LED_COLORS.find((candidate) => candidate.id === entry.colorKey); return <div className={styles.colorRow} key={entry.colorKey}>
        <span className={styles.swatch} style={{ backgroundColor: color?.hex }} aria-hidden="true" /><strong>{color?.label ?? entry.colorKey}</strong>
        <select aria-label={`${color?.label} 상태`} value={entry.stateCode ?? ""} onChange={(event) => updateProfile({ colors: colors.map((value, i) => i === index ? { ...value, stateCode: event.target.value } : value) })}>
          <option value="">상태 선택</option>{OBSERVATION_STATES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <select aria-label={`${color?.label} 판정`} value={entry.level ?? "NORMAL"} onChange={(event) => updateProfile({ colors: colors.map((value, i) => i === index ? { ...value, level: event.target.value } : value) })}>
          {LEVELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <button type="button" aria-label={`${color?.label} 색상 삭제`} onClick={() => updateProfile({ colors: colors.filter((_, i) => i !== index) })}>삭제</button>
      </div>; })}
      {available.length > 0 && <label>색상 추가<select value="" onChange={(event) => { const color = LED_COLORS.find((entry) => entry.id === event.target.value);
        if (color) updateProfile({ colors: [...colors, { colorKey: color.id, hex: color.hex, hue: color.hue ?? null,
          saturationMax: color.saturationMax ?? null, brightnessMin: color.brightnessMin ?? null, stateCode: "", level: "NORMAL" }] }); }}>
        <option value="">색상을 선택하세요</option>{available.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
      </select></label>}
      {onCaptureReference && <button type="button" disabled={captureBusy} onClick={() => onCaptureReference(item.id)}>{captureBusy ? "기준 사진 저장 중…" : "현재 LED 영상을 기준 사진으로 저장"}</button>}
      {profile.referenceFrame && <p className={styles.note}>기준 사진: {profile.referenceFrame.name}</p>}
    </div>;
  }
  return null;
}
