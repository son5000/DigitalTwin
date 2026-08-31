import * as THREE from "three";

import { createCustomBuildingGroup } from "@/features/customAssets/building/buildingRenderer";
import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import { BUILDING_FACADES, getBuildingFacadeOpenings } from "@/features/digitalTwin/editor/model/buildingOpenings";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";
import { applyUserTextureToObject } from "@/features/digitalTwin/editor/three/userTextureRuntime";

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

function addMass(group, size, position, material, buildingId, edgeColor) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, material.clone());
  mesh.position.set(position.x, position.y, position.z);
  mesh.userData.buildingId = buildingId;
  mesh.userData.textureSurface = "EXTERIOR";
  mesh.add(createEdgeOverlay(geometry, edgeColor));
  group.add(mesh);
  return mesh;
}

function addBuildingMasses(group, building, width, depth, totalHeight, material, edgeColor) {
  const profile = building.objectDefinitionId ?? building.templateId ?? "BUILDING";
  if (profile === "HIGH_RISE_TOWER") {
    addMass(group, { x: width, y: totalHeight * 0.16, z: depth }, { x: 0, y: totalHeight * 0.08, z: 0 }, material, building.id, edgeColor);
    addMass(group, { x: width * 0.78, y: totalHeight * 0.58, z: depth * 0.78 }, { x: 0, y: totalHeight * 0.45, z: 0 }, material, building.id, edgeColor);
    addMass(group, { x: width * 0.62, y: totalHeight * 0.26, z: depth * 0.62 }, { x: 0, y: totalHeight * 0.87, z: 0 }, material, building.id, edgeColor);
    return;
  }
  if (profile === "FACTORY_COMPLEX") {
    addMass(group, { x: width * 0.58, y: totalHeight, z: depth * 0.62 }, { x: -width * 0.2, y: totalHeight / 2, z: 0 }, material, building.id, edgeColor);
    addMass(group, { x: width * 0.34, y: totalHeight * 0.72, z: depth * 0.42 }, { x: width * 0.28, y: totalHeight * 0.36, z: -depth * 0.2 }, material, building.id, edgeColor);
    addMass(group, { x: width * 0.3, y: totalHeight * 0.58, z: depth * 0.34 }, { x: width * 0.3, y: totalHeight * 0.29, z: depth * 0.23 }, material, building.id, edgeColor);
    return;
  }
  addMass(group, { x: width, y: totalHeight, z: depth }, { x: 0, y: totalHeight / 2, z: 0 }, material, building.id, edgeColor);
}

function addFacadeWindows(group, building, width, depth, floorCount, floorHeight) {
  const style = building.variants?.windowStyle ?? "GRID";
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: style === "FULL_GLASS" || style === "CURTAIN_WALL" ? 0x3f6f86 : 0x55788a,
    roughness: 0.18,
    metalness: 0.34,
    transparent: false,
    opacity: 1,
  });
  const rows = Math.min(20, Math.max(1, floorCount));
  const frontColumns = Math.min(18, Math.max(2, Math.round(width / (style === "VERTICAL" ? 2 : 3.2))));
  const sideColumns = Math.min(12, Math.max(1, Math.round(depth / 3.2)));
  const windowHeight = style === "SMALL_INDUSTRIAL" ? floorHeight * 0.22 : style === "LARGE_FACTORY" ? floorHeight * 0.54 : floorHeight * 0.42;
  const windowWidthFactor = style === "VERTICAL" ? 0.34 : style === "HORIZONTAL" ? 0.78 : style === "CURTAIN_WALL" || style === "FULL_GLASS" ? 0.9 : 0.58;
  const frontGeometry = new THREE.BoxGeometry(width / frontColumns * windowWidthFactor, windowHeight, 0.09);
  const sideGeometry = new THREE.BoxGeometry(0.09, windowHeight, depth / sideColumns * windowWidthFactor);
  const frontInstances = new THREE.InstancedMesh(frontGeometry, windowMaterial, rows * frontColumns * 2);
  const sideInstances = new THREE.InstancedMesh(sideGeometry, windowMaterial.clone(), rows * sideColumns * 2);
  const matrix = new THREE.Matrix4();
  let frontIndex = 0;
  let sideIndex = 0;
  for (let row = 0; row < rows; row += 1) {
    const y = row * floorHeight + floorHeight * 0.58;
    for (let column = 0; column < frontColumns; column += 1) {
      const x = -width / 2 + width * (column + 0.5) / frontColumns;
      [-1, 1].forEach((side) => {
        matrix.makeTranslation(x, y, side * (depth / 2 + 0.05));
        frontInstances.setMatrixAt(frontIndex, matrix);
        frontIndex += 1;
      });
    }
    for (let column = 0; column < sideColumns; column += 1) {
      const z = -depth / 2 + depth * (column + 0.5) / sideColumns;
      [-1, 1].forEach((side) => {
        matrix.makeTranslation(side * (width / 2 + 0.05), y, z);
        sideInstances.setMatrixAt(sideIndex, matrix);
        sideIndex += 1;
      });
    }
  }
  frontInstances.userData.buildingId = building.id;
  sideInstances.userData.buildingId = building.id;
  group.add(frontInstances, sideInstances);
}

