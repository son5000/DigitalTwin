const STORAGE_KEY = "digital-twin-editor-layout";

export function saveLayout(layout) {
  const payload = {
    version: 4,
    savedAt: new Date().toISOString(),
    world: layout.world,
    equipment: layout.equipmentInstances,
    worldStructures: layout.worldStructures ?? [],
    worldStructuresLocked: layout.worldStructuresLocked ?? false,
    visibilityFilters: layout.visibilityFilters ?? {},
    pipeConnections: layout.pipeConnections ?? [],
    detailAssets: (layout.detailAssets ?? []).map((asset) => {
      const sanitizedAsset = { ...asset };
      delete sanitizedAsset.objectUrl;
      return sanitizedAsset;
    }),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  return payload;
}

export function loadLayout() {
  const savedLayout = localStorage.getItem(STORAGE_KEY);

  if (!savedLayout) {
    return null;
  }

  return JSON.parse(savedLayout);
}
