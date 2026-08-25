import {
  OBJECT_LIBRARY_CATEGORY_IDS,
  OBJECT_LIBRARY_DEFINITIONS,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";

export const WORLD_WIZARD_STEP_IDS = Object.freeze({
  COMPOSITION: "COMPOSITION",
  FLOOR_AND_EQUIPMENT: "FLOOR_AND_EQUIPMENT",
  MONITORING: "MONITORING",
  SPACE_COMPOSITION: "COMPOSITION",
  BUILDING_SETTINGS: "COMPOSITION",
  INTERIOR_COMPOSITION: "FLOOR_AND_EQUIPMENT",
  EQUIPMENT_SETTINGS: "MONITORING",
});

export const WORLD_WIZARD_STEPS = Object.freeze([
  {
    id: WORLD_WIZARD_STEP_IDS.COMPOSITION,
    label: "공간 및 건축물 구성",
    shortLabel: "공간 구성",
    eyebrow: "SITE · ENVIRONMENT · BUILDING SETTINGS",
    title: "부지와 건축물을 한 화면에서 구성하세요",
    description: "부지·환경 배치와 건축물 외관·층 기본값·내부 현황을 같은 단계에서 설정합니다.",
    primaryLabel: "층별 도면 및 설비 배치로 이동",
    contextLabel: "공간 및 건축물 구성",
  },
  {
    id: WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT,
    label: "층별 도면 및 설비 배치",
    shortLabel: "도면·설비",
    eyebrow: "FLOOR PLAN · STRUCTURE · EQUIPMENT",
    title: "도면과 설비를 2D·3D에서 함께 배치하세요",
    description: "건축 구조와 설비 인스턴스를 분리해 관리하면서 같은 층과 뷰 상태를 공유합니다.",
    primaryLabel: "설비 관측 설정으로 이동",
    contextLabel: "층별 도면 및 설비 배치",
  },
  {
    id: WORLD_WIZARD_STEP_IDS.MONITORING,
    label: "설비 관측 설정",
    shortLabel: "관측 설정",
    eyebrow: "TARGET · DEVICE · BINDING · PREVIEW",
    title: "관측 지점과 현실 장치·데이터 수신 방식을 연결하세요",
    description: "백엔드 연결 없이 관측 지점, 센서·카메라, 수신 바인딩과 샘플 값을 구성합니다.",
    primaryLabel: "관측 설정 저장",
    contextLabel: "설비 관측 설정",
  },
]);

export const ENVIRONMENT_TEMPLATE_IDS = Object.freeze(
  OBJECT_LIBRARY_DEFINITIONS
    .filter((definition) => ![
      OBJECT_LIBRARY_CATEGORY_IDS.BUILDING,
      OBJECT_LIBRARY_CATEGORY_IDS.INDUSTRIAL_BUILDING,
    ].includes(definition.categoryId))
    .map((definition) => definition.id),
);

export const BUILDING_TEMPLATE_IDS = Object.freeze(
  OBJECT_LIBRARY_DEFINITIONS
    .filter((definition) => [
      OBJECT_LIBRARY_CATEGORY_IDS.BUILDING,
      OBJECT_LIBRARY_CATEGORY_IDS.INDUSTRIAL_BUILDING,
    ].includes(definition.categoryId))
    .map((definition) => definition.id),
);

export function getWizardStepIndex(stepId) {
  const index = WORLD_WIZARD_STEPS.findIndex((step) => step.id === stepId);
  return index < 0 ? 0 : index;
}
