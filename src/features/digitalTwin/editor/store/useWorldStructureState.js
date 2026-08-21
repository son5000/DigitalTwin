import { useCallback, useMemo, useState } from "react";

import {
  DEFAULT_VISIBILITY_FILTERS,
  DEFAULT_WORLD_SPACE,
  EDITOR_MODES,
  WORLD_STRUCTURE_TEMPLATE_MAP,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { DEFAULT_WORLD } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { clampDimension, snapValue } from "@/features/digitalTwin/editor/utils/editorMath";
import { getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

const GROUND_SURFACE_TYPES = new Set(["FLOOR_REGION", "PLATFORM", "STEP", "RAMP"]);
const LEGACY_STRUCTURE_TYPE_MAP = {
  WALL_OBJECT: "WALL",
  PARTITION: "PARTITION",
  COLUMN: "COLUMN",
  BEAM: "BEAM",
  PLATFORM: "PLATFORM",
  STAIR: "STAIR",
  RAILING: "RAILING",
  FENCE: "FENCE",
  DOOR: "DOOR",
  GATE: "GATE",
};

function createStructureId() {
  return `WORLD_STRUCTURE_${crypto.randomUUID()}`;
}

function normalizeStructure(structure) {
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];
  if (!definition) return null;

  return {
    ...structure,
    domain: "WORLD",
    type: definition.id,
    group: definition.group,
    variant: structure.variant ?? definition.variants?.[0] ?? null,
    parameters: { ...definition.defaultParameters, ...structure.parameters },
    position: { x: 0, y: definition.defaultPositionY, z: 0, ...structure.position },
    rotation: { x: 0, y: 0, z: 0, ...structure.rotation },
    appearance: { ...definition.defaultAppearance, ...structure.appearance },
    spaceId: structure.spaceId ?? DEFAULT_WORLD_SPACE.id,
    visible: structure.visible ?? true,
    locked: structure.locked ?? false,
    groundSnap: structure.groundSnap ?? definition.defaultGroundSnap,
  };
}

function createDefaultWorldWalls(world) {
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP.WALL;
  const thickness = definition.defaultParameters.thickness;
  const wallBlueprints = [
    {
      length: world.width + thickness * 2,
      position: { x: 0, y: 0, z: -world.depth / 2 },
      rotationY: 0,
    },
    {
      length: world.depth,
      position: { x: world.width / 2, y: 0, z: 0 },
      rotationY: Math.PI / 2,
    },
    {
      length: world.depth,
      position: { x: -world.width / 2, y: 0, z: 0 },
      rotationY: Math.PI / 2,
    },
  ];

  return wallBlueprints.map((wall, index) => normalizeStructure({
    id: createStructureId(),
    type: "WALL",
    name: `${definition.nameKo} ${String(index + 1).padStart(2, "0")}`,
    parameters: {
      ...definition.defaultParameters,
      length: wall.length,
      height: world.wallHeight,
      thickness,
    },
    position: wall.position,
    rotation: { x: 0, y: wall.rotationY, z: 0 },
  }));
}

function getGroundSurfaceElevation(position, structures, ignoredStructureId) {
  let elevation = 0;

  structures.forEach((surface) => {
    if (surface.id === ignoredStructureId || !surface.visible || !GROUND_SURFACE_TYPES.has(surface.type)) return;
    const dimensions = getWorldStructureDimensions(surface);
    const deltaX = position.x - surface.position.x;
    const deltaZ = position.z - surface.position.z;
    const cosine = Math.cos(surface.rotation.y);
    const sine = Math.sin(surface.rotation.y);
    const localX = deltaX * cosine - deltaZ * sine;
    const localZ = deltaX * sine + deltaZ * cosine;
    if (Math.abs(localX) > dimensions.width / 2 || Math.abs(localZ) > dimensions.depth / 2) return;

    const surfaceHeight = surface.type === "RAMP"
      ? surface.parameters.startHeight +
        (surface.parameters.endHeight - surface.parameters.startHeight) *
          ((localZ + dimensions.depth / 2) / dimensions.depth)
      : dimensions.height;
    elevation = Math.max(elevation, surface.position.y + surfaceHeight);
  });

  return elevation;
}

function applyGroundSnap(structure, structures) {
  if (!structure.groundSnap) return structure;
  return {
    ...structure,
    position: {
      ...structure.position,
      y: getGroundSurfaceElevation(structure.position, structures, structure.id),
    },
  };
}

function convertLegacyEquipmentStructure(equipment) {
  const type = LEGACY_STRUCTURE_TYPE_MAP[equipment.shapeTemplateId];
  if (!type) return null;
  const { width, height, depth } = equipment.dimensions;
  let parameters = { width, height, depth };

  if (["WALL", "PARTITION"].includes(type)) {
    parameters = { length: width, height, thickness: depth };
  } else if (type === "BEAM") {
    parameters = { length: width, width: depth, height };
  } else if (["RAILING", "FENCE"].includes(type)) {
    parameters = { length: width, height, thickness: depth, postInterval: 1 };
  } else if (type === "STAIR") {
    parameters = { width, totalHeight: height, totalLength: depth, stepCount: 8 };
  }

  return normalizeStructure({
    id: equipment.id.replace("WORLD_OBJECT", "WORLD_STRUCTURE"),
    type,
    name: equipment.name,
    parameters,
    position: equipment.position,
    rotation: equipment.rotation,
    appearance: equipment.appearance,
    visible: equipment.visible,
    locked: equipment.locked,
  });
}

export default function useWorldStructureState({ snapSize }) {
  const [editorMode, setEditorModeState] = useState(EDITOR_MODES.EQUIPMENT);
  const [worldStructures, setWorldStructures] = useState(
    () => createDefaultWorldWalls(DEFAULT_WORLD),
  );
  const [worldSpaces] = useState([DEFAULT_WORLD_SPACE]);
  const [selectedWorldStructureId, setSelectedWorldStructureId] = useState(null);
  const [activeWorldTemplateId, setActiveWorldTemplateId] = useState(null);
  const [worldStructuresLocked, setWorldStructuresLocked] = useState(false);
  const [visibilityFilters, setVisibilityFilters] = useState(DEFAULT_VISIBILITY_FILTERS);

  const selectedWorldStructure = useMemo(
    () => worldStructures.find((structure) => structure.id === selectedWorldStructureId) ?? null,
    [selectedWorldStructureId, worldStructures],
  );

  const selectWorldTemplate = useCallback((templateId) => {
    setActiveWorldTemplateId((currentId) => currentId === templateId ? null : templateId);
    setSelectedWorldStructureId(null);
  }, []);

  const addWorldStructure = useCallback(
    (templateId, floorPosition) => {
      const definition = WORLD_STRUCTURE_TEMPLATE_MAP[templateId];
      if (!definition || worldStructuresLocked) return;

      const id = createStructureId();
      setWorldStructures((structures) => {
        const sequence = String(
          structures.filter((structure) => structure.type === templateId).length + 1,
        ).padStart(2, "0");
        const structure = normalizeStructure({
            id,
            type: templateId,
            name: `${definition.nameKo} ${sequence}`,
            position: {
              x: snapValue(floorPosition.x, snapSize),
              y: 0,
              z: snapValue(floorPosition.z, snapSize),
            },
          });
        return [...structures, structure];
      });
      setSelectedWorldStructureId(id);
      setActiveWorldTemplateId(null);
    },
    [snapSize, worldStructuresLocked],
  );

  const updateWorldStructure = useCallback((structureId, changes) => {
    setWorldStructures((structures) => structures.map((structure) => {
      if (structure.id !== structureId || worldStructuresLocked) return structure;
      const changeKeys = Object.keys(changes);
      if (structure.locked && changeKeys.some((key) => !["locked", "visible"].includes(key))) return structure;

      const nextStructure = {
        ...structure,
        ...changes,
        parameters: changes.parameters
          ? Object.fromEntries(
              Object.entries({ ...structure.parameters, ...changes.parameters }).map(([key, value]) => [
                key,
                typeof value === "number"
                  ? key === "startHeight"
                    ? Math.max(0, value)
                    : key === "stepCount"
                      ? Math.max(2, Math.round(value))
                      : clampDimension(value)
                  : value,
              ]),
            )
          : structure.parameters,
        position: changes.position ? { ...structure.position, ...changes.position } : structure.position,
        rotation: changes.rotation ? { ...structure.rotation, ...changes.rotation } : structure.rotation,
        appearance: changes.appearance
          ? { ...structure.appearance, ...changes.appearance }
          : structure.appearance,
      };
      return applyGroundSnap(nextStructure, structures);
    }));
  }, [worldStructuresLocked]);

  const removeSelectedWorldStructure = useCallback(() => {
    if (!selectedWorldStructureId || worldStructuresLocked) return;
    setWorldStructures((structures) => structures.filter(
      (structure) => structure.id !== selectedWorldStructureId || structure.locked,
    ));
    setSelectedWorldStructureId(null);
  }, [selectedWorldStructureId, worldStructuresLocked]);

  const duplicateSelectedWorldStructure = useCallback(() => {
    if (!selectedWorldStructure || selectedWorldStructure.locked || worldStructuresLocked) return;
    const id = createStructureId();
    setWorldStructures((structures) => [
      ...structures,
      normalizeStructure({
        ...selectedWorldStructure,
        id,
        name: `${selectedWorldStructure.name} COPY`,
        position: {
          ...selectedWorldStructure.position,
          x: selectedWorldStructure.position.x + Math.max(0.5, snapSize),
          z: selectedWorldStructure.position.z + Math.max(0.5, snapSize),
        },
      }),
    ]);
    setSelectedWorldStructureId(id);
  }, [selectedWorldStructure, snapSize, worldStructuresLocked]);

  const toggleVisibilityFilter = useCallback((filterId) => {
    setVisibilityFilters((filters) => ({ ...filters, [filterId]: !filters[filterId] }));
  }, []);

  const hydrateWorldStructures = useCallback((layout) => {
    const migratedBaseWalls = Number(layout.version ?? 0) < 4
      ? createDefaultWorldWalls({ ...DEFAULT_WORLD, ...layout.world })
      : [];
    const storedStructures = Array.isArray(layout.worldStructures)
      ? layout.worldStructures.map(normalizeStructure).filter(Boolean)
      : [];
    const migratedStructures = Array.isArray(layout.equipment)
      ? layout.equipment.map(convertLegacyEquipmentStructure).filter(Boolean)
      : [];
    setWorldStructures([...migratedBaseWalls, ...storedStructures, ...migratedStructures]);
    setVisibilityFilters({ ...DEFAULT_VISIBILITY_FILTERS, ...layout.visibilityFilters });
    setWorldStructuresLocked(Boolean(layout.worldStructuresLocked));
    setSelectedWorldStructureId(null);
    setActiveWorldTemplateId(null);
  }, []);

  const resetWorldStructures = useCallback(() => {
    setWorldStructures(createDefaultWorldWalls(DEFAULT_WORLD));
    setSelectedWorldStructureId(null);
    setActiveWorldTemplateId(null);
    setWorldStructuresLocked(false);
    setVisibilityFilters(DEFAULT_VISIBILITY_FILTERS);
    setEditorModeState(EDITOR_MODES.EQUIPMENT);
  }, []);

  return {
    editorMode,
    worldStructures,
    worldSpaces,
    selectedWorldStructure,
    selectedWorldStructureId,
    activeWorldTemplateId,
    worldStructuresLocked,
    visibilityFilters,
    actions: {
      setEditorMode: setEditorModeState,
      selectWorldTemplate,
      addWorldStructure,
      updateWorldStructure,
      selectWorldStructure: setSelectedWorldStructureId,
      removeSelectedWorldStructure,
      duplicateSelectedWorldStructure,
      setWorldStructuresLocked,
      toggleVisibilityFilter,
      hydrateWorldStructures,
      resetWorldStructures,
    },
  };
}
