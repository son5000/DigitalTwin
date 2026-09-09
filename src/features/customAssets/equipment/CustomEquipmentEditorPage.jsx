import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";
import CatalogThumbnail from "@/features/digitalTwin/editor/components/CatalogThumbnail";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import FloatingPanel from "@/features/digitalTwin/editor/components/FloatingPanel";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { MOVE_AXIS_MODES, ROTATION_AXIS_MODES } from "@/features/digitalTwin/editor/constants/transformTools";
import { WORLD_PANEL_IDS } from "@/features/digitalTwin/editor/constants/worldPanel";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import { useCustomAssets } from "../components/customAssetContext";
import { getCustomEquipmentEditPath, navigateTo } from "../core/customAssetNavigation";
import { CUSTOM_ASSET_STATUS } from "../core/customAssetTypes";
import { validateCustomAsset } from "../core/customAssetValidation";
import CustomEquipmentPreview from "./CustomEquipmentPreview";
import {
  CUSTOM_EQUIPMENT_CATEGORIES,
  CUSTOM_EQUIPMENT_DIRECTIONS,
  CUSTOM_EQUIPMENT_PART_MAP,
  CUSTOM_EQUIPMENT_PART_LIBRARY,
  alignCustomEquipmentParts,
  alignPartPorts,
  connectEquipmentPorts,
  createCustomEquipmentPart,
  createDefaultCustomEquipment,
  disconnectEquipmentPort,
  duplicateCustomEquipmentParts,
  findEquipmentSnapCandidate,
  groupCustomEquipmentParts,
  insertJunctionOnStraight,
  normalizeCustomEquipment,
  recalculateCustomEquipment,
  removeCustomEquipmentParts,
  ungroupCustomEquipmentParts,
} from "./customEquipmentModel";
import { createEquipmentThumbnail } from "./equipmentThumbnail";
import "./equipmentValidator";
import styles from "./CustomEquipmentEditor.module.css";

const PANEL_TITLES = Object.freeze({
  [WORLD_PANEL_IDS.OBJECTS]: "부품 라이브러리",
  [WORLD_PANEL_IDS.OBJECT_LIST]: "내부 구성",
  [WORLD_PANEL_IDS.SETTINGS]: "설비 설정",
  [WORLD_PANEL_IDS.DETAILS]: "선택 부품 설정",
});

