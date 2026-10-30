import { useEffect, useMemo, useRef, useState } from "react";
import EquipmentObservationScene from "../three/EquipmentObservationScene";
import useSensorProjectionFrames from "../store/useSensorProjectionFrames";
import useRoiMonitoring from "../store/useRoiMonitoring";
import { clampRoiRadius, getRoiReading, isObservationRoi, observationPointToRoi, roiToObservationPoint, ROI_METRICS, ROI_STATUSES } from "../model/roiMonitoring.js";
import { readProjects } from "@/features/portal/projects/projectRepository";
import styles from "./MonitoringRoiWorkspace.module.css";
import MonitoringDataPanel from "./MonitoringDataPanel";
import useEquipmentTelemetry from "../store/useEquipmentTelemetry";
import { demoFrame, demoReading } from "../model/monitoringDemo";
import { isFreshMeasurement, mediaUrl, modelReference } from "../model/monitoringContract";
import { sensorProjectionFrame } from "../model/sensorProjection.js";
import { temperatureSummary } from "../model/thermalFrame.js";
import { observationReadings, observationStatus } from "../model/observationReadings.js";
import ObservationRoiFields from "./ObservationRoiFields";
import InteractionGuide from "./InteractionGuide";
import ObservationReadout from "./ObservationReadout";
import ViewerOverlaySlot from "./ViewerOverlaySlot";
import RoiDashboard from "./RoiDashboard";
import MonitoringQuickTools from "./MonitoringQuickTools";
import { imageObservationIssue, resolveImageObservation } from "../model/imageObservation.js";
import ObservationCreationFields from "./ObservationCreationFields.jsx";
import { normalizeObservationPoint } from "../model/equipmentDetailModel.js";
import { bindObservationMeasurements, thermalObservationIssue } from "../model/observationSource.js";

const EMPTY_SENSORS = [];
const thermalSummaryCache = new WeakMap();

function thermalFrameSummary(grid) {
  if (!grid || typeof grid !== "object") return null;
  if (!thermalSummaryCache.has(grid)) thermalSummaryCache.set(grid, temperatureSummary(grid));
  return thermalSummaryCache.get(grid);
}

function RoiFields({ draft, setDraft }) {
  function updateRule(index, changes) { setDraft((current) => ({ ...current, rules: current.rules.map((rule, i) => i === index ? { ...rule, ...changes } : rule) })); }
  return <>
    <label>ROI 이름<input value={draft.name} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
    <fieldset><legend>표시할 측정값</legend><div className={styles.choices}>{ROI_METRICS.map((metric) => <label key={metric.id}>
      <input type="checkbox" checked={draft.displayMetrics.includes(metric.id)} onChange={(event) => setDraft((current) => ({ ...current,
        displayMetrics: event.target.checked ? [...current.displayMetrics, metric.id] : current.displayMetrics.filter((id) => id !== metric.id) }))} />{metric.label}
    </label>)}</div></fieldset>
    <label className={styles.check}><input type="checkbox" checked={draft.monitoringEnabled} onChange={(event) => setDraft((current) => ({ ...current, monitoringEnabled: event.target.checked }))} />저장 후 이상 감시 사용</label>
    <details open={draft.monitoringEnabled || undefined}><summary>임계치 설정 · {draft.rules.length}개</summary>
      <p className={styles.hint}>화면에 표시하지 않는 값도 감시할 수 있습니다.</p>
      {draft.rules.map((rule, index) => <fieldset key={index} className={styles.rule}><legend>조건 {index + 1}</legend>
        <label>측정 항목<select value={rule.metric} onChange={(event) => updateRule(index, { metric: event.target.value })}>{ROI_METRICS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label} ({metric.unit})</option>)}</select></label>
        <div className={styles.columns}><label>기준값<input type="number" step="any" value={rule.threshold} onChange={(event) => updateRule(index, { threshold: event.target.value === "" ? "" : Number(event.target.value) })} /></label>
          <label>조건<select value={rule.operator} onChange={(event) => updateRule(index, { operator: event.target.value })}><option value="gte">이상</option><option value="gt">초과</option><option value="lt">미만</option></select></label></div>
        <div className={styles.columns}><label>상태<select value={rule.severity} onChange={(event) => updateRule(index, { severity: event.target.value })}><option value="WARNING">주의</option><option value="DANGER">위험</option></select></label>
          <label>지속 시간 (초)<input type="number" min="0" step="1" value={rule.durationSeconds} onChange={(event) => updateRule(index, { durationSeconds: event.target.value === "" ? "" : Number(event.target.value) })} /></label></div>
        <button type="button" onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((_, i) => i !== index) }))}>조건 삭제</button>
      </fieldset>)}
      <button type="button" onClick={() => setDraft((current) => ({ ...current, rules: [...current.rules, { metric: "temperature.max", operator: "gt", threshold: "", severity: "WARNING", durationSeconds: 0 }] }))}>임계치 추가</button>
    </details>
  </>;
}

