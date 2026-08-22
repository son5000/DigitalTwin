import { createElement } from "react";

import { BuildingIcon, ComponentIcon, EquipmentIcon, FloorIcon, SiteIcon, SpaceIcon, WorldIcon } from "./hierarchyIcons";
import { BoxIcon, CabinetIcon, CylinderIcon, DuctIcon, ElectricalIcon, FactoryIcon, GrassIcon, LandscapeIcon, LogisticsIcon, MechanicalIcon, ParkingIcon, PipeIcon, RoadIcon, SafetyIcon, SensorIcon, StructureIcon, TankIcon, TrafficIcon, TreeIcon, VehicleIcon } from "./objectIcons";

const HIERARCHY_ICON_REGISTRY = Object.freeze({
  WORLD: WorldIcon,
  SITE: SiteIcon,
  BUILDING: BuildingIcon,
  ENVIRONMENT_BUILDING: BuildingIcon,
  FLOOR: FloorIcon,
  ROOM: SpaceIcon,
  SPACE: SpaceIcon,
  EQUIPMENT: EquipmentIcon,
  COMPONENT: ComponentIcon,
  PART: ComponentIcon,
});

const EQUIPMENT_CATEGORY_ICON_REGISTRY = Object.freeze({
  BASIC: BoxIcon,
  CABINET: CabinetIcon,
  MECHANICAL: MechanicalIcon,
  PIPE: PipeIcon,
  DUCT: DuctIcon,
  TANK: TankIcon,
  SAFETY: SafetyIcon,
  SENSOR: SensorIcon,
  UTILITY: StructureIcon,
  CUSTOM: BoxIcon,
});

const EQUIPMENT_TEMPLATE_ICON_REGISTRY = Object.freeze({
  CYLINDER: CylinderIcon,
  SPHERE: CylinderIcon,
  CONE: CylinderIcon,
  CAPSULE: CylinderIcon,
  TANK_VERTICAL: TankIcon,
  TANK_HORIZONTAL: TankIcon,
  PRESSURE_VESSEL: TankIcon,
  STORAGE_TANK: TankIcon,
  SILO: TankIcon,
  DRUM: TankIcon,
});

const WORLD_STRUCTURE_GROUP_ICON_REGISTRY = Object.freeze({
  SPACE: SpaceIcon,
  STRUCTURE: StructureIcon,
  FLOOR: SpaceIcon,
  OPENING: SpaceIcon,
  BOUNDARY: StructureIcon,
  CUSTOM: BoxIcon,
});

const SITE_TEMPLATE_ICON_REGISTRY = Object.freeze({
  BUILDING: BuildingIcon,
  ROAD: RoadIcon,
  WALKWAY: RoadIcon,
  PARKING: RoadIcon,
  GRASS: GrassIcon,
  TREE: TreeIcon,
  CAR: EquipmentIcon,
  EXTERIOR_FLOOR: SpaceIcon,
  FENCE: StructureIcon,
  GATE: StructureIcon,
  STREETLIGHT: SensorIcon,
  OTHER: StructureIcon,
});

const OBJECT_LIBRARY_ICON_REGISTRY = Object.freeze({
  building: BuildingIcon,
  factory: FactoryIcon,
  vehicle: VehicleIcon,
  traffic: TrafficIcon,
  road: RoadIcon,
  environment: TreeIcon,
  landscape: LandscapeIcon,
  mechanical: MechanicalIcon,
  electrical: ElectricalIcon,
  logistics: LogisticsIcon,
  safety: SafetyIcon,
  tank: TankIcon,
  parking: ParkingIcon,
});

export function getHierarchyIcon(type) {
  return HIERARCHY_ICON_REGISTRY[type] ?? ComponentIcon;
}

export function getEquipmentTemplateIcon(template) {
  return EQUIPMENT_TEMPLATE_ICON_REGISTRY[template?.id]
    ?? EQUIPMENT_CATEGORY_ICON_REGISTRY[template?.category]
    ?? EquipmentIcon;
}

export function getWorldStructureIcon(definition) {
  return WORLD_STRUCTURE_GROUP_ICON_REGISTRY[definition?.group] ?? StructureIcon;
}

export function getSiteTemplateIcon(template) {
  return SITE_TEMPLATE_ICON_REGISTRY[template?.id]
    ?? OBJECT_LIBRARY_ICON_REGISTRY[template?.iconKey]
    ?? StructureIcon;
}

export function getObjectLibraryIcon(definitionOrCategory) {
  return OBJECT_LIBRARY_ICON_REGISTRY[definitionOrCategory?.iconKey]
    ?? getSiteTemplateIcon(definitionOrCategory);
}

export function HierarchyIcon({ type, ...props }) {
  return createElement(getHierarchyIcon(type), props);
}

export function EquipmentTemplateIcon({ template, ...props }) {
  return createElement(getEquipmentTemplateIcon(template), props);
}

export function WorldStructureTypeIcon({ definition, ...props }) {
  return createElement(getWorldStructureIcon(definition), props);
}

export function SiteTemplateIcon({ template, ...props }) {
  return createElement(getSiteTemplateIcon(template), props);
}

export function ObjectLibraryIcon({ definition, category, ...props }) {
  return createElement(getObjectLibraryIcon(definition ?? category), props);
}
