import { sensorHasImaging, getSensorCapabilities } from "../model/equipmentDetailModel";
import { useState } from "react";
import { mediaUrl } from "../model/monitoringContract";
import { activeVisionSample, normalizeSensorProjection } from "../model/sensorImageTransform";
import { activeThermalSample } from "../model/thermalFrame";
import useSensorProjectionFrames from "../store/useSensorProjectionFrames";
import useThermalImage from "../store/useThermalImage";
import styles from "./EquipmentDetailWorkspace.module.css";

export default function SensorFramePreview({ sensor, sensorView, onSensorViewChange }) {
  const [error, setError] = useState("");
  const imaging = sensorHasImaging(sensor);
  const demo = sensor.dataSource === "DEMO";
  const capabilities = getSensorCapabilities(sensor);
  const projection = normalizeSensorProjection({ kind: capabilities.includes("THERMAL") && !capabilities.includes("VISION") ? "THERMAL" : "VISION", ...sensor.textureProjection });
  const sample = projection.kind === "THERMAL" ? activeThermalSample(sensor) : activeVisionSample(sensor);
  const samples = useSensorProjectionFrames(projection.kind === "THERMAL" && sample ? [{ ...sensor, textureProjection: { ...projection, enabled: true } }] : [], false, { live: false });
  const latest = sample ? projection.kind === "THERMAL" ? samples[0] ?? {} : sample
    : projection.kind === "VISION" ? { url: sensor.frameUrl } : {};
  const thermal = useThermalImage(latest.temperatureGrid, projection);
  const source = thermal.source || mediaUrl(latest.url, demo);
  return <aside className={styles.framePreview} data-camera-safe-ui aria-label="센서 방향·관측 이미지 확인">
    <header><strong>{sensor.name} · {imaging ? sample ? "샘플 테스트" : "참고 이미지" : "정면 방향 확인"}</strong></header>
    {imaging && (source ? <img key={source} src={source} alt={`${sensor.name} 배치 확인용 참고 이미지`} onError={() => setError("참고 이미지를 불러오지 못했습니다.")} /> : <p>{sample ? "열화상 샘플을 불러오는 중입니다." : "이미지·텍스처에서 참고 이미지나 샘플을 선택하세요. 실제 센서 영상은 뷰어에서 확인합니다."}</p>)}
    {thermal.summary && <small>최저 {thermal.summary.min.toFixed(2)} / 최고 {thermal.summary.max.toFixed(2)}°C · 색상 범위 자동 적용</small>}
    {latest.error && <p role="alert">{latest.error}</p>}
    {sample && <small>샘플 이미지 · 실시간 수신 아님</small>}
    {error && <p role="alert">{error}</p>}
    <button type="button" aria-pressed={sensorView} onClick={() => onSensorViewChange?.(!sensorView)}>{sensorView ? "자유 시점으로 돌아가기" : "센서 정면 시점 확인"}</button>
    <small>{sensorView ? "센서 위치·회전·화각을 조정하면 3D 시점도 함께 움직입니다. 여백은 영상 종횡비를 맞추기 위한 영역입니다." : "청록색 화살표가 센서의 정면입니다. 센서 정면 시점에서 바라보는 설비 위치를 확인하세요."}</small>
  </aside>;
}
