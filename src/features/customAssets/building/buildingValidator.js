import { registerCustomAssetValidator } from "../core/customAssetValidation.js";
import { CUSTOM_ASSET_TYPES } from "../core/customAssetTypes.js";
import { BUILDING_ENTITY_TYPES, getMassBounds, normalizeBuildingAssembly, resolveConnectorPath } from "./buildingAssembly.js";
import { footprintArea } from "./buildingMetrics.js";

const EPSILON = 0.0001;
const MIN_EDGE_LENGTH = 0.2;
const MAX_COORDINATE = 2500;

function issue(path, message, severity = "error") { return { path, message, severity }; }
function orientation(a, b, c) { return Math.sign((b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z)); }
function segmentsIntersect(a, b, c, d) { return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b); }

function hasSelfIntersection(points) {
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    for (let other = index + 1; other < points.length; other += 1) {
      const otherNext = (other + 1) % points.length;
      if (index === other || nextIndex === other || otherNext === index) continue;
      if (segmentsIntersect(points[index], points[nextIndex], points[other], points[otherNext])) return true;
    }
  }
  return false;
}

function pointInsidePolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index];
    const b = points[previous];
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / ((b.z - a.z) || EPSILON) + a.x) inside = !inside;
  }
  return inside;
}

function validatePolygon(points, path, issues) {
  if (!Array.isArray(points) || points.length < 3) { issues.push(issue(path, "평면은 최소 3개의 꼭짓점이 필요합니다.")); return; }
  if (points.some(({ x, z }) => !Number.isFinite(x) || !Number.isFinite(z))) issues.push(issue(path, "평면 좌표에 잘못된 숫자가 있습니다."));
  if (points.some(({ x, z }) => Math.abs(x) > MAX_COORDINATE || Math.abs(z) > MAX_COORDINATE)) issues.push(issue(path, "건축물 크기는 축 기준 5km를 넘을 수 없습니다."));
  if (new Set(points.map(({ x, z }) => `${x.toFixed(4)}:${z.toFixed(4)}`)).size !== points.length) issues.push(issue(path, "중복된 꼭짓점이 있습니다."));
  if (points.some((point, index) => Math.hypot(points[(index + 1) % points.length].x - point.x, points[(index + 1) % points.length].z - point.z) < MIN_EDGE_LENGTH)) issues.push(issue(path, `모든 변은 ${MIN_EDGE_LENGTH}m 이상이어야 합니다.`));
  if (hasSelfIntersection(points)) issues.push(issue(path, "평면 외곽선이 서로 교차합니다."));
}

function rangesOverlap(a, b) { return a.topElevation > b.baseElevation + EPSILON && b.topElevation > a.baseElevation + EPSILON; }
function boundsOverlap(a, b) { return a.maxX >= b.minX && a.minX <= b.maxX && a.maxZ >= b.minZ && a.minZ <= b.maxZ; }