function addIndustrialDetails(group, building, width, depth, totalHeight, material, edgeColor) {
  const extras = building.parameters.extras ?? [];
  if (extras.includes("STACK")) {
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.8, width * 0.025), Math.max(1.2, width * 0.035), totalHeight * 1.45, 12),
      new THREE.MeshStandardMaterial({ color: 0x7a665e, roughness: 0.8 }),
    );
    stack.position.set(width * 0.34, totalHeight * 0.72, -depth * 0.32);
    stack.userData.buildingId = building.id;
    group.add(stack);
  }
  if (extras.includes("ROOFTOP_UNITS") || extras.includes("MEP_PENTHOUSE")) {
    const unitCount = extras.includes("MEP_PENTHOUSE") ? 4 : 3;
    for (let index = 0; index < unitCount; index += 1) {
      addMass(group, { x: width * 0.14, y: Math.max(1.2, totalHeight * 0.1), z: depth * 0.18 }, {
        x: -width * 0.27 + index * width * 0.18,
        y: totalHeight + Math.max(1.2, totalHeight * 0.1) / 2,
        z: 0,
      }, material, building.id, edgeColor);
    }
  }
  if (extras.includes("STEEL_FRAME")) {
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x58676e, roughness: 0.48, metalness: 0.58 });
    for (let index = 0; index <= 6; index += 1) {
      const x = -width / 2 + width * index / 6;
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, totalHeight * 1.04, 0.28), postMaterial);
        post.position.set(x, totalHeight * 0.52, side * (depth / 2 + 0.18));
        post.userData.buildingId = building.id;
        group.add(post);
      });
    }
  }
  if (extras.includes("VENTS") || extras.includes("LOUVERS")) {
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x566a73, roughness: 0.58, metalness: 0.48 });
    for (let index = 0; index < 4; index += 1) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(width * 0.08, totalHeight * 0.16, 0.18), ventMaterial);
      vent.position.set(-width * 0.3 + width * 0.2 * index, totalHeight * 0.72, depth / 2 + 0.12);
      vent.userData.buildingId = building.id;
      group.add(vent);
    }
  }
}

export function getBuildingFloorCount(buildingId, floors) {
  return Math.max(1, floors.filter((floor) => floor.parentId === buildingId).length);
}

export function getBuildingSignature(building, floorCount, selected, expanded, theme, viewerTranslucent = false) {
  return JSON.stringify({
    templateId: building.templateId,
    objectDefinitionId: building.objectDefinitionId,
    customAssetId: building.customAssetId,
    customAssetRevision: building.customAssetRevision,
    customAssetSnapshotUpdatedAt: building.customAssetSnapshot?.updatedAt,
    customAssetViewGroupId: building.customAssetViewGroupId,
    customAssetViewMode: building.customAssetViewMode,
    customAssetExploded: building.customAssetExploded,
    parameters: building.parameters,
    variants: building.variants,
    facadeOpenings: building.facadeOpenings,
    appearance: building.appearance,
    userTexture: building.userTexture,
    floorCount,
    selected,
    expanded,
    viewerTranslucent,
    theme,
  });
}

