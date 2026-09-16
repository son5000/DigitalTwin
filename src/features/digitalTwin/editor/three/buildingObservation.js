import * as THREE from "three";
import { SCENE_THEMES } from "../constants/sceneThemes";
import { createFloorDisplayOffsets, resolveFloorOwnerId } from "../model/floorDisplay";
import { getBuildingFloorFootprintRegions } from "../utils/buildingFootprint";
import { getStairRenderInstances, getVerticalStructureOpeningForFloor } from "../utils/stairStructure";
import { createStairRenderObject } from "../world/StairFactory";
import { createWorldStructureObject, getWorldStructureDimensions } from "../world/WorldStructureFactory";
import { createFloorSpatialObject, createFootprintShape } from "./floorSpatialScene";
import { createEquipmentRenderObjects } from "./equipmentInstancing";
import { animateCameraFocus, cancelCameraFocus, focusCameraOnBounds, focusCameraOnObject } from "./cameraFocus";
import { applyBuildingIsolationVisibility, captureBuildingIsolationVisibility, restoreBuildingIsolationVisibility } from "./buildingIsolation";
import { disposeObject3D } from "./disposeObject3D";
import { focusEquipmentInWorld } from "./viewerEquipmentFocus";

const smooth = (value) => value * value * (3 - 2 * value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const FLOOR_HIGHLIGHT = new THREE.Color("#ff7900");

function contentBounds(group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  group.traverseVisible((object) => {
    if (!object.isMesh || object.userData.portMarker || object.userData.guide) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some((material) => material?.visible !== false && material?.opacity > 0)) return;
    if (object.isInstancedMesh) object.computeBoundingBox();
    else if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.isInstancedMesh ? object.boundingBox : object.geometry.boundingBox;
    if (box && !box.isEmpty()) bounds.union(box.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)));
  });
  return bounds;
}

function restoreFloorMaterials(entry) {
  entry.materials.forEach(({ mesh, original, copies }) => {
    mesh.material = original;
    copies.forEach((material) => material.dispose());
  });
  entry.materials = [];
}

function bindFloorMaterials(entry) {
  restoreFloorMaterials(entry);
  entry.groups.forEach((group, floorId) => group.traverse((mesh) => {
    if (!mesh.material) return;
    const original = mesh.material;
    const copies = (Array.isArray(original) ? original : [original]).map((material) => material.clone());
    mesh.material = Array.isArray(original) ? copies : copies[0];
    entry.materials.push({ floorId, mesh, original, copies, opacity: 1 });
  }));
}

