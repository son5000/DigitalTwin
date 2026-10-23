import EquipmentEnclosureFields from "./EquipmentEnclosureFields";
import { useState } from "react";
import EquipmentEnvironmentFields from "./EquipmentEnvironmentFields";
import NumericField from "./NumericField";
import EquipmentCoordinateFrameFields from "./EquipmentCoordinateFrameFields";
import { DEFAULT_SCAN_LIGHTING, normalizeScanLighting } from "../model/viewerPreset";
import styles from "./MonitoringSettingsPanel.module.css";

export default function EquipmentModelSetupPanel({ workspaceViewControllerRef, equipmentCount, equipment, binding, onUpdateEquipment, onUpdateAsset, viewerPreset, onViewerPresetChange, onEquipmentRepresentationChange, cameraController }) {
  const [notice, setNotice] = useState("");
  const [cameraInfo, setCameraInfo] = useState(null);
  const alignment = binding?.alignmentTransform;
  const lighting = normalizeScanLighting(viewerPreset?.lighting);
  const savedView = viewerPreset?.equipmentViews?.[equipment.id];
  function align(changes) { onUpdateAsset(binding.id, { alignmentTransform: changes }); }
  function cameraAction(action, value) {
    const controller = cameraController?.current;
    if (!controller || controller.equipmentId !== equipment.id) { setNotice("아래 ‘선택 설비 작업’ 화면에서 모델 로딩을 완료한 뒤 설정하세요."); return; }
    if (binding && !controller.ready()) { setNotice("스캔 모델 표시를 선택하고 로딩이 완료된 뒤 설정하세요."); return; }
    if (action === "save") {
      onViewerPresetChange({ equipmentViews: { ...viewerPreset?.equipmentViews, [equipment.id]: controller.capture() } });
      setNotice("최초 관제 화면을 지정했습니다. 프로젝트를 저장해 보관하세요.");
    } else { controller[action]?.(value); setNotice(""); }
    setCameraInfo(controller.capture());
  }
  return <>
    <EquipmentEnclosureFields equipment={equipment} binding={binding} onUpdateEquipment={onUpdateEquipment} onUpdateAsset={onUpdateAsset} onEquipmentRepresentationChange={onEquipmentRepresentationChange} />
    <fieldset className={styles.settingsGroup}><legend>관리자 작업 화면 · 현재 편집용</legend>
      <p className={styles.help}>작업할 화면을 선택하세요. 관제 시작 화면은 아래에서 따로 저장할 수 있습니다.</p>
      <div className={styles.actionRow}><button type="button" onClick={() => workspaceViewControllerRef?.current?.setView("SELECTED")}>선택 설비 작업</button><button type="button" disabled={equipmentCount < 2} onClick={() => workspaceViewControllerRef?.current?.setView("ALL")}>전체 설비 배치 확인</button><button type="button" onClick={() => workspaceViewControllerRef?.current?.setView("SENSORS")}>센서 배치 확인</button><button type="button" onClick={() => workspaceViewControllerRef?.current?.addEquipment()}>설비 추가</button></div>
    </fieldset>
    <fieldset className={styles.settingsGroup}><legend>1. 모델 방향·정면</legend>
      <p className={styles.help}>설비가 똑바로 보이도록 방향을 맞추세요.</p>
      {alignment ? <>
        <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={1} key={axis} label={`${axis.toUpperCase()}축 회전`} unit="°" step={1} value={alignment.rotation[axis] * 180 / Math.PI} onChange={(value) => align({ rotation: { [axis]: value * Math.PI / 180 } })} />)}</div>
        <div className={styles.actionRow}>{[["x", "앞뒤 기울이기"], ["y", "정면 돌리기"], ["z", "좌우 기울이기"]].map(([axis, label]) => <button key={axis} type="button" onClick={() => align({ rotation: { [axis]: alignment.rotation[axis] + Math.PI / 2 } })}>{label} 90°</button>)}<button type="button" onClick={() => align({ rotation: { x: 0, y: 0, z: 0 } })}>회전 초기화</button></div>
      </> : <p className={styles.help}>1단계에서 OBJ 또는 PLY 모델을 등록하세요.</p>}
    </fieldset>
    <fieldset className={styles.settingsGroup}><legend>2. 실제 크기·모델 배율</legend>
      {alignment && <>
        <strong>업로드 모델 자체 크기</strong>
        <div className={styles.rangeGrid}>{[["width", "메시 가로 X"], ["height", "메시 높이 Y"], ["depth", "메시 깊이 Z"]].map(([key, label]) => <NumericField displayPrecision={2} key={key} label={label} unit="m" min={0.001} step={0.01} value={alignment.targetDimensions?.[key] ?? equipment.dimensions[key]} onChange={(value) => { if (value > 0) align({ targetDimensions: { ...equipment.dimensions, ...alignment.targetDimensions, [key]: value }, fitToProxy: true, fitDimension: "EXACT", scale: { x: 1, y: 1, z: 1 } }); }} />)}</div>
        <p className={styles.help}>회전하기 전 모델의 가로·높이·깊이를 입력하세요. 각 길이를 따로 바꾸면 모양이 늘어나거나 줄어듭니다.</p>
        <div className={styles.actionRow}><button type="button" onClick={() => align({ scale: Object.fromEntries(Object.entries(alignment.scale).map(([axis, value]) => [axis, value * 1.1])) })}>모델 10% 키우기</button><button type="button" onClick={() => align({ scale: Object.fromEntries(Object.entries(alignment.scale).map(([axis, value]) => [axis, value / 1.1])) })}>모델 10% 줄이기</button></div>
        <label className={styles.field}><span>크기 적용 방식</span><select value={alignment.fitToProxy ? alignment.fitDimension ?? "CONTAIN" : "SOURCE"} onChange={(event) => align({ fitToProxy: event.target.value !== "SOURCE", fitDimension: event.target.value === "SOURCE" ? "CONTAIN" : event.target.value, scale: { x: 1, y: 1, z: 1 } })}><option value="EXACT">메시 각 축 치수 직접 적용</option><option value="HEIGHT">실측 높이에 맞춤 · 비율 유지</option><option value="WIDTH">실측 가로에 맞춤 · 비율 유지</option><option value="DEPTH">실측 깊이에 맞춤 · 비율 유지</option><option value="CONTAIN">입력한 크기 안에 맞춤 · 비율 유지</option><option value="SOURCE">원본 단위·배율 사용</option></select></label>
        <label className={styles.field}><span>원본 파일의 좌표 단위</span><select value={alignment.unit} onChange={(event) => align({ unit: event.target.value })}><option value="MM">mm</option><option value="CM">cm</option><option value="M">m</option></select></label>
        <p className={styles.help}>비율을 유지하려면 기준 길이를 선택하세요. 추가 배율 1은 실측 크기입니다.</p>
        <strong>모델 추가 배율</strong><div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()} 배율`} min={0.001} step={0.01} value={alignment.scale[axis]} onChange={(value) => { if (value > 0) align({ scale: { [axis]: value } }); }} />)}</div><button type="button" onClick={() => align({ scale: { x: 1, y: 1, z: 1 } })}>추가 배율을 1로 복원</button>
      </>}
      <details><summary>기준 설비 도형 크기</summary><div className={styles.rangeGrid}>{[["width", "가로 X"], ["height", "높이 Y"], ["depth", "깊이 Z"]].map(([key, label]) => <NumericField displayPrecision={2} key={key} label={label} unit="m" min={0.001} step={0.01} value={equipment.dimensions[key]} onChange={(value) => { if (value > 0) onUpdateEquipment({ dimensions: { ...equipment.dimensions, [key]: value } }); }} />)}</div></details>
    </fieldset>
    {alignment && <fieldset className={styles.settingsGroup}><legend>3. 모델 위치·바닥 정렬</legend>
      <div className={styles.rangeGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()} 위치`} unit="m" step={0.01} value={alignment.position[axis]} onChange={(value) => align({ position: { [axis]: value } })} />)}</div>
      <div className={styles.checkGrid}>{[["autoCentered", "원본 중심 정렬"], ["floorAligned", "원본 바닥 정렬"], ["completed", "모델 정합 완료"]].map(([key, label]) => <label className={styles.check} key={key}><input type="checkbox" checked={alignment[key]} onChange={(event) => align({ [key]: event.target.checked })} />{label}</label>)}</div>
      <button type="button" onClick={() => cameraAction("floor")}>현재 방향으로 바닥에 놓기</button>
    </fieldset>}
    <EquipmentCoordinateFrameFields key={`${equipment.id}:${equipment.metadata?.coordinateFrame?.version ?? 0}`} equipment={equipment} binding={binding} cameraController={cameraController} onUpdateEquipment={onUpdateEquipment} />
    <fieldset className={styles.settingsGroup}><legend>5. 모델 표시·조명</legend>
      <p className={styles.help}>관제 화면의 기본 표시와 설비별 표시를 선택하세요.</p>
      <label className={styles.field}><span>고객 뷰어 공통 기본 표시</span><select value={viewerPreset?.equipmentRepresentation?.globalMode ?? "AUTO"} onChange={(event) => onViewerPresetChange({ equipmentRepresentation: { globalMode: event.target.value } })}><option value="SIMPLIFIED">기준 도형</option><option value="REALISTIC">스캔 모델</option><option value="AUTO">선택·거리별 자동</option><option value="CUSTOM">설비별 지정 우선</option></select></label>
      <label className={styles.field}><span>고객에게 보여줄 현재 설비 모델</span><select value={viewerPreset?.equipmentRepresentation?.overrides?.[equipment.id] ?? "AUTO"} onChange={(event) => onEquipmentRepresentationChange(equipment.id, event.target.value)}><option value="AUTO">공통 기본 표시 따름</option><option value="DETAILED">스캔 모델</option><option value="SIMPLIFIED">기준 도형</option><option value="DISTANCE">거리별 자동 전환</option></select></label>
      <p className={styles.help}>설비별 선택이 공통 설정보다 우선합니다. 자동 전환 시 가까이에서 스캔 모델이 보입니다.</p>
      <NumericField displayPrecision={2} label="자동 상세 전환 거리 · 공통" unit="m" min={1} value={viewerPreset?.equipmentRepresentation?.autoDetailDistance ?? 12} onChange={(value) => onViewerPresetChange({ equipmentRepresentation: { autoDetailDistance: Math.max(1, value) } })} />
      <p className={styles.help}>모든 설비의 밝기를 함께 조절합니다. 점군 모델의 색상은 유지됩니다.</p>
      {[["ambient", "주변광"], ["key", "주 조명"], ["fill", "그림자 보정광"]].map(([key, label]) => <label className={styles.field} key={key}><span>{label} · {lighting[key].toFixed(1)}</span><input type="range" min="0" max="6" step="0.1" value={lighting[key]} onChange={(event) => onViewerPresetChange({ lighting: { ...lighting, [key]: Number(event.target.value) } })} /></label>)}
      <button type="button" onClick={() => onViewerPresetChange({ lighting: { ...DEFAULT_SCAN_LIGHTING } })}>조명 기본값</button>
    </fieldset>
    <EquipmentEnvironmentFields equipmentId={equipment.id} viewerPreset={viewerPreset} onChange={onViewerPresetChange} />
    <fieldset className={styles.settingsGroup}><legend>7. 최초 관제 화면·카메라</legend>
      <p className={styles.help}>원하는 각도와 배율로 맞춘 뒤 관제 시작 화면으로 저장하세요.</p>
      <div className={styles.actionRow}>{[["front", "정면"], ["back", "후면"], ["left", "좌측"], ["right", "우측"], ["top", "위에서"]].map(([value, label]) => <button type="button" key={value} onClick={() => cameraAction("direction", value)}>{label}</button>)}<button type="button" onClick={() => cameraAction("fit")}>모델 전체 맞춤</button><button type="button" onClick={() => cameraAction("zoom", 1.2)}>확대 +</button><button type="button" onClick={() => cameraAction("zoom", 1 / 1.2)}>축소 −</button></div>
      <NumericField displayPrecision={2} label="화면 배율" unit="배" min={0.1} step={0.1} value={cameraInfo?.zoom ?? savedView?.zoom ?? 1} onChange={(value) => cameraAction("zoomLevel", value)} />
      <NumericField displayPrecision={1} label="카메라 화각" unit="°" min={10} value={cameraInfo?.fov ?? savedView?.fov ?? 45} onChange={(value) => cameraAction("fov", Math.max(10, Math.min(100, value)))} />
      <button type="button" className={styles.primaryAction} onClick={() => cameraAction("save")}>현재 화면을 최초 관제 화면으로 저장</button>
      <button type="button" disabled={!savedView} onClick={() => cameraAction("preview", savedView)}>저장한 최초 화면 미리보기</button>
      <button type="button" disabled={!savedView} onClick={() => { onViewerPresetChange({ equipmentViews: { ...viewerPreset?.equipmentViews, [equipment.id]: null } }); setNotice("최초 화면 지정을 해제했습니다. 다음 접속부터 자동 맞춤을 사용합니다."); }}>최초 화면 지정 해제</button>
      <p className={styles.help}>{savedView ? "시작 화면을 지정했습니다. 마지막으로 프로젝트를 저장하세요." : "시작 화면을 지정하지 않으면 설비 전체가 보입니다."}</p>
      {notice && <p role="status">{notice}</p>}
    </fieldset>
  </>;
}
