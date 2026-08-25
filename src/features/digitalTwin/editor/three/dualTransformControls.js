import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export const DEFAULT_TRANSFORM_TOOLS = Object.freeze({ translate: true, rotate: false });

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

export function configureDualTransformControls(controls, tools, {
  camera,
  allowVerticalTranslation = false,
} = {}) {
  const translateEnabled = Boolean(tools?.translate);
  const rotateEnabled = Boolean(tools?.rotate);
  if (camera) {
    controls.translate.camera = camera;
    controls.rotate.camera = camera;
  }
  controls.translate.enabled = translateEnabled;
  controls.rotate.enabled = rotateEnabled;
  controls.translate.getHelper().visible = translateEnabled && Boolean(controls.translate.object);
  controls.rotate.getHelper().visible = rotateEnabled && Boolean(controls.rotate.object);
  controls.translate.showX = true;
  controls.translate.showY = allowVerticalTranslation;
  controls.translate.showZ = true;
  controls.rotate.showX = false;
  controls.rotate.showY = true;
  controls.rotate.showZ = false;
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
  other.enabled = dragging ? false : Boolean(activeControl === controls.translate ? tools?.rotate : tools?.translate);
}

export function disposeDualTransformControls(controls) {
  detachDualTransformControls(controls);
  controls.translate.dispose();
  controls.rotate.dispose();
}
