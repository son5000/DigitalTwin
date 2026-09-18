import * as THREE from "three";

export function createGenericStructureGeometry(profile, { width, height, depth }) {
  let geometry;
  if (profile === "SPHERE") geometry = new THREE.SphereGeometry(0.5, 24, 16);
  else if (profile === "CYLINDER") geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  else if (profile === "CONE") geometry = new THREE.ConeGeometry(0.5, 1, 24);
  else if (profile === "PYRAMID") {
    geometry = new THREE.ConeGeometry(0.5, 1, 4);
    geometry.rotateY(Math.PI / 4);
  } else if (profile === "TORUS") {
    geometry = new THREE.TorusGeometry(0.36, 0.14, 12, 32);
    geometry.rotateX(Math.PI / 2);
  } else if (profile === "PRISM") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, -0.5); shape.lineTo(0.5, -0.5); shape.lineTo(0, 0.5); shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  } else if (profile === "WEDGE") {
    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    ], 3));
    indexed.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 0, 4, 5, 0, 5, 1, 0, 2, 4, 1, 5, 3]);
    geometry = indexed.toNonIndexed();
    indexed.dispose();
    geometry.computeVertexNormals();
  } else geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(width / size.x, height / size.y, depth / size.z);
  geometry.translate(0, height / 2, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function addGenericStructure(group, object, material, edgeColor) {
  const mesh = new THREE.Mesh(createGenericStructureGeometry(object.profile, object.dimensions), material);
  if (!["SPHERE", "TORUS"].includes(object.profile)) mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.65 }),
  ));
  group.add(mesh);
}
