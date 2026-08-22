import { BuildingIcon, SiteTemplateIcon, WorldIcon } from "@/components/icons";
import { SITE_CREATION_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";

import styles from "./WorldHierarchyPanel.module.css";

export default function WorldHierarchyPanel({ buildings, siteObjects, selectedBuildingId, selectedSiteObjectId, onSelectBuilding, onSelectSiteObject }) {
  return (
    <section className={styles.panel} aria-label="월드 계층">
      <div className={styles.root}><WorldIcon size={18} /><div><strong>Digital Twin World</strong><span>{buildings.length + siteObjects.length} objects</span></div></div>
      <div className={styles.group}>
        <h3>핵심 건축물 <span>{buildings.length}</span></h3>
        {buildings.length === 0 ? <p>배치된 핵심 건축물이 없습니다.</p> : buildings.map((building) => (
          <button key={building.id} type="button" className={building.id === selectedBuildingId ? styles.selected : ""} onClick={() => onSelectBuilding(building.id)}><BuildingIcon size={17} /><span>{building.name}</span></button>
        ))}
      </div>
      <div className={styles.group}>
        <h3>환경·부지 오브젝트 <span>{siteObjects.length}</span></h3>
        {siteObjects.length === 0 ? <p>배치된 환경 오브젝트가 없습니다.</p> : siteObjects.map((object) => (
          <button key={object.id} type="button" className={object.id === selectedSiteObjectId ? styles.selected : ""} onClick={() => onSelectSiteObject(object.id)}><SiteTemplateIcon template={SITE_CREATION_TEMPLATE_MAP[object.type]} size={17} /><span>{object.name}</span></button>
        ))}
      </div>
    </section>
  );
}
