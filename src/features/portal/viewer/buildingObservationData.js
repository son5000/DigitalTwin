import { sortFloorsByLevel } from "../../digitalTwin/editor/model/floorDisplay.js";

const items = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string") : [];
const unique = (values) => [...new Map(values.map((item) => [item.id, item])).values()];

// A read-only view of existing floor ownership, shared by the scene, labels and drawer.
export function getBuildingObservationData(layout, building, hierarchy) {
  if (!building) return null;
  const floors = sortFloorsByLevel(hierarchy.filter((node) => node.type === "FLOOR" && node.parentId === building.id));
  const floorData = floors.map((floor, index) => {
    const plan = layout.floorPlansById?.[floor.id] ?? {};
    const rooms = hierarchy.filter((node) => node.type === "ROOM" && node.parentId === floor.id);
    const equipment = unique(items(layout.equipmentByFloorId?.[floor.id]));
    const known = new Set(equipment.map((item) => item.id));
    const roomScenes = rooms.map((room) => {
      const scene = layout.roomScenes?.[room.id];
      const entries = items(scene?.equipment ?? (layout.hierarchy?.activeRoomId === room.id ? layout.equipment : []))
        .filter((item) => { if (known.has(item.id)) return false; known.add(item.id); return true; });
      return { room, equipment: entries, structures: items(scene?.worldStructures ?? (layout.hierarchy?.activeRoomId === room.id ? layout.worldStructures : [])) };
    });
    const allEquipment = [...equipment, ...roomScenes.flatMap((scene) => scene.equipment)];
    const spaces = unique([...items(plan.rooms), ...rooms, ...items(plan.structures).filter((item) => ["ROOM", "UTILITY_AREA"].includes(item.type))]);
    const facilities = [...new Set(spaces.map((room) => room.name || room.facilityType || room.usage).filter((name) => typeof name === "string" && name.trim()))];
    const hasPlan = [plan.floorFootprint?.regions, plan.rooms, plan.walls, plan.doors, plan.structures].some((value) => Array.isArray(value) && value.length)
      || roomScenes.some((scene) => scene.structures.length);
    return {
      ...floor, elevation: Number.isFinite(Number(floor.elevation)) ? Number(floor.elevation)
        : ((Number(floor.level) || index + 1) > 0 ? (Number(floor.level) || index + 1) - 1 : Number(floor.level)) * (Number(floor.floorHeight ?? building.parameters?.floorHeight) || 3.6),
      name: floor.name || (Number(floor.level) < 0 ? `지하 ${Math.abs(Number(floor.level))}층` : `${floor.level ?? index + 1}층`),
      plan, equipment, roomScenes, spaces, allEquipment, facilities, hasPlan,
      summary: `${facilities.slice(0, 2).join(" · ") || (hasPlan ? "저장된 도면" : "도면 없음")} · 설비 ${allEquipment.length}개`,
    };
  });
  const equipmentIds = new Set(floorData.flatMap((floor) => floor.allEquipment.map((item) => item.id)));
  return { building, floors: floorData, viewerPreset: layout.viewerPreset, verticalStructures: items(layout.verticalStructuresByBuildingId?.[building.id]),
    assetBindings: items(layout.equipmentAssetBindings).filter((binding) => equipmentIds.has(binding.equipmentId)),
  };
}
