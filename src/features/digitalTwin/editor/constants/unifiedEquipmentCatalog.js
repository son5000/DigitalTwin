import { createMaterialAppearance } from "./materialPresets.js";
import {
  EQUIPMENT_SHAPE_TEMPLATES,
} from "./equipmentShapeTemplates.js";
import { OBJECT_LIBRARY_DEFINITIONS } from "./objectLibraryCatalog.js";

export const UNIFIED_EQUIPMENT_CATEGORY_IDS = Object.freeze({
  ELECTRICAL: "ELECTRICAL",
  HVAC: "HVAC",
  PIPE_WATER: "PIPE_WATER",
  FIRE_SAFETY: "FIRE_SAFETY",
  COMM_SECURITY: "COMM_SECURITY",
  ENERGY_ENVIRONMENT: "ENERGY_ENVIRONMENT",
  GENERAL: "GENERAL",
});

export const UNIFIED_EQUIPMENT_CATEGORIES = Object.freeze([
  ["ELECTRICAL", "전기"],
  ["HVAC", "공조·환기"],
  ["PIPE_WATER", "배관·탱크·수처리"],
  ["FIRE_SAFETY", "소방·안전"],
  ["COMM_SECURITY", "통신·보안"],
  ["ENERGY_ENVIRONMENT", "에너지·환경"],
  ["GENERAL", "일반 설비"],
].map(([id, nameKo]) => ({ id, name: nameKo, nameKo })));

const SITE_EQUIPMENT_CATEGORY_IDS = new Set([
  "INDUSTRIAL_EQUIPMENT",
  "ELECTRICAL_EQUIPMENT",
  "SAFETY_FACILITY",
  "PIPE_TANK",
  "OUTDOOR_EQUIPMENT",
]);

const CATEGORY_RULES = [
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.ENERGY_ENVIRONMENT, /SOLAR|WEATHER|ENV_SENSOR|GENERATOR/],
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.COMM_SECURITY, /CCTV|CAMERA|SENSOR|SERVER|COMM|SECURITY/],
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.FIRE_SAFETY, /FIRE|HYDRANT|SAFETY|BOLLARD|GUARD|EYEWASH|EMERGENCY/],
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.HVAC, /DUCT|AIR_|FAN|BLOWER|CHILLER|COOLING|CONDENSER|BOILER|HEAT_EXCHANGER/],
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.PIPE_WATER, /PIPE|TANK|VESSEL|SILO|HOPPER|DRUM|PUMP|VALVE|MIXER|BASIN|CLARIFIER|WATER_TOWER/],
  [UNIFIED_EQUIPMENT_CATEGORY_IDS.ELECTRICAL, /TRANSFORMER|PANEL|SWITCH|MCC|UPS|BATTERY|ELECTRICAL|JUNCTION|CHARGER/],
];

const FAMILY_RULES = [
  ["TRANSFORMER", /TRANSFORMER/], ["GENERATOR", /GENERATOR/], ["PUMP", /PUMP/],
  ["VALVE", /VALVE/], ["VERTICAL_TANK", /VERTICAL.*TANK|TANK_VERTICAL/],
  ["HORIZONTAL_TANK", /HORIZONTAL.*TANK|TANK_HORIZONTAL/], ["SILO", /SILO/],
  ["PRESSURE_VESSEL", /PRESSURE.*VESSEL/], ["CCTV", /CCTV|(?<!THERMAL_)CAMERA$/],
  ["SOLAR_ARRAY", /SOLAR/], ["COOLING_TOWER", /COOLING_TOWER/],
  ["OUTDOOR_CONDENSER", /CONDENSER/], ["FIRE_HYDRANT", /HYDRANT/],
  ["EV_CHARGER", /EV_CHARGER|CHARGER_(SINGLE|DUAL)/],
  ["ENVIRONMENT_SENSOR", /ENV_SENSOR|WEATHER_STATION/],
];

function sourceId(definition) {
  return definition.id.toUpperCase();
}

function functionalCategory(definition) {
  const searchable = `${sourceId(definition)} ${definition.category ?? ""} ${definition.categoryId ?? ""} ${definition.profile ?? ""}`;
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(searchable))?.[0]
    ?? UNIFIED_EQUIPMENT_CATEGORY_IDS.GENERAL;
}

