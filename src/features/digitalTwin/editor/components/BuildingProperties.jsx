import { BUILDING_TEMPLATES } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { getDefaultObjectVariants } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { BUILDING_SETTINGS_TABS } from "@/features/digitalTwin/editor/constants/buildingDetail";
import { BuildingIcon, EnterIcon } from "@/components/icons";

import NumericField from "./NumericField";
import { ObjectVariantSelector } from "./ObjectLibrary";
import styles from "./BuildingProperties.module.css";

const ROOF_OPTIONS = [
  { id: "FLAT", label: "평지붕" },
  { id: "GABLE", label: "박공지붕" },
  { id: "SAWTOOTH", label: "톱니지붕" },
];

const MATERIAL_OPTIONS = [
  { id: "CONCRETE", label: "콘크리트" },
  { id: "METAL", label: "금속 패널" },
  { id: "PAINTED", label: "도장 마감" },
];

export default function BuildingProperties({
  building,
  floorCount,
  activeTab = BUILDING_SETTINGS_TABS.EXTERIOR,
  floorPlanSummary,
  showEnterAction = true,
  onTabChange,
  onChange,
  onOpenFloorPlans,
  onEnter,
}) {
  if (!building) {
    return (
      <section className={styles.emptyState}>
        <span aria-hidden="true"><BuildingIcon size={38} /></span>
        <h2>건물을 선택하세요</h2>
        <p>3D 부지 또는 계층 트리에서 건물을 선택하면 크기와 외관을 편집할 수 있습니다.</p>
      </section>
    );
  }

  const totalHeight = floorCount * building.parameters.floorHeight;

  return (
    <section className={styles.panel}>
      <header className={styles.heading}>
        <span>현재 설정 중인 건축물</span>
        <h2>{building.name}</h2>
        <p>파라메트릭 건물</p>
        {showEnterAction ? (
          <button type="button" className={styles.enterButton} onClick={onEnter}>
            <EnterIcon size={17} />
            건물 내부 보기
          </button>
        ) : null}
      </header>

      <div className={styles.tabs} role="tablist" aria-label="건축물 설정 범위">
        <button type="button" role="tab" aria-selected={activeTab === BUILDING_SETTINGS_TABS.EXTERIOR} className={activeTab === BUILDING_SETTINGS_TABS.EXTERIOR ? styles.activeTab : ""} onClick={() => onTabChange(BUILDING_SETTINGS_TABS.EXTERIOR)}>외관 설정</button>
        <button type="button" role="tab" aria-selected={activeTab === BUILDING_SETTINGS_TABS.INTERIOR} className={activeTab === BUILDING_SETTINGS_TABS.INTERIOR ? styles.activeTab : ""} onClick={() => onTabChange(BUILDING_SETTINGS_TABS.INTERIOR)}>내부 설정</button>
      </div>

      {activeTab === BUILDING_SETTINGS_TABS.EXTERIOR ? (
        <>
          <div className={styles.section}>
            <h3>건축물 형태</h3>
            <label className={styles.selectField}><span>건물 이름</span><input value={building.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
            <label className={styles.selectField}>
              <span>건물 형태</span>
              <select value={building.templateId} onChange={(event) => {
                const template = BUILDING_TEMPLATES.find((item) => item.id === event.target.value);
                const definition = template?.definition;
                onChange({
                  templateId: event.target.value,
                  objectDefinitionId: event.target.value,
                  variants: getDefaultObjectVariants(definition),
                  parameters: {
                    ...definition?.parameters,
                    width: definition?.width ?? building.parameters.width,
                    depth: definition?.depth ?? building.parameters.depth,
                    roofType: template?.roofType ?? building.parameters.roofType,
                  },
                  appearance: definition ? { color: definition.color, material: definition.material } : building.appearance,
                });
              }}>
                {BUILDING_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label className={styles.selectField}><span>지붕 형태</span><select value={building.parameters.roofType} onChange={(event) => onChange({ parameters: { roofType: event.target.value } })}>{ROOF_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <div className={styles.fieldGrid}>
              <NumericField label="가로" value={building.parameters.width} min={5} unit="m" onChange={(width) => onChange({ parameters: { width } })} />
              <NumericField label="세로" value={building.parameters.depth} min={5} unit="m" onChange={(depth) => onChange({ parameters: { depth } })} />
            </div>
          </div>

          <ObjectVariantSelector definition={BUILDING_TEMPLATES.find((template) => template.id === building.templateId)?.definition} value={building.variants} onChange={(variants) => onChange({ variants, parameters: { roofType: variants.roofStyle ?? building.parameters.roofType } })} />

          <div className={styles.section}>
            <h3>외관 구성 요소</h3>
            <p className={styles.elementSummary}>외벽·지붕·창문·출입구는 형태와 Variant 설정에 포함됩니다. 기둥과 굴뚝은 아래에서 추가합니다.</p>
            <div className={styles.elementChecks}>
              {[
                { id: "STEEL_FRAME", label: "외부 기둥" },
                { id: "STACK", label: "굴뚝" },
              ].map((item) => {
                const extras = building.parameters.extras ?? [];
                return <label key={item.id}><input type="checkbox" checked={extras.includes(item.id)} onChange={(event) => onChange({ parameters: { extras: event.target.checked ? [...extras, item.id] : extras.filter((id) => id !== item.id) } })} /><span>{item.label}</span></label>;
              })}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}><h3>층과 출입구 기준</h3><span>전체 높이 {totalHeight.toFixed(1)} m</span></div>
            <div className={styles.fieldGrid}>
              <NumericField label="층 수" value={floorCount} min={1} step={1} unit="층" onChange={(nextFloorCount) => onChange({ parameters: { floorCount: nextFloorCount } })} />
              <NumericField label="층고" value={building.parameters.floorHeight} min={2} unit="m" onChange={(floorHeight) => onChange({ parameters: { floorHeight } })} />
              <NumericField label="출입구 기준" value={building.parameters.entranceCount ?? 2} min={1} max={12} step={1} unit="개" onChange={(entranceCount) => onChange({ parameters: { entranceCount } })} />
            </div>
            <p className={styles.hint}>층 수·층고·footprint를 변경하면 잠금된 층 바닥과 각 층 높이를 자동으로 다시 계산합니다.</p>
          </div>

          <div className={styles.section}>
            <h3>외장 마감</h3>
            <label className={styles.selectField}><span>외장 재질</span><select value={building.appearance.material} onChange={(event) => onChange({ appearance: { material: event.target.value } })}>{MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className={styles.colorField}><span>외장 색상</span><span><input type="color" value={building.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} /><code>{building.appearance.color.toUpperCase()}</code></span></label>
          </div>

          <div className={styles.section}>
            <h3>부지 내 위치</h3>
            <div className={styles.fieldGrid}>
              <NumericField label="위치 X" value={building.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
              <NumericField label="위치 Y" value={building.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
              <NumericField label="위치 Z" value={building.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
              <NumericField label="회전 Y" value={building.rotation.y * 180 / Math.PI} step={1} unit="°" onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })} />
            </div>
          </div>
          <p className={styles.hint}>외관 설정에서는 외벽, 지붕과 창문을 불투명하게 유지해 재질과 색상 결과를 바로 확인합니다.</p>
        </>
      ) : (
        <>
          <div className={styles.previewNotice}><strong>내부 구조 현황</strong><span>외벽을 반투명하게 표시해 층 바닥과 도면 진행 상태를 확인합니다. 실제 편집은 ‘층별 도면 구성’에서 수행합니다.</span></div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}><h3>도면 진행 현황</h3><span>전체 {floorCount}개 층</span></div>
            <div className={styles.floorSummary}>
              <div><span>작성된 층</span><strong>{floorPlanSummary?.configuredFloorCount ?? 0}</strong></div>
              <div><span>수직 연결 구조</span><strong>{floorPlanSummary?.verticalStructureCount ?? 0}</strong></div>
            </div>
            <button type="button" className={styles.enterButton} onClick={onOpenFloorPlans}>
              <EnterIcon size={17} /> 층별 도면 구성 열기
            </button>
          </div>
          <p className={styles.hint}>이 탭에서는 현황과 진입만 제공합니다. 벽, 공간 구획, 계단·엘리베이터를 중복 편집하지 않습니다.</p>
        </>
      )}
    </section>
  );
}
