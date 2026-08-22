import { SITE_OBJECT_GEOMETRY_MODES } from "./siteEnvironmentTemplates.types.js";

export const OBJECT_LIBRARY_DRAG_TYPE = "application/x-digital-twin-object";

export const OBJECT_LIBRARY_CATEGORY_IDS = Object.freeze({
  BUILDING: "BUILDING",
  INDUSTRIAL_BUILDING: "INDUSTRIAL_BUILDING",
  VEHICLE: "VEHICLE",
  TRAFFIC_FACILITY: "TRAFFIC_FACILITY",
  ROAD_FACILITY: "ROAD_FACILITY",
  ENVIRONMENT: "ENVIRONMENT",
  LANDSCAPING: "LANDSCAPING",
  INDUSTRIAL_EQUIPMENT: "INDUSTRIAL_EQUIPMENT",
  ELECTRICAL_EQUIPMENT: "ELECTRICAL_EQUIPMENT",
  LOGISTICS: "LOGISTICS",
  SAFETY_FACILITY: "SAFETY_FACILITY",
  PIPE_TANK: "PIPE_TANK",
  PARKING_FACILITY: "PARKING_FACILITY",
});

const CATEGORY_SOURCE = [
  ["BUILDING", "건축물", "Building", "일반·주거·업무 건축물", "building", [["OFFICE", "업무시설"], ["RESIDENTIAL", "주거시설"], ["COMMERCIAL", "상업시설"], ["BACKGROUND", "주변 표현"]]],
  ["INDUSTRIAL_BUILDING", "산업용 건축물", "Industrial Building", "생산·물류·유틸리티 건축물", "factory", [["FACTORY", "생산 공장"], ["PROCESS", "공정 시설"], ["WAREHOUSE", "창고·물류동"], ["UTILITY", "유틸리티동"]]],
  ["VEHICLE", "차량", "Vehicle", "승용·상용·산업 차량", "vehicle", [["PASSENGER", "승용 차량"], ["COMMERCIAL", "상용 차량"], ["INDUSTRIAL", "산업 차량"]]],
  ["TRAFFIC_FACILITY", "교통 시설", "Traffic Facility", "교통 흐름과 접근 제어", "traffic", [["SIGNAL", "신호·표지"], ["ACCESS", "접근 제어"]]],
  ["ROAD_FACILITY", "도로 시설", "Road Facility", "도로·보행·경계 시설", "road", [["SURFACE", "노면"], ["BOUNDARY", "경계·보호"]]],
  ["ENVIRONMENT", "환경", "Environment", "부지의 자연·배경 요소", "environment", [["GROUND", "지면"], ["NATURAL", "자연물"], ["AMENITY", "편의시설"]]],
  ["LANDSCAPING", "조경", "Landscaping", "산업 단지 조경과 식재", "landscape", [["TREE", "교목"], ["PLANTING", "식재"], ["FURNITURE", "조경 시설"]]],
  ["INDUSTRIAL_EQUIPMENT", "산업 설비", "Industrial Equipment", "생산·기계 설비 프록시", "mechanical", [["ROTATING", "회전 기계"], ["PROCESS", "공정 설비"], ["HANDLING", "이송 설비"]]],
  ["ELECTRICAL_EQUIPMENT", "전기 설비", "Electrical Equipment", "배전·전력·제어 설비", "electrical", [["DISTRIBUTION", "배전"], ["POWER", "전력"], ["CONTROL", "제어"]]],
  ["LOGISTICS", "물류 시설", "Logistics", "보관·상하역·이송 시설", "logistics", [["STORAGE", "보관"], ["HANDLING", "하역·이송"]]],
  ["SAFETY_FACILITY", "안전 시설", "Safety Facility", "작업자·설비 안전 요소", "safety", [["PROTECTION", "보호 시설"], ["EMERGENCY", "비상 대응"]]],
  ["PIPE_TANK", "배관 / 탱크", "Pipe / Tank", "유체 이송과 저장 설비", "tank", [["PIPE", "배관"], ["TANK", "탱크·용기"]]],
  ["PARKING_FACILITY", "주차 시설", "Parking Facility", "주차 구획과 부대시설", "parking", [["PARKING", "주차 구획"], ["CONTROL", "주차 제어"], ["AMENITY", "편의시설"]]],
];

export const OBJECT_LIBRARY_CATEGORIES = Object.freeze(CATEGORY_SOURCE.map(([id, name, nameEn, description, iconKey, subcategories]) => ({
  id,
  name,
  nameEn,
  description,
  iconKey,
  subcategories: subcategories.map(([subId, label]) => ({ id: subId, label })),
})));

