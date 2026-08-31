import { useMemo, useState } from "react";

import {
  EquipmentTemplateIcon,
  VisibilityIcon,
  WorldStructureTypeIcon,
} from "@/components/icons";
import { ObjectLibrarySearch } from "@/features/digitalTwin/editor/components/ObjectLibrary";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import { WORLD_STRUCTURE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { STAIR_SCOPES } from "@/features/digitalTwin/editor/utils/stairStructure";

import objectStyles from "./ObjectLibrary/ObjectLibrary.module.css";
import styles from "./FloorObjectList.module.css";

const FILTER_LABELS = {
  FLOOR: "바닥",
  WALL: "벽",
  OPENING: "개구부",
  PARTITION: "구획",
  COLUMN: "기둥",
  PLATFORM: "플랫폼",
  BOUNDARY: "경계",
  VERTICAL: "수직 연결",
  OTHER: "기타 구조",
  EQUIPMENT: "설비",
};

function includesQuery(item, query) {
  if (!query) return true;
  return [item.name, item.type, item.shapeTemplateId].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(query);
}

function getStructureFloorLabel(structure, floorNameById) {
  if (structure.type !== "STAIR") return structure.floorId ? floorNameById[structure.floorId] : "다층";
  if (structure.scope === STAIR_SCOPES.ALL_FLOORS) return "모든 층 · 층별 인스턴스";
  if (structure.scope === STAIR_SCOPES.CONNECTING) return `${floorNameById[structure.fromFloorId] ?? "시작층"} → ${floorNameById[structure.toFloorId] ?? "종료층"}`;
  return floorNameById[structure.floorId] ?? "층 미지정";
}

export default function FloorObjectList({
  floors = [],
  structures = [],
  equipment = [],
  selectedStructureId,
  selectedEquipmentId,
  visibilityFilters,
  onSelectStructure,
  onSelectEquipment,
  onToggleVisibility,
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const floorNameById = useMemo(() => Object.fromEntries(floors.map((floor) => [floor.id, floor.name])), [floors]);
  const visibleStructures = useMemo(() => structures.filter((item) => includesQuery(item, normalizedQuery)), [normalizedQuery, structures]);
  const visibleEquipment = useMemo(() => equipment.filter((item) => includesQuery(item, normalizedQuery)), [equipment, normalizedQuery]);
  const resultCount = visibleStructures.length + visibleEquipment.length;

  return (
    <section className={`${objectStyles.library} ${styles.list}`} aria-label="배치된 오브젝트 목록">
      <ObjectLibrarySearch value={query} resultCount={resultCount} onChange={setQuery} />

      <section className={styles.group} aria-labelledby="placed-structure-title">
        <header><strong id="placed-structure-title">구조</strong><span>{visibleStructures.length}</span></header>
        <div className={styles.items}>
          {visibleStructures.map((structure) => (
            <button key={structure.id} type="button" className={selectedStructureId === structure.id ? styles.active : ""} aria-pressed={selectedStructureId === structure.id} onClick={() => onSelectStructure(structure)}>
              <span className={styles.icon}><WorldStructureTypeIcon definition={WORLD_STRUCTURE_TEMPLATE_MAP[structure.type]} size={17} /></span>
              <span>{structure.name}</span>
              <small>{getStructureFloorLabel(structure, floorNameById)}</small>
            </button>
          ))}
          {!visibleStructures.length ? <p>구조 오브젝트 없음</p> : null}
        </div>
      </section>

      <section className={styles.group} aria-labelledby="placed-equipment-title">
        <header><strong id="placed-equipment-title">설비</strong><span>{visibleEquipment.length}</span></header>
        <div className={styles.items}>
          {visibleEquipment.map((item) => (
            <button key={item.id} type="button" className={selectedEquipmentId === item.id ? styles.active : ""} aria-pressed={selectedEquipmentId === item.id} onClick={() => onSelectEquipment(item)}>
              <span className={styles.icon}><EquipmentTemplateIcon template={UNIFIED_EQUIPMENT_TEMPLATE_MAP[item.shapeTemplateId]} size={17} /></span>
              <span>{item.name}</span>
              <small>{floorNameById[item.floorId] ?? "층 미지정"}</small>
            </button>
          ))}
          {!visibleEquipment.length ? <p>설비 오브젝트 없음</p> : null}
        </div>
      </section>

      <details className={styles.filters}>
        <summary><span><VisibilityIcon size={15} /> 표시 필터</span><strong>{Object.values(visibilityFilters).filter(Boolean).length}</strong></summary>
        <div>
          {Object.entries(FILTER_LABELS).map(([filterId, label]) => (
            <label key={filterId}><input type="checkbox" checked={visibilityFilters[filterId]} onChange={() => onToggleVisibility(filterId)} /><span>{label}</span></label>
          ))}
        </div>
      </details>
    </section>
  );
}
