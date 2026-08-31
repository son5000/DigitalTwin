import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";

const SNAP_DISTANCE = 0.4;

function rotatePoint(point, rotationY) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);

  return {
    x: point.x * cosine + point.z * sine,
    z: -point.x * sine + point.z * cosine,
  };
}

function getLocalConnectionPoints(equipment) {
  const { width, depth } = equipment.dimensions;
  const shapeId = equipment.shapeTemplateId;

  if (shapeId === "PIPE_ELBOW_90") {
    const radius = equipment.parameters.bendRadius ?? Math.max(width, depth);
    return [
      { id: "A", x: -radius / 2, z: -radius / 2, angle: Math.PI },
      { id: "B", x: radius / 2, z: radius / 2, angle: Math.PI / 2 },
    ];
  }

  if (shapeId === "PIPE_ELBOW_45") {
    return [
      { id: "A", x: -width / 2, z: -depth / 2, angle: Math.PI },
      { id: "B", x: width / 2, z: depth / 2, angle: Math.PI / 4 },
    ];
  }

  if (shapeId === "PIPE_T") {
    return [
      { id: "A", x: -width / 2, z: 0, angle: Math.PI },
      { id: "B", x: width / 2, z: 0, angle: 0 },
      { id: "C", x: 0, z: depth / 2, angle: Math.PI / 2 },
    ];
  }

  if (shapeId === "PIPE_Y") {
    return [
      { id: "A", x: -width / 2, z: 0, angle: Math.PI },
      { id: "B", x: width / 2, z: depth / 2, angle: Math.PI / 4 },
      { id: "C", x: width / 2, z: -depth / 2, angle: -Math.PI / 4 },
    ];
  }

  return [
    { id: "A", x: -width / 2, z: 0, angle: Math.PI },
    { id: "B", x: width / 2, z: 0, angle: 0 },
  ];
}

export function isPipeEquipment(equipment) {
  return UNIFIED_EQUIPMENT_TEMPLATE_MAP[equipment?.shapeTemplateId]?.floorCategory === "PIPE";
}

export function getEquipmentConnectionPoints(equipment) {
  if (!isPipeEquipment(equipment)) return [];

  return getLocalConnectionPoints(equipment).map((point) => {
    const position = rotatePoint(point, equipment.rotation.y);

    return {
      ...point,
      equipmentId: equipment.id,
      x: equipment.position.x + position.x,
      y: equipment.position.y + Math.max(0.06, equipment.dimensions.height / 2),
      z: equipment.position.z + position.z,
      worldAngle: point.angle - equipment.rotation.y,
    };
  });
}

export function findPipeSnapCandidate(movingEquipment, equipmentInstances, connections) {
  if (!isPipeEquipment(movingEquipment)) return null;

  const usedPoints = new Set(
    connections.flatMap((connection) => [
      `${connection.fromEquipmentId}:${connection.fromPointId}`,
      `${connection.toEquipmentId}:${connection.toPointId}`,
    ]),
  );
  let closestCandidate = null;

  getEquipmentConnectionPoints(movingEquipment).forEach((movingPoint) => {
    if (usedPoints.has(`${movingEquipment.id}:${movingPoint.id}`)) return;

    equipmentInstances.forEach((targetEquipment) => {
      if (targetEquipment.id === movingEquipment.id || !isPipeEquipment(targetEquipment)) return;

      getEquipmentConnectionPoints(targetEquipment).forEach((targetPoint) => {
        if (usedPoints.has(`${targetEquipment.id}:${targetPoint.id}`)) return;

        const distance = Math.hypot(
          movingPoint.x - targetPoint.x,
          movingPoint.y - targetPoint.y,
          movingPoint.z - targetPoint.z,
        );
        if (distance <= SNAP_DISTANCE && (!closestCandidate || distance < closestCandidate.distance)) {
          closestCandidate = { movingPoint, targetPoint, distance };
        }
      });
    });
  });

  return closestCandidate;
}

export function resolvePipeSnap(equipment, candidate) {
  const localPoint = getLocalConnectionPoints(equipment).find(
    (point) => point.id === candidate.movingPoint.id,
  );
  const rotationY = localPoint.angle - (candidate.targetPoint.worldAngle + Math.PI);
  const offset = rotatePoint(localPoint, rotationY);

  return {
    position: {
      x: candidate.targetPoint.x - offset.x,
      y: candidate.targetPoint.y - Math.max(0.06, equipment.dimensions.height / 2),
      z: candidate.targetPoint.z - offset.z,
    },
    rotation: { ...equipment.rotation, y: rotationY },
  };
}
