import * as THREE from "three";

import { DEFAULT_WORLD } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";

export function getRoomScene(roomId, roomScenes) {
  return roomScenes[roomId] ?? {
    world: DEFAULT_WORLD,
    equipment: [],
    worldStructures: [],
  };
}

export function getRoomLayoutSignature(room, scene, selected, theme) {
  return JSON.stringify({
    world: scene.world,
    equipmentCount: scene.equipment?.length ?? 0,
    appearance: room.appearance,
    selected,
    theme,
  });
}

export function createRoomLayoutObject(room, scene, visualState) {
  const width = scene.world?.width ?? DEFAULT_WORLD.width;
  const depth = scene.world?.depth ?? DEFAULT_WORLD.depth;
  const equipmentCount = scene.equipment?.length ?? 0;
  const group = new THREE.Group();
  group.name = room.name;
  group.userData.roomId = room.id;

  const slabGeometry = new THREE.BoxGeometry(width, visualState.selected ? 0.2 : 0.12, depth);
  const slabMaterial = new THREE.MeshStandardMaterial({
    color: visualState.selected ? visualState.selectionColor : room.appearance.color,
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: visualState.selected ? 0.88 : 0.68,
  });
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.position.y = visualState.selected ? 0.1 : 0.06;
  slab.userData.roomId = room.id;
  group.add(slab);

  const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.42, depth));
  const outline = new THREE.LineSegments(
    outlineGeometry,
    new THREE.LineBasicMaterial({
      color: visualState.selected ? visualState.selectionEdge : visualState.edgeColor,
      transparent: true,
      opacity: visualState.selected ? 1 : 0.76,
    }),
  );
  outline.position.y = 0.21;
  outline.userData.roomId = room.id;
  group.add(outline);

  const markerCount = Math.min(equipmentCount, 12);
  for (let index = 0; index < markerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.42, 0.55),
      new THREE.MeshStandardMaterial({ color: visualState.equipmentColor, roughness: 0.66 }),
    );
    const columns = Math.max(1, Math.min(4, Math.floor(width / 2)));
    marker.position.set(
      -width / 2 + 1.2 + (index % columns) * 1.25,
      0.34,
      -depth / 2 + 1.2 + Math.floor(index / columns) * 1.25,
    );
    marker.userData.roomId = room.id;
    group.add(marker);
  }

  group.userData.geometrySignature = getRoomLayoutSignature(
    room,
    scene,
    visualState.selected,
    visualState.theme,
  );
  return group;
}