function createInterior(data, theme, labelRoot, labelClass, onSelectFloor) {
  const root = new THREE.Group();
  root.name = `BuildingObservation:${data.building.id}`;
  root.visible = false;
  const groups = new Map();
  const labels = new Map();
  const options = { selected: false, theme, sceneTheme: SCENE_THEMES[theme], enableLod: false };
  const entry = { data, theme, root, groups, labels, materials: [], localBounds: new Map(), equipmentTargets: new Map(), disposed: false };
  const bindings = new Map((data.assetBindings ?? []).filter((binding) => ["OBJ", "PLY"].includes(binding.assetType)).map((binding) => [binding.equipmentId, binding]));
  const renderOptions = { theme, viewerTranslucent: true, enableLod: false };
  function addEquipment(parent, equipment, floorId) {
    equipment.forEach((item) => entry.equipmentTargets.set(item.id, { item, parent, floorId }));
    const entries = equipment.filter((item) => item.visible !== false).map((item) => ({ equipment: {
      ...item, dimensions: { width: 1, height: 1, depth: 1, ...item.dimensions },
      position: { x: 0, y: 0, z: 0, ...item.position }, rotation: { x: 0, y: 0, z: 0, ...item.rotation },
      appearance: { color: "#6f8f9d", opacity: 1, ...item.appearance }, visible: item.visible !== false,
    }, baseY: 0 }));
    createEquipmentRenderObjects(entries.filter(({ equipment: item }) => !bindings.has(item.id)), renderOptions).forEach((object) => parent.add(object));
    entries.filter(({ equipment: item }) => bindings.has(item.id)).forEach((record) => {
      const [object] = createEquipmentRenderObjects([record], renderOptions);
      parent.add(object);
      const fallback = [...object.children];
      const binding = bindings.get(record.equipment.id);
      // Use the existing local file loader/alignment. One load per cached interior, never per zoom.
      void import("./EquipmentAssetViewer").then(async ({ loadBindingObject, applyAssetAlignment }) => {
        if (entry.disposed) return;
        const loaded = await loadBindingObject(binding);
        if (entry.disposed) { disposeObject3D(loaded.object); loaded.revoke(); return; }
        const aligned = new THREE.Group();
        aligned.add(loaded.object);
        if (!applyAssetAlignment({ actualObject: loaded.object, aligned }, binding, record.equipment)) {
          disposeObject3D(aligned); loaded.revoke(); throw new Error("EMPTY_MODEL");
        }
        aligned.userData.releaseAssetSources = loaded.revoke;
        object.add(aligned);
        fallback.forEach((child) => { child.visible = false; });
        entry.localBounds.set(floorId, contentBounds(groups.get(floorId)));
        if (entry.materials.length) bindFloorMaterials(entry);
      }).catch((error) => {
        if (!entry.disposed) console.warn(`[건축물 관측] ${record.equipment.name}: 등록 모델을 불러오지 못해 기본 설비 형상을 유지합니다.`, error);
      });
    });
  }
  data.floors.forEach((floor) => {
    const group = new THREE.Group();
    group.name = floor.name;
    group.userData.floorId = floor.id;
    group.position.y = finite(floor.elevation);
    const openings = data.verticalStructures.map((structure) => getVerticalStructureOpeningForFloor(structure, data.floors, floor.id, getWorldStructureDimensions(structure))).filter(Boolean);
    const asset = data.building.customAssetSnapshot;
    const footprintBuilding = asset?.bounds ? { ...data.building, customAssetScale: {
      x: data.building.parameters.width / Math.max(0.01, asset.bounds.width),
      z: data.building.parameters.depth / Math.max(0.01, asset.bounds.depth),
    } } : data.building;
    const floorFootprint = floor.plan.floorFootprint?.regions?.length ? floor.plan.floorFootprint : {
      regions: getBuildingFloorFootprintRegions(footprintBuilding, floor.level).map((region) => ({ ...region, outer: region.outer ?? region.points })),
    };
    // A bare inherited slab is the empty state; walls/rooms/equipment only come from saved data.
    const palette = SCENE_THEMES[theme];
    const spatial = createFloorSpatialObject({ ...floor.plan, floorFootprint }, {
      floorStyle: { color: palette.wallFill, roughness: 0.9, metalness: 0.01 }, openings,
    });
    // Reuse the derived shape, including saved holes and stair openings. Extrude down
    // so the walkable surface and equipment elevations remain unchanged.
    spatial.userData.floorMeshes.forEach((mesh) => {
      const geometry = new THREE.ExtrudeGeometry(mesh.geometry.parameters.shapes, {
        depth: 0.16, bevelEnabled: false, curveSegments: 18, steps: 1,
      });
      geometry.rotateX(Math.PI / 2);
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      // Draw the slab in the depth-tested opaque pass. Blended slabs are sorted
      // by their centre and can paint over nearby transparent equipment whose
      // original material does not write depth. MSAA coverage keeps a subtle
      // translucency without depending on that object-level sorting.
      mesh.material.transparent = false;
      mesh.material.alphaToCoverage = true;
      mesh.material.opacity = 0.92;
      // Closed extrusion has outward-facing top, bottom and side faces.
      mesh.material.side = THREE.FrontSide;
      mesh.material.depthWrite = true;
      mesh.material.polygonOffset = true;
      // Slope-scaled bias pulls a large slab through equipment at grazing/front
      // angles. Keep only a constant depth-unit bias for coplanar surfaces.
      mesh.material.polygonOffsetFactor = 0;
      mesh.material.polygonOffsetUnits = -1;
      mesh.material.fog = false;
    });
    group.add(spatial);
    floorFootprint.regions.forEach((region) => {
      const points = createFootprintShape(region).getPoints(18);
      const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, 0.035, point.y))),
        new THREE.LineBasicMaterial({ color: palette.wallEdge, fog: false, depthWrite: false }),
      );
      outline.userData.floorBoundary = true;
      outline.raycast = () => {};
      outline.renderOrder = 2;
      group.add(outline);
    });
    (floor.plan.structures ?? []).forEach((structure) => group.add(createWorldStructureObject(structure, options)));
    addEquipment(group, floor.equipment, floor.id);
    floor.roomScenes.forEach(({ room, equipment, structures }) => {
      const roomGroup = new THREE.Group();
      roomGroup.position.set(finite(room.position?.x), finite(room.position?.y), finite(room.position?.z));
      roomGroup.rotation.set(finite(room.rotation?.x), finite(room.rotation?.y), finite(room.rotation?.z));
      structures.forEach((structure) => roomGroup.add(createWorldStructureObject(structure, options)));
      addEquipment(roomGroup, equipment, floor.id);
      group.add(roomGroup);
    });
    root.add(group);
    groups.set(floor.id, group);
    const label = document.createElement("button");
    label.type = "button";
    label.className = labelClass;
    label.hidden = true;
    label.setAttribute("aria-label", `${floor.name}, ${floor.summary}`);
    const title = document.createElement("strong"); title.textContent = floor.name;
    const summary = document.createElement("span"); summary.textContent = floor.summary;
    label.append(title, summary);
    label.addEventListener("click", () => onSelectFloor(floor.id));
    labelRoot.appendChild(label);
    labels.set(floor.id, label);
  });
  data.verticalStructures.forEach((structure) => {
    if (structure.type === "STAIR") {
      getStairRenderInstances(structure, data.floors).forEach((instance) => {
        const group = groups.get(instance.renderFloorId);
        if (!group) return;
        const object = createStairRenderObject(structure, instance, { ...options, baseElevation: 0 });
        object.position.y -= finite(data.floors.find((floor) => floor.id === instance.renderFloorId)?.elevation);
        group.add(object);
      });
    } else {
      const owner = resolveFloorOwnerId({ ...structure, startFloorId: structure.fromFloorId ?? structure.startFloorId }, data.floors);
      groups.get(owner)?.add(createWorldStructureObject(structure, options));
    }
  });
  entry.localBounds = new Map([...groups].map(([id, group]) => [id, contentBounds(group)]));
  return entry;
}

