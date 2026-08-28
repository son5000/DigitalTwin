import { ASSET_USAGE_TYPES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import EquipmentAssetViewer from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";

import styles from "./EquipmentDetailWorkspace.module.css";

export default function EquipmentDetailWorkspace({ equipment, assetBindings, selectedAsset, selectedSensor, worldView, onAlignmentChange }) {
  if (!equipment) return <section className={styles.empty} aria-label="설비 상세 빈 상태"><strong>선택된 설비가 없습니다</strong><p>도면·설비 단계에서 설비를 선택한 후 설비 상세로 이동하세요.</p></section>;
  const referenceImage = assetBindings.find((item) => [ASSET_USAGE_TYPES.REFERENCE_IMAGE, ASSET_USAGE_TYPES.CAMERA_FRAME].includes(item.usageType));
  return <section className={styles.workspace} aria-label="설비 상세 작업 화면">
    <div className={styles.viewer}><EquipmentAssetViewer equipment={equipment} binding={selectedAsset} onAlignmentChange={onAlignmentChange} /></div>
    <aside className={styles.side}>
      <section className={styles.camera}><header><strong>센서 카메라 시점</strong><span>{selectedSensor?.sensorType === "CAMERA" ? `${selectedSensor.fieldOfView}° · ${selectedSensor.aspectRatio.toFixed(2)}` : "카메라를 선택하세요"}</span></header>{referenceImage ? <img src={referenceImage.objectUrl ?? referenceImage.sourceKey} alt={`${equipment.name} 참조 촬영 이미지`} /> : <div>연결된 관측 이미지가 없습니다.</div>}</section>
      <section className={styles.world}><header><strong>월드 센서 위치·화각</strong><span>설비·관측 포인트 연결 상태</span></header><div>{worldView}</div></section>
    </aside>
  </section>;
}