export default function MonitoringRoiWorkspace({ projectId: providedId, activePanel, onPanelChange, sharedPanelLayout = false, editorMode = false, initialRoi = null, ...sceneProps }) {
  const [projectId] = useState(() => providedId || readProjects().activeId);
  const monitoring = useRoiMonitoring(projectId);
  const { preview: queryPreview, shared } = monitoring;
  const equipmentId = sceneProps.focusEquipmentId ?? sceneProps.equipment?.id;
  const equipment = sceneProps.equipment ?? sceneProps.equipmentList?.find((item) => item.id === equipmentId);
  const model = useMemo(() => modelReference(equipment, sceneProps.assetBindings), [equipment, sceneProps.assetBindings]);
  const compatibleRois = useMemo(() => monitoring.rois.filter((roi) => roi.equipmentId !== equipmentId || !roi.surface?.model?.version || roi.surface.model.version === model.version), [monitoring.rois, equipmentId, model.version]);
  const telemetry = useEquipmentTelemetry(projectId, equipmentId, compatibleRois);
  const projectionSensors = sceneProps.sensors ?? EMPTY_SENSORS;
  const projectionFrames = useSensorProjectionFrames(projectionSensors);
  const viewerCamera = useRef(null);
  const thermalFocused = useRef(false);
  const [localPanel, setLocalPanel] = useState(initialRoi ? "ROI" : null);
  const [audioRoiId, setAudioRoiId] = useState("");
  const panel = activePanel === undefined ? localPanel : activePanel;
  const open = panel === "ROI", audioOpen = panel === "AUDIO";
  const dataOpen = ["AUDIO", "THERMAL", "ALARMS"].includes(panel);
  function selectPanel(next) {
    if (busy || (panel === "ROI" && next !== "ROI" && editing && !cancelEditing())) return false;
    if (onPanelChange) onPanelChange(next); else setLocalPanel(next);
    setDrawingFor(null);
    setPickingFor(null);
    if (next === "AUDIO" && panel !== "AUDIO") { setAudioRoiId(""); setPointSelection(null); }
    if (panel === "THERMAL" && next === null) setThermalFor(null);
    return true;
  }
  const [thermalFor, setThermalFor] = useState(null);
  const thermalActive = Boolean(equipmentId && thermalFor === equipmentId);
  const [opacity, setOpacity] = useState(1);
  const [pointSelection, setPointSelection] = useState(null);
  const [pickingFor, setPickingFor] = useState(null);
  const [layerError, setLayerError] = useState("");
  const point = pointSelection?.equipmentId === equipmentId && pointSelection.modelVersion === model.version ? pointSelection : null;
  const picking = audioOpen && pickingFor === equipmentId && Boolean(equipmentId) && !sceneProps.sensorViewId;
  const [draft, setDraft] = useState(initialRoi);
  const [editing, setEditing] = useState(false);
  const [previousInitialRoi, setPreviousInitialRoi] = useState(initialRoi);
  const [drawingFor, setDrawingFor] = useState(null);
  const [creation, setCreation] = useState(null);
  const [radius, setRadius] = useState(.15);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [focusVersion, setFocusVersion] = useState(initialRoi ? 1 : 0);
  const selectedDraft = draft?.equipmentId === equipmentId ? draft : null;
  const currentDraft = !editing && selectedDraft ? monitoring.rois.find((roi) => roi.id === selectedDraft.id) ?? selectedDraft : selectedDraft;
  const drawing = Boolean(open && equipmentId && drawingFor === equipmentId);
  const scoped = monitoring.rois.filter((roi) => roi.equipmentId === equipmentId);
  const saved = currentDraft ? monitoring.rois.find((roi) => roi.id === currentDraft.id) : null;
  const dirty = editing && currentDraft && JSON.stringify(currentDraft) !== JSON.stringify(saved);
  const geometryChanged = Boolean(currentDraft?.surface?.model?.version && currentDraft.surface.model.version !== model.version);
  const rois = useMemo(() => currentDraft && !geometryChanged ? [...compatibleRois.filter((roi) => roi.id !== currentDraft.id), currentDraft] : compatibleRois, [compatibleRois, currentDraft, geometryChanged]);
  const displayPoints = useMemo(() => editorMode ? sceneProps.observationPoints : rois.filter(isObservationRoi).map(roiToObservationPoint), [editorMode, sceneProps.observationPoints, rois]);
  const readings = telemetry.status === "DISCONNECTED" ? monitoring.readings : telemetry.readings;
  const statuses = useMemo(() => Object.fromEntries(monitoring.rois.map((roi) => {
    const status = isObservationRoi(roi) ? observationStatus(observationReadings(roiToObservationPoint(roi), sceneProps.sensors, compatibleRois.includes(roi) ? readings : [], telemetry.now)).level
      : getRoiReading(roi, compatibleRois.includes(roi) ? readings.find((reading) => reading.roiId === roi.id) : null, telemetry.now).status;
    return [roi.id, ROI_STATUSES[status] ? status : "NO_DATA"];
  })), [monitoring.rois, compatibleRois, readings, telemetry.now, sceneProps.sensors]);
  const previewReading = preview?.signature === JSON.stringify(currentDraft) ? preview.reading : null;
  const reading = currentDraft ? getRoiReading(currentDraft, geometryChanged ? null : saved && !dirty ? readings.find((item) => item.roiId === currentDraft.id) : telemetry.demo ? { ...demoReading(currentDraft, telemetry.now), status: null } : previewReading, telemetry.now) : null;
  const demoFrameTime = Math.floor(telemetry.now / 5000) * 5000;
  const layerData = useMemo(() => {
    if (!telemetry.demo || !equipment) return { textures: telemetry.textures, hotspots: telemetry.hotspots };
    const bases = ["PROXY", "ACTUAL"].map((representation) => ({ equipmentId, modelVersion: model.version, representation, measuredAt: new Date(demoFrameTime).toISOString(), quality: "GOOD", staleAfterMs: 15000 }));
    return { textures: bases.flatMap((base) => ["VISION", "THERMAL"].map((kind) => ({ ...base, kind, mapping: "UV", url: demoFrame(kind) }))),
      hotspots: bases.map((base) => ({ ...base, position: [0, (equipment.dimensions?.height ?? 1) * .55, (equipment.dimensions?.depth ?? 1) * .5], db: 65.4, radius: .08 })) };
  }, [telemetry.demo, telemetry.textures, telemetry.hotspots, equipment, equipmentId, model.version, demoFrameTime]);
  const textures = useMemo(() => [...layerData.textures, ...projectionFrames], [layerData.textures, projectionFrames]);
  const thermalReadouts = useMemo(() => projectionSensors.filter((sensor) => sensor.textureProjection?.enabled
    && sensor.textureProjection.kind === "THERMAL"
    && (sensor.textureProjection.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId)
    .map((sensor) => ({ sensor, frame: sensorProjectionFrame(sensor, textures, telemetry.now, telemetry.demo) }))
    .filter(({ frame }) => frame)
    .map(({ sensor, frame }) => ({ id: sensor.id,
      identifier: sensor.serialNumber ? `시리얼 번호 ${sensor.serialNumber}` : `식별 번호 ${sensor.serverSensorId || sensor.id}`,
      measuredAt: frame.measuredAt, summary: thermalFrameSummary(frame.temperatureGrid) })),
  [projectionSensors, textures, telemetry.now, telemetry.demo, equipmentId]);
  const thermalFocusIds = JSON.stringify(projectionSensors.filter((sensor) => sensor.textureProjection?.enabled
    && sensor.textureProjection.kind === "THERMAL"
    && (sensor.textureProjection.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId).map((sensor) => sensor.id));
  const availability = Object.fromEntries(["VISION", "THERMAL"].map((kind) => [kind,
    textures.some((item) => item.kind === kind && item.mapping === "UV" && item.equipmentId === equipmentId && item.modelVersion === model.version && mediaUrl(item.url, telemetry.demo) && isFreshMeasurement(item, telemetry.now))
    || (projectionSensors ?? []).some((sensor) => sensor.textureProjection?.enabled && (sensor.textureProjection.kind ?? "VISION") === kind
      && (sensor.textureProjection.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId
      && sensorProjectionFrame(sensor, textures, telemetry.now, telemetry.demo)),
  ]));
  const mode = thermalActive ? "THERMAL" : "MODEL";
  useEffect(() => {
    if (!thermalActive) { thermalFocused.current = false; return; }
    if (thermalFocused.current || thermalFocusIds === "[]") return;
    let attempts = 0, timer;
    const focus = () => {
      if (viewerCamera.current?.focusThermal(JSON.parse(thermalFocusIds), equipmentId)) { thermalFocused.current = true; return; }
      if (++attempts < 12) timer = setTimeout(focus, 300);
    };
    timer = setTimeout(focus, 0);
    return () => clearTimeout(timer);
  }, [thermalActive, thermalFocusIds, equipmentId]);
  function toggleThermal() {
    if (thermalActive) {
      if (panel === "THERMAL") selectPanel(null);
      else setThermalFor(null);
    } else if (selectPanel("THERMAL")) setThermalFor(equipmentId);
  }
  const activeAlarms = telemetry.alarms.filter((alarm) => !alarm.acknowledgedAt);
  const spherePoint = currentDraft && isObservationRoi(currentDraft) ? roiToObservationPoint(currentDraft) : null;
  const currentRadius = spherePoint?.radius ?? radius;
  function resizeRoi(amount) {
    const next = clampRoiRadius(currentRadius + amount);
    if (spherePoint) setDraft((current) => ({ ...current, surface: { ...current.surface, radius: next } }));
    else setRadius(next);
  }

  useEffect(() => {
    if (!currentDraft || !dirty || !shared || telemetry.demo || geometryChanged) return;
    const controller = new AbortController();
    let timer;
    const query = async () => {
      try { const result = await queryPreview(currentDraft, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), equipment); if (!controller.signal.aborted) setPreview({ signature: JSON.stringify(currentDraft), reading: result }); }
      catch (issue) { if (!controller.signal.aborted) { setPreview(null); setError(issue.message); } }
      if (!controller.signal.aborted) timer = setTimeout(query, 3000);
    };
    void query();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentDraft, dirty, shared, queryPreview, telemetry.demo, geometryChanged, equipment]);

  // Apply external tree selection without remounting the Three.js scene.
  if (initialRoi !== previousInitialRoi) {
    setPreviousInitialRoi(initialRoi);
    setDraft(initialRoi);
    setEditing(false);
    setPreview(null); setError(""); setNotice("");
    setDrawingFor(null); setPickingFor(null);
    if (initialRoi) setFocusVersion((value) => value + 1);
  }

  function replaceDraft(next) {
    if (busy) return false;
    if (dirty && !window.confirm("저장하지 않은 ROI 설정을 버리시겠습니까?")) return false;
    setDraft(next); setEditing(false); setPreview(null); setError(""); setNotice(""); setDrawingFor(null);
    return true;
  }
  function cancelEditing() {
    if (busy || (dirty && !window.confirm("저장하지 않은 ROI 설정을 버리시겠습니까?"))) return false;
    setDraft(saved ? structuredClone(saved) : null); setEditing(false);
    setPreview(null); setError(""); setNotice(""); setDrawingFor(null);
    return true;
  }
  async function persist(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (geometryChanged) throw new Error("모델이 변경되었습니다. 현재 표면에 ROI를 다시 지정하세요.");
      const point = isObservationRoi(currentDraft) ? resolveImageObservation(roiToObservationPoint(currentDraft),equipment,sceneProps.sensors ?? []) : null;
      const imageIssue = point && imageObservationIssue(point,equipment,sceneProps.sensors ?? []);
      if (imageIssue) throw new Error(imageIssue);
      const thermalIssue = point && thermalObservationIssue(point, equipment, sceneProps.sensors ?? []);
      if (thermalIssue) throw new Error(thermalIssue);
      const result = await monitoring.save(point ? observationPointToRoi(point) : currentDraft, equipment);
      setDraft(result); setEditing(false); setPreview(null);
      setNotice(monitoring.shared ? "공동 ROI 설정을 저장했습니다." : "이 브라우저에 저장했습니다. 공동 저장·상시 감시는 서버 연결 후 사용할 수 있습니다.");
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`‘${saved.name}’ ROI를 삭제하시겠습니까?`)) return;
    setBusy(true); setError("");
    try { await monitoring.remove(saved); setDraft(null); setEditing(false); setNotice("ROI를 삭제했습니다."); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <section className={styles.workspace} aria-label="설비 ROI 관측">
    <EquipmentObservationScene {...sceneProps} cameraController={viewerCamera} focusEquipmentId={equipmentId} sensors={projectionSensors} observationPoints={displayPoints} pointOptions={sceneProps.pointOptions ?? {
      selectedId: audioOpen ? audioRoiId : currentDraft?.id,
      editing:drawing, placing:drawing, textureKind:creation?.textureKind, placementId:creation?.placementId,
      placementLabel:creation?.textureKind ? `${creation.textureKind === "VISION" ? "비전" : "열화상"} 텍스처 위에 관측 영역을 지정하세요. 원본 카메라가 자동 연결됩니다.` : "모델 표면을 클릭해 관측 영역을 지정하세요.",
      onAdd:(id,localPosition,targetNormal,imageBinding,thermalBinding)=>{
        const point = normalizeObservationPoint({ ...(creation?.pointId ? roiToObservationPoint(currentDraft) : { name:"새 관측 영역" }),
          geometryType:creation?.geometryType, measurements:bindObservationMeasurements(creation?.measurements, { imageBinding, thermalBinding }),
          equipmentId:id, localPosition, targetNormal, imageBinding: imageBinding ?? null, imageAnalysis: null, thermalBinding: thermalBinding ?? null, model });
        setDraft(observationPointToRoi(resolveImageObservation(point,equipment,projectionSensors))); setEditing(true); setError("");
        setNotice("임시 관측 영역입니다. 설정을 확인한 뒤 ROI 저장을 눌러주세요.");
      },
      onPlaced:()=>{ setDrawingFor(null); setCreation(null); },
      onSelect: (id) => { const selected = rois.find((roi) => roi.id === id); if (selected && replaceDraft(structuredClone(selected))) selectPanel("ROI"); },
    }}
      monitoringOptions={{ equipmentId, equipment, model, mode: editorMode ? undefined : drawing && creation?.textureKind === "THERMAL" ? "THERMAL" : mode, continuousVision: !editorMode, opacity, point: audioOpen ? point : null, ...layerData, readings, textures, demo: telemetry.demo, now: telemetry.now, onLayerError: setLayerError }} roiOptions={{ equipmentId, rois: editorMode ? [] : rois, statuses, selectedId: audioOpen ? audioRoiId : currentDraft?.id, drawing:false, radius, pointPicking: picking, focusVersion,
      onPoint: (selection) => { setPointSelection({ ...selection, equipmentId, modelVersion: model.version }); setError(""); },
      onError: setError, onCancel: () => { setDrawingFor(null); setPickingFor(null); },
    }} />
    {!editorMode && <ViewerOverlaySlot name="tools"><MonitoringQuickTools panel={panel} thermalActive={thermalActive} alarmCount={activeAlarms.length} disabled={busy} onPanelChange={selectPanel} onThermalToggle={toggleThermal} /></ViewerOverlaySlot>}
    {dataOpen && <ViewerOverlaySlot name="panel"><aside className={`${styles.panel} ${styles.dataPanel} ${sharedPanelLayout ? styles.viewerPanel : ""}`} data-section={panel} aria-label={{ AUDIO: "소리 듣기", THERMAL: "열화상", ALARMS: "경고 이벤트" }[panel]} data-camera-safe-ui="right"><MonitoringDataPanel section={panel} equipment={equipment} key={`${equipmentId}:${panel}`} projectId={projectId} equipmentId={equipmentId} telemetry={telemetry} opacity={opacity} setOpacity={setOpacity} point={point} picking={picking} setPicking={(active) => { setPickingFor(active ? equipmentId : null); setDrawingFor(null); setError(""); }} layerError={layerError || error} model={model} sensorView={Boolean(sceneProps.sensorViewId)} availability={availability} thermalReadouts={thermalReadouts} rois={compatibleRois.filter((roi) => roi.equipmentId === equipmentId)} onRoiSelect={setAudioRoiId} onClose={() => selectPanel(null)} /></aside></ViewerOverlaySlot>}
    {picking && <InteractionGuide message="소리를 들을 모델 표면을 클릭하세요. Esc로 취소합니다." />}
    {open && <ViewerOverlaySlot name="panel"><aside className={`${styles.panel} ${sharedPanelLayout ? styles.viewerPanel : ""}`} aria-label="ROI 조회 및 설정" data-camera-safe-ui="right">
      <header className={styles.panelHeader}>
        <strong>관측 영역</strong>
        <div className={styles.panelHeaderActions}>
          {!currentDraft && <button type="button" disabled={!equipmentId || busy || Boolean(sceneProps.sensorViewId)} aria-pressed={drawing} onClick={() => {
            if (drawing || creation) { setDrawingFor(null); setCreation(null); return; }
            if (dirty && !window.confirm("저장하지 않은 ROI 설정을 버리고 새 영역을 지정하시겠습니까?")) return;
            setDraft(null); setCreation({}); setNotice(""); setError("");
          }}>{drawing || creation ? "영역 지정 취소" : "새 영역 지정"}</button>}
          {currentDraft && !drawing && <button type="button" disabled={busy} onClick={() => replaceDraft(null)}>목록으로 돌아가기</button>}
          <button type="button" disabled={busy} onClick={() => selectPanel(null)}>닫기</button>
        </div>
      </header>
      {!equipmentId && <p>설비를 선택하면 ROI를 만들 수 있습니다.</p>}
      {editing && spherePoint?.geometryType === "SPHERE" && <div className={styles.radiusControl} role="group" aria-label="ROI 구체 크기">
        <span>반경 <strong>{currentRadius.toFixed(2)} m</strong></span>
        <button type="button" aria-label="ROI 반경 줄이기" disabled={busy || currentRadius <= .01} onClick={() => resizeRoi(-.05)}>−</button>
        <button type="button" aria-label="ROI 반경 늘리기" disabled={busy || currentRadius >= 100} onClick={() => resizeRoi(.05)}>+</button>
      </div>}
      {drawing && <p className={styles.hint}>표면을 클릭하세요. Esc로 취소합니다.</p>}
      {!drawing && !currentDraft && <>
      {creation && equipment && <ObservationCreationFields key={equipmentId} equipment={equipment} sensors={projectionSensors ?? []} onPlace={(configuration)=>{setCreation({ ...configuration, placementId: crypto.randomUUID() });setDrawingFor(equipmentId);}} />}
      <div className={styles.list}>{scoped.map((roi) => <button type="button" key={roi.id} disabled={busy} aria-pressed={currentDraft?.id === roi.id} data-status={statuses[roi.id]} onClick={() => { if (replaceDraft(structuredClone(roi))) setFocusVersion((value) => value + 1); }}>
        <span>{roi.name}</span><small>{ROI_STATUSES[statuses[roi.id]].label}</small>
      </button>)}</div>
      {!scoped.length && !monitoring.loading && <p className={styles.hint}>저장된 ROI가 없습니다.</p>}
      {monitoring.loading && <p role="status">ROI 불러오는 중…</p>}
      {(error || monitoring.error) && <p className={styles.error} role="alert">{error || monitoring.error}</p>}
      {monitoring.error && <button type="button" onClick={monitoring.refresh}>목록 새로고침</button>}
      </>}
      {(error || monitoring.error) && currentDraft && <p className={styles.error} role="alert">{error || monitoring.error}</p>}
      {notice && <p role="status" className={styles.hint}>{notice}</p>}
      {currentDraft && !editing && <RoiDashboard roi={currentDraft} sensors={sceneProps.sensors} readings={readings} now={telemetry.now} connection={telemetry.status} demo={telemetry.demo} geometryChanged={geometryChanged}
        onEdit={() => { setDraft(structuredClone(currentDraft)); setEditing(true); setNotice(""); setError(""); }} />}
      {currentDraft && editing && <form onSubmit={persist} className={styles.form} aria-label="관측 영역 설정">
        {geometryChanged && <p role="alert" className={styles.error}>모델이 변경되었습니다. 현재 표면에 ROI를 다시 지정하세요.</p>}
        <div className={styles.draftHeading}><strong>{saved ? `${currentDraft.name} 설정` : "새 관측 영역 설정"}</strong><button type="button" disabled={busy} onClick={cancelEditing}>취소</button></div>
        {spherePoint ? <>
          <ObservationReadout point={spherePoint} sensors={sceneProps.sensors} readings={dirty || geometryChanged ? [] : readings} now={telemetry.now} />
          <fieldset disabled={busy || drawing} className={styles.fields}><ObservationRoiFields equipment={equipment} compact allowPositionEdit selectedPoint={spherePoint} sensors={(sceneProps.sensors ?? []).filter((sensor) => sensor.equipmentIds?.includes(equipmentId))}
            onPlace={(configuration) => { setCreation({ ...configuration, placementId: crypto.randomUUID() }); setDrawingFor(equipmentId); }}
            onChange={(_id, changes) => setDraft((current) => observationPointToRoi(resolveImageObservation({ ...roiToObservationPoint(current), ...changes },equipment,sceneProps.sensors ?? [])))} /></fieldset>
        </> : <>
        <dl className={styles.readings}>{ROI_METRICS.filter((metric) => currentDraft.displayMetrics.includes(metric.id)).map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{reading.values[metric.id] === null ? "—" : `${reading.values[metric.id].toFixed(1)} ${metric.unit}`}</dd></div>)}</dl>
        <small className={styles.hint}>{reading.measuredAt ? `측정 ${new Date(reading.measuredAt).toLocaleTimeString("ko-KR")}` : "이 영역에 대응하는 센서 데이터를 기다리고 있습니다."}</small>
        <fieldset disabled={busy} className={styles.fields}><RoiFields draft={currentDraft} setDraft={setDraft} /></fieldset>
        </>}
        <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "저장 중…" : "ROI 저장"}</button>
          {saved && <button type="button" disabled={busy} onClick={remove}>ROI 삭제</button>}</div>
      </form>}
      {drawing && error && <p role="alert" className={styles.error}>{error}</p>}
    </aside></ViewerOverlaySlot>}
  </section>;
}
