import { cloneFloorSpatialPlanForFloor, getFloorFootprintBounds, getFloorHeightAtPoint } from "../model/floorSpatialModel";
import { getTerrainVertexPosition, normalizeTerrainModel } from "./TerrainModel";

export function getFloorTerrainEnvironment(plan, siteEnvironment = {}) {
  const bounds = plan?.floorFootprint?.regions?.length ? getFloorFootprintBounds(plan.floorFootprint) : { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const width = Math.max(1, Math.abs(bounds.minX) * 2, Math.abs(bounds.maxX) * 2);
  const depth = Math.max(1, Math.abs(bounds.minZ) * 2, Math.abs(bounds.maxZ) * 2);
  const terrain = normalizeTerrainModel(plan?.terrain ?? { resolution: 1, color: plan?.floorStyle?.color ?? "#7f929b" }, width, depth);
  if (!plan?.terrain) {
    terrain.elevations = terrain.elevations.map((_, index) => getFloorHeightAtPoint(plan?.elevationZones, getTerrainVertexPosition(terrain, index % terrain.columns, Math.floor(index / terrain.columns))));
  }
  return { ...siteEnvironment, width, depth, groundMaterial: terrain.material, terrain, footprintRegions: plan?.floorFootprint?.regions };
}

export function applyFloorTerrainToRange(plans, floors, sourceFloorId, startFloorId, endFloorId, sourcePlan) {
  const source = floors.find((floor) => floor.id === sourceFloorId);
  const start = floors.find((floor) => floor.id === startFloorId && floor.parentId === source?.parentId);
  const end = floors.find((floor) => floor.id === endFloorId && floor.parentId === source?.parentId);
  if (!source || !start || !end) return plans;
  const min = Math.min(Number(start.level), Number(end.level)), max = Math.max(Number(start.level), Number(end.level));
  const environment = getFloorTerrainEnvironment(sourcePlan);
  const next = { ...plans };
  floors.filter((floor) => floor.parentId === source.parentId && Number(floor.level) >= min && Number(floor.level) <= max).forEach((floor) => {
    const footprint = floor.id === sourceFloorId ? structuredClone(sourcePlan.floorFootprint)
      : cloneFloorSpatialPlanForFloor({ floorFootprint: { ...sourcePlan.floorFootprint, mode: "CUSTOM" } }, undefined, floor.id).floorFootprint;
    next[floor.id] = { ...plans[floor.id], floorId: floor.id, structures: plans[floor.id]?.structures ?? [],
      floorFootprint: footprint, terrain: structuredClone(environment.terrain),
      floorStyle: structuredClone(sourcePlan.floorStyle) };
  });
  return next;
}
