export const BUILDING_SETTING_STATUS = Object.freeze({
  UNSET: "UNSET",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "COMPLETE",
});

export const BUILDING_SETTINGS_TABS = Object.freeze({
  EXTERIOR: "EXTERIOR",
  INTERIOR: "INTERIOR",
});

export const BUILDING_VIEW_MODES = Object.freeze({
  EXTERIOR: "EXTERIOR",
  INTERIOR: "INTERIOR",
});

export const DEFAULT_BUILDING_SETTING_STATUS = Object.freeze({
  exterior: BUILDING_SETTING_STATUS.UNSET,
  interiorBasics: BUILDING_SETTING_STATUS.UNSET,
});

export function getBuildingSettingStatus(building, tab) {
  const key = tab === BUILDING_SETTINGS_TABS.INTERIOR ? "interiorBasics" : "exterior";
  return building?.settingStatus?.[key] ?? BUILDING_SETTING_STATUS.UNSET;
}

export function getOverallBuildingSettingStatus(building) {
  const exterior = getBuildingSettingStatus(building, BUILDING_SETTINGS_TABS.EXTERIOR);
  const interior = getBuildingSettingStatus(building, BUILDING_SETTINGS_TABS.INTERIOR);
  if (exterior === BUILDING_SETTING_STATUS.COMPLETE && interior === BUILDING_SETTING_STATUS.COMPLETE) {
    return BUILDING_SETTING_STATUS.COMPLETE;
  }
  if (exterior !== BUILDING_SETTING_STATUS.UNSET || interior !== BUILDING_SETTING_STATUS.UNSET) {
    return BUILDING_SETTING_STATUS.IN_PROGRESS;
  }
  return BUILDING_SETTING_STATUS.UNSET;
}
