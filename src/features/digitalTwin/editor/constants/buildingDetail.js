export const BUILDING_SETTING_STATUS = Object.freeze({
  UNSET: "UNSET",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "COMPLETE",
});

export const DEFAULT_BUILDING_SETTING_STATUS = BUILDING_SETTING_STATUS.UNSET;

export function getOverallBuildingSettingStatus(building) {
  return Object.values(BUILDING_SETTING_STATUS).includes(building?.settingStatus)
    ? building.settingStatus
    : BUILDING_SETTING_STATUS.UNSET;
}
