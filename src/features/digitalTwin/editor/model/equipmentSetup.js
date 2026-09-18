export const EQUIPMENT_SETUP_STEPS = Object.freeze([
  { id: "BASIC", label: "기본 정보", description: "설비명, 모델 정보와 대표 사진을 등록합니다." },
  { id: "ASSET", label: "3D 모델·표현", description: "스캔 모델과 텍스처를 연결하고 크기·표현 방식을 맞춥니다." },
  { id: "SENSOR", label: "센서 위치", description: "관측 이미지와 모델을 비교해 센서 위치·방향을 보정합니다." },
  { id: "POINT", label: "측정값·임계치", description: "센서별 관측 항목, 표시 이름, 단위와 경보 기준을 설정합니다." },
  { id: "REVIEW", label: "연결·검토", description: "데이터 연결 정보와 앞 단계 설정을 확인합니다." },
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
  const danger = Number(point?.dangerRange?.min);
  const warning = Number(point?.warningRange?.min);
  const level = Number.isFinite(danger) && number >= danger ? "DANGER" : Number.isFinite(warning) && number >= warning ? "WARNING" : "NORMAL";
  const icon = point?.alertIcon || ({ TEMPERATURE: "🔥", VIBRATION: "〰️", PRESSURE: "⚠️", VIDEO: "📷" }[point?.metric] ?? "⚠️");
  return { level, label: { DANGER: "위험", WARNING: "주의", NORMAL: "정상" }[level], icon: level === "NORMAL" ? "●" : icon };
}

export function getSetupStepIssue(step, { equipment, assets = [], sensors = [], points = [] }) {
  if (step === "BASIC" && !equipment?.name?.trim()) return "설비명을 입력하세요.";
  if (step === "ASSET" && !assets.some((asset) => ["OBJ", "PLY"].includes(asset.assetType))) return "스캔 모델을 등록하거나 이 단계를 건너뛰세요.";
  if (step === "SENSOR" && !sensors.length) return "센서를 등록하거나 이 단계를 건너뛰세요.";
  if (step === "POINT") {
    if (!points.length) return "관측 항목을 추가하거나 이 단계를 건너뛰세요.";
    if (points.some((point) => !point.sensorIds?.some((id) => sensors.some((sensor) => sensor.id === id)))) return "각 관측 항목에 센서를 연결하세요.";
    if (points.some((point) => {
      const limits = [point.normalRange?.max, point.warningRange?.max, point.dangerRange?.max];
      return limits.some((value) => value === null || value === undefined || !Number.isFinite(Number(value))) || Number(limits[0]) >= Number(limits[1]) || Number(limits[1]) >= Number(limits[2]);
    })) return "임계치를 정상 < 주의 < 위험 순서로 입력하세요.";
  }
  return "";
}
