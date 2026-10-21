import { createObservationBadge, updateObservationBadge } from "./observationBadge.js";
import { observationReadings, observationStatus } from "../model/observationReadings.js";
import { getSensorMountPose } from "../model/equipmentEnclosure.js";
import * as THREE from "three";
import { normalizeObservationPoint, sensorHasImaging } from "../model/equipmentDetailModel.js";
import { createSensorMarker } from "./sensorPresentation.js";
import { disposeObject3D } from "./disposeObject3D.js";

// Own only sensor markers, point markers and links. Never dispose equipment/scans.
export function createSensorSceneLayer({ root, renderedEquipment, origin, addCameraFrustum = () => {} }) {
  const markers = new Map();
  const objects = [];
  const pointMarkers = new Map();
  const pointBadges = new Map();
  function clear() {
    for (const object of objects) { object.removeFromParent(); disposeObject3D(object); }
    objects.length = 0; markers.clear(); pointMarkers.clear(); pointBadges.clear();
  }
  function update({ sensors = [], observationPoints = [], bindings = [], selectedSensorId, selectedPointId, previewReadings, readings, now }) {
    clear();
    const sensorPositions = new Map();
    sensors.filter((sensor) => sensor.equipmentIds?.some((id) => renderedEquipment.has(id))).forEach((sensor) => {
      const host = sensor.mountMode === "EQUIPMENT" ? renderedEquipment.get(sensor.surfaceMount?.equipmentId ?? sensor.equipmentIds?.[0]) : null;
      const mountPose = host ? getSensorMountPose(sensor, host.item) : null;
      if (sensor.surfaceMount && !mountPose) return;
      const base = host ? new THREE.Vector3() : new THREE.Vector3(-(Number(origin.x) || 0), -(Number(origin.y) || 0), -(Number(origin.z) || 0));
      const position = base.clone().add(new THREE.Vector3(Number(sensor.position?.x) || 0, Number(sensor.position?.y) || 0, Number(sensor.position?.z) || 0));
      const isCamera = sensorHasImaging(sensor);
      const marker = createSensorMarker(sensor, sensor.id === selectedSensorId);
      marker.position.copy(mountPose?.position ?? position);
      if (mountPose) marker.rotation.copy(mountPose.rotation);
      else marker.rotation.set(Number(sensor.rotation?.x) || 0, Number(sensor.rotation?.y) || 0, Number(sensor.rotation?.z) || 0);
      marker.userData.surfaceMount = sensor.surfaceMount ?? null;
      marker.userData.sensorId = sensor.id;
      marker.userData.sensorEquipmentId = sensor.equipmentIds.find((id) => renderedEquipment.has(id));
      marker.userData.sensorBase = base.toArray();
      if (isCamera) addCameraFrustum(marker, sensor);

      (host?.object ?? root).add(marker);
      sensorPositions.set(sensor.id, marker.getWorldPosition(new THREE.Vector3()));
      markers.set(sensor.id, marker);
      objects.push(marker);
    });

    const pointPositions = new Map();
    const pointIndices = new Map();
    observationPoints.filter((point) => renderedEquipment.has(point.equipmentId)).map(normalizeObservationPoint).forEach((point) => {
      const host = renderedEquipment.get(point.equipmentId);
      const position = new THREE.Vector3(Number(point.localPosition?.x) || 0, Number(point.localPosition?.y) || 0, Number(point.localPosition?.z) || 0);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(point.radius ?? .15, 24, 16), new THREE.MeshBasicMaterial({ color: point.id === selectedPointId ? 0x68d4ff : 0xffc14d, transparent: true, opacity: point.opacity ?? .25, depthWrite: false }));
      marker.position.copy(position);
      marker.userData.sensorEquipmentId = point.equipmentId;
      marker.userData.observationPointId = point.id;
      const index = pointIndices.get(point.equipmentId) ?? 0; pointIndices.set(point.equipmentId, index + 1);
      const badge = createObservationBadge(marker, point, index, observationStatus(observationReadings(point, sensors, readings, now, previewReadings)));
      if (badge) pointBadges.set(point.id, badge);
      pointMarkers.set(point.id, marker);
      host.object.add(marker);
      objects.push(marker);
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
  function updateVisibility(hiddenSensorId = null) {
    for (const object of objects) {
      const entry = renderedEquipment.get(object.userData.sensorEquipmentId);
      object.visible = Boolean(entry && !entry.loading)
        && !(hiddenSensorId && object.userData.sensorId === hiddenSensorId);
    }
  }
  function updateObservationLabels(camera, renderer, selectedId, hoveredId, hidden) {
    for (const [id, badge] of pointBadges) {
      if (hidden) { badge.visible = false; continue; }
      updateObservationBadge(badge, camera, renderer, id === selectedId || id === hoveredId);
    }
  }
  function updateMountedPoses(sensors) {
    for (const sensor of sensors) {
      const marker = markers.get(sensor.id), entry = renderedEquipment.get(sensor.surfaceMount?.equipmentId);
      if (!marker || !entry) continue;
      const pose = getSensorMountPose(sensor, entry.item);
      if (pose) { marker.position.copy(pose.position); marker.rotation.copy(pose.rotation); marker.updateWorldMatrix(true, false); }
    }
    for (const line of objects.filter((item) => item.userData.sourceDeviceId)) {
      const marker = markers.get(line.userData.sourceDeviceId);
      const point = objects.find((item) => item.isMesh && item.userData.observationPointId === line.userData.observationPointId);
      if (!marker || !point) continue;
      const a = root.worldToLocal(marker.getWorldPosition(new THREE.Vector3())), b = root.worldToLocal(point.getWorldPosition(new THREE.Vector3()));
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, a.x, a.y, a.z); positions.setXYZ(1, b.x, b.y, b.z); positions.needsUpdate = true;
      line.geometry.computeBoundingSphere(); line.computeLineDistances();
    }
  }
  return { markers, pointMarkers, update, updateObservationLabels, updateMountedPoses, updateVisibility, dispose: clear };
}
