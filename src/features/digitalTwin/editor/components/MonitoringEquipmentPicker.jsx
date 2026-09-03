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
  function handleUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onUploadAsset?.(files);
    event.target.value = "";
  }

  return (
    <section className={styles.picker} data-editor-panel aria-label="관측 설비 등록">
      <header className={styles.header}>
        <div><span>설비 상세 시작</span><h2>관측할 설비를 등록하세요</h2></div>
        {!required ? <button type="button" className={styles.closeButton} onClick={onClose} aria-label="설비 등록 닫기">닫기</button> : null}
      </header>

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
      ) : <p className={styles.emptyNotice}>아직 등록된 설비가 없습니다. 카탈로그 또는 보유 파일로 첫 설비를 등록하세요.</p>}

      <div className={styles.actions}>
        <label className={styles.uploadButton}>3D 파일로 직접 등록<input type="file" multiple accept={ACCEPTED_ASSET_TYPES} onChange={handleUpload} /></label>
      </div>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.libraryHost}>
        <FloorWorkspaceCatalog
          mode="EQUIPMENT"
          equipmentOnly
          activeEquipmentTemplateId={null}
          onSelectEquipmentTemplate={(templateId) => onAddTemplate?.(templateId)}
        />
      </div>
    </section>
  );
}
