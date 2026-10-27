import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SENSOR_APPEARANCES, getSensorAppearance } from "../model/equipmentDetailModel.js";
import { createSensorModel } from "../three/sensorModels.js";
import { disposeObject3D } from "../three/disposeObject3D.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorAppearanceFields({ sensor, onChange }) {
  const previewRef = useRef(null);
  const appearance = getSensorAppearance(sensor);
  const definition = SENSOR_APPEARANCES.find(({ id }) => id === appearance);
  useEffect(() => {
    const host = previewRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(260, 150);
    const scene = new THREE.Scene();
    const model = createSensorModel(appearance);
    model.rotation.x = 0;
    scene.add(model, new THREE.HemisphereLight(0xffffff, 0x596979, 2.6));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 4, 5); scene.add(light);
    const camera = new THREE.PerspectiveCamera(35, 260 / 150, .01, 10);
    camera.position.set(1.2, .85, 1.8); camera.lookAt(0, 0, 0);
    renderer.render(scene, camera); host.appendChild(renderer.domElement);
    return () => { renderer.domElement.remove(); disposeObject3D(model); renderer.dispose(); };
  }, [appearance]);
  return <fieldset className={styles.settingsGroup}>
    <legend>월드 표시 모형</legend>
    <div ref={previewRef} className={styles.sensorModelPreview} role="img" aria-label={`${definition.label} 3D 미리보기`} />
    <div className={styles.appearanceOptions} role="group" aria-label="센서·카메라 모형 선택">
      {SENSOR_APPEARANCES.map(({ id, label, description }) => <button key={id} type="button" aria-pressed={appearance === id} title={description} onClick={() => onChange(sensor.id, { appearance: id })}>{label}</button>)}
    </div>
    <p className={styles.help}>{definition.description} · 센서별로 저장됩니다.</p>
  </fieldset>;
}
