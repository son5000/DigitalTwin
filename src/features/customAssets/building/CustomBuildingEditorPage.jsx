import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import FloatingPanel from "@/features/digitalTwin/editor/components/FloatingPanel";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { MATERIAL_PRESET_MAP, WALL_MATERIAL_PRESET_IDS } from "@/features/digitalTwin/editor/constants/materialPresets";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import { DEFAULT_TRANSFORM_TOOLS } from "@/features/digitalTwin/editor/three/dualTransformControls";
import { getCustomBuildingEditPath, navigateTo } from "../core/customAssetNavigation";
import { customBuildingTemplateId, CUSTOM_ASSET_STATUS } from "../core/customAssetTypes";
import { validateCustomAsset } from "../core/customAssetValidation";
import { useCustomAssets } from "../components/customAssetContext";
import AssemblyPlanEditor2D from "./AssemblyPlanEditor2D";
import {
  BUILDING_ENTITY_TYPES,
  BUILDING_VIEW_MODES,
  CONNECTOR_TYPES,
  createBuildingConnectorEntity,
  createBuildingMassEntity,
  createCircleFootprint,
  createUniformLevels,
} from "./buildingAssembly";
import { createComplexTowerCustomBuilding, createDefaultCustomBuilding } from "./buildingDefaults";
import { footprintArea, PYEONG_IN_SQUARE_METERS, recalculateBuildingAsset } from "./buildingMetrics";
import { createBuildingThumbnail } from "./buildingThumbnail";
import { BUILDING_FOOTPRINT_TEMPLATES, createBuildingFootprint, resizeBuildingFootprint } from "./buildingTemplates";
import "./buildingValidator";
import CustomBuildingPreview from "./CustomBuildingPreview";
import FootprintEditor2D from "./FootprintEditor2D";
import styles from "./CustomBuildingEditor.module.css";

const EDITOR_WORKSPACES = Object.freeze({ BASIC: "BASIC", ADVANCED: "ADVANCED", OBSERVE: "OBSERVE" });
const CONNECTOR_LABELS = Object.freeze({ corridor: "복도", bridge: "개방형 브리지", "glass-bridge": "유리 연결 통로", skybridge: "스카이브리지", "shared-floor": "공용 연결층", atrium: "아트리움" });
const PANEL_TITLES = Object.freeze({
  [WORLD_PANEL_IDS.OBJECTS]: "형상 도구",
  [WORLD_PANEL_IDS.OBJECT_LIST]: "물리 요소",
  [WORLD_PANEL_IDS.SETTINGS]: "건축물 설정",
  [WORLD_PANEL_IDS.DETAILS]: "선택 요소 설정",
});

function footprintDimensions(footprint) {
  const xs = footprint.points.map((item) => item.x); const zs = footprint.points.map((item) => item.z);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
}

function scaleFootprint(footprint, scale) {
  const transform = (point) => ({ x: point.x * scale, z: point.z * scale });
  return { ...footprint, templateId: "FREE_POLYGON", points: footprint.points.map(transform), holes: (footprint.holes ?? []).map((hole) => hole.map(transform)) };
}

function addFootprintVertex(footprint) {
  let longestIndex = 0; let longest = 0;
  footprint.points.forEach((point, index) => {
    const next = footprint.points[(index + 1) % footprint.points.length];
    const length = Math.hypot(next.x - point.x, next.z - point.z);
    if (length > longest) { longest = length; longestIndex = index; }
  });
  const next = footprint.points[(longestIndex + 1) % footprint.points.length];
  const points = [...footprint.points];
  points.splice(longestIndex + 1, 0, { x: (points[longestIndex].x + next.x) / 2, z: (points[longestIndex].z + next.z) / 2 });
  return { ...footprint, templateId: "FREE_POLYGON", points };
}

function centerFootprint(footprint) {
  const centerX = (Math.min(...footprint.points.map((item) => item.x)) + Math.max(...footprint.points.map((item) => item.x))) / 2;
  const centerZ = (Math.min(...footprint.points.map((item) => item.z)) + Math.max(...footprint.points.map((item) => item.z))) / 2;
  const move = (item) => ({ x: item.x - centerX, z: item.z - centerZ });
  return { ...footprint, templateId: "FREE_POLYGON", points: footprint.points.map(move), holes: (footprint.holes ?? []).map((hole) => hole.map(move)) };
}

function createCenteredHole(footprint) {
  const { width, depth } = footprintDimensions(footprint);
  return { ...footprint, holes: [createBuildingFootprint("RECTANGLE", width * 0.3, depth * 0.3).points.reverse()] };
}

