import { useState } from "react";

import {
  EQUIPMENT_SHAPE_TEMPLATE_MAP,
  EQUIPMENT_SHAPE_TEMPLATES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EQUIPMENT_MATERIAL_PRESET_IDS } from "@/features/digitalTwin/editor/constants/materialPresets";
import { degreesToRadians, radiansToDegrees } from "@/features/digitalTwin/editor/utils/editorMath";
import { ComponentIcon, DeleteIcon, EnterIcon, EquipmentIcon, SnapIcon } from "@/components/icons";

import NumericField from "./NumericField";
import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import MaterialSlotEditor from "./MaterialSlotEditor";
import PropertySection from "./PropertySection";
import styles from "./EquipmentProperties.module.css";

const STATUS_LABELS = {
  UPLOADING: "업로드 중",
  PROCESSING: "처리 중",
  READY: "준비 완료",
  FAILED: "처리 실패",
  MISSING_LOCAL_FILE: "로컬 파일 재등록 필요",
};

const EQUIPMENT_CATEGORY_LABELS = {
  BASIC: "기본 도형",
  CABINET: "전기·캐비닛",
  MECHANICAL: "기계 설비",
  PIPE: "배관·피팅",
  DUCT: "덕트·공조",
  TANK: "탱크·용기",
  SAFETY: "안전 설비",
  SENSOR: "센서",
  UTILITY: "유틸리티",
  CUSTOM: "사용자 정의",
};

const PARAMETER_LABELS = {
  width: "너비",
  depth: "깊이",
  height: "높이",
  length: "길이",
  diameter: "지름",
  bendRadius: "굽힘 반지름",
  branchLength: "분기 길이",
  endDiameter: "끝 지름",
};

