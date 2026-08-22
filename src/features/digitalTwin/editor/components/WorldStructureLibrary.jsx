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
  FLOOR: "Floor",
  WALL: "Wall",
  OPENING: "Opening",
  PARTITION: "Partition",
  COLUMN: "Column",
  PLATFORM: "Platform",
  BOUNDARY: "Railing / Fence",
  OTHER: "Other World",
  EQUIPMENT: "Equipment",
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
}) {
  const [activeGroup, setActiveGroup] = useState("STRUCTURE");
  const templates = useMemo(
    () => WORLD_STRUCTURE_TEMPLATES.filter((item) => item.group === activeGroup),
    [activeGroup],
  );

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span>월드 편집 도구</span>
          <h2>공간 구조물</h2>
        </div>
        <span className={styles.worldBadge}>월드</span>
      </div>

      <label className={styles.groupSelect}>
        <span>도구 그룹</span>
        <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}>
          {WORLD_STRUCTURE_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>{group.nameKo} · {group.name}</option>
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
              title={`${definition.nameKo} (${definition.name}) 배치`}
              onClick={() => onSelectTemplate(definition.id)}
            >
              <span aria-hidden="true"><WorldStructureTypeIcon definition={definition} size={25} /></span>
              <strong>{definition.nameKo}</strong>
              <small>{definition.name}</small>
            </button>
        ))}
      </div>
      <p className={styles.help}>도구를 선택한 뒤 장면의 기준 위치를 클릭하고 X / Y / Z로 배치합니다.</p>

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

      <button
        type="button"
        className={`${styles.worldLock} ${worldLocked ? styles.worldLockActive : ""}`}
        aria-pressed={worldLocked}
        onClick={() => onToggleWorldLock(!worldLocked)}
      >
        {worldLocked ? <LockIcon size={17} /> : <UnlockIcon size={17} />}
        {worldLocked ? "World Structure 잠금 해제" : "World Structure 전체 잠금"}
      </button>

      <div className={styles.tree}>
        <section>
          <h3><span>월드 구조물</span><strong>{structures.length}</strong></h3>
          <button type="button" className={styles.baseNode} onClick={() => onSelectStructure(null)}>
            <span><ChevronDownIcon size={15} /><WorldIcon size={17} /> 기계실 A</span><small>기본 월드</small>
          </button>
          {structures.map((structure) => (
              <button
                key={structure.id}
                type="button"
                className={selectedStructureId === structure.id ? styles.selectedNode : ""}
                onClick={() => onSelectStructure(structure.id)}
              >
                <span><WorldStructureTypeIcon definition={WORLD_STRUCTURE_TEMPLATE_MAP[structure.type]} size={17} /> {structure.name}</span>
                <small>{structure.locked ? "LOCKED" : structure.type}</small>
              </button>
          ))}
        </section>
        <section>
          <h3><span>설비</span><strong>{equipment.length}</strong></h3>
          {equipment.length === 0 ? (
            <p>배치된 설비가 없습니다.</p>
          ) : equipment.map((item) => (
            <button key={item.id} type="button" title="Equipment Edit Mode에서 선택 가능" onClick={() => onSelectEquipment(item.id)}>
              <span><EquipmentIcon size={17} /> {item.name}</span><small>설비</small>
            </button>
          ))}
        </section>
      </div>
    </section>
  );
}
