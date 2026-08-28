export const OBJECT_PLACEMENT_TYPES = Object.freeze({
  FLOOR: "FLOOR",
  WALL: "WALL",
  CEILING: "CEILING",
});

export const OBJECT_MODEL_FAMILIES = Object.freeze({
  SPACE: { id: "SPACE", label: "공간·통로", category: "SPACE" },
  WALL: { id: "WALL", label: "벽·파티션", category: "STRUCTURE" },
  FRAME: { id: "FRAME", label: "기둥·구조 프레임", category: "STRUCTURE" },
  FLOOR_LEVEL: { id: "FLOOR_LEVEL", label: "바닥·레벨", category: "FLOOR" },
  DOOR: { id: "DOOR", label: "문·출입구", category: "OPENING" },
  WINDOW: { id: "WINDOW", label: "창문", category: "OPENING" },
  BOUNDARY: { id: "BOUNDARY", label: "난간·경계", category: "BOUNDARY" },
  VERTICAL: { id: "VERTICAL", label: "수직 연결", category: "VERTICAL" },
  DESK: { id: "DESK", label: "책상·작업대", category: "FURNITURE" },
  CHAIR: { id: "CHAIR", label: "의자", category: "FURNITURE" },
  TABLE: { id: "TABLE", label: "테이블", category: "FURNITURE" },
  SOFA: { id: "SOFA", label: "소파·벤치", category: "FURNITURE" },
  STORAGE: { id: "STORAGE", label: "수납·선반", category: "FURNITURE" },
  LIGHTING: { id: "LIGHTING", label: "조명", category: "FURNITURE" },
  APPLIANCE: { id: "APPLIANCE", label: "가전", category: "FURNITURE" },
  SANITARY: { id: "SANITARY", label: "위생 설비", category: "FURNITURE" },
  PLANT: { id: "PLANT", label: "식물·조경", category: "ENVIRONMENT" },
  CABINET: { id: "CABINET", label: "전기·캐비닛", category: "CABINET" },
  MACHINE: { id: "MACHINE", label: "회전·동력 기계", category: "MECHANICAL" },
  HVAC: { id: "HVAC", label: "공조·열원 장비", category: "MECHANICAL" },
  PIPE: { id: "PIPE", label: "배관·피팅", category: "PIPE" },
  DUCT: { id: "DUCT", label: "덕트·공조", category: "DUCT" },
  TANK: { id: "TANK", label: "탱크·용기", category: "TANK" },
  SAFETY: { id: "SAFETY", label: "안전 장비", category: "SAFETY" },
  SENSOR: { id: "SENSOR", label: "센서·카메라", category: "SENSOR" },
  UTILITY: { id: "UTILITY", label: "지원 설비", category: "UTILITY" },
  LEGACY_PRIMITIVE: { id: "LEGACY_PRIMITIVE", label: "기존 기본 도형", category: "BASIC" },
});

export const LEGACY_OBJECT_MODEL_ALIASES = Object.freeze({
  DESK: "OFFICE_DESK",
  CHAIR: "TASK_CHAIR",
  STORAGE_SHELF: "OPEN_BOOKSHELF",
  WORKBENCH: "INDUSTRIAL_WORKBENCH",
  PLANTER: "PLANTER_BOX",
  INDOOR_TREE: "FICUS_TREE",
});

const EQUIPMENT_FAMILY_RULES = Object.freeze([
  { familyId: "CABINET", matches: (id, category) => category === "CABINET" },
  { familyId: "PIPE", matches: (id, category) => category === "PIPE" },
  { familyId: "DUCT", matches: (id, category) => category === "DUCT" },
  { familyId: "TANK", matches: (id, category) => category === "TANK" },
  { familyId: "SAFETY", matches: (id, category) => category === "SAFETY" },
  { familyId: "SENSOR", matches: (id, category) => category === "SENSOR" },
  { familyId: "UTILITY", matches: (id, category) => category === "UTILITY" },
  { familyId: "HVAC", matches: (id) => ["CHILLER", "BOILER", "HEAT_EXCHANGER"].includes(id) },
  { familyId: "MACHINE", matches: (id, category) => category === "MECHANICAL" },
  { familyId: "LEGACY_PRIMITIVE", matches: (id, category) => category === "BASIC" || category === "CUSTOM" },
]);

export function getEquipmentModelFamily(id, category) {
  const rule = EQUIPMENT_FAMILY_RULES.find((item) => item.matches(id, category));
  return OBJECT_MODEL_FAMILIES[rule?.familyId ?? "MACHINE"];
}

export function createObjectModelMetadata({
  id,
  familyId,
  subtype,
  description,
  placement = OBJECT_PLACEMENT_TYPES.FLOOR,
  materialSlots = [],
  thumbnail,
  legacyOnly = false,
  lod = { mediumDistance: 28, lowDistance: 70 },
}) {
  const family = OBJECT_MODEL_FAMILIES[familyId];
  const defaultPositionY = placement === OBJECT_PLACEMENT_TYPES.CEILING
    ? 2.7
    : placement === OBJECT_PLACEMENT_TYPES.WALL
      ? 1.1
      : 0;
  return {
    modelId: id,
    objectType: family?.id ?? familyId,
    objectTypeLabel: family?.label ?? familyId,
    subtype: subtype ?? id,
    description: description ?? family?.label ?? id,
    placement,
    defaultPositionY,
    materialSlots,
    thumbnail: thumbnail ?? `procedural:${family?.id ?? familyId}`,
    legacyOnly,
    lod,
  };
}

export function resolveObjectModelId(id) {
  return LEGACY_OBJECT_MODEL_ALIASES[id] ?? id;
}
