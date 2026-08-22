import BuildingProperties from "./BuildingProperties";
import SiteObjectProperties from "./SiteObjectProperties";

export default function ObjectDetailPanel({
  building,
  siteObject,
  floorCount,
  onBuildingChange,
  onAddFloor,
  onSiteObjectChange,
  onDeleteSiteObject,
}) {
  if (building) {
    return (
      <BuildingProperties
        building={building}
        floorCount={floorCount}
        showEnterAction={false}
        onChange={onBuildingChange}
        onAddFloor={onAddFloor}
        onEnter={() => {}}
      />
    );
  }
  if (siteObject) {
    return <SiteObjectProperties object={siteObject} onChange={onSiteObjectChange} onDelete={onDeleteSiteObject} />;
  }
  return null;
}
