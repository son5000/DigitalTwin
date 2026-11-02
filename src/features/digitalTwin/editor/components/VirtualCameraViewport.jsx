import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";
import ObservationMetricChoices from "./ObservationMetricChoices.jsx";
import { OBSERVATION_METRICS, VIRTUAL_CAMERA_ROI_METRICS } from "../model/observationMetrics.js";
import { createId } from "../model/equipmentDetailModel.js";
import { bindObservationMeasurements } from "../model/observationSource.js";
import { observationTextureKind } from "../model/observationSource.js";
import { createThermalObservationBinding } from "../model/observationSource.js";
import { captureObservationImage } from "../api/imageObservationAsset.js";
import { createImageObservationBinding } from "../model/imageObservation.js";
import styles from "./VirtualCameraViewport.module.css";

const clamp = (value) => Math.max(0, Math.min(1, value));
function normalizedPoint(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
}

export default function VirtualCameraViewport({ equipment, cameras = [], cameraController, activeId, onActiveChange, editor = false, sensors = [], points = [], onAdd,
  panelOpen = false, selectedRoiId = null, onRoiSelect, roiDetails }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [configuration, setConfiguration] = useState(null);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const camera = cameras.find((item) => item.id === activeId);
  const savedPoints = points.filter((point) => point.virtualCameraRegion?.cameraId === camera?.id);
  const selectedPoint = savedPoints.find((point) => point.id === selectedRoiId);
  const visibleCameras = cameras.length > 8 && !expanded ? cameras.slice(0, 8) : cameras;
  const cameraId = camera?.id;
  useEffect(() => {
    if (!cameraId) return undefined;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector(adding ? '[aria-label="관측 항목"] button' : "header button")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [cameraId, adding]);
  function selectMetric(values) {
    const metric = values[0];
    if (!metric) { setConfiguration(null); return; }
    const textureKind = observationTextureKind([{ metric }]);
    if (textureKind && !sensors.some((sensor) => sensor.equipmentIds?.includes(equipment.id)
      && sensor.textureProjection?.enabled && (sensor.textureProjection.kind ?? "VISION") === textureKind)) {
      setError("비전 텍스처가 연결된 카메라를 먼저 설정하세요."); return;
    }
    setConfiguration({ textureKind, measurements: [{ id: createId("ROI_VALUE"), name: OBSERVATION_METRICS[metric][0],
      metric, unit: OBSERVATION_METRICS[metric][1], sensorId: "", visible: true, rules: [] }] });
    setError("");
  }
  function closeCreation() { setAdding(false); setConfiguration(null); setStart(null); setEnd(null); setError(""); }
  useEffect(() => {
    if (!camera) return undefined;
    let frame = 0;
    const timer = setTimeout(() => {
      setImage("");
      const controller = cameraController?.current;
      if (!controller?.ready() || controller.equipmentId !== equipment.id || !controller.previewVirtualCamera(camera)) {
        setError("모델을 불러온 뒤 가상 카메라를 다시 선택하세요."); return;
      }
      frame = requestAnimationFrame(() => {
        try {
          const snapshot = controller.captureImage();
          setImage(snapshot ?? ""); setError(snapshot ? "" : "현재 시점의 이미지를 만들지 못했습니다."); setStart(null); setEnd(null);
        } catch { setImage(""); setError("현재 시점을 이미지로 만들지 못했습니다."); }
      });
    }, 0);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [camera, cameraController, equipment.id]);
  async function finish(event) {
    if (!start || !configuration) return;
    const final = normalizedPoint(event);
    setEnd(final); setStart(null);
    const rect = { x: Math.min(start.x, final.x), y: Math.min(start.y, final.y),
      width: Math.abs(final.x - start.x), height: Math.abs(final.y - start.y) };
    if (rect.width < .01 || rect.height < .01) { setError("이미지에서 관측할 사각형을 충분히 크게 드래그하세요."); return; }
    const controller = cameraController?.current;
    const corners = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]
      .map(([x, y]) => controller?.pickImagePoint(x, y, configuration.textureKind));
    const center = controller?.pickImagePoint(rect.x + rect.width / 2, rect.y + rect.height / 2, configuration.textureKind);
    if (!center || corners.some((hit) => !hit || hit.hit.object.uuid !== center.hit.object.uuid || hit.sensor?.id !== center.sensor?.id)) {
      setError("사각형 전체가 같은 설비 표면과 텍스처 안에 있어야 합니다. 영역을 좁혀 다시 지정하세요."); return;
    }
    try {
      let imageBinding = null, thermalBinding = null, sourceCorners = null;
      if (configuration.textureKind === "VISION") {
        const originalImage = await captureObservationImage(center.sensor, center.frame);
        imageBinding = createImageObservationBinding(center.position, equipment, center.sensor, originalImage, center.hit.sourceUv);
        sourceCorners = corners.map((hit) => hit.hit.sourceUv);
        const area = Math.abs(sourceCorners.reduce((sum, [x, y], index) => {
          const [nextX, nextY] = sourceCorners[(index + 1) % 4]; return sum + x * nextY - nextX * y;
        }, 0)) / 2;
        if (area < 1e-6) throw new Error("원본 이미지에서 영역이 너무 작거나 접혀 있습니다. 다시 지정하세요.");
        const xs = sourceCorners.map((uv) => uv[0]), ys = sourceCorners.map((uv) => uv[1]);
        imageBinding.sourceRect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        imageBinding.sourceQuad = sourceCorners;
      } else if (configuration.textureKind === "THERMAL") {
        thermalBinding = createThermalObservationBinding(center.hit, equipment, center.position);
        sourceCorners = corners.map((hit) => hit.hit.sourceUv);
      }
      const vertices = corners.map((hit) => [hit.position.x, hit.position.y, hit.position.z]);
      const cameraRegion = { cameraId: camera.id, doorState: camera.doorState ?? null, rect, imageSize: { width: 640, height: 400 },
        coordinateOrigin: "TOP_LEFT", space: "EQUIPMENT_MODEL_LOCAL", vertices, view: camera.view,
        ...(sourceCorners ? { texture: { kind: configuration.textureKind, sensorId: center.sensor.id,
          sourceUvCorners: sourceCorners, sourcePixelCorners: sourceCorners.map(([x, y]) => [x * (imageBinding?.originalImage?.width ?? thermalBinding?.source?.width ?? center.sensor.resolution?.width ?? 0),
            y * (imageBinding?.originalImage?.height ?? thermalBinding?.source?.height ?? center.sensor.resolution?.height ?? 0)]) } } : {}) };
      const measurements = bindObservationMeasurements(configuration.measurements, { imageBinding, thermalBinding });
      const createdId = onAdd?.(center.position, { geometryType: "PLANE", targetNormal: center.normal,
        planeWidth: new Vector3(...vertices[0]).distanceTo(new Vector3(...vertices[1])),
        planeHeight: new Vector3(...vertices[0]).distanceTo(new Vector3(...vertices[3])),
        virtualCameraRegion: cameraRegion, imageBinding, thermalBinding, measurements });
      if (!createdId) throw new Error("관측 영역을 저장하지 못했습니다. 다시 시도하세요.");
      closeCreation(); setError("관측 영역을 추가했습니다.");
    } catch (issue) { setError(issue.message || "영역을 연결하지 못했습니다."); }
  }
  const imageView = image ? <div className={styles.image} data-drawing={Boolean(adding && configuration)} onPointerDown={(event) => { if (!adding || !configuration) return; event.currentTarget.setPointerCapture(event.pointerId); const point = normalizedPoint(event); setStart(point); setEnd(point); }}
    onPointerMove={(event) => { if (start) setEnd(normalizedPoint(event)); }} onPointerUp={finish} onPointerCancel={() => { setStart(null); setEnd(null); }}>
    <img src={image} alt={`${camera?.name} 시점의 설비 2D 이미지`} draggable="false" />
    {savedPoints.map((point) => { const rect = point.virtualCameraRegion.rect; const regionStyle = { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` };
      return editor ? <span key={point.id} className={styles.savedRegion} style={regionStyle}><b>{point.name}</b></span>
        : <button key={point.id} type="button" className={styles.savedRegion} style={regionStyle} aria-label={`${point.name} 관측 영역 보기`} aria-pressed={selectedRoiId === point.id} onClick={() => onRoiSelect?.(point.id)}><b>{point.name}</b></button>; })}
    {adding && configuration && !start && <span className={styles.canvasPrompt}>이미지에서 드래그</span>}
    {start && end && <span className={styles.selection} style={{ left: `${Math.min(start.x, end.x) * 100}%`, top: `${Math.min(start.y, end.y) * 100}%`, width: `${Math.abs(end.x - start.x) * 100}%`, height: `${Math.abs(end.y - start.y) * 100}%` }} />}
  </div> : <p className={styles.imagePending}>관측 이미지를 준비하고 있습니다.</p>;
  return <>
    {cameras.length > 0 && !editor && <nav className={styles.launch} data-camera-safe-ui data-panel-open={panelOpen} aria-label="가상 카메라 목록">
      <div className={styles.launchHeading}><strong>가상 카메라</strong><span>{cameras.length}개</span></div>
      <div className={styles.cameraList}>{visibleCameras.map((item) => <button key={item.id} type="button" aria-current={activeId === item.id ? "true" : undefined} onClick={() => onActiveChange(item.id)}>{item.name}</button>)}</div>
      {cameras.length > 8 && <button type="button" className={styles.moreButton} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "접기" : `더보기 · ${cameras.length - 8}개`}</button>}
    </nav>}
    {camera && <div className={styles.backdrop} data-camera-safe-ui>
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label={`${camera.name} 2D 관측 이미지`} data-mode={adding ? "create" : "view"} data-editor={editor}
        onKeyDown={(event) => { if (event.key !== "Escape") return; event.stopPropagation(); if (adding) closeCreation(); else onActiveChange(null); }}>
        <header><div className={styles.heading}><strong>{adding ? "새 관측 영역" : camera.name}</strong><span>{adding ? camera.name : `관측 영역 ${savedPoints.length}개`}</span></div>
          <div className={styles.headerActions}>{editor && (adding ? <button type="button" onClick={closeCreation}>시점 보기</button>
            : <button type="button" className={styles.addButton} aria-label="관측 영역 추가" title="관측 영역 추가" onClick={() => { setAdding(true); setError(""); }}>+</button>)}
            <button type="button" onClick={() => onActiveChange(null)}>닫기</button></div></header>
        {editor && adding && <div className={styles.creationBar}><strong>관측 항목</strong>
          <ObservationMetricChoices compact allowedMetrics={VIRTUAL_CAMERA_ROI_METRICS}
            values={configuration?.measurements.map((item) => item.metric) ?? []} onChange={selectMetric} /></div>}
        {editor ? imageView : <div className={styles.viewerBody}>
          <div className={styles.previewColumn}>{imageView}<section className={styles.regionList} aria-label={`${camera.name} 관측 영역 목록`}>
            <div className={styles.regionHeading}><strong>관측 영역</strong><span>{savedPoints.length}개</span></div>
            {savedPoints.length ? <div className={styles.regionItems}>{savedPoints.map((point) => <button key={point.id} type="button" aria-pressed={selectedRoiId === point.id} onClick={() => onRoiSelect?.(point.id)}>{point.name}</button>)}</div>
              : <p>등록된 관측 영역이 없습니다.</p>}
          </section></div>
          <aside className={styles.roiDetails} aria-label="관측 영역 상세">{selectedPoint ? roiDetails : <p>영역을 선택하면 측정값과 설정이 표시됩니다.</p>}</aside>
        </div>}
        {error && <p className={styles.feedback} role="status">{error}</p>}
      </section>
    </div>}
  </>;
}
