import BuildingProperties from "./BuildingProperties";
import SiteObjectProperties from "./SiteObjectProperties";

export default function ObjectDetailPanel({
  building,
  siteObject,
  siteEnvironment,
  siteObjects,
  floorCount,
  floorPlanSummary,
  onBuildingChange,
  onOpenFloorPlans,
  onSiteObjectChange,
  onDeleteSiteObject,
}) {
  if (building) {
    return (
      <BuildingProperties
        building={building}
        floorCount={floorCount}
        floorPlanSummary={floorPlanSummary}
        onChange={onBuildingChange}
        onOpenFloorPlans={onOpenFloorPlans}
      />
    );
  }
  if (siteObject) {
    return <SiteObjectProperties object={siteObject} siteEnvironment={siteEnvironment} siteObjects={siteObjects} onChange={onSiteObjectChange} onDelete={onDeleteSiteObject} />;
  }
  return null;
}
