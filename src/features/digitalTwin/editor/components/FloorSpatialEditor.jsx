import { useMemo, useRef, useState } from "react";

import {
  ELEVATION_EDGE_TREATMENTS,
  ELEVATION_ZONE_SURFACES,
  FLOOR_FOOTPRINT_MODES,
  ROOM_EDIT_MODES,
  validateFloorSpatialPlan,
} from "@/features/digitalTwin/editor/model/floorSpatialModel";

import styles from "./FloorSpatialEditor.module.css";

const VIEW_SIZE = 300;
const PADDING = 28;

function NumericInput({ label, value, onChange, step = 0.05, min }) {
  return <label className={styles.field}><span>{label}</span><input type="number" value={value} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function pathData(points, transform) {
  if (!points?.length) return "";
  const commands = [`M ${transform.x(points[0].x)} ${transform.z(points[0].z)}`];
  points.forEach((item, index) => {
    const next = points[(index + 1) % points.length];
    if (item.curveToNext?.type === "QUADRATIC") {
      commands.push(`Q ${transform.x(item.curveToNext.x)} ${transform.z(item.curveToNext.z)} ${transform.x(next.x)} ${transform.z(next.z)}`);
    } else {
      commands.push(`L ${transform.x(next.x)} ${transform.z(next.z)}`);
    }
  });
  return `${commands.join(" ")} Z`;
}

function FootprintCanvas({ footprint, selectedRegionId, selectedVertexIndex, drawPoints = null, onDrawPoint, onSelectRegion, onSelectVertex, onVertexChange }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const transform = useMemo(() => {
    const points = footprint.regions.flatMap((region) => [...region.outer, ...region.holes.flat()]);
    const xs = points.map((item) => item.x); const zs = points.map((item) => item.z);
    const minX = Math.min(...xs, -5); const maxX = Math.max(...xs, 5);
    const minZ = Math.min(...zs, -5); const maxZ = Math.max(...zs, 5);
    const scale = Math.min((VIEW_SIZE - PADDING * 2) / (maxX - minX || 1), (VIEW_SIZE - PADDING * 2) / (maxZ - minZ || 1));
    const centerX = (minX + maxX) / 2; const centerZ = (minZ + maxZ) / 2;
    return {
      x: (value) => VIEW_SIZE / 2 + (value - centerX) * scale,
      z: (value) => VIEW_SIZE / 2 + (value - centerZ) * scale,
      inverseX: (value) => (value - VIEW_SIZE / 2) / scale + centerX,
      inverseZ: (value) => (value - VIEW_SIZE / 2) / scale + centerZ,
    };
  }, [footprint]);

  function move(event) {
    if (!dragRef.current || !svgRef.current) return;
    const bounds = svgRef.current.getBoundingClientRect();
    const x = Math.round(transform.inverseX((event.clientX - bounds.left) * VIEW_SIZE / bounds.width) * 10) / 10;
    const z = Math.round(transform.inverseZ((event.clientY - bounds.top) * VIEW_SIZE / bounds.height) * 10) / 10;
    onVertexChange(dragRef.current.regionId, dragRef.current.index, { x, z });
  }

  function draw(event) {
    if (!drawPoints || !svgRef.current) return;
    const bounds = svgRef.current.getBoundingClientRect();
    const x = Math.round(transform.inverseX((event.clientX - bounds.left) * VIEW_SIZE / bounds.width) * 10) / 10;
    const z = Math.round(transform.inverseZ((event.clientY - bounds.top) * VIEW_SIZE / bounds.height) * 10) / 10;
    onDrawPoint({ x, z });
  }

  return <svg ref={svgRef} className={styles.canvas} viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} role="application" aria-label="자유형 층 바닥 꼭짓점 편집기" onPointerDown={draw} onPointerMove={move} onPointerUp={() => { dragRef.current = null; }} onPointerLeave={() => { dragRef.current = null; }}>
    <rect width={VIEW_SIZE} height={VIEW_SIZE} className={styles.canvasBackground} />
    {footprint.regions.map((region) => <g key={region.id} onPointerDown={() => onSelectRegion(region.id)}>
      <path d={pathData(region.outer, transform)} className={region.id === selectedRegionId ? styles.regionSelected : styles.region} />
      {region.holes.map((hole, index) => <path key={`${region.id}-hole-${index}`} d={pathData(hole, transform)} className={styles.hole} />)}
      {region.id === selectedRegionId ? region.outer.map((item, index) => <circle
        key={`${region.id}-${index}-${item.x}-${item.z}`}
        cx={transform.x(item.x)} cy={transform.z(item.z)} r={index === selectedVertexIndex ? 7 : 5}
        className={index === selectedVertexIndex ? styles.vertexSelected : styles.vertex}
        role="button" tabIndex="0" aria-label={`바닥 꼭짓점 ${index + 1}`}
        onPointerDown={(event) => { event.stopPropagation(); if (drawPoints) { onDrawPoint({ x: item.x, z: item.z }); return; } event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { regionId: region.id, index }; onSelectVertex(index); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectVertex(index); }}
      />) : null}
    </g>)}
    {drawPoints?.length ? <><polyline points={drawPoints.map((item) => `${transform.x(item.x)},${transform.z(item.z)}`).join(" ")} className={styles.drawingLine} />{drawPoints.map((item, index) => <circle key={`${item.x}-${item.z}-${index}`} cx={transform.x(item.x)} cy={transform.z(item.z)} r="5" className={styles.vertexSelected} />)}</> : null}
  </svg>;
}

