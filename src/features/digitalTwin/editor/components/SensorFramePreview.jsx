import { useState } from "react";
import styles from "./EquipmentDetailWorkspace.module.css";

export default function SensorFramePreview({ sensor }) {
  const [revision, setRevision] = useState(0);
  const [failedSource, setFailedSource] = useState(null);
  const source = /^https?:\/\//i.test(sensor.frameUrl ?? "") ? sensor.frameUrl : null;
  return <aside className={styles.framePreview} data-camera-safe-ui aria-label="센서 스틸컷 비교">
    <header><strong>{sensor.name} · 관측 이미지</strong><button type="button" disabled={!source} onClick={() => { setRevision((value) => value + 1); setFailedSource(null); }}>다시 불러오기</button></header>
    {source ? <img key={`${source}:${revision}`} src={source} alt={`${sensor.name} 스틸컷`} onError={() => setFailedSource(source)} /> : <p>설정 패널에서 HTTP(S) 스틸컷 URL을 입력하세요.</p>}
    {source && failedSource === source && <p role="alert">이미지를 불러오지 못했습니다. 주소와 서버 접근 권한을 확인하세요.</p>}
    <small>이미지와 3D 모델을 비교해 센서 위치·방향을 수동 보정합니다.</small>
  </aside>;
}
