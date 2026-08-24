const STORAGE_KEY = "digital-twin-editor-layout";

export function saveLayout(layout) {
  const roomScenes = Object.fromEntries(
    Object.entries(layout.roomScenes ?? {}).map(([roomId, scene]) => [
      roomId,
      {
        ...scene,
        detailAssets: (scene.detailAssets ?? []).map((asset) => {
          const sanitizedAsset = { ...asset };
          delete sanitizedAsset.objectUrl;
          return sanitizedAsset;
        }),
      },
    ]),
  );
  const gridSettings = { ...(layout.gridSettings ?? {}) };
  delete gridSettings.gridSize;
  delete gridSettings.siteSize;
  delete gridSettings.worldGridSize;
  const payload = {
    version: 11,
    savedAt: new Date().toISOString(),
    hierarchy: layout.hierarchy,
    siteEnvironment: {
      width: layout.siteEnvironment.width,
      depth: layout.siteEnvironment.depth,
      groundMaterial: layout.siteEnvironment.groundMaterial,
      backgroundTheme: layout.siteEnvironment.backgroundTheme,
    },
    sitePaths: layout.sitePaths ?? [],
    siteObjects: layout.siteObjects ?? [],
    gridSettings,
    roomScenes,
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