function FootprintSection({ plan, building, actions }) {
  const [selectedRegionId, setSelectedRegionId] = useState(plan.floorFootprint.regions[0]?.id ?? null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(0);
  const [drawMode, setDrawMode] = useState(null);
  const [drawPoints, setDrawPoints] = useState([]);
  const [exclusion, setExclusion] = useState({ x: 0, z: 0, width: 2, depth: 2 });
  const selectedRegion = plan.floorFootprint.regions.find((region) => region.id === selectedRegionId) ?? plan.floorFootprint.regions[0];
  const selectedVertex = selectedRegion?.outer[selectedVertexIndex] ?? selectedRegion?.outer[0];
  const nextVertex = selectedRegion?.outer[(selectedVertexIndex + 1) % (selectedRegion?.outer.length || 1)];
  const regionIds = plan.floorFootprint.regions.map((region) => region.id);
  const beginDrawing = (mode) => { setDrawMode(mode); setDrawPoints([]); };
  const finishDrawing = () => {
    if (drawPoints.length < 3) return;
    if (drawMode === "FLOOR") actions.drawFloorFootprintPolygon(drawPoints);
    else if (selectedRegion) actions.appendFloorFootprintHole(selectedRegion.id, [...drawPoints].reverse());
    setDrawMode(null); setDrawPoints([]);
  };
  const rectanglePoints = (width = exclusion.width, depth = exclusion.depth, x = exclusion.x, z = exclusion.z) => [
    { x: x - width / 2, z: z - depth / 2 }, { x: x + width / 2, z: z - depth / 2 },
    { x: x + width / 2, z: z + depth / 2 }, { x: x - width / 2, z: z + depth / 2 },
  ].reverse();
  return <section className={styles.section}>
    <div className={styles.segmented} role="group" aria-label="바닥 외형 모드">
      <button type="button" aria-pressed={plan.floorFootprint.mode === FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING} onClick={() => actions.setFloorFootprintMode(FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING)}>건물 외형 상속</button>
      <button type="button" aria-pressed={plan.floorFootprint.mode === FLOOR_FOOTPRINT_MODES.CUSTOM} onClick={() => actions.setFloorFootprintMode(FLOOR_FOOTPRINT_MODES.CUSTOM)}>자유형</button>
    </div>
    <FootprintCanvas footprint={plan.floorFootprint} selectedRegionId={selectedRegion?.id} selectedVertexIndex={selectedVertexIndex} drawPoints={drawMode ? drawPoints : null} onDrawPoint={(next) => setDrawPoints((current) => [...current, next])} onSelectRegion={(id) => { setSelectedRegionId(id); setSelectedVertexIndex(0); }} onSelectVertex={setSelectedVertexIndex} onVertexChange={(regionId, index, next) => actions.updateFloorFootprintVertex(regionId, "OUTER", 0, index, next)} />
    {selectedVertex ? <div className={styles.grid}><NumericInput label={`꼭짓점 ${selectedVertexIndex + 1} X`} value={selectedVertex.x} onChange={(x) => actions.updateFloorFootprintVertex(selectedRegion.id, "OUTER", 0, selectedVertexIndex, { ...selectedVertex, x })} /><NumericInput label="Z" value={selectedVertex.z} onChange={(z) => actions.updateFloorFootprintVertex(selectedRegion.id, "OUTER", 0, selectedVertexIndex, { ...selectedVertex, z })} /></div> : null}
    <div className={styles.actions}>
      <button type="button" onClick={() => beginDrawing("FLOOR")}>자유형 바닥 그리기</button>
      <button type="button" onClick={() => actions.appendFloorFootprintVertex(selectedRegion?.id)}>꼭짓점 추가</button>
      <button type="button" disabled={!selectedRegion || selectedRegion.outer.length <= 3} onClick={() => actions.deleteFloorFootprintVertex(selectedRegion.id, selectedVertexIndex)}>꼭짓점 삭제</button>
      <button type="button" disabled={!selectedVertex || !nextVertex} onClick={() => actions.updateFloorFootprintVertex(selectedRegion.id, "OUTER", 0, selectedVertexIndex, {
        ...selectedVertex,
        curveToNext: selectedVertex.curveToNext ? null : { type: "QUADRATIC", x: (selectedVertex.x + nextVertex.x) / 2, z: (selectedVertex.z + nextVertex.z) / 2 + 0.8 },
      })}>{selectedVertex?.curveToNext ? "선택 변 직선화" : "선택 변 곡선화"}</button>
      <button type="button" onClick={actions.appendFloorFootprintRegion}>영역 추가</button>
      <button type="button" onClick={() => actions.appendFloorFootprintHole(selectedRegion?.id)}>중정 만들기</button>
      <button type="button" disabled={regionIds.length < 2} onClick={() => actions.combineFloorFootprintRegions(regionIds)}>전체 영역 합치기</button>
      <button type="button" disabled={regionIds.length < 2} onClick={() => actions.subtractFloorFootprintRegions(regionIds[0], regionIds[1])}>2번 영역 빼기</button>
      <button type="button" onClick={() => actions.setFloorFootprintMode(FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING)}>{building?.name ?? "건축물"} 외형 복원</button>
    </div>
    {drawMode ? <div className={styles.detailBox}><p>{drawMode === "FLOOR" ? "바닥 외곽" : "비사용 영역"} 꼭짓점을 순서대로 찍으세요.</p><div className={styles.actions}><button type="button" disabled={drawPoints.length < 3} onClick={finishDrawing}>외곽선 닫기</button><button type="button" disabled={!drawPoints.length} onClick={() => setDrawPoints((current) => current.slice(0, -1))}>마지막 점 취소</button><button type="button" onClick={() => { setDrawMode(null); setDrawPoints([]); }}>취소</button></div></div> : null}
    <div className={styles.detailBox}>
      <strong>비사용 영역</strong>
      <div className={styles.grid}><NumericInput label="중심 X" value={exclusion.x} onChange={(x) => setExclusion((current) => ({ ...current, x }))} /><NumericInput label="중심 Z" value={exclusion.z} onChange={(z) => setExclusion((current) => ({ ...current, z }))} /><NumericInput label="너비 m" value={exclusion.width} min={0.2} onChange={(width) => setExclusion((current) => ({ ...current, width }))} /><NumericInput label="깊이 m" value={exclusion.depth} min={0.2} onChange={(depth) => setExclusion((current) => ({ ...current, depth }))} /></div>
      <div className={styles.actions}><button type="button" disabled={!selectedRegion} onClick={() => actions.appendFloorFootprintHole(selectedRegion.id, rectanglePoints())}>사각형 제외</button><button type="button" disabled={!selectedRegion} onClick={() => actions.appendFloorFootprintHole(selectedRegion.id, rectanglePoints(1, 1, Math.round(exclusion.x), Math.round(exclusion.z)))}>1m 격자 셀 제외</button><button type="button" disabled={!selectedRegion} onClick={() => beginDrawing("EXCLUSION")}>자유형 제외</button></div>
      {selectedRegion?.holes.length ? <div className={styles.list}>{selectedRegion.holes.map((hole, index) => <button key={index} type="button" onClick={() => actions.deleteFloorFootprintHole(selectedRegion.id, index)}><span>비사용 영역 {index + 1}</span><strong>{hole.length}점 · 재활성화</strong></button>)}</div> : <p className={styles.empty}>지정된 비사용 영역이 없습니다.</p>}
    </div>
  </section>;
}

function ElevationSection({ plan, actions, selectedSpatialEntity }) {
  const [zoneId, setZoneId] = useState(plan.elevationZones[0]?.id ?? null);
  const activeZoneId = selectedSpatialEntity?.type === "ELEVATION_ZONE" ? selectedSpatialEntity.id : zoneId;
  const zone = plan.elevationZones.find((item) => item.id === activeZoneId) ?? plan.elevationZones[0];
  if (!zone) return null;
  const millimeters = Math.round(zone.relativeHeight * 1000);
  return <section className={styles.section}>
    <div className={styles.list}>{plan.elevationZones.map((item) => <button type="button" key={item.id} aria-pressed={item.id === zone.id} onClick={() => { setZoneId(item.id); actions.selectSpatialEntity({ type: "ELEVATION_ZONE", id: item.id }); }}><span>{item.name}</span><strong>{item.relativeHeight >= 0 ? "+" : ""}{Math.round(item.relativeHeight * 1000)}mm</strong></button>)}</div>
    <label className={styles.range}><span>높이 드래그 <strong>{millimeters >= 0 ? "+" : ""}{millimeters}mm</strong></span><input type="range" min="-1000" max="2000" step="10" value={millimeters} onChange={(event) => actions.changeElevationZone(zone.id, { relativeHeight: Number(event.target.value) / 1000 })} /></label>
    <div className={styles.grid}>
      <NumericInput label="상대 높이 m" value={zone.relativeHeight} step={0.01} onChange={(relativeHeight) => actions.changeElevationZone(zone.id, { relativeHeight })} />
      <NumericInput label="슬래브 두께 m" value={zone.slabThickness} min={0.03} onChange={(slabThickness) => actions.changeElevationZone(zone.id, { slabThickness })} />
      <label className={styles.field}><span>표면</span><select value={zone.surfaceType} onChange={(event) => actions.changeElevationZone(zone.id, { surfaceType: event.target.value })}><option value={ELEVATION_ZONE_SURFACES.FLAT}>평탄</option><option value={ELEVATION_ZONE_SURFACES.SLOPED}>경사</option></select></label>
      <label className={styles.field}><span>가장자리</span><select value={zone.edgeTreatments?.default ?? ELEVATION_EDGE_TREATMENTS.STEP} onChange={(event) => actions.changeElevationZone(zone.id, { edgeTreatments: { ...zone.edgeTreatments, default: event.target.value } })}>{Object.entries({ STEP: "단차", STAIR: "계단", RAMP: "경사로", VERTICAL_FACE: "수직면", OPEN: "열린 가장자리" }).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {zone.surfaceType === ELEVATION_ZONE_SURFACES.SLOPED ? <><NumericInput label="경사 X" value={zone.slope.x} step={0.01} onChange={(x) => actions.changeElevationZone(zone.id, { slope: { x } })} /><NumericInput label="경사 Z" value={zone.slope.z} step={0.01} onChange={(z) => actions.changeElevationZone(zone.id, { slope: { z } })} /></> : null}
    </div>
    <div className={styles.actions}><button type="button" onClick={() => actions.createElevationZone({ name: `고도 영역 ${plan.elevationZones.length + 1}`, relativeHeight: 0.3 })}>영역 그리기</button><button type="button" onClick={() => actions.divideElevationZone(zone.id, "X")}>좌우 분할</button><button type="button" onClick={() => actions.divideElevationZone(zone.id, "Z")}>상하 분할</button></div>
  </section>;
}

function WallFields({ wall, actions }) {
  return <div className={styles.detailBox}>
    <label className={styles.check}><input type="checkbox" checked={wall.enabled} onChange={(event) => actions.changeSharedWall(wall.id, { enabled: event.target.checked })} /><span>벽 사용</span></label>
    <div className={styles.grid}><NumericInput label="높이 m" value={wall.height} min={0.1} onChange={(height) => actions.changeSharedWall(wall.id, { height })} /><NumericInput label="두께 m" value={wall.thickness} min={0.05} onChange={(thickness) => actions.changeSharedWall(wall.id, { thickness })} /><NumericInput label="시작 오프셋" value={wall.startOffset} min={0} onChange={(startOffset) => actions.changeSharedWall(wall.id, { startOffset, lengthMode: startOffset || wall.endOffset ? "PARTIAL" : "FULL" })} /><NumericInput label="종료 오프셋" value={wall.endOffset} min={0} onChange={(endOffset) => actions.changeSharedWall(wall.id, { endOffset, lengthMode: wall.startOffset || endOffset ? "PARTIAL" : "FULL" })} /></div>
    <div className={styles.grid}><label className={styles.field}><span>벽 재질</span><select value={wall.appearance.materialPreset} onChange={(event) => actions.changeSharedWall(wall.id, { appearance: { materialPreset: event.target.value } })}><option value="PAINTED_CONCRETE">도장 콘크리트</option><option value="WOOD">목재</option><option value="GLASS">유리</option><option value="PAINTED_STEEL">도장 강재</option></select></label><label className={styles.field}><span>벽 색상</span><input type="color" value={wall.appearance.color} onChange={(event) => actions.changeSharedWall(wall.id, { appearance: { color: event.target.value } })} /></label></div>
    <button type="button" className={styles.primary} disabled={!wall.enabled} onClick={() => actions.createDoor(wall.id)}>이 벽에 문 추가</button>
  </div>;
}

function RoomSection({ plan, actions, selectedSpatialEntity }) {
  const [roomId, setRoomId] = useState(plan.rooms[0]?.id ?? null);
  const [wallId, setWallId] = useState(null);
  const selectedWall = selectedSpatialEntity?.type === "WALL" ? plan.walls.find((item) => item.id === selectedSpatialEntity.id) : null;
  const selectedRoomId = selectedSpatialEntity?.type === "ROOM"
    ? selectedSpatialEntity.id
    : plan.rooms.find((item) => selectedWall?.roomIds.includes(item.id))?.id;
  const room = plan.rooms.find((item) => item.id === (selectedRoomId ?? roomId)) ?? plan.rooms[0];
  const roomWalls = room ? plan.walls.filter((wall) => room.wallIds.includes(wall.id)) : [];
  const activeWallId = selectedSpatialEntity?.type === "WALL" ? selectedSpatialEntity.id : wallId;
  const wall = roomWalls.find((item) => item.id === activeWallId) ?? roomWalls[0];
  return <section className={styles.section}>
    <button type="button" className={styles.primary} onClick={() => actions.createRoom({ width: 4, depth: 3 })}>기본 사각형 방 추가</button>
    <div className={styles.list}>{plan.rooms.map((item) => <button key={item.id} type="button" aria-pressed={item.id === room?.id} onClick={() => { setRoomId(item.id); setWallId(null); actions.selectSpatialEntity({ type: "ROOM", id: item.id }); }}><span>{item.name}</span><strong>{item.outline.length}면</strong></button>)}</div>
    {room ? <>
      <div className={styles.segmented}><button type="button" aria-pressed={room.editMode === ROOM_EDIT_MODES.SHAPE} onClick={() => actions.changeRoom(room.id, { editMode: ROOM_EDIT_MODES.SHAPE })}>방 형태 편집</button><button type="button" aria-pressed={room.editMode === ROOM_EDIT_MODES.WALL_DETAIL} onClick={() => actions.changeRoom(room.id, { editMode: ROOM_EDIT_MODES.WALL_DETAIL })}>벽 상세 편집</button></div>
      <label className={styles.field}><span>방 이름</span><input value={room.name} onChange={(event) => actions.changeRoom(room.id, { name: event.target.value })} /></label>
      {room.editMode === ROOM_EDIT_MODES.SHAPE ? <div className={styles.vertexGrid}>{room.outline.map((item, index) => <div key={index} className={styles.grid}><NumericInput label={`${index + 1} X`} value={item.x} onChange={(x) => actions.changeRoom(room.id, { outline: room.outline.map((point, target) => target === index ? { ...point, x } : point) })} /><NumericInput label="Z" value={item.z} onChange={(z) => actions.changeRoom(room.id, { outline: room.outline.map((point, target) => target === index ? { ...point, z } : point) })} /></div>)}</div> : <>
        <div className={styles.list}>{roomWalls.map((item, index) => <button type="button" key={item.id} aria-pressed={item.id === wall?.id} onClick={() => { setWallId(item.id); actions.selectSpatialEntity({ type: "WALL", id: item.id }); }}><span>벽 {index + 1}</span><strong>{item.roomIds.length > 1 ? "공유" : "단독"}</strong></button>)}</div>
        {wall ? <WallFields wall={wall} actions={actions} /> : null}
      </>}
    </> : <p className={styles.empty}>배치된 방이 없습니다.</p>}
  </section>;
}

function DoorSection({ plan, actions, selectedSpatialEntity }) {
  const [doorId, setDoorId] = useState(plan.doors[0]?.id ?? null);
  const activeDoorId = selectedSpatialEntity?.type === "DOOR" ? selectedSpatialEntity.id : doorId;
  const door = plan.doors.find((item) => item.id === activeDoorId) ?? plan.doors[0];
  if (!door) return <section className={styles.section}><p className={styles.empty}>방의 벽을 선택해 문을 추가하세요. 문은 벽 없이 배치할 수 없습니다.</p></section>;
  const updateSlot = (slot, changes) => actions.changeDoor(door.id, { appearanceSlots: { [slot]: { ...door.appearanceSlots[slot], ...changes } } });
  return <section className={styles.section}>
    <div className={styles.list}>{plan.doors.map((item) => <button type="button" key={item.id} aria-pressed={item.id === door.id} onClick={() => { setDoorId(item.id); actions.selectSpatialEntity({ type: "DOOR", id: item.id }); }}><span>{item.name}</span><strong>{item.active ? "활성" : "벽 비활성"}</strong></button>)}</div>
    <div className={styles.grid}><NumericInput label="벽 시작부터 m" value={door.offset} min={0} onChange={(offset) => actions.changeDoor(door.id, { offset })} /><NumericInput label="너비 m" value={door.width} min={0.5} onChange={(width) => actions.changeDoor(door.id, { width })} /><NumericInput label="높이 m" value={door.height} min={1.5} onChange={(height) => actions.changeDoor(door.id, { height })} /><label className={styles.field}><span>힌지</span><select value={door.hinge} onChange={(event) => actions.changeDoor(door.id, { hinge: event.target.value })}><option value="LEFT">좌측</option><option value="RIGHT">우측</option></select></label><label className={styles.field}><span>열림</span><select value={door.swing} onChange={(event) => actions.changeDoor(door.id, { swing: event.target.value })}><option value="IN">안쪽</option><option value="OUT">바깥쪽</option></select></label></div>
    <div className={styles.slotGrid}>{Object.entries({ leaf: "문짝", frame: "문틀", handle: "손잡이", glass: "유리" }).map(([slot, label]) => <label key={slot} className={styles.field}><span>{label} 색상</span><input type="color" value={door.appearanceSlots[slot].color} onChange={(event) => updateSlot(slot, { color: event.target.value })} /></label>)}</div>
    <button type="button" className={styles.danger} onClick={() => actions.deleteDoor(door.id)}>문 삭제 및 벽 복구</button>
  </section>;
}

export default function FloorSpatialEditor({ plan, building, structures = [], equipment = [], selectedSpatialEntity, actions }) {
  const [tab, setTab] = useState("FOOTPRINT");
  const selectedTab = selectedSpatialEntity?.type === "ELEVATION_ZONE"
    ? "ELEVATION"
    : ["ROOM", "WALL"].includes(selectedSpatialEntity?.type)
      ? "ROOM"
      : selectedSpatialEntity?.type === "DOOR" ? "DOOR" : null;
  const activeTab = selectedTab ?? tab;
  const issues = useMemo(() => validateFloorSpatialPlan(plan, structures, equipment), [equipment, plan, structures]);
  return <section className={styles.editor} aria-label="층 공간 구성">
    <header><strong>공간 구성</strong><small>바닥 · 단차 · 방 · 벽 부착 문</small></header>
    <nav className={styles.tabs}>{[["FOOTPRINT", "바닥"], ["ELEVATION", "단차"], ["ROOM", "방·벽"], ["DOOR", "문"]].map(([id, label]) => <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => { actions.selectSpatialEntity(null); setTab(id); }}>{label}</button>)}</nav>
    {activeTab === "FOOTPRINT" ? <FootprintSection plan={plan} building={building} actions={actions} /> : null}
    {activeTab === "ELEVATION" ? <ElevationSection plan={plan} actions={actions} selectedSpatialEntity={selectedSpatialEntity} /> : null}
    {activeTab === "ROOM" ? <RoomSection plan={plan} actions={actions} selectedSpatialEntity={selectedSpatialEntity} /> : null}
    {activeTab === "DOOR" ? <DoorSection plan={plan} actions={actions} selectedSpatialEntity={selectedSpatialEntity} /> : null}
    {issues.length ? <div className={styles.issues} role="status">{issues.slice(0, 5).map((issue, index) => <p key={`${issue.code}-${index}`} data-severity={issue.severity}>{issue.message}</p>)}</div> : <p className={styles.valid}>공간 모델이 유효합니다.</p>}
  </section>;
}