function semanticFamily(definition) {
  const searchable = `${sourceId(definition)} ${definition.profile ?? ""}`;
  return FAMILY_RULES.find(([, pattern]) => pattern.test(searchable))?.[0]
    ?? sourceId(definition).replace(/^SITE_/, "").replace(/^OUT_/, "");
}

function installationMetadata(definition) {
  const allowedModes = definition.placementRules?.allowedModes ?? [];
  if (!allowedModes.length) return { installationBadges: ["실내"], placementRules: { allowedModes: ["INDOOR"] } };
  const badges = [];
  if (allowedModes.includes("GROUND") || allowedModes.includes("ROAD_EDGE") || allowedModes.includes("UNDERGROUND")) badges.push("옥외");
  if (allowedModes.includes("ROOF")) badges.push("옥상");
  if (allowedModes.includes("WALL")) badges.push("외벽");
  if (allowedModes.includes("INDOOR")) badges.push("실내");
  if (badges.includes("옥외") && badges.includes("실내")) badges.push("실내·외 겸용");
  return { installationBadges: [...new Set(badges)], placementRules: definition.placementRules };
}

function siteAssetKindForFloorTemplate(template) {
  if (template.category === "CABINET") return "ELECTRICAL";
  if (["PIPE", "TANK"].includes(template.category)) return "PIPE_TANK";
  if (["SAFETY", "SENSOR"].includes(template.category)) return "SAFETY";
  return "INDUSTRIAL";
}

function floorCategoryForSiteDefinition(definition) {
  if (definition.assetKind === "OUTDOOR_EQUIPMENT") return "UNIFIED_OUTDOOR";
  if (definition.assetKind === "ELECTRICAL") return "CABINET";
  if (definition.assetKind === "PIPE_TANK") return definition.profile?.includes("PIPE") ? "PIPE" : "TANK";
  if (definition.assetKind === "SAFETY") return "SAFETY";
  return "MECHANICAL";
}

const floorSources = EQUIPMENT_SHAPE_TEMPLATES.filter((template) => !template.legacyOnly)
  .map((definition) => ({ definition, source: "FLOOR" }));
const siteSources = OBJECT_LIBRARY_DEFINITIONS
  .filter((definition) => SITE_EQUIPMENT_CATEGORY_IDS.has(definition.categoryId))
  .map((definition) => ({ definition, source: "SITE" }));

const groups = new Map();
[...floorSources, ...siteSources].forEach((source) => {
  const key = semanticFamily(source.definition);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(source);
});

function preferredSource(sources) {
  return sources.find(({ definition }) => definition.assetKind === "OUTDOOR_EQUIPMENT")
    ?? sources.find(({ source }) => source === "FLOOR")
    ?? sources[0];
}

function toUnifiedTemplate(familyId, sources) {
  const preferred = preferredSource(sources);
  const source = preferred.definition;
  const floorSource = sources.find((item) => item.source === "FLOOR")?.definition;
  const dimensions = source.defaultDimensions ?? { width: source.width, height: source.height, depth: source.depth };
  const appearance = source.defaultAppearance ?? createMaterialAppearance(
    source.material === "CONCRETE" ? "CONCRETE" : source.material === "STAINLESS" ? "STAINLESS" : "PAINTED_METAL",
    { color: source.color ?? "#78909C", opacity: 0.92, showEdges: true },
  );
  const canonicalId = floorSource?.id ?? source.id;
  const variants = sources.map(({ definition, source: sourceDomain }) => ({
    id: definition.id,
    label: definition.nameKo ?? definition.name,
    sourceDomain,
  }));
  const category = functionalCategory(source);
  const installation = installationMetadata(source);
  return {
    ...source,
    id: canonicalId,
    templateId: canonicalId,
    domain: "EQUIPMENT",
    aliases: [...new Set(sources.map(({ definition }) => definition.id).filter((id) => id !== canonicalId))],
    modelFamilyId: familyId,
    modelVariants: variants,
    variantSources: sources,
    category,
    categoryId: "EQUIPMENT",
    subcategoryId: category,
    objectType: familyId,
    objectTypeLabel: source.nameKo ?? source.name,
    nameKo: source.nameKo ?? source.name,
    defaultDimensions: dimensions,
    defaultParameters: source.defaultParameters ?? source.parameters ?? {},
    parameters: source.parameters ?? source.defaultParameters ?? {},
    defaultAppearance: appearance,
    appearance,
    width: dimensions.width,
    height: dimensions.height,
    depth: dimensions.depth,
    assetKind: source.assetKind ?? siteAssetKindForFloorTemplate(source),
    profile: source.profile ?? source.id,
    geometryMode: source.geometryMode ?? "POINT",
    color: source.color ?? appearance.color,
    material: source.material ?? appearance.materialPreset ?? "PAINTED",
    floorCategory: preferred.source === "FLOOR" ? source.category : floorCategoryForSiteDefinition(source),
    generatorKey: source.assetKind === "OUTDOOR_EQUIPMENT" ? "UNIFIED_OUTDOOR" : undefined,
    modelSource: source.modelSource ?? `procedural:${source.profile ?? source.id}`,
    thumbnailSource: `/assets/object-thumbnails/${canonicalId}.png`,
    keywords: [...new Set([...(source.keywords ?? []), ...variants.flatMap((variant) => [variant.id, variant.label]), ...installation.installationBadges])],
    ...installation,
    defaultVariants: { modelTemplateId: source.id },
    variantGroups: variants.length > 1 ? [{ id: "modelTemplateId", label: "모델 변형", options: variants }] : [],
  };
}