export const BUILDING_VARIANT_GROUPS = Object.freeze([
  {
    id: "roofStyle",
    label: "Roof",
    options: [
      ["FLAT", "Flat"], ["GABLE", "Gable"], ["SAWTOOTH", "Sawtooth"], ["INDUSTRIAL_VENT", "Industrial Vent"],
    ].map(([id, label]) => ({ id, label })),
  },
  {
    id: "facadeStyle",
    label: "Facade",
    options: [
      ["CONCRETE", "Concrete"], ["BRICK", "Brick"], ["METAL_PANEL", "Metal Panel"], ["GLASS", "Glass"],
      ["INDUSTRIAL_PANEL", "Industrial Panel"], ["MIXED", "Glass + Concrete"], ["SANDWICH_PANEL", "Sandwich Panel"],
    ].map(([id, label]) => ({ id, label })),
  },
  {
    id: "windowStyle",
    label: "Window Style",
    options: [
      ["FULL_GLASS", "Full Glass"], ["CURTAIN_WALL", "Curtain Wall"], ["GRID", "Grid Window"],
      ["HORIZONTAL", "Horizontal Window"], ["VERTICAL", "Vertical Window"], ["SMALL_INDUSTRIAL", "Small Industrial"],
      ["LARGE_FACTORY", "Large Factory"], ["VILLA", "Villa Window"],
    ].map(([id, label]) => ({ id, label })),
  },
  {
    id: "entranceStyle",
    label: "Entrance",
    options: [
      ["STANDARD", "일반 출입문"], ["SHUTTER", "산업용 셔터"], ["LOADING_DOCK", "Loading Dock"],
      ["VEHICLE_GATE", "차량 출입구"], ["DOUBLE", "이중 출입구"],
    ].map(([id, label]) => ({ id, label })),
  },
]);

const FACADE_COLORS = {
  CONCRETE: "#9aa5aa",
  BRICK: "#8f6558",
  METAL_PANEL: "#7c8f9b",
  GLASS: "#52768a",
  INDUSTRIAL_PANEL: "#82939a",
  MIXED: "#7f929c",
  SANDWICH_PANEL: "#a3aa9e",
};

function building([id, name, description, subcategoryId, profile, width, depth, floorCount, roofStyle, facadeStyle, windowStyle, entranceStyle, extras = []]) {
  return {
    id,
    categoryId: id === "ENVIRONMENT_BUILDING" ? OBJECT_LIBRARY_CATEGORY_IDS.BUILDING : profile.startsWith("INDUSTRIAL") ? OBJECT_LIBRARY_CATEGORY_IDS.INDUSTRIAL_BUILDING : OBJECT_LIBRARY_CATEGORY_IDS.BUILDING,
    subcategoryId,
    name,
    nameEn: id.replaceAll("_", " ").toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description,
    iconKey: profile.startsWith("INDUSTRIAL") ? "factory" : "building",
    type: "BUILDING",
    assetKind: "BUILDING",
    profile,
    createsBuilding: id !== "ENVIRONMENT_BUILDING",
    geometryMode: SITE_OBJECT_GEOMETRY_MODES.AREA,
    width,
    depth,
    height: Math.max(4, floorCount * (profile.includes("WAREHOUSE") ? 5 : 3.6)),
    color: FACADE_COLORS[facadeStyle],
    material: facadeStyle.includes("METAL") || facadeStyle.includes("PANEL") ? "METAL" : "CONCRETE",
    parameters: { floorCount, floorHeight: profile.includes("INDUSTRIAL") ? 5 : 3.6, roofType: roofStyle, entranceCount: entranceStyle === "DOUBLE" ? 2 : 1, stairCount: floorCount > 2 ? 2 : 1, extras },
    defaultVariants: { roofStyle, facadeStyle, windowStyle, entranceStyle },
    variantGroups: BUILDING_VARIANT_GROUPS,
    keywords: [name, description, profile, roofStyle, facadeStyle, windowStyle, entranceStyle],
  };
}

const BUILDINGS = [
  ["BUILDING", "일반 오피스", "균형 잡힌 업무용 코어 건축물", "OFFICE", "OFFICE_STANDARD", 24, 16, 5, "FLAT", "MIXED", "GRID", "DOUBLE"],
  ["GLASS_OFFICE", "통유리 커튼월 빌딩", "전면 유리와 촘촘한 수직 Mullion", "OFFICE", "OFFICE_GLASS", 28, 20, 8, "FLAT", "GLASS", "CURTAIN_WALL", "DOUBLE"],
  ["COMMERCIAL_BLOCK", "상가", "1층 쇼윈도와 상부 수평창이 있는 상업시설", "COMMERCIAL", "COMMERCIAL", 24, 15, 3, "FLAT", "MIXED", "HORIZONTAL", "DOUBLE"],
  ["DETACHED_HOUSE", "단독주택", "박공지붕과 현관 포치가 있는 주택", "RESIDENTIAL", "HOUSE", 12, 10, 2, "GABLE", "BRICK", "VILLA", "STANDARD"],
  ["VILLA", "빌라", "발코니와 세로창을 가진 중층 주거시설", "RESIDENTIAL", "VILLA", 18, 14, 4, "FLAT", "BRICK", "VERTICAL", "STANDARD"],
  ["LOW_RISE_OFFICE", "저층 업무시설", "긴 수평창과 캐노피가 있는 업무동", "OFFICE", "OFFICE_LOW", 30, 18, 3, "FLAT", "CONCRETE", "HORIZONTAL", "DOUBLE", ["CANOPY"]],
  ["HIGH_RISE_TOWER", "고층 타워", "슬림한 코어와 Setback을 가진 고층 타워", "OFFICE", "TOWER", 20, 20, 16, "FLAT", "GLASS", "CURTAIN_WALL", "DOUBLE", ["SETBACK"]],
  ["LOGISTICS_WAREHOUSE", "물류창고", "대형 Span과 반복 Loading Dock", "COMMERCIAL", "WAREHOUSE", 48, 30, 1, "GABLE", "METAL_PANEL", "SMALL_INDUSTRIAL", "LOADING_DOCK", ["DOCKS"]],
  ["ENVIRONMENT_BUILDING", "환경 건축물", "멀리 배치하는 단순화된 주변 건축물", "BACKGROUND", "BACKGROUND", 18, 12, 3, "FLAT", "CONCRETE", "GRID", "STANDARD"],
].map(building);

