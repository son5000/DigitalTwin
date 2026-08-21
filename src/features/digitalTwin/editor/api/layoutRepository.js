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
  const payload = {
    version: 8,
    savedAt: new Date().toISOString(),
    hierarchy: layout.hierarchy,
    sitePaths: layout.sitePaths ?? [],
    siteObjects: layout.siteObjects ?? [],
    gridSettings: layout.gridSettings,
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
