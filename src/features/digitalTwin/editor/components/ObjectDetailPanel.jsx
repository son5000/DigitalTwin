import BuildingProperties from "./BuildingProperties";
import SiteObjectProperties from "./SiteObjectProperties";

export default function ObjectDetailPanel({
  building,
  siteObject,
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
    return <SiteObjectProperties object={siteObject} onChange={onSiteObjectChange} onDelete={onDeleteSiteObject} />;
  }
  return null;
}
