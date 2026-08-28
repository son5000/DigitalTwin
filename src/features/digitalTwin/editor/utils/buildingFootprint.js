export function getBuildingFootprint(building) {
  const width = Math.max(5, Number(building?.parameters?.width) || 5);
  const depth = Math.max(5, Number(building?.parameters?.depth) || 5);
  return {
    width,
    depth,
    points: [
      { x: -width / 2, z: -depth / 2 },
      { x: width / 2, z: -depth / 2 },
      { x: width / 2, z: depth / 2 },
      { x: -width / 2, z: depth / 2 },
    ],
  };
}

function transformCustomRing(points, mass, scale) {
  const angle = Number(mass.transform?.rotationY ?? 0) * Math.PI / 180;
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  const position = mass.transform?.position ?? { x: 0, z: 0 };
  return (points ?? []).map((item) => ({
    x: (item.x * cosine - item.z * sine + Number(position.x || 0)) * (scale?.x ?? 1),
    z: (item.x * sine + item.z * cosine + Number(position.z || 0)) * (scale?.z ?? 1),
  }));
}

export function getBuildingFloorFootprintRegions(building, floorLevel = 1) {
  const direct = building?.floorFootprint ?? building?.parameters?.footprint;
  if (direct?.regions?.length) return direct.regions;
  if (direct?.points?.length) return [{ points: direct.points, holes: direct.holes ?? [] }];
  const asset = building?.customAssetSnapshot;
  const scale = building?.customAssetScale ?? { x: 1, z: 1 };
  if (asset?.entities?.length && asset?.levels?.length) {
    const level = asset.levels.find((item) => item.floorNumber === floorLevel) ?? asset.levels[floorLevel - 1];
    const masses = asset.entities.filter((entity) => entity.entityType === "MASS" && (!level || entity.levelIds?.includes(level.id)));
    if (masses.length) return masses.map((mass) => ({
      id: `INHERITED_${mass.id}`,
      points: transformCustomRing(mass.footprint?.points, mass, scale),
      holes: (mass.footprint?.holes ?? []).map((hole) => transformCustomRing(hole, mass, scale)),
    }));
  }
  const sections = (asset?.sections ?? []).filter((section) => floorLevel >= section.startFloor && floorLevel <= section.endFloor);
  if (sections.length) return sections.map((section) => {
    const mass = { transform: { position: section.offset, rotationY: section.rotation } };
    return {
      id: `INHERITED_${section.id ?? floorLevel}`,
      points: transformCustomRing(section.footprint?.points, mass, scale),
      holes: (section.footprint?.holes ?? []).map((hole) => transformCustomRing(hole, mass, scale)),
    };
  });
  return [{ id: "INHERITED_BUILDING", points: getBuildingFootprint(building).points, holes: [] }];
}

export function isPointInsideFootprint(point, footprint) {
  let inside = false;
  const points = footprint?.points ?? [];
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const intersects = ((currentPoint.z > point.z) !== (previousPoint.z > point.z))
      && point.x < (previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)
        / ((previousPoint.z - currentPoint.z) || Number.EPSILON) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
