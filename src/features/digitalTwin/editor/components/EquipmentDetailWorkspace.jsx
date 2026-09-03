import { useState } from "react";

import LocalEquipmentAssetImage from "@/features/digitalTwin/editor/components/LocalEquipmentAssetImage";
import { ASSET_USAGE_TYPES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import EquipmentAssetViewer from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";

import styles from "./EquipmentDetailWorkspace.module.css";

export default function EquipmentDetailWorkspace({ equipment, equipmentCount = 0, assetBindings, selectedAsset, selectedSensor, worldView, overviewView, equipmentPicker, theme, onAddEquipment, onAlignmentChange }) {
  const [viewMode, setViewMode] = useState("SELECTED");
  if (!equipment) return <section className={`${styles.workspace} ${styles.emptyWorkspace}`} aria-label="설비 상세 시작 화면">{equipmentPicker}</section>;
  const referenceImage = assetBindings.find((item) => [ASSET_USAGE_TYPES.REFERENCE_IMAGE, ASSET_USAGE_TYPES.CAMERA_FRAME].includes(item.usageType));
  const cameraStatus = selectedSensor?.sensorType === "CAMERA"
    ? `${selectedSensor.fieldOfView}° · ${Number(selectedSensor.aspectRatio ?? 1).toFixed(2)}`
    : "카메라를 선택하세요";

  return (
    <section className={styles.workspace} aria-label="설비 상세 작업 화면">
      <div className={styles.viewerMode} data-camera-safe-ui role="group" aria-label="설비 화면 맞춤">
        <button type="button" aria-pressed={viewMode === "SELECTED"} onClick={() => setViewMode("SELECTED")}>선택 설비 맞춤</button>
        <button type="button" aria-pressed={viewMode === "ALL"} disabled={equipmentCount < 2} onClick={() => setViewMode("ALL")}>전체 설비 맞춤</button>
        <button type="button" onClick={onAddEquipment}>설비 추가</button>
      </div>
      <div className={styles.viewer} aria-label="실제 설비 3D 뷰어">
        {viewMode === "ALL" && overviewView ? overviewView : <EquipmentAssetViewer equipment={equipment} binding={selectedAsset} theme={theme} onAlignmentChange={onAlignmentChange} />}
      </div>
      <aside className={styles.observationStrip} aria-label="센서 관측 미리보기">
        <section className={`${styles.previewPane} ${styles.camera}`}>
          <header><strong>센서 카메라 시점</strong><span>{cameraStatus}</span></header>
          {referenceImage
            ? <LocalEquipmentAssetImage key={referenceImage.id} binding={referenceImage} alt={`${equipment.name} 참조 촬영 이미지`} />
            : <div className={styles.previewEmpty}>연결된 관측 이미지가 없습니다.</div>}
        </section>
        <section className={`${styles.previewPane} ${styles.world}`}>
          <header><strong>월드 센서 위치·화각</strong><span>설비·관측 포인트 연결 상태</span></header>
          <div>{worldView}</div>
        </section>
      </aside>
      {equipmentPicker}
    </section>
  );
}