const INDUSTRIAL_BUILDINGS = [
  ["FACTORY_GENERAL", "일반 제조 공장", "범용 생산 Hall", "FACTORY", "INDUSTRIAL_GENERAL", 42, 26, 1, "GABLE", "METAL_PANEL", "LARGE_FACTORY", "SHUTTER", ["VENTS"]],
  ["FACTORY_LARGE", "대형 생산 공장", "긴 생산 Line과 복수 출입구", "FACTORY", "INDUSTRIAL_LARGE", 72, 38, 1, "INDUSTRIAL_VENT", "INDUSTRIAL_PANEL", "HORIZONTAL", "VEHICLE_GATE", ["VENTS", "SHUTTERS"]],
  ["FACTORY_SMALL", "소형 제조동", "소규모 가공과 조립에 적합한 동", "FACTORY", "INDUSTRIAL_SMALL", 24, 16, 1, "GABLE", "SANDWICH_PANEL", "SMALL_INDUSTRIAL", "SHUTTER"],
  ["FACTORY_STEEL", "철골 구조 공장", "외부 철골 Frame이 드러나는 공장", "FACTORY", "INDUSTRIAL_STEEL", 46, 28, 1, "GABLE", "METAL_PANEL", "LARGE_FACTORY", "SHUTTER", ["STEEL_FRAME"]],
  ["FACTORY_SANDWICH", "샌드위치 패널 공장", "패널 Joint가 명확한 생산동", "FACTORY", "INDUSTRIAL_PANEL", 40, 24, 1, "GABLE", "SANDWICH_PANEL", "HORIZONTAL", "SHUTTER"],
  ["FACTORY_LOGISTICS", "물류창고형 공장", "생산과 출하 Dock이 결합된 공장", "WAREHOUSE", "INDUSTRIAL_WAREHOUSE", 58, 34, 1, "FLAT", "METAL_PANEL", "SMALL_INDUSTRIAL", "LOADING_DOCK", ["DOCKS"]],
  ["FACTORY_AUTOMOTIVE", "자동차 생산 공장", "대형 Span과 Roof Vent가 있는 조립 공장", "FACTORY", "INDUSTRIAL_AUTO", 80, 42, 1, "SAWTOOTH", "INDUSTRIAL_PANEL", "LARGE_FACTORY", "VEHICLE_GATE", ["VENTS", "SHUTTERS"]],
  ["FACTORY_ELECTRONICS", "전자제품 생산 공장", "정돈된 Panel과 연속창 생산동", "FACTORY", "INDUSTRIAL_ELECTRONICS", 54, 30, 2, "FLAT", "MIXED", "HORIZONTAL", "DOUBLE", ["LOUVERS"]],
  ["FACTORY_CLEANROOM", "반도체 / 클린룸형 공장", "밀폐 외벽과 대형 공조 Penthouse", "PROCESS", "INDUSTRIAL_CLEANROOM", 64, 38, 3, "INDUSTRIAL_VENT", "INDUSTRIAL_PANEL", "SMALL_INDUSTRIAL", "DOUBLE", ["MEP_PENTHOUSE", "DUCTS"]],
  ["FACTORY_FOOD", "식품 생산 공장", "위생 패널과 분리 출입구를 가진 공장", "PROCESS", "INDUSTRIAL_FOOD", 48, 28, 2, "GABLE", "SANDWICH_PANEL", "HORIZONTAL", "DOUBLE", ["LOUVERS"]],
  ["FACTORY_CHEMICAL", "화학 플랜트형 건물", "Pipe Rack과 Vent Stack이 결합된 공정동", "PROCESS", "INDUSTRIAL_CHEMICAL", 44, 30, 3, "FLAT", "CONCRETE", "SMALL_INDUSTRIAL", "VEHICLE_GATE", ["PIPE_RACK", "STACK"]],
  ["FACTORY_POWER", "발전 설비동", "높은 Turbine Hall과 환기 Louver", "UTILITY", "INDUSTRIAL_POWER", 52, 32, 2, "GABLE", "METAL_PANEL", "VERTICAL", "SHUTTER", ["LOUVERS", "STACK"]],
  ["FACTORY_UTILITY", "기계실 / Utility Building", "옥상 기계와 Louver가 있는 설비동", "UTILITY", "INDUSTRIAL_UTILITY", 34, 22, 2, "INDUSTRIAL_VENT", "CONCRETE", "SMALL_INDUSTRIAL", "DOUBLE", ["ROOFTOP_UNITS"]],
  ["FACTORY_SUBSTATION", "전기실 / Substation Building", "Cable Trench와 환기구를 갖춘 전기실", "UTILITY", "INDUSTRIAL_SUBSTATION", 30, 18, 1, "FLAT", "CONCRETE", "SMALL_INDUSTRIAL", "DOUBLE", ["LOUVERS"]],
  ["FACTORY_MAINTENANCE", "정비동 / Maintenance Building", "복수 정비 Bay와 셔터를 가진 정비동", "FACTORY", "INDUSTRIAL_MAINTENANCE", 44, 24, 1, "GABLE", "METAL_PANEL", "LARGE_FACTORY", "SHUTTER", ["SHUTTERS"]],
  ["FACTORY_ASSEMBLY", "조립동 / Assembly Building", "넓은 Span과 연속 채광창", "FACTORY", "INDUSTRIAL_ASSEMBLY", 60, 34, 1, "SAWTOOTH", "INDUSTRIAL_PANEL", "LARGE_FACTORY", "VEHICLE_GATE"],
  ["FACTORY_INSPECTION", "검사동 / Inspection Building", "정밀 검사실과 수직창이 있는 동", "FACTORY", "INDUSTRIAL_INSPECTION", 32, 20, 2, "FLAT", "MIXED", "VERTICAL", "DOUBLE"],
  ["WAREHOUSE_RAW", "원자재 창고", "깊은 처마와 대형 셔터 창고", "WAREHOUSE", "INDUSTRIAL_RAW", 46, 30, 1, "GABLE", "METAL_PANEL", "SMALL_INDUSTRIAL", "SHUTTER", ["CANOPY"]],
  ["WAREHOUSE_FINISHED", "완제품 창고", "높은 적재고와 Dock을 가진 창고", "WAREHOUSE", "INDUSTRIAL_FINISHED", 52, 34, 1, "FLAT", "SANDWICH_PANEL", "SMALL_INDUSTRIAL", "LOADING_DOCK", ["DOCKS"]],
  ["WAREHOUSE_LOADING", "Loading Dock 물류동", "Dock Leveler와 Canopy가 반복되는 물류동", "WAREHOUSE", "INDUSTRIAL_LOADING", 64, 32, 1, "FLAT", "METAL_PANEL", "HORIZONTAL", "LOADING_DOCK", ["DOCKS", "CANOPY"]],
  ["FACTORY_STACK", "굴뚝 산업 건물", "높은 굴뚝과 Boiler Annex", "PROCESS", "INDUSTRIAL_STACK", 40, 26, 2, "GABLE", "BRICK", "SMALL_INDUSTRIAL", "SHUTTER", ["STACK"]],
  ["FACTORY_VENT", "대형 환기 공장", "대형 Roof Fan과 Vent Tower", "PROCESS", "INDUSTRIAL_VENT", 50, 30, 1, "INDUSTRIAL_VENT", "INDUSTRIAL_PANEL", "LARGE_FACTORY", "SHUTTER", ["ROOFTOP_UNITS", "VENTS"]],
  ["FACTORY_SAWTOOTH", "Sawtooth Roof 공장", "북향 채광 Sawtooth Roof 생산동", "FACTORY", "INDUSTRIAL_SAWTOOTH", 56, 30, 1, "SAWTOOTH", "BRICK", "LARGE_FACTORY", "SHUTTER"],
  ["FACTORY_SHUTTER", "대형 셔터 공장", "전면 다중 산업용 셔터가 특징인 공장", "FACTORY", "INDUSTRIAL_SHUTTER", 48, 26, 1, "GABLE", "METAL_PANEL", "SMALL_INDUSTRIAL", "SHUTTER", ["SHUTTERS"]],
  ["FACTORY_COMPLEX", "연결형 Factory Complex", "브리지로 연결된 생산·유틸리티 복합동", "FACTORY", "INDUSTRIAL_COMPLEX", 76, 46, 2, "INDUSTRIAL_VENT", "MIXED", "GRID", "VEHICLE_GATE", ["MULTI_WING", "PIPE_RACK"]],
].map(building);

