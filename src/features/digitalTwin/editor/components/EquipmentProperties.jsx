import { useState } from "react";

import {
  APPEARANCE_COLOR_PRESETS,
  EQUIPMENT_SHAPE_TEMPLATE_MAP,
  EQUIPMENT_SHAPE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { degreesToRadians, radiansToDegrees } from "@/features/digitalTwin/editor/utils/editorMath";

import NumericField from "./NumericField";
import PropertySection from "./PropertySection";
import styles from "./EquipmentProperties.module.css";

const STATUS_LABELS = {
  UPLOADING: "업로드 중",
  PROCESSING: "처리 중",
  READY: "준비 완료",
  FAILED: "처리 실패",
  MISSING_LOCAL_FILE: "로컬 파일 재등록 필요",
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function EquipmentProperties({
  equipment,
  detailAsset,
  hasCollision,
  snapCandidate,
  onChange,
  onUpload,
  onRemoveAsset,
  onPreview,
  onUpdateAsset,
  onSnap,
  onOpenPartEditor,
}) {
  const [uploadMessage, setUploadMessage] = useState("");

  if (!equipment) {
    return (
      <section className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">◇</div>
        <h2>선택된 설비 없음</h2>
        <p>장면에서 설비를 선택하면 파라미터와 좌표를 편집할 수 있습니다.</p>
      </section>
    );
  }

  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[equipment.shapeTemplateId];
  const calibration = detailAsset?.calibration;

  function handleFileChange(event) {
    const [file] = event.target.files;
    if (!file) return;
    const result = onUpload(file);
    setUploadMessage(result.ok ? "3D 스캔 파일을 등록했습니다." : result.message);
    event.target.value = "";
  }

  return (
    <section className={styles.properties}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>설비</span>
          <h2>설비 속성</h2>
        </div>
        <span className={styles.selectedBadge}>설비</span>
      </div>

      {hasCollision && <div className={styles.warning}>다른 설비와 겹쳐 있습니다.</div>}

      <PropertySection title="Equipment" summary={template.nameKo} defaultOpen>
        <label className={styles.textField}>
          <span>이름</span>
          <input type="text" value={equipment.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className={styles.textField}>
          <span>형태</span>
          <select value={equipment.shapeTemplateId} onChange={(event) => onChange({ shapeTemplateId: event.target.value })}>
            {EQUIPMENT_SHAPE_TEMPLATES.map((item) => (
              <option key={item.id} value={item.id}>{item.nameKo} · {item.name}</option>
            ))}
          </select>
        </label>
        <dl className={styles.metadata}>
          <div><dt>카테고리</dt><dd>{template.category}</dd></div>
          <div><dt>인스턴스 ID</dt><dd title={equipment.id}>{equipment.id.slice(-12)}</dd></div>
        </dl>
      </PropertySection>

      <PropertySection title="Transform" summary="m / deg" defaultOpen>
        {snapCandidate && (
          <div className={styles.snapNotice}>
            <span>연결점 후보 · {(snapCandidate.distance * 1000).toFixed(0)} mm</span>
            <button type="button" onClick={onSnap}>Snap 연결</button>
          </div>
        )}
        {template.parameterDefinitions.length > 0 ? (
          <div className={styles.fieldGroup}>
            <h3>파라미터</h3>
            {template.parameterDefinitions.map((definition) => {
              const scale = definition.displayScale ?? 1;
              return (
                <NumericField
                  key={definition.key}
                  label={definition.label}
                  value={(equipment.parameters[definition.key] ?? 0) * scale}
                  min={definition.min}
                  step={definition.step}
                  unit={definition.unit}
                  onChange={(value) => onChange({ parameters: { [definition.key]: value / scale } })}
                />
              );
            })}
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <h3>크기</h3>
            {Object.entries(equipment.dimensions).map(([axis, value]) => (
              <NumericField
                key={axis}
                label={axis[0].toUpperCase() + axis.slice(1)}
                value={value}
                min={0.1}
                step={0.01}
                unit="m"
                onChange={(nextValue) => onChange({ dimensions: { [axis]: nextValue } })}
              />
            ))}
          </div>
        )}
        <div className={styles.fieldGroup}>
          <h3>위치</h3>
          <NumericField label="X" value={equipment.position.x} step={0.1} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="Y" value={equipment.position.y} step={0.1} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="Z" value={equipment.position.z} step={0.1} unit="m" onChange={(z) => onChange({ position: { z } })} />
        </div>
        <div className={styles.fieldGroup}>
          <h3>회전</h3>
          <NumericField label="Y" value={radiansToDegrees(equipment.rotation.y)} step={1} unit="deg" onChange={(rotationY) => onChange({ rotation: { y: degreesToRadians(rotationY) } })} />
        </div>
      </PropertySection>

      <PropertySection title="Appearance" summary={`${Math.round(equipment.appearance.opacity * 100)}%`} defaultOpen>
        <label className={styles.colorField}>
          <span>색상</span>
          <span className={styles.colorInputs}>
            <input type="color" value={equipment.appearance.color} aria-label="설비 색상" onChange={(event) => onChange({ appearance: { color: event.target.value } })} />
            <input type="text" value={equipment.appearance.color.toUpperCase()} aria-label="설비 색상 HEX" onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange({ appearance: { color: event.target.value } })} />
          </span>
        </label>
        <div className={styles.swatches} aria-label="색상 프리셋">
          {APPEARANCE_COLOR_PRESETS.map((color) => (
            <button key={color} type="button" aria-label={`${color} 색상 적용`} title={color} style={{ "--swatch-color": color }} className={equipment.appearance.color.toLowerCase() === color.toLowerCase() ? styles.swatchActive : ""} onClick={() => onChange({ appearance: { color } })} />
          ))}
        </div>
        <label className={styles.rangeField}>
          <span><span>불투명도</span><output>{Math.round(equipment.appearance.opacity * 100)}%</output></span>
          <input type="range" min="0.05" max="1" step="0.05" value={equipment.appearance.opacity} onChange={(event) => onChange({ appearance: { opacity: Number(event.target.value) } })} />
        </label>
        <label className={styles.checkField}>
          <input type="checkbox" checked={equipment.appearance.showEdges} onChange={(event) => onChange({ appearance: { showEdges: event.target.checked } })} />
          <span>Edge 표시</span>
        </label>
      </PropertySection>

      <PropertySection title="Parts" summary={`${equipment.parts?.length ?? 0} Parts`} defaultOpen>
        <div className={styles.partSummary}>
          <div><span>설비</span><strong>{equipment.name}</strong></div>
          <div><span>파트 노드</span><strong>{equipment.parts?.length ?? 0}</strong></div>
        </div>
        <p className={styles.description}>파트 메시는 공간 장면에 상시 렌더링하지 않고 상세 편집 화면에서만 불러옵니다.</p>
        <button type="button" className={styles.partEditorButton} onClick={onOpenPartEditor}>파트 편집기 열기</button>
      </PropertySection>

      <PropertySection title="3D Scan" summary={detailAsset ? STATUS_LABELS[detailAsset.status] : "미등록"}>
        {!detailAsset ? (
          <p className={styles.description}>설비 인스턴스에 정밀 스캔 모델을 연결합니다. 기본 장면에는 불러오지 않습니다.</p>
        ) : (
          <div className={styles.assetCard}>
            <div><strong>{detailAsset.originalFileName}</strong><span>{detailAsset.originalFormat} · {formatFileSize(detailAsset.fileSize)}</span></div>
            <span className={`${styles.assetStatus} ${styles[detailAsset.status.toLowerCase()]}`}>{STATUS_LABELS[detailAsset.status]}</span>
            {detailAsset.status === "UPLOADING" && <progress max="100" value={detailAsset.uploadProgress}>{detailAsset.uploadProgress}%</progress>}
            {detailAsset.status === "PROCESSING" && (
              <p className={styles.processingSteps}>메시 최적화 · 미리보기 생성</p>
            )}
          </div>
        )}
        <div className={styles.assetActions}>
          <label className={styles.uploadButton}>
            {detailAsset?.status === "FAILED" || detailAsset?.status === "MISSING_LOCAL_FILE"
              ? "다시 시도"
              : detailAsset
                ? "파일 교체"
                : "3D 스캔 등록"}
            <input type="file" accept=".glb,.gltf,.obj,.ply" onChange={handleFileChange} />
          </label>
          {detailAsset?.status === "READY" && <button type="button" onClick={onPreview}>상세 보기</button>}
          {detailAsset && <button type="button" className={styles.dangerButton} onClick={onRemoveAsset}>삭제</button>}
        </div>
        {uploadMessage && <p className={styles.uploadMessage} role="status">{uploadMessage}</p>}
        <p className={styles.fileHelp}>GLB, GLTF, OBJ, PLY · 파일은 현재 브라우저 세션에서만 미리보기 가능</p>
      </PropertySection>

      <PropertySection title="Advanced" summary={equipment.locked ? "Locked" : "Calibration"}>
        <label className={styles.checkField}>
          <input type="checkbox" checked={equipment.visible} onChange={(event) => onChange({ visible: event.target.checked })} />
          <span>장면에 표시</span>
        </label>
        <label className={styles.checkField}>
          <input type="checkbox" checked={equipment.locked} onChange={(event) => onChange({ locked: event.target.checked })} />
          <span>변형 잠금</span>
        </label>
        {calibration ? (
          <div className={styles.fieldGroup}>
            <h3>상세 모델 보정</h3>
            <NumericField label="Scale" value={calibration.scale} min={0.001} step={0.01} unit="×" onChange={(scale) => onUpdateAsset({ calibration: { scale } })} />
            {["X", "Y", "Z"].map((axis) => (
              <NumericField key={`position${axis}`} label={`Position ${axis}`} value={calibration[`position${axis}`]} step={0.01} unit="m" onChange={(value) => onUpdateAsset({ calibration: { [`position${axis}`]: value } })} />
            ))}
            {["X", "Y", "Z"].map((axis) => (
              <NumericField key={`rotation${axis}`} label={`Rotation ${axis}`} value={calibration[`rotation${axis}`]} step={1} unit="deg" onChange={(value) => onUpdateAsset({ calibration: { [`rotation${axis}`]: value } })} />
            ))}
          </div>
        ) : (
          <p className={styles.description}>3D 스캔을 등록하면 상세 모델의 위치, 회전, 배율을 보정할 수 있습니다.</p>
        )}
      </PropertySection>
    </section>
  );
}
