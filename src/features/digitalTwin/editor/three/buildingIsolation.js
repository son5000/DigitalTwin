function visibilityOf(object) {
  return object?.visible ?? true;
}

export function captureBuildingIsolationVisibility(runtime) {
  return {
    buildingVisibility: new Map([...runtime.buildingObjects].map(([id, object]) => [id, object.visible])),
    siteObjectVisibility: new Map([...runtime.siteEnvironmentObjects].map(([id, object]) => [id, object.visible])),
    siteConnectionVisible: visibilityOf(runtime.siteConnectionRoot),
    groundVisible: visibilityOf(runtime.ground),
    gridVisible: visibilityOf(runtime.grid),
    gridRegionVisible: visibilityOf(runtime.gridRegionRoot),
  };
}

export function applyBuildingIsolationVisibility(runtime, state, selectedBuildingId) {
  runtime.buildingObjects.forEach((object, id) => {
    if (!state.buildingVisibility.has(id)) state.buildingVisibility.set(id, object.visible);
    object.visible = id === selectedBuildingId;
  });
  runtime.siteEnvironmentObjects.forEach((object, id) => {
    if (!state.siteObjectVisibility.has(id)) state.siteObjectVisibility.set(id, object.visible);
    object.visible = false;
  });
  runtime.siteConnectionRoot.visible = false;
  runtime.ground.visible = false;
  runtime.grid.visible = false;
  runtime.gridRegionRoot.visible = false;
}

export function restoreBuildingIsolationVisibility(runtime, state) {
  runtime.buildingObjects.forEach((object, id) => {
    object.visible = state.buildingVisibility.get(id) ?? object.visible;
  });
  runtime.siteEnvironmentObjects.forEach((object, id) => {
    object.visible = state.siteObjectVisibility.get(id) ?? object.visible;
  });
  runtime.siteConnectionRoot.visible = state.siteConnectionVisible;
  runtime.ground.visible = state.groundVisible;
  runtime.grid.visible = state.gridVisible;
  runtime.gridRegionRoot.visible = state.gridRegionVisible;
}
