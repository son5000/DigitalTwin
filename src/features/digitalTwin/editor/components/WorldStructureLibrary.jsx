import { useMemo, useState } from "react";

import {
  WORLD_STRUCTURE_GROUPS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
  WORLD_STRUCTURE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import {
  ChevronDownIcon,
  EquipmentIcon,
  LockIcon,
  UnlockIcon,
  VisibilityIcon,
  WorldIcon,
  WorldStructureTypeIcon,
} from "@/components/icons";

import styles from "./WorldStructureLibrary.module.css";

const FILTER_LABELS = {
  FLOOR: "바닥",
  WALL: "벽",
  OPENING: "개구부",
  PARTITION: "칸막이",
  COLUMN: "기둥",
  PLATFORM: "플랫폼",
  BOUNDARY: "난간 / 펜스",
  VERTICAL: "계단 / 엘리베이터 / 샤프트",
  OTHER: "기타 구조물",
  EQUIPMENT: "설비",
};

export default function WorldStructureLibrary({
  activeTemplateId,
  structures,
  equipment,
  selectedStructureId,
  visibilityFilters,
  worldLocked,
  onSelectTemplate,
  onSelectStructure,
  onSelectEquipment,
  onToggleVisibility,
  onToggleWorldLock,
  activeRoomName = "현재 공간",
  showEquipment = false,
  allowedTemplateIds,
  title = "공간 구조물",
  eyebrow = "도면 편집 도구",
  badge = "월드",
  treeTitle = "월드 구조물",
  baseNodeLabel = "내부 공간",
  showLockControl = true,
}) {
  const [activeGroup, setActiveGroup] = useState("STRUCTURE");
  const templates = useMemo(
    () => WORLD_STRUCTURE_TEMPLATES.filter((item) => (
      item.group === activeGroup && (!allowedTemplateIds || allowedTemplateIds.includes(item.id))
    )),
    [activeGroup, allowedTemplateIds],
  );
  const availableGroups = useMemo(() => WORLD_STRUCTURE_GROUPS.filter((group) => (
    WORLD_STRUCTURE_TEMPLATES.some((item) => item.group === group.id && (!allowedTemplateIds || allowedTemplateIds.includes(item.id)))
  )), [allowedTemplateIds]);

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className={styles.worldBadge}>{badge}</span>
      </div>

      <label className={styles.groupSelect}>
        <span>도구 그룹</span>
        <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}>
          {availableGroups.map((group) => (
            <option key={group.id} value={group.id}>{group.nameKo}</option>
          ))}
        </select>
      </label>

      <div className={styles.tools}>
        {templates.map((definition) => (
            <button
              key={definition.id}
              type="button"
              className={activeTemplateId === definition.id ? styles.activeTool : ""}
              aria-pressed={activeTemplateId === definition.id}
              disabled={worldLocked}
              title={`${definition.nameKo} 배치`}
              onClick={() => onSelectTemplate(definition.id)}
            >
              <span aria-hidden="true"><WorldStructureTypeIcon definition={definition} size={25} /></span>
              <strong>{definition.nameKo}</strong>
              <small>{definition.placement ?? "구조물"}</small>
            </button>
        ))}
      </div>
      <details className={styles.filterSection}>
        <summary><span className={styles.summaryLabel}><VisibilityIcon size={16} /> 표시 필터</span><span>{Object.values(visibilityFilters).filter(Boolean).length}</span></summary>
        <div className={styles.filters}>
          {Object.entries(FILTER_LABELS).map(([filterId, label]) => (
            <label key={filterId}>
              <input type="checkbox" checked={visibilityFilters[filterId]} onChange={() => onToggleVisibility(filterId)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </details>

      {showLockControl ? <button
        type="button"
        className={`${styles.worldLock} ${worldLocked ? styles.worldLockActive : ""}`}
        aria-pressed={worldLocked}
        onClick={() => onToggleWorldLock(!worldLocked)}
      >
        {worldLocked ? <LockIcon size={17} /> : <UnlockIcon size={17} />}
        {worldLocked ? "월드 구조물 잠금 해제" : "월드 구조물 전체 잠금"}
      </button> : null}

      <div className={styles.tree}>
        <section>
          <h3><span>{treeTitle}</span><strong>{structures.length}</strong></h3>
          <button type="button" className={styles.baseNode} onClick={() => onSelectStructure(null)}>
            <span><ChevronDownIcon size={15} /><WorldIcon size={17} /> {activeRoomName}</span><small>{baseNodeLabel}</small>
          </button>
          {structures.map((structure) => (
              <button
                key={structure.id}
                type="button"
                className={selectedStructureId === structure.id ? styles.selectedNode : ""}
                onClick={() => onSelectStructure(structure.id)}
              >
                <span><WorldStructureTypeIcon definition={WORLD_STRUCTURE_TEMPLATE_MAP[structure.type]} size={17} /> {structure.name}</span>
                <small>{structure.locked ? "잠김" : WORLD_STRUCTURE_TEMPLATE_MAP[structure.type]?.nameKo ?? "구조물"}</small>
              </button>
          ))}
        </section>
        {showEquipment ? <section>
          <h3><span>설비</span><strong>{equipment.length}</strong></h3>
          {equipment.length === 0 ? (
            <p>배치된 설비가 없습니다.</p>
          ) : equipment.map((item) => (
            <button key={item.id} type="button" title="설비 편집 모드에서 선택할 수 있습니다" onClick={() => onSelectEquipment(item.id)}>
              <span><EquipmentIcon size={17} /> {item.name}</span><small>설비</small>
            </button>
          ))}
        </section> : null}
      </div>
    </section>
  );
}
