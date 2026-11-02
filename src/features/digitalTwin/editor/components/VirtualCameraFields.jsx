import { useState } from "react";
import styles from "./MonitoringSettingsPanel.module.css";

export default function VirtualCameraFields({ equipment, cameras, cameraController, points = [], onChange, onOpen }) {
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [draftNames, setDraftNames] = useState({});
  function save() {
    const controller = cameraController?.current;
    if (!controller?.ready() || controller.equipmentId !== equipment.id) { setNotice("설비 모델이 로드된 뒤 시점을 저장하세요."); return; }
    const label = name.trim() || `가상 카메라 ${cameras.length + 1}`;
    const camera = { id: crypto.randomUUID(), name: label, view: controller.capture(), doorState: controller.captureDoorState() };
    onChange([...cameras, camera]); setName(""); setNotice(`‘${label}’ 시점을 저장했습니다.`);
  }
  return <section className={styles.settingsGroup} data-setup-field="virtual-camera-add" aria-label="가상 카메라 설정">
    <div className={styles.sectionHeading}><strong>가상 카메라</strong><span>{cameras.length}개</span></div>
    <p className={styles.help}>문을 원하는 상태로 열거나 닫고 3D 월드를 이동한 뒤 저장하세요. 시점과 문 상태를 함께 기억하며 이미지는 선택할 때 생성합니다.</p>
    <label className={styles.field}><span>시점 이름</span><input value={name} maxLength={80} placeholder={`가상 카메라 ${cameras.length + 1}`} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" className={styles.primaryAction} onClick={save}>현재 시점 추가</button>
    {notice && <p className={styles.help} role="status">{notice}</p>}
    {cameras.length > 0 && <div className={styles.roiEditor}>{cameras.map((camera, index) => <div key={camera.id} className={styles.settingsGroup}>
      <label className={styles.field}><span>{index + 1}. 이름</span><input value={draftNames[camera.id] ?? camera.name} maxLength={80}
        onChange={(event) => setDraftNames((current) => ({ ...current, [camera.id]: event.target.value }))}
        onBlur={() => { const next = draftNames[camera.id]?.trim(); if (next) onChange(cameras.map((item) => item.id === camera.id ? { ...item, name: next } : item)); setDraftNames((current) => { const copy = { ...current }; delete copy[camera.id]; return copy; }); }} /></label>
      {camera.doorState && <p className={styles.help}>문 상태 · {camera.doorState.frontOpen.map((open, i) => `앞 ${i + 1} ${open ? "열림" : "닫힘"}`).concat(camera.doorState.rearOpen.map((open, i) => `뒤 ${i + 1} ${open ? "열림" : "닫힘"}`)).join(" · ")}</p>}
      <div className={styles.actionRow}>
        <button type="button" onClick={() => onOpen(camera.id)}>시점 확인</button>
        <button type="button" disabled={points.some((point) => point.virtualCameraRegion?.cameraId === camera.id)} onClick={() => { const controller = cameraController?.current; if (!controller?.ready() || controller.equipmentId !== equipment.id) { setNotice("설비 모델이 로드된 뒤 시점을 갱신하세요."); return; } const view = controller.capture(); onChange(cameras.map((item) => item.id === camera.id ? { ...item, view, doorState: controller.captureDoorState() } : item)); }}>현재 시점으로 갱신</button>
        <button type="button" disabled={points.some((point) => point.virtualCameraRegion?.cameraId === camera.id)} onClick={() => onChange(cameras.filter((item) => item.id !== camera.id))}>삭제</button>
      </div>
      {points.some((point) => point.virtualCameraRegion?.cameraId === camera.id) && <p className={styles.help}>이 시점에 관측 영역이 연결되어 있습니다. 시점 변경·삭제는 해당 영역을 제거한 뒤 가능합니다.</p>}
    </div>)}</div>}
  </section>;
}
