import { serializeTerrain } from "@/features/digitalTwin/editor/terrain/TerrainPersistence";

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
    version: 17,
    savedAt: new Date().toISOString(),
    hierarchy: layout.hierarchy,
    observationWorkflow: layout.observationWorkflow,
    siteEnvironment: {
      width: layout.siteEnvironment.width,
      depth: layout.siteEnvironment.depth,
      groundMaterial: layout.siteEnvironment.groundMaterial,
      backgroundTheme: layout.siteEnvironment.backgroundTheme,
      terrain: serializeTerrain(
        layout.siteEnvironment.terrain,
        layout.siteEnvironment.width,
        layout.siteEnvironment.depth,
        layout.siteEnvironment.groundMaterial,
      ),
    },
    sitePaths: layout.sitePaths ?? [],
    siteObjects: layout.siteObjects ?? [],
    gridSettings,
    roomScenes,
    floorPlansById: Object.fromEntries(Object.entries(layout.floorPlansById ?? {}).map(([floorId, plan]) => {
      const floorPlan = { ...plan };
      delete floorPlan.selectedSpatialEntity;
      return [floorId, floorPlan];
    })),
    verticalStructuresByBuildingId: layout.verticalStructuresByBuildingId ?? {},
    equipmentByFloorId: layout.equipmentByFloorId ?? {},
    equipmentAssetBindings: (layout.equipmentAssetBindings ?? []).map((binding) => {
      const sanitized = { ...binding };
      delete sanitized.objectUrl;
      if (sanitized.sourceType === "UPLOAD") sanitized.status = "MISSING_LOCAL_FILE";
      return sanitized;
    }),
    sensorBindings: layout.sensorBindings ?? [],
    observationPoints: layout.observationPoints ?? [],
    serverBindings: layout.serverBindings ?? [],
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
