import { useCallback, useState } from "react";

import { TRANSFORM_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  AddIcon,
  ArrowLeftIcon,
  ComponentIcon,
  DeleteIcon,
  DuplicateIcon,
  GridIcon,
  MoveIcon,
  RotateIcon,
} from "@/components/icons";
import { formatGridResolution, GRID_CELL_SIZE_OPTIONS } from "@/features/digitalTwin/editor/constants/gridSettings";
import { PART_SHAPES } from "@/features/digitalTwin/editor/constants/partTemplates";
import PartEditorScene from "@/features/digitalTwin/editor/three/PartEditorScene";

import NumericField from "./NumericField";
import styles from "./PartEditor.module.css";

const STATUS_OPTIONS = ["NORMAL", "WARNING", "ALARM", "MAINTENANCE"];

function PartProperties({ equipment, part, onChange }) {
  if (!part) {
    return <div className={styles.emptyProperties}>파트를 선택하세요.</div>;
  }
  const dimensionScale = { x: equipment.dimensions.width, y: equipment.dimensions.height, z: equipment.dimensions.depth };

  return (
    <div className={styles.properties}>
      <div className={styles.propertyHeading}><span>파트</span><h3>{part.name}</h3></div>
      <label className={styles.textField}><span>이름</span><input value={part.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label className={styles.textField}>
        <span>형태</span>
        <select value={part.shape} onChange={(event) => onChange({ shape: event.target.value })}>
          {PART_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
        </select>
      </label>
      <label className={styles.textField}>
        <span>상태</span>
        <select value={part.status} onChange={(event) => onChange({ status: event.target.value })}>
          {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
      <div className={styles.propertySection}>
        <h4>크기</h4>
        {Object.entries(part.dimensions).map(([axis, value]) => (
          <NumericField key={axis} label={axis.toUpperCase()} value={value * dimensionScale[axis]} min={0.02} step={0.01} unit="m" onChange={(next) => onChange({ dimensions: { [axis]: next / dimensionScale[axis] } })} />
        ))}
      </div>
      <div className={styles.propertySection}>
        <h4>위치</h4>
        {Object.entries(part.position).map(([axis, value]) => (
          <NumericField key={axis} label={axis.toUpperCase()} value={value * dimensionScale[axis]} step={0.01} unit="m" onChange={(next) => onChange({ position: { [axis]: next / dimensionScale[axis] } })} />
        ))}
      </div>
      <div className={styles.propertySection}>
        <h4>회전</h4>
        {Object.entries(part.rotation).map(([axis, value]) => (
          <NumericField key={axis} label={axis.toUpperCase()} value={value * 180 / Math.PI} step={1} unit="°" onChange={(next) => onChange({ rotation: { [axis]: next * Math.PI / 180 } })} />
        ))}
      </div>
      <label className={styles.colorField}><span>색상</span><input type="color" value={part.appearance.color} onChange={(event) => onChange({ appearance: { color: event.target.value } })} /></label>
      <label className={styles.checkField}><input type="checkbox" checked={part.visible} onChange={(event) => onChange({ visible: event.target.checked })} /><span>표시</span></label>
      <label className={styles.checkField}><input type="checkbox" checked={part.locked} onChange={(event) => onChange({ locked: event.target.checked })} /><span>변형 잠금</span></label>
    </div>
  );
}

export default function PartEditor({
  equipment,
  theme,
  gridSettings,
  onClose,
  onAddPart,
  onUpdatePart,
  onDuplicatePart,
  onRemovePart,
  onGridSnapChange,
  onGridSizeChange,
}) {
  const [selectedPartId, setSelectedPartId] = useState(() => equipment.parts?.[0]?.id ?? null);
  const [transformMode, setTransformMode] = useState(TRANSFORM_MODES.TRANSLATE);
  const selectedPart = equipment.parts?.find((part) => part.id === selectedPartId) ?? null;
  const handlePartChange = useCallback((changes) => {
    if (selectedPartId) onUpdatePart(equipment.id, selectedPartId, changes);
  }, [equipment.id, onUpdatePart, selectedPartId]);

  function handleAddPart() {
    const partId = onAddPart(equipment.id);
    if (partId) setSelectedPartId(partId);
  }

  function handleDuplicate() {
    if (!selectedPartId) return;
    const partId = onDuplicatePart(equipment.id, selectedPartId);
    if (partId) setSelectedPartId(partId);
  }

  function handleRemove() {
    if (!selectedPartId) return;
    const remainingPart = equipment.parts.find((part) => part.id !== selectedPartId);
    onRemovePart(equipment.id, selectedPartId);
    setSelectedPartId(remainingPart?.id ?? null);
  }

  return (
    <section className={styles.overlay} aria-label={`${equipment.name} Part Editor`}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onClose}><ArrowLeftIcon size={17} /> 공간 편집기</button>
        <div className={styles.title}><span>설비 / 파트</span><h2>{equipment.name}</h2></div>
        <div className={styles.headerMeta}><span>파트</span><strong>{equipment.parts?.length ?? 0}</strong></div>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.partList}>
          <div className={styles.listHeading}><span>파트 트리</span><button type="button" onClick={handleAddPart} aria-label="파트 추가"><AddIcon size={17} /></button></div>
          <div className={styles.listItems}>
            {(equipment.parts ?? []).map((part, index) => (
              <button key={part.id} type="button" className={part.id === selectedPartId ? styles.selectedPart : ""} onClick={() => setSelectedPartId(part.id)}>
                <span title={`파트 ${String(index + 1).padStart(2, "0")}`}><ComponentIcon size={17} /></span>
                <span><strong>{part.name}</strong><small>{part.shape} · {part.status}</small></span>
              </button>
            ))}
          </div>
          <div className={styles.listActions}>
            <button type="button" disabled={!selectedPart} onClick={handleDuplicate}><DuplicateIcon size={16} /> 복제</button>
            <button type="button" disabled={!selectedPart} onClick={handleRemove}><DeleteIcon size={16} /> 삭제</button>
          </div>
        </aside>
        <div className={styles.sceneArea}>
          <PartEditorScene
            equipment={equipment}
            selectedPartId={selectedPartId}
            theme={theme}
            transformMode={transformMode}
            gridSettings={gridSettings}
            gridScopeId={`PART:${equipment.id}`}
            onSelectPart={setSelectedPartId}
            onUpdatePart={(partId, changes) => onUpdatePart(equipment.id, partId, changes)}
          />
          <div className={styles.sceneToolbar}>
            <button type="button" className={transformMode === TRANSFORM_MODES.TRANSLATE ? styles.activeTool : ""} disabled={!selectedPart} onClick={() => setTransformMode(TRANSFORM_MODES.TRANSLATE)}><MoveIcon size={16} /> 이동</button>
            <button type="button" className={transformMode === TRANSFORM_MODES.ROTATE ? styles.activeTool : ""} disabled={!selectedPart} onClick={() => setTransformMode(TRANSFORM_MODES.ROTATE)}><RotateIcon size={16} /> 회전</button>
            <button type="button" role="switch" aria-checked={gridSettings.enabled} className={gridSettings.enabled ? styles.activeTool : ""} onClick={() => onGridSnapChange(!gridSettings.enabled)}><GridIcon size={16} /> Grid {gridSettings.enabled ? "ON" : "OFF"}</button>
            <select aria-label="Part grid cell size" value={gridSettings.baseSize} disabled={!gridSettings.enabled} onChange={(event) => onGridSizeChange(Number(event.target.value))}>
              {GRID_CELL_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{formatGridResolution(size)}</option>)}
            </select>
          </div>
        </div>
        <aside className={styles.propertyPanel}><PartProperties equipment={equipment} part={selectedPart} onChange={handlePartChange} /></aside>
      </div>
    </section>
  );
}