function NumericInput({ label, value, min, max, step = 0.1, onChange, disabled = false }) {
  return <label className={styles.field}><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Check({ label, checked, onChange, disabled = false }) {
  return <label className={styles.checkField}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

export default function CustomBuildingEditorPage({ assetId = null }) {
  const { save, repository } = useCustomAssets();
  const { theme, toggleTheme } = useEditorTheme();
  const [asset, setAsset] = useState(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(0);
  const [view, setView] = useState("3D");
  const [workspace, setWorkspace] = useState(EDITOR_WORKSPACES.BASIC);
  const [footprintDetail, setFootprintDetail] = useState(false);
  const [areaUnit, setAreaUnit] = useState("M2");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState(0.5);
  const [transformTools, setTransformTools] = useState(DEFAULT_TRANSFORM_TOOLS);
  const [activePanelId, setActivePanelId] = useState(WORLD_PANEL_IDS.OBJECTS);
  const [saveState, setSaveState] = useState("편집 중");
  const [saveError, setSaveError] = useState("");
  const [conflictWarning, setConflictWarning] = useState("");
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [activeViewGroupId, setActiveViewGroupId] = useState(null);
  const [viewMode, setViewMode] = useState(BUILDING_VIEW_MODES.ALL);
  const [explode, setExplode] = useState(false);
  const [heightCut, setHeightCut] = useState({ min: null, max: null });
  const [cameraFocusKey, setCameraFocusKey] = useState(0);
  const [autoLevels, setAutoLevels] = useState({ count: 10, height: 3.6 });
  const [connectorDraft, setConnectorDraft] = useState({ fromId: "", toId: "", levelId: "", type: "glass-bridge", pathType: "straight", width: 3.2, height: 3 });
  const assetRef = useRef(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const dirtyRef = useRef(false);
  const sessionIdRef = useRef(crypto.randomUUID());

  const selectedEntity = asset?.entities.find((entity) => entity.id === selectedEntityIds[0]) ?? null;
  const selectedMass = selectedEntity?.entityType === BUILDING_ENTITY_TYPES.MASS ? selectedEntity : null;
  const selectedConnector = selectedEntity?.entityType === BUILDING_ENTITY_TYPES.CONNECTOR ? selectedEntity : null;
  const masses = asset?.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS) ?? [];
  const connectors = asset?.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR) ?? [];
  const validationIssues = useMemo(() => asset ? validateCustomAsset(asset) : [], [asset]);
  const blockingErrors = validationIssues.filter((item) => item.severity !== "warning");

  useEffect(() => { assetRef.current = asset; }, [asset]);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = assetId ? await repository.get(assetId) : null;
      const draft = assetId ? repository.loadDraft(assetId) : null;
      const source = draft && (!stored || String(draft.updatedAt) > String(stored.updatedAt)) ? draft : stored;
      const initial = recalculateBuildingAsset(source ?? createDefaultCustomBuilding());
      if (!active) return;
      setAsset(initial);
      setSelectedEntityIds(initial.entities[0] ? [initial.entities[0].id] : []);
      setActiveViewGroupId(initial.defaultViewGroupId);
      setAutoLevels({ count: initial.levels.length, height: initial.levels[0]?.height ?? 3.6 });
      setSaveState(source ? "로컬 초안 복구" : "새 초안");
      repository.saveDraft(initial);
      if (!assetId) window.history.replaceState({}, "", getCustomBuildingEditPath(initial.id));
    })();
    return () => { active = false; };
  }, [assetId, repository]);

  const currentAssetId = asset?.id ?? null;
  useEffect(() => {
    if (!currentAssetId) return undefined;
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`custom-asset-edit:${currentAssetId}`) : null;
    const sessionId = sessionIdRef.current;
    const onMessage = (event) => {
      if (event.data?.assetId !== currentAssetId || event.data.sessionId === sessionId) return;
      setConflictWarning("다른 탭에서도 이 건축물을 편집 중입니다. 마지막 저장 내용이 우선될 수 있습니다.");
      if (event.data.action === "editing") channel?.postMessage({ action: "present", assetId: currentAssetId, sessionId });
    };
    channel?.addEventListener("message", onMessage);
    channel?.postMessage({ action: "editing", assetId: currentAssetId, sessionId });
    return () => channel?.close();
  }, [currentAssetId]);

  useEffect(() => {
    if (!asset || !dirtyRef.current) return undefined;
    const timer = window.setTimeout(async () => {
      setSaveState("로컬에 저장 중…"); repository.saveDraft(asset);
      try { await save(asset); dirtyRef.current = false; setSaveState("로컬 저장 완료"); setSaveError(""); }
      catch (cause) { setSaveState("저장 실패"); setSaveError(cause instanceof Error ? cause.message : "초안을 저장하지 못했습니다."); }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [asset, repository, save]);

  useEffect(() => {
    const beforeUnload = (event) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  const restoreHistory = useCallback((redo = false) => {
    const current = assetRef.current;
    const source = redo ? futureRef : pastRef;
    const target = source.current.at(-1);
    if (!current || !target) return;
    if (redo) { pastRef.current = [...pastRef.current, structuredClone(current)].slice(-80); futureRef.current = futureRef.current.slice(0, -1); }
    else { futureRef.current = [...futureRef.current, structuredClone(current)].slice(-80); pastRef.current = pastRef.current.slice(0, -1); }
    dirtyRef.current = true; setAsset(target);
    setSelectedEntityIds(target.entities[0] ? [target.entities[0].id] : []);
    setHistoryState({ canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLocaleLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key !== "z" && key !== "y") return;
        event.preventDefault(); restoreHistory(key === "y" || (key === "z" && event.shiftKey));
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable) return;
      if (key !== "w" && key !== "e") return;
      event.preventDefault();
      setTransformTools((current) => ({ ...current, [key === "w" ? "translate" : "rotate"]: true }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [restoreHistory]);

  function commit(updater, { history = true } = {}) {
    const current = assetRef.current;
    if (!current) return;
    const rawNext = typeof updater === "function" ? updater(structuredClone(current)) : updater;
    const next = recalculateBuildingAsset({ ...rawNext, updatedAt: new Date().toISOString() });
    if (history) { pastRef.current = [...pastRef.current, structuredClone(current)].slice(-80); futureRef.current = []; }
    dirtyRef.current = true; setAsset(next); setSaveState("편집 중");
    setHistoryState({ canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 });
  }

  function updateEntity(entityId, updater) {
    commit((current) => ({ ...current, entities: current.entities.map((entity) => entity.id === entityId ? updater(entity) : entity) }));
  }

  function selectEntity(entityId, toggle = false) {
    setSelectedEntityIds((current) => toggle ? (current.includes(entityId) ? current.filter((id) => id !== entityId) : [...current, entityId]) : [entityId]);
    setSelectedVertexIndex(0);
    if (!toggle) setActivePanelId(WORLD_PANEL_IDS.DETAILS);
  }

  function toggleTransformTool(tool) {
    setTransformTools((current) => ({ ...current, [tool]: !current[tool] }));
  }

  function transformEntity(entityId, changes) {
    updateEntity(entityId, (entity) => ({
      ...entity,
      transform: {
        ...entity.transform,
        position: { ...entity.transform.position, ...changes.position },
        rotationY: changes.rotationY,
      },
    }));
  }

  function addMass(templateId = "RECTANGLE") {
    const footprint = templateId === "CIRCLE" ? createCircleFootprint() : createBuildingFootprint(templateId, 20, 14);
    const topElevation = asset.levels.at(-1)?.topElevation ?? 18;
    const mass = createBuildingMassEntity({ name: `매스 ${masses.length + 1}`, footprint, topElevation, position: { x: masses.length * 3, y: 0, z: masses.length * 3 } });
    commit((current) => ({ ...current, entities: [...current.entities, mass] }));
    setSelectedEntityIds([mass.id]); setWorkspace(EDITOR_WORKSPACES.ADVANCED);
    setActivePanelId(WORLD_PANEL_IDS.DETAILS);
  }

  function applyTemplate(templateId) {
    if (!selectedMass) return addMass(templateId);
    const dimensions = footprintDimensions(selectedMass.footprint);
    updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: createBuildingFootprint(templateId, dimensions.width, dimensions.depth) }));
  }

  function applyComplexSample() {
    const sample = createComplexTowerCustomBuilding();
    commit((current) => ({ ...sample, id: current.id, createdAt: current.createdAt, revision: current.revision, status: current.status }));
    setSelectedEntityIds([sample.entities[0].id]); setActiveViewGroupId(sample.defaultViewGroupId); setWorkspace(EDITOR_WORKSPACES.ADVANCED);
    setCameraFocusKey((key) => key + 1);
  }

  function resetBuilding() {
    const fresh = createDefaultCustomBuilding();
    commit((current) => ({
      ...fresh,
      id: current.id,
      name: current.name,
      createdAt: current.createdAt,
      revision: current.revision,
      status: current.status,
    }));
    setSelectedEntityIds([fresh.entities[0].id]);
    setActiveViewGroupId(fresh.defaultViewGroupId);
    setWorkspace(EDITOR_WORKSPACES.BASIC);
    setViewMode(BUILDING_VIEW_MODES.ALL);
    setExplode(false);
    setHeightCut({ min: null, max: null });
    setActivePanelId(WORLD_PANEL_IDS.OBJECTS);
    setCameraFocusKey((key) => key + 1);
  }

  function duplicateSelected() {
    const selected = asset.entities.filter((entity) => selectedEntityIds.includes(entity.id) && entity.entityType === BUILDING_ENTITY_TYPES.MASS);
    if (!selected.length) return;
    const copies = selected.map((entity) => ({ ...structuredClone(entity), id: `mass-${crypto.randomUUID()}`, name: `${entity.name} 복제`, transform: { ...entity.transform, position: { ...entity.transform.position, x: entity.transform.position.x + 2, z: entity.transform.position.z + 2 } }, viewGroupIds: [] }));
    commit((current) => ({ ...current, entities: [...current.entities, ...copies] }));
    setSelectedEntityIds(copies.map((entity) => entity.id));
  }

  function deleteSelected() {
    if (!selectedEntityIds.length || asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS && !selectedEntityIds.includes(entity.id)).length < 1) return;
    const deleted = new Set(selectedEntityIds);
    commit((current) => ({
      ...current,
      entities: current.entities.filter((entity) => !deleted.has(entity.id) && ![entity.from?.entityId, entity.to?.entityId].some((id) => deleted.has(id))),
      viewGroups: current.viewGroups.map((group) => ({ ...group, entityIds: group.entityIds.filter((id) => !deleted.has(id)) })),
      relations: current.relations.filter((relation) => !deleted.has(relation.sourceEntityId) && !deleted.has(relation.targetEntityId)),
    }));
    setSelectedEntityIds([]);
  }

  function regenerateLevels() {
    const oldTop = asset.levels.at(-1)?.topElevation ?? 0;
    const levels = createUniformLevels(autoLevels.count, autoLevels.height);
    const newTop = levels.at(-1).topElevation;
    commit((current) => ({ ...current, levels, entities: current.entities.map((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS && Math.abs(entity.verticalRange.topElevation - oldTop) < 0.01 ? { ...entity, verticalRange: { ...entity.verticalRange, topElevation: newTop } } : entity) }));
  }

  function updateLevel(levelId, changes) { commit((current) => ({ ...current, levels: current.levels.map((level) => level.id === levelId ? { ...level, ...changes } : level) })); }
  function addLevel() {
    const previous = asset.levels.at(-1); const height = previous?.height ?? 3.6;
    const level = { id: `level-${crypto.randomUUID()}`, name: `${asset.levels.length + 1}층`, floorNumber: asset.levels.length + 1, baseElevation: previous?.topElevation ?? 0, topElevation: (previous?.topElevation ?? 0) + height, height, order: asset.levels.length };
    commit((current) => ({ ...current, levels: [...current.levels, level] }));
  }
  function splitLevel(levelId) {
    const level = asset.levels.find((item) => item.id === levelId); if (!level || level.height < 1) return;
    const middle = (level.baseElevation + level.topElevation) / 2;
    const upper = { ...level, id: `level-${crypto.randomUUID()}`, name: `${level.name} 상부`, baseElevation: middle, height: level.topElevation - middle, floorNumber: undefined };
    commit((current) => ({ ...current, levels: current.levels.flatMap((item) => item.id === levelId ? [{ ...item, name: `${item.name} 하부`, topElevation: middle, height: middle - item.baseElevation }, upper] : item) }));
  }
  function mergeLevel(levelId) {
    const index = asset.levels.findIndex((item) => item.id === levelId); if (index < 0 || index >= asset.levels.length - 1) return;
    const next = asset.levels[index + 1];
    commit((current) => ({ ...current, levels: current.levels.filter((item) => item.id !== next.id).map((item) => item.id === levelId ? { ...item, name: `${item.name} · ${next.name}`, topElevation: next.topElevation, height: next.topElevation - item.baseElevation } : item) }));
  }

  function addConnector() {
    const level = asset.levels.find((item) => item.id === connectorDraft.levelId) ?? asset.levels[0];
    if (!connectorDraft.fromId || !connectorDraft.toId || connectorDraft.fromId === connectorDraft.toId || !level) return;
    const connector = createBuildingConnectorEntity({ name: `${level.name} ${CONNECTOR_LABELS[connectorDraft.type]}`, fromEntityId: connectorDraft.fromId, toEntityId: connectorDraft.toId, levelId: level.id, connectorType: connectorDraft.type, pathType: connectorDraft.pathType, width: connectorDraft.width, height: Math.min(connectorDraft.height, level.height - 0.2), baseElevation: level.baseElevation + 0.1, topElevation: Math.min(level.topElevation - 0.1, level.baseElevation + connectorDraft.height + 0.1) });
    commit((current) => ({ ...current, entities: [...current.entities, connector], relations: [...current.relations, { id: `relation-${crypto.randomUUID()}`, type: "connects", sourceEntityId: connector.id, targetEntityId: connectorDraft.fromId, metadata: { role: "from" } }, { id: `relation-${crypto.randomUUID()}`, type: "connects", sourceEntityId: connector.id, targetEntityId: connectorDraft.toId, metadata: { role: "to" } }] }));
    setSelectedEntityIds([connector.id]);
    setActivePanelId(WORLD_PANEL_IDS.DETAILS);
  }

  function updateConnectorLevel(connector, levelId) {
    const level = asset.levels.find((item) => item.id === levelId); if (!level) return;
    updateEntity(connector.id, (item) => ({ ...item, levelIds: [level.id], from: { ...item.from, levelId }, to: { ...item.to, levelId }, height: Math.min(item.height, level.height - 0.2), verticalRange: { baseElevation: level.baseElevation + 0.1, topElevation: Math.min(level.topElevation - 0.1, level.baseElevation + item.height + 0.1) } }));
  }

  function createViewGroup() {
    if (!selectedEntityIds.length) return;
    const group = { id: `group-${crypto.randomUUID()}`, name: `사용자 그룹 ${asset.viewGroups.filter((item) => item.type === "custom").length + 1}`, type: "custom", entityIds: [...selectedEntityIds], levelIds: [], displayMode: { selected: "normal", others: "ghost" } };
    commit((current) => ({ ...current, viewGroups: [...current.viewGroups, group] })); setActiveViewGroupId(group.id);
  }
  function toggleGroupMembership(groupId, entityId, checked) {
    commit((current) => ({ ...current, viewGroups: current.viewGroups.map((group) => group.id === groupId ? { ...group, entityIds: checked ? [...new Set([...group.entityIds, entityId])] : group.entityIds.filter((id) => id !== entityId) } : group) }));
  }
  function deleteViewGroup(groupId) {
    const group = asset.viewGroups.find((item) => item.id === groupId); if (!group || group.type === "whole") return;
    commit((current) => ({ ...current, viewGroups: current.viewGroups.filter((item) => item.id !== groupId), defaultViewGroupId: current.defaultViewGroupId === groupId ? current.viewGroups.find((item) => item.type === "whole")?.id : current.defaultViewGroupId }));
    setActiveViewGroupId(asset.viewGroups.find((item) => item.type === "whole")?.id ?? null);
  }

  async function persist({ useInPlan = false } = {}) {
    const current = recalculateBuildingAsset(assetRef.current);
    const issues = validateCustomAsset(current); const errors = issues.filter((item) => item.severity !== "warning");
    if (errors.length) { setSaveError(errors[0].message); setSaveState("유효성 검사 오류"); return; }
    setSaveState("로컬에 저장 중…");
    const ready = { ...current, status: CUSTOM_ASSET_STATUS.READY, revision: current.status === CUSTOM_ASSET_STATUS.READY ? Math.max(1, current.revision ?? 1) + 1 : Math.max(1, current.revision ?? 1), updatedAt: new Date().toISOString() };
    ready.thumbnail = createBuildingThumbnail(ready, theme);
    try {
      await save(ready); repository.saveDraft(ready); dirtyRef.current = false; setAsset(ready); setSaveState("도면에서 사용 가능"); setSaveError("");
      if (useInPlan) { sessionStorage.setItem("digital-twin:pending-custom-template", customBuildingTemplateId(ready.id)); navigateTo("/"); }
    } catch (cause) { setSaveState("저장 실패"); setSaveError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
  }

  if (!asset) return <main className={styles.loading}>커스텀 건축물 편집기를 준비하는 중…</main>;
  const dimensions = selectedMass ? footprintDimensions(selectedMass.footprint) : { width: 0, depth: 0 };
  const areaM2 = selectedMass ? footprintArea(selectedMass.footprint) : 0;
  const selectedVertex = selectedMass?.footprint.points[selectedVertexIndex] ?? selectedMass?.footprint.points[0] ?? { x: 0, z: 0 };
  const currentGroup = asset.viewGroups.find((group) => group.id === activeViewGroupId) ?? asset.viewGroups[0];

  return (
    <main className={styles.editorPage}>
      <header className={styles.toolbar}>
        <button type="button" className={styles.iconButton} onClick={() => navigateTo("/custom/buildings")}>← 목록</button>
        <input className={styles.nameInput} value={asset.name} aria-label="건축물 이름" onChange={(event) => commit((current) => ({ ...current, name: event.target.value }))} />
        <span className={styles.saveStatus}>{saveState}</span>
        <div className={styles.workspaceTabs} role="navigation" aria-label="매스 편집 모드">
          {[[EDITOR_WORKSPACES.BASIC, "기본"], [EDITOR_WORKSPACES.ADVANCED, "고급"], [EDITOR_WORKSPACES.OBSERVE, "관측"]].map(([id, label]) => <button key={id} type="button" aria-pressed={workspace === id} onClick={() => setWorkspace(id)}>{label}</button>)}
        </div>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`} title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`}><span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={17} /> : <SunIcon size={17} />}</span></button>
        <button type="button" className={styles.primaryButton} onClick={() => persist({ useInPlan: true })}>저장하고 도면에서 사용</button>
      </header>
      {conflictWarning ? <div className={styles.conflict} role="alert">{conflictWarning}</div> : null}
      <div className={styles.editorLayout}>
        {[WORLD_PANEL_IDS.OBJECTS, WORLD_PANEL_IDS.OBJECT_LIST].includes(activePanelId) ? <FloatingPanel open title={PANEL_TITLES[activePanelId]} topAligned onClose={() => setActivePanelId(null)}>
          <div className={`${styles.toolPanel} ${styles.floatingPanelContent}`}>
          {activePanelId === WORLD_PANEL_IDS.OBJECTS && workspace !== EDITOR_WORKSPACES.OBSERVE ? <>
            <section><header><strong>매스 시작</strong></header><button type="button" className={styles.sampleButton} onClick={applyComplexSample}>복합 연결 타워 샘플</button><div className={styles.templateGrid}>{BUILDING_FOOTPRINT_TEMPLATES.filter((template) => !["PODIUM_TOWER", "STEPPED"].includes(template.id)).map((template) => <button key={template.id} type="button" title={template.description} onClick={() => applyTemplate(template.id)}>{template.name}</button>)}</div></section>
            <section><header><strong>블록 추가</strong></header><div className={styles.inlineActions}><button type="button" onClick={() => addMass("RECTANGLE")}>사각</button><button type="button" onClick={() => addMass("CIRCLE")}>원형</button><button type="button" onClick={() => addMass("FREE_POLYGON")}>자유 폴리곤</button></div><div className={styles.inlineActions}><button type="button" disabled={!selectedEntityIds.length} onClick={duplicateSelected}>복제</button><button type="button" disabled={!selectedEntityIds.length || masses.length <= 1} onClick={deleteSelected}>삭제</button></div></section>
          </> : null}
          {activePanelId === WORLD_PANEL_IDS.OBJECT_LIST ? <section><header><strong>물리 요소</strong><small>{masses.length} 매스 · {connectors.length} 연결부</small></header><div className={styles.entityList}>{asset.entities.map((entity) => <button key={entity.id} type="button" className={selectedEntityIds.includes(entity.id) ? styles.active : ""} onClick={(event) => selectEntity(entity.id, event.ctrlKey || event.metaKey)}><span>{entity.entityType === BUILDING_ENTITY_TYPES.MASS ? "▰" : "↔"}</span><strong>{entity.name}</strong><small>{entity.visible === false ? "숨김" : entity.locked ? "잠금" : entity.entityType === BUILDING_ENTITY_TYPES.MASS ? `${entity.levelIds.length}개 층` : CONNECTOR_LABELS[entity.connectorType]}</small></button>)}</div></section> : null}
          {activePanelId === WORLD_PANEL_IDS.OBJECTS && workspace === EDITOR_WORKSPACES.ADVANCED ? <section><header><strong>연결 통로 생성</strong></header><label className={styles.field}><span>시작 매스</span><select value={connectorDraft.fromId} onChange={(event) => setConnectorDraft((draft) => ({ ...draft, fromId: event.target.value }))}><option value="">선택</option>{masses.map((mass) => <option key={mass.id} value={mass.id}>{mass.name}</option>)}</select></label><label className={styles.field}><span>종료 매스</span><select value={connectorDraft.toId} onChange={(event) => setConnectorDraft((draft) => ({ ...draft, toId: event.target.value }))}><option value="">선택</option>{masses.map((mass) => <option key={mass.id} value={mass.id}>{mass.name}</option>)}</select></label><label className={styles.field}><span>연결 층</span><select value={connectorDraft.levelId} onChange={(event) => setConnectorDraft((draft) => ({ ...draft, levelId: event.target.value }))}><option value="">선택</option>{asset.levels.map((level) => <option key={level.id} value={level.id}>{level.name} · {level.baseElevation.toFixed(1)}~{level.topElevation.toFixed(1)}m</option>)}</select></label><div className={styles.fieldGrid}><label className={styles.field}><span>형태</span><select value={connectorDraft.pathType} onChange={(event) => setConnectorDraft((draft) => ({ ...draft, pathType: event.target.value }))}><option value="straight">직선형</option><option value="L">L자형</option><option value="U">U자형</option></select></label><label className={styles.field}><span>유형</span><select value={connectorDraft.type} onChange={(event) => setConnectorDraft((draft) => ({ ...draft, type: event.target.value }))}>{CONNECTOR_TYPES.map((id) => <option key={id} value={id}>{CONNECTOR_LABELS[id]}</option>)}</select></label><NumericInput label="폭 m" value={connectorDraft.width} min={0.8} onChange={(width) => setConnectorDraft((draft) => ({ ...draft, width }))} /><NumericInput label="높이 m" value={connectorDraft.height} min={2} onChange={(height) => setConnectorDraft((draft) => ({ ...draft, height }))} /></div><button type="button" className={styles.primaryInline} disabled={!connectorDraft.fromId || !connectorDraft.toId || connectorDraft.fromId === connectorDraft.toId || !connectorDraft.levelId} onClick={addConnector}>연결 통로 생성</button></section> : null}
          {activePanelId === WORLD_PANEL_IDS.OBJECTS && workspace === EDITOR_WORKSPACES.OBSERVE ? <section><header><strong>관측 범위</strong><button type="button" onClick={createViewGroup} disabled={!selectedEntityIds.length}>선택 묶기</button></header><div className={styles.groupList}>{asset.viewGroups.map((group) => <button key={group.id} type="button" className={group.id === activeViewGroupId ? styles.active : ""} onClick={() => setActiveViewGroupId(group.id)}><span>{group.name}</span><small>{group.entityIds.length}개 요소</small></button>)}</div><label className={styles.field}><span>표시 모드</span><select value={viewMode} onChange={(event) => setViewMode(event.target.value)}><option value={BUILDING_VIEW_MODES.ALL}>전체 정상 표시</option><option value={BUILDING_VIEW_MODES.HIGHLIGHT}>선택 그룹 강조</option><option value={BUILDING_VIEW_MODES.GHOST_OTHERS}>선택 외 반투명</option><option value={BUILDING_VIEW_MODES.HIDE_OTHERS}>선택 외 숨김</option></select></label><Check label="분해 보기" checked={explode} onChange={setExplode} /><div className={styles.fieldGrid}><NumericInput label="이 높이 이하 숨김" value={heightCut.min ?? 0} min={0} onChange={(min) => setHeightCut((current) => ({ ...current, min: min <= 0 ? null : min }))} /><NumericInput label="이 높이 이상 숨김" value={heightCut.max ?? asset.bounds.height} min={0} onChange={(max) => setHeightCut((current) => ({ ...current, max: max >= asset.bounds.height ? null : max }))} /></div>{currentGroup?.type !== "whole" ? <button type="button" className={styles.dangerAction} onClick={() => deleteViewGroup(currentGroup.id)}>현재 그룹 삭제</button> : null}</section> : null}
          {activePanelId === WORLD_PANEL_IDS.OBJECT_LIST ? <section className={styles.metrics}><header><strong>조립체 지표</strong><button type="button" onClick={() => setAreaUnit((unit) => unit === "M2" ? "PYEONG" : "M2")}>{areaUnit === "M2" ? "㎡" : "평"}</button></header><dl><div><dt>매스</dt><dd>{asset.metrics.massCount}</dd></div><div><dt>연결부</dt><dd>{asset.metrics.connectorCount}</dd></div><div><dt>사용자 층</dt><dd>{asset.metrics.floorCount}</dd></div><div><dt>연면적</dt><dd>{areaUnit === "M2" ? `${asset.metrics.totalFloorAreaM2.toFixed(1)}㎡` : `${asset.metrics.totalFloorAreaPyeong.toFixed(1)}평`}</dd></div></dl></section> : null}
          </div>
        </FloatingPanel> : null}

        <section className={styles.viewport}>
          <div className={styles.viewTabs} role="group" aria-label="편집 화면 보기"><button type="button" aria-pressed={view === "2D"} onClick={() => setView("2D")}>2D 평면</button><button type="button" aria-pressed={view === "3D"} onClick={() => setView("3D")}>3D 미리보기</button>{view === "2D" && selectedMass && workspace === EDITOR_WORKSPACES.ADVANCED ? <button type="button" aria-pressed={footprintDetail} onClick={() => setFootprintDetail((value) => !value)}>{footprintDetail ? "전체 매스" : "꼭짓점"}</button> : null}</div>
          {view === "2D" ? footprintDetail && selectedMass ? <FootprintEditor2D footprint={selectedMass.footprint} selectedVertexIndex={selectedVertexIndex} snapEnabled={snapEnabled} orthogonalEnabled={false} onSelectVertex={setSelectedVertexIndex} onChange={(footprint) => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint }))} /> : <AssemblyPlanEditor2D asset={asset} selectedEntityIds={selectedEntityIds} activeViewGroupId={activeViewGroupId} viewMode={viewMode} snapEnabled={snapEnabled} onSelectEntity={selectEntity} onMoveMass={(entityId, position) => updateEntity(entityId, (mass) => ({ ...mass, transform: { ...mass.transform, position: { ...mass.transform.position, ...position } } }))} /> : <CustomBuildingPreview asset={asset} selectedEntityId={selectedEntityIds[0]} theme={theme} viewGroupId={activeViewGroupId} viewMode={viewMode} explode={explode} minVisibleElevation={heightCut.min} maxVisibleElevation={heightCut.max} cameraFocusKey={cameraFocusKey} transformTools={transformTools} snapEnabled={snapEnabled} snapSize={snapSize} transformEnabled={Boolean(selectedMass && !selectedMass.locked)} onSelectEntity={selectEntity} onTransformEntity={transformEntity} />}
          <EditorToolbar focusedScope hierarchyScopeLabel="커스텀 건축물 편집" panelMode="CUSTOM_BUILDING" activePanelId={activePanelId} onPanelChange={setActivePanelId} editorMode={EDITOR_MODES.WORLD} viewMode={view === "2D" ? VIEW_MODES.LAYOUT_2D : VIEW_MODES.VIEW_3D} transformTools={transformTools} snapSize={snapSize} gridSnapEnabled={snapEnabled} hasSelection={Boolean(selectedEntity)} hasTransformSelection={Boolean(view === "3D" && selectedMass && !selectedMass.locked && !explode)} worldLocked={false} saveStatus={saveState} canUndo={historyState.canUndo} canRedo={historyState.canRedo} showSelectionActions onEditorModeChange={() => {}} onViewModeChange={() => {}} onTransformToolToggle={toggleTransformTool} onSnapSizeChange={setSnapSize} onGridSnapChange={setSnapEnabled} onToggleWorldLock={() => {}} onDuplicate={duplicateSelected} onDelete={deleteSelected} onReset={resetBuilding} onLoad={() => navigateTo("/custom/buildings")} onSave={() => persist()} onUndo={() => restoreHistory(false)} onRedo={() => restoreHistory(true)} />
        </section>

        {[WORLD_PANEL_IDS.SETTINGS, WORLD_PANEL_IDS.DETAILS].includes(activePanelId) ? <FloatingPanel open title={PANEL_TITLES[activePanelId]} topAligned onClose={() => setActivePanelId(null)}>
          <div className={`${styles.propertyPanel} ${styles.floatingPanelContent}`}>
          {activePanelId === WORLD_PANEL_IDS.SETTINGS ? <section><header><strong>건축물 조립체</strong></header><label className={styles.field}><span>설명</span><textarea value={asset.description} onChange={(event) => commit((current) => ({ ...current, description: event.target.value }))} /></label><label className={styles.field}><span>검색 태그</span><input value={asset.tags.join(", ")} onChange={(event) => commit((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} /></label><label className={styles.field}><span>분류</span><select value={asset.assemblyType} onChange={(event) => commit((current) => ({ ...current, assemblyType: event.target.value }))}><option value="SINGLE_BUILDING">단일 건축물</option><option value="COMPLEX_BUILDING">복합 건축물</option><option value="BUILDING_COMPLEX">건축물 단지</option></select></label></section> : null}
          {activePanelId === WORLD_PANEL_IDS.DETAILS && selectedMass ? <section><header><strong>{selectedMass.name}</strong><small>건축 매스</small></header><label className={styles.field}><span>매스 이름</span><input value={selectedMass.name} onChange={(event) => updateEntity(selectedMass.id, (mass) => ({ ...mass, name: event.target.value }))} /></label><div className={styles.fieldGrid}><NumericInput label="위치 X" value={selectedMass.transform.position.x} onChange={(x) => updateEntity(selectedMass.id, (mass) => ({ ...mass, transform: { ...mass.transform, position: { ...mass.transform.position, x } } }))} /><NumericInput label="위치 Z" value={selectedMass.transform.position.z} onChange={(z) => updateEntity(selectedMass.id, (mass) => ({ ...mass, transform: { ...mass.transform, position: { ...mass.transform.position, z } } }))} /><NumericInput label="회전 °" value={selectedMass.transform.rotationY} step={5} onChange={(rotationY) => updateEntity(selectedMass.id, (mass) => ({ ...mass, transform: { ...mass.transform, rotationY } }))} /><NumericInput label="시작 높이" value={selectedMass.verticalRange.baseElevation} min={0} onChange={(baseElevation) => updateEntity(selectedMass.id, (mass) => ({ ...mass, verticalRange: { ...mass.verticalRange, baseElevation } }))} /><NumericInput label="종료 높이" value={selectedMass.verticalRange.topElevation} min={0.1} onChange={(topElevation) => updateEntity(selectedMass.id, (mass) => ({ ...mass, verticalRange: { ...mass.verticalRange, topElevation } }))} /><NumericInput label="가로 m" value={dimensions.width} min={1} onChange={(width) => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: resizeBuildingFootprint(mass.footprint, width, dimensions.depth) }))} /><NumericInput label="세로 m" value={dimensions.depth} min={1} onChange={(depth) => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: resizeBuildingFootprint(mass.footprint, dimensions.width, depth) }))} /><NumericInput label={`면적 ${areaUnit === "M2" ? "㎡" : "평"}`} value={areaUnit === "M2" ? areaM2 : areaM2 / PYEONG_IN_SQUARE_METERS} min={1} onChange={(value) => { const m2 = areaUnit === "M2" ? value : value * PYEONG_IN_SQUARE_METERS; updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: scaleFootprint(mass.footprint, Math.sqrt(m2 / Math.max(0.01, areaM2))) })); }} /></div><div className={styles.toggleRow}><Check label="잠금" checked={selectedMass.locked} onChange={(locked) => updateEntity(selectedMass.id, (mass) => ({ ...mass, locked }))} /><Check label="표시" checked={selectedMass.visible} onChange={(visible) => updateEntity(selectedMass.id, (mass) => ({ ...mass, visible }))} /><Check label="반투명" checked={selectedMass.translucent} onChange={(translucent) => updateEntity(selectedMass.id, (mass) => ({ ...mass, translucent }))} /></div><label className={styles.field}><span>재질</span><select value={asset.materials.find((item) => item.id === selectedMass.materialId)?.presetId ?? "CONCRETE"} onChange={(event) => commit((current) => ({ ...current, materials: current.materials.map((material) => material.id === selectedMass.materialId ? { ...material, presetId: event.target.value, roughness: MATERIAL_PRESET_MAP[event.target.value].roughness, metalness: MATERIAL_PRESET_MAP[event.target.value].metalness } : material) }))}>{WALL_MATERIAL_PRESET_IDS.map((id) => <option key={id} value={id}>{MATERIAL_PRESET_MAP[id].label}</option>)}</select></label><label className={styles.field}><span>색상</span><input type="color" value={selectedMass.color} onChange={(event) => updateEntity(selectedMass.id, (mass) => ({ ...mass, color: event.target.value }))} /></label>{workspace === EDITOR_WORKSPACES.ADVANCED ? <><div className={styles.inlineActions}><button type="button" onClick={() => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: addFootprintVertex(mass.footprint) }))}>꼭짓점 추가</button><button type="button" disabled={selectedMass.footprint.points.length <= 3} onClick={() => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: { ...mass.footprint, templateId: "FREE_POLYGON", points: mass.footprint.points.filter((_, index) => index !== selectedVertexIndex) } }))}>선택 삭제</button><button type="button" onClick={() => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: centerFootprint(mass.footprint) }))}>중심 정렬</button><button type="button" onClick={() => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: createCenteredHole(mass.footprint) }))}>중정 Hole</button></div><div className={styles.fieldGrid}><NumericInput label={`꼭짓점 ${selectedVertexIndex + 1} X`} value={selectedVertex.x} onChange={(x) => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: { ...mass.footprint, templateId: "FREE_POLYGON", points: mass.footprint.points.map((point, index) => index === selectedVertexIndex ? { ...point, x } : point) } }))} /><NumericInput label={`꼭짓점 ${selectedVertexIndex + 1} Z`} value={selectedVertex.z} onChange={(z) => updateEntity(selectedMass.id, (mass) => ({ ...mass, footprint: { ...mass.footprint, templateId: "FREE_POLYGON", points: mass.footprint.points.map((point, index) => index === selectedVertexIndex ? { ...point, z } : point) } }))} /></div></> : null}</section> : null}
          {activePanelId === WORLD_PANEL_IDS.DETAILS && selectedConnector ? <section><header><strong>{selectedConnector.name}</strong><small>연결 통로</small></header><label className={styles.field}><span>이름</span><input value={selectedConnector.name} onChange={(event) => updateEntity(selectedConnector.id, (item) => ({ ...item, name: event.target.value }))} /></label><label className={styles.field}><span>연결 층</span><select value={selectedConnector.levelIds[0] ?? ""} onChange={(event) => updateConnectorLevel(selectedConnector, event.target.value)}>{asset.levels.map((level) => <option key={level.id} value={level.id}>{level.name} · {level.baseElevation.toFixed(1)}~{level.topElevation.toFixed(1)}m</option>)}</select></label><div className={styles.fieldGrid}><NumericInput label="폭 m" value={selectedConnector.width} min={0.8} onChange={(width) => updateEntity(selectedConnector.id, (item) => ({ ...item, width }))} /><NumericInput label="높이 m" value={selectedConnector.height} min={2} onChange={(height) => updateEntity(selectedConnector.id, (item) => ({ ...item, height, verticalRange: { ...item.verticalRange, topElevation: item.verticalRange.baseElevation + height } }))} /><label className={styles.field}><span>경로</span><select value={selectedConnector.path.type} onChange={(event) => updateEntity(selectedConnector.id, (item) => ({ ...item, path: { ...item.path, type: event.target.value } }))}><option value="straight">직선형</option><option value="L">L자형</option><option value="U">U자형</option></select></label><label className={styles.field}><span>마감</span><select value={selectedConnector.materialPreset} onChange={(event) => updateEntity(selectedConnector.id, (item) => ({ ...item, materialPreset: event.target.value }))}><option value="glass">유리</option><option value="steel">금속</option><option value="concrete">콘크리트</option><option value="mixed">혼합</option></select></label></div><div className={styles.toggleRow}><Check label="좌측 벽" checked={selectedConnector.enclosure.leftWall} onChange={(leftWall) => updateEntity(selectedConnector.id, (item) => ({ ...item, enclosure: { ...item.enclosure, leftWall } }))} /><Check label="우측 벽" checked={selectedConnector.enclosure.rightWall} onChange={(rightWall) => updateEntity(selectedConnector.id, (item) => ({ ...item, enclosure: { ...item.enclosure, rightWall } }))} /><Check label="지붕" checked={selectedConnector.enclosure.roof} onChange={(roof) => updateEntity(selectedConnector.id, (item) => ({ ...item, enclosure: { ...item.enclosure, roof } }))} /></div></section> : null}
          {activePanelId === WORLD_PANEL_IDS.DETAILS && selectedEntity ? <section><header><strong>관측 그룹 멤버십</strong><small>복수 소속 가능</small></header><div className={styles.membershipList}>{asset.viewGroups.map((group) => <Check key={group.id} label={group.name} checked={group.entityIds.includes(selectedEntity.id)} disabled={group.type === "whole"} onChange={(checked) => toggleGroupMembership(group.id, selectedEntity.id, checked)} />)}</div></section> : null}
          {activePanelId === WORLD_PANEL_IDS.SETTINGS && workspace === EDITOR_WORKSPACES.ADVANCED ? <section><header><strong>사용자 정의 층</strong><button type="button" onClick={addLevel}>+ 층</button></header><div className={styles.autoLevelRow}><NumericInput label="자동 층 수" value={autoLevels.count} min={1} max={200} step={1} onChange={(count) => setAutoLevels((current) => ({ ...current, count: Math.round(count) }))} /><NumericInput label="기본 층고" value={autoLevels.height} min={2} max={20} onChange={(height) => setAutoLevels((current) => ({ ...current, height }))} /><button type="button" onClick={regenerateLevels}>자동 분할</button></div><div className={styles.levelList}>{asset.levels.map((level) => <div key={level.id} className={styles.levelItem}><input aria-label="층 이름" value={level.name} onChange={(event) => updateLevel(level.id, { name: event.target.value })} /><input aria-label={`${level.name} 시작 높이`} type="number" step="0.1" value={level.baseElevation} onChange={(event) => updateLevel(level.id, { baseElevation: Number(event.target.value) })} /><span>~</span><input aria-label={`${level.name} 종료 높이`} type="number" step="0.1" value={level.topElevation} onChange={(event) => updateLevel(level.id, { topElevation: Number(event.target.value) })} /><button type="button" title="층 분할" onClick={() => splitLevel(level.id)}>분할</button><button type="button" title="다음 층과 병합" onClick={() => mergeLevel(level.id)}>병합</button></div>)}</div></section> : null}
          {activePanelId === WORLD_PANEL_IDS.SETTINGS && (validationIssues.length || saveError) ? <section className={styles.validation} aria-live="polite"><header><strong>형상·관계 검사</strong><span>{blockingErrors.length} 오류 · {validationIssues.length - blockingErrors.length} 경고</span></header>{saveError ? <p>{saveError}</p> : null}<ul>{validationIssues.slice(0, 8).map((item, index) => <li key={`${item.path}-${index}`} data-severity={item.severity ?? "error"}>{item.message}</li>)}</ul></section> : null}
          </div>
        </FloatingPanel> : null}
      </div>
    </main>
  );
}
