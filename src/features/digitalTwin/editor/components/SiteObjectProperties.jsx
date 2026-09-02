import { useEffect, useRef, useState } from "react";

import {
  MAX_TREE_COUNT,
  SITE_CREATION_TEMPLATE_MAP,
  SITE_MATERIAL_OPTIONS,
  SITE_OBJECT_GEOMETRY_MODES,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import { DeleteIcon } from "@/components/icons";
import {
  createSiteLinearPathChanges,
  getSiteLinearPathLength,
} from "@/features/digitalTwin/editor/utils/siteLinearPath";
import { collectTerrainFeatures, normalizeTerrainModel } from "@/features/digitalTwin/editor/terrain/TerrainModel";
import {
  getRecommendedGradeLimit,
  getVerticalPathMetrics,
  VERTICAL_PATH_MODES,
} from "@/features/digitalTwin/editor/terrain/VerticalPathModel";
import { OUTDOOR_PLACEMENT_MODES } from "@/features/digitalTwin/editor/model/outdoorEquipmentPlacement";
import {
  isMovableSiteObject,
  MOVEMENT_END_BEHAVIORS,
  MOVEMENT_PATH_TYPES,
  MOVEMENT_REPEAT_MODES,
  normalizeMovementConfig,
} from "@/features/digitalTwin/editor/model/movementPath";
import { formatFloorLevel, isUndergroundSiteObject } from "@/features/digitalTwin/editor/model/undergroundModel";

import NumericField from "./NumericField";
import { ObjectVariantSelector } from "./ObjectLibrary";
import styles from "./SiteObjectProperties.module.css";

const COLOR_PRESETS = ["#455A64", "#607D8B", "#78909C", "#9E9E9E", "#D7CCC8", "#795548", "#8D6E63", "#558B2F", "#2E7D32", "#00838F", "#1565C0", "#F9A825"];

function ParameterColorField({ label, value, onChange }) {
  const color = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#000000";
  return (
    <label className={styles.parameterColor}>
      <span>{label}</span>
      <span className={styles.parameterColorControl}>
        <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        <input
          value={color.toUpperCase()}
          aria-label={`${label} HEX 값`}
          onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export default function SiteObjectProperties({ object, siteEnvironment, siteObjects = [], buildings = [], floors = [], onChange, onDelete, onMovementEditStart }) {
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const colorControlRef = useRef(null);

  useEffect(() => {
    if (!isColorPaletteOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!colorControlRef.current?.contains(event.target)) setIsColorPaletteOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isColorPaletteOpen]);

  if (!object) return null;
  const template = SITE_CREATION_TEMPLATE_MAP[object.type];
  const isRepeated = object.geometryMode === SITE_OBJECT_GEOMETRY_MODES.CLUSTER;
  const hasSpacing = [SITE_OBJECT_GEOMETRY_MODES.CLUSTER, SITE_OBJECT_GEOMETRY_MODES.PERIMETER].includes(object.geometryMode);
  const isLinear = object.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR;
  const isRoad = object.profile === "ROAD";
  const isWalkway = object.profile === "WALKWAY";
  const isStairs = object.profile === "OUTDOOR_STAIRS";
  const isRamp = object.profile === "OUTDOOR_RAMP";
  const isTerrain = object.assetKind === "TERRAIN";
  const isOutdoorEquipment = object.assetKind === "OUTDOOR_EQUIPMENT";
  const isMovable = isMovableSiteObject(object);
  const isUnderground = isUndergroundSiteObject(object);
  const movement = isMovable ? normalizeMovementConfig(object.movement, object.position) : null;
  const isOutdoorStorage = isOutdoorEquipment && ["TANK", "SILO", "BASIN", "CLARIFIER", "WATER_TOWER"].some((key) => object.profile.includes(key));
  const supportsCardinalDirection = isRoad || isWalkway || isStairs || isRamp;
  const rotationDegrees = object.rotation.y * 180 / Math.PI;
  const cardinalRotation = ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360;
  const linearPathLength = isLinear ? getSiteLinearPathLength(object.path) : 0;
  const rampLandingLength = isRamp
    ? Math.min(object.dimensions.depth * 0.35, Math.max(0.4, Number(object.parameters.landingLength) || 1.5))
    : 0;
  const rampRunLength = isRamp ? Math.max(0.5, object.dimensions.depth - rampLandingLength * 2) : 0;
  const rampSlopePercent = isRamp ? object.dimensions.height / rampRunLength * 100 : 0;
  const terrainModel = siteEnvironment
    ? normalizeTerrainModel(siteEnvironment.terrain, siteEnvironment.width, siteEnvironment.depth, siteEnvironment.groundMaterial)
    : null;
  const verticalMetrics = (isRoad || isWalkway) && terrainModel
    ? getVerticalPathMetrics(object, terrainModel, collectTerrainFeatures(siteObjects))
    : null;
  const gradeLimit = getRecommendedGradeLimit(object.profile);

  return (
    <section className={styles.panel} aria-label={`${template.nameKo ?? template.name} 속성`}>
      <header className={styles.heading}>
        <span>환경 요소 / {template.nameKo ?? template.name}</span>
        <h2>{object.name}</h2>
      </header>

      <div className={styles.section}>
        <h3>기본 정보</h3>
        <label><span>이름</span><input value={object.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label><span>재질</span><select value={object.appearance.material} onChange={(event) => onChange({ appearance: { material: event.target.value } })}>{SITE_MATERIAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className={styles.color} ref={colorControlRef}>
          <span>{isRoad || isWalkway ? "표면 색상" : "색상"}</span>
          <button
            type="button"
            className={styles.colorTrigger}
            aria-haspopup="dialog"
            aria-expanded={isColorPaletteOpen}
            onClick={() => setIsColorPaletteOpen((open) => !open)}
          >
            <i style={{ backgroundColor: object.appearance.color }} aria-hidden="true" />
            <code>{object.appearance.color.toUpperCase()}</code>
          </button>
          {isColorPaletteOpen ? (
            <div className={styles.colorPalette} role="dialog" aria-label="오브젝트 색상 팔레트">
              <div className={styles.colorSwatches}>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`${color} 색상 적용`}
                    aria-pressed={object.appearance.color.toLowerCase() === color.toLowerCase()}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange({ appearance: { color } })}
                  />
                ))}
              </div>
              <label className={styles.colorHex}>
                <span>16진수</span>
                <input value={object.appearance.color.toUpperCase()} onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && onChange({ appearance: { color: event.target.value } })} />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <ObjectVariantSelector
        definition={template}
        value={object.variants}
        onChange={(variants) => onChange({ variants })}
      />

      {isOutdoorEquipment ? (
        <div className={styles.section}>
          <h3>옥외 배치와 상태</h3>
          <div className={styles.fields}>
            <label>
              <span>배치 위치</span>
              <select value={object.placement?.mode ?? OUTDOOR_PLACEMENT_MODES.GROUND} onChange={(event) => onChange({ placement: { ...object.placement, mode: event.target.value } })}>
                {(object.placementRules?.allowedModes ?? [OUTDOOR_PLACEMENT_MODES.GROUND]).map((mode) => <option key={mode} value={mode}>{({ GROUND: "야외 지면", ROOF: "옥상", WALL: "외벽", UNDERGROUND: "지하", ROAD_EDGE: "도로 주변" })[mode]}</option>)}
              </select>
            </label>
            <label><span>외관 상태</span><select value={object.parameters.condition ?? "NORMAL"} onChange={(event) => onChange({ parameters: { condition: event.target.value } })}><option value="NORMAL">정상</option><option value="WEATHERED">오염·풍화</option><option value="WORN">마모</option><option value="RUSTED">녹 발생</option></select></label>
          </div>
          <p>{object.placement?.buildingId ? `건축물 ${object.placement.buildingId}에 종속됨` : "배치 시 허용 위치에 자동 스냅됩니다."}</p>
        </div>
      ) : null}

      {isOutdoorStorage ? (
        <div className={styles.section}>
          <h3>저장·수위 설정</h3>
          <div className={styles.fields}>
            <NumericField label="용량" value={object.parameters.capacity ?? 0} min={0.1} max={10000} step={1} unit="m³" onChange={(capacity) => onChange({ parameters: { capacity } })} />
            <NumericField label="수위" value={(object.parameters.fillLevel ?? 0) * 100} min={0} max={100} step={1} unit="%" onChange={(fillLevel) => onChange({ parameters: { fillLevel: fillLevel / 100 } })} />
            <label><span>저장 물질</span><input value={object.parameters.storedMaterial ?? ""} onChange={(event) => onChange({ parameters: { storedMaterial: event.target.value } })} /></label>
            <NumericField label="입구" value={object.parameters.inletCount ?? 1} min={0} max={12} step={1} unit="개" onChange={(inletCount) => onChange({ parameters: { inletCount } })} />
            <NumericField label="출구" value={object.parameters.outletCount ?? 1} min={0} max={12} step={1} unit="개" onChange={(outletCount) => onChange({ parameters: { outletCount } })} />
            <label className={styles.toggle}><input type="checkbox" checked={object.parameters.openTop === true} onChange={(event) => onChange({ parameters: { openTop: event.target.checked } })} /><span>상부 개방</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={object.parameters.ladderEnabled !== false} onChange={(event) => onChange({ parameters: { ladderEnabled: event.target.checked } })} /><span>점검 사다리</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={object.parameters.railingEnabled !== false} onChange={(event) => onChange({ parameters: { railingEnabled: event.target.checked } })} /><span>안전 난간</span></label>
          </div>
        </div>
      ) : null}

      {isRoad ? (
        <div className={styles.section}>
          <h3>차선과 통행 방향</h3>
          <div className={styles.fields}>
            <NumericField label="연결 곡률 반경" value={object.parameters.connectionRadius} min={0.5} max={20} step={0.1} unit="m" onChange={(connectionRadius) => onChange({ parameters: { connectionRadius } })} />
            <NumericField label="차선 수" value={object.parameters.laneCount} min={1} max={8} step={1} unit="차선" onChange={(laneCount) => onChange({ parameters: { laneCount } })} />
            <label>
              <span>통행 방향</span>
              <select value={object.parameters.trafficDirection} onChange={(event) => onChange({ parameters: { trafficDirection: event.target.value } })}>
                <option value="TWO_WAY">양방향</option>
                <option value="ONE_WAY_FORWARD">경로 정방향 일방통행</option>
                <option value="ONE_WAY_REVERSE">경로 역방향 일방통행</option>
              </select>
            </label>
            <label>
              <span>차로 구분선</span>
              <select value={object.parameters.laneMarkingStyle} onChange={(event) => onChange({ parameters: { laneMarkingStyle: event.target.value } })}>
                <option value="DASHED">점선</option>
                <option value="SOLID">실선</option>
              </select>
            </label>
            <label>
              <span>중앙선</span>
              <select value={object.parameters.centerLineStyle} onChange={(event) => onChange({ parameters: { centerLineStyle: event.target.value } })}>
                <option value="DOUBLE_SOLID">복선 실선</option>
                <option value="DOUBLE_DASHED">복선 점선</option>
                <option value="SINGLE_SOLID">단선 실선</option>
                <option value="SINGLE_DASHED">단선 점선</option>
              </select>
            </label>
            <ParameterColorField label="차로 구분선 색상" value={object.parameters.laneColor} onChange={(laneColor) => onChange({ parameters: { laneColor } })} />
            <ParameterColorField label="중앙선 색상" value={object.parameters.centerLineColor} onChange={(centerLineColor) => onChange({ parameters: { centerLineColor } })} />
            <ParameterColorField label="가장자리선 색상" value={object.parameters.edgeLineColor} onChange={(edgeLineColor) => onChange({ parameters: { edgeLineColor } })} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={object.parameters.showDirectionArrows !== false} onChange={(event) => onChange({ parameters: { showDirectionArrows: event.target.checked } })} />
              <span>노면 방향 화살표 표시</span>
            </label>
          </div>
          <p>통행 방향은 경로의 시작점과 끝점을 기준으로 하며, 아래 배치 방향은 도로 전체를 회전합니다.</p>
        </div>
      ) : null}

      {isWalkway ? (
        <div className={styles.section}>
          <h3>인도 마감</h3>
          <div className={styles.fields}>
            <NumericField label="연결 곡률 반경" value={object.parameters.connectionRadius} min={0.25} max={10} step={0.1} unit="m" onChange={(connectionRadius) => onChange({ parameters: { connectionRadius } })} />
            <NumericField label="경계석 폭" value={object.parameters.curbWidth} min={0.08} max={0.6} unit="m" onChange={(curbWidth) => onChange({ parameters: { curbWidth } })} />
            <NumericField label="경계석 높이" value={object.parameters.curbHeight} min={0.04} max={0.4} unit="m" onChange={(curbHeight) => onChange({ parameters: { curbHeight } })} />
            <ParameterColorField label="경계석 색상" value={object.parameters.curbColor} onChange={(curbColor) => onChange({ parameters: { curbColor } })} />
            <ParameterColorField label="포장 줄눈 색상" value={object.parameters.jointColor} onChange={(jointColor) => onChange({ parameters: { jointColor } })} />
            <ParameterColorField label="점자 유도선 색상" value={object.parameters.tactileColor} onChange={(tactileColor) => onChange({ parameters: { tactileColor } })} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={object.parameters.tactileEnabled !== false} onChange={(event) => onChange({ parameters: { tactileEnabled: event.target.checked } })} />
              <span>점자 유도선 표시</span>
            </label>
          </div>
        </div>
      ) : null}

      {verticalMetrics ? (
        <div className={styles.section}>
          <h3>고도와 경사</h3>
          <div className={styles.fields}>
            <label>
              <span>지형 배치 방식</span>
              <select value={verticalMetrics.mode} onChange={(event) => onChange({ parameters: { verticalPathMode: event.target.value }, path: { elevationMode: event.target.value } })}>
                <option value={VERTICAL_PATH_MODES.FOLLOW_TERRAIN}>지형 추종</option>
                <option value={VERTICAL_PATH_MODES.FIXED_GRADE}>고정 경사</option>
                <option value={VERTICAL_PATH_MODES.USER_PATH}>사용자 경로</option>
                <option value={VERTICAL_PATH_MODES.CUT_FILL}>지형 절토·성토</option>
                <option value={VERTICAL_PATH_MODES.ELEVATED}>고가 도로</option>
              </select>
            </label>
            {verticalMetrics.mode !== VERTICAL_PATH_MODES.FOLLOW_TERRAIN ? (
              <>
                <NumericField label="시작 높이" value={object.parameters.startElevation} min={-40} max={80} step={0.1} unit="m" onChange={(startElevation) => onChange({ parameters: { startElevation } })} />
                <NumericField label="종료 높이" value={object.parameters.endElevation} min={-40} max={80} step={0.1} unit="m" onChange={(endElevation) => onChange({ parameters: { endElevation } })} />
                <NumericField label="수직 곡선" value={object.parameters.verticalCurveLength} min={0} max={40} step={0.5} unit="m" onChange={(verticalCurveLength) => onChange({ parameters: { verticalCurveLength } })} />
              </>
            ) : null}
            {verticalMetrics.mode === VERTICAL_PATH_MODES.ELEVATED ? (
              <NumericField label="교각 간격" value={object.parameters.supportSpacing ?? 12} min={4} max={40} step={1} unit="m" onChange={(supportSpacing) => onChange({ parameters: { supportSpacing } })} />
            ) : null}
          </div>
          <dl className={styles.metrics}>
            <div><dt>시작</dt><dd>{verticalMetrics.startHeight.toFixed(2)} m</dd></div>
            <div><dt>종료</dt><dd>{verticalMetrics.endHeight.toFixed(2)} m</dd></div>
            <div><dt>높이 차</dt><dd>{verticalMetrics.heightDifference.toFixed(2)} m</dd></div>
            <div><dt>수평 길이</dt><dd>{verticalMetrics.horizontalLength.toFixed(2)} m</dd></div>
            <div><dt>경사도</dt><dd>{verticalMetrics.gradePercent.toFixed(2)}%</dd></div>
            <div><dt>경사각</dt><dd>{verticalMetrics.gradeAngle.toFixed(2)}°</dd></div>
          </dl>
          {Math.abs(verticalMetrics.gradePercent) > gradeLimit ? <p className={styles.gradeWarning}>권장 경사 {gradeLimit}%를 초과했습니다.</p> : null}
        </div>
      ) : null}

      {isUnderground ? (
        <div className={styles.section}>
          <h3>지하 연결</h3>
          <div className={styles.fields}>
            <label>
              <span>대상 건축물</span>
              <select value={object.undergroundConnection?.targetBuildingId ?? ""} onChange={(event) => {
                const targetBuildingId = event.target.value || null;
                const targetFloor = floors.find((floor) => floor.parentId === targetBuildingId && Number(floor.level) === -1);
                onChange({ undergroundConnection: { targetBuildingId, targetFloorId: targetFloor?.id ?? null, endPoint: { ...object.undergroundConnection?.endPoint, y: targetFloor?.elevation ?? -3.6 } } });
              }}>
                <option value="">자동 연결</option>
                {buildings.filter((building) => floors.some((floor) => floor.parentId === building.id && Number(floor.level) < 0)).map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
              </select>
            </label>
            <label>
              <span>대상 지하층</span>
              <select value={object.undergroundConnection?.targetFloorId ?? ""} onChange={(event) => {
                const targetFloor = floors.find((floor) => floor.id === event.target.value);
                onChange({ undergroundConnection: { targetFloorId: targetFloor?.id ?? null, targetBuildingId: targetFloor?.parentId ?? object.undergroundConnection?.targetBuildingId, endPoint: { ...object.undergroundConnection?.endPoint, y: targetFloor?.elevation ?? -3.6 } } });
              }}>
                <option value="">자동 연결</option>
                {floors.filter((floor) => Number(floor.level) < 0 && (!object.undergroundConnection?.targetBuildingId || floor.parentId === object.undergroundConnection.targetBuildingId)).map((floor) => <option key={floor.id} value={floor.id}>{formatFloorLevel(floor.level)} · {floor.name}</option>)}
              </select>
            </label>
            <NumericField label="시작 높이" value={object.undergroundConnection?.startPoint?.y ?? 0} min={-50} max={20} unit="m" onChange={(y) => onChange({ undergroundConnection: { startPoint: { ...object.undergroundConnection?.startPoint, y } } })} />
            <NumericField label="종료 높이" value={object.undergroundConnection?.endPoint?.y ?? -3.6} min={-80} max={0} unit="m" onChange={(y) => onChange({ undergroundConnection: { endPoint: { ...object.undergroundConnection?.endPoint, y } } })} />
            <NumericField label="개구부 너비" value={object.undergroundConnection?.openingWidth ?? object.dimensions.width} min={0.6} unit="m" onChange={(openingWidth) => onChange({ undergroundConnection: { openingWidth } })} />
          </div>
          <p>지면과 대상 지하층 바닥에 연결 개구부가 생성되며 연결 높이는 실제 저장 좌표입니다.</p>
        </div>
      ) : null}

      {isMovable ? (
        <div className={styles.section}>
          <h3>이동 경로</h3>
          <div className={styles.fields}>
            <label className={styles.toggle}><input type="checkbox" checked={movement.enabled} onChange={(event) => onChange({ movement: { ...movement, enabled: event.target.checked } })} /><span>이동 사용</span></label>
            <label><span>경로 방식</span><select value={movement.pathType} onChange={(event) => onChange({ movement: { ...movement, pathType: event.target.value } })}><option value={MOVEMENT_PATH_TYPES.LINEAR}>직선 연결</option><option value={MOVEMENT_PATH_TYPES.CURVE}>곡선 연결</option></select></label>
            <NumericField label="시작 시간" value={movement.startTime} min={0} unit="초" onChange={(startTime) => onChange({ movement: { ...movement, startTime } })} />
            <NumericField label="이동 속도" value={movement.speed} min={0.05} unit="m/s" onChange={(speed) => onChange({ movement: { ...movement, speed } })} />
            <NumericField label="기본 대기" value={movement.waitTime} min={0} unit="초" onChange={(waitTime) => onChange({ movement: { ...movement, waitTime } })} />
            <label><span>반복 방식</span><select value={movement.repeatMode} onChange={(event) => onChange({ movement: { ...movement, repeatMode: event.target.value } })}><option value={MOVEMENT_REPEAT_MODES.ONCE}>1회 실행</option><option value={MOVEMENT_REPEAT_MODES.LOOP}>반복</option><option value={MOVEMENT_REPEAT_MODES.PING_PONG}>왕복</option></select></label>
            <label><span>종료 동작</span><select value={movement.endBehavior} onChange={(event) => onChange({ movement: { ...movement, endBehavior: event.target.value } })}><option value={MOVEMENT_END_BEHAVIORS.HOLD}>종료 위치 유지</option><option value={MOVEMENT_END_BEHAVIORS.RESET}>시작 위치 복귀</option><option value={MOVEMENT_END_BEHAVIORS.HIDE}>숨기기</option></select></label>
          </div>
          <button type="button" onClick={onMovementEditStart}>월드에서 경유점 추가</button>
          <div className={styles.fields}>
            {movement.waypoints.map((waypoint, index) => (
              <div key={waypoint.id}>
                <strong>{index + 1}번 경유점</strong>
                <label><span>소속 층</span><select value={waypoint.floorId ?? ""} onChange={(event) => {
                  const floor = floors.find((item) => item.id === event.target.value);
                  onChange({ movement: { ...movement, waypoints: movement.waypoints.map((item) => item.id === waypoint.id ? { ...item, floorId: floor?.id ?? null, y: floor?.elevation ?? item.y } : item) } });
                }}><option value="">지형·월드 높이</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>{formatFloorLevel(floor.level)} · {floor.name}</option>)}</select></label>
                <NumericField label="X" value={waypoint.x} unit="m" onChange={(x) => onChange({ movement: { ...movement, waypoints: movement.waypoints.map((item) => item.id === waypoint.id ? { ...item, x } : item) } })} />
                <NumericField label="Y" value={waypoint.y} unit="m" onChange={(y) => onChange({ movement: { ...movement, waypoints: movement.waypoints.map((item) => item.id === waypoint.id ? { ...item, y } : item) } })} />
                <NumericField label="Z" value={waypoint.z} unit="m" onChange={(z) => onChange({ movement: { ...movement, waypoints: movement.waypoints.map((item) => item.id === waypoint.id ? { ...item, z } : item) } })} />
                <NumericField label="대기" value={waypoint.waitTime} min={0} unit="초" onChange={(waitTime) => onChange({ movement: { ...movement, waypoints: movement.waypoints.map((item) => item.id === waypoint.id ? { ...item, waitTime } : item) } })} />
                <button type="button" disabled={movement.waypoints.length <= 2} onClick={() => onChange({ movement: { ...movement, waypoints: movement.waypoints.filter((item) => item.id !== waypoint.id) } })}>경유점 삭제</button>
              </div>
            ))}
          </div>
          <p>{object.assetKind === "PERSON" ? "내장 보행 동작 지원" : "경로 방향 회전과 바퀴 회전 지원"} · 외부 모델 애니메이션 클립은 있을 때 자동 사용합니다.</p>
        </div>
      ) : null}

      {isStairs ? (
        <div className={styles.section}>
          <h3>계단 구성</h3>
          <div className={styles.fields}>
            <NumericField label="단 수" value={object.parameters.stepCount} min={2} max={40} step={1} unit="단" onChange={(stepCount) => onChange({ parameters: { stepCount } })} />
            <ParameterColorField label="난간 색상" value={object.parameters.railingColor} onChange={(railingColor) => onChange({ parameters: { railingColor } })} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={object.parameters.railingEnabled !== false} onChange={(event) => onChange({ parameters: { railingEnabled: event.target.checked } })} />
              <span>안전 난간 표시</span>
            </label>
          </div>
        </div>
      ) : null}

      {isRamp ? (
        <div className={styles.section}>
          <h3>경사로 구성</h3>
          <div className={styles.fields}>
            <NumericField
              label="경사도"
              value={Number(rampSlopePercent.toFixed(2))}
              min={1}
              max={50}
              step={0.1}
              unit="%"
              onChange={(slopePercent) => onChange({ dimensions: { height: rampRunLength * slopePercent / 100 } })}
            />
            <NumericField label="시작·도착 참 길이" value={object.parameters.landingLength} min={0.4} max={object.dimensions.depth * 0.35} unit="m" onChange={(landingLength) => onChange({ parameters: { landingLength } })} />
            <NumericField label="바닥 두께" value={object.parameters.surfaceThickness} min={0.08} max={0.35} unit="m" onChange={(surfaceThickness) => onChange({ parameters: { surfaceThickness } })} />
            <NumericField label="양측 턱 높이" value={object.parameters.curbHeight} min={0.06} max={0.35} unit="m" onChange={(curbHeight) => onChange({ parameters: { curbHeight } })} />
            <ParameterColorField label="양측 턱 색상" value={object.parameters.curbColor} onChange={(curbColor) => onChange({ parameters: { curbColor } })} />
            <ParameterColorField label="난간 색상" value={object.parameters.railingColor} onChange={(railingColor) => onChange({ parameters: { railingColor } })} />
            <ParameterColorField label="점자 경고판 색상" value={object.parameters.tactileColor} onChange={(tactileColor) => onChange({ parameters: { tactileColor } })} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={object.parameters.railingEnabled !== false} onChange={(event) => onChange({ parameters: { railingEnabled: event.target.checked } })} />
              <span>안전 난간 표시</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={object.parameters.tactileEnabled !== false} onChange={(event) => onChange({ parameters: { tactileEnabled: event.target.checked } })} />
              <span>시작·도착 점자 경고판 표시</span>
            </label>
          </div>
          <p>전체 길이에서 시작·도착 참을 제외한 실제 오름 구간을 기준으로 경사도를 계산합니다.</p>
        </div>
      ) : null}

      {isTerrain ? (
        <div className={styles.section}>
          <h3>지형 형상</h3>
          <NumericField label="사면 비율" value={object.parameters.slopeRatio} min={0.08} max={0.42} step={0.01} onChange={(slopeRatio) => onChange({ parameters: { slopeRatio } })} />
          <label><span>측면 처리</span><select value={object.parameters.edgeMode ?? "SLOPE"} onChange={(event) => onChange({ parameters: { edgeMode: event.target.value } })}><option value="SLOPE">사면</option><option value="RETAINING_WALL">옹벽</option></select></label>
          {["ASPHALT_PLATEAU", "CONCRETE_PLATFORM", "HIGH_GROUND"].includes(object.profile) ? (
            <div className={styles.fields}>
              <NumericField label="진입 경사로 수" value={object.parameters.rampCount ?? 0} min={0} max={4} step={1} unit="개" onChange={(rampCount) => onChange({ parameters: { rampCount } })} />
              <NumericField label="진입 경사로 폭" value={object.parameters.rampWidth ?? 3} min={1.5} max={12} step={0.5} unit="m" onChange={(rampWidth) => onChange({ parameters: { rampWidth } })} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.section}>
        <h3>{isLinear ? "경로와 폭" : "크기"}</h3>
        <div className={styles.fields}>
          <NumericField
            label={isLinear ? "경로 길이" : "가로"}
            value={isLinear ? linearPathLength : object.dimensions.width}
            min={0.1}
            unit="m"
            onChange={(value) => onChange(isLinear
              ? createSiteLinearPathChanges(object, { length: value })
              : { dimensions: { width: value } })}
          />
          <NumericField
            label={isLinear ? "경로 폭" : "세로"}
            value={isLinear ? object.path.width : object.dimensions.depth}
            min={0.1}
            unit="m"
            onChange={(value) => onChange(isLinear
              ? createSiteLinearPathChanges(object, { width: value })
              : { dimensions: { depth: value } })}
          />
          <NumericField label={isTerrain ? (object.profile === "LOW_GROUND" ? "깊이" : "고도") : "높이"} value={object.dimensions.height} min={0.02} unit="m" onChange={(height) => onChange({ dimensions: { height } })} />
          {isRepeated && <NumericField
            label="개수"
            value={object.parameters.count}
            min={1}
            max={object.assetKind === "VEGETATION" ? MAX_TREE_COUNT : 64}
            step={1}
            unit="개"
            onChange={(count) => onChange({ parameters: { count } })}
          />}
          {hasSpacing && <NumericField label="기둥 간격" value={object.parameters.spacing} min={0.5} unit="m" onChange={(spacing) => onChange({ parameters: { spacing } })} />}
        </div>
      </div>

      <div className={styles.section}>
        <h3>위치와 회전</h3>
        <div className={styles.fields}>
          <NumericField label="위치 X" value={object.position.x} unit="m" onChange={(x) => onChange({ position: { x } })} />
          <NumericField label="위치 Y" value={object.position.y} unit="m" onChange={(y) => onChange({ position: { y } })} />
          <NumericField label="위치 Z" value={object.position.z} unit="m" onChange={(z) => onChange({ position: { z } })} />
          <NumericField label="회전 Y" value={object.rotation.y * 180 / Math.PI} unit="°" onChange={(degrees) => onChange({ rotation: { y: degrees * Math.PI / 180 } })} />
          {supportsCardinalDirection ? (
            <label>
              <span>빠른 배치 방향</span>
              <select value={cardinalRotation} onChange={(event) => onChange({ rotation: { y: Number(event.target.value) * Math.PI / 180 } })}>
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <button type="button" className={styles.deleteButton} onClick={onDelete}><DeleteIcon size={16} /> 환경 요소 삭제</button>
    </section>
  );
}
