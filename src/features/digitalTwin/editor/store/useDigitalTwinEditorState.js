import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_WORLD,
  EQUIPMENT_SHAPE_TEMPLATE_MAP,
  TRANSFORM_MODES,
  VIEW_MODES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  clampDimension,
  clampPositionToWorld,
  findCollidingEquipmentIds,
  snapValue,
} from "@/features/digitalTwin/editor/utils/editorMath";
import {
  findPipeSnapCandidate,
  resolvePipeSnap,
} from "@/features/digitalTwin/editor/utils/pipeConnections";
import {
  createTemplateInstanceDefaults,
  getDimensionsFromParameters,
  normalizeEquipmentInstance,
} from "@/features/digitalTwin/editor/utils/templateParameters";
import useWorldStructureState from "@/features/digitalTwin/editor/store/useWorldStructureState";

const FAVORITES_KEY = "digital-twin-editor-favorites";
const RECENT_KEY = "digital-twin-editor-recent-templates";
const SUPPORTED_SCAN_FORMATS = new Set(["glb", "gltf", "obj", "ply"]);

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function mergeEquipment(equipment, changes) {
  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[
    changes.shapeTemplateId ?? equipment.shapeTemplateId
  ];

  if (!template) return equipment;

  if (changes.shapeTemplateId && changes.shapeTemplateId !== equipment.shapeTemplateId) {
    return normalizeEquipmentInstance(
      {
        ...equipment,
        ...createTemplateInstanceDefaults(template),
        ...changes,
        shapeTemplateId: template.id,
      },
      template,
    );
  }

  const parameters = changes.parameters
    ? { ...equipment.parameters, ...changes.parameters }
    : equipment.parameters;
  const dimensions = changes.parameters
    ? getDimensionsFromParameters(template, parameters)
    : changes.dimensions
      ? { ...equipment.dimensions, ...changes.dimensions }
      : equipment.dimensions;

  return {
    ...equipment,
    ...changes,
    parameters,
    dimensions,
    appearance: changes.appearance
      ? { ...equipment.appearance, ...changes.appearance }
      : equipment.appearance,
    position: changes.position
      ? { ...equipment.position, ...changes.position }
      : equipment.position,
    rotation: changes.rotation
      ? { ...equipment.rotation, ...changes.rotation }
      : equipment.rotation,
  };
}

function sanitizeHydratedAsset(asset) {
  return {
    ...asset,
    objectUrl: null,
    status: asset.status === "READY" ? "MISSING_LOCAL_FILE" : asset.status,
    uploadProgress: 0,
  };
}

