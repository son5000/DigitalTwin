import { getSensorMountPose } from "./equipmentEnclosure.js";
export const EQUIPMENT_SETUP_STEPS = Object.freeze([
  { id: "BASIC", label: "기본 정보", description: "설비 정보와 모델·재질·텍스처 파일을 등록합니다." },
  { id: "ASSET", label: "모델·관제 화면", description: "설비의 크기와 방향, 관제 시작 화면을 설정하세요." },
  { id: "SENSOR", label: "센서 배치·연결", description: "센서 기능과 연결 정보를 등록하고, 위치·촬영 방향을 맞추세요." },
  { id: "POINT", label: "관측 영역·임계치", description: "살펴볼 위치를 구체로 지정하세요. 영역마다 측정 항목과 경보 기준을 여러 개 설정할 수 있습니다." },
  { id: "REVIEW", label: "최종 확인", description: "모델, 센서 연결, 관측 영역을 확인하고 프로젝트를 저장하세요." },
]);

export function getEquipmentSetup(equipment) {
  const saved = equipment?.metadata?.detailSetup ?? {};
  const steps = Object.fromEntries(EQUIPMENT_SETUP_STEPS.map(({ id }) => [id, ["DONE", "SKIPPED"].includes(saved.steps?.[id]) ? saved.steps[id] : "PENDING"]));
  return {
    currentStep: EQUIPMENT_SETUP_STEPS.some(({ id }) => id === saved.currentStep) ? saved.currentStep : "BASIC",
    steps,
    completed: Object.values(steps).filter((status) => status === "DONE").length,
    skipped: Object.values(steps).filter((status) => status === "SKIPPED").length,
  };
}

export function updateEquipmentSetup(equipment, stepId, status) {
  const current = getEquipmentSetup(equipment);
  const index = EQUIPMENT_SETUP_STEPS.findIndex(({ id }) => id === stepId);
  if (index < 0) return current;
  return {
    currentStep: status && status !== "PENDING" ? EQUIPMENT_SETUP_STEPS[Math.min(index + 1, EQUIPMENT_SETUP_STEPS.length - 1)].id : stepId,
    steps: { ...current.steps, ...(status ? { [stepId]: status } : {}) },
  };
}

export function getEquipmentSetupSaveSummary(equipment = []) {
  return equipment.reduce((summary, item) => {
    const setup = getEquipmentSetup(item);
    const pending = EQUIPMENT_SETUP_STEPS.length - setup.completed - setup.skipped;
    return {
      equipmentCount: summary.equipmentCount + (pending + setup.skipped > 0 ? 1 : 0),
      pendingCount: summary.pendingCount + pending,
      skippedCount: summary.skippedCount + setup.skipped,
    };
  }, { equipmentCount: 0, pendingCount: 0, skippedCount: 0 });
}

export function getSensorReadingState(point, value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return { label: "데이터 없음", icon: "—", level: "EMPTY" };
  const number = Number(value);
  if (point?.rules?.length) {
    const matched = point.rules.filter((rule) => Number.isFinite(Number(rule.threshold)) && (rule.operator === "lt" ? number < Number(rule.threshold) : rule.operator === "lte" ? number <= Number(rule.threshold) : rule.operator === "gt" ? number > Number(rule.threshold) : number >= Number(rule.threshold)));
    const level = matched.some((rule) => rule.severity === "DANGER") ? "DANGER" : matched.length ? "WARNING" : "NORMAL";
    return { level, label: { DANGER: "위험", WARNING: "주의", NORMAL: "정상" }[level], icon: level === "NORMAL" ? "●" : "!" };
  }
  const danger = Number(point?.dangerRange?.min);
  const warning = Number(point?.warningRange?.min);
  const level = Number.isFinite(danger) && number >= danger ? "DANGER" : Number.isFinite(warning) && number >= warning ? "WARNING" : "NORMAL";
  const icon = point?.alertIcon || ({ TEMPERATURE: "🔥", VIBRATION: "〰️", PRESSURE: "⚠️", VIDEO: "📷" }[point?.metric] ?? "⚠️");
  return { level, label: { DANGER: "위험", WARNING: "주의", NORMAL: "정상" }[level], icon: level === "NORMAL" ? "●" : icon };
}

export function getSetupStepIssue(step, { equipment, assets = [], sensors = [], points = [] }) {
  if (step === "BASIC" && !equipment?.name?.trim()) return "설비명을 입력하세요.";
  if (step === "ASSET" && !equipment?.shapeTemplateId && !equipment?.enclosure?.enabled && !assets.some((asset) => ["OBJ", "PLY"].includes(asset.assetType))) return "스캔 모델을 등록하거나 이 단계를 건너뛰세요.";
  if (step === "SENSOR" && !sensors.length) return "센서를 등록하거나 이 단계를 건너뛰세요.";
  if (["SENSOR", "REVIEW"].includes(step) && sensors.some((sensor) => sensor.surfaceMount && (!getSensorMountPose(sensor, equipment) || getSensorMountPose(sensor, equipment).adjusted))) return "센서의 부착면과 위치를 다시 확인하세요.";
  if (step === "POINT") {
    if (!points.length) return "관측 영역을 추가하거나 이 단계를 건너뛰세요.";
    if (points.some((point) => point.measurements && !point.measurements.length)) return "각 관측 영역에 측정 항목을 하나 이상 추가하세요.";
    if (points.some((point) => point.measurements?.length ? point.measurements.some((item) => !sensors.some((sensor) => sensor.id === item.sensorId)) : !point.sensorIds?.some((id) => sensors.some((sensor) => sensor.id === id)))) return "각 관측 항목에 측정 센서를 선택하세요.";
    if (points.some((point) => point.measurements?.some((item) => item.rules?.some((rule) => rule.threshold === "" || !Number.isFinite(Number(rule.threshold)))))) return "경보 조건의 기준값을 입력하세요.";
    if (points.some((point) => {
      if (point.measurements?.length) return false;
      const limits = [point.normalRange?.max, point.warningRange?.max, point.dangerRange?.max];
      return limits.some((value) => value === null || value === undefined || !Number.isFinite(Number(value))) || Number(limits[0]) >= Number(limits[1]) || Number(limits[1]) >= Number(limits[2]);
    })) return "임계치를 정상 < 주의 < 위험 순서로 입력하세요.";
  }
  return "";
}
