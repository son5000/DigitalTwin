import { useMemo, useState } from "react";

import {
  WORLD_STRUCTURE_GROUPS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
  WORLD_STRUCTURE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";

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
          <span>WORLD EDIT TOOLS</span>
          <h2>공간 구조물</h2>
        </div>
        <span className={styles.worldBadge}>WORLD</span>
      </div>

      <label className={styles.groupSelect}>
        <span>Tool Group</span>
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
            <span aria-hidden="true">{definition.icon}</span>
            <strong>{definition.nameKo}</strong>
            <small>{definition.name}</small>
          </button>
        ))}
      </div>
      <p className={styles.help}>도구를 선택한 뒤 장면의 기준 위치를 클릭하고 X / Y / Z로 배치합니다.</p>

      <details className={styles.filterSection}>
        <summary>Visibility Filter <span>{Object.values(visibilityFilters).filter(Boolean).length}</span></summary>
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
        {worldLocked ? "▣ World Structure 잠금 해제" : "□ World Structure 전체 잠금"}
      </button>

      <div className={styles.tree}>
        <section>
          <h3><span>WORLD STRUCTURE</span><strong>{structures.length}</strong></h3>
          <button type="button" className={styles.baseNode} onClick={() => onSelectStructure(null)}>
            <span>▾ Machine Room A</span><small>Base World</small>
          </button>
          {structures.map((structure) => (
            <button
              key={structure.id}
              type="button"
              className={selectedStructureId === structure.id ? styles.selectedNode : ""}
              onClick={() => onSelectStructure(structure.id)}
            >
              <span>{WORLD_STRUCTURE_TEMPLATE_MAP[structure.type]?.icon} {structure.name}</span>
              <small>{structure.locked ? "LOCKED" : structure.type}</small>
            </button>
          ))}
        </section>
        <section>
          <h3><span>EQUIPMENT</span><strong>{equipment.length}</strong></h3>
          {equipment.length === 0 ? (
            <p>배치된 Equipment가 없습니다.</p>
          ) : equipment.map((item) => (
            <button key={item.id} type="button" title="Equipment Edit Mode에서 선택 가능" onClick={() => onSelectEquipment(item.id)}>
              <span>◇ {item.name}</span><small>EQUIPMENT</small>
            </button>
          ))}
        </section>
      </div>
    </section>
  );
}
