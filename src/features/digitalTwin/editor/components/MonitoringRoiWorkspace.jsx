import { useEffect, useMemo, useState } from "react";
import EquipmentObservationScene from "../three/EquipmentObservationScene";
import useRoiMonitoring from "../store/useRoiMonitoring";
import { createSurfaceRoi, getRoiReading, ROI_METRICS, ROI_STATUSES } from "../model/roiMonitoring.js";
import { readProjects } from "@/features/portal/projects/projectRepository";
import styles from "./MonitoringRoiWorkspace.module.css";
import MonitoringDataPanel from "./MonitoringDataPanel";
import useEquipmentTelemetry from "../store/useEquipmentTelemetry";
import { demoFrame, demoReading } from "../model/monitoringDemo";
import { modelReference } from "../model/monitoringContract";

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

export default function MonitoringRoiWorkspace({ projectId: providedId, onRoiPanelOpen, initialRoi = null, ...sceneProps }) {
  const [projectId] = useState(() => providedId || readProjects().activeId);
  const monitoring = useRoiMonitoring(projectId);
  const { preview: queryPreview, shared } = monitoring;
  const equipmentId = sceneProps.focusEquipmentId ?? sceneProps.equipment?.id;
  const equipment = sceneProps.equipment ?? sceneProps.equipmentList?.find((item) => item.id === equipmentId);
  const model = useMemo(() => modelReference(equipment, sceneProps.assetBindings), [equipment, sceneProps.assetBindings]);
  const compatibleRois = useMemo(() => monitoring.rois.filter((roi) => roi.equipmentId !== equipmentId || !roi.surface?.model?.version || roi.surface.model.version === model.version), [monitoring.rois, equipmentId, model.version]);
  const telemetry = useEquipmentTelemetry(projectId, equipmentId, compatibleRois);
  const [dataOpen, setDataOpen] = useState(false);
  const [mode, setMode] = useState("MODEL");
  const [opacity, setOpacity] = useState(.7);
  const [pointSelection, setPointSelection] = useState(null);
  const [pickingFor, setPickingFor] = useState(null);
  const [fps, setFps] = useState(null);
  const [layerError, setLayerError] = useState("");
  const point = pointSelection?.equipmentId === equipmentId && pointSelection.modelVersion === model.version ? pointSelection : null;
  const picking = pickingFor === equipmentId && Boolean(equipmentId) && !sceneProps.sensorViewId;
  const [open, setOpen] = useState(Boolean(initialRoi));
  const [draft, setDraft] = useState(initialRoi);
  const [drawingFor, setDrawingFor] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [focusVersion, setFocusVersion] = useState(initialRoi ? 1 : 0);
  const currentDraft = draft?.equipmentId === equipmentId ? draft : null;
  const drawing = Boolean(equipmentId && drawingFor === equipmentId);
  const scoped = monitoring.rois.filter((roi) => roi.equipmentId === equipmentId);
  const saved = currentDraft ? monitoring.rois.find((roi) => roi.id === currentDraft.id) : null;
  const dirty = currentDraft && JSON.stringify(currentDraft) !== JSON.stringify(saved);
  const geometryChanged = Boolean(currentDraft?.surface?.model?.version && currentDraft.surface.model.version !== model.version);
  const rois = useMemo(() => currentDraft && !geometryChanged ? [...compatibleRois.filter((roi) => roi.id !== currentDraft.id), currentDraft] : compatibleRois, [compatibleRois, currentDraft, geometryChanged]);
  const readings = telemetry.status === "DISCONNECTED" ? monitoring.readings : telemetry.readings;
  const statuses = useMemo(() => Object.fromEntries(monitoring.rois.map((roi) => [roi.id, getRoiReading(roi, compatibleRois.includes(roi) ? readings.find((reading) => reading.roiId === roi.id) : null, telemetry.now).status])), [monitoring.rois, compatibleRois, readings, telemetry.now]);
  const previewReading = preview?.signature === JSON.stringify(currentDraft) ? preview.reading : null;
  const reading = currentDraft ? getRoiReading(currentDraft, geometryChanged ? null : saved && !dirty ? readings.find((item) => item.roiId === currentDraft.id) : telemetry.demo ? { ...demoReading(currentDraft, telemetry.now), status: null } : previewReading, telemetry.now) : null;
  const demoFrameTime = Math.floor(telemetry.now / 5000) * 5000;
  const layerData = useMemo(() => {
    if (!telemetry.demo || !equipment) return { textures: telemetry.textures, hotspots: telemetry.hotspots };
    const bases = ["PROXY", "ACTUAL"].map((representation) => ({ equipmentId, modelVersion: model.version, representation, measuredAt: new Date(demoFrameTime).toISOString(), quality: "GOOD", staleAfterMs: 15000 }));
    return { textures: bases.flatMap((base) => ["VISION", "THERMAL"].map((kind) => ({ ...base, kind, mapping: "UV", url: demoFrame(kind) }))),
      hotspots: bases.map((base) => ({ ...base, position: [0, (equipment.dimensions?.height ?? 1) * .55, (equipment.dimensions?.depth ?? 1) * .5], db: 65.4, radius: .08 })) };
  }, [telemetry.demo, telemetry.textures, telemetry.hotspots, equipment, equipmentId, model.version, demoFrameTime]);
  const activeAlarms = telemetry.alarms.filter((alarm) => !alarm.acknowledgedAt);

  useEffect(() => {
    if (!currentDraft || !dirty || !shared || telemetry.demo || geometryChanged) return;
    const controller = new AbortController();
    let timer;
    const query = async () => {
      try { const result = await queryPreview(currentDraft, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])); if (!controller.signal.aborted) setPreview({ signature: JSON.stringify(currentDraft), reading: result }); }
      catch (issue) { if (!controller.signal.aborted) { setPreview(null); setError(issue.message); } }
      if (!controller.signal.aborted) timer = setTimeout(query, 3000);
    };
    void query();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentDraft, dirty, shared, queryPreview, telemetry.demo, geometryChanged]);

  function replaceDraft(next) {
    if (dirty && !window.confirm("저장하지 않은 ROI 설정을 버리시겠습니까?")) return false;
    setDraft(next); setPreview(null); setError(""); setNotice(""); setDrawingFor(null);
    return true;
  }
  async function persist(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (geometryChanged) throw new Error("모델이 변경되었습니다. 현재 표면에 ROI를 다시 지정하세요.");
      const result = await monitoring.save(currentDraft);
      setDraft(result); setPreview(null);
      setNotice(monitoring.shared ? "공동 ROI 설정을 저장했습니다." : "이 브라우저에 저장했습니다. 공동 저장·상시 감시는 서버 연결 후 사용할 수 있습니다.");
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`‘${saved.name}’ ROI를 삭제하시겠습니까?`)) return;
    setBusy(true); setError("");
    try { await monitoring.remove(saved); setDraft(null); setNotice("ROI를 삭제했습니다."); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <section className={styles.workspace} aria-label="설비 ROI 관측">
    <EquipmentObservationScene {...sceneProps} monitoringOptions={{ equipmentId, model, mode, opacity, point, ...layerData, demo: telemetry.demo, now: telemetry.now, onFps: setFps, onLayerError: setLayerError }} roiOptions={{ equipmentId, rois, statuses, selectedId: currentDraft?.id, drawing, pointPicking: picking, focusVersion,
      onPoint: (selection) => { setPointSelection({ ...selection, equipmentId, modelVersion: model.version }); setPickingFor(null); },
      onCreate: (surface) => { setDraft(createSurfaceRoi(equipmentId, { ...surface, model })); setDrawingFor(null); setPreview(null); setError(""); setNotice("임시 ROI입니다. 저장하지 않으면 화면을 나갈 때 사라집니다."); },
      onError: setError, onCancel: () => { setDrawingFor(null); setPickingFor(null); },
    }} />
    <button type="button" className={styles.dataToggle} aria-expanded={dataOpen} onClick={() => { setDataOpen(!dataOpen); setOpen(false); setDrawingFor(null); setPickingFor(null); if (!dataOpen) onRoiPanelOpen?.(); }}>관측 데이터{telemetry.demo ? " · 예시" : ""}</button>
    {activeAlarms.length > 0 && <button type="button" className={styles.alarmBadge} role="status" onClick={() => { setDataOpen(true); setOpen(false); }}>경고 {activeAlarms.length}건{telemetry.demo ? " · 예시" : ""}</button>}
    {dataOpen && <aside className={`${styles.panel} ${styles.dataPanel} ${picking ? styles.pickingPanel : ""}`} aria-label="관측 데이터 및 음원" data-camera-safe-ui="left"><MonitoringDataPanel key={equipmentId ?? "none"} projectId={projectId} equipmentId={equipmentId} telemetry={telemetry} mode={mode} setMode={setMode} opacity={opacity} setOpacity={setOpacity} point={point} picking={picking} setPicking={(active) => { setPickingFor(active ? equipmentId : null); setDrawingFor(null); }} fps={fps} layerError={layerError || (picking ? error : "")} model={model} sensorView={Boolean(sceneProps.sensorViewId)} /></aside>}
    <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => { setOpen(!open); setDataOpen(false); setPickingFor(null); if (!open) onRoiPanelOpen?.(); else setDrawingFor(null); }}>ROI {open ? "접기" : "조회·설정"}</button>
    {open && <aside className={`${styles.panel} ${drawing ? styles.drawingPanel : ""}`} aria-label="ROI 조회 및 설정" data-camera-safe-ui="right">
      <header><strong>표면 ROI</strong><span>{telemetry.demo ? "예시 측정값 · 실측 아님" : monitoring.shared ? "공동 설정" : "브라우저 저장"}</span></header>
      <p className={styles.hint}>{monitoring.shared ? "저장한 ROI와 임계치는 같은 프로젝트에서 함께 사용합니다." : "서버 연결 전입니다. 실측값·공동 저장·상시 알림은 제공되지 않습니다."}</p>
      {!equipmentId && <p>설비를 선택하면 ROI를 만들 수 있습니다.</p>}
      <button type="button" disabled={!equipmentId || busy || Boolean(sceneProps.sensorViewId)} aria-pressed={drawing} onClick={() => {
        if (drawing) { setDrawingFor(null); return; }
        if (dirty && !window.confirm("저장하지 않은 ROI 설정을 버리고 새 영역을 지정하시겠습니까?")) return;
        setDraft(null); setDrawingFor(equipmentId); setNotice(""); setError("");
      }}>{drawing ? "영역 지정 취소" : "새 영역 지정"}</button>
      {drawing && <p role="status" className={styles.hint}>설비 표면을 드래그하거나, 사각형의 두 모서리를 차례로 클릭하세요. Esc로 취소합니다.</p>}
      {!drawing && <>
      <div className={styles.list}>{scoped.map((roi) => <button type="button" key={roi.id} disabled={busy} aria-pressed={currentDraft?.id === roi.id} data-status={statuses[roi.id]} onClick={() => { if (replaceDraft(structuredClone(roi))) setFocusVersion((value) => value + 1); }}>
        <span>{roi.name}</span><small>{ROI_STATUSES[statuses[roi.id]].label}</small>
      </button>)}</div>
      {!scoped.length && !monitoring.loading && <p className={styles.hint}>저장된 ROI가 없습니다.</p>}
      {monitoring.loading && <p role="status">ROI 불러오는 중…</p>}
      {(error || monitoring.error) && <p className={styles.error} role="alert">{error || monitoring.error}</p>}
      {monitoring.error && <button type="button" onClick={monitoring.refresh}>목록 새로고침</button>}
      {notice && <p role="status" className={styles.hint}>{notice}</p>}
      {currentDraft && <form onSubmit={persist} className={styles.form}>
        {geometryChanged && <p role="alert" className={styles.error}>모델이 변경되었습니다. 현재 표면에 ROI를 다시 지정하세요.</p>}
        <div className={styles.draftHeading}><strong>{saved ? "저장된 ROI" : "임시 조회"}</strong><span data-status={reading.status}>{telemetry.demo && dirty && currentDraft.monitoringEnabled && !geometryChanged ? "저장 후 판정" : ROI_STATUSES[reading.status].label}</span></div>
        <dl className={styles.readings}>{ROI_METRICS.filter((metric) => currentDraft.displayMetrics.includes(metric.id)).map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{reading.values[metric.id] === null ? "—" : `${reading.values[metric.id].toFixed(1)} ${metric.unit}`}</dd></div>)}</dl>
        <small className={styles.hint}>{reading.measuredAt ? `측정 ${new Date(reading.measuredAt).toLocaleTimeString("ko-KR")}` : "이 영역에 대응하는 센서 데이터를 기다리고 있습니다."}</small>
        <fieldset disabled={busy} className={styles.fields}><RoiFields draft={currentDraft} setDraft={setDraft} /></fieldset>
        <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "저장 중…" : "ROI 저장"}</button><button type="button" disabled={busy} onClick={() => replaceDraft(null)}>{saved ? "닫기" : "임시 조회 끝내기"}</button>
          {saved && <button type="button" disabled={busy} onClick={remove}>ROI 삭제</button>}</div>
      </form>}
      </>}
      {drawing && error && <p role="alert" className={styles.error}>{error}</p>}
    </aside>}
  </section>;
}
