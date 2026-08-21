import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { loadLayout, saveLayout } from "@/features/digitalTwin/editor/api/layoutRepository";
import BuildingProperties from "@/features/digitalTwin/editor/components/BuildingProperties";
import DepthIndicator from "@/features/digitalTwin/editor/components/DepthIndicator";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import EquipmentLibrary from "@/features/digitalTwin/editor/components/EquipmentLibrary";
import EquipmentProperties from "@/features/digitalTwin/editor/components/EquipmentProperties";
import GridSettingsPanel from "@/features/digitalTwin/editor/components/GridSettingsPanel";
import HierarchyNavigator from "@/features/digitalTwin/editor/components/HierarchyNavigator";
import RoomLayoutProperties from "@/features/digitalTwin/editor/components/RoomLayoutProperties";
import SiteAuthoringPanel from "@/features/digitalTwin/editor/components/SiteAuthoringPanel";
import SiteObjectProperties from "@/features/digitalTwin/editor/components/SiteObjectProperties";
import WorldProperties from "@/features/digitalTwin/editor/components/WorldProperties";
import WorldStructureLibrary from "@/features/digitalTwin/editor/components/WorldStructureLibrary";
import WorldStructureProperties from "@/features/digitalTwin/editor/components/WorldStructureProperties";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { EDITOR_DEPTHS } from "@/features/digitalTwin/editor/constants/editorNavigation";
import { SITE_INTERACTION_MODES } from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import DigitalTwinScene from "@/features/digitalTwin/editor/three/DigitalTwinScene";
import FloorOverviewScene from "@/features/digitalTwin/editor/three/FloorOverviewScene";
import SiteOverviewScene from "@/features/digitalTwin/editor/three/SiteOverviewScene";

import styles from "./DigitalTwinEditorPage.module.css";

const DetailView = lazy(() => import("@/features/digitalTwin/editor/components/DetailView"));
const PartEditor = lazy(() => import("@/features/digitalTwin/editor/components/PartEditor"));

function isFormTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export default function DigitalTwinEditorPage() {
  const editor = useDigitalTwinEditorState();
  const { theme, toggleTheme } = useEditorTheme();
  const [saveStatus, setSaveStatus] = useState("");
  const [mobilePanel, setMobilePanel] = useState("library");
  const [detailViewEquipmentId, setDetailViewEquipmentId] = useState(null);
  const [partViewEquipmentId, setPartViewEquipmentId] = useState(null);
  const [selectedFloorRoomId, setSelectedFloorRoomId] = useState(null);
  const [siteAreaSelection, setSiteAreaSelection] = useState(null);
  const [siteInteractionMode, setSiteInteractionMode] = useState(SITE_INTERACTION_MODES.AREA_SELECT);
  const [activeSiteTemplateId, setActiveSiteTemplateId] = useState(null);
  const {
    addEquipment,
    updateEquipment,
    addEquipmentPart,
    updateEquipmentPart,
    duplicateEquipmentPart,
    removeEquipmentPart,
    commitPipeSnap,
    removeSelectedEquipment,
    duplicateSelectedEquipment,
    updateWorld,
    registerDetailAsset,
    removeDetailAsset,
    updateDetailAsset,
    resetLayout,
    hydrateLayout,
    addRoom,
    selectHierarchyNode,
    addHierarchyChild,
    addRoomToFloor,
    renameHierarchyNode,
    deleteHierarchyNode,
    updateBuilding,
    addSiteObjectFromArea,
    selectSiteObject,
    updateSiteObject,
    removeSelectedSiteObject,
    updateRoomLayout,
    selectBuilding,
    navigateToBuilding,
    selectFloorInBuilding,
    navigateToFloor,
    navigateToRoom,
    navigateToEquipment,
    navigateToNode,
    selectTemplate,
    toggleFavorite,
    setEditorMode,
    selectWorldTemplate,
    addWorldStructure,
    updateWorldStructure,
    selectWorldStructure,
    removeSelectedWorldStructure,
    duplicateSelectedWorldStructure,
    setWorldStructuresLocked,
    toggleVisibilityFilter,
    selectEquipment,
    clearSelection,
    setViewMode,
    setTransformMode,
    setSnapSize,
    setGridSnapEnabled,
    addGridRegion,
    updateGridRegion,
    removeGridRegion,
    undo,
  } = editor.actions;
  const detailViewEquipment = useMemo(
    () => editor.equipmentInstances.find((equipment) => equipment.id === detailViewEquipmentId) ?? null,
    [detailViewEquipmentId, editor.equipmentInstances],
  );
  const detailViewAsset = useMemo(
    () => editor.detailAssets.find((asset) => asset.id === detailViewEquipment?.detailAssetId) ?? null,
    [detailViewEquipment?.detailAssetId, editor.detailAssets],
  );
  const partViewEquipment = useMemo(
    () => editor.equipmentInstances.find((equipment) => equipment.id === partViewEquipmentId) ?? null,
    [editor.equipmentInstances, partViewEquipmentId],
  );
  const currentDepth = editor.navigationContext.currentDepth;
  const isFloorScope = currentDepth === EDITOR_DEPTHS.FLOOR;
  const isHierarchyScope = [EDITOR_DEPTHS.SITE, EDITOR_DEPTHS.BUILDING, EDITOR_DEPTHS.FLOOR]
    .includes(currentDepth);
  const selectedFloorId = currentDepth === EDITOR_DEPTHS.BUILDING
    ? editor.navigationContext.currentFloorId
    : null;
  const selectedBuildingFloorCount = editor.selectedBuilding
    ? editor.floors.filter((floor) => floor.parentId === editor.selectedBuilding.id).length
    : 0;
  const selectedFloor = isFloorScope ? editor.currentFloor : null;
  const floorRooms = selectedFloor
    ? editor.rooms.filter((room) => room.parentId === selectedFloor.id)
    : [];
  const selectedFloorRoom = floorRooms.find((room) => room.id === selectedFloorRoomId) ?? null;
  const selectedFloorRoomScene = selectedFloorRoom
    ? editor.layoutDocument.roomScenes[selectedFloorRoom.id]
    : null;
  const activeGridScopeId = isFloorScope
    ? selectedFloor.id
    : isHierarchyScope
      ? editor.hierarchy.rootId
      : editor.activeRoom?.id ?? editor.hierarchy.rootId;
  const activeGridScopeLabel = isFloorScope
    ? `${selectedFloor.name} 그리드`
    : isHierarchyScope
      ? "부지 그리드"
      : `${editor.activeRoom?.name ?? "공간"} 그리드`;

  const handleEquipmentChange = useCallback(
    (changes) => {
      if (editor.selectedEquipmentId) {
        updateEquipment(editor.selectedEquipmentId, changes);
      }
    },
    [editor.selectedEquipmentId, updateEquipment],
  );

  const handleEquipmentAdd = useCallback(
    (templateId, position) => {
      addEquipment(templateId, position);
      setMobilePanel("properties");
    },
    [addEquipment],
  );

  const handleEquipmentSelect = useCallback(
    (equipmentId) => {
      selectEquipment(equipmentId);

      if (equipmentId) {
        setMobilePanel("properties");
      }
    },
    [selectEquipment],
  );

  const handleTemplateSelect = useCallback(
    (templateId) => {
      selectTemplate(templateId);
      setMobilePanel("library");
    },
    [selectTemplate],
  );

  const handleWorldStructureChange = useCallback(
    (changes) => {
      if (editor.selectedWorldStructureId) {
        updateWorldStructure(editor.selectedWorldStructureId, changes);
      }
    },
    [editor.selectedWorldStructureId, updateWorldStructure],
  );

  const handleWorldStructureAdd = useCallback(
    (templateId, position) => {
      addWorldStructure(templateId, position);
      setMobilePanel("properties");
    },
    [addWorldStructure],
  );

  const handleWorldStructureSelect = useCallback(
    (structureId) => {
      selectWorldStructure(structureId);
      if (structureId) setMobilePanel("properties");
    },
    [selectWorldStructure],
  );

  const handleBuildingChange = useCallback((changes) => {
    if (editor.selectedBuilding) updateBuilding(editor.selectedBuilding.id, changes);
  }, [editor.selectedBuilding, updateBuilding]);

  const handleSiteObjectChange = useCallback((changes) => {
    if (editor.selectedSiteObjectId) updateSiteObject(editor.selectedSiteObjectId, changes);
  }, [editor.selectedSiteObjectId, updateSiteObject]);

  const handleSiteInteractionModeChange = useCallback((mode) => {
    setSiteInteractionMode(mode);
    setActiveSiteTemplateId(null);
    setSiteAreaSelection(null);
    selectBuilding(null);
    selectSiteObject(null);
  }, [selectBuilding, selectSiteObject]);

  const handleSiteTemplateSelect = useCallback((templateId) => {
    if (siteAreaSelection) {
      addSiteObjectFromArea(templateId, siteAreaSelection);
      setSiteAreaSelection(null);
      setActiveSiteTemplateId(null);
      setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
      return;
    }
    const isSameTemplate = siteInteractionMode === SITE_INTERACTION_MODES.PLACE_OBJECT
      && activeSiteTemplateId === templateId;
    setActiveSiteTemplateId(isSameTemplate ? null : templateId);
    setSiteInteractionMode(isSameTemplate ? SITE_INTERACTION_MODES.NAVIGATE : SITE_INTERACTION_MODES.PLACE_OBJECT);
    selectBuilding(null);
    selectSiteObject(null);
  }, [activeSiteTemplateId, addSiteObjectFromArea, selectBuilding, selectSiteObject, siteAreaSelection, siteInteractionMode]);

  const handleSiteTemplatePlace = useCallback((templateId, area) => {
    if (!templateId || !area) return;
    addSiteObjectFromArea(templateId, area);
  }, [addSiteObjectFromArea]);

  const handleSiteBuildingSelect = useCallback((buildingId) => {
    setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
    setActiveSiteTemplateId(null);
    setSiteAreaSelection(null);
    selectBuilding(buildingId);
  }, [selectBuilding]);

  const handleEnterBuilding = useCallback((buildingId) => {
    setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
    setActiveSiteTemplateId(null);
    setSiteAreaSelection(null);
    navigateToBuilding(buildingId);
  }, [navigateToBuilding]);

  const handleSiteObjectSelect = useCallback((objectId) => {
    setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
    setActiveSiteTemplateId(null);
    setSiteAreaSelection(null);
    selectSiteObject(objectId);
  }, [selectSiteObject]);

  const handleFloorRoomChange = useCallback((changes) => {
    if (selectedFloorRoom) updateRoomLayout(selectedFloorRoom.id, changes);
  }, [selectedFloorRoom, updateRoomLayout]);

  const handleFloorRoomAdd = useCallback(() => {
    if (!selectedFloor) return;
    const roomId = addRoomToFloor(selectedFloor.id);
    if (roomId) setSelectedFloorRoomId(roomId);
  }, [addRoomToFloor, selectedFloor]);

  const handleEditorModeChange = useCallback((mode) => {
    setEditorMode(mode);
    if (mode !== EDITOR_MODES.VIEWER) setMobilePanel("library");
  }, [setEditorMode]);

  const toggleMobilePanel = useCallback((panel) => {
    setMobilePanel((currentPanel) =>
      currentPanel === panel ? null : panel,
    );
  }, []);

  const handleSave = useCallback(() => {
    try {
      const payload = saveLayout(editor.layoutDocument);
      const savedTime = new Date(payload.savedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setSaveStatus(`공간 ${editor.rooms.length}개 · ${savedTime}`);
    } catch {
      setSaveStatus("저장하지 못했습니다");
    }
  }, [editor.layoutDocument, editor.rooms.length]);

  const handleLoad = useCallback(() => {
    try {
      const savedLayout = loadLayout();

      if (!savedLayout) {
        setSaveStatus("저장된 배치가 없습니다");
        return;
      }

      const didLoad = hydrateLayout(savedLayout);
      setSaveStatus(didLoad ? "저장된 배치를 불러왔습니다" : "잘못된 배치 데이터입니다");
    } catch {
      setSaveStatus("배치를 불러오지 못했습니다");
    }
  }, [hydrateLayout]);

  const handleReset = useCallback(() => {
    resetLayout();
    setSiteAreaSelection(null);
    setActiveSiteTemplateId(null);
    setSiteInteractionMode(SITE_INTERACTION_MODES.AREA_SELECT);
    setSaveStatus("새 배치로 초기화했습니다");
  }, [resetLayout]);

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      if (event.key === "Escape") {
        setActiveSiteTemplateId(null);
        setSiteAreaSelection(null);
        setSiteInteractionMode(SITE_INTERACTION_MODES.NAVIGATE);
        clearSelection();
        return;
      }

      if (isFormTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (isHierarchyScope) {
          if (editor.selectedSiteObject) removeSelectedSiteObject();
          else if (editor.selectedBuilding) deleteHierarchyNode(editor.selectedBuilding.id);
          return;
        }
        event.preventDefault();
        if (editor.editorMode === EDITOR_MODES.WORLD) removeSelectedWorldStructure();
        if (editor.editorMode === EDITOR_MODES.EQUIPMENT) removeSelectedEquipment();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        if (isHierarchyScope) return;
        event.preventDefault();
        if (editor.editorMode === EDITOR_MODES.WORLD) duplicateSelectedWorldStructure();
        if (editor.editorMode === EDITOR_MODES.EQUIPMENT) duplicateSelectedEquipment();
      }

      if (event.key.toLowerCase() === "w") {
        setTransformMode("translate");
      }

      if (event.key.toLowerCase() === "e") {
        setTransformMode("rotate");
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    clearSelection,
    duplicateSelectedEquipment,
    duplicateSelectedWorldStructure,
    editor.editorMode,
    editor.selectedBuilding,
    editor.selectedSiteObject,
    isHierarchyScope,
    deleteHierarchyNode,
    removeSelectedEquipment,
    removeSelectedSiteObject,
    removeSelectedWorldStructure,
    setTransformMode,
    undo,
  ]);

  return (
    <main className={`${styles.editor} ${editor.editorMode === EDITOR_MODES.VIEWER ? styles.viewerMode : ""}`}>
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true">
          DT
        </div>
        <div className={styles.titleBlock}>
          <span>월드 / {editor.navigationPath.at(-1)?.name ?? "부지"}</span>
          <h1>디지털 트윈 에디터</h1>
        </div>
        <HierarchyNavigator
          hierarchy={editor.hierarchy}
          path={editor.navigationPath}
          rooms={editor.rooms}
          protectedNodeIds={editor.protectedHierarchyNodeIds}
          showQuickAddRoom={!isHierarchyScope}
          onRoomChange={navigateToRoom}
          onNavigateNode={navigateToNode}
          onAddRoom={addRoom}
          onSelectNode={selectHierarchyNode}
          onAddChild={addHierarchyChild}
          onRenameNode={renameHierarchyNode}
          onDeleteNode={deleteHierarchyNode}
        />
        <div className={styles.headerMeta}>
          {isHierarchyScope ? (
            <>
              <span>건물 {String(editor.buildings.length).padStart(2, "0")}</span>
              <span>층 {String(editor.floors.length).padStart(2, "0")}</span>
            </>
          ) : (
            <>
              <span>공간 {editor.world.width.toFixed(1)} × {editor.world.depth.toFixed(1)} m</span>
              <span>설비 {String(editor.equipmentInstances.length).padStart(2, "0")}</span>
              <span>구조물 {String(editor.worldStructures.length).padStart(2, "0")}</span>
            </>
          )}
          <span className={styles.connectionStatus}>로컬 초안</span>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          aria-label={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 모드로 전환`}
          title={`${theme === EDITOR_THEMES.DARK ? "라이트" : "다크"} 모드`}
          onClick={toggleTheme}
        >
          <span aria-hidden="true">
            {theme === EDITOR_THEMES.DARK ? "☾" : "☀"}
          </span>
          {theme === EDITOR_THEMES.DARK ? "다크" : "라이트"}
        </button>
      </header>

      <div
        className={`${styles.workspace} ${mobilePanel ? "" : styles.panelClosed} ${editor.editorMode === EDITOR_MODES.VIEWER ? styles.viewerWorkspace : ""} ${isHierarchyScope ? styles.hierarchyWorkspace : ""}`}
      >
        {!isHierarchyScope && editor.editorMode !== EDITOR_MODES.VIEWER && (
          <aside className={`${styles.leftPanel} ${mobilePanel === "library" ? styles.mobilePanelActive : styles.mobilePanelInactive}`}>
            {editor.editorMode === EDITOR_MODES.WORLD ? (
              <>
                <WorldStructureLibrary
                  activeTemplateId={editor.activeWorldTemplateId}
                  structures={editor.worldStructures}
                  equipment={editor.equipmentInstances}
                  selectedStructureId={editor.selectedWorldStructureId}
                  visibilityFilters={editor.visibilityFilters}
                  worldLocked={editor.worldStructuresLocked}
                  onSelectTemplate={selectWorldTemplate}
                  onSelectStructure={handleWorldStructureSelect}
                  onSelectEquipment={(equipmentId) => {
                    handleEditorModeChange(EDITOR_MODES.EQUIPMENT);
                    selectEquipment(equipmentId);
                  }}
                  onToggleVisibility={toggleVisibilityFilter}
                  onToggleWorldLock={setWorldStructuresLocked}
                />
                <WorldProperties world={editor.world} onChange={updateWorld} />
                <GridSettingsPanel
                  gridSettings={editor.gridSettings}
                  scopeId={activeGridScopeId}
                  scopeLabel={activeGridScopeLabel}
                  onToggle={setGridSnapEnabled}
                  onBaseSizeChange={setSnapSize}
                  onAddRegion={addGridRegion}
                  onUpdateRegion={updateGridRegion}
                  onRemoveRegion={removeGridRegion}
                />
              </>
            ) : (
              <EquipmentLibrary
                activeTemplateId={editor.activeTemplateId}
                favoriteTemplateIds={editor.favoriteTemplateIds}
                recentTemplateIds={editor.recentTemplateIds}
                onSelect={handleTemplateSelect}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </aside>
        )}

        <div className={styles.sceneArea}>
          <div key={currentDepth} className={styles.sceneTransition}>
            {isFloorScope ? <FloorOverviewScene
            building={editor.currentBuilding}
            floor={selectedFloor}
            rooms={floorRooms}
            roomScenes={editor.layoutDocument.roomScenes}
            selectedRoomId={selectedFloorRoom?.id ?? null}
            theme={theme}
            transformMode={editor.transformMode}
            gridSettings={editor.gridSettings}
            gridScopeId={activeGridScopeId}
            onSelectRoom={setSelectedFloorRoomId}
            onUpdateRoom={updateRoomLayout}
            onEnterRoom={navigateToRoom}
          /> : isHierarchyScope ? <SiteOverviewScene
            buildings={editor.buildings}
            floors={editor.floors}
            siteObjects={editor.siteObjects}
            selectedBuildingId={editor.selectedBuilding?.id ?? null}
            selectedSiteObjectId={editor.selectedSiteObjectId}
            selectedFloorId={selectedFloorId}
            focusedBuildingId={currentDepth === EDITOR_DEPTHS.BUILDING ? editor.navigationContext.currentBuildingId : null}
            focusRequestKey={editor.navigationContext.transitionId}
            interactionMode={siteInteractionMode}
            placementTemplateId={activeSiteTemplateId}
            areaSelection={siteAreaSelection}
            theme={theme}
            transformMode={editor.transformMode}
            gridSettings={editor.gridSettings}
            gridScopeId={activeGridScopeId}
            onSelectBuilding={handleSiteBuildingSelect}
            onSelectSiteObject={handleSiteObjectSelect}
            onUpdateBuilding={updateBuilding}
            onUpdateSiteObject={updateSiteObject}
            onEnterBuilding={handleEnterBuilding}
            onSelectFloor={selectFloorInBuilding}
            onEnterFloor={navigateToFloor}
            onAreaSelectionChange={setSiteAreaSelection}
            onPlaceTemplate={handleSiteTemplatePlace}
          /> : <DigitalTwinScene
            world={editor.world}
            editorMode={editor.editorMode}
            worldStructures={editor.worldStructures}
            equipmentInstances={editor.equipmentInstances}
            selectedWorldStructureId={editor.selectedWorldStructureId}
            selectedEquipmentId={editor.selectedEquipmentId}
            activeWorldTemplateId={editor.activeWorldTemplateId}
            activeTemplateId={editor.activeTemplateId}
            worldStructuresLocked={editor.worldStructuresLocked}
            visibilityFilters={editor.visibilityFilters}
            theme={theme}
            viewMode={editor.viewMode}
            transformMode={editor.transformMode}
            gridSettings={editor.gridSettings}
            gridScopeId={activeGridScopeId}
            collisionIds={editor.collisionIds}
            pipeConnections={editor.pipeConnections}
            pipeSnapCandidate={editor.pipeSnapCandidate}
            onEquipmentAdd={handleEquipmentAdd}
            onEquipmentSelect={handleEquipmentSelect}
            onEquipmentTransform={updateEquipment}
            onEquipmentTransformEnd={commitPipeSnap}
            onWorldStructureAdd={handleWorldStructureAdd}
            onWorldStructureSelect={handleWorldStructureSelect}
            onWorldStructureTransform={updateWorldStructure}
          />}
          </div>
          <DepthIndicator depth={currentDepth} path={editor.navigationPath} />
          <EditorToolbar
            hierarchyScope={isHierarchyScope}
            hierarchyScopeLabel={isFloorScope ? "층 편집" : "부지 편집"}
            showSiteInteractionTools={isHierarchyScope && !isFloorScope}
            siteInteractionMode={siteInteractionMode}
            editorMode={editor.editorMode}
            viewMode={editor.viewMode}
            transformMode={editor.transformMode}
            snapSize={editor.snapSize}
            gridSnapEnabled={editor.gridSettings.enabled}
            hasSelection={isFloorScope ? Boolean(selectedFloorRoom) : isHierarchyScope ? Boolean(editor.selectedBuilding || editor.selectedSiteObject) : Boolean(editor.selectedEquipment || editor.selectedWorldStructure)}
            worldLocked={editor.worldStructuresLocked}
            saveStatus={saveStatus}
            canUndo={editor.canUndo}
            onEditorModeChange={handleEditorModeChange}
            onSiteInteractionModeChange={handleSiteInteractionModeChange}
            onViewModeChange={setViewMode}
            onTransformModeChange={setTransformMode}
            onSnapSizeChange={setSnapSize}
            onGridSnapChange={setGridSnapEnabled}
            onToggleWorldLock={setWorldStructuresLocked}
            onDuplicate={editor.editorMode === EDITOR_MODES.WORLD ? duplicateSelectedWorldStructure : duplicateSelectedEquipment}
            onDelete={isHierarchyScope
              ? editor.selectedSiteObject
                ? removeSelectedSiteObject
                : () => editor.selectedBuilding && deleteHierarchyNode(editor.selectedBuilding.id)
              : editor.editorMode === EDITOR_MODES.WORLD ? removeSelectedWorldStructure : removeSelectedEquipment}
            onReset={handleReset}
            onLoad={handleLoad}
            onSave={handleSave}
            onUndo={undo}
          />
        </div>

        {!isHierarchyScope && editor.editorMode !== EDITOR_MODES.VIEWER && <nav className={styles.mobilePanelTabs} aria-label="에디터 패널">
          <button
            type="button"
            className={mobilePanel === "library" ? styles.activeTab : ""}
            aria-expanded={mobilePanel === "library"}
            onClick={() => toggleMobilePanel("library")}
          >
            {editor.editorMode === EDITOR_MODES.WORLD ? "월드 도구" : "오브젝트 목록"}
          </button>
          <button
            type="button"
            className={mobilePanel === "properties" ? styles.activeTab : ""}
            aria-expanded={mobilePanel === "properties"}
            onClick={() => toggleMobilePanel("properties")}
          >
            속성
            {(editor.selectedEquipment || editor.selectedWorldStructure) && <span className={styles.tabIndicator} />}
          </button>
        </nav>}

        {isHierarchyScope ? <aside className={`${styles.rightPanel} ${styles.hierarchyProperties}`}>
          {isFloorScope ? <RoomLayoutProperties
            room={selectedFloorRoom}
            scene={selectedFloorRoomScene}
            roomCount={floorRooms.length}
            onChange={handleFloorRoomChange}
            onAddRoom={handleFloorRoomAdd}
            onEnterRoom={navigateToRoom}
          /> : <>
            <SiteAuthoringPanel
              areaSelection={siteAreaSelection}
              activeTemplateId={activeSiteTemplateId}
              buildings={editor.buildings}
              siteObjects={editor.siteObjects}
              selectedSiteObjectId={editor.selectedSiteObjectId}
              onClearArea={() => {
                setSiteAreaSelection(null);
                setActiveSiteTemplateId(null);
                setSiteInteractionMode(SITE_INTERACTION_MODES.AREA_SELECT);
              }}
              onSelectTemplate={handleSiteTemplateSelect}
              onSelectSiteObject={handleSiteObjectSelect}
            />
            {editor.selectedBuilding ? <BuildingProperties
              building={editor.selectedBuilding}
              floorCount={selectedBuildingFloorCount}
              onChange={handleBuildingChange}
              onAddFloor={() => updateBuilding(editor.selectedBuilding.id, {
                parameters: { floorCount: selectedBuildingFloorCount + 1 },
              })}
              onEnter={() => handleEnterBuilding(editor.selectedBuilding.id)}
            /> : null}
            <SiteObjectProperties
              object={editor.selectedSiteObject}
              onChange={handleSiteObjectChange}
              onDelete={removeSelectedSiteObject}
            />
          </>}
          <GridSettingsPanel
            gridSettings={editor.gridSettings}
            scopeId={activeGridScopeId}
            scopeLabel={activeGridScopeLabel}
            onToggle={setGridSnapEnabled}
            onBaseSizeChange={setSnapSize}
            onAddRegion={addGridRegion}
            onUpdateRegion={updateGridRegion}
            onRemoveRegion={removeGridRegion}
          />
        </aside> : editor.editorMode !== EDITOR_MODES.VIEWER && <aside
          className={`${styles.rightPanel} ${mobilePanel === "properties" ? styles.mobilePanelActive : styles.mobilePanelInactive}`}
        >
          {editor.editorMode === EDITOR_MODES.WORLD ? (
            <WorldStructureProperties
              structure={editor.selectedWorldStructure}
              spaces={editor.worldSpaces}
              worldLocked={editor.worldStructuresLocked}
              onChange={handleWorldStructureChange}
            />
          ) : <EquipmentProperties
            equipment={editor.selectedEquipment}
            detailAsset={editor.selectedDetailAsset}
            hasCollision={editor.collisionIds.has(editor.selectedEquipmentId)}
            snapCandidate={editor.pipeSnapCandidate}
            onChange={handleEquipmentChange}
            onUpload={(file) => registerDetailAsset(editor.selectedEquipmentId, file)}
            onRemoveAsset={() => removeDetailAsset(editor.selectedEquipmentId)}
            onPreview={() => {
              navigateToEquipment(editor.selectedEquipmentId);
              setDetailViewEquipmentId(editor.selectedEquipmentId);
            }}
            onUpdateAsset={(changes) => updateDetailAsset(editor.selectedDetailAsset.id, changes)}
            onSnap={() => commitPipeSnap(editor.selectedEquipmentId)}
            onOpenPartEditor={() => {
              navigateToEquipment(editor.selectedEquipmentId);
              setPartViewEquipmentId(editor.selectedEquipmentId);
            }}
          />}
        </aside>}
      </div>

      {detailViewEquipment && detailViewAsset && (
        <Suspense fallback={<div className={styles.detailLoading}>상세 보기를 준비하는 중…</div>}>
          <DetailView
            equipment={detailViewEquipment}
            asset={detailViewAsset}
            onClose={() => {
              setDetailViewEquipmentId(null);
              if (editor.navigationContext.currentRoomId) navigateToRoom(editor.navigationContext.currentRoomId);
            }}
          />
        </Suspense>
      )}
      {partViewEquipment ? (
        <Suspense fallback={<div className={styles.detailLoading}>파트 편집기를 준비하는 중…</div>}>
          <PartEditor
            equipment={partViewEquipment}
            theme={theme}
            gridSettings={editor.gridSettings}
            onGridSnapChange={setGridSnapEnabled}
            onGridSizeChange={setSnapSize}
            onClose={() => {
              setPartViewEquipmentId(null);
              if (editor.navigationContext.currentRoomId) navigateToRoom(editor.navigationContext.currentRoomId);
            }}
            onAddPart={addEquipmentPart}
            onUpdatePart={updateEquipmentPart}
            onDuplicatePart={duplicateEquipmentPart}
            onRemovePart={removeEquipmentPart}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