function mergeIntervals(intervals) {
  return intervals.sort((left, right) => left[0] - right[0]).reduce((merged, interval) => {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1] + 0.001) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
    return merged;
  }, []);
}

function wallSpans(length, blocked) {
  const merged = mergeIntervals(blocked.map(([start, end]) => [Math.max(-length / 2, start), Math.min(length / 2, end)]));
  const spans = [];
  let cursor = -length / 2;
  merged.forEach(([start, end]) => {
    if (start > cursor + 0.001) spans.push([cursor, start]);
    cursor = Math.max(cursor, end);
  });
  if (cursor < length / 2 - 0.001) spans.push([cursor, length / 2]);
  return spans;
}

function addWallPanel(group, facade, span, yRange, width, depth, material, buildingId, edgeColor) {
  const thickness = 0.2;
  const horizontalSize = span[1] - span[0];
  const height = yRange[1] - yRange[0];
  if (horizontalSize <= 0.001 || height <= 0.001) return;
  const horizontalCenter = (span[0] + span[1]) / 2;
  const y = (yRange[0] + yRange[1]) / 2;
  if (facade === BUILDING_FACADES.FRONT || facade === BUILDING_FACADES.BACK) {
    addMass(group, { x: horizontalSize, y: height, z: thickness }, { x: horizontalCenter, y, z: (facade === BUILDING_FACADES.FRONT ? 1 : -1) * (depth / 2 - thickness / 2) }, material, buildingId, edgeColor);
  } else {
    addMass(group, { x: thickness, y: height, z: horizontalSize }, { x: (facade === BUILDING_FACADES.RIGHT ? 1 : -1) * (width / 2 - thickness / 2), y, z: horizontalCenter }, material, buildingId, edgeColor);
  }
}

function positionOnFacade(object, facade, horizontal, y, width, depth, normalOffset = 0) {
  if (facade === BUILDING_FACADES.FRONT || facade === BUILDING_FACADES.BACK) {
    object.position.set(horizontal, y, (facade === BUILDING_FACADES.FRONT ? 1 : -1) * (depth / 2 + normalOffset));
  } else {
    object.position.set((facade === BUILDING_FACADES.RIGHT ? 1 : -1) * (width / 2 + normalOffset), y, horizontal);
    object.rotation.y = Math.PI / 2;
  }
}

function addOpeningAppearance(group, building, opening, width, depth) {
  const frameMaterial = createPresetMaterial(opening.frame);
  const fillMaterial = createPresetMaterial(opening.fill, opening.kind === "WINDOW" ? { transparent: true, opacity: 0.72 } : {});
  const frameWidth = Math.min(0.14, opening.width * 0.12);
  const frameDepth = 0.1;
  const centerY = opening.bottom + opening.height / 2;
  const addPart = (partWidth, partHeight, horizontal, y, material, offset = 0.015) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(partWidth, partHeight, frameDepth), material);
    positionOnFacade(mesh, opening.facade, horizontal, y, width, depth, offset);
    mesh.userData.buildingId = building.id;
    mesh.userData.facadeOpeningKind = opening.kind;
    group.add(mesh);
  };
  addPart(frameWidth, opening.height + frameWidth * 2, opening.center - opening.width / 2, centerY, frameMaterial);
  addPart(frameWidth, opening.height + frameWidth * 2, opening.center + opening.width / 2, centerY, frameMaterial);
  addPart(opening.width, frameWidth, opening.center, opening.bottom + opening.height, frameMaterial);
  if (opening.kind === "WINDOW") addPart(opening.width, frameWidth, opening.center, opening.bottom, frameMaterial);
  addPart(Math.max(0.05, opening.width - frameWidth * 1.4), Math.max(0.05, opening.height - frameWidth * 1.4), opening.center, centerY, fillMaterial, 0.022);
}

