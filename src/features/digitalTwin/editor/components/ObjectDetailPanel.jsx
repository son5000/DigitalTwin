import BuildingProperties from "./BuildingProperties";
import SiteObjectProperties from "./SiteObjectProperties";

export default function ObjectDetailPanel({
  building,
  siteObject,
  floorCount,
  buildingSettingsTab,
  floorPlanSummary,
  onBuildingSettingsTabChange,
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
        activeTab={buildingSettingsTab}
        floorPlanSummary={floorPlanSummary}
        onTabChange={onBuildingSettingsTabChange}
        showEnterAction={false}
        onChange={onBuildingChange}
        onOpenFloorPlans={onOpenFloorPlans}
        onEnter={() => {}}
      />
    );
  }
  if (siteObject) {
    return <SiteObjectProperties object={siteObject} onChange={onSiteObjectChange} onDelete={onDeleteSiteObject} />;
  }
  return null;
}
