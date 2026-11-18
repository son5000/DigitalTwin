import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const definitions = [
  ['equipment','src/features/digitalTwin/editor/constants/unifiedEquipmentCatalog.js','UNIFIED_EQUIPMENT_TEMPLATES'],
  ['siteAndBuilding','src/features/digitalTwin/editor/constants/objectLibraryCatalog.js','OBJECT_LIBRARY_DEFINITIONS'],
  ['structures','src/features/digitalTwin/editor/constants/worldStructureTemplates.js','WORLD_STRUCTURE_TEMPLATES'],
  ['materials','src/features/digitalTwin/editor/constants/materialPresets.js','MATERIAL_PRESETS'],
  ['floorMaterials','src/features/digitalTwin/editor/constants/floorSurfaceStyles.js','FLOOR_SURFACE_PRESETS'],
  ['footprints','src/features/customAssets/building/buildingTemplates.js','BUILDING_FOOTPRINT_TEMPLATES'],
  ['customParts','src/features/customAssets/equipment/customEquipmentModel.js','CUSTOM_EQUIPMENT_PART_LIBRARY'],
];
const enums = [
  'src/features/digitalTwin/editor/model/observationWorkflow.js',
  'src/features/digitalTwin/editor/model/observationProfiles.js',
  'src/features/digitalTwin/editor/model/observationMetrics.js',
  'src/features/digitalTwin/editor/model/roiMonitoring.js',
  'src/features/digitalTwin/editor/model/viewerPreset.js',
  'src/features/digitalTwin/editor/model/equipmentDetailModel.js',
  'src/features/digitalTwin/editor/model/movementPath.js',
  'src/features/digitalTwin/editor/model/undergroundModel.js',
  'src/features/digitalTwin/editor/model/floorSpatialModel.js',
  'src/features/digitalTwin/editor/model/thermalFrame.js',
  'src/features/digitalTwin/editor/model/userTexture.js',
  'src/features/digitalTwin/editor/model/sensorHeatmap.js',
  'src/features/digitalTwin/editor/model/observationSiteSizing.js',
  'src/features/digitalTwin/editor/constants/siteEnvironmentSettings.js',
  'src/features/digitalTwin/editor/constants/worldWizard.js',
  'src/features/digitalTwin/editor/utils/stairStructure.js',
];
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType:'custom', logLevel:'error' });
try {
  const catalogs = {};
  for (const [name,file,exportName] of definitions) {
    const module = await server.ssrLoadModule('/'+file);
    if (!Array.isArray(module[exportName]) || !module[exportName].length) throw new Error(`Missing catalog ${name}`);
    catalogs[name] = { file, exportName, count:module[exportName].length, definitions:module[exportName] };
  }
  const constants = {};
  for (const file of enums) {
    const module = await server.ssrLoadModule('/'+file);
    constants[file] = Object.fromEntries(Object.entries(module).filter(([name,value]) => /^[A-Z][A-Z_0-9]*$/.test(name) && typeof value !== 'function'));
  }
  const files = new Set([...definitions.map(([,file])=>file),...enums]);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    if (module.file?.startsWith(root) && !module.file.includes('node_modules') && /\.[jt]sx?$/.test(module.file)) files.add(path.relative(root,module.file).replaceAll('\\','/'));
  }
  const result = { contractDate:'2026-11-17', layoutVersion:18,
    usage:'Match equipment.shapeTemplateId, siteObjects.type/objectDefinitionId or structure.type to definitions[].id. Copy relevant parameters/defaultParameters, variants/defaultVariants, dimensions, parameterFields, materialSlots and placementRules. Dynamic custom assets live in assets.custom or customAssetSnapshot, not this static catalog.',
    catalogs, constants,
    sources:[...files].sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),
  };
  const output=JSON.stringify(result,(_key,value)=>value instanceof Set?[...value]:value,2)+'\n';
  const target=path.join(root,'docs/viewer/data/viewer-template-catalog.json');
  if (check) { if (fs.readFileSync(target,'utf8')!==output) throw new Error('Stale template catalog'); }
  else fs.writeFileSync(target,output,'utf8');
  console.log(`${check?'PASS':'Generated'} catalog: ${Object.entries(catalogs).map(([k,v])=>`${k}=${v.count}`).join(', ')}`);
} finally { await server.close(); }
