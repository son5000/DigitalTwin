export const EDITOR_MODES = {
  EQUIPMENT: "EQUIPMENT",
  WORLD: "WORLD",
  VIEWER: "VIEWER",
};

export const WORLD_STRUCTURE_MATERIALS = [
  "CONCRETE",
  "PAINTED_CONCRETE",
  "STEEL",
  "PAINTED_STEEL",
  "GLASS",
  "MESH",
  "GRATING",
  "GENERIC",
];

const meter = (key, label, defaultValue, min = 0.02) => ({
  key,
  label,
  unit: "m",
  step: 0.01,
  min,
  defaultValue,
});

function template({
  id,
  group,
  name,
  nameKo,
  parameters,
  appearance,
  variants,
  isVertical = false,
  defaultPositionY = null,
  defaultGroundSnap = null,
  familyId,
  subtype,
  description,
  placement,
  materialSlots,
  legacyOnly = false,
}) {
  const inferredFamilyId = familyId
    ?? (group === "SPACE" ? "SPACE"
      : group === "STRUCTURE" ? (id === "COLUMN" || id === "BEAM" || id === "STRUCTURAL_FRAME" ? "FRAME" : "WALL")
        : group === "FLOOR" ? "FLOOR_LEVEL"
          : group === "OPENING" ? "DOOR"
            : group === "BOUNDARY" ? "BOUNDARY"
              : group === "VERTICAL" ? "VERTICAL"
                : group === "ENVIRONMENT" ? "PLANT"
                  : group);
  const resolvedPlacement = placement ?? OBJECT_PLACEMENT_TYPES.FLOOR;
  const resolvedDefaultPositionY = defaultPositionY
    ?? (resolvedPlacement === OBJECT_PLACEMENT_TYPES.CEILING ? 2.7 : resolvedPlacement === OBJECT_PLACEMENT_TYPES.WALL ? 0.9 : 0);
  const resolvedGroundSnap = defaultGroundSnap ?? resolvedPlacement === OBJECT_PLACEMENT_TYPES.FLOOR;
  return {
    id,
    domain: "WORLD",
    group,
    name,
    nameKo,
    parameters,
    defaultParameters: Object.fromEntries(
      parameters.map((parameter) => [parameter.key, parameter.defaultValue]),
    ),
    defaultAppearance: {
      color: "#87939A",
      opacity: 0.92,
      materialPreset: "CONCRETE",
      ...appearance,
    },
    variants,
    isVertical,
    defaultPositionY: resolvedDefaultPositionY,
    defaultGroundSnap: resolvedGroundSnap,
    ...createObjectModelMetadata({
      id,
      familyId: inferredFamilyId,
      subtype,
      description,
      placement: resolvedPlacement,
      materialSlots,
      legacyOnly,
    }),
  };
}

export const WORLD_STRUCTURE_GROUPS = [
  { id: "SPACE", name: "Space", nameKo: "공간 구획·통로" },
  { id: "STRUCTURE", name: "Structure", nameKo: "구조" },
  { id: "FLOOR", name: "Floor", nameKo: "바닥·레벨" },
  { id: "OPENING", name: "Opening", nameKo: "개구부" },
  { id: "BOUNDARY", name: "Boundary", nameKo: "경계·안전" },
  { id: "VERTICAL", name: "Vertical Core", nameKo: "수직 연결" },
  { id: "FURNITURE", name: "Furniture", nameKo: "가구" },
  { id: "ENVIRONMENT", name: "Environment", nameKo: "환경" },
  { id: "CUSTOM", name: "Custom", nameKo: "사용자 구조물" },
];

const WOOD_FRAME_SLOTS = [
  { id: "primary", label: "상판·본체", defaultAppearance: { materialPreset: "WOOD", color: "#8D694B" } },
  { id: "frame", label: "프레임·다리", defaultAppearance: { materialPreset: "PAINTED_STEEL", color: "#59666C" } },
];
const UPHOLSTERY_SLOTS = [
  { id: "fabric", label: "패브릭", defaultAppearance: { materialPreset: "FABRIC", color: "#667A86" } },
  { id: "frame", label: "프레임", defaultAppearance: { materialPreset: "PAINTED_STEEL", color: "#4F5A60" } },
];
const STORAGE_SLOTS = [
  { id: "body", label: "본체", defaultAppearance: { materialPreset: "PAINTED_STEEL", color: "#79858B" } },
  { id: "hardware", label: "손잡이·하드웨어", defaultAppearance: { materialPreset: "STAINLESS", color: "#A9B1B4" } },
];
const GLASS_FRAME_SLOTS = [
  { id: "glass", label: "유리", defaultAppearance: { materialPreset: "GLASS", color: "#A9D4DD", opacity: 0.42 } },
  { id: "frame", label: "프레임", defaultAppearance: { materialPreset: "ALUMINUM", color: "#6D7A80" } },
];

