import { BUILDING_ENTITY_TYPES, getMassWorldPoints, normalizeBuildingAssembly, resolveConnectorPath } from "./buildingAssembly.js";

export const PYEONG_IN_SQUARE_METERS = 3.3058;

export function polygonArea(points = []) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
  }, 0)) / 2;
}

export function footprintArea(footprint) {
  return Math.max(0, polygonArea(footprint?.points) - (footprint?.holes ?? []).reduce((sum, hole) => sum + polygonArea(hole), 0));
}

export function sectionFloorCount(section) {
  return Math.max(0, Math.floor(section.endFloor) - Math.ceil(section.startFloor) + 1);
}

function sectionPoints(section) {
  const radians = Number(section.rotation || 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return section.footprint.points.map(({ x, z }) => ({
    x: x * cosine - z * sine + Number(section.offset?.x || 0),
    z: x * sine + z * cosine + Number(section.offset?.z || 0),
  }));
}

export function getFloorHeight(asset, floorNumber) {
  const level = asset.levels?.find((item) => item.floorNumber === floorNumber) ?? asset.levels?.[floorNumber - 1];
  if (level) return level.height;
  return asset.sections?.find((section) => floorNumber >= section.startFloor && floorNumber <= section.endFloor)?.floorHeight ?? asset.floorHeight ?? 3.6;
}

export function getFloorBaseElevation(asset, floorNumber) {
  const level = asset.levels?.find((item) => item.floorNumber === floorNumber) ?? asset.levels?.[floorNumber - 1];
  if (level) return level.baseElevation;
  let elevation = 0;
  for (let floor = 1; floor < floorNumber; floor += 1) elevation += getFloorHeight(asset, floor);
  return elevation;
}

function calculateAssemblyMetrics(asset) {
  const masses = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS);
  const connectors = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR);
  const massPoints = masses.flatMap(getMassWorldPoints);
  const connectorPoints = connectors.flatMap((connector) => resolveConnectorPath(asset, connector));
  const xs = [...massPoints.map((point) => point.x), ...connectorPoints.map((point) => point.x)];
  const zs = [...massPoints.map((point) => point.z), ...connectorPoints.map((point) => point.z)];
  const top = Math.max(0, ...asset.entities.map((entity) => Number(entity.verticalRange?.topElevation) || 0), ...asset.levels.map((level) => level.topElevation));
  const base = Math.min(0, ...asset.entities.map((entity) => Number(entity.verticalRange?.baseElevation) || 0));
  const totalMassArea = masses.reduce((sum, mass) => sum + footprintArea(mass.footprint) * Math.max(1, mass.levelIds.length), 0);
  const connectorArea = connectors.reduce((sum, connector) => {
    const points = resolveConnectorPath(asset, connector);
    const length = points.slice(1).reduce((value, point, index) => value + Math.hypot(point.x - points[index].x, point.z - points[index].z), 0);
    return sum + length * connector.width * Math.max(1, connector.levelIds.length);
  }, 0);
  const buildingAreaM2 = masses.filter((mass) => mass.verticalRange.baseElevation <= 0.01).reduce((sum, mass) => sum + footprintArea(mass.footprint), 0)
    || Math.max(0, ...masses.map((mass) => footprintArea(mass.footprint)));
  const totalFloorAreaM2 = totalMassArea + connectorArea;
  return {
    bounds: { width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0, depth: zs.length ? Math.max(...zs) - Math.min(...zs) : 0, height: top - base },
    metrics: { totalFloorAreaM2, totalFloorAreaPyeong: totalFloorAreaM2 / PYEONG_IN_SQUARE_METERS, buildingAreaM2, floorCount: asset.levels.length, massCount: masses.length, connectorCount: connectors.length },
  };
}

function calculateLegacyMetrics(asset) {
  const sections = asset.sections ?? [];
  const floorCount = Math.max(0, ...sections.map((section) => section.endFloor));
  const totalFloorAreaM2 = sections.reduce((sum, section) => sum + footprintArea(section.footprint) * sectionFloorCount(section), 0);
  const firstFloorSections = sections.filter((section) => section.startFloor <= 1 && section.endFloor >= 1);
  const buildingAreaM2 = firstFloorSections.reduce((sum, section) => sum + footprintArea(section.footprint), 0) || Math.max(0, ...sections.map((section) => footprintArea(section.footprint)));
  const points = sections.flatMap(sectionPoints);
  const xs = points.map((item) => item.x);
  const zs = points.map((item) => item.z);
  const height = Array.from({ length: floorCount }, (_, index) => getFloorHeight(asset, index + 1)).reduce((sum, value) => sum + value, 0);
  return { bounds: { width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0, depth: zs.length ? Math.max(...zs) - Math.min(...zs) : 0, height }, metrics: { totalFloorAreaM2, totalFloorAreaPyeong: totalFloorAreaM2 / PYEONG_IN_SQUARE_METERS, buildingAreaM2, floorCount, massCount: sections.length, connectorCount: 0 } };
}

export function calculateBuildingMetrics(source) {
  if (source.entities?.length || source.levels?.length) {
    const asset = normalizeBuildingAssembly(source);
    return calculateAssemblyMetrics(asset);
  }
  return calculateLegacyMetrics(source);
}

export function recalculateBuildingAsset(source) {
  const asset = normalizeBuildingAssembly(source);
  return { ...asset, ...calculateAssemblyMetrics(asset) };
}
