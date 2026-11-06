import EquipmentEnclosureFields from "./EquipmentEnclosureFields";
import { useState } from "react";
import EquipmentEnvironmentFields from "./EquipmentEnvironmentFields";
import NumericField from "./NumericField";
import EquipmentCoordinateFrameFields from "./EquipmentCoordinateFrameFields";
import { getEquipmentModelMode } from "../model/equipmentSetup.js";
import { DEFAULT_SCAN_LIGHTING, normalizeScanLighting } from "../model/viewerPreset";
import { getEnclosure, getEnclosureDoorEntries, getEnclosureScanSlot } from "../model/equipmentEnclosure.js";
import { scanBindingForDoor } from "../model/equipmentScanBindings.js";
import styles from "./MonitoringSettingsPanel.module.css";

export default function EquipmentModelSetupPanel({ phase = "ASSET", equipment, binding, bindings = [], onUpdateEquipment, onUpdateAsset, onRemoveAsset, onUploadAssetFiles, viewerPreset, onViewerPresetChange, onEquipmentRepresentationChange, cameraController }) {
  const [notice, setNotice] = useState("");
  const [selectedBindingId, setSelectedBindingId] = useState(null);
  const [uploadingSlot, setUploadingSlot] = useState("");
  const scans = bindings.filter((item) => ["OBJ", "PLY"].includes(item.assetType));
  const mode = getEquipmentModelMode(equipment, scans);
  const showScanSettings = phase === "SCAN" || mode === "SCAN";
  const activeBinding = scans.find((item) => item.id === selectedBindingId) ?? binding;
  const alignment = activeBinding?.alignmentTransform;
  const activeSlot = activeBinding?.scanSlot ? getEnclosureScanSlot(equipment, activeBinding.scanSlot.index, activeBinding.scanSlot.side) : null;
  const defaultDimensions = activeSlot?.dimensions ?? equipment.dimensions;
  const cabinet = getEnclosure(equipment);
  const doors = cabinet.enabled && (mode === "BOTH" || scans.some((item) => item.scanSlot)) ? getEnclosureDoorEntries(equipment) : [];
  const activeDoorLabel = activeBinding?.scanSlot
    ? doors.find((door) => door.side === activeBinding.scanSlot.side && door.index === activeBinding.scanSlot.index)?.label
      ?? `${activeBinding.scanSlot.side === "REAR" ? "뒤" : "앞"} · ${activeBinding.scanSlot.index + 1}번 문`
    : "설비 전체";
  const lighting = normalizeScanLighting(viewerPreset?.lighting);
  function align(changes) { if (activeBinding) onUpdateAsset(activeBinding.id, { alignmentTransform: changes }); }
  async function uploadScan(event, scanSlot) {
    const files = [...(event.target.files ?? [])]; event.target.value = "";
    if (!files.length) return;
    const key = scanSlot ? `${scanSlot.side}:${scanSlot.index}` : "WHOLE";
    setUploadingSlot(key);
    try {
      const id = await onUploadAssetFiles?.(equipment.id, files, { preserveExterior: mode === "BOTH", scanSlot });
      if (id) { setSelectedBindingId(id); setNotice("스캔을 연결했습니다. 아래에서 크기와 위치를 확인하세요."); }
    } finally { setUploadingSlot(""); }
  }
  function cameraAction(action, value) {
    const controller = cameraController?.current;
    if (!controller || controller.equipmentId !== equipment.id) { setNotice("모델 로딩을 완료한 뒤 설정하세요."); return; }
    if (!controller.ready()) { setNotice(activeBinding ? "스캔 모델 표시를 선택하고 로딩이 완료된 뒤 설정하세요." : "모델 로딩을 완료한 뒤 설정하세요."); return; }
    controller[action]?.(value);
    setNotice("");
  }
  return <>

    <section className={styles.modelSetupGroup} aria-labelledby="model-shape-settings-title">
    <h3 id="model-shape-settings-title">{showScanSettings ? "스캔 파일·정합" : "외관 도형"}</h3>
    {phase === "ASSET" && <EquipmentEnclosureFields equipment={equipment} bindings={scans} onUpdateEquipment={onUpdateEquipment} onUpdateAsset={onUpdateAsset} onEquipmentRepresentationChange={onEquipmentRepresentationChange} />}
    {showScanSettings && <>
    <p className={styles.help}>파일 연결 → 방향·크기 → 설치 위치 → 기준좌표 순서로 확인하세요.</p>
    <fieldset className={styles.settingsGroup} data-setup-field="model-files"><legend>{doors.length ? "문별 내부 스캔" : "설비 스캔 파일"}</legend>
      <p className={styles.help}>{doors.length ? "문마다 내부 스캔을 연결합니다. 기준좌표 (0, 0, 0)는 각 공간을 정면에서 바라볼 때 왼쪽 바닥의 가장 앞쪽입니다." : "설비 전체를 보여줄 OBJ 또는 PLY 스캔 파일을 등록하세요."}</p>
      {scans.filter((item) => !item.scanSlot).slice(-1).map((item) => <button type="button" key={item.id} aria-pressed={activeBinding?.id === item.id} onClick={() => setSelectedBindingId(item.id)}>설비 전체 · {item.name}{doors.length ? " (문별 스캔을 연결하면 대체)" : ""}</button>)}
      <div className={styles.scanSlotList}>{(doors.length ? doors : [{ side: null, index: null, id: "WHOLE", label: "설비 전체" }]).map((door) => {
        const slot = door.side ? getEnclosureScanSlot(equipment, door.index, door.side) : null;
        const item = door.side ? scanBindingForDoor(scans, equipment.id, door.side, door.index) : scans.filter((entry) => !entry.scanSlot).at(-1);
        const key = door.side ? `${door.side}:${door.index}` : "WHOLE";
        const selected = Boolean(item && activeBinding?.id === item.id);
        return <div className={styles.scanSlotItem} key={door.id} data-selected={selected || undefined} data-setup-field={`scan-slot-${key}`} role="group" aria-label={`${door.label} 스캔`}>
          <div className={styles.scanSlotHeader}><strong>{door.label}</strong><span title={item?.name ?? "연결된 파일 없음"}>{item?.name ?? "파일 없음"}</span></div>
          {door.side && !slot && <p className={styles.help} role="alert">문에 비해 공간이 좁습니다. 외관 크기 또는 문 크기를 늘리세요.</p>}
          <div className={styles.scanSlotActions}>{item && <button type="button" aria-pressed={selected} onClick={() => setSelectedBindingId(item.id)}>{selected ? "편집 중" : "편집"}</button>}
            <label className={styles.uploadButton}>{uploadingSlot === key ? "등록 중…" : item ? "교체" : "스캔 등록"}
              <input type="file" multiple accept=".obj,.ply,.mtl,.jpg,.jpeg,.png,.webp" disabled={Boolean(uploadingSlot) || Boolean(door.side && !slot)} onChange={(event) => void uploadScan(event, door.side ? { side: door.side, index: door.index } : null)} />
            </label>
            {item && <button type="button" onClick={() => { onRemoveAsset?.(item.id); if (selectedBindingId === item.id) setSelectedBindingId(null); }}>해제</button>}</div>
        </div>;
      })}</div>
      {scans.filter((item) => item.scanSlot && !getEnclosureScanSlot(equipment, item.scanSlot.index, item.scanSlot.side)).map((item) =>
        <div className={styles.settingsGroup} key={item.id}><p role="alert">{item.name} · 연결한 문이 현재 외관에 없습니다.</p><button type="button" onClick={() => { onRemoveAsset?.(item.id); if (selectedBindingId === item.id) setSelectedBindingId(null); }}>연결 해제</button></div>)}
    </fieldset>
    {activeBinding && <div className={styles.scanEditingContext} role="status">
      <span>조정 중</span><strong>{activeDoorLabel}</strong><small title={activeBinding.name}>{activeBinding.name}</small>
      {activeSlot && <small className={styles.scanEditingOrigin}>기준 (0, 0, 0) · 캐비넷 X {activeSlot.origin.x.toFixed(2)} / Y {activeSlot.origin.y.toFixed(2)} / Z {activeSlot.origin.z.toFixed(2)} m</small>}
    </div>}
    <fieldset className={styles.settingsGroup}><legend>스캔 방향{activeBinding ? ` · ${activeDoorLabel}` : ""}</legend>
      <p className={styles.help}>설비가 똑바로 보이도록 방향을 맞추세요.</p>
      {alignment ? <>
        <h4 className={styles.subsectionTitle}>회전</h4>
        <div className={styles.axisGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()}축`} unit="°" step={1} value={alignment.rotation[axis] * 180 / Math.PI} onChange={(value) => align({ rotation: { [axis]: value * Math.PI / 180 } })} />)}</div>
        <div className={styles.actionRow}>{[["x", "앞뒤 기울이기"], ["y", "정면 돌리기"], ["z", "좌우 기울이기"]].map(([axis, label]) => <button key={axis} type="button" onClick={() => align({ rotation: { [axis]: alignment.rotation[axis] + Math.PI / 2 } })}>{label} 90°</button>)}<button type="button" onClick={() => align({ rotation: { x: 0, y: 0, z: 0 } })}>회전 초기화</button></div>
      </> : <p className={styles.help}>위에서 OBJ 또는 PLY 스캔 파일을 등록하세요.</p>}
    </fieldset>
    <fieldset className={styles.settingsGroup} data-setup-field="model-size"><legend>실제 크기·배율 · 필수{activeBinding ? ` · ${activeDoorLabel}` : ""}</legend>
      {alignment && <>
        <label className={styles.field}><span>원본 파일의 좌표 단위</span><select value={alignment.unit} onChange={(event) => align({ unit: event.target.value })}><option value="MM">mm</option><option value="CM">cm</option><option value="M">m</option></select></label>
        <h4 className={styles.subsectionTitle}>스캔 파일의 실제 크기</h4>
        <div className={styles.axisGrid}>{[["width", "X축"], ["height", "Y축"], ["depth", "Z축"]].map(([key, label]) => <NumericField displayPrecision={2} key={key} label={label} unit="m" min={0.001} step={0.01} value={alignment.targetDimensions?.[key] ?? defaultDimensions[key]} onChange={(value) => { if (value > 0) align({ targetDimensions: { ...defaultDimensions, ...alignment.targetDimensions, [key]: value }, fitToProxy: true, fitDimension: "EXACT", scale: { x: 1, y: 1, z: 1 } }); }} />)}</div>
        <p className={styles.help}>회전하기 전 모델의 가로·높이·깊이를 입력하세요.</p>
        <label className={styles.field}><span>크기 적용 방식</span><select value={alignment.fitToProxy ? alignment.fitDimension ?? "CONTAIN" : "SOURCE"} onChange={(event) => align({ fitToProxy: event.target.value !== "SOURCE", fitDimension: event.target.value === "SOURCE" ? "CONTAIN" : event.target.value, scale: { x: 1, y: 1, z: 1 } })}><option value="EXACT">메시 각 축 치수 직접 적용</option><option value="HEIGHT">실측 높이에 맞춤 · 비율 유지</option><option value="WIDTH">실측 가로에 맞춤 · 비율 유지</option><option value="DEPTH">실측 깊이에 맞춤 · 비율 유지</option><option value="CONTAIN">입력한 크기 안에 맞춤 · 비율 유지</option><option value="SOURCE">원본 단위·배율 사용</option></select></label>
        <details className={styles.scanAdvanced}><summary>추가 배율 조정</summary><p className={styles.help}>실제 크기를 맞춘 뒤 미세 조정이 필요할 때 사용하세요.</p>
          <div className={styles.axisGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()}축`} min={0.001} step={0.01} value={alignment.scale[axis]} onChange={(value) => { if (value > 0) align({ scale: { [axis]: value } }); }} />)}</div>
          <div className={styles.actionRow}><button type="button" onClick={() => align({ scale: Object.fromEntries(Object.entries(alignment.scale).map(([axis, value]) => [axis, value * 1.1])) })}>10% 키우기</button><button type="button" onClick={() => align({ scale: Object.fromEntries(Object.entries(alignment.scale).map(([axis, value]) => [axis, value / 1.1])) })}>10% 줄이기</button></div>
          <button type="button" onClick={() => align({ scale: { x: 1, y: 1, z: 1 } })}>추가 배율 초기화</button>
        </details>
      </>}
      {mode === "SCAN" && <details><summary>기준 설비 도형 크기</summary><div className={styles.axisGrid}>{[["width", "X축"], ["height", "Y축"], ["depth", "Z축"]].map(([key, label]) => <NumericField displayPrecision={2} key={key} label={label} unit="m" min={0.001} step={0.01} value={equipment.dimensions[key]} onChange={(value) => { if (value > 0) onUpdateEquipment({ dimensions: { ...equipment.dimensions, [key]: value } }); }} />)}</div></details>}
    </fieldset>
    {alignment && <fieldset className={styles.settingsGroup} data-setup-field="model-alignment"><legend>설치 위치·정합 확인 · {activeDoorLabel}</legend>
      <h4 className={styles.subsectionTitle}>위치</h4>
      {activeSlot && <p className={styles.help}>이 서랍의 왼쪽·바닥·정면 모서리가 (0, 0, 0)입니다. X는 오른쪽, Y는 위쪽, Z 음수는 서랍 안쪽입니다. 아래 위치는 이 기준점에서 스캔이 떨어진 거리입니다.</p>}
      <div className={styles.axisGrid}>{["x", "y", "z"].map((axis) => <NumericField displayPrecision={2} key={axis} label={`${axis.toUpperCase()}축`} unit="m" step={0.01} value={alignment.position[axis]} onChange={(value) => align({ position: { [axis]: value } })} />)}</div>
      <div className={styles.checkGrid}>{[...(!activeSlot ? [["autoCentered", "원본 중심 정렬"], ["floorAligned", "원본 바닥 정렬"]] : []), ["completed", "모델 정합 완료"]].map(([key, label]) => <label className={styles.check} key={key}><input type="checkbox" checked={alignment[key]} onChange={(event) => align({ [key]: event.target.checked })} />{label}</label>)}</div>
        {!activeBinding?.scanSlot && <button type="button" onClick={() => cameraAction("floor")}>현재 방향으로 바닥에 놓기</button>}
        {notice && <p role="status">{notice}</p>}
    </fieldset>}
    </>}
    {(showScanSettings || mode === "SHAPE") && <EquipmentCoordinateFrameFields key={`${equipment.id}:${equipment.metadata?.coordinateFrame?.version ?? 0}`} equipment={equipment} binding={binding} cameraController={cameraController} onUpdateEquipment={onUpdateEquipment} />}
    </section>

    {phase === "ASSET" && <details className={`${styles.modelSetupGroup} ${styles.optionalModelSettings}`}>
    <summary>관제 화면 표시·배경 설정</summary>
    <fieldset className={styles.settingsGroup}><legend>모델 표시·조명</legend>
      <p className={styles.help}>관제 화면의 기본 표시와 설비별 표시를 선택하세요.</p>
      <label className={styles.field}><span>고객 뷰어 공통 기본 표시</span><select value={viewerPreset?.equipmentRepresentation?.globalMode ?? "AUTO"} onChange={(event) => onViewerPresetChange({ equipmentRepresentation: { globalMode: event.target.value } })}><option value="SIMPLIFIED">기준 도형</option><option value="REALISTIC">스캔 모델</option><option value="AUTO">선택·거리별 자동</option><option value="CUSTOM">설비별 지정 우선</option></select></label>
      <label className={styles.field}><span>고객에게 보여줄 현재 설비 모델</span><select value={viewerPreset?.equipmentRepresentation?.overrides?.[equipment.id] ?? "AUTO"} onChange={(event) => onEquipmentRepresentationChange(equipment.id, event.target.value)}><option value="AUTO">공통 기본 표시 따름</option><option value="DETAILED">스캔 모델</option><option value="SIMPLIFIED">기준 도형</option><option value="DISTANCE">거리별 자동 전환</option></select></label>
      <p className={styles.help}>설비별 선택이 공통 설정보다 우선합니다. 자동 전환 시 가까이에서 스캔 모델이 보입니다.</p>
      <NumericField displayPrecision={2} label="자동 상세 전환 거리 · 공통" unit="m" min={1} value={viewerPreset?.equipmentRepresentation?.autoDetailDistance ?? 12} onChange={(value) => onViewerPresetChange({ equipmentRepresentation: { autoDetailDistance: Math.max(1, value) } })} />
      <p className={styles.help}>모든 설비의 밝기를 함께 조절합니다. 점군 모델의 색상은 유지됩니다.</p>
      {[["ambient", "주변광"], ["key", "주 조명"], ["fill", "그림자 보정광"]].map(([key, label]) => <label className={styles.field} key={key}><span>{label} · {lighting[key].toFixed(2)}</span><input type="range" min="0" max="6" step="0.1" value={lighting[key]} onChange={(event) => onViewerPresetChange({ lighting: { ...lighting, [key]: Number(event.target.value) } })} /></label>)}
      <button type="button" onClick={() => onViewerPresetChange({ lighting: { ...DEFAULT_SCAN_LIGHTING } })}>조명 기본값</button>
    </fieldset>
    <EquipmentEnvironmentFields equipmentId={equipment.id} viewerPreset={viewerPreset} onChange={onViewerPresetChange} />
    </details>}

  </>;
}
