import * as THREE from "three";
import { getEnclosureSurfaces, getSensorMountPose } from "../model/equipmentEnclosure";
import NumericField from "./NumericField";
import { getEquipmentCoordinateFrame, modelToReference, referenceToModel } from "../model/equipmentCoordinateFrame.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorMountFields({ equipment, sensor, onChange }) {
  const surfaces = getEnclosureSurfaces(equipment);
  const mount = sensor.surfaceMount;
  const pose = getSensorMountPose(sensor, equipment);
  const frame = getEquipmentCoordinateFrame(equipment);
  const position = sensor.mountMode === "WORLD" && !mount ? sensor.position : modelToReference(pose?.position ?? sensor.position, frame);
  function update(changes) { onChange(sensor.id, changes); }
  function attach(id) {
    const surface = surfaces.find((item) => item.id === id);
    if (!surface) return;
    update({ mountMode: "EQUIPMENT", equipmentIds: [equipment.id, ...sensor.equipmentIds.filter((value) => value !== equipment.id)], surfaceMount: { equipmentId: equipment.id, surfaceId: id, u: surface.width / 2, v: surface.height / 2, offset: .025 }, rotation: { x: 0, y: 0, z: 0 } });
  }
  function detach(mode) {
    const position = pose?.position.clone() ?? new THREE.Vector3(sensor.position.x, sensor.position.y, sensor.position.z);
    const rotation = new THREE.Quaternion().setFromEuler(pose?.rotation ?? new THREE.Euler(sensor.rotation.x, sensor.rotation.y, sensor.rotation.z));
    const hostRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(equipment.rotation?.x ?? 0, equipment.rotation?.y ?? 0, equipment.rotation?.z ?? 0));
    const hostPosition = new THREE.Vector3(equipment.position?.x ?? 0, equipment.position?.y ?? 0, equipment.position?.z ?? 0);
    if (mode !== sensor.mountMode) {
      if (mode === "WORLD") { position.applyQuaternion(hostRotation).add(hostPosition); rotation.premultiply(hostRotation); }
      else { position.sub(hostPosition).applyQuaternion(hostRotation.clone().invert()); rotation.premultiply(hostRotation.clone().invert()); }
    }
    const euler = new THREE.Euler().setFromQuaternion(rotation, "XYZ");
    update({ surfaceMount: null, mountMode: mode, position: { x: position.x, y: position.y, z: position.z }, rotation: { x: euler.x, y: euler.y, z: euler.z } });
  }
  return <fieldset className={styles.settingsGroup} data-setup-field="sensor-mount"><legend>센서 부착 위치 · 필수</legend>
    <p className={styles.help}>{frame ? `설비 기준좌표 v${frame.version} · 단위 m` : "2단계에서 설비 기준좌표를 먼저 적용하세요. 현재는 기존 모델 좌표입니다."}</p>
    <label className={styles.field}><span>설치 방식</span><select value={mount ? "SURFACE" : sensor.mountMode} onChange={(event) => event.target.value === "SURFACE" ? attach(surfaces[0]?.id) : detach(event.target.value)}><option value="SURFACE" disabled={!surfaces.length}>외관 표면에 부착</option><option value="EQUIPMENT">설비 기준 좌표</option><option value="WORLD">외부 구조물 · 월드 좌표</option></select></label>
    {mount ? <>
      <label className={styles.field}><span>부착면</span><select value={mount.surfaceId} onChange={(event) => attach(event.target.value)}>{!pose && <option value={mount.surfaceId}>부착면을 다시 선택하세요</option>}{surfaces.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}</select></label>
      {pose ? <>
        <output className={styles.help}>설비 기준 XYZ · {["x", "y", "z"].map((axis) => position[axis].toFixed(3)).join(", ")} m</output>
        <p className={styles.help}>부착면을 정면에서 본 기준입니다. 방향은 선택한 면을 기준으로 조절합니다.</p>
        <NumericField label="왼쪽 끝에서" unit="m" min={0} step={.001} value={mount.u} onChange={(u) => update({ surfaceMount: { ...mount, u: Math.max(0, Math.min(pose.surface.width, u)) } })} />
        <NumericField label="아래쪽 끝에서" unit="m" min={0} step={.001} value={mount.v} onChange={(v) => update({ surfaceMount: { ...mount, v: Math.max(0, Math.min(pose.surface.height, v)) } })} />
        <NumericField label="표면에서 센서 중심까지" unit="mm" min={0} step={1} value={mount.offset * 1000} onChange={(value) => update({ surfaceMount: { ...mount, offset: Math.max(0, Math.min(2, value / 1000)) } })} />
        {!pose.surface.visible && <p className={styles.help}>문은 숨겨져 있습니다. 센서는 열린 문에 부착된 위치입니다.</p>}
        {pose.adjusted && <p role="alert">외관 크기가 바뀌어 센서가 가장자리로 이동했습니다. 부착 위치를 다시 확인하세요.</p>}
      </> : <p role="alert">외관이나 문 구성이 바뀌었습니다. 부착면을 다시 지정하세요.</p>}
    </> : <>
      <p className={styles.help}>{sensor.mountMode === "WORLD" ? "기둥처럼 표시하지 않는 구조물에 설치할 때 사용하세요." : "스캔 표면의 실제 위치를 설비 기준으로 입력하세요."}</p>
      <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`${axis.toUpperCase()} 위치`} unit="m" step={.001} value={position?.[axis] ?? 0} onChange={(value) => update({ position: sensor.mountMode === "WORLD" ? { ...position, [axis]: value } : referenceToModel({ ...position, [axis]: value }, frame) })} />)}</div>
      {!surfaces.length && <p className={styles.help}>내벽·문에 부착하려면 2단계에서 캐비넷 외관을 구성하세요.</p>}
    </>}
  </fieldset>;
}
