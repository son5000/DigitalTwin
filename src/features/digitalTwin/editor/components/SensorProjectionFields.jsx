import { useEffect, useRef, useState } from "react";
import { getEnclosureSurfaces } from "../model/equipmentEnclosure";
import { normalizeSensorProjection } from "../model/sensorProjection";
import { activeVisionSample, VISION_SAMPLE_URL } from "../model/sensorImageTransform";
import { getSensorCapabilities } from "../model/equipmentDetailModel";
import { calibrationPayload, imageProcessingPayload, downloadMonitoringJson, mediaUrl } from "../model/monitoringContract";
import { IMAGE_PLANES, resolveImageSurface } from "../model/textureSurfaceMapping";
import { readProjects } from "@/features/portal/projects/projectRepository";
import NumericField from "./NumericField";
import ImageTransformEditor from "./ImageTransformEditor";
import useSensorProjectionFrames from "../store/useSensorProjectionFrames";
import styles from "./MonitoringSettingsPanel.module.css";

export default function SensorProjectionFields({ sensor, equipment, assets = [], onChange }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestRef = useRef(null);
  const sensorRef = useRef(sensor);
  const frames = useSensorProjectionFrames([sensor]);
  const frame = frames.find((item) => item.bindingId === sensor.id);
  const editingSensor = frame?.url ? { ...sensor, frameUrl: frame.url, frameMeasuredAt: frame.measuredAt, resolution: frame.resolution ?? sensor.resolution } : sensor;
  useEffect(() => { sensorRef.current = sensor; }, [sensor]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const p = normalizeSensorProjection(sensor.textureProjection);
  const sample = p.kind === "VISION" ? activeVisionSample(sensor) : null;
  const vision = getSensorCapabilities(sensor).includes("VISION");
  const source = mediaUrl(sample?.url ?? editingSensor.frameUrl, sensor.dataSource === "DEMO");
  const surfaces = getEnclosureSurfaces(equipment);
  const imageSurface = resolveImageSurface(equipment, p);
  const update = (changes) => onChange(sensor.id, { textureProjection: normalizeSensorProjection({ ...p, equipmentId: equipment.id, ...changes }) });
  async function loadSample() {
    requestRef.current?.abort();
    const request = new AbortController(); requestRef.current = request;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(VISION_SAMPLE_URL, { signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`샘플 요청 실패 (${response.status})`);
      const bitmap = await createImageBitmap(await response.blob());
      const width = bitmap.width, height = bitmap.height; bitmap.close();
      if (request.signal.aborted) return;
      const current = sensorRef.current;
      onChange(sensor.id, {
        projectionSample: { enabled: true, url: VISION_SAMPLE_URL, width, height, loadedAt: new Date().toISOString() },
        textureProjection: normalizeSensorProjection({ ...current.textureProjection, enabled: true, kind: "VISION", equipmentId: equipment.id,
          target: current.textureProjection?.target ?? (assets.some((asset) => ["OBJ", "PLY"].includes(asset.assetType)) ? "ACTUAL" : "PROXY") }),
      });
      setMessage("샘플을 불러왔습니다. 오브젝트의 적용면을 선택하고 이미지를 조절하세요.");
    } catch (error) { if (!request.signal.aborted) setMessage(error.message || "샘플 이미지를 읽지 못했습니다."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  const exportPayload = p.kind === "VISION"
      ? imageProcessingPayload(readProjects().activeId, equipment, editingSensor, assets)
      : calibrationPayload(readProjects().activeId, equipment, editingSensor, assets);
  function exportImage() {
    downloadMonitoringJson("sensor-image-transform.json", exportPayload);
  }
  return <div className={styles.content}>
    <fieldset className={styles.settingsGroup}><legend>수신 이미지·테스트 소스</legend>
      <label className={styles.field}><span>수신 이미지 URL</span><input type="url" placeholder="https://…/frame-123.jpg" value={sensor.frameUrl ?? ""} onChange={(event) => onChange(sensor.id, { frameUrl: event.target.value })} /></label>
      {!sample && <p className={styles.help}>{editingSensor.frameMeasuredAt ? `최근 영상 · ${editingSensor.frameMeasuredAt}` : "서버 영상 수신 대기"} · 연결된 센서의 활성 영상은 5초 간격으로 조회합니다.</p>}
    {vision && <div className={styles.sampleSource}>
      <div className={styles.actionRow}>
        <button type="button" disabled={busy} onClick={loadSample}>{busy ? "샘플 불러오는 중…" : sample ? "샘플 다시 불러오기" : "샘플 불러오기"}</button>
        {sample && <button type="button" onClick={() => { onChange(sensor.id, { projectionSample: null }); setMessage("서버 영상으로 전환했습니다. 수신된 최신 영상이 있을 때 표시됩니다."); }}>샘플 해제</button>}
      </div>
      <p className={styles.help}>{sample ? `샘플 테스트 중 · ${sample.width} × ${sample.height}px · 실시간 수신 아님` : "첨부 사진을 서버 영상 대신 불러와 텍스처 맞춤을 시험합니다."}</p>
      {message && <p className={styles.help} role="status">{message}</p>}
    </div>}
    </fieldset>
    <fieldset className={styles.settingsGroup} data-setup-field="sensor-texture"><legend>오브젝트 텍스처</legend>
    <label className={styles.check}><input type="checkbox" checked={p.enabled} onChange={(event) => update({ enabled: event.target.checked })} />영상·온도 분포 입히기</label>
    {p.enabled && <>
      <label className={styles.field}><span>표시할 데이터</span><select value={p.kind} onChange={(event) => update({ kind: event.target.value })}><option value="VISION">비전 영상</option><option value="THERMAL">열화상·온도 분포</option></select></label>
      <label className={styles.field}><span>적용할 모델</span><select value={p.target} onChange={(event) => update({ target: event.target.value, meshPath: null, meshName: "", surfaceMapping: null, surfaceId: "" })}><option value="ACTUAL">스캔</option><option value="PROXY">도형</option><option value="BOTH">스캔 + 도형</option></select></label>
      {p.target !== "ACTUAL" && <label className={styles.field}><span>도형 적용면</span><select value={p.surfaceId} onChange={(event) => update({ surfaceId: event.target.value, surfaceMapping: null })}><option value="">{p.kind === "VISION" ? "오브젝트 기준 방향 사용" : "카메라에 보이는 면"}</option>{p.surfaceId && !surfaces.some((s) => s.id === p.surfaceId) && <option value={p.surfaceId}>적용면을 다시 선택하세요</option>}{surfaces.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
      {p.kind === "VISION" && !p.surfaceId && <label className={styles.field}><span>이미지를 붙일 방향</span><select value={p.surfaceMapping ? "PICKED" : p.imagePlane} onChange={(event) => update({ imagePlane: event.target.value, surfaceMapping: null })}>
        {p.surfaceMapping && <option value="PICKED">3D에서 선택한 표면</option>}{Object.entries(IMAGE_PLANES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>}
      {p.meshPath !== null && <p className={styles.help}>선택한 스캔 부분: {p.meshName || "이름 없음"} <button type="button" onClick={() => update({ meshPath: null, meshName: "", surfaceMapping: null })}>전체로 변경</button></p>}
      <p className={styles.help}>{p.kind === "VISION" ? "3D 화면의 ‘영상 적용면 선택’으로 붙일 면을 고르세요. 센서 설치 위치·방향·화각을 바꿔도 이미지 배치는 유지됩니다." : "3D 화면의 ‘영상 적용면 선택’으로 부분을 고르세요. 열화상은 센서의 방향·화각·관측 거리에 맞춰 표시됩니다."}</p>
      <label className={styles.field}><span>영상 불투명도 · {Math.round(p.opacity * 100)}%</span><input type="range" min="0" max="1" step=".01" value={p.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
      <ImageTransformEditor sensor={editingSensor} source={source} surface={p.kind === "VISION" ? imageSurface : { width: sensor.aspectRatio || 1, height: 1 }} onChange={update} onExport={exportImage} />
      <details className={styles.transformDetails}><summary>현재 변환 수치·내보내기</summary>
        <p className={styles.help}>가로 {(p.scaleX * p.zoom * 100).toFixed(1)}% · 세로 {(p.scaleY * p.zoom * 100).toFixed(1)}% · 회전 {p.rotation}° · 기준점 ({p.pivotX}, {p.pivotY})</p>
        <pre className={styles.transformJson}>{JSON.stringify(exportPayload, null, 2)}</pre>
        <button type="button" onClick={exportImage}>이미지 가공 JSON 내보내기</button>
        <p className={styles.help}>원본 크기·편집 수치·변환 행렬·적용면 기준을 내보냅니다. 비전 이미지 가공값은 센서 설치 좌표와 별개로 보관합니다.</p>
      </details>
      {p.kind === "THERMAL" && <><div className={styles.rangeGrid}><NumericField label="낮은 온도" unit="°C" value={p.temperatureMin} onChange={(value) => update({ temperatureMin: value })} /><NumericField label="높은 온도" unit="°C" value={p.temperatureMax} onChange={(value) => update({ temperatureMax: value })} /></div><p className={styles.help}>온도 배열을 받으면 낮은 온도는 파랑, 높은 온도는 빨강으로 표시합니다. 열화상 이미지는 받은 색상으로 표시합니다.</p>{p.temperatureMax <= p.temperatureMin && <p role="alert">높은 온도를 낮은 온도보다 크게 입력하세요.</p>}</>}
    </>}
  </fieldset></div>;
}
