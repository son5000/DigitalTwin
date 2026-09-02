import BuildingProperties from "./BuildingProperties";
import SiteObjectProperties from "./SiteObjectProperties";

export default function ObjectDetailPanel({
  building,
  siteObject,
  siteEnvironment,
  siteObjects,
  buildings,
  floors,
  floorCount,
  floorPlanSummary,
  onBuildingChange,
  onOpenFloorPlans,
  onSiteObjectChange,
  onDeleteSiteObject,
  onMovementEditStart,
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
    return <SiteObjectProperties object={siteObject} siteEnvironment={siteEnvironment} siteObjects={siteObjects} buildings={buildings} floors={floors} onChange={onSiteObjectChange} onDelete={onDeleteSiteObject} onMovementEditStart={onMovementEditStart} />;
  }
  return null;
}
