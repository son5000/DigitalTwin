import { BUILDING_TEMPLATES } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { getDefaultObjectVariants } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { AddIcon, BuildingIcon, EnterIcon } from "@/components/icons";

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

export default function BuildingProperties({ building, floorCount, showEnterAction = true, onChange, onAddFloor, onEnter }) {
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
        <span>부지 / 건물</span>
        <h2>{building.name}</h2>
        <p>파라메트릭 건물</p>
        {showEnterAction ? (
          <button type="button" className={styles.enterButton} onClick={onEnter}>
            <EnterIcon size={17} />
            건물 내부 보기
          </button>
        ) : null}
      </header>

      <div className={styles.section}>
        <h3>기본 정보</h3>
        <label className={styles.selectField}>
          <span>건물 이름</span>
          <input value={building.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className={styles.selectField}>
          <span>건물 형태</span>
          <select
            value={building.templateId}
            onChange={(event) => {
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
                appearance: definition
                  ? { color: definition.color, material: definition.material }
                  : building.appearance,
              });
            }}
          >
            {BUILDING_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <label className={styles.selectField}>
          <span>지붕 형태</span>
          <select value={building.parameters.roofType} onChange={(event) => onChange({ parameters: { roofType: event.target.value } })}>
            {ROOF_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <ObjectVariantSelector
        definition={BUILDING_TEMPLATES.find((template) => template.id === building.templateId)?.definition}
        value={building.variants}
        onChange={(variants) => onChange({
          variants,
          parameters: { roofType: variants.roofStyle ?? building.parameters.roofType },
        })}
      />

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h3>크기와 층</h3>
          <span>전체 높이 {totalHeight.toFixed(1)} m</span>
        </div>
        <div className={styles.fieldGrid}>
          <NumericField label="가로" value={building.parameters.width} min={5} unit="m" onChange={(width) => onChange({ parameters: { width } })} />
          <NumericField label="세로" value={building.parameters.depth} min={5} unit="m" onChange={(depth) => onChange({ parameters: { depth } })} />
          <NumericField label="층 수" value={floorCount} min={1} step={1} unit="층" onChange={(nextFloorCount) => onChange({ parameters: { floorCount: nextFloorCount } })} />
          <NumericField label="층고" value={building.parameters.floorHeight} min={2} unit="m" onChange={(floorHeight) => onChange({ parameters: { floorHeight } })} />
          <NumericField label="출입구" value={building.parameters.entranceCount ?? 2} min={1} max={12} step={1} unit="개" onChange={(entranceCount) => onChange({ parameters: { entranceCount } })} />
          <NumericField label="계단" value={building.parameters.stairCount ?? 1} min={0} max={8} step={1} unit="개" onChange={(stairCount) => onChange({ parameters: { stairCount } })} />
        </div>
        <div className={styles.floorSummary}>
          <div><span>독립 편집 층</span><strong>{floorCount}</strong></div>
          <button type="button" onClick={onAddFloor}><AddIcon size={16} /> 층 추가</button>
        </div>
      </div>

      <div className={styles.section}>
        <h3>위치와 회전</h3>
        <div className={styles.fieldGrid}>
          <NumericField label="위치 X" value={building.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Y" value={building.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="위치 Z" value={building.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField
            label="회전 Y"
            value={building.rotation.y * 180 / Math.PI}
            step={1}
            unit="°"
            onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3>외관</h3>
        <label className={styles.selectField}>
          <span>외장 재질</span>
          <select value={building.appearance.material} onChange={(event) => onChange({ appearance: { material: event.target.value } })}>
            {MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.colorField}>
          <span>외장 색상</span>
          <span>
            <input type="color" value={building.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} />
            <code>{building.appearance.color.toUpperCase()}</code>
          </span>
        </label>
      </div>

      <p className={styles.hint}>한 번 클릭하면 속성만 선택됩니다. 내부 보기 또는 더블 클릭으로 층 구조에 진입합니다.</p>
    </section>
  );
}
