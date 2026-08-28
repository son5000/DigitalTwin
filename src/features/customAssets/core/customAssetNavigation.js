export function navigateTo(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function getCustomBuildingEditPath(assetId) {
  return `/custom/buildings/${encodeURIComponent(assetId)}/edit`;
}
