import * as THREE from "three";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { acquireSharedGeometry } from "@/features/digitalTwin/editor/three/sharedGeometryCache";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";

import { BUILDING_ENTITY_TYPES, BUILDING_VIEW_MODES, normalizeBuildingAssembly, resolveConnectorPath } from "./buildingAssembly";

function createShape(footprint) {
  const shape = new THREE.Shape();
  footprint.points.forEach((point, index) => shape[index === 0 ? "moveTo" : "lineTo"](point.x, -point.z));
  shape.closePath();
  (footprint.holes ?? []).forEach((holePoints) => {
    const hole = new THREE.Path();
    holePoints.forEach((point, index) => hole[index === 0 ? "moveTo" : "lineTo"](point.x, -point.z));
    hole.closePath();
    shape.holes.push(hole);
  });
  return shape;
}

function createMassGeometry(asset, mass) {
  const height = mass.verticalRange.topElevation - mass.verticalRange.baseElevation;
  const key = `custom-building:${asset.id}:${asset.revision}:${mass.id}:${JSON.stringify(mass.footprint)}:${height}`;
  return acquireSharedGeometry(key, () => {
    const geometry = new THREE.ExtrudeGeometry(createShape(mass.footprint), { depth: height, bevelEnabled: false, curveSegments: 2, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  });
}

function createOutline(points, color, y) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(({ x, z }) => new THREE.Vector3(x, y, z)));
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.52 }));
  line.renderOrder = 2;
  return line;
}

function visibilityState(entity, activeGroup, viewMode) {
  const included = !activeGroup || activeGroup.entityIds.includes(entity.id);
  if (viewMode === BUILDING_VIEW_MODES.HIDE_OTHERS && !included) return { hidden: true, ghost: false };
  return { hidden: entity.visible === false, ghost: !included && viewMode === BUILDING_VIEW_MODES.GHOST_OTHERS };
}

function outsideHeightRange(entity, options) {
  const base = entity.verticalRange?.baseElevation ?? 0;
  const top = entity.verticalRange?.topElevation ?? 0;
  return (Number.isFinite(options.minVisibleElevation) && top <= options.minVisibleElevation)
    || (Number.isFinite(options.maxVisibleElevation) && base >= options.maxVisibleElevation);
}

