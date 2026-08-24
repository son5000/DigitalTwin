import * as THREE from "three";

import { getStairSegments } from "@/features/digitalTwin/editor/utils/stairStructure";

function createMaterial(stair, opacity = stair.appearance?.opacity ?? 1) {
  return new THREE.MeshStandardMaterial({
    color: stair.appearance?.color ?? "#87959c",
    transparent: opacity < 1,
    opacity,
    roughness: 0.82,
    metalness: stair.appearance?.materialPreset?.includes("STEEL") ? 0.28 : 0.03,
    side: THREE.DoubleSide,
  });
}

function addEdges(mesh, color) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 28),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
  edges.position.copy(mesh.position);
  mesh.parent?.add(edges);
}

function createFlight(stair, segment, edgeColor) {
  const flight = new THREE.Group();
  const treadCount = Math.max(1, segment.riserCount - 1);
  for (let index = 0; index < treadCount; index += 1) {
    const height = segment.actualRiserHeight * (index + 1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(segment.width, height, segment.treadDepth),
      createMaterial(stair),
    );
    mesh.position.set(0, height / 2, -segment.runLength / 2 + segment.treadDepth * (index + 0.5));
    flight.add(mesh);
    addEdges(mesh, edgeColor);
  }
  const landingThickness = Math.max(0.08, Math.min(0.18, segment.actualRiserHeight));
  const landing = new THREE.Mesh(
    new THREE.BoxGeometry(segment.width, landingThickness, segment.landingDepth),
    createMaterial(stair),
  );
  landing.position.set(0, segment.floorHeight - landingThickness / 2, segment.runLength / 2 + segment.landingDepth / 2);
  flight.add(landing);
  addEdges(landing, edgeColor);
  flight.userData.stairSegmentId = segment.id;
  flight.userData.lowerFloorId = segment.lowerFloorId;
  flight.userData.upperFloorId = segment.upperFloorId;
  return flight;
}

export function createStairAssemblyObject(stair, floors, {
  selected = false,
  sceneTheme,
  currentFloorId = null,
  baseElevation = 0,
} = {}) {
  const object = new THREE.Group();
  object.name = stair.name;
  object.visible = stair.visible ?? true;
  object.userData.worldStructureId = stair.id;
  object.userData.structureType = "STAIR";
  object.userData.domain = "WORLD";
  const edgeColor = selected ? sceneTheme.worldSelection : sceneTheme.worldEdge;
  getStairSegments(stair, floors)
    .filter((segment) => !currentFloorId || segment.lowerFloorId === currentFloorId || segment.upperFloorId === currentFloorId)
    .forEach((segment) => {
      const flight = createFlight(stair, segment, edgeColor);
      flight.position.y = segment.lowerY - baseElevation;
      object.add(flight);
    });
  object.position.set(stair.position.x, 0, stair.position.z);
  object.rotation.set(0, stair.rotation?.y ?? 0, 0);
  return object;
}

function createUpLabel(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  context.font = "600 34px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("UP", 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.2, 0.6, 1);
  return sprite;
}

export function createStairPlanObject(stair, floors, currentFloorId, { selected = false, sceneTheme } = {}) {
  const segments = getStairSegments(stair, floors);
  const segment = segments.find((item) => item.lowerFloorId === currentFloorId)
    ?? segments.find((item) => item.upperFloorId === currentFloorId)
    ?? segments[0];
  const object = new THREE.Group();
  object.name = stair.name;
  object.visible = stair.visible ?? true;
  object.userData.worldStructureId = stair.id;
  object.userData.structureType = "STAIR";
  object.userData.domain = "WORLD";
  if (!segment) return object;
  const color = selected ? sceneTheme.worldSelection : sceneTheme.worldEdge;
  const vertices = [];
  for (let index = 0; index < segment.riserCount; index += 1) {
    const z = -segment.runLength / 2 + Math.min(index, segment.riserCount - 1) * segment.treadDepth;
    vertices.push(-segment.width / 2, 0.055, z, segment.width / 2, 0.055, z);
  }
  vertices.push(
    -segment.width / 2, 0.055, -segment.runLength / 2,
    -segment.width / 2, 0.055, segment.runLength / 2 + segment.landingDepth,
    segment.width / 2, 0.055, -segment.runLength / 2,
    segment.width / 2, 0.055, segment.runLength / 2 + segment.landingDepth,
  );
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  object.add(lines);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.07, -segment.runLength * 0.35), segment.runLength * 0.72, color, 0.45, 0.24);
  object.add(arrow);
  const label = createUpLabel(color);
  label.position.set(0, 0.09, segment.runLength * 0.08);
  label.material.rotation = -Math.PI / 2;
  object.add(label);
  object.position.set(stair.position.x, 0, stair.position.z);
  object.rotation.set(0, stair.rotation?.y ?? 0, 0);
  return object;
}
