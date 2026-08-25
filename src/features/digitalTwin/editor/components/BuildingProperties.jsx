import { BuildingIcon, EnterIcon } from "@/components/icons";
import { getDefaultObjectVariants } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { BUILDING_TEMPLATES } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";

import NumericField from "./NumericField";
import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import { ObjectVariantSelector } from "./ObjectLibrary";
import styles from "./BuildingProperties.module.css";

const ROOF_OPTIONS = [
  { id: "FLAT", label: "평지붕" },
  { id: "GABLE", label: "박공지붕" },
  { id: "SAWTOOTH", label: "톱니지붕" },
];

function SettingsGroup({ title, summary, defaultOpen = false, children }) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary><strong>{title}</strong>{summary ? <span>{summary}</span> : null}</summary>
      <div className={styles.sectionContent}>{children}</div>
    </details>
  );
}

export default function BuildingProperties({ building, floorCount, floorPlanSummary, onChange, onOpenFloorPlans }) {
  if (!building) {
    return (
      <section className={styles.emptyState}>
        <span aria-hidden="true"><BuildingIcon size={32} /></span>
        <h2>건물을 선택하세요</h2>
      </section>
    );
  }

  const totalHeight = floorCount * building.parameters.floorHeight;
  const configuredFloorCount = floorPlanSummary?.configuredFloorCount ?? 0;
  const verticalStructureCount = floorPlanSummary?.verticalStructureCount ?? 0;
  const buildingDefinition = BUILDING_TEMPLATES.find((template) => template.id === building.templateId)?.definition;

  return (
    <section className={styles.panel}>
      <header className={styles.heading}>
        <div className={styles.headingText}>
          <span>건축물 설정</span>
          <h2>{building.name}</h2>
          <div className={styles.quickStats} aria-label="건축물 구성 현황">
            <small>{floorCount}층</small>
            <small>도면 {configuredFloorCount}/{floorCount}</small>
            <small>수직 구조 {verticalStructureCount}</small>
          </div>
        </div>
        <button type="button" className={styles.enterButton} onClick={onOpenFloorPlans} title="층별 도면 및 설비 배치로 이동">
          <EnterIcon size={16} /><span>도면 편집</span>
        </button>
      </header>

      <SettingsGroup title="기본 형태" summary={`${building.parameters.width} × ${building.parameters.depth} m`} defaultOpen>
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
        <div className={styles.inlineGrid}>
          <label className={styles.selectField}><span>지붕 형태</span><select value={building.parameters.roofType} onChange={(event) => onChange({ parameters: { roofType: event.target.value } })}>{ROOF_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <NumericField label="가로" value={building.parameters.width} min={5} unit="m" onChange={(width) => onChange({ parameters: { width } })} />
          <NumericField label="세로" value={building.parameters.depth} min={5} unit="m" onChange={(depth) => onChange({ parameters: { depth } })} />
        </div>
      </SettingsGroup>

      <SettingsGroup title="형태 세부 옵션" summary="지붕 · 외벽 · 창문 · 출입구">
        <ObjectVariantSelector definition={buildingDefinition} value={building.variants} onChange={(variants) => onChange({ variants, parameters: { roofType: variants.roofStyle ?? building.parameters.roofType } })} />
      </SettingsGroup>

      <SettingsGroup title="층과 출입구" summary={`${floorCount}층 · ${totalHeight.toFixed(1)} m`}>
        <div className={styles.inlineGrid}>
          <NumericField label="층 수" value={floorCount} min={1} step={1} unit="층" onChange={(nextFloorCount) => onChange({ parameters: { floorCount: nextFloorCount } })} />
          <NumericField label="층고" value={building.parameters.floorHeight} min={2} unit="m" onChange={(floorHeight) => onChange({ parameters: { floorHeight } })} />
          <NumericField label="출입구" value={building.parameters.entranceCount ?? 2} min={1} max={12} step={1} unit="개" onChange={(entranceCount) => onChange({ parameters: { entranceCount } })} />
        </div>
      </SettingsGroup>

      <SettingsGroup title="구성 요소" summary={(building.parameters.extras ?? []).length ? `${building.parameters.extras.length}개 사용` : "기본 구성"}>
        <div className={styles.elementChecks}>
          {[
            { id: "STEEL_FRAME", label: "외부 기둥" },
            { id: "STACK", label: "굴뚝" },
          ].map((item) => {
            const extras = building.parameters.extras ?? [];
            return <label key={item.id}><input type="checkbox" checked={extras.includes(item.id)} onChange={(event) => onChange({ parameters: { extras: event.target.checked ? [...extras, item.id] : extras.filter((id) => id !== item.id) } })} /><span>{item.label}</span></label>;
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup title="재질과 색상" summary="표면 프리셋 · 물성">
        <MaterialAppearanceEditor appearance={building.appearance} onChange={(appearance) => onChange({ appearance })} />
      </SettingsGroup>

      <SettingsGroup title="위치와 회전" summary={`X ${building.position.x.toFixed(1)} · Z ${building.position.z.toFixed(1)}`}>
        <div className={styles.inlineGrid}>
          <NumericField label="위치 X" value={building.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Y" value={building.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="위치 Z" value={building.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField label="회전 Y" value={building.rotation.y * 180 / Math.PI} step={1} unit="°" onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })} />
        </div>
      </SettingsGroup>
    </section>
  );
}
