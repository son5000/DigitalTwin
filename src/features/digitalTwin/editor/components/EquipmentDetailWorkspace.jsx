import { useState } from "react";

import EquipmentAssetViewer from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";

import styles from "./EquipmentDetailWorkspace.module.css";

export default function EquipmentDetailWorkspace({ equipment, equipmentCount = 0, selectedAsset, overviewView, equipmentPicker, transformTools, theme, onAddEquipment, onAlignmentChange }) {
  const [viewMode, setViewMode] = useState("SELECTED");
  if (!equipment) return <section className={`${styles.workspace} ${styles.emptyWorkspace}`} aria-label="설비 상세 시작 화면">{equipmentPicker}</section>;

  return (
    <section className={styles.workspace} aria-label="설비 상세 작업 화면">
      <div className={styles.viewerMode} data-camera-safe-ui role="group" aria-label="설비 화면 맞춤">
        <button type="button" aria-pressed={viewMode === "SELECTED"} onClick={() => setViewMode("SELECTED")}>선택 설비 맞춤</button>
        <button type="button" aria-pressed={viewMode === "ALL"} disabled={equipmentCount < 2} onClick={() => setViewMode("ALL")}>전체 설비 맞춤</button>
        <button type="button" onClick={onAddEquipment}>설비 추가</button>
      </div>
      <div className={styles.viewer} aria-label="실제 설비 3D 뷰어">
        {viewMode === "ALL" && overviewView ? overviewView : <EquipmentAssetViewer equipment={equipment} binding={selectedAsset} transformTools={transformTools} theme={theme} onAlignmentChange={onAlignmentChange} />}
      </div>
      {equipmentPicker}
    </section>
  );
}
