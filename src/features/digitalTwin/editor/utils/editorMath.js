const MIN_DIMENSION = 0.1;

export function clampDimension(value) {
  return Math.max(MIN_DIMENSION, Number(value) || MIN_DIMENSION);
}

export function snapValue(value, snapSize) {
  if (!snapSize) {
    return value;
  }

  return Math.round(value / snapSize) * snapSize;
}

export function clampPositionToWorld(position, dimensions, world) {
  const xLimit = Math.max(0, world.width / 2 - dimensions.width / 2);
  const zLimit = Math.max(0, world.depth / 2 - dimensions.depth / 2);

  return {
    x: Math.min(xLimit, Math.max(-xLimit, position.x)),
    y: position.y,
    z: Math.min(zLimit, Math.max(-zLimit, position.z)),
  };
}

function getAxisAlignedBounds(equipment) {
  const angle = equipment.rotation.y;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const halfWidth =
    (equipment.dimensions.width * cosine + equipment.dimensions.depth * sine) /
    2;
  const halfDepth =
    (equipment.dimensions.width * sine + equipment.dimensions.depth * cosine) /
    2;

  return {
    minX: equipment.position.x - halfWidth,
    maxX: equipment.position.x + halfWidth,
    minY: equipment.position.y,
    maxY: equipment.position.y + equipment.dimensions.height,
    minZ: equipment.position.z - halfDepth,
    maxZ: equipment.position.z + halfDepth,
  };
}

function boundsIntersect(first, second) {
  return !(
    first.maxX <= second.minX ||
    first.minX >= second.maxX ||
    first.maxY <= second.minY ||
    first.minY >= second.maxY ||
    first.maxZ <= second.minZ ||
    first.minZ >= second.maxZ
  );
}

export function findCollidingEquipmentIds(equipmentInstances) {
  const collisionIds = new Set();

  for (let firstIndex = 0; firstIndex < equipmentInstances.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < equipmentInstances.length;
      secondIndex += 1
    ) {
      const first = equipmentInstances[firstIndex];
      const second = equipmentInstances[secondIndex];

      if (
        boundsIntersect(
          getAxisAlignedBounds(first),
          getAxisAlignedBounds(second),
        )
      ) {
        collisionIds.add(first.id);
        collisionIds.add(second.id);
      }
    }
  }

  return collisionIds;
}

export function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
