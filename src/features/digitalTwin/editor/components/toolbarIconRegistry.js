const TOOLBAR_ICON_BASE = "/assets/toolbar-icons";

export const TOOLBAR_ICON_KEYS = Object.freeze([
  "select", "navigate", "move", "move-off", "move-planar", "rotate",
  "transparency", "isolate", "hide-surroundings", "shadow", "high-detail",
  "floor-spacing", "floor-select", "path-edit", "play", "pause", "stop",
  "ground-visible", "ground-translucent", "ground-section", "ground-hidden",
  "undo", "redo", "objects", "object-list", "terrain", "settings", "details",
  "snap", "more", "duplicate", "delete", "reset", "import", "save", "world",
  "equipment", "viewer", "layout-2d", "view-3d", "lock", "unlock", "area-select",
]);

const keySet = new Set(TOOLBAR_ICON_KEYS);

const sourcesFor = (iconKey) => ({
  light: `${TOOLBAR_ICON_BASE}/light/${iconKey}.png`,
  dark: `${TOOLBAR_ICON_BASE}/dark/${iconKey}.png`,
});

export const TOOLBAR_ICON_FALLBACK = Object.freeze(sourcesFor("fallback"));

export function getToolbarIconSources(iconKey) {
  return sourcesFor(keySet.has(iconKey) ? iconKey : "fallback");
}

export function applyToolbarIconFallback(event, theme) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = TOOLBAR_ICON_FALLBACK[theme];
}

export function preloadToolbarIcons() {
  if (typeof Image === "undefined") return;
  for (const iconKey of [...TOOLBAR_ICON_KEYS, "fallback"]) {
    const sources = sourcesFor(iconKey);
    for (const source of Object.values(sources)) {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    }
  }
}

preloadToolbarIcons();
