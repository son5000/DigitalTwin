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
const ROI_STATUS_LABELS = { NORMAL: "정상", WARNING: "요주의", DANGER: "이상", NO_DATA: "수신 대기", IDLE: "조회 전용" };
function normalizedPoint(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
}

export default function VirtualCameraViewport({ equipment, cameras = [], cameraController, activeId, onActiveChange, editor = false, sensors = [], points = [], onAdd,
  panelOpen = false, selectedRoiId = null, roiStatuses = {}, onRoiSelect, onEditSelectedRoi, roiDetails, roiLoading = false, roiEditing = false, onViewReady,
  thermalAvailable = false, thermalEnabled = false, onThermalChange, imageVersion = "" }) {
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [configuration, setConfiguration] = useState(null);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const regionListRef = useRef(null);
  const lastInteraction = useRef(0);
  const onViewReadyRef = useRef(onViewReady);
  useEffect(() => { onViewReadyRef.current = onViewReady; }, [onViewReady]);
  const camera = cameras.find((item) => item.id === activeId);
  const currentImage = image && image.camera === camera && image.thermal === thermalEnabled ? image.source : "";
  const savedPoints = points.filter((point) => point.virtualCameraRegion?.cameraId === camera?.id);
  const selectedPoint = savedPoints.find((point) => point.id === selectedRoiId);
  const canAdd = editor || Boolean(onAdd);
  const visibleCameras = cameras.length > 8 && !expanded ? cameras.slice(0, 8) : cameras;
  const cameraId = camera?.id;
  useEffect(() => {
    if (!cameraId) return undefined;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector(adding ? '[aria-label="관측 항목"] button'
      : editor ? "header select, header button:not(:disabled)" : `.${styles.contextNavigation} select`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [cameraId, adding, editor]);
  function selectMetric(values) {
    const metric = values[0];
    if (!metric) { setConfiguration(null); return; }
    const textureKind = observationTextureKind([{ metric }]);
    if (textureKind && !sensors.some((sensor) => sensor.equipmentIds?.includes(equipment.id)
      && sensor.textureProjection?.enabled && (sensor.textureProjection.kind ?? "VISION") === textureKind)) {
      setError("게이지·스위치·LED·밸브를 읽으려면 설비에 비전 카메라 영상을 먼저 표시하세요."); return;
    }
    setConfiguration({ textureKind, measurements: [{ id: createId("ROI_VALUE"), name: OBSERVATION_METRICS[metric][0],
      metric, unit: OBSERVATION_METRICS[metric][1], sensorId: "", visible: true, rules: [] }] });
    setError("");
  }
  function closeCreation() { setAdding(false); setConfiguration(null); setStart(null); setEnd(null); setError(""); }
  function switchCamera(id) {
    if (!id || id === camera?.id) return;
    if (adding) closeCreation();
    onActiveChange(id);
  }
  function returnToCamera() {
    onRoiSelect?.("");
    requestAnimationFrame(() => (regionListRef.current?.querySelector("button")
      ?? dialogRef.current?.querySelector(`.${styles.contextNavigation} select`))?.focus());
  }
  useEffect(() => {
    if (!camera) return undefined;
    let frame = 0, timer, idle, viewIdle, viewTimer, attempts = 0, previewed = false, cancelled = false;
    const inputBusy = () => !editor && (performance.now() - lastInteraction.current < 350
      || navigator.scheduling?.isInputPending?.({ includeContinuous: true }));
    const retry = () => {
      if (cancelled) return;
      if (++attempts < 16) timer = setTimeout(capture, 250);
      else {
        setError("현재 시점의 이미지를 만들지 못했습니다. 잠시 후 가상 카메라를 다시 선택하세요.");
        if (!editor) onViewReadyRef.current?.({ cameraId: camera.id, center: null, temperature: null });
      }
    };
    const capture = () => {
      const controller = cameraController?.current;
      if (!controller?.ready() || controller.equipmentId !== equipment.id) { retry(); return; }
      if (!previewed) {
        if (!controller.previewVirtualCamera(camera)) { retry(); return; }
        previewed = true;
      }
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        if (inputBusy()) { timer = setTimeout(capture, 200); return; }
        try {
          const snapshot = controller.captureImage({ thermal: thermalEnabled, includeThermalMap: !editor && thermalAvailable });
          if (!snapshot) { retry(); return; }
          setImage({ camera, source: typeof snapshot === "string" ? snapshot : snapshot.url, thermal: thermalEnabled });
          if (!editor) {
            const publishView = () => {
              if (cancelled) return;
              if (inputBusy()) { viewTimer = setTimeout(publishView, 200); return; }
              try {
                const center = controller.pickImagePoint(.5, .5)?.position
                  ?? controller.projectImagePointToPlane(.5, .5)?.position ?? null;
                onViewReadyRef.current?.({ cameraId: camera.id, center,
                  temperature: thermalAvailable ? controller.temperatureForVirtualCamera(equipment.id, snapshot.thermalMap) : null });
              } catch {
                setError("현재 시점의 온도 데이터를 분석하지 못했습니다.");
                onViewReadyRef.current?.({ cameraId: camera.id, center: null, temperature: null });
              }
            };
            if (window.requestIdleCallback) viewIdle = window.requestIdleCallback(publishView, { timeout: 1000 });
            else viewTimer = setTimeout(publishView, 0);
          }
          setError(""); setStart(null); setEnd(null);
        } catch {
          setError("현재 시점의 이미지를 만들지 못했습니다.");
          if (!editor) onViewReadyRef.current?.({ cameraId: camera.id, center: null, temperature: null });
        }
      });
    };
    timer = setTimeout(() => {
      setImage((previous) => previous?.camera === camera && previous.thermal === thermalEnabled ? previous : null);
      setError("");
      if (!editor && window.requestIdleCallback) idle = window.requestIdleCallback(capture, { timeout: 1000 });
      else capture();
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(viewTimer); cancelAnimationFrame(frame);
      if (idle != null) window.cancelIdleCallback(idle);
      if (viewIdle != null) window.cancelIdleCallback(viewIdle); };
  }, [camera, cameraController, equipment.id, thermalEnabled, thermalAvailable, imageVersion, editor]);
  async function finish(event) {
    if (!start || !configuration) return;
    const final = normalizedPoint(event);
    setEnd(final); setStart(null);
    const rect = { x: Math.min(start.x, final.x), y: Math.min(start.y, final.y),
      width: Math.abs(final.x - start.x), height: Math.abs(final.y - start.y) };
    if (rect.width < .01 || rect.height < .01) { setError("이미지에서 관측할 사각형을 충분히 크게 드래그하세요."); return; }
    const controller = cameraController?.current;
    const centerX = rect.x + rect.width / 2, centerY = rect.y + rect.height / 2;
    const imageCorners = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]];
    const center = configuration.textureKind
      ? controller?.pickImagePoint(centerX, centerY, configuration.textureKind)
      : controller?.projectImagePointToPlane(centerX, centerY, controller?.pickImagePoint(centerX, centerY)?.position);
    const corners = imageCorners.map(([x, y]) => configuration.textureKind
      ? controller?.pickImagePoint(x, y, configuration.textureKind)
      : controller?.projectImagePointToPlane(x, y, center?.position));
    if (!center || corners.some((hit) => !hit || (configuration.textureKind
      && (hit.hit.object.uuid !== center.hit.object.uuid || hit.sensor?.id !== center.sensor?.id)))) {
      setError(configuration.textureKind
        ? "선택한 영역이 한 카메라 영상 안에 들어오도록 조금 좁혀 다시 그려주세요."
        : "선택한 위치의 좌표를 계산하지 못했습니다. 설비가 보이는 곳에서 다시 그려주세요."); return;
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
        if (area < 1e-6) throw new Error("선택한 영역이 너무 작거나 겹쳐 있습니다. 다시 그려주세요.");
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
      closeCreation(); setError(editor ? "관측 영역을 추가했습니다." : "영역을 지정했습니다. 오른쪽에서 이름과 경보 기준을 확인한 뒤 저장하세요.");
    } catch (issue) { setError(issue.message || "영역을 연결하지 못했습니다."); }
  }
  const imageView = currentImage ? <div className={styles.image} data-drawing={Boolean(adding && configuration)} onDragStart={(event) => event.preventDefault()}
    onPointerDown={(event) => { if (!adding || !configuration) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const point = normalizedPoint(event); setStart(point); setEnd(point); }}
    onPointerMove={(event) => { if (start) { event.preventDefault(); setEnd(normalizedPoint(event)); } }} onPointerUp={finish} onPointerCancel={() => { setStart(null); setEnd(null); }}>
    <img src={currentImage} alt={`${camera?.name} 시점의 설비 2D 이미지`} draggable="false" onDragStart={(event) => event.preventDefault()} />
    {savedPoints.map((point) => { const rect = point.virtualCameraRegion.rect; const regionStyle = { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` };
      return editor || adding ? <span key={point.id} className={styles.savedRegion} style={regionStyle}><b>{point.name}</b></span>
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
        onPointerDownCapture={() => { lastInteraction.current = performance.now(); }} onPointerMoveCapture={() => { lastInteraction.current = performance.now(); }}
        onKeyDown={(event) => { lastInteraction.current = performance.now(); if (event.key !== "Escape") return; event.stopPropagation(); if (adding) closeCreation(); else if (selectedPoint) returnToCamera(); else onActiveChange(null); }}>
        <header className={styles.dialogHeader}><div className={styles.headerContext}>{!editor && <nav className={styles.contextNavigation} aria-label="카메라 이동">
            <label><span>카메라</span><select value={camera.id} onChange={(event) => switchCamera(event.target.value)}>
              {cameras.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
          </nav>}
          {editor && <div className={styles.heading}><strong>{adding ? "새 관측 영역" : camera.name}</strong><span>{adding ? camera.name : `관측 영역 ${savedPoints.length}개`}</span></div>}
          {editor && cameras.length > 1 && <nav className={styles.cameraNavigation} aria-label="가상 카메라 이동">
            <label className={styles.cameraSelector}><span className={styles.navigationLabel}>카메라</span>
              <select value={camera.id} onChange={(event) => switchCamera(event.target.value)}>
                {cameras.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </nav>}
          {!editor && selectedPoint && !adding && <button type="button" className={`${styles.headerButton} ${styles.backButton}`} onClick={returnToCamera}>목록으로</button>}
          </div><div className={styles.headerActions}>
            {!editor && <div className={styles.displaySwitch} role="group" aria-label="영상 표시">
              <button type="button" aria-pressed={!thermalEnabled} onClick={() => onThermalChange?.(false)}>비전</button>
              <button type="button" aria-pressed={thermalEnabled} onClick={() => onThermalChange?.(true)}>열화상</button>
            </div>}
            {canAdd && (adding ? <button type="button" className={`${styles.headerButton} ${styles.backButton}`} onClick={closeCreation}>영역 추가 취소</button>
            : <button type="button" className={editor ? styles.addButton : styles.addRegionButton} aria-label="이 카메라에 관측 영역 추가" title="이 카메라에 관측 영역 추가" onClick={() => { setAdding(true); setError(""); }}>{editor ? "+" : "+ 관측 영역 추가"}</button>)}
            {!editor && selectedPoint && !adding && !roiEditing && <button type="button" className={`${styles.headerButton} ${styles.settingsButton}`} onClick={onEditSelectedRoi} aria-label={`${selectedPoint.name} 설정`}>설정</button>}
            <button type="button" className={`${styles.headerButton} ${styles.closeButton}`} onClick={() => onActiveChange(null)}>닫기</button></div></header>
        {canAdd && adding && <div className={styles.creationBar}><strong>무엇을 확인할까요?</strong>
          <ObservationMetricChoices compact allowedMetrics={VIRTUAL_CAMERA_ROI_METRICS}
            values={configuration?.measurements.map((item) => item.metric) ?? []} onChange={selectMetric} /></div>}
        {editor ? imageView : <div className={styles.viewerBody}>
          <div className={styles.previewColumn}>
            {imageView}
            {selectedPoint?.geometryType === "PLANE" && <p className={styles.regionInfo} aria-label="관측 범위 크기">
              가로 {selectedPoint.planeWidth.toFixed(2)} m · 세로 {selectedPoint.planeHeight.toFixed(2)} m
            </p>}</div>
          <aside className={styles.roiDetails} aria-label={selectedPoint ? "관측 영역 상세" : `${camera.name} 관측 영역 목록`} aria-busy={roiLoading} data-editing={roiEditing} data-overview={!adding && !selectedPoint}>
            <div className={styles.scopeHeading}><strong>{adding ? "새 관측 영역" : selectedPoint?.name ?? camera.name}</strong></div>
            {!adding && !selectedPoint && (savedPoints.length ? <nav ref={regionListRef} className={styles.regionList} aria-label="관측 영역 목록">
              <ul>{savedPoints.map((point) => { const status = roiStatuses[point.id] ?? "NO_DATA"; return <li key={point.id}>
                <button type="button" title={`${point.name} · ${ROI_STATUS_LABELS[status] ?? "수신 대기"}`} onClick={() => onRoiSelect?.(point.id)}>
                  <span className={styles.regionName}>{point.name}</span><span className={styles.regionStatus} data-status={status}>{ROI_STATUS_LABELS[status] ?? "수신 대기"}</span>
                </button>
              </li>; })}</ul>
            </nav> : <p className={styles.emptyRegions}>등록된 관측 영역이 없습니다.</p>)}
            {adding ? <p>확인할 항목을 고른 뒤 왼쪽 이미지에서 영역을 드래그하세요.</p> : selectedPoint && roiLoading
              ? <div className={styles.analysisStatus} role="status" aria-live="polite"><span className={styles.analysisSpinner} aria-hidden="true" /><div><span>관측 데이터를 분석하는 중…</span></div></div>
              : selectedPoint ? roiDetails : null}
          </aside>
        </div>}
        {error && <p className={styles.feedback} role="status">{error}</p>}
      </section>
    </div>}
  </>;
}