function addMass(group, asset, mass, options, activeGroup) {
  const state = visibilityState(mass, activeGroup, options.viewMode);
  if (state.hidden || outsideHeightRange(mass, options)) return;
  const materialDefinition = asset.materials.find((item) => item.id === mass.materialId) ?? asset.materials[0] ?? {};
  const selected = options.selected || mass.id === options.selectedEntityId || (activeGroup?.entityIds.includes(mass.id) && options.viewMode === BUILDING_VIEW_MODES.HIGHLIGHT);
  const translucent = options.translucent || mass.translucent || state.ghost;
  const material = createPresetMaterial({
    materialPresetId: materialDefinition.presetId ?? "CONCRETE",
    color: mass.color ?? materialDefinition.color ?? "#87979D",
    roughness: materialDefinition.roughness ?? 0.72,
    metalness: materialDefinition.metalness ?? 0.04,
    opacity: translucent ? (state.ghost ? 0.16 : 0.34) : 1,
    textureScale: materialDefinition.textureScale ?? 1,
    bumpStrength: materialDefinition.bumpStrength ?? 0.18,
    emissive: selected ? options.selectionColor : 0x000000,
    emissiveIntensity: selected ? 0.14 : 0,
  });
  const mesh = new THREE.Mesh(createMassGeometry(asset, mass), material);
  const explodeFactor = options.explode ? 1.18 : 1;
  mesh.position.set(mass.transform.position.x * explodeFactor, mass.verticalRange.baseElevation + (mass.transform.position.y ?? 0), mass.transform.position.z * explodeFactor);
  mesh.rotation.y = THREE.MathUtils.degToRad(mass.transform.rotationY || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { buildingId: options.buildingId, customEntityId: mass.id, customEntityType: mass.entityType, viewGroupIds: mass.viewGroupIds };
  const servedLevels = asset.levels.filter((level) => mass.levelIds.includes(level.id));
  servedLevels.forEach((level) => {
    const localY = level.baseElevation - mass.verticalRange.baseElevation + 0.015;
    const outline = createOutline(mass.footprint.points, selected ? options.selectionColor : options.edgeColor, localY);
    outline.userData = { buildingId: options.buildingId, customEntityId: mass.id };
    mesh.add(outline);
  });
  const topOutline = createOutline(mass.footprint.points, selected ? options.selectionColor : options.edgeColor, mass.verticalRange.topElevation - mass.verticalRange.baseElevation + 0.015);
  topOutline.userData = { buildingId: options.buildingId, customEntityId: mass.id };
  mesh.add(topOutline);
  group.add(mesh);
}

function connectorPreset(connector) {
  if (connector.materialPreset === "glass" || connector.connectorType === "glass-bridge") return "GLASS";
  if (connector.materialPreset === "concrete") return "CONCRETE";
  return "PAINTED_METAL";
}

function addConnector(group, asset, connector, options, activeGroup) {
  const state = visibilityState(connector, activeGroup, options.viewMode);
  if (state.hidden || outsideHeightRange(connector, options)) return;
  const points = resolveConnectorPath(asset, connector);
  if (points.length < 2) return;
  const selected = options.selected || connector.id === options.selectedEntityId || (activeGroup?.entityIds.includes(connector.id) && options.viewMode === BUILDING_VIEW_MODES.HIGHLIGHT);
  const glass = connector.materialPreset === "glass" || connector.connectorType === "glass-bridge" || connector.connectorType === "skybridge";
  const material = createPresetMaterial({
    materialPresetId: connectorPreset(connector),
    color: glass ? "#83AFC2" : "#7D8B91",
    roughness: glass ? 0.12 : 0.52,
    metalness: glass ? 0.05 : 0.46,
    opacity: state.ghost ? 0.14 : glass ? 0.48 : options.translucent || connector.translucent ? 0.34 : 1,
    emissive: selected ? options.selectionColor : 0x000000,
    emissiveIntensity: selected ? 0.16 : 0,
  });
  points.slice(1).forEach((end, index) => {
    const start = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    const segment = new THREE.Group();
    segment.position.set((start.x + end.x) / 2, (connector.verticalRange.baseElevation + connector.verticalRange.topElevation) / 2, (start.z + end.z) / 2);
    segment.rotation.y = -Math.atan2(dz, dx);
    segment.userData = { buildingId: options.buildingId, customEntityId: connector.id, customEntityType: connector.entityType, segmentIndex: index, viewGroupIds: connector.viewGroupIds };
    const enclosure = connector.enclosure ?? { leftWall: true, rightWall: true, roof: true, floor: true };
    const panels = [];
    if (enclosure.floor !== false) panels.push({ key: "floor", size: [length, 0.18, connector.width], position: [0, -connector.height / 2 + 0.09, 0] });
    if (enclosure.roof !== false) panels.push({ key: "roof", size: [length, 0.14, connector.width], position: [0, connector.height / 2 - 0.07, 0] });
    if (enclosure.leftWall !== false) panels.push({ key: "left", size: [length, connector.height, 0.12], position: [0, 0, -connector.width / 2 + 0.06] });
    if (enclosure.rightWall !== false) panels.push({ key: "right", size: [length, connector.height, 0.12], position: [0, 0, connector.width / 2 - 0.06] });
    panels.forEach((panel) => {
      const geometry = acquireSharedGeometry(`custom-connector:${panel.key}:${length.toFixed(3)}:${connector.width}:${connector.height}`, () => new THREE.BoxGeometry(...panel.size));
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.set(...panel.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { ...segment.userData };
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: selected ? options.selectionColor : options.edgeColor, transparent: true, opacity: 0.58 }));
      edges.userData = { buildingId: options.buildingId, customEntityId: connector.id };
      mesh.add(edges);
      segment.add(mesh);
    });
    group.add(segment);
  });
}

export function createCustomBuildingGroup(source, {
  buildingId = source.id,
  selectedSectionId = null,
  selectedEntityId = selectedSectionId,
  selected = false,
  selectionColor = SCENE_THEMES.dark.selection,
  edgeColor = SCENE_THEMES.dark.worldEdge,
  translucent = false,
  viewGroupId = null,
  viewMode = BUILDING_VIEW_MODES.ALL,
  explode = false,
  minVisibleElevation = null,
  maxVisibleElevation = null,
  scale = { x: 1, y: 1, z: 1 },
} = {}) {
  const asset = normalizeBuildingAssembly(source);
  const group = new THREE.Group();
  group.name = asset.name;
  group.userData = { buildingId, customAssetId: asset.id, assembly: true };
  const activeGroup = asset.viewGroups.find((item) => item.id === viewGroupId) ?? null;
  const options = { buildingId, selectedEntityId, selected, selectionColor, edgeColor, translucent, viewMode, explode, minVisibleElevation, maxVisibleElevation };
  asset.entities.forEach((entity) => {
    if (entity.entityType === BUILDING_ENTITY_TYPES.MASS) addMass(group, asset, entity, options, activeGroup);
    else if (entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR) addConnector(group, asset, entity, options, activeGroup);
  });
  group.scale.set(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1);
  return group;
}
