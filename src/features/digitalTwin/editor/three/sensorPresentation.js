import * as THREE from "three";
import { getSensorMarkerDiameter, sensorHasImaging } from "../model/equipmentDetailModel.js";

export const SENSOR_FORWARD = Object.freeze([0, -1, 0]);

export function createSensorMarker(sensor, selected = false) {
  const diameter = getSensorMarkerDiameter(sensor);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(diameter / 2, 14, 10),
    new THREE.MeshBasicMaterial({ color: selected ? 0xffc14d : sensorHasImaging(sensor) ? 0x4da8ff : 0x4de0a8 }));
  const length = Math.max(0.12, diameter * 2.5);
  const direction = new THREE.ArrowHelper(new THREE.Vector3(...SENSOR_FORWARD), new THREE.Vector3(), length, 0x40e4d2, length * 0.25, length * 0.15);
  direction.userData.sensorDirection = "FRONT";
  const rear = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, length * 0.6, 0)]), new THREE.LineBasicMaterial({ color: 0x89949e }));
  rear.userData.sensorDirection = "BACK";
  marker.add(direction, rear);
  marker.userData.sensorId = sensor.id;
  return marker;
}
