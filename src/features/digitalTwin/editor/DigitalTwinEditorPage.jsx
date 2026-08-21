import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { loadLayout, saveLayout } from "@/features/digitalTwin/editor/api/layoutRepository";
import EditorToolbar from "@/features/digitalTwin/editor/components/EditorToolbar";
import EquipmentLibrary from "@/features/digitalTwin/editor/components/EquipmentLibrary";
import EquipmentProperties from "@/features/digitalTwin/editor/components/EquipmentProperties";
import WorldProperties from "@/features/digitalTwin/editor/components/WorldProperties";
import WorldStructureLibrary from "@/features/digitalTwin/editor/components/WorldStructureLibrary";
import WorldStructureProperties from "@/features/digitalTwin/editor/components/WorldStructureProperties";
import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import useDigitalTwinEditorState from "@/features/digitalTwin/editor/store/useDigitalTwinEditorState";
import useEditorTheme from "@/features/digitalTwin/editor/store/useEditorTheme";
import DigitalTwinScene from "@/features/digitalTwin/editor/three/DigitalTwinScene";

import styles from "./DigitalTwinEditorPage.module.css";

const DetailView = lazy(() => import("@/features/digitalTwin/editor/components/DetailView"));

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
  const {
    addEquipment,
    updateEquipment,
    commitPipeSnap,
    removeSelectedEquipment,
    duplicateSelectedEquipment,
    updateWorld,
    registerDetailAsset,
    removeDetailAsset,
    updateDetailAsset,
    resetLayout,
    hydrateLayout,
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
  } = editor.actions;
  const detailViewEquipment = useMemo(
    () => editor.equipmentInstances.find((equipment) => equipment.id === detailViewEquipmentId) ?? null,
    [detailViewEquipmentId, editor.equipmentInstances],
  );
  const detailViewAsset = useMemo(
    () => editor.detailAssets.find((asset) => asset.id === detailViewEquipment?.detailAssetId) ?? null,
    [detailViewEquipment?.detailAssetId, editor.detailAssets],
  );

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
      const payload = saveLayout({
        world: editor.world,
        equipmentInstances: editor.equipmentInstances,
        pipeConnections: editor.pipeConnections,
        detailAssets: editor.detailAssets,
        worldStructures: editor.worldStructures,
        worldStructuresLocked: editor.worldStructuresLocked,
        visibilityFilters: editor.visibilityFilters,
      });
      const savedTime = new Date(payload.savedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setSaveStatus(`${editor.worldStructures.length} World · ${editor.equipmentInstances.length} Equipment · ${savedTime}`);
    } catch {
      setSaveStatus("저장하지 못했습니다");
    }
  }, [editor.detailAssets, editor.equipmentInstances, editor.pipeConnections, editor.visibilityFilters, editor.world, editor.worldStructures, editor.worldStructuresLocked]);

  const handleLoad = useCallback(() => {
    try {
      const savedLayout = loadLayout();

      if (!savedLayout) {
        setSaveStatus("저장된 Layout이 없습니다");
        return;
      }

      const didLoad = hydrateLayout(savedLayout);
      setSaveStatus(didLoad ? "저장된 Layout을 불러왔습니다" : "잘못된 Layout입니다");
    } catch {
      setSaveStatus("Layout을 불러오지 못했습니다");
    }
  }, [hydrateLayout]);

  const handleReset = useCallback(() => {
    resetLayout();
    setSaveStatus("새 Layout으로 초기화했습니다");
  }, [resetLayout]);

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      if (event.key === "Escape") {
        clearSelection();
        return;
      }

      if (isFormTarget(event.target)) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (editor.editorMode === EDITOR_MODES.WORLD) removeSelectedWorldStructure();
        if (editor.editorMode === EDITOR_MODES.EQUIPMENT) removeSelectedEquipment();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
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
    removeSelectedEquipment,
    removeSelectedWorldStructure,
    setTransformMode,
  ]);

  return (
    <main className={`${styles.editor} ${editor.editorMode === EDITOR_MODES.VIEWER ? styles.viewerMode : ""}`}>
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true">
          DT
        </div>
        <div className={styles.titleBlock}>
          <span>WORLD / MACHINE ROOM</span>
          <h1>Digital Twin Editor</h1>
        </div>
        <div className={styles.headerMeta}>
          <span>
            ROOM {editor.world.width.toFixed(1)} × {editor.world.depth.toFixed(1)} M
          </span>
          <span>EQUIPMENT {String(editor.equipmentInstances.length).padStart(2, "0")}</span>
          <span>STRUCTURE {String(editor.worldStructures.length).padStart(2, "0")}</span>
          <span className={styles.connectionStatus}>LOCAL DRAFT</span>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          aria-label={`${theme === EDITOR_THEMES.DARK ? "Light" : "Dark"} Mode로 전환`}
          title={`${theme === EDITOR_THEMES.DARK ? "Light" : "Dark"} Mode`}
          onClick={toggleTheme}
        >
          <span aria-hidden="true">
            {theme === EDITOR_THEMES.DARK ? "☾" : "☀"}
          </span>
          {theme === EDITOR_THEMES.DARK ? "Dark" : "Light"}
        </button>
      </header>

      <div
        className={`${styles.workspace} ${mobilePanel ? "" : styles.panelClosed} ${editor.editorMode === EDITOR_MODES.VIEWER ? styles.viewerWorkspace : ""}`}
      >
        {editor.editorMode !== EDITOR_MODES.VIEWER && (
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
          <DigitalTwinScene
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
            snapSize={editor.snapSize}
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
          />
        </div>

        {editor.editorMode !== EDITOR_MODES.VIEWER && <nav className={styles.mobilePanelTabs} aria-label="Editor panels">
          <button
            type="button"
            className={mobilePanel === "library" ? styles.activeTab : ""}
            aria-expanded={mobilePanel === "library"}
            onClick={() => toggleMobilePanel("library")}
          >
            {editor.editorMode === EDITOR_MODES.WORLD ? "World Tools" : "Object Library"}
          </button>
          <button
            type="button"
            className={mobilePanel === "properties" ? styles.activeTab : ""}
            aria-expanded={mobilePanel === "properties"}
            onClick={() => toggleMobilePanel("properties")}
          >
            Properties
            {(editor.selectedEquipment || editor.selectedWorldStructure) && <span className={styles.tabIndicator} />}
          </button>
        </nav>}

        {editor.editorMode !== EDITOR_MODES.VIEWER && <aside
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
            onPreview={() => setDetailViewEquipmentId(editor.selectedEquipmentId)}
            onUpdateAsset={(changes) => updateDetailAsset(editor.selectedDetailAsset.id, changes)}
            onSnap={() => commitPipeSnap(editor.selectedEquipmentId)}
          />}
        </aside>}
      </div>

      <EditorToolbar
        editorMode={editor.editorMode}
        viewMode={editor.viewMode}
        transformMode={editor.transformMode}
        snapSize={editor.snapSize}
        hasSelection={Boolean(editor.selectedEquipment || editor.selectedWorldStructure)}
        worldLocked={editor.worldStructuresLocked}
        saveStatus={saveStatus}
        onEditorModeChange={handleEditorModeChange}
        onViewModeChange={setViewMode}
        onTransformModeChange={setTransformMode}
        onSnapSizeChange={setSnapSize}
        onToggleWorldLock={setWorldStructuresLocked}
        onDuplicate={editor.editorMode === EDITOR_MODES.WORLD ? duplicateSelectedWorldStructure : duplicateSelectedEquipment}
        onDelete={editor.editorMode === EDITOR_MODES.WORLD ? removeSelectedWorldStructure : removeSelectedEquipment}
        onReset={handleReset}
        onLoad={handleLoad}
        onSave={handleSave}
      />
      {detailViewEquipment && detailViewAsset && (
        <Suspense fallback={<div className={styles.detailLoading}>Detail View를 준비하는 중…</div>}>
          <DetailView
            equipment={detailViewEquipment}
            asset={detailViewAsset}
            onClose={() => setDetailViewEquipmentId(null)}
          />
        </Suspense>
      )}
    </main>
  );
}
