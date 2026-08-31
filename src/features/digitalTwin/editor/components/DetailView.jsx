import DetailAssetScene from "@/features/digitalTwin/editor/three/DetailAssetScene";
import { ArrowLeftIcon } from "@/components/icons";

import styles from "./DetailView.module.css";

export default function DetailView({ equipment, asset, onClose }) {
  return (
    <section className={styles.overlay} aria-label={`${equipment.name} 3D 스캔 상세 보기`}>
      <header>
        <button type="button" onClick={onClose}><ArrowLeftIcon size={17} /> 편집기로 돌아가기</button>
        <div>
          <span>상세 보기 / {asset.originalFormat}</span>
          <h2>{equipment.name}</h2>
        </div>
        <dl>
          <div><dt>파일</dt><dd>{asset.originalFileName}</dd></div>
        </dl>
      </header>
      <div className={styles.viewport}>
        <DetailAssetScene asset={asset} />
      </div>
    </section>
  );
}
