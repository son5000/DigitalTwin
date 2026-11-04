export const OBSERVATION_STATES = Object.freeze([
  ["NORMAL", "정상"], ["ABNORMAL", "비정상"], ["FAULT", "이상"], ["WARNING", "주의"],
  ["OPEN", "열림"], ["CLOSED", "닫힘"], ["POWER_ON", "전원 켜짐"], ["POWER_OFF", "전원 꺼짐"],
  ["RUNNING", "작동 중"], ["STOPPED", "정지"], ["ACTIVE", "활성"], ["INACTIVE", "비활성"],
  ["READY", "준비"], ["STANDBY", "대기"], ["LOCKED", "잠김"], ["UNLOCKED", "잠금 해제"],
  ["CONNECTED", "연결됨"], ["DISCONNECTED", "연결 끊김"], ["SUPPLYING", "공급 중"], ["BLOCKED", "차단"],
]);

export const STATE_PAIRS = Object.freeze([
  ["OPEN_CLOSED", "OPEN", "CLOSED"], ["POWER", "POWER_ON", "POWER_OFF"],
  ["NORMAL_ABNORMAL", "NORMAL", "ABNORMAL"], ["NORMAL_FAULT", "NORMAL", "FAULT"],
  ["RUNNING_STOPPED", "RUNNING", "STOPPED"], ["ACTIVE_INACTIVE", "ACTIVE", "INACTIVE"],
  ["READY_STANDBY", "READY", "STANDBY"], ["LOCKED_UNLOCKED", "LOCKED", "UNLOCKED"],
  ["CONNECTED_DISCONNECTED", "CONNECTED", "DISCONNECTED"], ["SUPPLY", "SUPPLYING", "BLOCKED"],
]);

export const LED_COLORS = Object.freeze([
  { id: "RED", label: "빨강", hex: "#e53935", hue: [[345, 360], [0, 15]] },
  { id: "ORANGE", label: "주황", hex: "#f57c00", hue: [[15, 40]] },
  { id: "AMBER", label: "황색", hex: "#ffb300", hue: [[40, 55]] },
  { id: "YELLOW", label: "노랑", hex: "#fdd835", hue: [[55, 75]] },
  { id: "LIME", label: "연두", hex: "#9ccc00", hue: [[75, 95]] },
  { id: "GREEN", label: "초록", hex: "#43a047", hue: [[95, 160]] },
  { id: "CYAN", label: "청록", hex: "#00acc1", hue: [[160, 195]] },
  { id: "BLUE", label: "파랑", hex: "#1e88e5", hue: [[195, 260]] },
  { id: "PURPLE", label: "보라", hex: "#8e24aa", hue: [[260, 320]] },
  { id: "WHITE", label: "흰색", hex: "#f5f5f5", saturationMax: .2, brightnessMin: .65 },
]);

export const DEFAULT_FREQUENCY_BANDS = Object.freeze([
  { id: "LOW", name: "낮은 대역", fromHz: 0, toHz: 2000 },
  { id: "MID", name: "중간 대역", fromHz: 2000, toHz: 20000 },
  { id: "HIGH", name: "높은 대역", fromHz: 20000, toHz: 100000 },
]);

export const stateLabel = (code) => OBSERVATION_STATES.find(([id]) => id === code)?.[1] ?? code ?? "—";
export const statePair = (id) => STATE_PAIRS.find(([key]) => key === id) ?? STATE_PAIRS[0];

export function gaugeAngleForValue(scale, value) {
  const { startAngleDeg, startValue, endAngleDeg, endValue } = scale ?? {};
  if (![startAngleDeg, startValue, endAngleDeg, endValue, value].every(Number.isFinite) || startValue === endValue) return null;
  return startAngleDeg + (value - startValue) * (endAngleDeg - startAngleDeg) / (endValue - startValue);
}

export function gaugeValueForAngle(scale, angle) {
  const { startAngleDeg, startValue, endAngleDeg, endValue } = scale ?? {};
  if (![startAngleDeg, startValue, endAngleDeg, endValue, angle].every(Number.isFinite) || startAngleDeg === endAngleDeg) return null;
  return startValue + (angle - startAngleDeg) * (endValue - startValue) / (endAngleDeg - startAngleDeg);
}

export function withGaugeRuleAngles(item) {
  if (item.metric !== "vision.gaugeValue") return item;
  return { ...item, rules: (item.rules ?? []).map((rule) => ({ ...rule,
    angleDeg: gaugeAngleForValue(item.analysisConfig?.scale, rule.threshold) })) };
}

export function assessRules(value, rules = []) {
  if (value === null || !Number.isFinite(value)) return { level: "EMPTY", label: "수신 대기" };
  if (!rules.length) return { level: "IDLE", label: "기준 미설정" };
  const matches = rules.filter((rule) => Number.isFinite(rule.threshold) &&
    (rule.operator === "lt" ? value < rule.threshold : rule.operator === "lte" ? value <= rule.threshold
      : rule.operator === "gt" ? value > rule.threshold : value >= rule.threshold));
  if (matches.some((rule) => rule.severity === "DANGER")) return { level: "DANGER", label: "이상" };
  if (matches.length) return { level: "WARNING", label: "주의" };
  return { level: "NORMAL", label: "정상" };
}

export function generalRulesFor(item, metric, statistic = null) {
  return (item.rules ?? []).filter((rule) => rule.metric === metric && (rule.statistic ?? null) === statistic);
}


export function observationProfileIssue(item) {
  const profile = item.analysisConfig ?? {};
  if (item.metric === "GENERAL") {
    if ((item.rules ?? []).some((rule) => !["ultrasound.db", "TEMPERATURE"].includes(rule.metric)
      || (rule.metric === "TEMPERATURE" && !["min", "average", "max"].includes(rule.statistic))
      || !Number.isFinite(rule.threshold))) return "초음파·온도 판정 기준을 확인하세요.";
    if ((profile.bands ?? DEFAULT_FREQUENCY_BANDS).some((band) => !band.name?.trim() || !Number.isFinite(band.fromHz)
      || !Number.isFinite(band.toHz) || band.fromHz < 0 || band.toHz <= band.fromHz)) return "주파수 대역의 이름과 시작·끝 값을 확인하세요.";
  }
  if (item.metric === "vision.gaugeValue") {
    const scale = profile.scale;
    if (!scale || ![scale.startAngleDeg, scale.startValue, scale.endAngleDeg, scale.endValue].every(Number.isFinite)
      || scale.startAngleDeg === scale.endAngleDeg || scale.startValue === scale.endValue) return "게이지 바늘의 시작·끝 각도와 값을 입력하세요.";
  }
  if (["vision.switchState", "vision.valveState"].includes(item.metric)) {
    const pair = statePair(profile.pairId ?? (item.metric === "vision.valveState" ? "OPEN_CLOSED" : "POWER"));
    if (![pair[1], pair[2]].includes(profile.referenceState)) return "현재 카메라 영상에 보이는 상태를 선택하세요.";
    if (!profile.referenceFrame?.textureAssetId && !profile.referenceFrame?.serverAssetId) return "현재 영상의 기준 사진을 저장하세요.";
  }
  if (item.metric === "vision.ledState" && (!profile.colors?.length || profile.colors.some((entry) =>
    !LED_COLORS.some((color) => color.id === entry.colorKey) || !OBSERVATION_STATES.some(([code]) => code === entry.stateCode)))) {
    return "LED 색상을 추가하고 색상마다 상태를 지정하세요.";
  }
  return "";
}