function validateRelationCycles(relations, issues) {
  const graph = new Map();
  relations.filter((relation) => ["supports", "above", "below"].includes(relation.type)).forEach((relation) => graph.set(relation.sourceEntityId, [...(graph.get(relation.sourceEntityId) ?? []), relation.targetEntityId]));
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    if ((graph.get(node) ?? []).some(visit)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  if ([...graph.keys()].some(visit)) issues.push(issue("relations", "지지·상하 관계 그래프에 순환 참조가 있습니다."));
}

export function validateCustomBuilding(source) {
  const asset = normalizeBuildingAssembly(source);
  const issues = [];
  if (!asset.levels.length) issues.push(issue("levels", "최소 1개의 층 정의가 필요합니다."));
  asset.levels.forEach((level, index) => {
    if (!Number.isFinite(level.baseElevation) || !Number.isFinite(level.topElevation) || level.topElevation <= level.baseElevation) issues.push(issue(`levels.${index}`, "층 종료 높이는 시작 높이보다 커야 합니다."));
    const previous = asset.levels[index - 1];
    if (previous && level.baseElevation < previous.topElevation - EPSILON) issues.push(issue(`levels.${index}`, "층 높이 구간이 이전 층과 중복됩니다."));
    if (previous && level.baseElevation > previous.topElevation + EPSILON) issues.push(issue(`levels.${index}`, "층 사이에 정의되지 않은 높이 구간이 있습니다.", "warning"));
  });
  const entityIds = new Set(asset.entities.map((entity) => entity.id));
  const masses = asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS);
  if (!masses.length) issues.push(issue("entities", "최소 1개의 건축 매스가 필요합니다."));
  masses.forEach((mass, index) => {
    const path = `entities.${index}`;
    validatePolygon(mass.footprint?.points, `${path}.footprint.points`, issues);
    (mass.footprint?.holes ?? []).forEach((hole, holeIndex) => {
      validatePolygon(hole, `${path}.footprint.holes.${holeIndex}`, issues);
      if (hole.some((point) => !pointInsidePolygon(point, mass.footprint.points))) issues.push(issue(path, "중정 Hole은 외곽 평면 안에 있어야 합니다."));
    });
    if (footprintArea(mass.footprint) <= EPSILON) issues.push(issue(path, "건축 매스 면적이 0입니다."));
    if (mass.verticalRange.topElevation - mass.verticalRange.baseElevation <= EPSILON) issues.push(issue(path, "건축 매스 높이가 0입니다."));
    if (!mass.levelIds.length) issues.push(issue(path, "매스가 어떤 층 높이와도 겹치지 않습니다."));
    if (mass.verticalRange.baseElevation > EPSILON) {
      const supported = masses.some((other) => other.id !== mass.id && other.verticalRange.topElevation >= mass.verticalRange.baseElevation - EPSILON && other.verticalRange.baseElevation < mass.verticalRange.baseElevation && boundsOverlap(getMassBounds(mass), getMassBounds(other)));
      if (!supported) issues.push(issue(path, `${mass.name}은 하부 매스와 접하지 않습니다. 의도한 캔틸레버인지 확인하세요.`, "warning"));
    }
  });
  asset.entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.CONNECTOR).forEach((connector, index) => {
    const path = `entities.connector.${index}`;
    const from = asset.entities.find((entity) => entity.id === connector.from?.entityId);
    const to = asset.entities.find((entity) => entity.id === connector.to?.entityId);
    if (!from || !to) issues.push(issue(path, "연결 통로가 존재하지 않는 매스를 참조합니다."));
    if (from?.entityType !== BUILDING_ENTITY_TYPES.MASS || to?.entityType !== BUILDING_ENTITY_TYPES.MASS) issues.push(issue(path, "연결 통로의 시작과 종료 대상은 건축 매스여야 합니다."));
    if (from?.id === to?.id) issues.push(issue(path, "연결 통로의 시작과 종료 매스가 같습니다."));
    if (connector.width < 0.8 || connector.height < 2) issues.push(issue(path, "통로 폭은 0.8m, 높이는 2m 이상이어야 합니다."));
    if (resolveConnectorPath(asset, connector).length < 2) issues.push(issue(path, "연결 통로의 시작점 또는 종료점이 없습니다."));
    if (from && !rangesOverlap(from.verticalRange, connector.verticalRange)) issues.push(issue(path, "연결 통로 높이가 시작 매스 범위를 벗어납니다."));
    if (to && !rangesOverlap(to.verticalRange, connector.verticalRange)) issues.push(issue(path, "연결 통로 높이가 종료 매스 범위를 벗어납니다."));
  });
  asset.viewGroups.forEach((group, index) => {
    if (group.entityIds.some((entityId) => !entityIds.has(entityId))) issues.push(issue(`viewGroups.${index}`, "관측 그룹에 삭제된 요소 참조가 남아 있습니다."));
  });
  asset.relations.forEach((relation, index) => {
    if (!entityIds.has(relation.sourceEntityId) || !entityIds.has(relation.targetEntityId)) issues.push(issue(`relations.${index}`, "관계 그래프에 잘못된 요소 참조가 있습니다."));
  });
  validateRelationCycles(asset.relations, issues);
  if ((asset.bounds?.width ?? 0) < 1 || (asset.bounds?.depth ?? 0) < 1) issues.push(issue("bounds", "건축물 폭과 깊이는 1m 이상이어야 합니다."));
  return issues;
}

registerCustomAssetValidator(CUSTOM_ASSET_TYPES.BUILDING, validateCustomBuilding);
