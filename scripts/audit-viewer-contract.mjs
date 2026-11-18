import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'vite';

const root=path.resolve(import.meta.dirname,'..');
const read = file=>fs.readFileSync(path.join(root,file),'utf8');
const index=JSON.parse(read('docs/viewer/data/viewer-json-field-index.json'));
const catalog=JSON.parse(read('docs/viewer/data/viewer-template-catalog.json'));
for(const item of [...index.sources,...catalog.sources]) assert.equal(crypto.createHash('sha256').update(read(item.file)).digest('hex'),item.sha256,`Stale source: ${item.file}`);
const sql=read('docs/viewer/schema/viewer-configuration-schema.sql');
const tables=new Set([...sql.matchAll(/CREATE TABLE (dt_\w+)/g)].map(m=>m[1]));
for(const field of index.fields) for(const name of `${field.storage} ${field.projection?.storage??''}`.match(/dt_\w+/g)??[]) assert(tables.has(name),`Undefined DB table ${name}`);
const tableBodies=new Map([...sql.matchAll(/CREATE TABLE (dt_\w+) \(([\s\S]*?)\n\);/g)].map(m=>[m[1],m[2]]));
for(const field of index.fields) for(const location of [field.storage,field.projection?.storage]) {
  const match=location?.match(/^(dt_\w+)\.(\w+)$/);
  if(match) assert(new RegExp(`\\b${match[2]}\\s+(?:jsonb|text|uuid|bigint|integer|timestamptz)\\b`).test(tableBodies.get(match[1])??''),`Undefined DB column ${location}`);
}
assert.equal(index.fields.find(f=>f.path==='$calibration.model.scanAssets[].assetId')?.storage,'dt_calibration.payload_json');
assert.equal(index.fields.find(f=>f.path==='$assets.equipment[].primaryFileName')?.dbJsonPointerTemplate,'/primaryFileName');
assert.equal(index.fields.find(f=>f.path==='sensorBindings[].calibration.payload.projectId')?.storage,'dt_project_revision.layout_json');
const main=read('docs/viewer/viewer-json-database-contract.md');
for(const match of main.matchAll(/\]\(([^)]+)\)/g)) if(!/^(https?:|#)/.test(match[1])) {
  const target=path.resolve(root,'docs/viewer',match[1].split('#')[0]);
  if(!target.endsWith('viewer-layout-example.json') || !process.argv.includes('--write-example')) assert(fs.existsSync(target),`Broken document link: ${match[1]}`);
}
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'});
try {
  const load=relative=>server.ssrLoadModule('/src/features/digitalTwin/editor/'+relative);
  const {serializeLayout}=await load('api/layoutRepository.js');
  const {createDefaultHierarchy,createHierarchyNode}=await load('model/digitalTwinHierarchy.js');
  const {createObservationWorkflow}=await load('model/observationWorkflow.js');
  const {DEFAULT_SITE_ENVIRONMENT}=await load('constants/siteEnvironmentSettings.js');
  const {createDefaultGridSettings,createGridRegion}=await load('constants/gridSettings.js');
  const {createViewerPreset}=await load('model/viewerPreset.js');
  const {normalizeEquipmentInstance}=await load('utils/templateParameters.js');
  const {normalizeFloorSpatialPlan}=await load('model/floorSpatialModel.js');
  const {normalizeSensorBinding,normalizeObservationPoint,createEquipmentAssetBinding}=await load('model/equipmentDetailModel.js');
  const {normalizeSensorProjection}=await load('model/sensorImageTransform.js');
  const {getEnclosure}=await load('model/equipmentEnclosure.js');
  const {createEquipmentCoordinateFrame}=await load('model/equipmentCoordinateFrame.js');
  const {createSiteObjectFromArea}=await load('constants/siteEnvironmentTemplates.js');
  const {createDefaultMovementConfig}=await load('model/movementPath.js');
  const examplePath='docs/viewer/examples/viewer-layout-example.json';
  let layout;
  if(process.argv.includes('--write-example')) {
    const hierarchy=createDefaultHierarchy();
    const building=createHierarchyNode('BUILDING',hierarchy.rootId,0,{id:'BUILDING_EXAMPLE',name:'예제 건물'});
    const floor=createHierarchyNode('FLOOR',building.id,0,{id:'FLOOR_EXAMPLE',name:'1층'});
    hierarchy.nodes.push(building,floor); hierarchy.selectedNodeId=building.id;
    const template=catalog.catalogs.equipment.definitions.find(t=>t.id==='CONTROL_PANEL')??catalog.catalogs.equipment.definitions[0];
    const equipment=normalizeEquipmentInstance({id:'EQ_EXAMPLE',name:'예제 설비',floorId:floor.id,shapeTemplateId:template.id,
      parameters:template.defaultParameters,metadata:{manufacturer:'예제 제조사',model:'DEMO',serialNumber:'SN-001',assetTag:'TAG-001',description:'문서 검증용',modelComposition:'SHAPE',exteriorSelected:true},
      visible:false,locked:false,showNameLabel:true},template);
    equipment.enclosure=getEnclosure({...equipment,enclosure:{enabled:true,width:1.2,height:2,depth:.8,bodyLayout:'BACK_TO_BACK',doorCount:2,rear:{doorCount:2}}});
    equipment.metadata.coordinateFrame=createEquipmentCoordinateFrame(equipment,{x:-.6,y:0,z:.4},0,'CUSTOM');
    equipment.metadata.detailSetup={currentStep:'ASSET',steps:{BASIC:'DONE',ASSET:'PENDING',SENSOR:'PENDING',VIRTUAL_CAMERA:'PENDING',POINT:'PENDING',REVIEW:'PENDING'}};
    const sensor=normalizeSensorBinding({id:'SENSOR_EXAMPLE',name:'예제 카메라',equipmentIds:[equipment.id],serverSensorId:'SERVER_SENSOR_EXAMPLE',serialNumber:'CAM-001',capabilities:['VISION'],mountMode:'EQUIPMENT',calibrationConfirmed:false,
      textureProjection:normalizeSensorProjection({enabled:true,kind:'VISION',equipmentId:equipment.id,opacity:.5,rotation:15,cropX:.1,cropWidth:.8})});
    const point=normalizeObservationPoint({id:'ROI_EXAMPLE',equipmentId:equipment.id,name:'예제 관측영역',geometryType:'PLANE',localPosition:{x:0,y:1,z:.4},measurements:[{id:'VALUE_EXAMPLE',name:'초음파',metric:'ultrasound.db',unit:'dB',sensorId:'',visible:true,previewValue:0,rules:[{operator:'gte',threshold:60,severity:'WARNING'}]}]});
    const binding=createEquipmentAssetBinding(equipment.id,{assetId:'CABINET_SCAN_OBJ',name:'기본 제공 샘플',sourceKey:'/cabinet_3d_sample/Scan.obj',assetType:'OBJ'},{id:'ASSET_BINDING_EXAMPLE',displayMode:'PROXY'});
    const config={equipmentAssetBindings:[binding],sensorBindings:[sensor],observationPoints:[point],serverBindings:[]};
    const view={position:[3,2,3],target:[0,1,0],up:[0,1,0],zoom:1,fov:60,near:.01,far:500};
    const viewerPreset=createViewerPreset({equipmentViews:{[equipment.id]:view},virtualCameras:{[equipment.id]:[{id:'CAMERA_EXAMPLE',name:'정면 확인',view,doorState:{frontOpen:[false,true],rearOpen:[false,false]}}]},lighting:{ambient:0,key:2.4,fill:.7}});
    const siteTemplate=catalog.catalogs.siteAndBuilding.definitions.find(t=>t.assetKind==='VEHICLE');
    const object=siteTemplate?createSiteObjectFromArea(siteTemplate.id,{center:{x:10,z:5},width:5,depth:3},1):null;
    if(object) { object.id='SITE_OBJECT_EXAMPLE';object.movement=createDefaultMovementConfig(object.position); }
    layout=serializeLayout({name:'뷰어 JSON 계약 예제',projectStatus:'DRAFT',hierarchy,observationWorkflow:createObservationWorkflow('SITE'),viewerPreset,representativeImage:null,
      siteEnvironment:structuredClone(DEFAULT_SITE_ENVIRONMENT),sitePaths:[],siteObjects:object?[object]:[],gridSettings:{...createDefaultGridSettings(),regions:[createGridRegion(floor.id)]},roomScenes:{},
      floorPlansById:{[floor.id]:normalizeFloorSpatialPlan({floorId:floor.id,structures:[]},building)},verticalStructuresByBuildingId:{[building.id]:[]},equipmentByFloorId:{[floor.id]:[equipment]},observationConfig:config,...config});
    layout.savedAt='2026-11-17T00:00:00.000Z';
    fs.writeFileSync(path.join(root,examplePath),JSON.stringify(layout,null,2)+'\n','utf8');
  } else layout=JSON.parse(read(examplePath));
  assert.deepEqual(Object.keys(layout).sort(),[...index.rootFields].sort());
  const roundtrip=serializeLayout(layout);roundtrip.savedAt=layout.savedAt;
  assert.deepEqual(JSON.parse(JSON.stringify(roundtrip)),layout,'Example serializer round trip');
  // Check the documented types against an actual serializer output, including
  // dynamic owner IDs and arrays. This detects default-null/type confusion.
  let checkedTypes=0;
  for(const field of index.fields) {
    if(field.path.startsWith('$')||field.path.includes('*')||field.type.includes('JSON')) continue;
    let values=[layout];
    for(const segment of field.path.replaceAll('[]','.[index]').split('.')) values=values.flatMap(value=>{
      if(value==null)return[];
      if(segment==='[index]')return Array.isArray(value)?value:[];
      if(segment.startsWith('{'))return typeof value==='object'&&!Array.isArray(value)?Object.values(value):[];
      return Object.hasOwn(value,segment)?[value[segment]]:[];
    });
    for(const value of values) {
      const actual=value===null?'null':Array.isArray(value)?'array':typeof value;
      const allowed=field.type.split('|').map(type=>type.includes('[')?'array':type==='integer'?'number':type);
      assert(allowed.includes(actual),`${field.path}: documented ${field.type}, example ${actual}`);
      if(field.type==='integer')assert(Number.isInteger(value),`${field.path}: expected integer`);
      checkedTypes++;
    }
  }
  for(const key of ['equipmentAssetBindings','sensorBindings','observationPoints','serverBindings']) assert.deepEqual(layout[key],layout.observationConfig[key]);
  const probe=structuredClone(layout);
  probe.equipmentByFloorId['ID/~한글']=[{id:'opaque',metadata:{future:{zero:0,no:false,nil:null,empty:[],object:{},text:'',missing:undefined}}}];
  probe.gridSettings.gridSize=10;probe.gridSettings.siteSize=10;probe.gridSettings.worldGridSize=10;
  probe.floorPlansById.TEST={selectedSpatialEntity:{id:'temporary'},unknown:{persist:true}};
  probe.observationConfig.equipmentAssetBindings[0].objectUrl='blob:temporary';
  probe.roomScenes.TEST={detailAssets:[{id:'legacy',objectUrl:'blob:temporary',uploadProgress:100}]};
  const saved=JSON.parse(JSON.stringify(serializeLayout(probe)));
  assert.deepEqual(saved.equipmentByFloorId['ID/~한글'][0].metadata.future,{zero:0,no:false,nil:null,empty:[],object:{},text:''});
  assert(!('gridSize' in saved.gridSettings)&&!('siteSize' in saved.gridSettings)&&!('worldGridSize' in saved.gridSettings));
  assert(!('selectedSpatialEntity' in saved.floorPlansById.TEST));
  assert.equal(saved.floorPlansById.TEST.unknown.persist,true);
  assert(!('objectUrl' in saved.equipmentAssetBindings[0]));
  assert(!('objectUrl' in saved.roomScenes.TEST.detailAssets[0]));
  assert.equal(saved.roomScenes.TEST.detailAssets[0].uploadProgress,100);
  assert(Buffer.byteLength(JSON.stringify(layout),'utf8')<=1048576);
  assert(index.fields.some(f=>f.path==='observationPoints[].virtualCameraRegion.texture.sourceUvCorners'));
  assert(index.fields.some(f=>f.path==='sensorBindings[].textureProjection.perspective.source'));
  assert(index.fields.some(f=>f.path==='equipmentByFloorId.{floorId}[].enclosure.rear.doors[].angle'));
  console.log(`PASS: ${index.rootFields.length} roots, ${index.fields.length} path entries, ${checkedTypes} example type checks, ${tables.size} DB tables, source hashes/links, real serializer round trip, aliases, exclusions, unknown/null/false/zero preservation. PostgreSQL execution and live backend/UI not tested.`);
} finally {await server.close();}
