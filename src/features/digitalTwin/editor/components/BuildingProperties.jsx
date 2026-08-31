import { BuildingIcon, EnterIcon } from "@/components/icons";
import { getCustomBuildingEditPath, navigateTo } from "@/features/customAssets/core/customAssetNavigation";
import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import { BUILDING_VIEW_MODES } from "@/features/customAssets/building/buildingAssembly";
import { getDefaultObjectVariants, OBJECT_LIBRARY_DEFINITION_MAP } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { BUILDING_TEMPLATES } from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import { BUILDING_FACADES, normalizeBuildingOpenings } from "@/features/digitalTwin/editor/model/buildingOpenings";

import NumericField from "./NumericField";
import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import UserTextureEditor from "./UserTextureEditor";
import { ObjectVariantSelector } from "./ObjectLibrary";
import styles from "./BuildingProperties.module.css";

const ROOF_OPTIONS = [
  { id: "FLAT", label: "평지붕" },
  { id: "GABLE", label: "박공지붕" },
  { id: "SAWTOOTH", label: "톱니지붕" },
];

const FACADE_OPTIONS = Object.freeze([
  [BUILDING_FACADES.FRONT, "정면"], [BUILDING_FACADES.BACK, "후면"],
  [BUILDING_FACADES.LEFT, "좌측면"], [BUILDING_FACADES.RIGHT, "우측면"],
]);
const APPEARANCE_MATERIAL_OPTIONS = Object.freeze([
  ["PAINTED_METAL", "도장 금속"], ["STEEL", "강재"], ["WOOD", "목재"], ["GLASS", "유리"],
]);

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
  const buildingDefinition = OBJECT_LIBRARY_DEFINITION_MAP[building.templateId];
  const isCustomBuilding = Boolean(building.customAssetId);
  const customAsset = isCustomBuilding ? getRuntimeCustomAsset(building.customAssetId) ?? building.customAssetSnapshot : null;
  const facadeOpenings = normalizeBuildingOpenings(building.facadeOpenings, floorCount);
  const updateOpening = (kind, changes) => onChange({ facadeOpenings: { ...facadeOpenings, [kind]: { ...facadeOpenings[kind], ...changes } } });
  const updateOpeningAppearance = (kind, slot, changes) => updateOpening(kind, { [slot]: { ...facadeOpenings[kind][slot], ...changes } });

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

      {isCustomBuilding ? (
        <SettingsGroup title="커스텀 제작소" summary={`리비전 ${building.customAssetRevision ?? 1}`} defaultOpen>
          <div className={styles.elementChecks}>
            <label><input type="checkbox" checked={building.customAssetAutoUpdate !== false} onChange={(event) => onChange({ customAssetAutoUpdate: event.target.checked })} /><span>저장한 최신 설계를 자동 반영</span></label>
          </div>
          <button type="button" className={styles.enterButton} onClick={() => navigateTo(getCustomBuildingEditPath(building.customAssetId))}>제작소에서 수정</button>
          {customAsset?.viewGroups?.length ? <>
            <label className={styles.selectField}><span>관측 범위</span><select value={building.customAssetViewGroupId ?? customAsset.defaultViewGroupId} onChange={(event) => onChange({ customAssetViewGroupId: event.target.value })}>{customAsset.viewGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className={styles.selectField}><span>표시 모드</span><select value={building.customAssetViewMode ?? BUILDING_VIEW_MODES.ALL} onChange={(event) => onChange({ customAssetViewMode: event.target.value })}><option value={BUILDING_VIEW_MODES.ALL}>전체 정상 표시</option><option value={BUILDING_VIEW_MODES.HIGHLIGHT}>선택 그룹 강조</option><option value={BUILDING_VIEW_MODES.GHOST_OTHERS}>선택 외 반투명</option><option value={BUILDING_VIEW_MODES.HIDE_OTHERS}>선택 외 숨김</option></select></label>
            <div className={styles.elementChecks}><label><input type="checkbox" checked={building.customAssetExploded ?? false} onChange={(event) => onChange({ customAssetExploded: event.target.checked })} /><span>분해 관측</span></label></div>
          </> : null}
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="기본 형태" summary={`${building.parameters.width} × ${building.parameters.depth} m`} defaultOpen>
        <label className={styles.selectField}><span>건물 이름</span><input value={building.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        {!isCustomBuilding ? <label className={styles.selectField}>
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
        </label> : null}
        <div className={styles.inlineGrid}>
          <label className={styles.selectField}><span>지붕 형태</span><select value={building.parameters.roofType} onChange={(event) => onChange({ parameters: { roofType: event.target.value } })}>{ROOF_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <NumericField label="가로" value={building.parameters.width} min={5} unit="m" onChange={(width) => onChange({ parameters: { width } })} />
          <NumericField label="세로" value={building.parameters.depth} min={5} unit="m" onChange={(depth) => onChange({ parameters: { depth } })} />
        </div>
      </SettingsGroup>

      {!isCustomBuilding ? <SettingsGroup title="형태 세부 옵션" summary="지붕 · 외벽 · 창문 · 출입구">
        <ObjectVariantSelector definition={buildingDefinition} value={building.variants} onChange={(variants) => onChange({ variants, parameters: { roofType: variants.roofStyle ?? building.parameters.roofType } })} />
      </SettingsGroup> : null}

      {!isCustomBuilding ? <SettingsGroup title="출입문" summary={facadeOpenings.doors.enabled ? `${facadeOpenings.doors.count}개 · ${FACADE_OPTIONS.find(([id]) => id === facadeOpenings.doors.facade)?.[1]}` : "사용 안 함"}>
        <div className={styles.elementChecks}><label><input type="checkbox" checked={facadeOpenings.doors.enabled} onChange={(event) => updateOpening("doors", { enabled: event.target.checked })} /><span>출입문 사용</span></label></div>
        <div className={styles.inlineGrid}>
          <NumericField label="개수" value={facadeOpenings.doors.count} min={1} max={12} step={1} unit="개" disabled={!facadeOpenings.doors.enabled} onChange={(count) => updateOpening("doors", { count })} />
          <label className={styles.selectField}><span>배치 외벽</span><select disabled={!facadeOpenings.doors.enabled} value={facadeOpenings.doors.facade} onChange={(event) => updateOpening("doors", { facade: event.target.value })}>{FACADE_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className={styles.selectField}><span>종류</span><select disabled={!facadeOpenings.doors.enabled} value={facadeOpenings.doors.type} onChange={(event) => updateOpening("doors", { type: event.target.value })}><option value="STANDARD">일반문</option><option value="DOUBLE">양개문</option><option value="SLIDING">미닫이문</option><option value="SHUTTER">셔터</option><option value="VEHICLE_GATE">차량 출입문</option></select></label>
          <NumericField label="너비" value={facadeOpenings.doors.width} min={0.7} unit="m" disabled={!facadeOpenings.doors.enabled} onChange={(width) => updateOpening("doors", { width })} />
          <NumericField label="높이" value={facadeOpenings.doors.height} min={1.8} unit="m" disabled={!facadeOpenings.doors.enabled} onChange={(height) => updateOpening("doors", { height })} />
          <NumericField label="간격" value={facadeOpenings.doors.spacing} min={0.2} unit="m" disabled={!facadeOpenings.doors.enabled} onChange={(spacing) => updateOpening("doors", { spacing })} />
          <NumericField label="중심 오프셋" value={facadeOpenings.doors.offset} unit="m" disabled={!facadeOpenings.doors.enabled} onChange={(offset) => updateOpening("doors", { offset })} />
          <NumericField label="시작 층" value={facadeOpenings.doors.startFloor} min={1} max={floorCount} step={1} unit="층" disabled={!facadeOpenings.doors.enabled} onChange={(startFloor) => updateOpening("doors", { startFloor })} />
          <NumericField label="종료 층" value={facadeOpenings.doors.endFloor} min={facadeOpenings.doors.startFloor} max={floorCount} step={1} unit="층" disabled={!facadeOpenings.doors.enabled} onChange={(endFloor) => updateOpening("doors", { endFloor })} />
        </div>
        <div className={styles.inlineGrid}>{[["frame", "문틀"], ["leaf", "문짝"]].map(([slot, label]) => <div key={slot}><label className={styles.selectField}><span>{label} 재질</span><select disabled={!facadeOpenings.doors.enabled} value={facadeOpenings.doors[slot].materialPreset} onChange={(event) => updateOpeningAppearance("doors", slot, { materialPreset: event.target.value })}>{APPEARANCE_MATERIAL_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label className={styles.colorField}><span>{label} 색상</span><span><input type="color" disabled={!facadeOpenings.doors.enabled} value={facadeOpenings.doors[slot].color} onChange={(event) => updateOpeningAppearance("doors", slot, { color: event.target.value })} /><code>{facadeOpenings.doors[slot].color}</code></span></label></div>)}</div>
      </SettingsGroup> : null}

      {!isCustomBuilding ? <SettingsGroup title="창문" summary={facadeOpenings.windows.enabled ? `외벽당 ${facadeOpenings.windows.count}개 · ${facadeOpenings.windows.startFloor}~${facadeOpenings.windows.endFloor}층` : "사용 안 함"}>
        <div className={styles.elementChecks}><label><input type="checkbox" checked={facadeOpenings.windows.enabled} onChange={(event) => updateOpening("windows", { enabled: event.target.checked })} /><span>창문 사용</span></label></div>
        <div className={styles.inlineGrid}>
          <NumericField label="외벽당 개수" value={facadeOpenings.windows.count} min={1} max={24} step={1} unit="개" disabled={!facadeOpenings.windows.enabled} onChange={(count) => updateOpening("windows", { count })} />
          <label className={styles.selectField}><span>종류</span><select disabled={!facadeOpenings.windows.enabled} value={facadeOpenings.windows.type} onChange={(event) => updateOpening("windows", { type: event.target.value })}><option value="FIXED">고정창</option><option value="SLIDING">미닫이창</option><option value="CASEMENT">여닫이창</option><option value="CURTAIN_WALL">커튼월</option><option value="LOUVER">루버</option></select></label>
          <NumericField label="너비" value={facadeOpenings.windows.width} min={0.3} unit="m" disabled={!facadeOpenings.windows.enabled} onChange={(width) => updateOpening("windows", { width })} />
          <NumericField label="높이" value={facadeOpenings.windows.height} min={0.3} unit="m" disabled={!facadeOpenings.windows.enabled} onChange={(height) => updateOpening("windows", { height })} />
          <NumericField label="창턱 높이" value={facadeOpenings.windows.sillHeight} min={0.1} unit="m" disabled={!facadeOpenings.windows.enabled} onChange={(sillHeight) => updateOpening("windows", { sillHeight })} />
          <NumericField label="간격" value={facadeOpenings.windows.spacing} min={0.1} unit="m" disabled={!facadeOpenings.windows.enabled} onChange={(spacing) => updateOpening("windows", { spacing })} />
          <NumericField label="중심 오프셋" value={facadeOpenings.windows.offset} unit="m" disabled={!facadeOpenings.windows.enabled} onChange={(offset) => updateOpening("windows", { offset })} />
          <NumericField label="시작 층" value={facadeOpenings.windows.startFloor} min={1} max={floorCount} step={1} unit="층" disabled={!facadeOpenings.windows.enabled} onChange={(startFloor) => updateOpening("windows", { startFloor })} />
          <NumericField label="종료 층" value={facadeOpenings.windows.endFloor} min={facadeOpenings.windows.startFloor} max={floorCount} step={1} unit="층" disabled={!facadeOpenings.windows.enabled} onChange={(endFloor) => updateOpening("windows", { endFloor })} />
        </div>
        <div className={styles.elementChecks}>{FACADE_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" disabled={!facadeOpenings.windows.enabled} checked={facadeOpenings.windows.facades.includes(id)} onChange={(event) => updateOpening("windows", { facades: event.target.checked ? [...facadeOpenings.windows.facades, id] : facadeOpenings.windows.facades.filter((item) => item !== id) })} /><span>{label}</span></label>)}</div>
        <div className={styles.inlineGrid}>{[["frame", "창틀"], ["glass", "유리"]].map(([slot, label]) => <div key={slot}><label className={styles.selectField}><span>{label} 재질</span><select disabled={!facadeOpenings.windows.enabled} value={facadeOpenings.windows[slot].materialPreset} onChange={(event) => updateOpeningAppearance("windows", slot, { materialPreset: event.target.value })}>{APPEARANCE_MATERIAL_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label className={styles.colorField}><span>{label} 색상</span><span><input type="color" disabled={!facadeOpenings.windows.enabled} value={facadeOpenings.windows[slot].color} onChange={(event) => updateOpeningAppearance("windows", slot, { color: event.target.value })} /><code>{facadeOpenings.windows[slot].color}</code></span></label></div>)}</div>
      </SettingsGroup> : null}

      <SettingsGroup title="층과 출입구" summary={`${floorCount}층 · ${totalHeight.toFixed(1)} m`}>
        <div className={styles.inlineGrid}>
          <NumericField label="층 수" value={floorCount} min={1} step={1} unit="층" onChange={(nextFloorCount) => onChange({ parameters: { floorCount: nextFloorCount } })} />
          <NumericField label="층고" value={building.parameters.floorHeight} min={2} unit="m" onChange={(floorHeight) => onChange({ parameters: { floorHeight } })} />
          <NumericField label="출입구" value={building.parameters.entranceCount ?? 2} min={1} max={12} step={1} unit="개" onChange={(entranceCount) => onChange({ parameters: { entranceCount } })} />
        </div>
      </SettingsGroup>

      {!isCustomBuilding ? <SettingsGroup title="구성 요소" summary={(building.parameters.extras ?? []).length ? `${building.parameters.extras.length}개 사용` : "기본 구성"}>
        <div className={styles.elementChecks}>
          {[
            { id: "STEEL_FRAME", label: "외부 기둥" },
            { id: "STACK", label: "굴뚝" },
          ].map((item) => {
            const extras = building.parameters.extras ?? [];
            return <label key={item.id}><input type="checkbox" checked={extras.includes(item.id)} onChange={(event) => onChange({ parameters: { extras: event.target.checked ? [...extras, item.id] : extras.filter((id) => id !== item.id) } })} /><span>{item.label}</span></label>;
          })}
        </div>
      </SettingsGroup> : null}

      <SettingsGroup title="재질과 색상" summary="표면 프리셋 · 물성">
        <MaterialAppearanceEditor appearance={building.appearance} onChange={(appearance) => onChange({ appearance })} />
      </SettingsGroup>

      <SettingsGroup title="사용자 텍스처" summary={building.userTexture ? "적용됨" : "기본 재질"}>
        <UserTextureEditor
          value={building.userTexture}
          targets={isCustomBuilding
            ? [{ id: "ALL", label: "전체 적용" }]
            : [{ id: "ALL", label: "전체" }, { id: "EXTERIOR", label: "외벽" }, { id: "ROOF", label: "지붕" }]}
          onChange={(userTexture) => onChange({ userTexture })}
        />
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
