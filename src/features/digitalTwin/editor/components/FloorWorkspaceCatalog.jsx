import { useMemo, useState } from "react";

import {
  AddIcon,
  ChevronDownIcon,
  CloseIcon,
  DuctIcon,
  ElectricalIcon,
  EquipmentIcon,
  EquipmentTemplateIcon,
  LandscapeIcon,
  MechanicalIcon,
  PipeIcon,
  SafetyIcon,
  SensorIcon,
  StarIcon,
  WorldIcon,
  WorldStructureTypeIcon,
} from "@/components/icons";
import { ObjectLibrarySearch } from "@/features/digitalTwin/editor/components/ObjectLibrary";
import ObjectModelThumbnail from "@/features/digitalTwin/editor/components/ObjectModelThumbnail";
import {
  UNIFIED_EQUIPMENT_CATEGORIES,
  UNIFIED_EQUIPMENT_TEMPLATE_MAP,
  UNIFIED_EQUIPMENT_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import {
  WORLD_STRUCTURE_GROUPS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
  WORLD_STRUCTURE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";

import objectStyles from "./ObjectLibrary/ObjectLibrary.module.css";
import styles from "./FloorWorkspaceCatalog.module.css";

const CATALOG_MODES = Object.freeze({ PLAN: "PLAN", EQUIPMENT: "EQUIPMENT" });
const EQUIPMENT_CATEGORY_ICONS = Object.freeze({
  ELECTRICAL: ElectricalIcon,
  HVAC: DuctIcon,
  PIPE_WATER: PipeIcon,
  FIRE_SAFETY: SafetyIcon,
  COMM_SECURITY: SensorIcon,
  ENERGY_ENVIRONMENT: LandscapeIcon,
  GENERAL: MechanicalIcon,
});

function EquipmentCategoryIcon({ categoryId, ...props }) {
  const Icon = EQUIPMENT_CATEGORY_ICONS[categoryId] ?? EquipmentIcon;
  return <Icon {...props} />;
}

function matchesQuery(definition, normalizedQuery) {
  if (!normalizedQuery) return true;
  return [definition.id, definition.name, definition.nameKo, ...(definition.keywords ?? [])]
    .join(" ")
    .toLocaleLowerCase("ko-KR")
    .includes(normalizedQuery);
}

function formatDimensions(definition) {
  const dimensions = definition.defaultDimensions ?? definition.defaultParameters;
  const width = dimensions.width ?? dimensions.length;
  const depth = dimensions.depth ?? dimensions.width;
  const height = dimensions.height;
  return [width, depth, height].every(Number.isFinite)
    ? `${width} × ${depth} × ${height} m`
    : definition.placement;
}

function CatalogItem({ definition, domain, active, favorite = false, onSelect, onToggleFavorite }) {
  const isEquipment = domain === CATALOG_MODES.EQUIPMENT;
  return (
    <div className={styles.catalogItem}>
      <button
        type="button"
        className={`${objectStyles.item} ${active ? objectStyles.itemActive : ""}`}
        aria-pressed={active}
        title={`${definition.nameKo} · ${definition.description ?? definition.name} · 배치`}
        onClick={() => onSelect(definition.id)}
      >
        <span className={objectStyles.preview} aria-hidden="true">
          <ObjectModelThumbnail definition={definition} title={definition.nameKo} />
        </span>
        <span className={objectStyles.itemText}><strong>{definition.nameKo}</strong><small>{definition.installationBadges?.join(" · ") ?? formatDimensions(definition)}{definition.modelVariants?.length > 1 ? ` · 변형 ${definition.modelVariants.length}` : ""}</small></span>
        <span className={objectStyles.itemAction} aria-hidden="true">{active ? <CloseIcon size={15} /> : <AddIcon size={15} />}</span>
      </button>
      {isEquipment && onToggleFavorite ? (
        <button
          type="button"
          className={`${styles.favoriteButton} ${favorite ? styles.favoriteActive : ""}`}
          aria-label={`${definition.nameKo} ${favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
          aria-pressed={favorite}
          title={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          onClick={() => onToggleFavorite?.(definition.id)}
        >
          <StarIcon size={14} filled={favorite} />
        </button>
      ) : null}
    </div>
  );
}

function CatalogCategory({ category, definitions, domain, activeTemplateId, favoriteTemplateIds, open, onToggle, onSelect, onToggleFavorite }) {
  const representative = definitions[0];
  const families = [...new Map(definitions.map((definition) => [definition.objectType, {
    id: definition.objectType,
    label: definition.objectTypeLabel,
    definitions: definitions.filter((item) => item.objectType === definition.objectType),
  }])).values()];
  return (
    <section className={`${objectStyles.category} ${open ? objectStyles.categoryOpen : ""}`}>
      <button type="button" className={objectStyles.categoryTrigger} aria-expanded={open} onClick={onToggle}>
        <span className={objectStyles.categoryIcon} aria-hidden="true">
          {domain === CATALOG_MODES.EQUIPMENT
            ? <EquipmentCategoryIcon categoryId={category.id} size={19} />
            : <WorldStructureTypeIcon definition={representative} size={19} />}
        </span>
        <span className={objectStyles.categoryText}><strong>{category.nameKo}</strong></span>
        <span className={objectStyles.categoryCount}>{definitions.length}</span>
        <ChevronDownIcon size={16} className={objectStyles.chevron} />
      </button>
      <div className={objectStyles.categoryBody} aria-hidden={!open} inert={!open}>
        <div className={objectStyles.categoryBodyInner}>
          {domain === CATALOG_MODES.EQUIPMENT ? (
            <div className={objectStyles.subcategory}>
              <div className={objectStyles.itemList}>
                {definitions.map((definition) => (
                  <CatalogItem
                    key={definition.id}
                    definition={definition}
                    domain={domain}
                    active={definition.id === activeTemplateId}
                    favorite={favoriteTemplateIds.includes(definition.id)}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </div>
          ) : families.map((family) => (
            <section key={family.id} className={objectStyles.subcategory}>
              <header><span>{family.label}</span><small>{family.definitions.length}</small></header>
              <div className={objectStyles.itemList}>
                {family.definitions.map((definition) => (
                  <CatalogItem
                    key={definition.id}
                    definition={definition}
                    domain={domain}
                    active={definition.id === activeTemplateId}
                    favorite={favoriteTemplateIds.includes(definition.id)}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function FloorWorkspaceCatalog({
  mode,
  onModeChange,
  equipmentOnly = false,
  allowedStructureTemplateIds = [],
  activeStructureTemplateId,
  activeEquipmentTemplateId,
  favoriteTemplateIds = [],
  floors = [],
  currentFloorId,
  targetFloorIds = [],
  onTargetFloorIdsChange,
  floorNavigator,
  onSelectStructureTemplate,
  onSelectEquipmentTemplate,
  onToggleFavorite,
}) {
  const [query, setQuery] = useState("");
  const [openCategoryIds, setOpenCategoryIds] = useState(["PLAN:SPACE", "EQUIPMENT:CABINET"]);
  const [recentTemplateIds, setRecentTemplateIds] = useState([]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const isEquipment = equipmentOnly || mode === CATALOG_MODES.EQUIPMENT;
  const templates = useMemo(() => (
    isEquipment
      ? UNIFIED_EQUIPMENT_TEMPLATES
      : WORLD_STRUCTURE_TEMPLATES.filter((template) => allowedStructureTemplateIds.includes(template.id))
  ).filter((template) => matchesQuery(template, normalizedQuery)), [allowedStructureTemplateIds, isEquipment, normalizedQuery]);
  const categories = useMemo(() => (isEquipment
    ? UNIFIED_EQUIPMENT_CATEGORIES
    : WORLD_STRUCTURE_GROUPS
  ).map((category) => ({
    ...category,
    definitions: templates.filter((template) => (isEquipment ? template.category : template.group) === category.id),
  })).filter((category) => category.definitions.length), [isEquipment, templates]);
  const activeTemplateId = isEquipment ? activeEquipmentTemplateId : activeStructureTemplateId;
  const recentTemplates = recentTemplateIds.map((id) => (
    isEquipment ? UNIFIED_EQUIPMENT_TEMPLATE_MAP[id] : WORLD_STRUCTURE_TEMPLATE_MAP[id]
  )).filter((template) => template && templates.some((item) => item.id === template.id)).slice(0, 5);

  function selectTemplate(templateId) {
    setRecentTemplateIds((ids) => [templateId, ...ids.filter((id) => id !== templateId)].slice(0, 8));
    if (isEquipment) onSelectEquipmentTemplate(templateId);
    else onSelectStructureTemplate(templateId);
  }

  function toggleCategory(categoryId) {
    const scopedId = `${mode}:${categoryId}`;
    setOpenCategoryIds((ids) => ids.includes(scopedId) ? ids.filter((id) => id !== scopedId) : [...ids, scopedId]);
  }

  return (
    <section className={`${objectStyles.library} ${styles.catalog}`} aria-label="배치할 오브젝트">
      {!equipmentOnly ? (
        <div className={styles.majorTabs} role="tablist" aria-label="오브젝트 대분류">
          <button type="button" role="tab" aria-selected={!isEquipment} className={!isEquipment ? styles.majorTabActive : ""} onClick={() => onModeChange(CATALOG_MODES.PLAN)}><WorldIcon size={17} />구조</button>
          <button type="button" role="tab" aria-selected={isEquipment} className={isEquipment ? styles.majorTabActive : ""} onClick={() => onModeChange(CATALOG_MODES.EQUIPMENT)}><EquipmentIcon size={17} />설비</button>
        </div>
      ) : null}

      <ObjectLibrarySearch value={query} resultCount={templates.length} onChange={setQuery} />

      {!isEquipment && floorNavigator ? (
        <details className={styles.floorConfiguration}>
          <summary><span>층 및 바닥</span><ChevronDownIcon size={15} /></summary>
          {floorNavigator}
        </details>
      ) : null}

      {isEquipment && floors.length ? (
        <fieldset className={styles.floorTargets}>
          <legend>설비 배치 대상 층</legend>
          <div>
            {floors.map((floor) => {
              const checked = floor.id === currentFloorId || targetFloorIds.includes(floor.id);
              return (
                <label key={floor.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={floor.id === currentFloorId}
                    onChange={(event) => onTargetFloorIdsChange?.(event.target.checked
                      ? [...targetFloorIds, floor.id]
                      : targetFloorIds.filter((id) => id !== floor.id))}
                  />
                  <span>{floor.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {activeTemplateId ? (
        <div className={`${objectStyles.activeObject} ${styles.activeTemplate}`}>
          <span className={`${objectStyles.preview} ${objectStyles.previewCompact}`} aria-hidden="true">
            {isEquipment
              ? <EquipmentTemplateIcon template={UNIFIED_EQUIPMENT_TEMPLATE_MAP[activeTemplateId]} size={18} />
              : <WorldStructureTypeIcon definition={WORLD_STRUCTURE_TEMPLATE_MAP[activeTemplateId]} size={18} />}
          </span>
          <span><small>현재 배치</small><strong>{templates.find((item) => item.id === activeTemplateId)?.nameKo ?? "배치 항목"}</strong></span>
          <kbd>ESC</kbd>
        </div>
      ) : null}

      {recentTemplates.length ? (
        <section className={styles.recent} aria-label="최근 사용 오브젝트">
          <header><strong>최근 사용</strong></header>
          <div>{recentTemplates.map((template) => (
            <button key={template.id} type="button" title={`${template.nameKo} 다시 배치`} onClick={() => selectTemplate(template.id)}>
              <ObjectModelThumbnail definition={template} title={template.nameKo} />
              <span>{template.nameKo}</span>
            </button>
          ))}</div>
        </section>
      ) : null}

      <div className={objectStyles.categories}>
        {categories.map((category) => {
          const scopedId = `${mode}:${category.id}`;
          return (
            <CatalogCategory
              key={category.id}
              category={category}
              definitions={category.definitions}
              domain={mode}
              activeTemplateId={activeTemplateId}
              favoriteTemplateIds={favoriteTemplateIds}
              open={Boolean(normalizedQuery) || openCategoryIds.includes(scopedId)}
              onToggle={() => toggleCategory(category.id)}
              onSelect={selectTemplate}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}
        {!categories.length ? <p className={objectStyles.empty}>일치하는 항목이 없습니다.</p> : null}
      </div>

    </section>
  );
}
