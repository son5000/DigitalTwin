import * as THREE from "three";
import { getEnclosureDoorEntries, getEnclosureScanSlot, getEnclosureSurfaces, getSensorMountPose } from "../model/equipmentEnclosure";
import NumericField from "./NumericField";
import { getEquipmentCoordinateFrame, modelToReference, referenceToModel, scanSlotToModel } from "../model/equipmentCoordinateFrame.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorMountFields({ equipment, sensor, onChange }) {
  const surfaces = getEnclosureSurfaces(equipment).filter((surface) => !surface.id.endsWith("-doors-outside"));
  const mount = sensor.surfaceMount;
  const slotMount = sensor.scanSlotMount;
  const slotOptions = getEnclosureDoorEntries(equipment).map((door) => ({ door, slot: getEnclosureScanSlot(equipment, door.index, door.side) })).filter(({ slot }) => slot);
  const activeSlot = slotMount ? getEnclosureScanSlot(equipment, slotMount.index, slotMount.side) : null;
  const slotPosition = slotMount?.position ?? { x: 0, y: 0, z: 0 };
  const pose = getSensorMountPose(sensor, equipment);
  const frame = getEquipmentCoordinateFrame(equipment);
  const position = sensor.mountMode === "WORLD" && !mount ? sensor.position : modelToReference(pose?.position ?? sensor.position, frame);
  function update(changes) { onChange(sensor.id, changes); }
  function attach(id) {
    const surface = surfaces.find((item) => item.id === id);
    if (!surface) return;
    update({ mountMode: "EQUIPMENT", equipmentIds: [equipment.id, ...sensor.equipmentIds.filter((value) => value !== equipment.id)], scanSlotMount: null, surfaceMount: { equipmentId: equipment.id, surfaceId: id, u: surface.width / 2, v: surface.height / 2, offset: .025 }, rotation: { x: 0, y: 0, z: 0 } });
  }
  function selectSlot(option) {
    if (!option) return;
    const { door, slot } = option;
    const previous = slotMount?.position;
    const local = { x: Math.max(0, Math.min(slot.dimensions.width, previous?.x ?? slot.dimensions.width / 2)),
      y: Math.max(0, Math.min(slot.dimensions.height, previous?.y ?? slot.dimensions.height / 2)),
      z: Math.max(-slot.dimensions.depth, Math.min(0, previous?.z ?? -Math.min(.05, slot.dimensions.depth / 2))) };
    update({ mountMode: "EQUIPMENT", equipmentIds: [equipment.id, ...sensor.equipmentIds.filter((value) => value !== equipment.id)], surfaceMount: null,
      scanSlotMount: { equipmentId: equipment.id, side: door.side, index: door.index, position: local }, position: scanSlotToModel(local, slot) });
  }
  function updateSlot(axis, value) {
    if (!activeSlot) return;
    const limit = activeSlot.dimensions[{ x: "width", y: "height", z: "depth" }[axis]];
    const local = { ...slotPosition, [axis]: axis === "z" ? -Math.max(0, Math.min(limit, value / 100)) : Math.max(0, Math.min(limit, value / 100)) };
    update({ scanSlotMount: { ...slotMount, position: local }, position: scanSlotToModel(local, activeSlot) });
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
    update({ surfaceMount: null, scanSlotMount: null, mountMode: mode, position: { x: position.x, y: position.y, z: position.z }, rotation: { x: euler.x, y: euler.y, z: euler.z } });
  }
  return <fieldset className={styles.settingsGroup} data-setup-field="sensor-mount"><legend>센서 부착 위치 · 필수</legend>
    <p className={styles.help}>{frame ? `설비 기준좌표 v${frame.version} · 단위 m` : "2단계에서 설비 기준좌표를 먼저 적용하세요. 현재는 기존 모델 좌표입니다."}</p>
    <label className={styles.field}><span>설치 방식</span><select value={mount ? "SURFACE" : slotMount ? "SCAN_SLOT" : sensor.mountMode} onChange={(event) => event.target.value === "SURFACE" ? attach(surfaces[0]?.id) : event.target.value === "SCAN_SLOT" ? selectSlot(slotOptions[0]) : detach(event.target.value)}><option value="SURFACE" disabled={!surfaces.length}>외관 표면에 부착</option><option value="SCAN_SLOT" disabled={!slotOptions.length}>서랍 안쪽 · 실측 위치</option><option value="EQUIPMENT">설비 기준 좌표</option><option value="WORLD">외부 구조물 · 월드 좌표</option></select></label>
    {mount ? <>
      <label className={styles.field}><span>부착면</span><select value={mount.surfaceId} onChange={(event) => attach(event.target.value)}>{!pose && <option value={mount.surfaceId}>부착면을 다시 선택하세요</option>}{surfaces.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}</select></label>
      {pose ? <>
        <output className={styles.help}>설비 기준 XYZ · {["x", "y", "z"].map((axis) => position[axis].toFixed(3)).join(", ")} m</output>
        <p className={styles.help}>선택한 부착면을 정면에서 본 왼쪽 아래 기준입니다. 방향은 선택한 면을 기준으로 조절합니다.</p>
        <NumericField displayPrecision={1} label="왼쪽 끝에서 X" unit="cm" min={0} step={.1} value={mount.u * 100} onChange={(u) => update({ surfaceMount: { ...mount, u: Math.max(0, Math.min(pose.surface.width, u / 100)) } })} />
        <NumericField displayPrecision={1} label="아래쪽 끝에서 Y" unit="cm" min={0} step={.1} value={mount.v * 100} onChange={(v) => update({ surfaceMount: { ...mount, v: Math.max(0, Math.min(pose.surface.height, v / 100)) } })} />
        <NumericField label="표면에서 센서 중심까지" unit="mm" min={0} step={1} value={mount.offset * 1000} onChange={(value) => update({ surfaceMount: { ...mount, offset: Math.max(0, Math.min(2, value / 1000)) } })} />
        {!pose.surface.visible && <p className={styles.help}>문은 숨겨져 있습니다. 센서는 열린 문에 부착된 위치입니다.</p>}
        {pose.adjusted && <p role="alert">외관 크기가 바뀌어 센서가 가장자리로 이동했습니다. 부착 위치를 다시 확인하세요.</p>}
      </> : <p role="alert">외관이나 문 구성이 바뀌었습니다. 부착면을 다시 지정하세요.</p>}
    </> : slotMount ? <>
      <label className={styles.field}><span>설치된 서랍</span><select value={`${slotMount.side}:${slotMount.index}`} onChange={(event) => selectSlot(slotOptions.find(({ slot }) => slot.id === event.target.value))}>{slotOptions.map(({ door, slot }) => <option key={slot.id} value={slot.id}>{door.label}</option>)}</select></label>
      {activeSlot ? <>
        <p className={styles.help}>선택한 서랍의 앞쪽 왼쪽 바닥을 기준으로 줄자로 잰 거리를 입력하세요. 안쪽 깊이는 정면에서 안으로 들어가는 거리입니다.</p>
        <p className={styles.help}>서랍 내부 크기 · 가로 {(activeSlot.dimensions.width * 100).toFixed(1)} cm · 높이 {(activeSlot.dimensions.height * 100).toFixed(1)} cm · 깊이 {(activeSlot.dimensions.depth * 100).toFixed(1)} cm</p>
        <div className={styles.rangeGrid}><NumericField displayPrecision={1} label="왼쪽에서 X" unit="cm" min={0} step={.1} value={slotPosition.x * 100} onChange={(value) => updateSlot("x", value)} /><NumericField displayPrecision={1} label="바닥에서 Y" unit="cm" min={0} step={.1} value={slotPosition.y * 100} onChange={(value) => updateSlot("y", value)} /><NumericField displayPrecision={1} label="정면에서 안쪽 Z" unit="cm" min={0} step={.1} value={-slotPosition.z * 100} onChange={(value) => updateSlot("z", value)} /></div>
        {!pose && <p role="alert">저장된 서랍 기준점이 유효하지 않습니다. 설치된 서랍과 실측 위치를 다시 선택하세요.</p>}
        {pose?.adjusted && <p role="alert">서랍 크기가 변경되어 설치 위치가 범위를 벗어났습니다. 실측 거리를 다시 입력하세요.</p>}
        <p className={styles.help}>현장 치수로 대략 배치합니다. 신호 위치를 검증한 뒤 센서 방향과 위치를 보정하세요.</p>
      </> : <p role="alert">연결된 서랍을 찾을 수 없습니다. 설치된 서랍을 다시 선택하세요.</p>}
    </> : <>
      <p className={styles.help}>{sensor.mountMode === "WORLD" ? "기둥처럼 표시하지 않는 구조물에 설치할 때 사용하세요." : "스캔 표면의 실제 위치를 설비 기준으로 입력하세요."}</p>
      <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`${axis.toUpperCase()} 위치`} unit="m" step={.001} value={position?.[axis] ?? 0} onChange={(value) => update({ position: sensor.mountMode === "WORLD" ? { ...position, [axis]: value } : referenceToModel({ ...position, [axis]: value }, frame) })} />)}</div>
      {!surfaces.length && <p className={styles.help}>내벽·문에 부착하려면 2단계에서 캐비넷 외관을 구성하세요.</p>}
    </>}
  </fieldset>;
}