function addFacadeShell(group, building, width, depth, totalHeight, floorHeight, openings, material, edgeColor) {
  Object.values(BUILDING_FACADES).forEach((facade) => {
    const length = [BUILDING_FACADES.FRONT, BUILDING_FACADES.BACK].includes(facade) ? width : depth;
    const facadeOpenings = openings.filter((opening) => opening.facade === facade);
    const floorCount = Math.max(1, Math.round(totalHeight / floorHeight));
    for (let floor = 1; floor <= floorCount; floor += 1) {
      const floorBottom = (floor - 1) * floorHeight;
      const floorTop = Math.min(totalHeight, floor * floorHeight);
      const floorOpenings = facadeOpenings.filter((opening) => opening.floor === floor);
      const yCuts = [...new Set([floorBottom, floorTop, ...floorOpenings.flatMap((opening) => [opening.bottom, opening.bottom + opening.height])])].sort((left, right) => left - right);
      for (let index = 0; index < yCuts.length - 1; index += 1) {
        const yRange = [yCuts[index], yCuts[index + 1]];
        const middleY = (yRange[0] + yRange[1]) / 2;
        const blocked = floorOpenings
          .filter((opening) => middleY > opening.bottom + 0.001 && middleY < opening.bottom + opening.height - 0.001)
          .map((opening) => [opening.center - opening.width / 2, opening.center + opening.width / 2]);
        wallSpans(length, blocked).forEach((span) => addWallPanel(group, facade, span, yRange, width, depth, material, building.id, edgeColor));
      }
    }
  });
  const slabThickness = 0.16;
  addMass(group, { x: width, y: slabThickness, z: depth }, { x: 0, y: slabThickness / 2, z: 0 }, material, building.id, edgeColor);
  openings.forEach((opening) => addOpeningAppearance(group, building, opening, width, depth));
}

function applyViewerTransparency(group, enabled) {
  if (!enabled) return;
  group.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material instanceof THREE.LineBasicMaterial) {
        material.transparent = true;
        material.opacity = Math.min(material.opacity ?? 1, 0.56);
      } else {
        material.transparent = true;
        material.opacity = Math.min(material.opacity ?? 1, 0.32);
        material.depthWrite = false;
      }
      material.needsUpdate = true;
    });
  });
}

