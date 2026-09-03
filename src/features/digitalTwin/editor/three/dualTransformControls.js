import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  DEFAULT_TRANSFORM_TOOLS,
  getMoveAxisConfiguration,
  getRotationAxisConfiguration,
} from "@/features/digitalTwin/editor/constants/transformTools";

export {
  DEFAULT_TRANSFORM_TOOLS,
  DISABLED_TRANSFORM_TOOLS,
} from "@/features/digitalTwin/editor/constants/transformTools";

export function createDualTransformControls(camera, domElement, scene, { rotationSnap = 5, translationSnap = 0.1 } = {}) {
  const translate = new TransformControls(camera, domElement);
  const rotate = new TransformControls(camera, domElement);
  translate.setMode("translate");
  rotate.setMode("rotate");
  rotate.setSpace("world");
  rotate.setSize(0.82);
  translate.setSize(0.9);
  translate.setTranslationSnap(translationSnap);
  rotate.setRotationSnap(THREE.MathUtils.degToRad(rotationSnap));
  scene.add(translate.getHelper(), rotate.getHelper());
  return { translate, rotate };
}

export function configureDualTransformControls(controls, tools = DEFAULT_TRANSFORM_TOOLS, { camera } = {}) {
  const moveAxes = getMoveAxisConfiguration(tools);
  const rotationAxes = getRotationAxisConfiguration(tools);
  if (camera) {
    controls.translate.camera = camera;
    controls.rotate.camera = camera;
  }
  controls.translate.enabled = moveAxes.enabled;
  controls.rotate.enabled = rotationAxes.enabled;
  controls.translate.getHelper().visible = moveAxes.enabled && Boolean(controls.translate.object);
  controls.rotate.getHelper().visible = rotationAxes.enabled && Boolean(controls.rotate.object);
  controls.translate.showX = moveAxes.showX;
  controls.translate.showY = moveAxes.showY;
  controls.translate.showZ = moveAxes.showZ;
  controls.rotate.showX = rotationAxes.showX;
  controls.rotate.showY = rotationAxes.showY;
  controls.rotate.showZ = rotationAxes.showZ;
}

export function attachDualTransformControls(controls, object, tools, options) {
  if (!object) return detachDualTransformControls(controls);
  controls.translate.attach(object);
  controls.rotate.attach(object);
  configureDualTransformControls(controls, tools, options);
}

export function detachDualTransformControls(controls) {
  controls.translate.detach();
  controls.rotate.detach();
  controls.translate.getHelper().visible = false;
  controls.rotate.getHelper().visible = false;
}

export function dualTransformIsActive(controls) {
  return Boolean(controls.translate.axis || controls.rotate.axis);
}

export function setDualTransformDragging(controls, activeControl, dragging, tools) {
  const other = activeControl === controls.translate ? controls.rotate : controls.translate;
  const otherEnabled = activeControl === controls.translate
    ? getRotationAxisConfiguration(tools).enabled
    : getMoveAxisConfiguration(tools).enabled;
  other.enabled = dragging ? false : otherEnabled;
}

export function disposeDualTransformControls(controls) {
  detachDualTransformControls(controls);
  controls.translate.dispose();
  controls.rotate.dispose();
}
