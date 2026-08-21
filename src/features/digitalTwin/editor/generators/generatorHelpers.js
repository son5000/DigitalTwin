import * as THREE from "three";

import { colorToCss } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { createTextSprite } from "@/features/digitalTwin/editor/objects/createTextSprite";

export function createSurfaceMaterial(appearance) {
  return new THREE.MeshStandardMaterial({
    color: appearance.color,
    transparent: appearance.opacity < 1,
    opacity: appearance.opacity,
    roughness: 0.48,
    metalness: 0.16,
    side: THREE.DoubleSide,
  });
}

export function addGeometry(group, geometry, options) {
  const {
    appearance,
    edgeColor,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    showEdges = appearance.showEdges,
  } = options;
  const mesh = new THREE.Mesh(geometry, createSurfaceMaterial(appearance));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  group.add(mesh);

  if (showEdges) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: edgeColor }),
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    edges.scale.copy(mesh.scale);
    group.add(edges);
  }

  return mesh;
}

export function addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme) {
  const namePlate = createTextSprite(label, {
    background: sceneTheme.labelBackground,
    border: colorToCss(edgeColor),
    color: sceneTheme.labelText,
    scale: { x: Math.max(1.2, Math.min(width * 1.6, 2.6)), y: 0.38 },
  });
  namePlate.position.set(0, height + 0.26, 0);
  group.add(namePlate);
}

export function addTubeBetween(group, start, end, radius, options) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 18);
  const mesh = addGeometry(group, geometry, options);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());

  group.children
    .filter((child) => child !== mesh && child.geometry?.type === "EdgesGeometry" && child.position.lengthSq() === 0)
    .at(-1)
    ?.position.copy(mesh.position);

  const edge = group.children.at(-1);
  if (edge?.isLineSegments && edge.geometry.type === "EdgesGeometry") {
    edge.quaternion.copy(mesh.quaternion);
  }

  return mesh;
}
