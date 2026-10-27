import { getEquipmentCoordinateFrame } from "./equipmentCoordinateFrame.js";
import { getSensorMountPose } from "./equipmentEnclosure.js";
import { sensorHasImaging } from "./equipmentDetailModel.js";
import { calibrationPayload } from "./monitoringContract.js";
import { referenceFrameKey } from "./equipmentCoordinateFrame.js";
export const EQUIPMENT_SETUP_STEPS = Object.freeze([
  { id: "BASIC", label: "기본 정보", description: "설비 정보와 모델·재질·텍스처 파일을 등록합니다." },
  { id: "ASSET", label: "모델·관제 화면", description: "설비의 크기·정면·기준좌표와 관제 시작 화면을 설정하세요." },
  { id: "SENSOR", label: "센서 배치·연결", description: "센서 기능과 연결 정보를 등록하고, 위치·촬영 방향을 맞추세요." },
  { id: "POINT", label: "관측 영역·임계치", description: "구체 또는 평면으로 관측 범위를 지정하고, 영역별 측정 항목과 경보 기준을 설정하세요." },
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
    const matched = point.rules.filter((rule) => finite(rule.threshold) && (rule.operator === "lt" ? number < Number(rule.threshold) : rule.operator === "lte" ? number <= Number(rule.threshold) : rule.operator === "gt" ? number > Number(rule.threshold) : number >= Number(rule.threshold)));
    const level = matched.some((rule) => rule.severity === "DANGER") ? "DANGER" : matched.length ? "WARNING" : "NORMAL";
    return { level, label: { DANGER: "위험", WARNING: "주의", NORMAL: "정상" }[level], icon: level === "NORMAL" ? "●" : "!" };
  }
  const danger = Number(point?.dangerRange?.min);
  const warning = Number(point?.warningRange?.min);
  const level = Number.isFinite(danger) && number >= danger ? "DANGER" : Number.isFinite(warning) && number >= warning ? "WARNING" : "NORMAL";
  const icon = point?.alertIcon || ({ TEMPERATURE: "🔥", VIBRATION: "〰️", PRESSURE: "⚠️", VIDEO: "📷" }[point?.metric] ?? "⚠️");
  return { level, label: { DANGER: "위험", WARNING: "주의", NORMAL: "정상" }[level], icon: level === "NORMAL" ? "●" : icon };
}

export const SETUP_REQUIREMENTS = Object.freeze({
  BASIC: "필수: 설비명. 모델 파일·사진·제조사 정보는 선택 사항입니다.",
  ASSET: "필수: 표시할 모델, 유효한 크기, 기준좌표 적용. 스캔 사용 시 모델 정합 완료도 확인하세요. 시작 화면은 자동 맞춤을 사용할 수 있습니다.",
  SENSOR: "필수: 센서 이름·시리얼, 센서 조회, 유효한 설치 위치, 위치·화각 보정 확인. 텍스처는 사용할 때 설정하세요.",
  POINT: "필수: 영역 이름, 관측 항목, 연결 센서. 경보는 선택 사항이며 추가한 조건의 기준값은 필수입니다.",
  REVIEW: "완료 처리한 단계의 필수 설정을 다시 확인합니다. 건너뛴 단계는 별도로 표시됩니다.",
});

