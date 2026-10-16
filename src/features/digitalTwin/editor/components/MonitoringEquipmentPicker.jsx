import { useState } from "react";
import PhotoProjectionLab from "@/features/digitalTwin/editor/components/PhotoProjectionLab";
import ObjectModelThumbnail from "@/features/digitalTwin/editor/components/ObjectModelThumbnail";
import FloorWorkspaceCatalog from "@/features/digitalTwin/editor/components/FloorWorkspaceCatalog";
import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";

import styles from "./MonitoringEquipmentPicker.module.css";

const ACCEPTED_ASSET_TYPES = ".obj,.ply,.mtl,.jpg,.jpeg,.png,.webp";

export default function MonitoringEquipmentPicker({
  equipment = [],
  selectedEquipmentId,
  required = false,
  notice = "",
  onClose,
  onSelect,
  onAddTemplate,
  onUploadAsset,
}) {
  const [developerModeOpen, setDeveloperModeOpen] = useState(false);
  function handleUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onUploadAsset?.(files);
    event.target.value = "";
  }

  return (
    <section className={`${styles.picker} ${required ? styles.initialPicker : ""}`} data-editor-panel aria-label="관측 설비 등록">
      <header className={styles.header}>
        <div><span>설비 상세 시작</span><h2>{required ? "어떤 설비를 설정할까요?" : "관측할 설비를 등록하세요"}</h2>
          {required && <p>설비를 선택하면 3D 모델, 센서 위치와 측정값 설정을 시작할 수 있습니다.</p>}
        </div>
        {!required ? <button type="button" className={styles.closeButton} onClick={onClose} aria-label="설비 등록 닫기">닫기</button> : null}
      </header>

      <div className={styles.content}>
        <div className={styles.selectionOptions}>
          {equipment.length ? (
            <section className={styles.registered} aria-label="등록된 관측 설비">
              <div className={styles.sectionHeading}><strong>등록된 설비</strong><span>{equipment.length}개</span></div>
              <div className={styles.registeredList}>
                {equipment.map((item) => {
                  const template = UNIFIED_EQUIPMENT_TEMPLATE_MAP[item.shapeTemplateId];
                  return (
                    <button key={item.id} type="button" aria-pressed={item.id === selectedEquipmentId} onClick={() => onSelect?.(item.id)}>
                      <ObjectModelThumbnail definition={template} title={item.name} />
                      <span><strong>{item.name}</strong><small>{template?.nameKo ?? item.shapeTemplateId}</small></span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : required ? <div className={styles.startGuide}>
            <strong>첫 설비 등록</strong>
            <p>카탈로그에서 설비를 고르거나 보유한 3D 파일을 등록하세요.</p>
          </div> : <p className={styles.emptyNotice}>아직 등록된 설비가 없습니다. 카탈로그 또는 보유 파일로 첫 설비를 등록하세요.</p>}

          <div className={styles.actions}>
            {required && <div><strong>보유한 3D 파일이 있나요?</strong><p>OBJ · PLY 모델과 재질·이미지 파일을 함께 등록할 수 있습니다.</p></div>}
            <label className={styles.uploadButton}>3D 파일로 직접 등록<input type="file" multiple accept={ACCEPTED_ASSET_TYPES} onChange={handleUpload} /></label>
          </div>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </div>

        <div className={styles.libraryHost}>
          {required && <div className={styles.catalogHeading}><h3>카탈로그에서 선택</h3><p>설비 이름으로 검색하거나 분류를 열어 선택하세요.</p></div>}
          <FloorWorkspaceCatalog
            mode="EQUIPMENT"
            equipmentOnly
            activeEquipmentTemplateId={null}
            onSelectEquipmentTemplate={(templateId) => onAddTemplate?.(templateId)}
          />
          <button type="button" className={styles.developerButton} onClick={() => setDeveloperModeOpen(true)}>개발자모드 · 사진 투영 테스트</button>
        </div>
      </div>
      {developerModeOpen ? <PhotoProjectionLab onClose={() => setDeveloperModeOpen(false)} /> : null}
    </section>
  );
}
