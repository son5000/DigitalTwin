export const EDITOR_DEPTHS = Object.freeze({
  SITE: "SITE",
  BUILDING: "BUILDING",
  FLOOR: "FLOOR",
  ROOM: "ROOM",
  EQUIPMENT: "EQUIPMENT",
});

export const EDITOR_DEPTH_META = Object.freeze({
  [EDITOR_DEPTHS.SITE]: { level: 1, label: "월드 구성", description: "지면과 외부 환경" },
  [EDITOR_DEPTHS.BUILDING]: { level: 2, label: "건물 구성", description: "건물과 층 구조" },
  [EDITOR_DEPTHS.FLOOR]: { level: 2, label: "층 구성", description: "공간과 내부 구조" },
  [EDITOR_DEPTHS.ROOM]: { level: 3, label: "설비 구성", description: "설비 배치와 속성" },
  [EDITOR_DEPTHS.EQUIPMENT]: { level: 3, label: "설비 상세", description: "스캔과 파트" },
});

export function createInitialNavigationContext() {
  return {
    currentDepth: EDITOR_DEPTHS.SITE,
    currentBuildingId: null,
    currentFloorId: null,
    currentRoomId: null,
    currentEquipmentId: null,
    isEditing: true,
    transitionDirection: "OUT",
    transitionId: 0,
  };
}