const finite = (value) => value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value));
export function getSetupStepValidation(step, context) {
  const { equipment, assets = [], sensors = [], points = [] } = context;
  const issue = (target, message, extra = {}) => ({ step, target, message, ...extra });
  if (step === "REVIEW") {
    const setup = getEquipmentSetup(equipment);
    for (const { id } of EQUIPMENT_SETUP_STEPS.slice(0, -1)) {
      if (setup.steps[id] === "SKIPPED") continue;
      const invalid = getSetupStepValidation(id, context);
      if (invalid) return invalid;
      if (setup.steps[id] !== "DONE") return issue("step-start", "이 단계의 설정을 확인하고 ‘완료 후 다음’을 눌러주세요.", { step: id });
    }
    return null;
  }
  if (step === "BASIC" && !equipment?.name?.trim()) return issue("equipment-name", "설비명을 입력하세요.");
  if (step === "ASSET") {
    const model = assets.filter((asset) => ["OBJ", "PLY"].includes(asset.assetType)).at(-1);
    if (!equipment?.shapeTemplateId && !equipment?.enclosure?.enabled && !model) return issue("model-files", "스캔 모델을 등록하거나 이 단계를 건너뛰세요.", { step: "BASIC" });
    if (model && (!model.sourceKey || ["ERROR", "MISSING", "LOADING", "PENDING"].includes(model.status))) return issue("model-files", "등록한 모델의 파일 연결과 불러오기 상태를 확인하세요.", { step: "BASIC" });
    if (equipment?.dimensions && Object.values(equipment.dimensions).some((value) => !finite(value) || Number(value) <= 0)) return issue("model-size", "설비의 가로·높이·깊이를 0보다 크게 입력하세요.");
    if (model && !model.alignmentTransform?.completed) return issue("model-alignment", "크기·방향·위치를 확인한 뒤 ‘모델 정합 완료’를 선택하세요.");
  }
  if (equipment && ["ASSET", "SENSOR", "POINT"].includes(step) && !getEquipmentCoordinateFrame(equipment)) return issue("coordinate-frame", "설비 정면과 원점을 확인한 뒤 ‘기준좌표 적용’을 눌러주세요.", { step: "ASSET" });
  if (step === "SENSOR") {
    if (!sensors.length) return issue("sensor-add", "센서를 등록하거나 이 단계를 건너뛰세요.");
    for (const sensor of sensors) {
      const sensorIssue = (target, message, section = "CONNECTION") => issue(target, `${sensor.name || "센서"}: ${message}`, { sensorId: sensor.id, section });
      if (!sensor.name?.trim()) return sensorIssue("sensor-name", "이름을 입력하세요.");
      if (!sensor.serialNumber?.trim()) return sensorIssue("sensor-serial", "시리얼 번호를 입력하세요.");
      if (!sensor.serverSensorId) return sensorIssue("sensor-lookup", "시리얼 번호로 센서를 조회하세요.");
      const pose = sensor.surfaceMount ? getSensorMountPose(sensor, equipment) : null;
      if (sensor.surfaceMount && (!pose || pose.adjusted)) return sensorIssue("sensor-mount", "부착면과 위치를 다시 확인하세요.", "PLACEMENT");
      if ([sensor.position, sensor.rotation].some((vector) => !vector || ["x", "y", "z"].some((axis) => !finite(vector[axis])))) return sensorIssue("sensor-mount", "설치 위치와 방향을 올바르게 입력하세요.", "PLACEMENT");
      if (sensorHasImaging(sensor) && (![sensor.fieldOfView, sensor.aspectRatio, sensor.near, sensor.far].every(finite) || sensor.fieldOfView < 10 || sensor.fieldOfView > 160 || sensor.aspectRatio <= 0 || sensor.near <= 0 || sensor.far <= sensor.near)) return sensorIssue("sensor-optics", "화각은 10~160도, 관측 거리는 근거리보다 크게 입력하세요.", "PLACEMENT");
      const payload = calibrationPayload(null, equipment, sensor, assets);
      if (!sensor.calibrationConfirmed || sensor.calibrationConfirmationFrame !== referenceFrameKey(payload.coordinateFrame) || (sensor.surfaceMount && sensor.calibrationConfirmationModel !== payload.model.version)) return sensorIssue("sensor-calibration", "실제 설치 위치·방향을 확인한 뒤 보정 확인을 선택하세요.", "PLACEMENT");
      const projection = sensor.textureProjection;
      if (projection?.enabled && projection.kind === "THERMAL" && (!finite(projection.temperatureMin) || !finite(projection.temperatureMax) || projection.temperatureMax <= projection.temperatureMin)) return sensorIssue("sensor-texture", "높은 온도를 낮은 온도보다 크게 입력하세요.", "TEXTURE");
    }
  }
  if (step === "POINT") {
    if (!points.length) return issue("roi-add", "모델에서 관측 영역을 추가하거나 이 단계를 건너뛰세요.");
    for (const point of points) {
      const pointIssue = (target, message) => issue(target, `${point.name || "관측 영역"}: ${message}`, { pointId: point.id });
      if (point.name !== undefined && !point.name.trim()) return pointIssue("roi-name", "영역 이름을 입력하세요.");
      if (point.measurements && !point.measurements.length) return pointIssue("roi-measurements", "관측 항목을 하나 이상 추가하세요.");
      for (const item of point.measurements ?? []) {
        if (!item.name?.trim()) return pointIssue(`measurement-${item.id}-name`, "관측 항목의 표시 이름을 입력하세요.");
        if (["vision.gaugeValue", "vision.switchState"].includes(item.metric) && point.geometryType !== "PLANE") return pointIssue("roi-geometry-type", "게이지·스위치 영상 분석에는 평면 영역을 선택하세요.");
        if (!sensors.some((sensor) => sensor.id === item.sensorId)) return pointIssue(`measurement-${item.id}-sensor`, "관측 항목에 측정 센서를 선택하세요.");
        if (["vision.gaugeValue", "vision.switchState"].includes(item.metric) && !sensorHasImaging(sensors.find((sensor) => sensor.id === item.sensorId))) return pointIssue(`measurement-${item.id}-sensor`, "게이지·스위치 감지에는 영상 센서를 선택하세요.");
        for (const [index, rule] of (item.rules ?? []).entries()) {
          if (!finite(rule.threshold)) return pointIssue(`measurement-${item.id}-rule-${index}`, "경보 조건의 기준값을 입력하세요.");
        }
      }
      if (!point.measurements?.length) {
        if (!point.sensorIds?.some((id) => sensors.some((sensor) => sensor.id === id))) return pointIssue("roi-measurements", "각 관측 항목에 측정 센서를 선택하세요.");
        const limits = [point.normalRange?.max, point.warningRange?.max, point.dangerRange?.max];
        if (limits.some((value) => !finite(value)) || Number(limits[0]) >= Number(limits[1]) || Number(limits[1]) >= Number(limits[2])) return pointIssue("roi-measurements", "임계치를 정상 < 주의 < 위험 순서로 입력하세요.");
      }
    }
  }
  return null;
}

export function getSetupStepIssue(step, context) {
  return getSetupStepValidation(step, context)?.message ?? "";
}