export function createBuildingObservation(runtime, { labelRoot, labelClass, onSelectFloor, getInsets }) {
  const cache = new Map();
  let active = null;
  let saved = null;
  let sequence = 0;
  let shellMaterials = [];
  let shellVisibility = [];
  let boundShell = null;

  function releaseShell() {
    shellMaterials.forEach(({ mesh, original, copies }) => {
      mesh.material = original;
      copies.forEach((material) => material.dispose());
    });
    shellMaterials = [];
    shellVisibility.forEach(({ object, visible }) => { object.visible = visible; });
    shellVisibility = [];
    boundShell = null;
  }
  function bindShell() {
    const shell = active && runtime.buildingObjects.get(active.entry.data.building.id);
    if (!shell || shell.userData.userTexturePending || shell === boundShell) return;
    releaseShell();
    boundShell = shell;
    shell.traverse((mesh) => {
      // Suppress duplicate slabs/aprons; the roof shares the shell opacity controls.
      if (mesh.userData.floorId || mesh.userData.textureSurface === "EXCLUDE") {
        shellVisibility.push({ object: mesh, visible: mesh.visible });
        mesh.visible = false;
      }
      if (!mesh.material) return;
      const original = mesh.material;
      const copies = (Array.isArray(original) ? original : [original]).map((material) => material.clone());
      mesh.material = Array.isArray(original) ? copies : copies[0];
      shellMaterials.push({ mesh, original, copies });
    });
  }
  function hide(entry) {
    restoreFloorMaterials(entry);
    entry.root.visible = false;
    entry.labels.forEach((label) => { label.hidden = true; });
    entry.data.floors.forEach((floor) => { entry.groups.get(floor.id).position.set(0, finite(floor.elevation), 0); });
  }
  function disposeEntry(entry) {
    entry.disposed = true;
    restoreFloorMaterials(entry);
    entry.labels.forEach((label) => label.remove());
    entry.root.removeFromParent();
    entry.root.traverse((object) => object.userData.releaseAssetSources?.());
    disposeObject3D(entry.root);
  }
  function fit(object, duration = 650, onComplete) {
    const bounds = object.isBox3 ? object : new THREE.Box3().setFromObject(object);
    return focusCameraOnBounds(runtime, bounds, { duration, onComplete, viewportInsets: getInsets() })
      || (!object.isBox3 && focusCameraOnObject(runtime, object, { duration, onComplete }));
  }
  function floorPosition(entry, floor, settings) {
    const bounds = entry.localBounds.get(floor.id);
    const buildingBounds = new THREE.Box3();
    entry.localBounds.forEach((box) => buildingBounds.union(box));
    const width = Math.max(finite(entry.data.building.parameters?.width), buildingBounds.getSize(new THREE.Vector3()).x);
    const depth = Math.max(finite(entry.data.building.parameters?.depth), buildingBounds.getSize(new THREE.Vector3()).z);
    // Pull forward just past the footprint, with a smaller sideways component.
    const forwardOffset = (bounds.isEmpty() ? depth : Math.max(buildingBounds.max.z, depth / 2) - bounds.min.z) + Math.max(depth * 0.06, 0.5);
    const selected = settings.floorId === floor.id;
    return new THREE.Vector3(selected ? width * 0.3 : 0,
      finite(floor.elevation) + (createFloorDisplayOffsets(entry.data.floors, settings.gap).get(floor.id) ?? 0), selected ? forwardOffset : 0);
  }
  function floorBounds(entry, floor, settings) {
    entry.root.updateWorldMatrix(true, false);
    const matrix = new THREE.Matrix4().makeTranslation(...floorPosition(entry, floor, settings).toArray());
    return entry.localBounds.get(floor.id).clone().applyMatrix4(matrix.premultiply(entry.root.matrixWorld));
  }
  function fitFloors(entry, settings, duration = 500) {
    const bounds = new THREE.Box3();
    const selected = entry.data.floors.find((floor) => floor.id === settings.floorId);
    (selected ? [selected] : entry.data.floors).forEach((floor) => bounds.union(floorBounds(entry, floor, settings)));
    if (bounds.isEmpty()) return;
    if (selected) focusCameraOnBounds(runtime, bounds, {
      duration, viewportInsets: getInsets(), centerTarget: true,
      direction: new THREE.Vector3(1, 1.25, 1).applyQuaternion(entry.root.quaternion),
    });
    else fit(bounds, duration);
  }
  function open(focus = true) {
    if (!active || active.phase !== "zoom") return;
    active.phase = "spread";
    active.startedAt = performance.now();
    active.entry.root.visible = true;
    runtime.grid.visible = false;
    runtime.gridRegionRoot.visible = false;
    // The site surface is coplanar with a ground-floor plan; keep it out of detail rendering.
    runtime.ground.visible = false;
    bindShell();
    bindFloorMaterials(active.entry);
    if (focus && !active.settings.equipmentId) fitFloors(active.entry, active.settings, 650);
  }
  function sync(data, settings) {
    if (!data) {
      if (!active) return;
      active.focusAfterClose = settings.focusAfterClose;
      if (active.phase === "closing") return;
      sequence += 1;
      cancelCameraFocus(runtime);
      active.phase = "closing";
      active.startedAt = performance.now();
      active.fromMix = active.mix;
      active.entry.labels.forEach((label) => { label.hidden = true; });
      if (saved) animateCameraFocus(runtime, { position: saved.position, target: saved.target, zoom: saved.zoom }, {
        duration: 550,
        onComplete: () => { if (active?.focusAfterClose) fit(active.focusAfterClose, 500); },
      });
      return;
    }
    const shell = runtime.buildingObjects.get(data.building.id);
    if (!shell) return;
    const existing = cache.get(data.building.id);
    const previous = active && active.entry === existing && active.phase !== "closing" ? active : null;
    if (existing && (existing.data !== data || existing.theme !== settings.theme)) {
      if (active?.entry === existing) { releaseShell(); active = null; }
      disposeEntry(existing); cache.delete(data.building.id);
    }
    let entry = cache.get(data.building.id);
    if (!entry) {
      entry = createInterior(data, settings.theme, labelRoot, labelClass, onSelectFloor);
      cache.set(data.building.id, entry);
      runtime.scene.add(entry.root);
    }
    entry.root.position.copy(shell.position);
    entry.root.quaternion.copy(shell.quaternion);
    // Stored plans and equipment positions are already in building-local metres.
    entry.root.scale.set(1, 1, 1);
    // Rebuilt data/materials do not constitute a new selection or reset an orbit made by the user.
    if (previous && previous.entry !== entry && previous.settings.floorId === settings.floorId) {
      active = { ...previous, entry, settings, phase: "zoom" };
      open(false);
      active.phase = "open";
      active.mix = 1;
      entry.data.floors.forEach((floor) => entry.groups.get(floor.id).position.copy(floorPosition(entry, floor, settings)));
      return;
    }
    if (active?.entry !== entry || active.phase === "closing") {
      const token = ++sequence;
      cancelCameraFocus(runtime);
      if (active) hide(active.entry);
      releaseShell();
      if (!saved) saved = {
        position: runtime.activeCamera.position.clone(), target: runtime.orbitControls.target.clone(), zoom: runtime.activeCamera.zoom,
        visibility: captureBuildingIsolationVisibility(runtime),
      };
      else restoreBuildingIsolationVisibility(runtime, saved.visibility);
      active = { entry, settings, phase: "zoom", mix: 0, startedAt: performance.now(), token };
      applyBuildingIsolationVisibility(runtime, saved.visibility, data.building.id);
      if (settings.floorId || settings.equipmentId) open();
      else fit(shell, 700, () => { if (active?.token === token) open(); });
    } else {
      const changedFloor = active.settings.floorId !== settings.floorId;
      active.settings = settings;
      if (["open", "spread"].includes(active.phase) && changedFloor && !settings.equipmentId) fitFloors(entry, settings);
      if (active.mix > 0) bindShell();
    }
  }
  function update(time, delta) {
    if (!active) return;
    // Reapply after scene updates/rebuilds without replacing the original visibility snapshot.
    applyBuildingIsolationVisibility(runtime, saved.visibility, active.entry.data.building.id);
    // Pointer cancellation ends the zoom phase without leaving a pending transition.
    if (active.phase === "zoom" && !runtime.cameraFocus) open();
    const { entry, settings } = active;
    if (active.phase === "spread") {
      active.mix = smooth(Math.min(1, (time - active.startedAt) / 650));
      if (active.mix === 1) {
        active.phase = "open";
      }
    } else if (active.phase === "closing") active.mix = active.fromMix * (1 - smooth(Math.min(1, (time - active.startedAt) / 550)));
    if (active.mix > 0) bindShell();
    if (active.phase !== "zoom") {
      runtime.ground.visible = false;
      runtime.grid.visible = false;
      runtime.gridRegionRoot.visible = false;
    }
    const offsets = createFloorDisplayOffsets(entry.data.floors, settings.gap);
    entry.data.floors.forEach((floor) => {
      const group = entry.groups.get(floor.id);
      const target = finite(floor.elevation) + offsets.get(floor.id) * active.mix;
      group.position.y = active.phase === "open" ? THREE.MathUtils.lerp(group.position.y, target, 1 - Math.exp(-12 * delta)) : target;
      const position = floorPosition(entry, floor, settings);
      const targetX = active.phase === "closing" ? 0 : position.x * active.mix;
      const targetZ = active.phase === "closing" ? 0 : position.z * active.mix;
      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 1 - Math.exp(-12 * delta));
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 1 - Math.exp(-12 * delta));
    });
    const focusKey = settings.equipmentId ? `${settings.equipmentId}:${settings.selectionVersion}` : null;
    if (!focusKey) active.equipmentFocusKey = null;
    if (focusKey && focusKey !== active.equipmentFocusKey && active.phase === "open") {
      const target = entry.equipmentTargets.get(settings.equipmentId);
      const floor = entry.data.floors.find((item) => item.id === target?.floorId);
      if (floor && entry.groups.get(floor.id).position.distanceTo(floorPosition(entry, floor, settings)) < 0.02) {
        if (focusEquipmentInWorld(runtime, target.parent, target.item, {
          equipmentId: settings.equipmentId, parent: target.parent, viewportInsets: getInsets(),
        })) active.equipmentFocusKey = focusKey;
      }
    }
    entry.materials.forEach((record) => {
      const floorSurface = record.mesh.userData.floorSurface === true;
      const boundary = record.mesh.userData.floorBoundary === true;
      const selected = settings.floorId === record.floorId && active.phase !== "closing";
      const opacity = !floorSurface && !boundary && settings.floorId && !selected && active.phase !== "closing" ? 0.28 : 1;
      record.opacity = opacity === 1 ? 1 : THREE.MathUtils.lerp(record.opacity, opacity, 1 - Math.exp(-12 * delta));
      record.copies.forEach((material, index) => {
        const base = (Array.isArray(record.original) ? record.original : [record.original])[index];
        material.opacity = base.opacity * record.opacity;
        material.transparent = base.transparent || record.opacity < 0.999;
        material.depthWrite = record.opacity > 0.99 && base.depthWrite;
        material.toneMapped = boundary && selected ? false : base.toneMapped;
        if (material.emissive) {
          material.emissive.copy(base.emissive);
          material.emissiveIntensity = base.emissiveIntensity;
          if (selected && floorSurface) {
            material.emissive.copy(FLOOR_HIGHLIGHT);
            material.emissiveIntensity = 0.035;
          }
        }
        if (material.color) {
          material.color.copy(base.color);
          if (selected && floorSurface) material.color.lerp(FLOOR_HIGHLIGHT, 0.2);
          if (selected && boundary) material.color.copy(FLOOR_HIGHLIGHT);
        }
      });
    });
    shellMaterials.forEach(({ original, copies }) => copies.forEach((material, index) => {
      const base = (Array.isArray(original) ? original : [original])[index];
      const shellOpacity = 1 - active.mix * (1 - settings.opacity);
      material.opacity = base.opacity * shellOpacity;
      material.transparent = shellOpacity < 1 || base.transparent;
      material.depthWrite = shellOpacity >= 0.99 && base.depthWrite;
    }));
    if (active.phase === "closing" && time - active.startedAt >= 550) {
      hide(entry); releaseShell();
      restoreBuildingIsolationVisibility(runtime, saved.visibility);
      active = null; saved = null;
    }
  }
  function updateLabels() {
    if (!active || !["spread", "open"].includes(active.phase)) return;
    const { entry, settings } = active;
    const camera = runtime.activeCamera;
    camera.updateMatrixWorld();
    const width = runtime.container.clientWidth, height = runtime.container.clientHeight;
    const insets = getInsets();
    const top = Math.max(12, insets.top), bottom = height - Math.max(12, insets.bottom);
    const left = Math.max(12, insets.left), right = width - Math.max(12, insets.right);
    const rowHeight = 52, labelWidth = 174;
    const projected = entry.data.floors.map((floor) => {
      const group = entry.groups.get(floor.id);
      const bounds = entry.localBounds.get(floor.id);
      const corners = [];
      if (!bounds.isEmpty()) for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = group.localToWorld(new THREE.Vector3(x, bounds.min.y + 0.15, z));
        if (point.clone().applyMatrix4(camera.matrixWorldInverse).z < 0) corners.push(point.project(camera));
      }
      const point = corners.sort((a, b) => b.x - a.x)[0];
      return { floor, point, x: point ? (point.x + 1) * width / 2 + 10 : 0, y: point ? (1 - point.y) * height / 2 - rowHeight / 2 : 0 };
    }).sort((a, b) => Number(b.floor.id === settings.floorId) - Number(a.floor.id === settings.floorId) || a.y - b.y);
    const placed = [];
    projected.forEach(({ floor, point, x: anchorX, y: anchorY }) => {
      const label = entry.labels.get(floor.id);
      label.hidden = true;
      label.setAttribute("aria-pressed", String(settings.floorId === floor.id));
      if (!point || point.z < -1 || point.z > 1 || right - left < labelWidth || bottom - top < rowHeight
        || anchorX < left - 80 || anchorX > right + 80 || anchorY < top - 80 || anchorY > bottom + 80) return;
      const x = THREE.MathUtils.clamp(anchorX, left, right - labelWidth);
      const y = [0, -rowHeight, rowHeight, -rowHeight * 2, rowHeight * 2]
        .map((offset) => THREE.MathUtils.clamp(anchorY + offset, top, bottom - rowHeight))
        .find((candidate) => !placed.some((rect) => x < rect.x + labelWidth + 6 && x + labelWidth + 6 > rect.x
          && candidate < rect.y + rowHeight && candidate + rowHeight > rect.y));
      if (y === undefined) return;
      placed.push({ x, y });
      label.hidden = false;
      label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    });
  }
  return {
    sync, update, updateLabels, releaseShell, isActive: () => Boolean(active),
    pick(raycaster) {
      if (!active || active.phase === "closing" || !active.entry.root.visible) return null;
      const hit = raycaster.intersectObject(active.entry.root, true).find(({ object }) => {
        for (let item = object; item; item = item.parent) if (!item.visible) return false;
        return true;
      });
      for (let object = hit?.object; object; object = object.parent) if (object.userData.floorId) return object.userData.floorId;
      return null;
    },
    dispose() {
      sequence += 1; cancelCameraFocus(runtime); releaseShell();
      if (saved) {
        restoreBuildingIsolationVisibility(runtime, saved.visibility);
        runtime.activeCamera.position.copy(saved.position);
        runtime.orbitControls.target.copy(saved.target);
        runtime.activeCamera.zoom = saved.zoom;
        runtime.activeCamera.updateProjectionMatrix();
      }
      cache.forEach(disposeEntry); cache.clear(); active = null; saved = null;
    },
  };
}
