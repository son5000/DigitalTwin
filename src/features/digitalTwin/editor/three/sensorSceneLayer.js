import { createObservationBadge, updateObservationBadge } from "./observationBadge.js";
import { observationReadings, observationStatus } from "../model/observationReadings.js";
import { getSensorMountPose } from "../model/equipmentEnclosure.js";
import * as THREE from "three";
import { normalizeObservationPoint, getSensorCapabilities } from "../model/equipmentDetailModel.js";
import { createSensorMarker } from "./sensorPresentation.js";
import { disposeObject3D } from "./disposeObject3D.js";
import { createRoiOverlay } from "./roiOverlay.js";
import { planeOrientation } from "../model/observationGeometry.js";
import { createSensorHeatmap } from "./sensorHeatmap.js";
import { resolveImageObservation } from "../model/imageObservation.js";

// Own only sensor markers, point markers and links. Never dispose equipment/scans.
export function createSensorSceneLayer({ root, renderedEquipment, origin, theme = "dark", addCameraFrustum = () => {} }) {
  const markers = new Map();
  const objects = [];
  const pointMarkers = new Map();
  const pointBadges = new Map();
  function imageGeometry(point) {
    const center = new THREE.Vector3(point.localPosition.x,point.localPosition.y,point.localPosition.z);
    const geometry = new THREE.BufferGeometry().setFromPoints((point.imageAnalysis?.world.vertices ?? []).map((v)=>new THREE.Vector3(...v).sub(center)));
    if (point.imageAnalysis) { geometry.setIndex([0,1,2,0,2,3]); geometry.computeVertexNormals(); }
    return geometry;
  }
  function roiColor(level) {
    const palette = theme === "light"
      ? { EMPTY: 0x687b86, NORMAL: 0x197f70, WARNING: 0xa96709, DANGER: 0xbd414c }
      : { EMPTY: 0x91a1aa, NORMAL: 0x5ec5b0, WARNING: 0xe8b45c, DANGER: 0xf17a73 };
    return palette[level] ?? palette.EMPTY;
  }
  function addSphereGuides(marker, radius, color, opacity) {
    const points = Array.from({ length: 64 }, (_, index) => {
      const angle = index / 64 * Math.PI * 2;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    for (const plane of ["XY", "XZ", "YZ"]) {
      const vertices = points.map(([a, b]) => plane === "XY" ? new THREE.Vector3(a, b, 0)
        : plane === "XZ" ? new THREE.Vector3(a, 0, b) : new THREE.Vector3(0, a, b));
      const guide = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      guide.userData.roiOutline = true;
      marker.add(guide);
    }
  }
  function clear() {
    for (const object of objects) { object.removeFromParent(); disposeObject3D(object); }
    objects.length = 0; markers.clear(); pointMarkers.clear(); pointBadges.clear();
  }
  function update({ sensors = [], observationPoints = [], bindings = [], selectedSensorId, selectedPointId, previewReadings, readings, now, editorStage }) {
    clear();
    const sensorPositions = new Map();
    sensors.filter((sensor) => sensor.equipmentIds?.some((id) => renderedEquipment.has(id))).forEach((sensor) => {
      const host = sensor.mountMode === "EQUIPMENT" ? renderedEquipment.get(sensor.surfaceMount?.equipmentId ?? sensor.equipmentIds?.[0]) : null;
      const mountPose = host ? getSensorMountPose(sensor, host.item) : null;
      if (sensor.surfaceMount && !mountPose) return;
      const base = host ? new THREE.Vector3() : new THREE.Vector3(-(Number(origin.x) || 0), -(Number(origin.y) || 0), -(Number(origin.z) || 0));
      const position = base.clone().add(new THREE.Vector3(Number(sensor.position?.x) || 0, Number(sensor.position?.y) || 0, Number(sensor.position?.z) || 0));
      const marker = createSensorMarker(sensor, sensor.id === selectedSensorId);
      marker.position.copy(mountPose?.position ?? position);
      if (mountPose) marker.rotation.copy(mountPose.rotation);
      else marker.rotation.set(Number(sensor.rotation?.x) || 0, Number(sensor.rotation?.y) || 0, Number(sensor.rotation?.z) || 0);
      marker.userData.surfaceMount = sensor.surfaceMount ?? null;
      marker.userData.sensorId = sensor.id;
      marker.userData.sensorEquipmentId = sensor.equipmentIds.find((id) => renderedEquipment.has(id));
      marker.userData.sensorBase = base.toArray();
      if (getSensorCapabilities(sensor).includes("THERMAL")) addCameraFrustum(marker, sensor);

      (host?.object ?? root).add(marker);
      sensorPositions.set(sensor.id, marker.getWorldPosition(new THREE.Vector3()));
      markers.set(sensor.id, marker);
      objects.push(marker);
      if (editorStage === "SENSOR" && sensor.id === selectedSensorId && sensor.heatmap?.preview && getSensorCapabilities(sensor).includes("ULTRASONIC")) {
        const previewEquipmentId = sensor.heatmap.equipmentId ?? sensor.equipmentIds[0];
        const previewHost = sensor.equipmentIds.includes(previewEquipmentId) ? renderedEquipment.get(previewEquipmentId) : null;
        if (previewHost) {
          const p = sensor.heatmap.position;
          const heatmap = createSensorHeatmap(sensor.heatmap, [p.x, p.y, p.z]);
          heatmap.userData.sensorEquipmentId = previewEquipmentId;
          heatmap.userData.samplePreview = true;
          previewHost.object.add(heatmap); objects.push(heatmap);
        }
      }
    });

    const pointPositions = new Map();
    const pointIndices = new Map();
    observationPoints.filter((point) => renderedEquipment.has(point.equipmentId)).map(normalizeObservationPoint)
      .map((point)=>resolveImageObservation(point,renderedEquipment.get(point.equipmentId).item,sensors)).forEach((point) => {
      const host = renderedEquipment.get(point.equipmentId);
      const position = new THREE.Vector3(Number(point.localPosition?.x) || 0, Number(point.localPosition?.y) || 0, Number(point.localPosition?.z) || 0);
      const planar = point.geometryType === "PLANE";
      const selected = point.id === selectedPointId;
      const status = observationStatus(observationReadings(point, sensors, readings, now, previewReadings));
      const stateColor = roiColor(status.level), outlineColor = selected ? (theme === "light" ? 0x056bc8 : 0x89ecff) : stateColor;
      const requestedOpacity = THREE.MathUtils.clamp(point.opacity ?? .25, .05, .8);
      const fillOpacity = selected ? THREE.MathUtils.clamp(requestedOpacity * .55, .1, .26) : THREE.MathUtils.clamp(requestedOpacity * .32, .045, .14);
      const marker = new THREE.Mesh(point.imageBinding ? imageGeometry(point) : planar ? new THREE.PlaneGeometry(point.planeWidth, point.planeHeight) : new THREE.SphereGeometry(point.radius ?? .15, 24, 16), new THREE.MeshBasicMaterial({ color: stateColor, transparent: true, opacity: fillOpacity, depthWrite: false, side: THREE.DoubleSide }));
      if (planar) {
        if (!point.imageBinding) marker.quaternion.copy(planeOrientation(point.targetNormal, point.planeRotation));
        const border = new THREE.LineSegments(new THREE.EdgesGeometry(marker.geometry), new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: selected ? .95 : .68 }));
        border.userData.roiOutline = true;
        marker.add(border);
      } else addSphereGuides(marker, point.radius ?? .15, outlineColor, selected ? .9 : .48);
      marker.position.copy(position);
      marker.userData.sensorEquipmentId = point.equipmentId;
      marker.userData.observationPointId = point.id;
      marker.userData.equipmentId = point.equipmentId;
      marker.userData.representation = point.representation ?? "BOTH";
      marker.userData.imagePoint = point.imageBinding ? point : null;
      marker.userData.imageBindingIssue = point.imageBindingIssue;
      const overlay = createRoiOverlay(marker);
      const index = pointIndices.get(point.equipmentId) ?? 0; pointIndices.set(point.equipmentId, index + 1);
      const badge = createObservationBadge(marker, point, index, status, theme);
      if (badge) pointBadges.set(point.id, badge);
      pointMarkers.set(point.id, marker);
      host.object.add(overlay);
      objects.push(overlay);
      pointPositions.set(point.id, marker.getWorldPosition(new THREE.Vector3()));
    });

    bindings.filter((binding) => renderedEquipment.has(binding.equipmentId)).forEach((binding) => {
      const start = sensorPositions.get(binding.sourceDeviceId);
      const end = pointPositions.get(binding.observationPointId);
      if (!start || !end) return;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineDashedMaterial({ color: 0x68d4ff, dashSize: 0.16, gapSize: 0.1 }),
      );
      line.computeLineDistances();
      line.userData.sensorEquipmentId = binding.equipmentId;
      line.userData.sourceDeviceId = binding.sourceDeviceId;
      line.userData.observationPointId = binding.observationPointId;
      root.add(line);
      objects.push(line);
    });
  }
  function updateVisibility(hiddenSensorId = null, imageVisible = () => true) {
    for (const object of objects) {
      const entry = renderedEquipment.get(object.userData.sensorEquipmentId);
      object.visible = Boolean(entry && !entry.loading)
        && !pointMarkers.get(object.userData.observationPointId)?.userData.imageBindingIssue
        && (!object.userData.imagePoint || imageVisible(object.userData.imagePoint.imageBinding.sensorId))
        && (!object.userData.observationPointId || !object.userData.representation || object.userData.representation === "BOTH"
          || (object.userData.imagePoint
            ? Boolean((object.userData.representation === "ACTUAL" ? entry.actual : entry.proxy)?.visible)
            : object.userData.representation === (entry.actual?.visible ? "ACTUAL" : "PROXY")))
        && !(hiddenSensorId && object.userData.sensorId === hiddenSensorId);
      // Picking reads the mesh's own visibility; keep it aligned with its
      // priority wrapper when loading or switching model representations.
      if (object.isGroup && object.userData.observationPointId) pointMarkers.get(object.userData.observationPointId).visible = object.visible;
    }
  }
  function updateObservationLabels(camera, renderer, selectedId, hoveredId, hidden) {
    for (const [id, badge] of pointBadges) {
      if (hidden) { badge.visible = false; continue; }
      updateObservationBadge(badge, camera, renderer, id === selectedId || id === hoveredId);
    }
  }
  function updateMountedPoses(sensors) {
    for (const marker of pointMarkers.values()) {
      if (!marker.userData.imagePoint) continue;
      const point = resolveImageObservation(marker.userData.imagePoint, renderedEquipment.get(marker.userData.equipmentId)?.item,sensors);
      marker.userData.imageBindingIssue = point.imageBindingIssue;
      marker.geometry.dispose(); marker.geometry = imageGeometry(point);
      const border = marker.children.find((child)=>child.isLineSegments);
      if (border) { border.geometry.dispose(); border.geometry = new THREE.EdgesGeometry(marker.geometry); }
      marker.position.set(point.localPosition.x,point.localPosition.y,point.localPosition.z);
    }
    for (const sensor of sensors) {
      const marker = markers.get(sensor.id), entry = renderedEquipment.get(sensor.surfaceMount?.equipmentId);
      if (!marker || !entry) continue;
      const pose = getSensorMountPose(sensor, entry.item);
      if (pose) { marker.position.copy(pose.position); marker.rotation.copy(pose.rotation); marker.updateWorldMatrix(true, false); }
    }
    for (const line of objects.filter((item) => item.userData.sourceDeviceId)) {
      const marker = markers.get(line.userData.sourceDeviceId);
      const point = pointMarkers.get(line.userData.observationPointId);
      if (!marker || !point) continue;
      const a = root.worldToLocal(marker.getWorldPosition(new THREE.Vector3())), b = root.worldToLocal(point.getWorldPosition(new THREE.Vector3()));
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, a.x, a.y, a.z); positions.setXYZ(1, b.x, b.y, b.z); positions.needsUpdate = true;
      line.geometry.computeBoundingSphere(); line.computeLineDistances();
    }
  }
  return { markers, pointMarkers, update, updateObservationLabels, updateMountedPoses, updateVisibility, dispose: clear };
}
