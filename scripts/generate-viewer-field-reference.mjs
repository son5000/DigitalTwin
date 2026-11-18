// Documentation only. Does not modify application code or contact a backend.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '@babel/parser';
import { fieldGroups, supplementalFields, aliases, fieldTypeOverrides } from './viewer-contract-spec.mjs';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const cache = new Map();
function source(file) {
  if (!cache.has(file)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    cache.set(file, { text, ast: parse(text, { sourceType: 'module', plugins: ['jsx'] }), sha256: crypto.createHash('sha256').update(text).digest('hex') });
  }
  return cache.get(file);
}
function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(v => visit(v, fn));
    else if (value && typeof value === 'object') visit(value, fn);
  }
}
const keyOf = p => p.computed ? null : p.key?.name ?? p.key?.value;
const expr = (file, node) => source(file).text.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
function inferredType(n) {
  if (!n) return 'JSON';
  if (n.type === 'ObjectExpression') return 'object';
  if (n.type === 'ArrayExpression') return 'array';
  if (n.type === 'StringLiteral' || n.type === 'TemplateLiteral') return 'string';
  if (n.type === 'BooleanLiteral') return 'boolean';
  if (n.type === 'NumericLiteral') return 'number';
  if (n.type === 'NullLiteral') return 'null';
  if (n.type === 'UnaryExpression' && n.operator === '!') return 'boolean';
  if (n.type === 'UnaryExpression' && ['+', '-'].includes(n.operator)) return 'number';
  if (n.type === 'BinaryExpression') return ['==', '===', '!=', '!==', '<', '>', '<=', '>=', 'in', 'instanceof'].includes(n.operator) ? 'boolean' : 'number';
  if (n.type === 'LogicalExpression' && n.operator === '??') return inferredType(n.right) === 'null' ? 'JSON|null' : inferredType(n.right);
  if (n.type === 'ConditionalExpression') { const a = inferredType(n.consequent), b = inferredType(n.alternate); return a === b ? a : `${a}|${b}`; }
  if (n.type === 'CallExpression') {
    const name = n.callee?.name ?? n.callee?.property?.name;
    if (['Number', 'max', 'min', 'round', 'floor', 'ceil', 'finite', 'clamp', 'number', 'finiteNumber'].includes(name)) return 'number';
    if (name === 'Boolean') return 'boolean';
    if (['String', 'trim', 'toISOString', 'createId', 'randomUUID'].includes(name)) return 'string';
    if (['map', 'filter', 'Array', 'from', 'slice'].includes(name)) return 'array';
    if (name === 'fromEntries') return 'object';
  }
  return 'JSON (식 참조)';
}
function reviewedType(group, field) {
  const exact = fieldTypeOverrides[group.name]?.[field.path];
  if (exact) return exact;
  if (!field.type.includes('JSON')) return field.type;
  const key = field.path.split('.').at(-1);
  if (key === '*' || key.startsWith('{')) return field.type;
  const specific = {
    BuildingNode: { facadeOpenings:'object', parameters:'object', variants:'object', position:'object', rotation:'object', appearance:'object' },
    RoomNode: {position:'object',rotation:'object',appearance:'object'},
    SiteObject: {path:'object|null',movement:'object|null',undergroundConnection:'object|null',profile:'string',customAssetRevision:'integer|null'},
    BuildingSection: {offset:'object',rotation:'number'},
    CustomPort: {direction:'object'},
    ImageTransform: {source:'number[4][2]',target:'number[4][2]',width:'number|null',height:'number|null'},
    ThermalBinding: {matrix:'number[16]',uv:'number[2]',width:'number|null',height:'number|null'},
    ImageRegionCoordinates: {pixels:'number[4][2]|null',pixelGeometry:'object|null'},
    ImageRegionGeometry: {corners:'number[4][2]'},
    Calibration: {position:'number[3]',rotation:'number[3]',intrinsics:'object|null',resolution:'object|null'},
    SurfaceMapping: {origin:'number[3]',right:'number[3]',up:'number[3]',normal:'number[3]'},
    CoordinateFrame: {origin:'number[3]'},
    ScanSlotFrame: {origin:'number[3]'},
    EquipmentView: {position:'number[3]',target:'number[3]',up:'number[3]'},
    ViewerPreset: {camera:'JSON|null'},
    Grid: {verticalSnap:'number|null'},
    LedColorProfile: {hue:'number[][]|null',saturationMax:'number|null',brightnessMin:'number|null'},
    CustomEquipmentPart: {connectedTo:'object|null'},
    EquipmentFileRecord: {path:'string',blob:'Blob → {$file:string}'},
    TextureFileRecord: {blob:'Blob → {$file:string}'},
    MeasurementDefaults: {previewValue:'number|string|null'},
  }[group.name]?.[key];
  if (specific) return specific;
  let type;
  if (/^(id|.*Id|.*_id)$/.test(key)) type='string';
  else if (/Ids$/.test(key)) type='string[]';
  else if (/^(version|schemaVersion|spatialVersion|revision|columns|rows|level|floorNumber|startFloor|endFloor|doorCount|index|order|partCount|segmentCount|junctionCount|connectionCount|groupCount|customAssetRevision)$/.test(key)) type='integer';
  else if (/^(width|height|depth|x|y|z|minX|maxX|minZ|maxZ|resolution|baseSize|cellSize|levelHeight|spacing|thickness|offset|cropX|cropY|scaleX|scaleY|zoom|pivotX|pivotY|offsetX|offsetY|cropWidth|cropHeight|rotationY|planeRotation|markerDiameter|treadDepth|riserHeight|landingDepth|baseElevation|topElevation|roughness|metalness|reflectivity|opacity|textureScale|textureRotation|bumpStrength|aging|transmission|diameter|size|fileSize|saturationMax|brightnessMin)$/.test(key)) type='number';
  else if (/^(enabled|positionAutoZ|resized|flipX|flipY|showContours|showHeightColors)$/.test(key)) type='boolean';
  else if (/^(nodes|parts|groups|levels|entities|viewGroups|relations|scanAssets|worldStructures|elevations|waypoints|regions|outer|boundary|outline|elevationZones|doors|measurements|files|displayMaterials|sections|cells|dataBindings|capabilities|vertices|corners|sourceUvCorners|tags|assets|tickets|notifications)$/.test(key)) type='array';
  else if (/^(hierarchy|observationWorkflow|viewerPreset|terrain|gridSettings|roomScenes|parameters|variants|position|rotation|appearance|enclosure|dimensions|lighting|overrides|heatmap|surfaceMapping|perspective|floorFootprint|start|end|frame|leaf|glass|rear|origin|center|footprint|surface|originalImage|imageTransform|source|processed|coordinateFrame|model|surfaceMount|slotFrame|textureProjection|imageProcessing|rect|view|doorState|payload|observationPoint|virtualCameraRegion|imageBinding|imageAnalysis|thermalBinding|blockGrid|customAssetSnapshot)$/.test(key)) type='object';
  else if (/^(name|type|domain|category|group|variant|assetKind|profile|geometryMode|color|endColor|edgeColor|groundColor|gridColor|backgroundColor|groundMode|material|materialPresetId|materialPreset|pattern|shape|sizeMode|groundMaterial|backgroundTheme|mode|scope|scopeType|globalMode|pathType|repeatMode|endBehavior|surfaceType|editMode|boundaryKey|facade|doorLayout|stackOrder|hinge|originMode|target|wrap|unit|sourceType|sensorType|assetType|usageType|displayMode|fitDimension|palette|style|surfaceId|meshPath|meshName|imagePlane|representation|clipping|serialNumber|mountingIssue|side|status|partKind|authoringMode|metric|kind|colorKey|hex|signature|presetId|entityType|connectorType|role|primaryFileName|primaryFilePath|originalFileName|originalFormat|sourceKey|calibrationKey|sourceUrl|from|to|author|at)$/.test(key) || /At$/.test(key)) type='string';
  if (!type) return field.type;
  if (/\bnull\b/.test(field.expression) && !type.includes('null')) type+='|null';
  return type;
}
function selectedObjects(group) {
  const file = source(group.file);
  let scope = file.ast;
  if (group.symbol) {
    const matches = [];
    visit(scope, n => {
      if ((n.type === 'FunctionDeclaration' && n.id?.name === group.symbol)
        || (n.type === 'VariableDeclarator' && n.id?.name === group.symbol)) matches.push(n);
    });
    if (!matches.length) throw new Error(`Missing symbol ${group.file}:${group.symbol}`);
    scope = matches[0];
  }
  const objects = [];
  visit(scope, n => {
    if (n.type !== 'ObjectExpression') return;
    const keys = n.properties.map(keyOf).filter(Boolean);
    if (group.keys.every(k => keys.includes(k))) objects.push(n);
  });
  if (!objects.length) throw new Error(`Missing object ${group.name}: ${group.keys}`);
  return group.all ? objects : [objects[group.index ?? 0]];
}
function fieldsIn(file, object, prefix, output) {
  for (const p of object.properties) {
    if (p.type === 'SpreadElement') {
      if (p.argument.type === 'ObjectExpression') fieldsIn(file, p.argument, prefix, output);
      else if (p.argument.type === 'ConditionalExpression') {
        for (const branch of [p.argument.consequent, p.argument.alternate]) if (branch.type === 'ObjectExpression') fieldsIn(file, branch, prefix, output);
      } else output.push({ path: prefix ? `${prefix}.*` : '*', type: 'JSON (확장/병합)', expression: expr(file, p.argument), line: p.loc.start.line });
      continue;
    }
    const key = keyOf(p);
    if (key === null || key === undefined) { output.push({ path: `${prefix}.*`, type: 'JSON (동적 키)', expression: expr(file, p), line: p.loc.start.line }); continue; }
    const fieldPath = prefix ? `${prefix}.${key}` : String(key);
    output.push({ path: fieldPath, type: inferredType(p.value), expression: expr(file, p.value), line: p.loc.start.line });
    const descend = (value, nestedPath) => {
      if (!value) return;
      if (value.type === 'ObjectExpression') fieldsIn(file, value, nestedPath, output);
      else if (value.type === 'ArrayExpression') value.elements.forEach(v => descend(v, `${nestedPath}[]`));
      else if (value.type === 'ConditionalExpression' || value.type === 'LogicalExpression') {
        for (const v of [value.consequent, value.alternate, value.left, value.right]) descend(v, nestedPath);
      } else if (value.type === 'CallExpression') {
        const method = value.callee?.property?.name;
        if (method === 'freeze') descend(value.arguments[0], nestedPath);
        if (['map', 'from'].includes(method)) for (const arg of value.arguments) {
          if (arg.type === 'ArrowFunctionExpression' && arg.body.type === 'ObjectExpression') descend(arg.body, `${nestedPath}[]`);
        }
      }
    };
    descend(p.value, fieldPath);
  }
}
const groups = fieldGroups.map(g => {
  const fields = [];
  for (const object of selectedObjects(g)) fieldsIn(g.file, object, '', fields);
  const reviewed = fields.filter(f => !g.omit?.includes(f.path)).map(f => ({...f,type:reviewedType(g,f)}));
  return { ...g, fields: [...new Map(reviewed.map(f => [`${f.path}:${f.expression}`, f])).values()] };
});
for (const g of supplementalFields) { source(g.file); groups.push(g); }
const serializer = groups.find(g => g.name === 'Layout');
const rootFields = serializer.fields.filter(f => !f.path.includes('.') && !f.path.includes('[')).map(f => f.path);
if (rootFields.length !== 21 || new Set(rootFields).size !== 21) throw new Error('Review layout root contract: expected 21 distinct fields');
const pointer = value => value ? '/' + value.replaceAll('[]', '.{index}').split('.').join('/') : '';
function storageRoute(jsonPath) {
  const routes = [
    [/^\$calibration\.?/, 'dt_calibration.payload_json', '(project_id, binding_id, revision)'],
    [/^\$imageProcessing\.?/, 'dt_image_processing.payload_json', '(project_id, binding_id, revision)'],
    [/^\$assets\.(equipment|textures|custom)\[\]\.?/, 'dt_asset_version.definition_json', '(asset_id, record_kind=collection, frontend_asset_id=record.id)'],
    [/^\$archive\.?/, 'dt_asset.archive_manifest_json', '(asset_id)'],
    [/^\$rois\[\]\.?/, 'dt_roi_record.roi_json', '(project_id, roi_id)'],
    [/^\$operations\.?/, 'dt_user_state.operations_json', '(project_id, user_key)'],
    [/^\$registry\.?/, 'localStorage[digital-twin-projects-v1]', 'browser origin'],
  ];
  for(const [pattern,storage,rowKey] of routes) if(pattern.test(jsonPath)) return { storage, rowKey, dbJsonPointerTemplate:pointer(jsonPath.replace(pattern,'')) };
  return {storage:'dt_project_revision.layout_json',rowKey:'(project_id, revision)',dbJsonPointerTemplate:pointer(jsonPath)};
}
function projectionRoute(jsonPath) {
  if(jsonPath.startsWith('$'))return null;
  const canonical=jsonPath.replace(/^observationConfig\./,'');
  const routes=[
    [/^hierarchy\.nodes\[\]\.?/,'dt_scene_node.node_json'],
    [/^site(?:Objects|Paths)\[\]\.?/,'dt_scene_node.node_json'],
    [/^equipmentByFloorId\.\{floorId\}\[\]\.?/,'dt_equipment_instance.instance_json'],
    [/^roomScenes\.\{roomId\}\.equipment\[\]\.?/,'dt_equipment_instance.instance_json'],
    [/^roomScenes\.\{roomId\}\.worldStructures\[\]\.?/,'dt_structure.structure_json'],
    [/^floorPlansById\.\{floorId\}\.structures\[\]\.?/,'dt_structure.structure_json'],
    [/^verticalStructuresByBuildingId\.\{buildingId\}\[\]\.?/,'dt_structure.structure_json'],
    [/^roomScenes\.\{roomId\}\.?/,'dt_room_scene.scene_json'],
    [/^floorPlansById\.\{floorId\}\.?/,'dt_floor_plan.plan_json'],
    [/^viewerPreset\.virtualCameras\.\{equipmentId\}\[\]\.?/,'dt_camera_preset.camera_json'],
    [/^viewerPreset\.?/,'dt_viewer_settings.preset_json'],
    [/^equipmentAssetBindings\[\]\.?/,'dt_object_visual.binding_json'],
    [/^sensorBindings\[\]\.?/,'dt_sensor_visual.binding_json'],
    [/^observationPoints\[\]\.?/,'dt_spatial_roi.roi_json'],
    [/^serverBindings\[\]\.?/,'dt_server_binding.binding_json'],
    [/^hierarchy\.?/,'dt_scene_settings.hierarchy_json'],
    [/^observationWorkflow\.?/,'dt_scene_settings.workflow_json'],
    [/^siteEnvironment\.?/,'dt_scene_settings.environment_json'],
    [/^gridSettings\.?/,'dt_scene_settings.grid_json'],
  ];
  for(const [pattern,storage]of routes)if(pattern.test(canonical))return {storage,dbJsonPointerTemplate:pointer(canonical.replace(pattern,'')),canonicalSourcePath:canonical};
  return null;
}
const fields = groups.flatMap(g => g.paths.flatMap(base => g.fields.map(f => {
  const jsonPath=base==='$'?f.path:`${base}.${f.path}`;
  return {group:g.name,path:jsonPath,type:f.type,rule:f.expression,source:f.line?`${g.file}:${f.line}`:g.file,
    ...storageRoute(jsonPath),projection:projectionRoute(jsonPath),pointerTemplate:pointer(jsonPath)};
})));
const manifest = { contractDate: '2026-11-17', layoutVersion: 18,
  notation: '[] = ordered array member; {id} = dynamic dictionary key; * = preserved arbitrary keys. Source expressions are frontend normalization rules, not backend SQL DEFAULTs. Alternative branches are not simultaneous requirements.',
  aliases, rootFields, fields,
  sources: [...cache].sort(([a],[b]) => a.localeCompare(b)).map(([file,v]) => ({file,sha256:v.sha256})),
};
const escape = s => String(s).replace(/\|/g, '&#124;').replace(/\r?\n/g,' ').replace(/`/g,'&#96;');
const chapters = ['spatial','equipment','monitoring','assets','local'];
const outputs = new Map([['docs/viewer/data/viewer-json-field-index.json', JSON.stringify(manifest,null,2)+'\n']]);
for (const chapter of chapters) {
  const list = groups.filter(g => g.chapter === chapter);
  let md = `# 뷰어 JSON 필드 사전 — ${chapter}\n\n기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).\n\n이 파일은 \`node scripts/generate-viewer-field-reference.mjs\`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. \`JSON (식 참조)\`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.\n\n모든 경로의 기본 저장 위치는 \`dt_project_revision.layout_json\`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. \`[]\`는 배열 인덱스, \`{id}\`는 실제 ID, \`*\`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.\n\n`;
  for (const g of list) {
    const stores=[...new Set(g.paths.map(p=>storageRoute(p).storage))];
    const projections=[...new Set(g.paths.map(p=>projectionRoute(p)?.storage).filter(Boolean))];
    md += `## ${g.name}\n\n${g.description}\n\nJSON 위치: ${g.paths.map(p=>'`'+p+'`').join(', ')}.\n\n원본 저장: ${stores.map(s=>'`'+s+'`').join(', ')}.${projections.length ? ` 검색용 복제: ${projections.map(s=>'`'+s+'`').join(', ')}.` : ''} 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 \`rowKey\`, \`dbJsonPointerTemplate\`을 따른다. 근거: [${g.file}](../../../${g.file}).\n\n| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |\n|---|---|---|\n`;
    for (const f of g.fields) md += `| \`${escape(f.path)}\` | ${escape(f.type)} | ${escape(f.expression)} |\n`;
    md += '\n';
  }
  outputs.set(`docs/viewer/fields/viewer-json-${chapter}-fields.md`,"\uFEFF"+md);
}
for (const [file, content] of outputs) {
  if (check) { if (!fs.existsSync(path.join(root,file)) || fs.readFileSync(path.join(root,file),'utf8') !== content) throw new Error(`Stale documentation: ${file}`); }
  else fs.writeFileSync(path.join(root,file),content,'utf8');
}
console.log(`${check ? 'PASS' : 'Generated'}: ${groups.length} field groups, ${fields.length} path entries, ${rootFields.length} root keys, ${cache.size} source hashes.`);
