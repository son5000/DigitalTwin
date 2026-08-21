import * as THREE from "three";

function createEdgeOverlay(geometry, color) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
}

function createGableRoof(width, depth, height, material, edgeColor) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  const roof = new THREE.Mesh(geometry, material);
  roof.add(createEdgeOverlay(geometry, edgeColor));
  return roof;
}

export function getBuildingFloorCount(buildingId, floors) {
  return Math.max(1, floors.filter((floor) => floor.parentId === buildingId).length);
}

export function getBuildingSignature(building, floorCount, selected, expanded, theme) {
  return JSON.stringify({
    templateId: building.templateId,
    parameters: building.parameters,
    appearance: building.appearance,
    floorCount,
    selected,
    expanded,
    theme,
  });
}

export function updateBuildingFloorVisualState(group, building, floors, visualState) {
  const buildingFloors = floors
    .filter((floor) => floor.parentId === building.id)
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));
  const selectedIndex = Math.max(0, buildingFloors.findIndex((floor) => floor.id === visualState.selectedFloorId));
  const floorHeight = building.parameters.floorHeight;
  const explodeGap = Math.max(1.6, floorHeight * 0.7);

  group.traverse((child) => {
    if (!child.userData.floorId) return;
    const index = buildingFloors.findIndex((floor) => floor.id === child.userData.floorId);
    if (index < 0) return;
    const isSelectedFloor = index === selectedIndex;
    const direction = Math.sign(index - selectedIndex);
    const distance = Math.abs(index - selectedIndex);
    child.userData.targetY = index * floorHeight + 0.08 + direction * explodeGap * distance;
    child.userData.targetOpacity = isSelectedFloor ? 0.96 : 0.38;
    child.material.color.set(isSelectedFloor ? visualState.selectionColor : visualState.floorColor);
    child.material.emissive.set(isSelectedFloor ? visualState.selectionColor : 0x000000);
    child.material.emissiveIntensity = isSelectedFloor ? 0.14 : 0;
  });
}

export function createBuildingObject(building, floors, visualState) {
  const floorCount = getBuildingFloorCount(building.id, floors);
  const width = building.parameters.width;
  const depth = building.parameters.depth;
  const floorHeight = building.parameters.floorHeight;
  const totalHeight = floorCount * floorHeight;
  const group = new THREE.Group();
  group.name = building.name;
  group.userData.buildingId = building.id;

  const bodyGeometry = new THREE.BoxGeometry(width, totalHeight, depth);
  const materialPreset = {
    CONCRETE: { roughness: 0.9, metalness: 0.02 },
    METAL: { roughness: 0.48, metalness: 0.58 },
    PAINTED: { roughness: 0.62, metalness: 0.18 },
  }[building.appearance.material] ?? { roughness: 0.78, metalness: 0.08 };
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: building.appearance.color,
    ...materialPreset,
    emissive: visualState.selected ? visualState.selectionColor : 0x000000,
    emissiveIntensity: visualState.selected ? 0.035 : 0,
    transparent: visualState.expanded,
    opacity: visualState.expanded ? 0.14 : 0.9,
    depthWrite: !visualState.expanded,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = totalHeight / 2;
  body.userData.buildingId = building.id;
  body.add(createEdgeOverlay(bodyGeometry, visualState.edgeColor));
  group.add(body);

  if (visualState.expanded) {
    floors
      .filter((floor) => floor.parentId === building.id)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      .forEach((floor, index) => {
        const isSelectedFloor = floor.id === visualState.selectedFloorId;
        const slabGeometry = new THREE.BoxGeometry(width * 0.96, 0.14, depth * 0.96);
        const slab = new THREE.Mesh(
          slabGeometry,
          new THREE.MeshStandardMaterial({
            color: isSelectedFloor ? visualState.selectionColor : visualState.floorColor,
            emissive: isSelectedFloor ? visualState.selectionColor : 0x000000,
            emissiveIntensity: isSelectedFloor ? 0.12 : 0,
            roughness: 0.8,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
          }),
        );
        slab.position.y = index * floorHeight + 0.08;
        slab.userData.buildingId = building.id;
        slab.userData.floorId = floor.id;
        slab.userData.targetY = slab.position.y;
        slab.userData.targetOpacity = isSelectedFloor ? 0.96 : 0.38;
        slab.add(createEdgeOverlay(slabGeometry, visualState.edgeColor));
        group.add(slab);
      });
  }

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(building.appearance.color).multiplyScalar(0.78),
    roughness: 0.72,
    transparent: visualState.expanded,
    opacity: visualState.expanded ? 0.24 : 1,
    depthWrite: !visualState.expanded,
  });
  const roofType = building.parameters.roofType;
  if (roofType === "GABLE") {
    const roof = createGableRoof(
      width,
      depth,
      Math.min(4, width * 0.14),
      roofMaterial,
      visualState.edgeColor,
    );
    roof.position.y = totalHeight;
    roof.userData.buildingId = building.id;
    group.add(roof);
  } else if (roofType === "SAWTOOTH") {
    const toothCount = 4;
    const toothWidth = width / toothCount;
    for (let index = 0; index < toothCount; index += 1) {
      const tooth = createGableRoof(
        toothWidth,
        depth,
        Math.min(2.4, toothWidth * 0.34),
        roofMaterial,
        visualState.edgeColor,
      );
      tooth.position.set(-width / 2 + toothWidth * (index + 0.5), totalHeight, 0);
      tooth.userData.buildingId = building.id;
      group.add(tooth);
    }
  } else {
    const roofGeometry = new THREE.BoxGeometry(width * 1.02, 0.24, depth * 1.02);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = totalHeight + 0.12;
    roof.userData.buildingId = building.id;
    roof.add(createEdgeOverlay(roofGeometry, visualState.edgeColor));
    group.add(roof);
  }

  const apronGeometry = new THREE.BoxGeometry(width + 2, 0.08, depth + 2);
  const apron = new THREE.Mesh(
    apronGeometry,
    new THREE.MeshStandardMaterial({ color: visualState.apronColor, roughness: 0.92 }),
  );
  apron.position.y = 0.04;
  apron.userData.buildingId = building.id;
  group.add(apron);

  group.userData.geometrySignature = getBuildingSignature(
    building,
    floorCount,
    visualState.selected,
    visualState.expanded,
    visualState.theme,
  );
  if (visualState.expanded) updateBuildingFloorVisualState(group, building, floors, visualState);
  return group;
}
