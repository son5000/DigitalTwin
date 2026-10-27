import { useEffect, useRef, useState } from "react";
import { createEquipmentCoordinateFrame, equipmentBounds, frontLowerLeft, getEquipmentCoordinateFrame } from "../model/equipmentCoordinateFrame.js";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

export default function EquipmentCoordinateFrameFields({ equipment, binding, cameraController, onUpdateEquipment }) {
  const saved = getEquipmentCoordinateFrame(equipment);
  const [yaw, setYaw] = useState(saved?.rotation[1] ?? 0);
  const [origin, setOrigin] = useState(() => saved ? Object.fromEntries(["x", "y", "z"].map((axis, i) => [axis, saved.origin[i]])) : frontLowerLeft(equipmentBounds(equipment)));
  const [originMode, setOriginMode] = useState(saved?.originMode ?? "FRONT_LOWER_LEFT");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState(false);
  const initialized = useRef(Boolean(saved));
  useEffect(() => {
    let timer, controller;
    function preview() {
      controller = cameraController?.current;
      if (controller?.equipmentId !== equipment.id) { timer = setTimeout(preview, 100); return; }
      const bounds = controller.coordinateBounds?.();
      if (!initialized.current && originMode === "FRONT_LOWER_LEFT" && bounds) {
        initialized.current = true; setOrigin(frontLowerLeft(bounds, yaw));
      }
      controller.previewCoordinateFrame?.({ origin: [origin.x, origin.y, origin.z], rotation: [0, yaw, 0] });
      if (!bounds && !initialized.current) timer = setTimeout(preview, 100);
    }
    preview();
    return () => { clearTimeout(timer); controller?.previewCoordinateFrame?.(null); controller?.pickCoordinateOrigin?.(null); };
  }, [cameraController, equipment.id, origin, yaw, originMode, binding]);
  function currentBounds() {
    const controller = cameraController?.current;
    const bounds = controller?.equipmentId === equipment.id ? controller.coordinateBounds?.() : null;
    if (binding && !binding.includeProxy && !bounds) throw new Error("스캔 모델을 불러온 뒤 원점을 설정하세요.");
    return bounds ?? equipmentBounds(equipment);
  }
  function changeFront(value) {
    try {
      if (originMode === "FRONT_LOWER_LEFT") setOrigin(frontLowerLeft(currentBounds(), value));
      setYaw(value); setNotice("");
    } catch (error) { setNotice(error.message); }
  }
  function resetOrigin() {
    try { setOrigin(frontLowerLeft(currentBounds(), yaw)); setOriginMode("FRONT_LOWER_LEFT"); setNotice(""); }
    catch (error) { setNotice(error.message); }
  }
  function pickOrigin() {
    const controller = cameraController?.current;
    if (controller?.equipmentId !== equipment.id || !controller.pickCoordinateOrigin) { setNotice("선택 설비 작업 화면에서 원점을 지정하세요."); return; }
    if (picking) { controller.pickCoordinateOrigin(null); setPicking(false); return; }
    setPicking(true); setNotice("모델 표면을 클릭하세요. Esc로 취소합니다.");
    controller.pickCoordinateOrigin((position) => {
      setPicking(false); setNotice("");
      if (position) { setOrigin(position); setOriginMode("CUSTOM"); }
    });
  }
  function apply() {
    try {
      const nextOrigin = originMode === "FRONT_LOWER_LEFT" ? frontLowerLeft(currentBounds(), yaw) : origin;
      const coordinateFrame = createEquipmentCoordinateFrame(equipment, nextOrigin, yaw, originMode);
      onUpdateEquipment({ metadata: { coordinateFrame } }); setOrigin(nextOrigin);
      setNotice("기준좌표를 적용했습니다. 센서·ROI의 실제 위치는 유지됩니다. 프로젝트를 저장하세요.");
    } catch (error) { setNotice(error.message); }
  }
  const degrees = Math.round(yaw * 180 / Math.PI * 1000) / 1000;
  const preset = [0, 90, 180, -90].includes(degrees) ? String(degrees) : "CUSTOM";
  return <fieldset className={styles.settingsGroup} data-setup-field="coordinate-frame"><legend>4. 설비 기준좌표 · 필수</legend>
    <p className={styles.help}>위쪽은 +Y입니다. 정면과 원점을 지정한 뒤 적용하세요.</p>
    <label className={styles.field}><span>설비 정면 방향</span><select value={preset} onChange={(event) => { if (event.target.value !== "CUSTOM") changeFront(Number(event.target.value) * Math.PI / 180); }}><option value="0">+Z 방향을 정면으로</option><option value="90">+X 방향을 정면으로</option><option value="180">−Z 방향을 정면으로</option><option value="-90">−X 방향을 정면으로</option><option value="CUSTOM">사용자 지정 각도</option></select></label>
    <NumericField label="정면 회전각 · Y축" unit="°" step={1} value={degrees} onChange={(value) => changeFront(value * Math.PI / 180)} />
    <div className={styles.actionRow}><button type="button" onClick={() => cameraController?.current?.coordinateFront?.(yaw)}>설정한 정면에서 보기</button><button type="button" onClick={resetOrigin}>정면 좌측 하단으로 원점 맞춤</button></div>
    <p className={styles.help}>X 오른쪽 · Y 위쪽 · Z 정면 바깥쪽. 설비 내부는 −Z입니다.</p>
    <strong>원점 위치 · 모델 기준 m</strong>
    <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField key={axis} label={`원점 ${axis.toUpperCase()}`} unit="m" step={.001} value={origin[axis]} onChange={(value) => { setOriginMode("CUSTOM"); setOrigin((current) => ({ ...current, [axis]: value })); }} />)}</div>
    <div className={styles.actionRow}><button type="button" aria-pressed={picking} onClick={pickOrigin}>{picking ? "원점 선택 취소" : "모델에서 원점 선택"}</button><button type="button" className={styles.primaryAction} onClick={apply}>기준좌표 적용</button></div>
    <p className={styles.help}>{saved ? `적용된 기준 v${saved.version} · ${saved.originMode === "FRONT_LOWER_LEFT" ? "정면 좌측 하단" : "사용자 지정"}` : "미설정 · 기본 원점은 정면 좌측 하단입니다."}</p>
    {notice && <p className={styles.help} role="status">{notice}</p>}
  </fieldset>;
}
