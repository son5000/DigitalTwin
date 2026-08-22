const APPEARANCE_PRESETS = {
  BASIC: { color: "#5D8FA3", opacity: 0.35, showEdges: true },
  CABINET: { color: "#4B718C", opacity: 0.3, showEdges: true },
  MECHANICAL: { color: "#4F7F89", opacity: 0.38, showEdges: true },
  PIPE: { color: "#78909C", opacity: 0.42, showEdges: true },
  DUCT: { color: "#7295A3", opacity: 0.32, showEdges: true },
  TANK: { color: "#477D91", opacity: 0.34, showEdges: true },
  SAFETY: { color: "#D99A36", opacity: 0.55, showEdges: true },
  SENSOR: { color: "#4C91C7", opacity: 0.7, showEdges: true },
  UTILITY: { color: "#618B72", opacity: 0.45, showEdges: true },
  CUSTOM: { color: "#7A6E98", opacity: 0.35, showEdges: true },
};

function createTemplate({
  id,
  category,
  name,
  nameKo,
  dimensions,
  keywords = [],
  parameters = {},
  parameterDefinitions = [],
  generator = category,
}) {
  return {
    id,
    domain: "EQUIPMENT",
    category,
    name,
    nameKo,
    shortName: id.replaceAll("_", " "),
    geometryType: "PARAMETRIC",
    generator,
    keywords: [name.toLowerCase(), nameKo, ...keywords],
    defaultDimensions: dimensions,
    defaultParameters: parameters,
    parameterDefinitions,
    defaultAppearance: APPEARANCE_PRESETS[category],
  };
}

const lengthParameter = {
  key: "length",
  label: "Length",
  unit: "m",
  step: 0.1,
  min: 0.1,
};
const diameterParameter = {
  key: "diameter",
  label: "Diameter",
  unit: "m",
  step: 0.01,
  min: 0.1,
};
const heightParameter = {
  key: "height",
  label: "Height",
  unit: "m",
  step: 0.1,
  min: 0.1,
};

export const EQUIPMENT_CATEGORIES = [
  { id: "ALL", name: "All", nameKo: "전체" },
  { id: "BASIC", name: "Basic Shapes", nameKo: "기본 도형" },
  { id: "CABINET", name: "Cabinet / Electrical", nameKo: "전기·캐비닛" },
  { id: "MECHANICAL", name: "Mechanical", nameKo: "기계 설비" },
  { id: "PIPE", name: "Pipe & Fitting", nameKo: "배관·피팅" },
  { id: "DUCT", name: "Duct / HVAC", nameKo: "덕트·공조" },
  { id: "TANK", name: "Tank / Vessel", nameKo: "탱크·용기" },
  { id: "SAFETY", name: "Safety", nameKo: "안전" },
  { id: "SENSOR", name: "Sensors", nameKo: "센서" },
  { id: "UTILITY", name: "Utility", nameKo: "유틸리티" },
  { id: "CUSTOM", name: "Custom", nameKo: "사용자 정의" },
];