function NumericField({ label, value, step = 0.1, min, onChange }) {
  return <label className={styles.field}><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export default function CustomEquipmentEditorPage({ assetId = null }) {
  const { save, repository } = useCustomAssets();
  const { theme, toggleTheme } = useEditorTheme();
  const [asset, setAsset] = useState(null);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [libraryFilters, setLibraryFilters] = useState({ categoryId: "ALL", query: "" });
  const [selectedPort, setSelectedPort] = useState(null);
  const [transformMode, setTransformMode] = useState("translate");
  const [directionId, setDirectionId] = useState("E");
  const [junctionRatio, setJunctionRatio] = useState(0.5);
  const [saveState, setSaveState] = useState("불러오는 중");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState({ undo: false, redo: false });
  const [focusKey, setFocusKey] = useState(0);
  const [placementType, setPlacementType] = useState(null);
  const [placementStatus, setPlacementStatus] = useState("idle");
  const [activePanelId, setActivePanelId] = useState(WORLD_PANEL_IDS.OBJECTS);
  const assetRef = useRef(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const dirtyRef = useRef(false);

  useEffect(() => { assetRef.current = asset; }, [asset]);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = assetId ? await repository.get(assetId) : null;
      const draft = assetId ? repository.loadDraft(assetId) : null;
      const source = draft && (!stored || String(draft.updatedAt) > String(stored.updatedAt)) ? draft : stored;
      const initial = normalizeCustomEquipment(source ?? createDefaultCustomEquipment());
      if (!active) return;
      setAsset(initial);
      setSelectedPartId(initial.parts[0]?.id ?? null);
      setSelectedPartIds(initial.parts[0]?.id ? [initial.parts[0].id] : []);
      setSaveState(source ? "로컬 초안 복구" : "새 초안");
      repository.saveDraft(initial);
      if (!assetId) window.history.replaceState({}, "", getCustomEquipmentEditPath(initial.id));
    })().catch((cause) => {
      if (active) {
        setMessage(cause instanceof Error ? cause.message : "설비를 불러오지 못했습니다.");
        setSaveState("불러오기 실패");
      }
    });
    return () => { active = false; };
  }, [assetId, repository]);

  const commit = useCallback((updater, { record = true } = {}) => {
    const current = assetRef.current;
    if (!current) return;
    const raw = typeof updater === "function" ? updater(structuredClone(current)) : updater;
    const next = recalculateCustomEquipment({ ...raw, updatedAt: new Date().toISOString() });
    if (record) {
      pastRef.current = [...pastRef.current, structuredClone(current)].slice(-80);
      futureRef.current = [];
    }
    dirtyRef.current = true;
    setAsset(next);
    setSaveState("편집 중");
    setHistory({ undo: pastRef.current.length > 0, redo: futureRef.current.length > 0 });
  }, []);

  const restoreHistory = useCallback((redo = false) => {
    const current = assetRef.current;
    const source = redo ? futureRef : pastRef;
    const target = source.current.at(-1);
    if (!current || !target) return;
    if (redo) {
      pastRef.current = [...pastRef.current, structuredClone(current)].slice(-80);
      futureRef.current = futureRef.current.slice(0, -1);
    } else {
      futureRef.current = [...futureRef.current, structuredClone(current)].slice(-80);
      pastRef.current = pastRef.current.slice(0, -1);
    }
    dirtyRef.current = true;
    setAsset(target);
    setSelectedPartId(target.parts[0]?.id ?? null);
    setSelectedPartIds(target.parts[0]?.id ? [target.parts[0].id] : []);
    setSelectedPort(null);
    setSaveState("편집 중");
    setHistory({ undo: pastRef.current.length > 0, redo: futureRef.current.length > 0 });
  }, []);

  const persist = useCallback(async (ready = false) => {
    const current = assetRef.current;
    if (!current) return false;
    const prepared = recalculateCustomEquipment({
      ...current,
      status: ready ? CUSTOM_ASSET_STATUS.READY : current.status,
      revision: current.revision + 1,
      thumbnail: createEquipmentThumbnail(current, theme),
      updatedAt: new Date().toISOString(),
    });
    const issues = validateCustomAsset(prepared);
    if (issues.length) {
      setMessage(issues[0].message);
      return false;
    }
    try {
      setSaveState("저장 중…");
      const saved = await save(prepared);
      repository.clearDraft(saved.id);
      dirtyRef.current = false;
      setAsset(saved);
      setSaveState(ready ? "제작 완료" : "저장 완료");
      setMessage(ready ? "설비 카탈로그에서 사용할 수 있습니다." : "로컬에 저장했습니다.");
      return true;
    } catch (cause) {
      setSaveState("저장 실패");
      setMessage(cause instanceof Error ? cause.message : "설비를 저장하지 못했습니다.");
      return false;
    }
  }, [repository, save, theme]);

  useEffect(() => {
    if (!asset || !dirtyRef.current) return undefined;
    repository.saveDraft(asset);
    const timer = window.setTimeout(() => persist(false), 800);
    return () => window.clearTimeout(timer);
  }, [asset, persist, repository]);

  useEffect(() => {
    const keydown = (event) => {
      const key = event.key.toLocaleLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        restoreHistory(key === "y" || event.shiftKey);
        return;
      }
      if (event.key === "Escape") {
        setPlacementType(null);
        setPlacementStatus("idle");
        setSelectedPort(null);
        setTransformMode("off");
        setMessage("부품 배치를 취소했습니다.");
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable) return;
      if (key === "w" || key === "e") {
        event.preventDefault();
        setPlacementType(null);
        setTransformMode((current) => current === (key === "w" ? "translate" : "rotate") ? "off" : (key === "w" ? "translate" : "rotate"));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [restoreHistory]);

  const selectedPart = asset?.parts.find((part) => part.id === selectedPartId) ?? null;
  const selectedParts = asset?.parts.filter((part) => selectedPartIds.includes(part.id)) ?? [];
  const selectedGroup = asset?.groups?.find((group) => selectedPartIds.some((partId) => group.partIds.includes(partId))) ?? null;
  const filteredPartLibrary = useMemo(() => {
    const query = libraryFilters.query.trim().toLocaleLowerCase("ko");
    return CUSTOM_EQUIPMENT_PART_LIBRARY.filter((part) => (
      (libraryFilters.categoryId === "ALL" || part.categoryId === libraryFilters.categoryId)
      && (!query || `${part.nameKo} ${part.id} ${part.modelFamilyId ?? ""}`.toLocaleLowerCase("ko").includes(query))
    ));
  }, [libraryFilters]);
  const issues = useMemo(() => asset ? validateCustomAsset(asset) : [], [asset]);
  const transformTools = useMemo(() => ({
    moveAxisMode: transformMode === "translate" ? MOVE_AXIS_MODES.XYZ : MOVE_AXIS_MODES.OFF,
    rotationAxisMode: transformMode === "rotate" ? ROTATION_AXIS_MODES.XYZ : ROTATION_AXIS_MODES.OFF,
    rotate: transformMode === "rotate",
  }), [transformMode]);

  function selectPart(partId, { openDetails = true, additive = false } = {}) {
    const group = assetRef.current?.groups?.find((item) => item.partIds.includes(partId));
    if (!additive && group && editingGroupId !== group.id) {
      setSelectedPartIds(group.partIds);
      setSelectedPartId(partId);
    } else if (additive) {
      setSelectedPartIds((current) => {
        const next = current.includes(partId) ? current.filter((id) => id !== partId) : [...current, partId];
        setSelectedPartId(next.includes(partId) ? partId : next.at(-1) ?? null);
        return next;
      });
    } else {
      setSelectedPartIds([partId]);
      setSelectedPartId(partId);
    }
    setSelectedPort(null);
    if (openDetails) setActivePanelId(WORLD_PANEL_IDS.DETAILS);
  }

  function toggleTransformTool(tool) {
    setPlacementType(null);
    setPlacementStatus("idle");
    setTransformMode((current) => current === tool ? "off" : tool);
  }

  function startPlacement(part) {
    setPlacementType(part.id);
    setPlacementStatus("hidden");
    setTransformMode("off");
    setMessage(`${part.nameKo} 배치 중 · 3D 화면에서 원하는 위치를 클릭하세요.`);
  }

  function placePart(result) {
    if (!result?.partId) return;
    commit(result.asset);
    setSelectedPartId(result.partId);
    setSelectedPartIds([result.partId]);
    setSelectedPort(null);
    setMessage(result.snapped ? "연결 포트에 맞춰 부품을 배치했습니다." : "선택한 위치에 부품을 배치했습니다.");
  }

  const updatePlacementStatus = useCallback((status) => {
    setPlacementStatus(status);
    if (status === "snapped") setMessage("연결 포트에 스냅됩니다. 클릭하여 배치하세요.");
    else if (status === "ready") setMessage("클릭하여 이 위치에 부품을 배치하세요.");
  }, []);

  function updatePart(changes) {
    if (!selectedPart) return;
    commit((current) => ({
      ...current,
      parts: current.parts.map((part) => part.id === selectedPart.id
        ? createCustomEquipmentPart(part.type, { ...part, ...changes, parameters: { ...part.parameters, ...changes.parameters }, appearance: { ...part.appearance, ...changes.appearance } })
        : part),
    }));
  }

  function transformPart(partId, changes) {
    commit((current) => {
      const currentPart = current.parts.find((part) => part.id === partId);
      if (!currentPart) return current;
      const targets = selectedPartIds.includes(partId) ? selectedPartIds : [partId];
      const positionDelta = changes.position ? {
        x: changes.position.x - currentPart.position.x,
        y: changes.position.y - currentPart.position.y,
        z: changes.position.z - currentPart.position.z,
      } : null;
      const rotationDelta = changes.rotation ? {
        x: changes.rotation.x - currentPart.rotation.x,
        y: changes.rotation.y - currentPart.rotation.y,
        z: changes.rotation.z - currentPart.rotation.z,
      } : null;
      let next = recalculateCustomEquipment({
        ...current,
        parts: current.parts.map((part) => targets.includes(part.id) ? {
          ...part,
          position: positionDelta ? {
            x: part.position.x + positionDelta.x,
            y: part.position.y + positionDelta.y,
            z: part.position.z + positionDelta.z,
          } : part.position,
          rotation: rotationDelta ? {
            x: part.rotation.x + rotationDelta.x,
            y: part.rotation.y + rotationDelta.y,
            z: part.rotation.z + rotationDelta.z,
          } : part.rotation,
        } : part),
      });
      if (targets.length !== 1) return next;
      const candidate = findEquipmentSnapCandidate(next, partId);
      if (!candidate) return next;
      next = alignPartPorts(next, candidate.movingRef, candidate.targetRef);
      const connected = connectEquipmentPorts(next, candidate.movingRef, candidate.targetRef);
      setMessage(connected.reason);
      return connected.asset;
    });
  }

  function selectPort(partId, portId) {
    const nextRef = { partId, portId };
    const current = assetRef.current;
    if (selectedPort && (selectedPort.partId !== partId || selectedPort.portId !== portId)) {
      const result = connectEquipmentPorts(current, selectedPort, nextRef);
      if (result.ok) {
        commit(result.asset);
        setSelectedPort(null);
        setMessage(result.reason);
        return;
      }
      setMessage(result.reason);
    }
    setSelectedPartId(partId);
    setSelectedPartIds([partId]);
    setSelectedPort(nextRef);
    setActivePanelId(WORLD_PANEL_IDS.DETAILS);
  }

  function duplicatePart() {
    const result = duplicateCustomEquipmentParts(asset, selectedPartIds);
    if (!result.partIds.length) return;
    commit(result.asset);
    setSelectedPartIds(result.partIds);
    setSelectedPartId(result.partIds.at(-1));
  }

  function deletePart() {
    if (!selectedPartIds.length) return;
    const remaining = asset.parts.find((part) => !selectedPartIds.includes(part.id))?.id ?? null;
    commit((current) => removeCustomEquipmentParts(current, selectedPartIds));
    setSelectedPartIds(remaining ? [remaining] : []);
    setSelectedPartId(remaining);
    setSelectedPort(null);
  }

  function groupSelection() {
    const result = groupCustomEquipmentParts(asset, selectedPartIds);
    if (!result.groupId) return;
    commit(result.asset);
    setEditingGroupId(null);
    setMessage("선택한 부품을 하나의 편집 그룹으로 묶었습니다.");
  }

  function ungroupSelection() {
    if (!selectedGroup) return;
    commit((current) => ungroupCustomEquipmentParts(current, selectedGroup.id));
    setEditingGroupId(null);
    setMessage("그룹을 해제했습니다.");
  }

  function alignSelection(axis) {
    if (selectedPartIds.length < 2) return;
    commit((current) => alignCustomEquipmentParts(current, selectedPartIds, axis));
    setMessage(`${axis.toUpperCase()}축 기준으로 정렬했습니다.`);
  }

  function insertJunction(type) {
    if (!selectedPart) return;
    const result = insertJunctionOnStraight(asset, selectedPart.id, type, junctionRatio);
    if (result.partId) {
      commit(result.asset);
      setSelectedPartId(result.partId);
      setSelectedPartIds([result.partId]);
    }
    setMessage(result.reason);
  }

  function resetEquipment() {
    const fresh = createDefaultCustomEquipment();
    commit((current) => ({
      ...fresh,
      id: current.id,
      name: current.name,
      createdAt: current.createdAt,
      revision: current.revision,
      status: current.status,
    }));
    setSelectedPartId(fresh.parts[0]?.id ?? null);
    setSelectedPartIds(fresh.parts[0]?.id ? [fresh.parts[0].id] : []);
    setSelectedPort(null);
    setPlacementType(null);
    setTransformMode("translate");
    setActivePanelId(WORLD_PANEL_IDS.OBJECTS);
    setFocusKey((key) => key + 1);
  }

  if (!asset) return <main className={styles.loading}>커스텀 설비를 준비하는 중입니다.</main>;

  return (
    <main className={styles.editorPage}>
      <header className={styles.toolbar}>
        <button type="button" className={styles.iconButton} onClick={() => navigateTo("/custom/equipment")}>← 목록</button>
        <input className={styles.nameInput} value={asset.name} aria-label="설비 이름" onChange={(event) => commit((current) => ({ ...current, name: event.target.value }))} />
        <span className={styles.saveState}>{saveState}</span>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.themeToggle} aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`} title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 테마로 전환`} onClick={toggleTheme}><span aria-hidden="true">{theme === EDITOR_THEMES.DARK ? <MoonIcon size={17} /> : <SunIcon size={17} />}</span></button>
        <button type="button" onClick={() => persist(false)}>저장</button>
        <button type="button" className={styles.primary} onClick={() => persist(true)}>제작 완료</button>
      </header>

      <div className={styles.editorLayout}>
        {[WORLD_PANEL_IDS.OBJECTS, WORLD_PANEL_IDS.OBJECT_LIST].includes(activePanelId) ? (
          <FloatingPanel open title={PANEL_TITLES[activePanelId]} topAligned onClose={() => setActivePanelId(null)}>
            <div className={`${styles.library} ${styles.floatingPanelContent}`}>
              {activePanelId === WORLD_PANEL_IDS.OBJECTS ? <>
                <section>
                  <div className={styles.panelTitle}><strong>산업 설비 라이브러리</strong><small>선택 후 3D 화면을 클릭해 배치하세요.</small></div>
                  <div className={styles.libraryTools}>
                    <input type="search" value={libraryFilters.query} placeholder="설비 이름 검색" aria-label="설비 이름 검색" onChange={(event) => setLibraryFilters((current) => ({ ...current, query: event.target.value }))} />
                    <select value={libraryFilters.categoryId} aria-label="설비 카테고리" onChange={(event) => setLibraryFilters((current) => ({ ...current, categoryId: event.target.value }))}>
                      {CUSTOM_EQUIPMENT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.nameKo}</option>)}
                    </select>
                  </div>
                  <div className={styles.parts}>{filteredPartLibrary.map((part) => <button key={part.id} type="button" aria-pressed={placementType === part.id} onClick={() => startPlacement(part)}><CatalogThumbnail definition={part} title={part.nameKo} className={styles.partThumbnail} /><strong>{part.nameKo}</strong></button>)}</div>
                  {!filteredPartLibrary.length ? <p className={styles.emptyLibrary}>검색 결과가 없습니다.</p> : null}
                </section>
                <section><div className={styles.directionPanel}><strong>작업 평면 8방향</strong><div>{CUSTOM_EQUIPMENT_DIRECTIONS.map((direction) => <button key={direction.id} type="button" aria-pressed={directionId === direction.id} title={direction.label} onClick={() => setDirectionId(direction.id)}>{direction.id}</button>)}</div><small>부품 회전 기준의 로컬 방향으로 연장합니다.</small></div></section>
              </> : null}
              {activePanelId === WORLD_PANEL_IDS.OBJECT_LIST ? <section>
                <div className={styles.panelTitle}><strong>내부 구성</strong><small>{asset.metrics.partCount}개 부품 · {asset.metrics.connectionCount}개 연결 · {asset.metrics.groupCount ?? 0}개 그룹</small></div>
                <div className={styles.selectionTools}>
                  <button type="button" disabled={selectedPartIds.length < 2} onClick={groupSelection}>그룹화</button>
                  <button type="button" disabled={!selectedGroup} onClick={ungroupSelection}>그룹 해제</button>
                  <button type="button" disabled={!selectedGroup} aria-pressed={editingGroupId === selectedGroup?.id} onClick={() => setEditingGroupId((current) => current === selectedGroup?.id ? null : selectedGroup?.id)}>그룹 내부 편집</button>
                  {["x", "y", "z"].map((axis) => <button key={axis} type="button" disabled={selectedPartIds.length < 2} onClick={() => alignSelection(axis)}>{axis.toUpperCase()} 정렬</button>)}
                </div>
                <div className={styles.partTree}>{asset.parts.map((part, index) => <button key={part.id} type="button" aria-current={selectedPartIds.includes(part.id) ? "true" : undefined} onClick={(event) => selectPart(part.id, { additive: event.ctrlKey || event.metaKey || event.shiftKey })}><span>{String(index + 1).padStart(2, "0")}</span><strong>{part.name}</strong>{part.groupId ? <small className={styles.groupBadge}>그룹</small> : null}</button>)}</div>
              </section> : null}
            </div>
          </FloatingPanel>
        ) : null}

        <section className={styles.stage} data-placement-state={placementStatus}>
          <div className={styles.stageToolbar}><button type="button" onClick={() => setFocusKey((key) => key + 1)}>전체 설비 보기</button><span>{placementType ? `${CUSTOM_EQUIPMENT_PART_MAP[placementType]?.nameKo} 배치 중 · ESC 취소` : `${asset.metrics.connectionCount}개 연결 · ${selectedPartIds.length}개 선택 · ${asset.bounds.width.toFixed(1)} × ${asset.bounds.depth.toFixed(1)} × ${asset.bounds.height.toFixed(1)}m`}</span></div>
          <CustomEquipmentPreview asset={asset} selectedPartId={selectedPartId} selectedPartIds={selectedPartIds} selectedPortId={selectedPort?.partId === selectedPartId ? selectedPort.portId : null} selectedPortRef={selectedPort} placementType={placementType} placementDirectionId={directionId} theme={theme} transformMode={transformMode} focusKey={focusKey} onSelectPart={selectPart} onSelectPort={selectPort} onTransformPart={transformPart} onPlacePart={placePart} onPlacementState={updatePlacementStatus} />
          <div className={styles.message} role="status">{message || "부품과 연결 포트를 선택해 배관 설비를 조립하세요."}</div>
          <EditorToolbar focusedScope hierarchyScopeLabel="커스텀 설비 편집" panelMode="CUSTOM_EQUIPMENT" activePanelId={activePanelId} onPanelChange={setActivePanelId} editorMode={EDITOR_MODES.EQUIPMENT} viewMode={VIEW_MODES.VIEW_3D} transformTools={transformTools} gridSnapEnabled={false} snapSize={0.5} hasSelection={Boolean(selectedPart)} hasTransformSelection={Boolean(selectedPart && !placementType)} worldLocked={false} saveStatus={saveState} canUndo={history.undo} canRedo={history.redo} showSelectionActions showGridSnapControl={false} onEditorModeChange={() => {}} onViewModeChange={() => {}} onTransformToolToggle={toggleTransformTool} onSnapSizeChange={() => {}} onGridSnapChange={() => {}} onToggleWorldLock={() => {}} onDuplicate={duplicatePart} onDelete={deletePart} onReset={resetEquipment} onLoad={() => navigateTo("/custom/equipment")} onSave={() => persist(false)} onUndo={() => restoreHistory(false)} onRedo={() => restoreHistory(true)} />
        </section>

        {[WORLD_PANEL_IDS.SETTINGS, WORLD_PANEL_IDS.DETAILS].includes(activePanelId) ? (
          <FloatingPanel open title={PANEL_TITLES[activePanelId]} topAligned onClose={() => setActivePanelId(null)}>
            <div className={`${styles.properties} ${styles.floatingPanelContent}`}>
              {activePanelId === WORLD_PANEL_IDS.DETAILS && selectedPart ? <section>
                <div className={styles.panelTitle}><strong>{selectedPart.name}</strong><small>{selectedParts.length > 1 ? `${selectedParts.length}개 부품 선택` : "설비 부품"}</small></div>
                <label className={styles.field}><span>부품 이름</span><input value={selectedPart.name} onChange={(event) => updatePart({ name: event.target.value })} /></label>
                <div className={styles.fieldGrid}>
                  {selectedPart.partKind === "PIPE" ? <>
                    <NumericField label="길이 m" value={selectedPart.parameters.length} min={0.1} onChange={(length) => updatePart({ parameters: { length } })} />
                    <NumericField label="지름 m" value={selectedPart.parameters.diameter} min={0.02} step={0.01} onChange={(diameter) => updatePart({ parameters: { diameter } })} />
                    {selectedPart.type.includes("ELBOW") ? <NumericField label="곡률 반경 m" value={selectedPart.parameters.bendRadius} min={0.05} onChange={(bendRadius) => updatePart({ parameters: { bendRadius } })} /> : null}
                  </> : <>
                    <NumericField label="너비 m" value={selectedPart.dimensions.width} min={0.05} onChange={(width) => updatePart({ dimensions: { ...selectedPart.dimensions, width } })} />
                    <NumericField label="높이 m" value={selectedPart.dimensions.height} min={0.05} onChange={(height) => updatePart({ dimensions: { ...selectedPart.dimensions, height } })} />
                    <NumericField label="깊이 m" value={selectedPart.dimensions.depth} min={0.05} onChange={(depth) => updatePart({ dimensions: { ...selectedPart.dimensions, depth } })} />
                  </>}
                  <NumericField label="위치 X" value={selectedPart.position.x} onChange={(x) => updatePart({ position: { ...selectedPart.position, x } })} />
                  <NumericField label="높이 Y" value={selectedPart.position.y} onChange={(y) => updatePart({ position: { ...selectedPart.position, y } })} />
                  <NumericField label="위치 Z" value={selectedPart.position.z} onChange={(z) => updatePart({ position: { ...selectedPart.position, z } })} />
                  <NumericField label="회전 X°" value={selectedPart.rotation.x * 180 / Math.PI} step={5} onChange={(value) => updatePart({ rotation: { ...selectedPart.rotation, x: value * Math.PI / 180 } })} />
                  <NumericField label="회전 Y°" value={selectedPart.rotation.y * 180 / Math.PI} step={5} onChange={(value) => updatePart({ rotation: { ...selectedPart.rotation, y: value * Math.PI / 180 } })} />
                  <NumericField label="회전 Z°" value={selectedPart.rotation.z * 180 / Math.PI} step={5} onChange={(value) => updatePart({ rotation: { ...selectedPart.rotation, z: value * Math.PI / 180 } })} />
                </div>
                <label className={styles.field}><span>재질</span><select value={selectedPart.appearance.materialPreset} onChange={(event) => updatePart({ appearance: { materialPreset: event.target.value } })}><option value="PAINTED_METAL">도장 금속</option><option value="STAINLESS">스테인리스</option><option value="STEEL">철재</option><option value="PLASTIC">플라스틱</option></select></label>
                <label className={styles.field}><span>색상</span><input type="color" value={selectedPart.appearance.color} onChange={(event) => updatePart({ appearance: { color: event.target.value } })} /></label>
                <div className={styles.ports}><strong>연결 포트</strong>{selectedPart.ports.map((port) => <button key={port.id} type="button" aria-pressed={selectedPort?.partId === selectedPart.id && selectedPort.portId === port.id} onClick={() => selectPort(selectedPart.id, port.id)}><span>{port.role === "BRANCH" ? "분기" : "주 연결"} · Ø{port.diameter.toFixed(2)}m</span><small>{port.connectedTo ? "연결됨" : "연결 가능"}</small></button>)}{selectedPort ? <button type="button" onClick={() => { commit((current) => disconnectEquipmentPort(current, selectedPort.partId, selectedPort.portId)); setSelectedPort(null); }}>선택 포트 연결 해제</button> : null}</div>
                {selectedPart.type === "PIPE_STRAIGHT" ? <div className={styles.junctions}><strong>중간 접합부 삽입</strong><label><span>배관 시작점에서 {Math.round(junctionRatio * 100)}%</span><input type="range" min="0.2" max="0.8" step="0.05" value={junctionRatio} onChange={(event) => setJunctionRatio(Number(event.target.value))} /></label><button type="button" onClick={() => insertJunction("PIPE_T")}>T형</button><button type="button" onClick={() => insertJunction("PIPE_Y")}>Y형</button><button type="button" onClick={() => insertJunction("PIPE_CROSS")}>십자형</button></div> : null}
                <div className={styles.actions}><button type="button" onClick={duplicatePart}>부품 복제</button><button type="button" className={styles.danger} onClick={deletePart}>부품 삭제</button></div>
              </section> : null}
              {activePanelId === WORLD_PANEL_IDS.DETAILS && !selectedPart ? <section><p>내부 구성 또는 3D 화면에서 부품을 선택하세요.</p></section> : null}
              {activePanelId === WORLD_PANEL_IDS.SETTINGS ? <section>
                <div className={styles.panelTitle}><strong>설비 정보</strong><small>{asset.metrics.partCount}개 부품 · {asset.metrics.connectionCount}개 연결</small></div>
                <label className={styles.field}><span>설명</span><textarea value={asset.description} onChange={(event) => commit((current) => ({ ...current, description: event.target.value }))} /></label>
                <label className={styles.field}><span>태그</span><input value={asset.tags.join(", ")} onChange={(event) => commit((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} /></label>
                <div className={styles.fieldGrid}><NumericField label="전체 위치 X" value={asset.transform.position.x} onChange={(x) => commit((current) => ({ ...current, transform: { ...current.transform, position: { ...current.transform.position, x } } }))} /><NumericField label="전체 위치 Y" value={asset.transform.position.y} onChange={(y) => commit((current) => ({ ...current, transform: { ...current.transform, position: { ...current.transform.position, y } } }))} /><NumericField label="전체 위치 Z" value={asset.transform.position.z} onChange={(z) => commit((current) => ({ ...current, transform: { ...current.transform, position: { ...current.transform.position, z } } }))} /></div>
                <button type="button" onClick={() => commit((current) => ({ ...current, origin: { ...current.bounds.center } }))}>전체 설비 중심을 원점으로 설정</button>
                {issues.length ? <p className={styles.error}>{issues[0].message}</p> : null}
              </section> : null}
            </div>
          </FloatingPanel>
        ) : null}
      </div>
    </main>
  );
}