function site([id, categoryId, subcategoryId, name, description, assetKind, profile, width, depth, height, color, material = "PAINTED", geometryMode = SITE_OBJECT_GEOMETRY_MODES.POINT, parameters = {}]) {
  const category = OBJECT_LIBRARY_CATEGORIES.find((item) => item.id === categoryId);
  return {
    id, categoryId, subcategoryId, name,
    nameEn: id.replaceAll("_", " ").toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description, type: "SITE_OBJECT", assetKind, profile, geometryMode,
    iconKey: category?.iconKey ?? "environment", width, depth, height, color, material,
    parameters, defaultVariants: {}, variantGroups: [], keywords: [name, description, id, assetKind, profile],
  };
}

const SITE_OBJECTS = [
  ["CAR", "VEHICLE", "PASSENGER", "승용차", "낮은 Sedan 비율의 승용차", "VEHICLE", "SEDAN", 1.85, 4.6, 1.45, "#5f7684"],
  ["SUV", "VEHICLE", "PASSENGER", "SUV", "높은 차체와 넓은 Wheel Arch", "VEHICLE", "SUV", 2, 4.8, 1.8, "#687b6b"],
  ["VAN", "VEHICLE", "COMMERCIAL", "밴", "박스형 적재 공간을 가진 Van", "VEHICLE", "VAN", 2, 5.2, 2.25, "#8b9295"],
  ["TRUCK", "VEHICLE", "COMMERCIAL", "트럭", "Cab과 적재함이 분리된 소형 Truck", "VEHICLE", "TRUCK", 2.4, 7, 2.8, "#607a8b"],
  ["HEAVY_TRUCK", "VEHICLE", "COMMERCIAL", "대형 화물차", "6륜 Tractor와 긴 Cargo Body", "VEHICLE", "HEAVY_TRUCK", 2.5, 11, 3.7, "#6c7680"],
  ["BUS", "VEHICLE", "COMMERCIAL", "버스", "긴 Passenger Cabin과 대형 창", "VEHICLE", "BUS", 2.5, 10.5, 3.2, "#477b8f"],
  ["FORKLIFT", "VEHICLE", "INDUSTRIAL", "지게차", "Mast와 Fork가 구분되는 산업 차량", "VEHICLE", "FORKLIFT", 1.5, 3.2, 2.3, "#d59a35"],
  ["TANKER_TRUCK", "VEHICLE", "INDUSTRIAL", "탱크로리", "원통 Tank와 Rear Ladder를 가진 차량", "VEHICLE", "TANKER", 2.5, 9.5, 3.4, "#788a91"],

  ["TRAFFIC_LIGHT", "TRAFFIC_FACILITY", "SIGNAL", "신호등", "3색 Signal Head와 Pole", "TRAFFIC", "TRAFFIC_LIGHT", 0.8, 0.8, 5.5, "#4f5b60", "METAL"],
  ["ROAD_SIGN", "TRAFFIC_FACILITY", "SIGNAL", "도로 표지판", "Pole과 반사 Sign Plate", "TRAFFIC", "ROAD_SIGN", 1.6, 0.5, 3.2, "#527b91", "METAL"],
  ["DIRECTION_SIGN", "TRAFFIC_FACILITY", "SIGNAL", "방향 안내판", "복수 방향 Plate 안내판", "TRAFFIC", "DIRECTION_SIGN", 2.4, 0.6, 3.5, "#4f7a67", "METAL"],
  ["BARRIER_GATE", "TRAFFIC_FACILITY", "ACCESS", "차단기", "회전 Arm과 Control Post", "TRAFFIC", "BARRIER_GATE", 4.5, 0.6, 1.2, "#c75b4b", "METAL"],
  ["PARKING_GATE", "TRAFFIC_FACILITY", "ACCESS", "주차 차단기", "Ticket Post와 Barrier Arm", "TRAFFIC", "PARKING_GATE", 4, 0.8, 1.3, "#d4a13f", "METAL"],
  ["SECURITY_GATE", "TRAFFIC_FACILITY", "ACCESS", "보안 게이트", "Twin Post와 Sliding Gate", "TRAFFIC", "SECURITY_GATE", 5, 1, 2.4, "#66757d", "METAL"],
  ["CROSSWALK_SIGNAL", "TRAFFIC_FACILITY", "SIGNAL", "보행 신호기", "보행자 Signal과 Button Box", "TRAFFIC", "PEDESTRIAN_SIGNAL", 0.7, 0.7, 3.1, "#536169", "METAL"],

  ["ROAD", "ROAD_FACILITY", "SURFACE", "도로", "차선 Marking이 포함된 아스팔트 도로", "SURFACE", "ROAD", 18, 6, 0.08, "#4e565b", "ASPHALT", "LINEAR", { laneCount: 2 }],
  ["WALKWAY", "ROAD_FACILITY", "SURFACE", "보행로", "경계석이 있는 보행 동선", "SURFACE", "WALKWAY", 12, 2.2, 0.08, "#9aa1a3", "CONCRETE", "LINEAR"],
  ["CROSSWALK", "ROAD_FACILITY", "SURFACE", "횡단보도", "고대비 반복 Stripe 노면", "SURFACE", "CROSSWALK", 8, 4, 0.04, "#d6d8d7", "PAINTED", "AREA"],
  ["STREETLIGHT", "ROAD_FACILITY", "BOUNDARY", "가로등", "곡선 Arm과 LED Head", "TRAFFIC", "STREETLIGHT", 8, 3, 6, "#69757a", "METAL", "CLUSTER", { count: 2 }],
  ["BOLLARD", "ROAD_FACILITY", "BOUNDARY", "볼라드", "반사 Band가 있는 안전 Bollard", "TRAFFIC", "BOLLARD", 0.25, 0.25, 1, "#68747a", "METAL"],
  ["ROAD_BARRIER", "ROAD_FACILITY", "BOUNDARY", "방호벽", "분절형 Concrete Barrier", "TRAFFIC", "ROAD_BARRIER", 4, 0.7, 0.9, "#a5a9a8", "CONCRETE", "LINEAR"],
  ["FENCE", "ROAD_FACILITY", "BOUNDARY", "도로 펜스", "Post와 Rail로 구성된 경계 펜스", "FENCE", "ROAD_FENCE", 10, 3, 1.5, "#727f84", "METAL", "PERIMETER", { spacing: 2.5 }],

  ["GRASS", "ENVIRONMENT", "GROUND", "잔디", "낮은 잔디 Area", "SURFACE", "GRASS", 8, 8, 0.04, "#607b5a", "GRASS", "AREA"],
  ["EXTERIOR_FLOOR", "ENVIRONMENT", "GROUND", "외부 바닥", "콘크리트 광장과 Joint", "SURFACE", "PLAZA", 10, 10, 0.08, "#9aa1a3", "CONCRETE", "AREA"],
  ["ROCK", "ENVIRONMENT", "NATURAL", "바위", "불규칙 Facet 조경석", "LANDSCAPE", "ROCK", 2.4, 1.8, 1.4, "#747873", "CONCRETE"],
  ["BENCH", "ENVIRONMENT", "AMENITY", "벤치", "목재 Slat와 금속 Frame 벤치", "LANDSCAPE", "BENCH", 2, 0.65, 0.85, "#876d50", "PAINTED"],
  ["SHELTER", "ENVIRONMENT", "AMENITY", "휴게 쉘터", "얇은 Roof와 좌석이 있는 Shelter", "LANDSCAPE", "SHELTER", 4, 2.5, 2.8, "#70848b", "METAL"],
  ["OTHER", "ENVIRONMENT", "AMENITY", "범용 구조물", "크기 조절 가능한 Utility Proxy", "UTILITY", "GENERIC", 4, 4, 1.5, "#7b878d", "CONCRETE", "AREA"],

  ["TREE", "LANDSCAPING", "TREE", "활엽수", "둥근 수관의 가로수", "VEGETATION", "DECIDUOUS", 8, 8, 5.5, "#4f7657", "GRASS", "CLUSTER", { count: 4, spacing: 4 }],
  ["TREE_CONIFER", "LANDSCAPING", "TREE", "침엽수", "원뿔형 수관이 겹치는 침엽수", "VEGETATION", "CONIFER", 8, 8, 6, "#3f6750", "GRASS", "CLUSTER", { count: 4, spacing: 4 }],
  ["STREET_TREE", "LANDSCAPING", "TREE", "가로수", "일정 간격으로 배치되는 정형 수목", "VEGETATION", "STREET_TREE", 14, 3, 5, "#55765a", "GRASS", "CLUSTER", { count: 4, spacing: 4 }],
  ["SHRUB", "LANDSCAPING", "PLANTING", "관목", "낮은 군식 형태 관목", "VEGETATION", "SHRUB", 5, 3, 1.1, "#57734f", "GRASS", "CLUSTER", { count: 8, spacing: 1.2 }],
  ["FLOWER_BED", "LANDSCAPING", "PLANTING", "화단", "경계석과 다색 식재가 있는 화단", "LANDSCAPE", "FLOWER_BED", 5, 2, 0.5, "#72845e", "GRASS", "AREA"],
  ["PLANTER", "LANDSCAPING", "FURNITURE", "플랜터", "Concrete Planter와 관목", "LANDSCAPE", "PLANTER", 2, 1, 1.1, "#858b86", "CONCRETE"],
  ["INDUSTRIAL_LANDSCAPE", "LANDSCAPING", "PLANTING", "산업 단지 조경", "수목·관목·바위가 혼합된 조경 Module", "LANDSCAPE", "INDUSTRIAL_GARDEN", 8, 5, 3.2, "#5e7656", "GRASS", "AREA"],

  ["SITE_MOTOR", "INDUSTRIAL_EQUIPMENT", "ROTATING", "Motor", "Cooling Fin과 Shaft가 있는 Motor", "INDUSTRIAL", "MOTOR", 1.2, 2.1, 1.2, "#477b83", "METAL"],
  ["SITE_PUMP", "INDUSTRIAL_EQUIPMENT", "ROTATING", "Pump", "Volute Casing과 Motor Base", "INDUSTRIAL", "PUMP", 1.5, 2.4, 1.4, "#4e7c8b", "METAL"],
  ["SITE_COMPRESSOR", "INDUSTRIAL_EQUIPMENT", "ROTATING", "Compressor", "Receiver와 Compressor Block", "INDUSTRIAL", "COMPRESSOR", 2.2, 3.6, 2, "#697b83", "METAL"],
  ["SITE_FAN", "INDUSTRIAL_EQUIPMENT", "ROTATING", "Fan", "원형 Shroud와 Blade", "INDUSTRIAL", "FAN", 1.8, 0.8, 1.8, "#5f7b84", "METAL"],
  ["SITE_GENERATOR", "INDUSTRIAL_EQUIPMENT", "ROTATING", "Generator", "Skid와 방음 Enclosure", "INDUSTRIAL", "GENERATOR", 2.4, 4, 2.2, "#5e786b", "METAL"],
  ["SITE_PROCESS_TANK", "INDUSTRIAL_EQUIPMENT", "PROCESS", "Process Tank", "상부 Nozzle이 있는 공정 Tank", "INDUSTRIAL", "TANK", 2.4, 2.4, 4.5, "#75888f", "METAL"],
  ["SITE_CONVEYOR", "INDUSTRIAL_EQUIPMENT", "HANDLING", "Conveyor", "Roller와 Support Frame Conveyor", "INDUSTRIAL", "CONVEYOR", 1.2, 6, 1.4, "#6e7d82", "METAL", "LINEAR"],
  ["SITE_VALVE", "INDUSTRIAL_EQUIPMENT", "PROCESS", "Valve", "Flange와 Hand Wheel Valve", "INDUSTRIAL", "VALVE", 1.2, 1.2, 1.5, "#567884", "METAL"],
  ["SITE_MIXER", "INDUSTRIAL_EQUIPMENT", "PROCESS", "Mixer", "Drive와 Agitator Tank", "INDUSTRIAL", "MIXER", 2.2, 2.2, 3.8, "#6e8188", "METAL"],
  ["SITE_HEAT_EXCHANGER", "INDUSTRIAL_EQUIPMENT", "PROCESS", "Heat Exchanger", "Tube Bundle과 Saddle", "INDUSTRIAL", "HEAT_EXCHANGER", 1.8, 4.5, 1.8, "#73878f", "METAL"],

  ["SITE_TRANSFORMER", "ELECTRICAL_EQUIPMENT", "POWER", "Transformer", "Cooling Fin과 Bushing Transformer", "ELECTRICAL", "TRANSFORMER", 2.4, 3, 2.8, "#6f7e79", "METAL"],
  ["SITE_ELECTRICAL_PANEL", "ELECTRICAL_EQUIPMENT", "DISTRIBUTION", "Electrical Panel", "Door와 Meter가 구분된 Panel", "ELECTRICAL", "PANEL", 1.2, 0.7, 2.1, "#75858c", "METAL"],
  ["SITE_SWITCHGEAR", "ELECTRICAL_EQUIPMENT", "DISTRIBUTION", "Switchgear", "다중 Bay Switchgear Lineup", "ELECTRICAL", "SWITCHGEAR", 3.6, 1, 2.2, "#77868b", "METAL"],
  ["SITE_MCC", "ELECTRICAL_EQUIPMENT", "CONTROL", "MCC", "Drawer Module이 반복되는 MCC", "ELECTRICAL", "MCC", 2.4, 0.9, 2.2, "#71838a", "METAL"],
  ["SITE_UPS", "ELECTRICAL_EQUIPMENT", "POWER", "UPS", "Display와 Vent가 있는 UPS", "ELECTRICAL", "UPS", 1.2, 1, 1.8, "#667a83", "METAL"],
  ["SITE_BATTERY_BANK", "ELECTRICAL_EQUIPMENT", "POWER", "Battery Bank", "Rack형 Battery Module", "ELECTRICAL", "BATTERY", 2.4, 0.9, 1.9, "#596b70", "METAL"],
  ["SITE_CONTROL_DESK", "ELECTRICAL_EQUIPMENT", "CONTROL", "Control Desk", "경사 Console과 Monitor Stand", "ELECTRICAL", "CONTROL_DESK", 2.2, 1.1, 1.3, "#657b84", "METAL"],

  ["PALLET", "LOGISTICS", "STORAGE", "Pallet", "Deck Board가 구분된 목재 Pallet", "LOGISTICS", "PALLET", 1.2, 1, 0.15, "#8b6c4e", "PAINTED"],
  ["PALLET_RACK", "LOGISTICS", "STORAGE", "Pallet Rack", "Beam과 Upright가 구분된 Rack", "LOGISTICS", "RACK", 4, 1.2, 4, "#637983", "METAL"],
  ["SHIPPING_CONTAINER", "LOGISTICS", "STORAGE", "Shipping Container", "Corrugation과 Door Bar가 있는 Container", "LOGISTICS", "CONTAINER", 2.44, 6.1, 2.59, "#6d7f7a", "METAL"],
  ["LOADING_DOCK", "LOGISTICS", "HANDLING", "Loading Dock", "Dock Leveler와 Bumper", "LOGISTICS", "DOCK", 3.2, 2.5, 1.2, "#6e797d", "METAL"],
  ["ROLLER_CONVEYOR", "LOGISTICS", "HANDLING", "Roller Conveyor", "반복 Roller와 Side Rail", "LOGISTICS", "ROLLER_CONVEYOR", 1.1, 6, 1, "#78858a", "METAL", "LINEAR"],
  ["GANTRY_CRANE", "LOGISTICS", "HANDLING", "Gantry Crane", "Portal Frame과 Hoist", "LOGISTICS", "GANTRY", 8, 3, 6, "#d09a3e", "METAL"],
  ["MOBILE_RAMP", "LOGISTICS", "HANDLING", "Mobile Ramp", "경사 Deck와 Wheel Support", "LOGISTICS", "RAMP", 2.4, 7, 1.8, "#7b8587", "METAL"],

  ["SAFETY_BARRIER", "SAFETY_FACILITY", "PROTECTION", "안전 차단대", "고대비 Rail 안전 차단대", "SAFETY", "BARRIER", 3, 0.3, 1.1, "#d5a23d", "METAL", "LINEAR"],
  ["GUARDRAIL", "SAFETY_FACILITY", "PROTECTION", "Guardrail", "Top Rail과 Mid Rail 보호난간", "SAFETY", "GUARDRAIL", 4, 0.2, 1.2, "#d0a142", "METAL", "LINEAR"],
  ["SAFETY_CONE", "SAFETY_FACILITY", "PROTECTION", "안전 콘", "반사 Band Traffic Cone", "SAFETY", "CONE", 0.45, 0.45, 0.8, "#d66d35", "PAINTED"],
  ["FIRE_HYDRANT", "SAFETY_FACILITY", "EMERGENCY", "소화전", "Side Outlet과 Cap이 있는 Hydrant", "SAFETY", "HYDRANT", 0.7, 0.7, 1.2, "#b84d43", "METAL"],
  ["FIRE_EXTINGUISHER", "SAFETY_FACILITY", "EMERGENCY", "소화기", "Cylinder와 Hose가 구분된 소화기", "SAFETY", "EXTINGUISHER", 0.35, 0.3, 0.8, "#bd4d43", "METAL"],
  ["EYEWASH_STATION", "SAFETY_FACILITY", "EMERGENCY", "세안대", "Bowl과 Twin Nozzle 비상 세안대", "SAFETY", "EYEWASH", 0.8, 0.7, 1.2, "#4f8b78", "METAL"],
  ["EMERGENCY_SHOWER", "SAFETY_FACILITY", "EMERGENCY", "비상 샤워", "Overhead Shower와 Pull Rod", "SAFETY", "SHOWER", 1, 1, 2.4, "#d2a43e", "METAL"],

  ["PIPE_STRAIGHT", "PIPE_TANK", "PIPE", "직선 배관", "Flange가 있는 직선 Pipe", "PIPE_TANK", "PIPE", 0.5, 5, 0.5, "#738993", "METAL", "LINEAR"],
  ["PIPE_ELBOW", "PIPE_TANK", "PIPE", "Elbow 배관", "90도 Elbow와 Flange", "PIPE_TANK", "ELBOW", 1.5, 1.5, 1.5, "#758a92", "METAL"],
  ["PIPE_RACK", "PIPE_TANK", "PIPE", "Pipe Rack", "다단 Pipe와 Support Frame", "PIPE_TANK", "PIPE_RACK", 5, 8, 4, "#78878b", "METAL", "LINEAR"],
  ["TANK_VERTICAL", "PIPE_TANK", "TANK", "수직 탱크", "Shell·Roof·Nozzle 수직 Tank", "PIPE_TANK", "VERTICAL_TANK", 4, 4, 7, "#778b93", "METAL"],
  ["TANK_HORIZONTAL", "PIPE_TANK", "TANK", "수평 탱크", "Saddle 위 Horizontal Tank", "PIPE_TANK", "HORIZONTAL_TANK", 3, 6, 3, "#7a8b91", "METAL"],
  ["PRESSURE_VESSEL_SITE", "PIPE_TANK", "TANK", "압력 용기", "Dished Head와 Nozzle Vessel", "PIPE_TANK", "PRESSURE_VESSEL", 3, 3, 6, "#728892", "METAL"],
  ["SILO_SITE", "PIPE_TANK", "TANK", "Silo", "Conical Hopper가 있는 Silo", "PIPE_TANK", "SILO", 4, 4, 9, "#829095", "METAL"],
  ["IBC_TANK", "PIPE_TANK", "TANK", "IBC Tank", "Cage Frame 내부 Cube Tank", "PIPE_TANK", "IBC", 1.2, 1.2, 1.4, "#9aa7a5", "PAINTED"],

  ["PARKING", "PARKING_FACILITY", "PARKING", "일반 주차장", "반복 주차 Line이 있는 노면", "PARKING", "STANDARD", 12, 8, 0.07, "#535c61", "ASPHALT", "AREA"],
  ["PARKING_ANGLED", "PARKING_FACILITY", "PARKING", "사선 주차장", "60도 사선 Parking Bay", "PARKING", "ANGLED", 14, 9, 0.07, "#535c61", "ASPHALT", "AREA", { parkingAngle: 60 }],
  ["PARKING_ACCESSIBLE", "PARKING_FACILITY", "PARKING", "장애인 주차면", "넓은 Bay와 접근 Zone", "PARKING", "ACCESSIBLE", 4, 6, 0.07, "#4d7185", "ASPHALT", "AREA"],
  ["PARKING_BARRIER", "PARKING_FACILITY", "CONTROL", "주차 차단기", "Arm과 Reader Post", "TRAFFIC", "PARKING_GATE", 4, 0.8, 1.3, "#d4a13f", "METAL"],
  ["WHEEL_STOP", "PARKING_FACILITY", "CONTROL", "주차 멈춤턱", "반사 Stripe Wheel Stop", "PARKING", "WHEEL_STOP", 1.8, 0.22, 0.16, "#d3b34c", "CONCRETE"],
  ["EV_CHARGER", "PARKING_FACILITY", "AMENITY", "EV 충전기", "Display와 Cable이 있는 Charger", "PARKING", "EV_CHARGER", 0.55, 0.45, 1.5, "#4f8275", "METAL"],
  ["BIKE_RACK", "PARKING_FACILITY", "AMENITY", "자전거 거치대", "반복 U Frame Bike Rack", "PARKING", "BIKE_RACK", 3, 0.8, 0.9, "#718087", "METAL"],
].map(site);

export const OBJECT_LIBRARY_DEFINITIONS = Object.freeze([
  ...BUILDINGS,
  ...INDUSTRIAL_BUILDINGS,
  ...SITE_OBJECTS,
]);

export const OBJECT_LIBRARY_DEFINITION_MAP = Object.freeze(Object.fromEntries(
  OBJECT_LIBRARY_DEFINITIONS.map((definition) => [definition.id, definition]),
));

export const BUILDING_OBJECT_DEFINITIONS = Object.freeze(
  OBJECT_LIBRARY_DEFINITIONS.filter((definition) => definition.createsBuilding),
);

export function getObjectLibraryDefinitions(allowedIds) {
  if (!allowedIds?.length) return OBJECT_LIBRARY_DEFINITIONS;
  const allowed = new Set(allowedIds);
  return OBJECT_LIBRARY_DEFINITIONS.filter((definition) => allowed.has(definition.id));
}

export function getDefaultObjectVariants(definition) {
  return { ...(definition?.defaultVariants ?? {}) };
}