export default function useDigitalTwinEditorState() {
  const [world, setWorld] = useState(DEFAULT_WORLD);
  const [equipmentInstances, setEquipmentInstances] = useState([]);
  const [detailAssets, setDetailAssets] = useState([]);
  const [pipeConnections, setPipeConnections] = useState([]);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState(() => readStoredList(FAVORITES_KEY));
  const [recentTemplateIds, setRecentTemplateIds] = useState(() => readStoredList(RECENT_KEY));
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [viewMode, setViewMode] = useState(VIEW_MODES.VIEW_3D);
  const [transformMode, setTransformMode] = useState(TRANSFORM_MODES.TRANSLATE);
  const [snapSize, setSnapSize] = useState(0.1);
  const scanTimersRef = useRef(new Map());
  const structureEditor = useWorldStructureState({ snapSize });
  const {
    setEditorMode: setStructureEditorMode,
    selectWorldTemplate,
    addWorldStructure,
    updateWorldStructure,
    selectWorldStructure: selectWorldStructureState,
    removeSelectedWorldStructure,
    duplicateSelectedWorldStructure,
    setWorldStructuresLocked,
    toggleVisibilityFilter,
    hydrateWorldStructures,
    resetWorldStructures,
  } = structureEditor.actions;

  useEffect(
    () => () => {
      scanTimersRef.current.forEach((timerIds) => timerIds.forEach(clearTimeout));
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteTemplateIds));
  }, [favoriteTemplateIds]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentTemplateIds));
  }, [recentTemplateIds]);

  const selectedEquipment = useMemo(
    () => equipmentInstances.find((equipment) => equipment.id === selectedEquipmentId) ?? null,
    [equipmentInstances, selectedEquipmentId],
  );
  const selectedDetailAsset = useMemo(
    () => detailAssets.find((asset) => asset.id === selectedEquipment?.detailAssetId) ?? null,
    [detailAssets, selectedEquipment?.detailAssetId],
  );
  const collisionIds = useMemo(
    () => findCollidingEquipmentIds(equipmentInstances),
    [equipmentInstances],
  );
  const pipeSnapCandidate = useMemo(
    () => selectedEquipment
      ? findPipeSnapCandidate(selectedEquipment, equipmentInstances, pipeConnections)
      : null,
    [equipmentInstances, pipeConnections, selectedEquipment],
  );

  const rememberTemplate = useCallback((templateId) => {
    setRecentTemplateIds((currentIds) =>
      [templateId, ...currentIds.filter((id) => id !== templateId)].slice(0, 8),
    );
  }, []);

  const addEquipment = useCallback(
    (templateId, floorPosition) => {
      const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[templateId];
      if (!template) return;

      const id = createId("WORLD_OBJECT");
      setEquipmentInstances((currentEquipment) => {
        const categoryCount = currentEquipment.filter(
          (equipment) => equipment.category === template.category,
        ).length;
        const sequence = String(categoryCount + 1).padStart(2, "0");
        const defaults = createTemplateInstanceDefaults(template);
        const snappedPosition = {
          x: snapValue(floorPosition.x, snapSize),
          y: 0,
          z: snapValue(floorPosition.z, snapSize),
        };

        return [
          ...currentEquipment,
          {
            id,
            name: `${template.nameKo} ${sequence}`,
            shapeTemplateId: template.id,
            ...defaults,
            position: clampPositionToWorld(snappedPosition, defaults.dimensions, world),
            rotation: { x: 0, y: 0, z: 0 },
            detailAssetId: null,
            visible: true,
            locked: false,
            groundSurfaceId: "FLOOR",
          },
        ];
      });
      rememberTemplate(templateId);
      setSelectedEquipmentId(id);
      setActiveTemplateId(null);
    },
    [rememberTemplate, snapSize, world],
  );

  const updateEquipment = useCallback((equipmentId, changes) => {
    setEquipmentInstances((currentEquipment) =>
      currentEquipment.map((equipment) => {
        if (equipment.id !== equipmentId) return equipment;

        const nextEquipment = mergeEquipment(equipment, changes);
        const dimensions = Object.fromEntries(
          Object.entries(nextEquipment.dimensions).map(([key, value]) => [key, clampDimension(value)]),
        );

        return { ...nextEquipment, dimensions, position: { ...nextEquipment.position } };
      }),
    );

    if (changes.position || changes.rotation || changes.parameters || changes.dimensions) {
      setPipeConnections((connections) =>
        connections.filter(
          (connection) => connection.fromEquipmentId !== equipmentId && connection.toEquipmentId !== equipmentId,
        ),
      );
    }
  }, []);

  const commitPipeSnap = useCallback(
    (equipmentId) => {
      if (!pipeSnapCandidate || pipeSnapCandidate.movingPoint.equipmentId !== equipmentId) return false;

      const equipment = equipmentInstances.find((item) => item.id === equipmentId);
      if (!equipment) return false;

      const resolved = resolvePipeSnap(equipment, pipeSnapCandidate);
      setEquipmentInstances((items) =>
        items.map((item) => item.id === equipmentId ? mergeEquipment(item, resolved) : item),
      );
      setPipeConnections((connections) => [
        ...connections.filter(
          (connection) => connection.fromEquipmentId !== equipmentId && connection.toEquipmentId !== equipmentId,
        ),
        {
          id: createId("PIPE_CONNECTION"),
          fromEquipmentId: equipmentId,
          fromPointId: pipeSnapCandidate.movingPoint.id,
          toEquipmentId: pipeSnapCandidate.targetPoint.equipmentId,
          toPointId: pipeSnapCandidate.targetPoint.id,
        },
      ]);
      return true;
    },
    [equipmentInstances, pipeSnapCandidate],
  );

  const removeSelectedEquipment = useCallback(() => {
    if (!selectedEquipmentId) return;

    setEquipmentInstances((items) => items.filter((equipment) => equipment.id !== selectedEquipmentId));
    setPipeConnections((connections) =>
      connections.filter(
        (connection) => connection.fromEquipmentId !== selectedEquipmentId && connection.toEquipmentId !== selectedEquipmentId,
      ),
    );
    setSelectedEquipmentId(null);
  }, [selectedEquipmentId]);

  const duplicateSelectedEquipment = useCallback(() => {
    if (!selectedEquipment) return;

    const duplicateId = createId("WORLD_OBJECT");
    const offset = Math.max(snapSize, 0.5);
    const duplicatedPosition = clampPositionToWorld(
      {
        x: snapValue(selectedEquipment.position.x + offset, snapSize),
        y: selectedEquipment.position.y,
        z: snapValue(selectedEquipment.position.z + offset, snapSize),
      },
      selectedEquipment.dimensions,
      world,
    );

    setEquipmentInstances((items) => [
      ...items,
      {
        ...selectedEquipment,
        id: duplicateId,
        name: `${selectedEquipment.name} COPY`,
        parameters: { ...selectedEquipment.parameters },
        dimensions: { ...selectedEquipment.dimensions },
        position: duplicatedPosition,
        rotation: { ...selectedEquipment.rotation },
        appearance: { ...selectedEquipment.appearance },
        detailAssetId: null,
      },
    ]);
    setSelectedEquipmentId(duplicateId);
  }, [selectedEquipment, snapSize, world]);

  const updateWorld = useCallback((changes) => {
    setWorld((currentWorld) => ({
      ...currentWorld,
      ...Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [key, clampDimension(value)]),
      ),
    }));
  }, []);

  const updateDetailAsset = useCallback((assetId, changes) => {
    setDetailAssets((assets) =>
      assets.map((asset) => asset.id === assetId
        ? {
            ...asset,
            ...changes,
            calibration: changes.calibration
              ? { ...asset.calibration, ...changes.calibration }
              : asset.calibration,
          }
        : asset),
    );
  }, []);

  const registerDetailAsset = useCallback(
    (equipmentId, file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_SCAN_FORMATS.has(extension)) {
        return { ok: false, message: "GLB, GLTF, OBJ, PLY 파일만 지원합니다." };
      }

      const assetId = createId("DETAIL_ASSET");
      const asset = {
        id: assetId,
        equipmentId,
        originalFileName: file.name,
        originalFormat: extension.toUpperCase(),
        fileSize: file.size,
        objectUrl: URL.createObjectURL(file),
        status: "UPLOADING",
        uploadProgress: 10,
        createdAt: new Date().toISOString(),
        calibration: {
          positionX: 0,
          positionY: 0,
          positionZ: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
        },
      };

      setDetailAssets((assets) => {
        const oldAssets = assets.filter((item) => item.equipmentId === equipmentId);
        oldAssets.forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
        return [...assets.filter((item) => item.equipmentId !== equipmentId), asset];
      });
      setEquipmentInstances((items) =>
        items.map((equipment) => equipment.id === equipmentId
          ? { ...equipment, detailAssetId: assetId }
          : equipment),
      );

      const timers = [
        setTimeout(() => updateDetailAsset(assetId, { uploadProgress: 65 }), 250),
        setTimeout(() => updateDetailAsset(assetId, { status: "PROCESSING", uploadProgress: 100 }), 550),
        setTimeout(() => updateDetailAsset(assetId, { status: "READY" }), 900),
      ];
      scanTimersRef.current.set(assetId, timers);
      return { ok: true, assetId };
    },
    [updateDetailAsset],
  );

  const removeDetailAsset = useCallback((equipmentId) => {
    setEquipmentInstances((items) =>
      items.map((equipment) => equipment.id === equipmentId
        ? { ...equipment, detailAssetId: null }
        : equipment),
    );
    setDetailAssets((assets) =>
      assets.filter((asset) => {
        if (asset.equipmentId !== equipmentId) return true;
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
        return false;
      }),
    );
  }, []);

  const resetLayout = useCallback(() => {
    setDetailAssets((assets) => {
      assets.forEach((asset) => asset.objectUrl && URL.revokeObjectURL(asset.objectUrl));
      return [];
    });
    setWorld(DEFAULT_WORLD);
    setEquipmentInstances([]);
    setPipeConnections([]);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    setViewMode(VIEW_MODES.VIEW_3D);
    setTransformMode(TRANSFORM_MODES.TRANSLATE);
    resetWorldStructures();
  }, [resetWorldStructures]);

  const hydrateLayout = useCallback((layout) => {
    if (!layout?.world || !Array.isArray(layout.equipment)) return false;

    const equipment = layout.equipment
      .map((item) => {
        const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[item.shapeTemplateId];
        return template ? normalizeEquipmentInstance(item, template) : null;
      })
      .filter(Boolean);
    setWorld({ ...DEFAULT_WORLD, ...layout.world });
    setEquipmentInstances(equipment);
    setDetailAssets(
      Array.isArray(layout.detailAssets) ? layout.detailAssets.map(sanitizeHydratedAsset) : [],
    );
    setPipeConnections(Array.isArray(layout.pipeConnections) ? layout.pipeConnections : []);
    hydrateWorldStructures(layout);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    return true;
  }, [hydrateWorldStructures]);

  const selectTemplate = useCallback(
    (templateId) => {
      setActiveTemplateId((currentId) => currentId === templateId ? null : templateId);
      setSelectedEquipmentId(null);
      if (templateId) rememberTemplate(templateId);
    },
    [rememberTemplate],
  );
  const toggleFavorite = useCallback((templateId) => {
    setFavoriteTemplateIds((ids) =>
      ids.includes(templateId) ? ids.filter((id) => id !== templateId) : [...ids, templateId],
    );
  }, []);
  const setEditorMode = useCallback((mode) => {
    setStructureEditorMode(mode);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    selectWorldStructureState(null);
    selectWorldTemplate(null);
  }, [selectWorldStructureState, selectWorldTemplate, setStructureEditorMode]);
  const selectEquipment = useCallback((equipmentId) => {
    setSelectedEquipmentId(equipmentId);
    selectWorldStructureState(null);
  }, [selectWorldStructureState]);
  const selectWorldStructure = useCallback((structureId) => {
    selectWorldStructureState(structureId);
    setSelectedEquipmentId(null);
  }, [selectWorldStructureState]);
  const clearSelection = useCallback(() => {
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    selectWorldStructureState(null);
    selectWorldTemplate(null);
  }, [selectWorldStructureState, selectWorldTemplate]);

  return {
    world,
    equipmentInstances,
    detailAssets,
    selectedDetailAsset,
    selectedEquipment,
    selectedEquipmentId,
    activeTemplateId,
    viewMode,
    transformMode,
    snapSize,
    collisionIds,
    pipeConnections,
    pipeSnapCandidate,
    favoriteTemplateIds,
    recentTemplateIds,
    editorMode: structureEditor.editorMode,
    worldStructures: structureEditor.worldStructures,
    worldSpaces: structureEditor.worldSpaces,
    selectedWorldStructure: structureEditor.selectedWorldStructure,
    selectedWorldStructureId: structureEditor.selectedWorldStructureId,
    activeWorldTemplateId: structureEditor.activeWorldTemplateId,
    worldStructuresLocked: structureEditor.worldStructuresLocked,
    visibilityFilters: structureEditor.visibilityFilters,
    actions: {
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
    },
  };
}