export const EQUIPMENT_SHAPE_TEMPLATES = [
  createTemplate({ id: "BOX", category: "BASIC", name: "Box", nameKo: "박스", dimensions: { width: 1, height: 1, depth: 1 }, keywords: ["cube", "사각형"] }),
  createTemplate({ id: "ROUNDED_BOX", category: "BASIC", name: "Rounded Box", nameKo: "라운드 박스", dimensions: { width: 1.2, height: 0.8, depth: 1 }, keywords: ["round", "둥근 박스"] }),
  createTemplate({ id: "CYLINDER", category: "BASIC", name: "Cylinder", nameKo: "원통", dimensions: { width: 0.8, height: 1.5, depth: 0.8 }, keywords: ["원기둥"], parameters: { diameter: 0.8, height: 1.5 }, parameterDefinitions: [diameterParameter, heightParameter] }),
  createTemplate({ id: "SPHERE", category: "BASIC", name: "Sphere", nameKo: "구", dimensions: { width: 1, height: 1, depth: 1 }, keywords: ["ball", "구체"] }),
  createTemplate({ id: "CONE", category: "BASIC", name: "Cone", nameKo: "원뿔", dimensions: { width: 1, height: 1.5, depth: 1 }, keywords: ["콘"] }),
  createTemplate({ id: "CAPSULE", category: "BASIC", name: "Capsule", nameKo: "캡슐", dimensions: { width: 0.8, height: 1.8, depth: 0.8 }, keywords: ["rounded cylinder"] }),
  createTemplate({ id: "PLANE", category: "BASIC", name: "Plane", nameKo: "평면", dimensions: { width: 1.5, height: 0.02, depth: 1.5 }, keywords: ["surface", "평면"] }),
  createTemplate({ id: "PRISM", category: "BASIC", name: "Prism", nameKo: "프리즘", dimensions: { width: 1.2, height: 1, depth: 1 }, keywords: ["삼각 기둥"] }),
  createTemplate({ id: "WEDGE", category: "BASIC", name: "Wedge", nameKo: "쐐기", dimensions: { width: 1.2, height: 0.8, depth: 1 }, keywords: ["경사"] }),

  createTemplate({ id: "CABINET_SINGLE", category: "CABINET", name: "Single Cabinet", nameKo: "단문형 캐비닛", dimensions: { width: 0.8, height: 2, depth: 0.6 }, keywords: ["cabinet", "캐비닛", "panel"] }),
  createTemplate({ id: "CABINET_DOUBLE", category: "CABINET", name: "Double Cabinet", nameKo: "양문형 캐비닛", dimensions: { width: 1.2, height: 2, depth: 0.8 }, keywords: ["cabinet", "캐비닛", "mcc"] }),
  createTemplate({ id: "CABINET_HORIZONTAL_SPLIT", category: "CABINET", name: "Horizontal Split Cabinet", nameKo: "상하 분할 캐비닛", dimensions: { width: 1, height: 2, depth: 0.7 }, keywords: ["battery", "배터리"] }),
  createTemplate({ id: "CABINET_VERTICAL_SPLIT", category: "CABINET", name: "Vertical Split Cabinet", nameKo: "좌우 분할 캐비닛", dimensions: { width: 1.1, height: 2, depth: 0.7 }, keywords: ["cabinet", "캐비닛", "split"] }),
  createTemplate({ id: "RACK", category: "CABINET", name: "Equipment Rack", nameKo: "설비 랙", dimensions: { width: 0.7, height: 2.1, depth: 0.9 }, keywords: ["rack", "랙"] }),
  createTemplate({ id: "SERVER_RACK", category: "CABINET", name: "Server Rack", nameKo: "서버 랙", dimensions: { width: 0.6, height: 2, depth: 1 }, keywords: ["server", "서버"] }),
  createTemplate({ id: "CONTROL_PANEL", category: "CABINET", name: "Control Panel", nameKo: "제어반", dimensions: { width: 1, height: 1.8, depth: 0.5 }, keywords: ["control", "제어"] }),
  createTemplate({ id: "DISTRIBUTION_PANEL", category: "CABINET", name: "Distribution Panel", nameKo: "배전반", dimensions: { width: 1.2, height: 2, depth: 0.65 }, keywords: ["distribution", "배전"] }),
  createTemplate({ id: "SWITCHBOARD", category: "CABINET", name: "Switchboard", nameKo: "스위치보드", dimensions: { width: 1.8, height: 2.1, depth: 0.8 }, keywords: ["switchboard", "수배전반"] }),
  createTemplate({ id: "MCC_PANEL", category: "CABINET", name: "MCC Panel", nameKo: "MCC 패널", dimensions: { width: 1.2, height: 2.1, depth: 0.8 }, keywords: ["mcc", "motor control"] }),
  createTemplate({ id: "UPS", category: "CABINET", name: "UPS", nameKo: "무정전 전원장치", dimensions: { width: 0.8, height: 1.6, depth: 0.8 }, keywords: ["power", "전원"] }),
  createTemplate({ id: "BATTERY_CABINET", category: "CABINET", name: "Battery Cabinet", nameKo: "배터리 캐비닛", dimensions: { width: 1, height: 1.8, depth: 0.75 }, keywords: ["battery", "배터리"] }),
  createTemplate({ id: "TRANSFORMER", category: "CABINET", name: "Transformer Proxy", nameKo: "변압기", dimensions: { width: 1.4, height: 1.7, depth: 1.1 }, keywords: ["transformer", "변압"] }),
  createTemplate({ id: "JUNCTION_BOX", category: "CABINET", name: "Junction Box", nameKo: "정션 박스", dimensions: { width: 0.5, height: 0.6, depth: 0.25 }, keywords: ["electrical box", "전기 박스"] }),
  createTemplate({ id: "ELECTRICAL_BOX", category: "CABINET", name: "Electrical Box", nameKo: "전기 박스", dimensions: { width: 0.65, height: 0.8, depth: 0.3 }, keywords: ["electrical", "전기", "box"] }),

  createTemplate({ id: "MOTOR", category: "MECHANICAL", name: "Motor", nameKo: "모터", dimensions: { width: 1.2, height: 0.8, depth: 0.7 }, keywords: ["motor", "전동기"] }),
  createTemplate({ id: "PUMP", category: "MECHANICAL", name: "Pump", nameKo: "펌프", dimensions: { width: 1.3, height: 0.9, depth: 0.8 }, keywords: ["pump", "펌프"] }),
  createTemplate({ id: "COMPRESSOR", category: "MECHANICAL", name: "Compressor", nameKo: "압축기", dimensions: { width: 1.6, height: 1.1, depth: 0.9 }, keywords: ["compressor", "압축"] }),
  createTemplate({ id: "BLOWER", category: "MECHANICAL", name: "Blower", nameKo: "블로워", dimensions: { width: 1.2, height: 1.1, depth: 0.8 }, keywords: ["blower", "송풍기"] }),
  createTemplate({ id: "FAN", category: "MECHANICAL", name: "Fan", nameKo: "팬", dimensions: { width: 1, height: 1, depth: 0.45 }, keywords: ["fan", "환풍기"] }),
  createTemplate({ id: "GEARBOX", category: "MECHANICAL", name: "Gearbox", nameKo: "기어박스", dimensions: { width: 1, height: 0.8, depth: 0.8 }, keywords: ["gear", "감속기"] }),
  createTemplate({ id: "GENERATOR", category: "MECHANICAL", name: "Generator", nameKo: "발전기", dimensions: { width: 2.2, height: 1.5, depth: 1.1 }, keywords: ["generator", "발전"] }),
  createTemplate({ id: "CHILLER", category: "MECHANICAL", name: "Chiller", nameKo: "칠러", dimensions: { width: 2.4, height: 1.6, depth: 1.1 }, keywords: ["chiller", "냉동기", "냉각"] }),
  createTemplate({ id: "BOILER", category: "MECHANICAL", name: "Boiler", nameKo: "보일러", dimensions: { width: 2, height: 2.2, depth: 1.3 }, keywords: ["boiler", "보일러", "heating"] }),
  createTemplate({ id: "HEAT_EXCHANGER", category: "MECHANICAL", name: "Heat Exchanger", nameKo: "열교환기", dimensions: { width: 2, height: 1, depth: 0.8 }, keywords: ["heat", "열교환"] }),
  createTemplate({ id: "MACHINE_BASE", category: "MECHANICAL", name: "Machine Base", nameKo: "머신 베이스", dimensions: { width: 2, height: 0.3, depth: 1.2 }, keywords: ["base", "베이스"] }),

  createTemplate({ id: "PIPE_STRAIGHT", category: "PIPE", name: "Straight Pipe", nameKo: "직선 배관", dimensions: { width: 2, height: 0.12, depth: 0.12 }, keywords: ["pipe", "piping", "배관", "파이프"], parameters: { length: 2, diameter: 0.12 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_STRAIGHT" }),
  createTemplate({ id: "PIPE_ELBOW_90", category: "PIPE", name: "90 Degree Elbow", nameKo: "90도 엘보", dimensions: { width: 0.8, height: 0.12, depth: 0.8 }, keywords: ["pipe", "배관", "elbow", "엘보"], parameters: { diameter: 0.12, bendRadius: 0.4 }, parameterDefinitions: [diameterParameter], generator: "PIPE_ELBOW_90" }),
  createTemplate({ id: "PIPE_ELBOW_45", category: "PIPE", name: "45 Degree Elbow", nameKo: "45도 엘보", dimensions: { width: 0.8, height: 0.12, depth: 0.55 }, keywords: ["pipe", "배관", "elbow", "엘보"], parameters: { diameter: 0.12, bendRadius: 0.4 }, parameterDefinitions: [diameterParameter], generator: "PIPE_ELBOW_45" }),
  createTemplate({ id: "PIPE_T", category: "PIPE", name: "T Junction", nameKo: "T 분기 배관", dimensions: { width: 1.2, height: 0.12, depth: 0.7 }, keywords: ["pipe", "배관", "tee", "티"] , parameters: { length: 1.2, diameter: 0.12, branchLength: 0.7 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_T" }),
  createTemplate({ id: "PIPE_Y", category: "PIPE", name: "Y Junction", nameKo: "Y 분기 배관", dimensions: { width: 1.2, height: 0.12, depth: 0.8 }, keywords: ["pipe", "배관", "junction"], parameters: { length: 1.2, diameter: 0.12 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_Y" }),
  createTemplate({ id: "PIPE_REDUCER", category: "PIPE", name: "Reducer", nameKo: "레듀서", dimensions: { width: 0.7, height: 0.2, depth: 0.2 }, keywords: ["pipe", "배관", "reducer"], parameters: { length: 0.7, diameter: 0.2, endDiameter: 0.1 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_REDUCER" }),
  createTemplate({ id: "PIPE_FLANGE", category: "PIPE", name: "Flange", nameKo: "플랜지", dimensions: { width: 0.25, height: 0.3, depth: 0.3 }, keywords: ["pipe", "배관", "flange", "플랜지"], parameters: { length: 0.25, diameter: 0.3 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_FLANGE" }),
  createTemplate({ id: "PIPE_VALVE", category: "PIPE", name: "Valve", nameKo: "밸브", dimensions: { width: 0.7, height: 0.6, depth: 0.25 }, keywords: ["pipe", "배관", "valve", "밸브"], parameters: { length: 0.7, diameter: 0.16 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_VALVE" }),
  createTemplate({ id: "PIPE_CAP", category: "PIPE", name: "Pipe Cap", nameKo: "배관 캡", dimensions: { width: 0.25, height: 0.18, depth: 0.18 }, keywords: ["pipe", "배관", "cap", "마개"], parameters: { length: 0.25, diameter: 0.18 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_CAP" }),
  createTemplate({ id: "PIPE_CONNECTOR", category: "PIPE", name: "Connector", nameKo: "배관 커넥터", dimensions: { width: 0.4, height: 0.16, depth: 0.16 }, keywords: ["pipe", "배관", "connector", "연결"] , parameters: { length: 0.4, diameter: 0.16 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "PIPE_CONNECTOR" }),
  createTemplate({ id: "FLEXIBLE_HOSE", category: "PIPE", name: "Flexible Hose", nameKo: "플렉시블 호스", dimensions: { width: 1.5, height: 0.1, depth: 0.35 }, keywords: ["pipe", "배관", "hose", "호스"], parameters: { length: 1.5, diameter: 0.1 }, parameterDefinitions: [lengthParameter, diameterParameter], generator: "FLEXIBLE_HOSE" }),

  createTemplate({ id: "DUCT_STRAIGHT", category: "DUCT", name: "Straight Duct", nameKo: "직선 덕트", dimensions: { width: 2, height: 0.6, depth: 0.8 }, keywords: ["duct", "덕트", "hvac"], parameters: { length: 2, width: 0.8, height: 0.6 }, parameterDefinitions: [lengthParameter, { key: "width", label: "Width", unit: "m", step: 0.01, min: 0.1 }, { key: "height", label: "Height", unit: "m", step: 0.01, min: 0.1 }] }),
  createTemplate({ id: "DUCT_ELBOW", category: "DUCT", name: "Duct Elbow", nameKo: "덕트 엘보", dimensions: { width: 1, height: 0.6, depth: 1 }, keywords: ["duct", "덕트", "elbow"] }),
  createTemplate({ id: "AIR_TERMINAL", category: "DUCT", name: "Air Terminal", nameKo: "디퓨저", dimensions: { width: 0.8, height: 0.12, depth: 0.8 }, keywords: ["duct", "hvac", "diffuser", "디퓨저"] }),

  createTemplate({ id: "TANK_VERTICAL", category: "TANK", name: "Vertical Tank", nameKo: "수직 탱크", dimensions: { width: 1.5, height: 2.8, depth: 1.5 }, keywords: ["tank", "탱크"], parameters: { diameter: 1.5, height: 2.8 }, parameterDefinitions: [diameterParameter, heightParameter] }),
  createTemplate({ id: "TANK_HORIZONTAL", category: "TANK", name: "Horizontal Tank", nameKo: "수평 탱크", dimensions: { width: 3, height: 1.4, depth: 1.4 }, keywords: ["tank", "탱크", "vessel"], parameters: { length: 3, diameter: 1.4 }, parameterDefinitions: [lengthParameter, diameterParameter] }),
  createTemplate({ id: "PRESSURE_VESSEL", category: "TANK", name: "Pressure Vessel", nameKo: "압력 용기", dimensions: { width: 2.5, height: 1.2, depth: 1.2 }, keywords: ["vessel", "용기", "tank"] }),
  createTemplate({ id: "SQUARE_TANK", category: "TANK", name: "Square Tank", nameKo: "사각 탱크", dimensions: { width: 2, height: 2, depth: 2 }, keywords: ["tank", "탱크", "storage"] }),
  createTemplate({ id: "STORAGE_TANK", category: "TANK", name: "Storage Tank", nameKo: "저장 탱크", dimensions: { width: 2.4, height: 3.2, depth: 2.4 }, keywords: ["storage", "저장", "tank", "탱크"] }),
  createTemplate({ id: "SILO", category: "TANK", name: "Silo", nameKo: "사일로", dimensions: { width: 2, height: 4, depth: 2 }, keywords: ["silo", "사일로"] }),
  createTemplate({ id: "HOPPER", category: "TANK", name: "Hopper", nameKo: "호퍼", dimensions: { width: 1.8, height: 2.4, depth: 1.8 }, keywords: ["hopper", "호퍼"] }),
  createTemplate({ id: "DRUM", category: "TANK", name: "Drum", nameKo: "드럼", dimensions: { width: 0.6, height: 0.9, depth: 0.6 }, keywords: ["drum", "드럼통"] }),


  createTemplate({ id: "SAFETY_BARRIER", category: "SAFETY", name: "Safety Barrier", nameKo: "안전 차단대", dimensions: { width: 2, height: 1, depth: 0.15 }, keywords: ["safety", "안전", "barrier"] }),
  createTemplate({ id: "BOLLARD", category: "SAFETY", name: "Bollard", nameKo: "볼라드", dimensions: { width: 0.18, height: 1, depth: 0.18 }, keywords: ["safety", "안전", "bollard"] }),
  createTemplate({ id: "FIRE_EXTINGUISHER", category: "SAFETY", name: "Fire Extinguisher", nameKo: "소화기", dimensions: { width: 0.25, height: 0.65, depth: 0.25 }, keywords: ["fire", "소화", "safety"] }),

  createTemplate({ id: "SENSOR_TEMPERATURE", category: "SENSOR", name: "Temperature Sensor", nameKo: "온도 센서", dimensions: { width: 0.14, height: 0.22, depth: 0.1 }, keywords: ["sensor", "센서", "temperature", "온도"] }),
  createTemplate({ id: "SENSOR_VIBRATION", category: "SENSOR", name: "Vibration Sensor", nameKo: "진동 센서", dimensions: { width: 0.12, height: 0.16, depth: 0.12 }, keywords: ["sensor", "센서", "vibration", "진동"] }),
  createTemplate({ id: "SENSOR_GAS", category: "SENSOR", name: "Gas Sensor", nameKo: "가스 센서", dimensions: { width: 0.18, height: 0.25, depth: 0.12 }, keywords: ["sensor", "센서", "gas", "가스"] }),
  createTemplate({ id: "SENSOR_CURRENT", category: "SENSOR", name: "Current Sensor", nameKo: "전류 센서", dimensions: { width: 0.15, height: 0.2, depth: 0.1 }, keywords: ["sensor", "센서", "current", "전류"] }),
  createTemplate({ id: "CAMERA", category: "SENSOR", name: "Camera", nameKo: "카메라", dimensions: { width: 0.3, height: 0.22, depth: 0.45 }, keywords: ["camera", "카메라", "cctv"] }),
  createTemplate({ id: "THERMAL_CAMERA", category: "SENSOR", name: "Thermal Camera", nameKo: "열화상 카메라", dimensions: { width: 0.32, height: 0.24, depth: 0.4 }, keywords: ["thermal", "열화상", "camera"] }),
  createTemplate({ id: "GENERIC_SENSOR", category: "SENSOR", name: "Generic Sensor", nameKo: "범용 센서", dimensions: { width: 0.16, height: 0.2, depth: 0.12 }, keywords: ["generic", "sensor", "범용", "센서"] }),

  createTemplate({ id: "CABLE_TRAY", category: "UTILITY", name: "Cable Tray", nameKo: "케이블 트레이", dimensions: { width: 2, height: 0.12, depth: 0.5 }, keywords: ["cable", "케이블", "tray"] }),
  createTemplate({ id: "WORK_LIGHT", category: "UTILITY", name: "Work Light", nameKo: "작업등", dimensions: { width: 0.4, height: 0.15, depth: 0.18 }, keywords: ["light", "조명"] }),
  createTemplate({ id: "UTILITY_STAND", category: "UTILITY", name: "Utility Stand", nameKo: "설비 스탠드", dimensions: { width: 0.8, height: 1.2, depth: 0.8 }, keywords: ["stand", "스탠드"] }),

  createTemplate({ id: "CUSTOM_PRIMITIVE", category: "CUSTOM", name: "Custom Primitive", nameKo: "사용자 정의 프록시", dimensions: { width: 1, height: 1, depth: 1 }, keywords: ["custom", "사용자", "proxy"] }),
];

export const EQUIPMENT_SHAPE_TEMPLATE_MAP = Object.fromEntries(
  EQUIPMENT_SHAPE_TEMPLATES.map((template) => [template.id, template]),
);

export const DEFAULT_WORLD = {
  width: 20,
  depth: 15,
  wallHeight: 3,
};

export const VIEW_MODES = {
  LAYOUT_2D: "2D",
  VIEW_3D: "3D",
};

export const TRANSFORM_MODES = {
  TRANSLATE: "translate",
  ROTATE: "rotate",
};

export const GRID_SNAP_OPTIONS = [0.01, 0.05, 0.1, 0.5, 1];

export const APPEARANCE_COLOR_PRESETS = [
  "#78909C",
  "#455A64",
  "#FFFFFF",
  "#212121",
  "#2563EB",
  "#55B7FF",
  "#2E8B57",
  "#E4B53E",
  "#E67E22",
  "#D64545",
];
