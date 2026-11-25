import { useEffect, useRef, useState } from "react";
import { createEquipmentCoordinateFrame, equipmentBounds, frontLowerLeft, getEquipmentCoordinateFrame } from "../model/equipmentCoordinateFrame.js";
import NumericField from "./NumericField";
import styles from "./MonitoringSettingsPanel.module.css";

export default function EquipmentCoordinateFrameFields({ equipment, binding, cameraController, onUpdateEquipment, onPendingChange }) {
  const saved = getEquipmentCoordinateFrame(equipment);
  const [yaw, setYaw] = useState(saved?.rotation[1] ?? 0);
  const [origin, setOrigin] = useState(() => saved ? Object.fromEntries(["x", "y", "z"].map((axis, i) => [axis, saved.origin[i]])) : frontLowerLeft(equipmentBounds(equipment)));
  const [originMode, setOriginMode] = useState(saved?.originMode ?? "FRONT_LOWER_LEFT");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState(false);
  const initialized = useRef(Boolean(saved));
  const applied = Boolean(saved && Math.abs(saved.rotation[1] - yaw) < 1e-9
    && ["x", "y", "z"].every((axis, index) => Math.abs(saved.origin[index] - origin[axis]) < 1e-9)
    && (saved.originMode ?? "FRONT_LOWER_LEFT") === originMode);
  useEffect(() => {
    onPendingChange?.(!applied);
    return () => onPendingChange?.(false);
  }, [applied, onPendingChange]);
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
    if (applied || picking) return;
    try {
      const nextOrigin = originMode === "FRONT_LOWER_LEFT" ? frontLowerLeft(currentBounds(), yaw) : origin;
      const coordinateFrame = createEquipmentCoordinateFrame(equipment, nextOrigin, yaw, originMode);
      onUpdateEquipment({ metadata: { coordinateFrame } }); setOrigin(nextOrigin);
      setNotice("");
    } catch (error) { setNotice(error.message); }
  }
  const degrees = Math.round(yaw * 180 / Math.PI * 1000) / 1000;
  const preset = [0, 90, 180, -90].includes(degrees) ? String(degrees) : "CUSTOM";
  return <fieldset className={styles.settingsGroup} data-setup-field="coordinate-frame"><legend>설비 기준좌표 · 필수</legend>
    <div className={styles.coordinateFrameStatus} data-state={applied ? "applied" : "pending"} role="status" aria-live="polite">
      <strong>{applied ? "적용 완료" : saved ? "변경사항 미적용" : "확인 필요"}</strong>
      <span>{applied ? "현재 기준좌표로 다음 단계를 진행할 수 있습니다." : saved ? "정면 또는 원점이 변경되었습니다. 변경사항을 적용하세요." : "정면과 원점을 확인한 뒤 기준좌표를 적용하세요."}</span>
    </div>
    <p className={styles.help}>위쪽은 +Y입니다.</p>
    <label className={styles.field}><span>설비 정면 방향</span><select value={preset} onChange={(event) => { if (event.target.value !== "CUSTOM") changeFront(Number(event.target.value) * Math.PI / 180); }}><option value="0">+Z 방향을 정면으로</option><option value="90">+X 방향을 정면으로</option><option value="180">−Z 방향을 정면으로</option><option value="-90">−X 방향을 정면으로</option><option value="CUSTOM">사용자 지정 각도</option></select></label>
    <NumericField displayPrecision={2} label="Y축 회전각" unit="°" step={1} value={degrees} onChange={(value) => changeFront(value * Math.PI / 180)} />
    <div className={styles.actionRow}><button type="button" onClick={() => cameraController?.current?.coordinateFront?.(yaw)}>설정한 정면에서 보기</button><button type="button" onClick={resetOrigin}>정면 좌측 하단으로 원점 맞춤</button></div>
    <p className={styles.help}>X 오른쪽 · Y 위쪽 · Z 정면 바깥쪽. 설비 내부는 −Z입니다.</p>
    <h4 className={styles.subsectionTitle}>원점 위치 · 모델 기준</h4>
    <div className={styles.axisGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()}축`} unit="m" step={.01} value={origin[axis]} onChange={(value) => { setNotice(""); setOriginMode("CUSTOM"); setOrigin((current) => ({ ...current, [axis]: value })); }} />)}</div>
    <div className={styles.actionRow}><button type="button" aria-pressed={picking} onClick={pickOrigin}>{picking ? "원점 선택 취소" : "모델에서 원점 선택"}</button><button type="button" className={applied ? styles.coordinateFrameApplied : styles.primaryAction} disabled={applied || picking} onClick={apply}>{applied ? "적용 완료" : saved ? "변경사항 적용" : "기준좌표 적용"}</button></div>
    {notice && <p className={styles.help} role="status">{notice}</p>}
  </fieldset>;
}