export function updateBuildingFloorVisualState(group, building, floors, visualState) {
  const buildingFloors = floors
    .filter((floor) => floor.parentId === building.id)
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));
  const selectedIndex = Math.max(0, buildingFloors.findIndex((floor) => floor.id === visualState.selectedFloorId));
  const floorHeight = building.parameters.floorHeight;

  group.traverse((child) => {
    if (!child.userData.floorId) return;
    const index = buildingFloors.findIndex((floor) => floor.id === child.userData.floorId);
    if (index < 0) return;
    const isSelectedFloor = index === selectedIndex;
    child.position.y = index * floorHeight + 0.08;
    child.material.opacity = isSelectedFloor ? 0.96 : 0.38;
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
  const { openings } = getBuildingFacadeOpenings(building, floorCount);
  const customAsset = building.customAssetId
    ? building.customAssetAutoUpdate === false
      ? building.customAssetSnapshot
      : getRuntimeCustomAsset(building.customAssetId) ?? building.customAssetSnapshot
    : null;
  if (customAsset) {
    const customGroup = createCustomBuildingGroup(customAsset, {
      buildingId: building.id,
      selected: visualState.selected,
      selectionColor: visualState.selectionColor,
      translucent: visualState.viewerTranslucent || visualState.expanded,
      viewGroupId: building.customAssetViewGroupId,
      viewMode: building.customAssetViewMode ?? "ALL",
      explode: building.customAssetExploded ?? false,
      scale: {
        x: width / Math.max(0.01, customAsset.bounds.width),
        y: 1,
        z: depth / Math.max(0.01, customAsset.bounds.depth),
      },
    });
    customGroup.name = building.name;
    customGroup.userData.buildingId = building.id;
    customGroup.userData.geometrySignature = getBuildingSignature(
      building,
      floorCount,
      visualState.selected,
      visualState.expanded,
      visualState.theme,
      visualState.viewerTranslucent,
    );
    applyUserTextureToObject(customGroup, building.userTexture);
    return customGroup;
  }
  const group = new THREE.Group();
  group.name = building.name;
  group.userData.buildingId = building.id;

  const bodyMaterial = createPresetMaterial(building.appearance, {
    emissive: visualState.selected ? visualState.selectionColor : 0x000000,
    emissiveIntensity: visualState.selected ? 0.035 : 0,
    opacity: visualState.expanded ? 0.14 : 1,
  });
  if (!visualState.expanded && building.facadeOpenings && openings.length) addFacadeShell(group, building, width, depth, totalHeight, floorHeight, openings, bodyMaterial, visualState.edgeColor);
  else addBuildingMasses(group, building, width, depth, totalHeight, bodyMaterial, visualState.edgeColor);
  if (!visualState.expanded && !building.facadeOpenings) addFacadeWindows(group, building, width, depth, floorCount, floorHeight);
  addIndustrialDetails(group, building, width, depth, totalHeight, bodyMaterial, visualState.edgeColor);

  const stairCount = Math.min(8, Math.max(0, Math.round(building.parameters.stairCount ?? 1)));
  const stairMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(building.appearance.color).multiplyScalar(0.62),
    roughness: 0.82,
  });
  for (let index = 0; index < stairCount; index += 1) {
    const stair = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(3.2, width * 0.12), totalHeight * 0.92, Math.min(2.8, depth * 0.12)),
      stairMaterial,
    );
    const side = index % 2 === 0 ? -1 : 1;
    stair.position.set(side * (width / 2 - Math.min(1.8, width * 0.07)), totalHeight * 0.46, -depth / 2 + 1.5 + Math.floor(index / 2) * 3.2);
    stair.userData.buildingId = building.id;
    stair.add(createEdgeOverlay(stair.geometry, visualState.edgeColor));
    group.add(stair);
  }

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
        slab.add(createEdgeOverlay(slabGeometry, visualState.edgeColor));
        group.add(slab);
      });
  }

  const roofMaterial = createPresetMaterial(building.appearance, {
    color: new THREE.Color(building.appearance.color).multiplyScalar(0.78),
    opacity: visualState.expanded ? 0.24 : 1,
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
    roof.userData.textureSurface = "ROOF";
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
      tooth.userData.textureSurface = "ROOF";
      group.add(tooth);
    }
  } else if (roofType === "INDUSTRIAL_VENT") {
    const roofGeometry = new THREE.BoxGeometry(width * 1.02, 0.24, depth * 1.02);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = totalHeight + 0.12;
    roof.userData.buildingId = building.id;
    roof.userData.textureSurface = "ROOF";
    group.add(roof);
    for (let index = 0; index < 3; index += 1) {
      const monitorGeometry = new THREE.BoxGeometry(width * 0.18, Math.max(1, floorHeight * 0.32), depth * 0.42);
      const monitor = new THREE.Mesh(monitorGeometry, roofMaterial.clone());
      monitor.position.set(-width * 0.24 + index * width * 0.24, totalHeight + Math.max(1, floorHeight * 0.32) / 2, 0);
      monitor.userData.buildingId = building.id;
      monitor.userData.textureSurface = "ROOF";
      monitor.add(createEdgeOverlay(monitorGeometry, visualState.edgeColor));
      group.add(monitor);
    }
  } else {
    const roofGeometry = new THREE.BoxGeometry(width * 1.02, 0.24, depth * 1.02);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = totalHeight + 0.12;
    roof.userData.buildingId = building.id;
    roof.userData.textureSurface = "ROOF";
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
  apron.userData.textureSurface = "EXCLUDE";
  group.add(apron);

  group.userData.geometrySignature = getBuildingSignature(
    building,
    floorCount,
    visualState.selected,
    visualState.expanded,
    visualState.theme,
    visualState.viewerTranslucent,
  );
  if (visualState.expanded) updateBuildingFloorVisualState(group, building, floors, visualState);
  else applyViewerTransparency(group, visualState.viewerTranslucent);
  applyUserTextureToObject(group, building.userTexture);
  return group;
}