export const UNIFIED_EQUIPMENT_TEMPLATES = Object.freeze(
  [...groups.entries()].map(([familyId, sources]) => toUnifiedTemplate(familyId, sources)),
);

const templateEntries = UNIFIED_EQUIPMENT_TEMPLATES.flatMap((template) => [
  [template.id, template],
  ...template.aliases.map((alias) => {
    const variantSource = template.variantSources.find(({ definition }) => definition.id === alias);
    const source = variantSource?.definition;
    if (!source) return [alias, { ...template, id: alias, templateId: alias }];
    const dimensions = source.defaultDimensions ?? { width: source.width, height: source.height, depth: source.depth };
    const defaultAppearance = source.defaultAppearance ?? createMaterialAppearance(
      source.material === "CONCRETE" ? "CONCRETE" : source.material === "STAINLESS" ? "STAINLESS" : "PAINTED_METAL",
      { color: source.color ?? template.color, opacity: 0.92, showEdges: true },
    );
    return [alias, {
      ...template,
      ...source,
      id: alias,
      templateId: alias,
      nameKo: source.nameKo ?? source.name,
      category: template.category,
      categoryId: "EQUIPMENT",
      subcategoryId: template.subcategoryId,
      objectType: template.objectType,
      objectTypeLabel: template.objectTypeLabel,
      defaultDimensions: dimensions,
      defaultParameters: source.defaultParameters ?? source.parameters ?? {},
      defaultAppearance,
      width: dimensions.width,
      height: dimensions.height,
      depth: dimensions.depth,
      geometryMode: source.geometryMode ?? "POINT",
      assetKind: source.assetKind ?? siteAssetKindForFloorTemplate(source),
      profile: source.profile ?? source.id,
      floorCategory: variantSource.source === "FLOOR" ? source.category : floorCategoryForSiteDefinition(source),
      generatorKey: source.assetKind === "OUTDOOR_EQUIPMENT" ? "UNIFIED_OUTDOOR" : undefined,
      modelSource: source.modelSource ?? `procedural:${source.profile ?? source.id}`,
      thumbnailSource: `/assets/object-thumbnails/${alias}.png`,
      placementRules: source.placementRules ?? template.placementRules,
      installationBadges: installationMetadata(source).installationBadges,
    }];
  }),
]);

export const UNIFIED_EQUIPMENT_TEMPLATE_MAP = Object.freeze(Object.fromEntries(templateEntries));

export function getUnifiedEquipmentTemplates(allowedIds) {
  if (!allowedIds?.length) return UNIFIED_EQUIPMENT_TEMPLATES;
  const allowed = new Set(allowedIds);
  return UNIFIED_EQUIPMENT_TEMPLATES.filter((template) => allowed.has(template.id) || template.aliases.some((id) => allowed.has(id)));
}

export function resolveUnifiedEquipmentTemplateId(templateId) {
  return UNIFIED_EQUIPMENT_TEMPLATE_MAP[templateId]?.id ?? templateId;
}
