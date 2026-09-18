import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { rotatePlanView } from "../src/features/digitalTwin/editor/three/planViewRotation.js";

test("2D view rotation keeps zoom, center, and raycast coordinates stable with OrbitControls", () => {
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
  camera.position.set(0, 80, 0.001); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
  camera.zoom = 2; camera.updateProjectionMatrix();
  const controls = new OrbitControls(camera, null);
  controls.enableRotate = false; controls.screenSpacePanning = true;
  controls.target.set(5, 0, -3); camera.position.add(new THREE.Vector3(5, 0, -3)); controls.update();
  const position = camera.position.clone();
  const target = controls.target.clone();
  const direction = camera.getWorldDirection(new THREE.Vector3());
  rotatePlanView(camera, controls, 90);
  controls.update();
  assert.ok(camera.position.distanceTo(position) < 1e-6);
  assert.ok(controls.target.distanceTo(target) < 1e-6);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) < 1e-6);
  assert.equal(camera.zoom, 2);
  assert.ok(camera.up.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  assert.ok(hit.distanceTo(target) < 1e-5);
  rotatePlanView(camera, controls, 0);
  assert.ok(camera.up.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6);
});
