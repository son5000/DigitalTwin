import { useMemo, useState } from "react";

import { BuildingIcon, SiteTemplateIcon, WorldIcon } from "@/components/icons";
import { SITE_CREATION_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";

import styles from "./WorldHierarchyPanel.module.css";

const SORT_OPTIONS = Object.freeze([
  { value: "PLACEMENT", label: "배치순" },
  { value: "NAME", label: "이름순" },
  { value: "TYPE", label: "유형순" },
]);

function sortObjects(objects, sortMode, getType) {
  if (sortMode === "PLACEMENT") return objects;
  return [...objects].sort((left, right) => {
    const leftValue = sortMode === "TYPE" ? getType(left) : left.name;
    const rightValue = sortMode === "TYPE" ? getType(right) : right.name;
    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "ko");
  });
}

export default function WorldHierarchyPanel({ buildings, siteObjects, selectedBuildingId, selectedSiteObjectId, onSelectBuilding, onSelectSiteObject }) {
  const [sortMode, setSortMode] = useState("PLACEMENT");
  const sortedBuildings = useMemo(
    () => sortObjects(buildings, sortMode, (building) => building.templateId),
    [buildings, sortMode],
  );
  const sortedSiteObjects = useMemo(
    () => sortObjects(siteObjects, sortMode, (object) => SITE_CREATION_TEMPLATE_MAP[object.type]?.name ?? object.type),
    [siteObjects, sortMode],
  );

  return (
    <section className={styles.panel} aria-label="오브젝트 목록">
      <div className={styles.root}>
        <WorldIcon size={18} />
        <div><strong>전체 오브젝트</strong><span>{buildings.length + siteObjects.length}개</span></div>
        <label className={styles.sortField}>
          <span>정렬</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.group}>
        <h3>건축물 <span>{buildings.length}</span></h3>
        {sortedBuildings.length === 0 ? <p>배치된 건축물이 없습니다.</p> : sortedBuildings.map((building) => (
          <button key={building.id} type="button" aria-pressed={building.id === selectedBuildingId} className={building.id === selectedBuildingId ? styles.selected : ""} onClick={() => onSelectBuilding(building.id)}><BuildingIcon size={17} /><span>{building.name}</span></button>
        ))}
      </div>
      <div className={styles.group}>
        <h3>환경 오브젝트 <span>{siteObjects.length}</span></h3>
        {sortedSiteObjects.length === 0 ? <p>배치된 환경 오브젝트가 없습니다.</p> : sortedSiteObjects.map((object) => (
          <button key={object.id} type="button" aria-pressed={object.id === selectedSiteObjectId} className={object.id === selectedSiteObjectId ? styles.selected : ""} onClick={() => onSelectSiteObject(object.id)}><SiteTemplateIcon template={SITE_CREATION_TEMPLATE_MAP[object.type]} size={17} /><span>{object.name}</span></button>
        ))}
      </div>
    </section>
  );
}