export const WORLD_STRUCTURE_TEMPLATES = [
  template({ id: "ROOM", group: "SPACE", name: "Space Zone", nameKo: "공간 구획", parameters: [meter("width", "Width", 6), meter("depth", "Depth", 5), meter("height", "Height", 3)], appearance: { color: "#AAB8BE", opacity: 0.18, materialPreset: "GENERIC" } }),
  template({ id: "CORRIDOR", group: "SPACE", name: "Corridor", nameKo: "복도", parameters: [meter("width", "Width", 2), meter("length", "Length", 6), meter("height", "Height", 3)], appearance: { color: "#AAB8BE", opacity: 0.12, materialPreset: "GENERIC" } }),
  template({ id: "UTILITY_AREA", group: "SPACE", name: "Utility Area", nameKo: "유틸리티 구역", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3)], appearance: { color: "#AAB8BE", opacity: 0.12, materialPreset: "GENERIC" } }),

  template({ id: "WALL", group: "STRUCTURE", name: "Wall", nameKo: "벽체", parameters: [meter("length", "길이", 4), meter("height", "높이", 3), meter("thickness", "벽 두께", 0.15, 0.05)], appearance: { color: "#A7B0B5", opacity: 1, materialPreset: "PAINTED_CONCRETE" } }),
  template({ id: "PARTITION", group: "STRUCTURE", name: "Partition", nameKo: "파티션", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.5), meter("thickness", "Thickness", 0.08)], variants: ["SOLID", "GLASS", "MESH", "LOW_PARTITION", "FENCE_PARTITION", "CUSTOM"], appearance: { color: "#9AA5AA", opacity: 0.88, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "TEMPORARY_WALL", group: "STRUCTURE", name: "Temporary Wall", nameKo: "가벽", parameters: [meter("length", "Length", 3), meter("height", "Height", 2.2), meter("thickness", "Thickness", 0.1)], variants: ["SOLID", "GLASS", "LOW_PARTITION", "CUSTOM"], appearance: { color: "#B0B7BA", opacity: 0.9, materialPreset: "GENERIC" } }),
  template({ id: "COLUMN", group: "STRUCTURE", name: "Column", nameKo: "기둥", parameters: [meter("width", "Width / Diameter", 0.5), meter("depth", "Depth", 0.5), meter("height", "Height", 3)], variants: ["RECTANGULAR", "SQUARE", "CIRCULAR"], appearance: { color: "#8B9499", opacity: 1, materialPreset: "CONCRETE" } }),
  template({ id: "BEAM", group: "STRUCTURE", name: "Beam", nameKo: "보", parameters: [meter("length", "Length", 4), meter("width", "Width", 0.3), meter("height", "Height", 0.4)], appearance: { color: "#737F85", opacity: 1, materialPreset: "STEEL" } }),
  template({ id: "STRUCTURAL_FRAME", group: "STRUCTURE", name: "Structural Frame", nameKo: "구조 프레임", parameters: [meter("width", "Width", 3), meter("depth", "Depth", 2), meter("height", "Height", 2.8), meter("legThickness", "Leg", 0.12), meter("beamThickness", "Beam", 0.14)], appearance: { color: "#6F7E84", opacity: 1, materialPreset: "STEEL" } }),

  template({ id: "FLOOR_REGION", group: "FLOOR", name: "Floor", nameKo: "바닥", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3), meter("height", "Thickness", 0.08)], appearance: { color: "#707B80", opacity: 0.95, materialPreset: "CONCRETE" } }),
  template({ id: "PLATFORM", group: "FLOOR", name: "Platform", nameKo: "플랫폼", parameters: [meter("width", "Width", 4), meter("depth", "Depth", 3), meter("height", "Height", 0.3)], appearance: { color: "#59666B", opacity: 1, materialPreset: "STEEL" } }),
  template({ id: "STEP", group: "FLOOR", name: "Step", nameKo: "단차", parameters: [meter("width", "Width", 1.2), meter("depth", "Depth", 0.4), meter("height", "Height", 0.2)], appearance: { color: "#737D82", opacity: 1 } }),
  template({ id: "RAMP", group: "FLOOR", name: "Ramp", nameKo: "경사로", parameters: [meter("width", "Width", 1.5), meter("length", "Length", 3), meter("startHeight", "Start Height", 0), meter("endHeight", "End Height", 0.5)], appearance: { color: "#737D82", opacity: 1 } }),

  template({ id: "ENTRANCE", group: "OPENING", name: "Entrance", nameKo: "입구", parameters: [meter("width", "Width", 1.8), meter("height", "Height", 2.2), meter("depth", "Depth", 0.08)], appearance: { color: "#4593A4", opacity: 0.72, materialPreset: "GENERIC" } }),
  template({ id: "EXIT", group: "OPENING", name: "Exit", nameKo: "출구", parameters: [meter("width", "Width", 1.8), meter("height", "Height", 2.2), meter("depth", "Depth", 0.08)], appearance: { color: "#B48332", opacity: 0.72, materialPreset: "GENERIC" } }),
  template({ id: "DOOR", group: "OPENING", name: "Door", nameKo: "도어", parameters: [meter("width", "Width", 1), meter("height", "Height", 2.1), meter("depth", "Depth", 0.08)], appearance: { color: "#8C969B", opacity: 0.95, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "GATE", group: "OPENING", name: "Gate", nameKo: "게이트", parameters: [meter("width", "Width", 2.5), meter("height", "Height", 2), meter("depth", "Depth", 0.1)], appearance: { color: "#858F94", opacity: 0.95, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "PASSAGE", group: "OPENING", familyId: "SPACE", name: "Passage", nameKo: "통로", parameters: [meter("width", "Width", 2), meter("depth", "Depth", 1)], appearance: { color: "#71878F", opacity: 0.45 } }),
  template({ id: "FIXED_WINDOW", group: "OPENING", familyId: "WINDOW", subtype: "FIXED", placement: OBJECT_PLACEMENT_TYPES.WALL, name: "Fixed Window", nameKo: "고정창", description: "알루미늄 프레임과 단일 유리면의 고정창", parameters: [meter("width", "너비", 1.2), meter("height", "높이", 1.2), meter("depth", "프레임 두께", 0.12)], appearance: { color: "#A9D4DD", opacity: 0.48, materialPreset: "GLASS" }, materialSlots: GLASS_FRAME_SLOTS }),
  template({ id: "SLIDING_WINDOW", group: "OPENING", familyId: "WINDOW", subtype: "SLIDING", placement: OBJECT_PLACEMENT_TYPES.WALL, name: "Sliding Window", nameKo: "미닫이창", description: "두 개의 겹치는 창짝과 중앙 레일을 갖춘 미닫이창", parameters: [meter("width", "너비", 1.8), meter("height", "높이", 1.2), meter("depth", "프레임 두께", 0.14)], appearance: { color: "#A9D4DD", opacity: 0.48, materialPreset: "GLASS" }, materialSlots: GLASS_FRAME_SLOTS }),
  template({ id: "CASEMENT_WINDOW", group: "OPENING", familyId: "WINDOW", subtype: "CASEMENT", placement: OBJECT_PLACEMENT_TYPES.WALL, name: "Casement Window", nameKo: "여닫이창", description: "두 개의 개폐 창짝과 손잡이가 있는 여닫이창", parameters: [meter("width", "너비", 1.5), meter("height", "높이", 1.3), meter("depth", "프레임 두께", 0.14)], appearance: { color: "#A9D4DD", opacity: 0.48, materialPreset: "GLASS" }, materialSlots: GLASS_FRAME_SLOTS }),

  template({ id: "RAILING", group: "BOUNDARY", name: "Railing", nameKo: "난간", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.1), meter("postInterval", "Post Interval", 1), meter("thickness", "Thickness", 0.06)], appearance: { color: "#78858B", opacity: 1, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "FENCE", group: "BOUNDARY", name: "Fence", nameKo: "펜스", parameters: [meter("length", "Length", 3), meter("height", "Height", 1.8), meter("thickness", "Thickness", 0.05)], variants: ["SOLID", "MESH", "SAFETY_FENCE"], appearance: { color: "#C69A36", opacity: 0.9, materialPreset: "MESH" } }),
  template({ id: "STAIR", group: "VERTICAL", name: "Stair", nameKo: "계단", isVertical: true, parameters: [meter("width", "Width", 1.2), meter("treadDepth", "Tread Depth", 0.28), meter("riserHeight", "Target Riser Height", 0.18), meter("landingDepth", "Landing Depth", 1.2)] }),
  template({ id: "STAIRWELL", group: "VERTICAL", name: "Stairwell", nameKo: "계단실", isVertical: true, parameters: [meter("width", "Width", 3), meter("depth", "Depth", 5), meter("height", "Floor Height", 3)], appearance: { color: "#8FA0A8", opacity: 0.32, materialPreset: "CONCRETE" } }),
  template({ id: "ELEVATOR", group: "VERTICAL", name: "Elevator", nameKo: "엘리베이터", isVertical: true, parameters: [meter("width", "Car Width", 2.1), meter("depth", "Car Depth", 2.1), meter("height", "Floor Height", 3)], appearance: { color: "#6F8D99", opacity: 0.42, materialPreset: "STEEL" } }),
  template({ id: "SHAFT", group: "VERTICAL", name: "Shaft", nameKo: "샤프트", isVertical: true, parameters: [meter("width", "Width", 1.5), meter("depth", "Depth", 1.5), meter("height", "Floor Height", 3)], appearance: { color: "#7D8790", opacity: 0.26, materialPreset: "GENERIC" } }),

  template({ id: "DESK", group: "FURNITURE", familyId: "DESK", legacyOnly: true, name: "Legacy Desk", nameKo: "기존 책상", parameters: [meter("width", "너비", 1.4), meter("depth", "깊이", 0.7), meter("height", "높이", 0.75)], appearance: { color: "#8D694B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "OFFICE_DESK", group: "FURNITURE", familyId: "DESK", subtype: "OFFICE", name: "Office Desk", nameKo: "일반 사무용 책상", description: "배선 홈과 금속 다리를 갖춘 표준 사무 책상", parameters: [meter("width", "너비", 1.4), meter("depth", "깊이", 0.7), meter("height", "높이", 0.74)], appearance: { color: "#8D694B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "DOUBLE_OFFICE_DESK", group: "FURNITURE", familyId: "DESK", subtype: "DOUBLE", name: "Double Office Desk", nameKo: "2인용 대향 책상", description: "중앙 스크린을 포함한 2인용 대향형 워크스테이션", parameters: [meter("width", "너비", 1.6), meter("depth", "깊이", 1.45), meter("height", "높이", 0.74)], appearance: { color: "#8B735B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "EXECUTIVE_DESK", group: "FURNITURE", familyId: "DESK", subtype: "EXECUTIVE", name: "Executive Desk", nameKo: "임원용 책상", description: "두꺼운 상판과 전면 가림판, 서랍장이 결합된 책상", parameters: [meter("width", "너비", 2), meter("depth", "깊이", 0.9), meter("height", "높이", 0.76)], appearance: { color: "#674834", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "L_SHAPED_DESK", group: "FURNITURE", familyId: "DESK", subtype: "L_SHAPED", name: "L-shaped Desk", nameKo: "L자형 책상", description: "측면 보조 상판을 연결한 코너형 업무 책상", parameters: [meter("width", "너비", 1.8), meter("depth", "전체 깊이", 1.5), meter("height", "높이", 0.74)], appearance: { color: "#87705B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "STANDING_DESK", group: "FURNITURE", familyId: "DESK", subtype: "STANDING", name: "Standing Desk", nameKo: "높이 조절형 책상", description: "이중 승강 기둥과 발판을 갖춘 스탠딩 책상", parameters: [meter("width", "너비", 1.4), meter("depth", "깊이", 0.7), meter("height", "높이", 1.05)], appearance: { color: "#9A7A5B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "SCHOOL_DESK", group: "FURNITURE", familyId: "DESK", subtype: "SCHOOL", name: "School Desk", nameKo: "학교용 책상", description: "가방 걸이와 하부 선반이 있는 1인용 학생 책상", parameters: [meter("width", "너비", 0.65), meter("depth", "깊이", 0.45), meter("height", "높이", 0.72)], appearance: { color: "#A37A4E", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "INDUSTRIAL_WORKBENCH", group: "FURNITURE", familyId: "DESK", subtype: "WORKBENCH", name: "Industrial Workbench", nameKo: "산업용 작업대", description: "보강 프레임과 하부 선반이 있는 중량 작업대", parameters: [meter("width", "너비", 1.8), meter("depth", "깊이", 0.75), meter("height", "높이", 0.9)], appearance: { color: "#68777D", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "WORKBENCH", group: "FURNITURE", familyId: "DESK", legacyOnly: true, name: "Legacy Workbench", nameKo: "기존 작업대", parameters: [meter("width", "너비", 1.8), meter("depth", "깊이", 0.75), meter("height", "높이", 0.9)], appearance: { color: "#68777D", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: WOOD_FRAME_SLOTS }),

  template({ id: "CHAIR", group: "FURNITURE", familyId: "CHAIR", legacyOnly: true, name: "Legacy Chair", nameKo: "기존 의자", parameters: [meter("width", "너비", 0.5), meter("depth", "깊이", 0.5), meter("height", "높이", 0.85)], appearance: { color: "#59666C", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "TASK_CHAIR", group: "FURNITURE", familyId: "CHAIR", subtype: "TASK", name: "Task Chair", nameKo: "사무용 회전 의자", description: "오발 베이스와 등받이, 팔걸이를 갖춘 업무용 의자", parameters: [meter("width", "너비", 0.62), meter("depth", "깊이", 0.62), meter("height", "높이", 1.05)], appearance: { color: "#4F626D", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "GUEST_CHAIR", group: "FURNITURE", familyId: "CHAIR", subtype: "GUEST", name: "Guest Chair", nameKo: "방문자 의자", description: "네 개의 다리와 성형 좌판을 갖춘 회의용 의자", parameters: [meter("width", "너비", 0.52), meter("depth", "깊이", 0.55), meter("height", "높이", 0.84)], appearance: { color: "#667A86", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "BAR_STOOL", group: "FURNITURE", familyId: "CHAIR", subtype: "STOOL", name: "Bar Stool", nameKo: "바 스툴", description: "원형 좌판과 발 받침을 갖춘 높은 스툴", parameters: [meter("width", "너비", 0.42), meter("depth", "깊이", 0.42), meter("height", "높이", 0.78)], appearance: { color: "#755E50", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "SCHOOL_CHAIR", group: "FURNITURE", familyId: "CHAIR", subtype: "SCHOOL", name: "School Chair", nameKo: "학생용 의자", description: "강관 프레임과 목재 좌판을 사용한 학생 의자", parameters: [meter("width", "너비", 0.46), meter("depth", "깊이", 0.48), meter("height", "높이", 0.78)], appearance: { color: "#9A734B", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "LOUNGE_CHAIR", group: "FURNITURE", familyId: "CHAIR", subtype: "LOUNGE", name: "Lounge Chair", nameKo: "라운지 의자", description: "기울어진 등받이와 넓은 쿠션의 휴게용 의자", parameters: [meter("width", "너비", 0.78), meter("depth", "깊이", 0.82), meter("height", "높이", 0.8)], appearance: { color: "#6D777E", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),

  template({ id: "MEETING_TABLE", group: "FURNITURE", familyId: "TABLE", subtype: "MEETING", name: "Meeting Table", nameKo: "회의실 테이블", description: "중앙 케이블 덕트를 갖춘 6인용 회의 테이블", parameters: [meter("width", "너비", 2.4), meter("depth", "깊이", 1.1), meter("height", "높이", 0.74)], appearance: { color: "#80654D", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "ROUND_MEETING_TABLE", group: "FURNITURE", familyId: "TABLE", subtype: "ROUND", name: "Round Meeting Table", nameKo: "원형 회의 테이블", description: "중앙 기둥형 베이스를 사용한 4인용 원형 테이블", parameters: [meter("width", "지름", 1.2), meter("depth", "깊이", 1.2), meter("height", "높이", 0.74)], appearance: { color: "#8B6A50", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "CAFE_TABLE", group: "FURNITURE", familyId: "TABLE", subtype: "CAFE", name: "Cafe Table", nameKo: "카페 테이블", description: "소형 원형 상판과 단일 베이스의 카페 테이블", parameters: [meter("width", "지름", 0.75), meter("depth", "깊이", 0.75), meter("height", "높이", 0.72)], appearance: { color: "#916E51", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "DINING_TABLE", group: "FURNITURE", familyId: "TABLE", subtype: "DINING", name: "Dining Table", nameKo: "식당 테이블", description: "네 개의 다리를 사용한 4인용 직사각 테이블", parameters: [meter("width", "너비", 1.4), meter("depth", "깊이", 0.8), meter("height", "높이", 0.74)], appearance: { color: "#8A6748", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "SIDE_TABLE", group: "FURNITURE", familyId: "TABLE", subtype: "SIDE", name: "Side Table", nameKo: "사이드 테이블", description: "소파 옆에 사용하는 하부 선반형 보조 테이블", parameters: [meter("width", "너비", 0.5), meter("depth", "깊이", 0.5), meter("height", "높이", 0.52)], appearance: { color: "#7B6048", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),

  template({ id: "ARMCHAIR_SOFA", group: "FURNITURE", familyId: "SOFA", subtype: "SINGLE", name: "Armchair Sofa", nameKo: "1인용 소파", description: "팔걸이와 분리형 좌방석을 갖춘 1인용 소파", parameters: [meter("width", "너비", 0.9), meter("depth", "깊이", 0.85), meter("height", "높이", 0.82)], appearance: { color: "#637681", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "SOFA_2_SEAT", group: "FURNITURE", familyId: "SOFA", subtype: "DOUBLE", name: "Two-seat Sofa", nameKo: "2인용 소파", description: "분리형 등받이와 팔걸이를 갖춘 2인용 소파", parameters: [meter("width", "너비", 1.65), meter("depth", "깊이", 0.86), meter("height", "높이", 0.82)], appearance: { color: "#657984", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "SOFA_3_SEAT", group: "FURNITURE", familyId: "SOFA", subtype: "TRIPLE", name: "Three-seat Sofa", nameKo: "3인용 소파", description: "세 개의 좌방석으로 구성된 표준 라운지 소파", parameters: [meter("width", "너비", 2.15), meter("depth", "깊이", 0.9), meter("height", "높이", 0.84)], appearance: { color: "#687B85", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "CORNER_SOFA", group: "FURNITURE", familyId: "SOFA", subtype: "CORNER", name: "Corner Sofa", nameKo: "코너형 소파", description: "긴 체어 모듈을 결합한 L자형 소파", parameters: [meter("width", "너비", 2.4), meter("depth", "전체 깊이", 1.65), meter("height", "높이", 0.82)], appearance: { color: "#667984", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),
  template({ id: "LOUNGE_BENCH", group: "FURNITURE", familyId: "SOFA", subtype: "BENCH", name: "Lounge Bench", nameKo: "라운지 벤치", description: "등받이가 낮은 개방형 휴게 벤치", parameters: [meter("width", "너비", 1.8), meter("depth", "깊이", 0.62), meter("height", "높이", 0.48)], appearance: { color: "#73828A", opacity: 1, materialPreset: "FABRIC" }, materialSlots: UPHOLSTERY_SLOTS }),

  template({ id: "STORAGE_SHELF", group: "FURNITURE", familyId: "STORAGE", legacyOnly: true, name: "Legacy Storage Shelf", nameKo: "기존 수납 선반", parameters: [meter("width", "너비", 1.2), meter("depth", "깊이", 0.45), meter("height", "높이", 2)], appearance: { color: "#778287", opacity: 1, materialPreset: "GALVANIZED" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "OPEN_BOOKSHELF", group: "FURNITURE", familyId: "STORAGE", subtype: "OPEN", name: "Open Bookshelf", nameKo: "오픈 책장", description: "다섯 단의 개방형 수납 선반", parameters: [meter("width", "너비", 1.0), meter("depth", "깊이", 0.35), meter("height", "높이", 1.9)], appearance: { color: "#83664E", opacity: 1, materialPreset: "WOOD" }, materialSlots: WOOD_FRAME_SLOTS }),
  template({ id: "STORAGE_CABINET", group: "FURNITURE", familyId: "STORAGE", subtype: "DOOR", name: "Storage Cabinet", nameKo: "양문형 수납장", description: "손잡이가 있는 두 개의 도어와 내부 선반을 갖춘 수납장", parameters: [meter("width", "너비", 0.9), meter("depth", "깊이", 0.45), meter("height", "높이", 1.8)], appearance: { color: "#7C878C", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "FILING_CABINET", group: "FURNITURE", familyId: "STORAGE", subtype: "FILING", name: "Filing Cabinet", nameKo: "파일 캐비닛", description: "네 개의 서랍과 라벨 홀더를 갖춘 문서 보관함", parameters: [meter("width", "너비", 0.48), meter("depth", "깊이", 0.62), meter("height", "높이", 1.32)], appearance: { color: "#778389", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "PERSONAL_LOCKER", group: "FURNITURE", familyId: "STORAGE", subtype: "LOCKER", name: "Personal Locker", nameKo: "개인 사물함", description: "환기구와 번호표가 있는 6칸 개인 사물함", parameters: [meter("width", "너비", 0.9), meter("depth", "깊이", 0.5), meter("height", "높이", 1.85)], appearance: { color: "#71838B", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "DRAWER_PEDESTAL", group: "FURNITURE", familyId: "STORAGE", subtype: "DRAWER", name: "Drawer Pedestal", nameKo: "이동식 서랍장", description: "캐스터와 세 개의 서랍을 갖춘 책상용 서랍장", parameters: [meter("width", "너비", 0.42), meter("depth", "깊이", 0.55), meter("height", "높이", 0.62)], appearance: { color: "#78858A", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: STORAGE_SLOTS }),

  template({ id: "PENDANT_LIGHT", group: "FURNITURE", familyId: "LIGHTING", subtype: "PENDANT", placement: OBJECT_PLACEMENT_TYPES.CEILING, name: "Pendant Light", nameKo: "펜던트 조명", description: "천장 케이블과 원형 갓으로 구성된 펜던트 조명", parameters: [meter("width", "지름", 0.42), meter("depth", "깊이", 0.42), meter("height", "높이", 0.55)], appearance: { color: "#E5D8B0", opacity: 1, materialPreset: "PAINTED_STEEL" } }),
  template({ id: "LINEAR_LIGHT", group: "FURNITURE", familyId: "LIGHTING", subtype: "LINEAR", placement: OBJECT_PLACEMENT_TYPES.CEILING, name: "Linear Light", nameKo: "라인 조명", description: "사무실용 선형 LED 천장 조명", parameters: [meter("width", "길이", 1.2), meter("depth", "폭", 0.12), meter("height", "두께", 0.06)], appearance: { color: "#E8EDF0", opacity: 1, materialPreset: "PLASTIC" } }),
  template({ id: "FLOOR_LAMP", group: "FURNITURE", familyId: "LIGHTING", subtype: "FLOOR", name: "Floor Lamp", nameKo: "플로어 램프", description: "원형 베이스와 스탠드, 조명 갓으로 구성된 바닥 조명", parameters: [meter("width", "너비", 0.42), meter("depth", "깊이", 0.42), meter("height", "높이", 1.55)], appearance: { color: "#D6C9A4", opacity: 1, materialPreset: "PAINTED_STEEL" } }),

  template({ id: "REFRIGERATOR", group: "FURNITURE", familyId: "APPLIANCE", subtype: "REFRIGERATOR", name: "Refrigerator", nameKo: "냉장고", description: "상하 도어와 손잡이가 구분된 일반 냉장고", parameters: [meter("width", "너비", 0.75), meter("depth", "깊이", 0.72), meter("height", "높이", 1.8)], appearance: { color: "#AAB2B6", opacity: 1, materialPreset: "STAINLESS" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "WATER_DISPENSER", group: "FURNITURE", familyId: "APPLIANCE", subtype: "DISPENSER", name: "Water Dispenser", nameKo: "정수기", description: "출수구와 물받이가 구분된 스탠드형 정수기", parameters: [meter("width", "너비", 0.34), meter("depth", "깊이", 0.38), meter("height", "높이", 1.15)], appearance: { color: "#D4DADD", opacity: 1, materialPreset: "PLASTIC" }, materialSlots: STORAGE_SLOTS }),
  template({ id: "VENDING_MACHINE", group: "FURNITURE", familyId: "APPLIANCE", subtype: "VENDING", name: "Vending Machine", nameKo: "자동판매기", description: "상품 창과 조작 패널, 배출구를 갖춘 자동판매기", parameters: [meter("width", "너비", 1.0), meter("depth", "깊이", 0.82), meter("height", "높이", 1.85)], appearance: { color: "#566E7B", opacity: 1, materialPreset: "PAINTED_STEEL" }, materialSlots: GLASS_FRAME_SLOTS }),

  template({ id: "WASH_BASIN", group: "FURNITURE", familyId: "SANITARY", subtype: "BASIN", placement: OBJECT_PLACEMENT_TYPES.WALL, name: "Wash Basin", nameKo: "세면대", description: "볼과 수도꼭지를 갖춘 벽 부착형 세면대", parameters: [meter("width", "너비", 0.62), meter("depth", "깊이", 0.5), meter("height", "높이", 0.82)], appearance: { color: "#E4E8E9", opacity: 1, materialPreset: "CERAMIC" } }),
  template({ id: "TOILET", group: "FURNITURE", familyId: "SANITARY", subtype: "TOILET", name: "Toilet", nameKo: "양변기", description: "변기 볼과 물탱크, 좌판이 구분된 양변기", parameters: [meter("width", "너비", 0.38), meter("depth", "깊이", 0.72), meter("height", "높이", 0.78)], appearance: { color: "#E6EAEB", opacity: 1, materialPreset: "CERAMIC" } }),
  template({ id: "URINAL", group: "FURNITURE", familyId: "SANITARY", subtype: "URINAL", placement: OBJECT_PLACEMENT_TYPES.WALL, name: "Urinal", nameKo: "소변기", description: "벽 부착형 볼과 급수관으로 구성된 소변기", parameters: [meter("width", "너비", 0.36), meter("depth", "깊이", 0.34), meter("height", "높이", 0.68)], appearance: { color: "#E6EAEB", opacity: 1, materialPreset: "CERAMIC" } }),

  template({ id: "PLANTER", group: "ENVIRONMENT", familyId: "PLANT", legacyOnly: true, name: "Legacy Planter", nameKo: "기존 플랜터", parameters: [meter("width", "너비", 0.8), meter("depth", "깊이", 0.35), meter("height", "높이", 0.4)], appearance: { color: "#687865", opacity: 1, materialPreset: "STONE" } }),
  template({ id: "INDOOR_TREE", group: "ENVIRONMENT", familyId: "PLANT", legacyOnly: true, name: "Legacy Indoor Tree", nameKo: "기존 실내 조경", parameters: [meter("width", "너비", 0.7), meter("depth", "깊이", 0.7), meter("height", "높이", 1.8)], appearance: { color: "#56705A", opacity: 1, materialPreset: "WOOD" } }),
  template({ id: "PLANTER_BOX", group: "ENVIRONMENT", familyId: "PLANT", subtype: "BOX", name: "Planter Box", nameKo: "직사각 플랜터", description: "흙과 저목 식재가 포함된 실내 플랜터", parameters: [meter("width", "너비", 0.9), meter("depth", "깊이", 0.36), meter("height", "높이", 0.55)], appearance: { color: "#6D7771", opacity: 1, materialPreset: "STONE" } }),
  template({ id: "FICUS_TREE", group: "ENVIRONMENT", familyId: "PLANT", subtype: "TREE", name: "Ficus Tree", nameKo: "실내 관엽수", description: "화분, 줄기와 수관이 구분된 중형 관엽수", parameters: [meter("width", "너비", 0.8), meter("depth", "깊이", 0.8), meter("height", "높이", 1.8)], appearance: { color: "#54705A", opacity: 1, materialPreset: "WOOD" } }),
  template({ id: "TALL_PLANT", group: "ENVIRONMENT", familyId: "PLANT", subtype: "TALL", name: "Tall Indoor Plant", nameKo: "키 큰 실내 식물", description: "세로로 긴 잎을 가진 원통 화분형 식물", parameters: [meter("width", "너비", 0.55), meter("depth", "깊이", 0.55), meter("height", "높이", 1.35)], appearance: { color: "#56725A", opacity: 1, materialPreset: "WOOD" } }),

  template({ id: "CUSTOM_STRUCTURE", group: "CUSTOM", name: "Custom Structure", nameKo: "사용자 구조물", parameters: [meter("width", "Width", 1), meter("height", "Height", 1), meter("depth", "Depth", 1)], variants: ["BOX", "CYLINDER", "PLANE", "LINEAR_STRUCTURE"], appearance: { color: "#7F8A90", opacity: 0.9, materialPreset: "GENERIC" } }),
];

export const WORLD_STRUCTURE_TEMPLATE_MAP = Object.fromEntries(
  WORLD_STRUCTURE_TEMPLATES.map((item) => [item.id, item]),
);

export const DEFAULT_WORLD_SPACE = {
  id: "SPACE_MACHINE_ROOM",
  name: "Machine Room A",
  type: "ROOM",
};

export const DEFAULT_VISIBILITY_FILTERS = {
  FLOOR: true,
  WALL: true,
  OPENING: true,
  PARTITION: true,
  COLUMN: true,
  PLATFORM: true,
  BOUNDARY: true,
  VERTICAL: true,
  OTHER: true,
  EQUIPMENT: true,
};
import {
  createObjectModelMetadata,
  OBJECT_PLACEMENT_TYPES,
} from "./objectModelRegistry.js";
