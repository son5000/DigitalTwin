import {
  OBJECT_LIBRARY_CATEGORY_IDS,
  OBJECT_LIBRARY_DEFINITIONS,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";

export const WORLD_WIZARD_STEP_IDS = Object.freeze({
  WORLD_COMPOSITION: "WORLD_COMPOSITION",
  BUILDING_DETAIL: "BUILDING_DETAIL",
  FLOOR_EQUIPMENT: "FLOOR_EQUIPMENT",
  EQUIPMENT_DETAIL: "EQUIPMENT_DETAIL",
});

export const WORLD_WIZARD_STEPS = Object.freeze([
  {
    id: WORLD_WIZARD_STEP_IDS.WORLD_COMPOSITION,
    label: "월드 구성",
    eyebrow: "GROUND · ENVIRONMENT · OBJECTS",
    title: "월드의 환경과 핵심 오브젝트를 구성하세요",
    description: "지면, 배경, 환경 요소와 Digital Twin 핵심 건축물을 하나의 View에서 구성합니다.",
    primaryLabel: "선택 건축물 상세 설정",
    contextLabel: "월드 구성",
  },
  {
    id: WORLD_WIZARD_STEP_IDS.BUILDING_DETAIL,
    label: "건축물 상세",
    eyebrow: "선택 건축물 집중",
    title: "건축물의 구조와 외관을 설정하세요",
    description: "층 수와 층고, 외관, 출입구와 계단 구성을 독립 View에서 편집합니다.",
    primaryLabel: "층별 설비 배치로 이동",
    contextLabel: "건축물 상세",
  },
  {
    id: WORLD_WIZARD_STEP_IDS.FLOOR_EQUIPMENT,
    label: "층별 설비 배치",
    eyebrow: "선택 층 집중",
    title: "선택한 층에 공간과 설비를 배치하세요",
    description: "층에서 작업 공간을 고른 뒤 해당 공간의 설비만 배치합니다.",
    primaryLabel: "설비 상세 설정",
    contextLabel: "설비 배치",
  },
  {
    id: WORLD_WIZARD_STEP_IDS.EQUIPMENT_DETAIL,
    label: "설비 상세 설정",
    eyebrow: "개별 설비 집중",
    title: "선택 설비의 상세 정보를 완성하세요",
    description: "속성, 부품, 스캔 자산과 Metadata를 한 설비 단위로 설정합니다.",
    primaryLabel: "월드 구축 저장",
    contextLabel: "설비 상세",
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
