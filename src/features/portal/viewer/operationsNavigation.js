import { SERVICE_TITLES } from "./operationsModel.js";

export function getOperationsSection(pathname) {
  const match = pathname.match(/^\/viewer\/operations(?:\/([^/]+))?\/?$/);
  const section = match?.[1] ?? (match ? "assets" : null);
  return Object.hasOwn(SERVICE_TITLES, section) ? section : null;
}

export function getViewerServicePath(section, search = "") {
  const projectId = new URLSearchParams(search).get("project");
  const query = projectId ? `?${new URLSearchParams({ project: projectId })}` : "";
  const path = section && Object.hasOwn(SERVICE_TITLES, section)
    ? `/viewer/operations/${section}` : "/viewer";
  return path + query;
}

export function navigateViewerService(section, record = null) {
  const path = getViewerServicePath(section, window.location.search);
  if (window.location.pathname + window.location.search === path && !record) return;
  window.history.pushState({ operationsRecord: record }, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