const OPERATION_STATUS_LABELS = {
  UNCOMMISSIONED: "미연결",
  OFFLINE: "오프라인",
  IDLE: "대기",
  RUNNING: "운전 중",
  FAULT: "고장",
  MAINTENANCE: "점검 중",
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
  placementOnly = false,
  floors = [],
  spaces = [],
}) {
  const [uploadMessage, setUploadMessage] = useState("");

  if (!equipment) {
    return (
      <section className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true"><EquipmentIcon size={34} /></div>
        <h2>선택된 설비 없음</h2>
      </section>
    );
  }

  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[equipment.shapeTemplateId];
  const compatibleModels = EQUIPMENT_SHAPE_TEMPLATES.filter((item) => (
    item.objectType === template.objectType && !item.legacyOnly
  ));
  const calibration = detailAsset?.calibration;
  const primaryBinding = equipment.dataBindings?.[0] ?? {
    protocol: "MQTT",
    endpoint: "",
    metric: "",
    unit: "",
  };

  function updatePrimaryBinding(changes) {
    onChange({
      dataBindings: [{ ...primaryBinding, ...changes }, ...(equipment.dataBindings?.slice(1) ?? [])],
    });
  }

  function handleFileChange(event) {
    const [file] = event.target.files;
    if (!file) return;
    const result = onUpload(file);
    setUploadMessage(result.ok ? "3D 스캔 파일을 등록했습니다." : result.message);
    event.target.value = "";
  }

  return (
    <section className={styles.properties}>
      {hasCollision && <div className={styles.warning}>다른 설비와 겹쳐 있습니다.</div>}

      <PropertySection title="기본 정보" summary={template.nameKo} defaultOpen>
        <label className={styles.textField}>
          <span>이름</span>
          <input type="text" value={equipment.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className={styles.textField}>
          <span>세부 모델</span>
          <select value={equipment.shapeTemplateId} onChange={(event) => {
            const model = EQUIPMENT_SHAPE_TEMPLATE_MAP[event.target.value];
            onChange({ shapeTemplateId: model.id, sourceTemplateId: model.id, category: model.category });
          }}>
            {(compatibleModels.length ? compatibleModels : [template]).map((item) => (
              <option key={item.id} value={item.id}>{item.nameKo}</option>
            ))}
          </select>
        </label>
        <dl className={styles.metadata}>
          <div><dt>카테고리</dt><dd>{EQUIPMENT_CATEGORY_LABELS[template.category] ?? template.category}</dd></div>
        </dl>
      </PropertySection>

      <PropertySection
        title="자산 정보"
        summary={equipment.metadata?.assetTag || "자산 정보"}
        defaultOpen
      >
        <label className={styles.textField}>
          <span>자산 태그</span>
          <input
            type="text"
            value={equipment.metadata?.assetTag ?? ""}
            placeholder="예: AHU-01"
            onChange={(event) => onChange({ metadata: { assetTag: event.target.value } })}
          />
        </label>
        <label className={styles.textField}>
          <span>제조사</span>
          <input
            type="text"
            value={equipment.metadata?.manufacturer ?? ""}
            onChange={(event) => onChange({ metadata: { manufacturer: event.target.value } })}
          />
        </label>
        <label className={styles.textField}>
          <span>모델</span>
          <input
            type="text"
            value={equipment.metadata?.model ?? ""}
            onChange={(event) => onChange({ metadata: { model: event.target.value } })}
          />
        </label>
        <label className={styles.textField}>
          <span>시리얼 번호</span>
          <input
            type="text"
            value={equipment.metadata?.serialNumber ?? ""}
            onChange={(event) => onChange({ metadata: { serialNumber: event.target.value } })}
          />
        </label>
      </PropertySection>

      {placementOnly ? (
        <PropertySection title="배치 소속" summary={floors.find((floor) => floor.id === equipment.floorId)?.name ?? "층 미지정"} defaultOpen>
          <label className={styles.textField}>
            <span>소속 층</span>
            <select value={equipment.floorId ?? ""} onChange={(event) => onChange({ floorId: event.target.value })}>
              {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
            </select>
          </label>
          <label className={styles.textField}>
            <span>소속 공간</span>
            <select value={equipment.spaceId ?? ""} onChange={(event) => onChange({ spaceId: event.target.value || null })}>
              <option value="">공간 미지정</option>
              {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
          </label>
        </PropertySection>
      ) : null}

      {!placementOnly ? <PropertySection title="센서 데이터" summary={primaryBinding.endpoint || "연결 안 됨"} defaultOpen>
        <label className={styles.textField}>
          <span>프로토콜</span>
          <select value={primaryBinding.protocol} onChange={(event) => updatePrimaryBinding({ protocol: event.target.value })}>
            <option value="MQTT">MQTT</option>
            <option value="HTTP">HTTP / REST</option>
            <option value="BACNET">BACnet</option>
            <option value="MODBUS">Modbus</option>
            <option value="OPC_UA">OPC UA</option>
          </select>
        </label>
        <label className={styles.textField}><span>엔드포인트 또는 토픽</span><input type="text" value={primaryBinding.endpoint} placeholder="예: building/1/ahu/01" onChange={(event) => updatePrimaryBinding({ endpoint: event.target.value })} /></label>
        <label className={styles.textField}><span>측정 항목</span><input type="text" value={primaryBinding.metric} placeholder="예: temperature" onChange={(event) => updatePrimaryBinding({ metric: event.target.value })} /></label>
        <label className={styles.textField}><span>단위</span><input type="text" value={primaryBinding.unit} placeholder="예: °C" onChange={(event) => updatePrimaryBinding({ unit: event.target.value })} /></label>
      </PropertySection> : null}

      {!placementOnly ? <PropertySection title="운전 상태" summary={OPERATION_STATUS_LABELS[equipment.operationalState?.status ?? "UNCOMMISSIONED"]} defaultOpen>
        <label className={styles.textField}>
          <span>운전 상태</span>
          <select value={equipment.operationalState?.status ?? "UNCOMMISSIONED"} onChange={(event) => onChange({ operationalState: { status: event.target.value, lastUpdatedAt: new Date().toISOString() } })}>
            <option value="UNCOMMISSIONED">미연결</option>
            <option value="OFFLINE">오프라인</option>
            <option value="IDLE">대기</option>
            <option value="RUNNING">운전 중</option>
            <option value="FAULT">고장</option>
            <option value="MAINTENANCE">점검 중</option>
          </select>
        </label>
        <label className={styles.textField}>
          <span>알람 수준</span>
          <select value={equipment.operationalState?.alarmLevel ?? "NONE"} onChange={(event) => onChange({ operationalState: { alarmLevel: event.target.value, lastUpdatedAt: new Date().toISOString() } })}>
            <option value="NONE">없음</option>
            <option value="INFO">정보</option>
            <option value="WARNING">주의</option>
            <option value="CRITICAL">위험</option>
          </select>
        </label>
      </PropertySection> : null}

      {!placementOnly ? <PropertySection title="제어" summary={equipment.control?.enabled ? "제어 가능" : "모니터링 전용"} defaultOpen>
        <label className={styles.checkField}><input type="checkbox" checked={equipment.control?.enabled ?? false} onChange={(event) => onChange({ control: { enabled: event.target.checked } })} /><span>원격 제어 허용</span></label>
        <label className={styles.textField}>
          <span>제어 모드</span>
          <select disabled={!equipment.control?.enabled} value={equipment.control?.mode ?? "MONITOR_ONLY"} onChange={(event) => onChange({ control: { mode: event.target.value } })}>
            <option value="MONITOR_ONLY">모니터링 전용</option>
            <option value="MANUAL">수동 명령</option>
            <option value="AUTOMATION">자동 제어</option>
          </select>
        </label>
        <label className={styles.textField}><span>제어 엔드포인트</span><input type="text" disabled={!equipment.control?.enabled} value={equipment.control?.endpoint ?? ""} onChange={(event) => onChange({ control: { endpoint: event.target.value } })} /></label>
      </PropertySection> : null}

      <PropertySection title="크기 및 배치" defaultOpen>
        {snapCandidate && (
          <div className={styles.snapNotice}>
            <span>연결점 후보 · {(snapCandidate.distance * 1000).toFixed(0)} mm</span>
            <button type="button" onClick={onSnap}><SnapIcon size={15} /> 스냅 연결</button>
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
                  label={PARAMETER_LABELS[definition.key] ?? definition.label}
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
                label={PARAMETER_LABELS[axis] ?? axis.toUpperCase()}
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
          <NumericField label="Y축" value={radiansToDegrees(equipment.rotation.y)} step={1} unit="도" onChange={(rotationY) => onChange({ rotation: { y: degreesToRadians(rotationY) } })} />
        </div>
      </PropertySection>

      <PropertySection title="재질" defaultOpen>
        <MaterialAppearanceEditor
          appearance={equipment.appearance}
          presetIds={EQUIPMENT_MATERIAL_PRESET_IDS}
          showEdges
          onChange={(appearance) => onChange({ appearance })}
        />
      </PropertySection>

      {template.materialSlots?.length ? (
        <PropertySection title="재질 영역" summary={`${template.materialSlots.length}개 영역`} defaultOpen>
          <MaterialSlotEditor
            slots={template.materialSlots}
            appearances={equipment.appearanceSlots}
            presetIds={EQUIPMENT_MATERIAL_PRESET_IDS}
            onChange={(appearanceSlots) => onChange({ appearanceSlots })}
          />
        </PropertySection>
      ) : null}

      {!placementOnly ? <PropertySection title="부품" summary={`${equipment.parts?.length ?? 0}개 부품`} defaultOpen>
        <div className={styles.partSummary}>
          <div><span>설비</span><strong>{equipment.name}</strong></div>
          <div><span>파트 노드</span><strong>{equipment.parts?.length ?? 0}</strong></div>
        </div>
        <button type="button" className={styles.partEditorButton} onClick={onOpenPartEditor}><ComponentIcon size={16} /> 파트 편집기 열기</button>
      </PropertySection> : null}

      {!placementOnly ? <PropertySection title="3D 스캔" summary={detailAsset ? STATUS_LABELS[detailAsset.status] : "미등록"}>
        {detailAsset ? (
          <div className={styles.assetCard}>
            <div><strong>{detailAsset.originalFileName}</strong><span>{detailAsset.originalFormat} · {formatFileSize(detailAsset.fileSize)}</span></div>
            <span className={`${styles.assetStatus} ${styles[detailAsset.status.toLowerCase()]}`}>{STATUS_LABELS[detailAsset.status]}</span>
            {detailAsset.status === "UPLOADING" && <progress max="100" value={detailAsset.uploadProgress}>{detailAsset.uploadProgress}%</progress>}
            {detailAsset.status === "PROCESSING" && (
              <p className={styles.processingSteps}>메시 최적화 · 미리보기 생성</p>
            )}
          </div>
        ) : null}
        <div className={styles.assetActions}>
          <label className={styles.uploadButton}>
            {detailAsset?.status === "FAILED" || detailAsset?.status === "MISSING_LOCAL_FILE"
              ? "다시 시도"
              : detailAsset
                ? "파일 교체"
                : "3D 스캔 등록"}
            <input type="file" accept=".glb,.gltf,.obj,.ply" onChange={handleFileChange} />
          </label>
          {detailAsset?.status === "READY" && <button type="button" onClick={onPreview}><EnterIcon size={15} /> 상세 보기</button>}
          {detailAsset && <button type="button" className={styles.dangerButton} onClick={onRemoveAsset}><DeleteIcon size={15} /> 삭제</button>}
        </div>
        {uploadMessage && <p className={styles.uploadMessage} role="status">{uploadMessage}</p>}
      </PropertySection> : null}

      <PropertySection title="표시 및 잠금" summary={equipment.locked ? "잠김" : "편집 가능"}>
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
            <NumericField label="크기 비율" value={calibration.scale} min={0.001} step={0.01} unit="×" onChange={(scale) => onUpdateAsset({ calibration: { scale } })} />
            {["X", "Y", "Z"].map((axis) => (
              <NumericField key={`position${axis}`} label={`위치 ${axis}`} value={calibration[`position${axis}`]} step={0.01} unit="m" onChange={(value) => onUpdateAsset({ calibration: { [`position${axis}`]: value } })} />
            ))}
            {["X", "Y", "Z"].map((axis) => (
              <NumericField key={`rotation${axis}`} label={`회전 ${axis}`} value={calibration[`rotation${axis}`]} step={1} unit="도" onChange={(value) => onUpdateAsset({ calibration: { [`rotation${axis}`]: value } })} />
            ))}
          </div>
        ) : null}
      </PropertySection>
    </section>
  );
}
