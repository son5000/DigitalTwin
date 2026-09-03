export const BUILDING_FACADES = Object.freeze({ FRONT: "FRONT", BACK: "BACK", LEFT: "LEFT", RIGHT: "RIGHT" });
export const BUILDING_OPENING_TYPES = Object.freeze({
  DOOR: Object.freeze(["STANDARD", "DOUBLE", "SLIDING", "SHUTTER", "VEHICLE_GATE"]),
  WINDOW: Object.freeze(["FIXED", "SLIDING", "CASEMENT", "CURTAIN_WALL", "LOUVER"]),
});

const DEFAULT_APPEARANCE = Object.freeze({ materialPreset: "PAINTED_METAL", color: "#405865" });
const FACADE_EDGE_MARGIN = 0.15;
export const OPENING_COLLISION_MARGIN = 0.2;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || minimum));
}

function normalizeFloorRange(source, floorCount, fallbackStart, fallbackEnd) {
  const startFloor = Math.round(clamp(source?.startFloor ?? fallbackStart, 1, floorCount));
  const endFloor = Math.round(clamp(source?.endFloor ?? fallbackEnd, startFloor, floorCount));
  return { startFloor, endFloor };
}

function appearance(source, fallback) {
  return { ...DEFAULT_APPEARANCE, ...fallback, ...source };
}

export function normalizeBuildingOpenings(source = {}, floorCount = 1) {
  const doors = source.doors ?? {};
  const windows = source.windows ?? {};
  return {
    version: 1,
    doors: {
      enabled: doors.enabled ?? true,
      count: Math.round(clamp(doors.count ?? 2, 1, 12)),
      facade: Object.values(BUILDING_FACADES).includes(doors.facade) ? doors.facade : BUILDING_FACADES.FRONT,
      width: clamp(doors.width ?? 1.6, 0.7, 8),
      height: clamp(doors.height ?? 2.4, 1.8, 8),
      spacing: clamp(doors.spacing ?? 1, 0.2, 20),
      offset: Number(doors.offset) || 0,
      type: BUILDING_OPENING_TYPES.DOOR.includes(doors.type) ? doors.type : "STANDARD",
      ...normalizeFloorRange(doors, floorCount, 1, 1),
      frame: appearance(doors.frame, { color: "#263842" }),
      leaf: appearance(doors.leaf, { color: "#405865" }),
    },
    windows: {
      enabled: windows.enabled ?? true,
      count: Math.round(clamp(windows.count ?? 4, 1, 24)),
      facades: (windows.facades?.length ? windows.facades : Object.values(BUILDING_FACADES))
        .filter((facade) => Object.values(BUILDING_FACADES).includes(facade)),
      width: clamp(windows.width ?? 1.4, 0.3, 8),
      height: clamp(windows.height ?? 1.3, 0.3, 5),
      sillHeight: clamp(windows.sillHeight ?? 1, 0.1, 5),
      spacing: clamp(windows.spacing ?? 0.8, 0.1, 20),
      offset: Number(windows.offset) || 0,
      type: BUILDING_OPENING_TYPES.WINDOW.includes(windows.type) ? windows.type : "FIXED",
      ...normalizeFloorRange(windows, floorCount, 1, floorCount),
      frame: appearance(windows.frame, { color: "#425b66" }),
      glass: appearance(windows.glass, { materialPreset: "GLASS", color: "#4f8297" }),
    },
  };
}

function centeredPositions(length, count, width, spacing, offset) {
  const maximumCount = Math.max(1, Math.floor((length + spacing) / (width + spacing)));
  const actualCount = Math.min(count, maximumCount);
  const occupied = actualCount * width + (actualCount - 1) * spacing;
  const start = -occupied / 2 + width / 2 + Math.max(-length / 3, Math.min(length / 3, offset));
  return Array.from({ length: actualCount }, (_, index) => start + index * (width + spacing))
    .filter((position) => position - width / 2 > -length / 2 + FACADE_EDGE_MARGIN && position + width / 2 < length / 2 - FACADE_EDGE_MARGIN);
}

function rangesOverlap([leftStart, leftEnd], [rightStart, rightEnd]) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function windowSlotCollidesWithDoor({ center, width, bottom, height }, door) {
  return rangesOverlap(
    [center - width / 2, center + width / 2],
    [door.center - door.width / 2 - OPENING_COLLISION_MARGIN, door.center + door.width / 2 + OPENING_COLLISION_MARGIN],
  ) && rangesOverlap(
    [bottom, bottom + height],
    [door.bottom - OPENING_COLLISION_MARGIN, door.bottom + door.height + OPENING_COLLISION_MARGIN],
  );
}

export function getBuildingFacadeOpenings(building, floorCount) {
  const settings = normalizeBuildingOpenings(building.facadeOpenings, floorCount);
  const width = Math.max(5, Number(building.parameters?.width) || 5);
  const depth = Math.max(5, Number(building.parameters?.depth) || 5);
  const floorHeight = Math.max(2, Number(building.parameters?.floorHeight) || 3.6);
  const openings = [];
  if (settings.doors.enabled) {
    const length = [BUILDING_FACADES.FRONT, BUILDING_FACADES.BACK].includes(settings.doors.facade) ? width : depth;
    for (let floor = settings.doors.startFloor; floor <= settings.doors.endFloor; floor += 1) {
      centeredPositions(length, settings.doors.count, settings.doors.width, settings.doors.spacing, settings.doors.offset)
        .forEach((center) => openings.push({ kind: "DOOR", facade: settings.doors.facade, center, floor, bottom: (floor - 1) * floorHeight, width: settings.doors.width, height: Math.min(settings.doors.height, floorHeight - 0.1), type: settings.doors.type, frame: settings.doors.frame, fill: settings.doors.leaf }));
    }
  }
  if (settings.windows.enabled) {
    settings.windows.facades.forEach((facade) => {
      const length = [BUILDING_FACADES.FRONT, BUILDING_FACADES.BACK].includes(facade) ? width : depth;
      const windowSlots = centeredPositions(length, settings.windows.count, settings.windows.width, settings.windows.spacing, settings.windows.offset);
      for (let floor = settings.windows.startFloor; floor <= settings.windows.endFloor; floor += 1) {
        const bottom = (floor - 1) * floorHeight + settings.windows.sillHeight;
        const height = Math.min(settings.windows.height, floorHeight - settings.windows.sillHeight - 0.1);
        const doors = openings.filter((opening) => opening.kind === "DOOR" && opening.facade === facade && opening.floor === floor);
        windowSlots
          .filter((center) => doors.every((door) => !windowSlotCollidesWithDoor({ center, width: settings.windows.width, bottom, height }, door)))
          .forEach((center) => openings.push({ kind: "WINDOW", facade, center, floor, bottom, width: settings.windows.width, height, type: settings.windows.type, frame: settings.windows.frame, fill: settings.windows.glass }));
      }
    });
  }
  return { settings, openings };
}
