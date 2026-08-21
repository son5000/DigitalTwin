import * as THREE from "three";

import { addEquipmentLabel, addGeometry, addTubeBetween } from "./generatorHelpers";

export function generatePipe({ type, dimensions, parameters, appearance, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const radius = (parameters.diameter ?? height) / 2;
  const elevation = Math.max(radius, 0.03);
  const group = new THREE.Group();
  const options = { appearance, edgeColor, showEdges };
  const point = (x, z) => new THREE.Vector3(x, elevation, z);

  if (type === "PIPE_ELBOW_90") {
    addTubeBetween(group, point(-width / 2, -depth / 2), point(0, -depth / 2), radius, options);
    addTubeBetween(group, point(0, -depth / 2), point(width / 2, depth / 2), radius, options);
  } else if (type === "PIPE_ELBOW_45") {
    addTubeBetween(group, point(-width / 2, -depth / 2), point(-width * 0.05, -depth / 2), radius, options);
    addTubeBetween(group, point(-width * 0.05, -depth / 2), point(width / 2, depth / 2), radius, options);
  } else if (type === "PIPE_T") {
    addTubeBetween(group, point(-width / 2, 0), point(width / 2, 0), radius, options);
    addTubeBetween(group, point(0, 0), point(0, depth / 2), radius, options);
  } else if (type === "PIPE_Y") {
    addTubeBetween(group, point(-width / 2, 0), point(0, 0), radius, options);
    addTubeBetween(group, point(0, 0), point(width / 2, depth / 2), radius, options);
    addTubeBetween(group, point(0, 0), point(width / 2, -depth / 2), radius, options);
  } else if (type === "FLEXIBLE_HOSE") {
    const curve = new THREE.CatmullRomCurve3([
      point(-width / 2, 0),
      point(-width / 4, depth / 2),
      point(width / 4, -depth / 2),
      point(width / 2, 0),
    ]);
    addGeometry(group, new THREE.TubeGeometry(curve, 32, radius, 10, false), options);
  } else {
    addTubeBetween(group, point(-width / 2, 0), point(width / 2, 0), radius, options);

    if (type === "PIPE_FLANGE" || type === "PIPE_CONNECTOR") {
      [-width * 0.28, width * 0.28].forEach((x) =>
        addGeometry(group, new THREE.CylinderGeometry(radius * 1.45, radius * 1.45, radius * 0.35, 20), {
          ...options,
          position: [x, elevation, 0],
          rotation: [0, 0, Math.PI / 2],
        }),
      );
    }

    if (type === "PIPE_VALVE") {
      addGeometry(group, new THREE.SphereGeometry(radius * 1.65, 18, 12), {
        ...options,
        position: [0, elevation, 0],
      });
      addGeometry(group, new THREE.TorusGeometry(radius * 1.4, radius * 0.18, 8, 20), {
        ...options,
        position: [0, elevation + radius * 3, 0],
        rotation: [Math.PI / 2, 0, 0],
      });
    }
  }

  addEquipmentLabel(group, label, Math.max(height, radius * 4), width, edgeColor, sceneTheme);
  return group;
}
