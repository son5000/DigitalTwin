const CONNECTABLE_PROFILES = new Set(["ROAD", "WALKWAY"]);
const MAX_ELEVATION_DELTA = 0.08;
const PARALLEL_EPSILON = 0.0001;

export const SITE_PATH_JUNCTION_TYPES = Object.freeze({
  STRAIGHT: "STRAIGHT",
  CURVE: "CURVE",
  L_CORNER: "L_CORNER",
  T_JUNCTION: "T_JUNCTION",
  CROSS: "CROSS",
  MULTI: "MULTI",
});

const JUNCTION_LABELS = Object.freeze({
  STRAIGHT: "직선 연결",
  CURVE: "곡선 연결",
  L_CORNER: "L자 곡선 연결",
  T_JUNCTION: "T자 교차로",
  CROSS: "십자 교차로",
  MULTI: "다중 교차로",
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalize2D(vector) {
  const length = Math.hypot(vector.x, vector.z);
  return length > 0.0001 ? { x: vector.x / length, z: vector.z / length } : { x: 1, z: 0 };
}

function rotatePoint(point, rotationY) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return {
    x: point.x * cosine + point.z * sine,
    z: -point.x * sine + point.z * cosine,
  };
}

function groupBy(items, getKey) {
  const groups = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function createWorldPoint(object, point) {
  const rotated = rotatePoint(point, finite(object.rotation?.y));
  return {
    x: finite(object.position?.x) + rotated.x,
    y: finite(object.position?.y) + finite(point?.elevation ?? point?.y, 0) + finite(object.dimensions?.height, 0.08),
    z: finite(object.position?.z) + rotated.z,
  };
}

export function assessSitePathElevationConnection(leftHeight, rightHeight, horizontalRun = 0) {
  const heightDifference = Math.abs(finite(leftHeight) - finite(rightHeight));
  const run = Math.max(0, finite(horizontalRun));
  const gradePercent = run > 0 ? heightDifference / run * 100 : Infinity;
  if (heightDifference <= MAX_ELEVATION_DELTA) return { status: "CONNECT", heightDifference, gradePercent, message: "높이가 일치합니다." };
  if (heightDifference <= 1.2 && run >= 4 && gradePercent <= 12) {
    return { status: "SUGGEST_GRADE", heightDifference, gradePercent, message: "자동 경사 연결을 사용할 수 있습니다." };
  }
  return { status: "GRADE_SEPARATED", heightDifference, gradePercent, message: "입체 교차 또는 별도 경사로가 필요합니다." };
}

function createSegment(object, start, end, segmentIndex) {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  return {
    id: `${object.id}:segment:${segmentIndex}`,
    objectId: object.id,
    profile: object.profile,
    segmentIndex,
    start,
    end,
    length,
    direction: normalize2D({ x: end.x - start.x, z: end.z - start.z }),
    width: Math.max(0.1, finite(object.path?.width, object.dimensions?.depth ?? 1)),
    appearance: { ...object.appearance },
    parameters: { ...object.parameters },
  };
}

export function getConnectableSitePathSegments(siteObjects) {
  return siteObjects.flatMap((object) => {
    const points = object.path?.points;
    if (!CONNECTABLE_PROFILES.has(object.profile) || object.visible === false || !Array.isArray(points) || points.length < 2) return [];
    const worldPoints = points.map((point) => createWorldPoint(object, point));
    return worldPoints.slice(0, -1)
      .map((start, segmentIndex) => createSegment(object, start, worldPoints[segmentIndex + 1], segmentIndex))
      .filter((segment) => segment.length >= 0.01);
  });
}

function createApproach(segment, position, direction, options = {}) {
  return {
    id: options.id ?? `${segment.id}:approach:${options.segmentT ?? 0}`,
    objectId: segment.objectId,
    profile: segment.profile,
    segmentId: segment.id,
    segmentIndex: segment.segmentIndex,
    segmentT: options.segmentT ?? 0,
    endpointIndex: options.endpointIndex ?? null,
    position,
    direction: normalize2D(direction),
    width: segment.width,
    segmentLength: segment.length,
    appearance: segment.appearance,
    parameters: segment.parameters,
    visible: true,
  };
}

function createEndpoint(segment, atStart, endpointIndex) {
  return createApproach(
    segment,
    atStart ? segment.start : segment.end,
    atStart ? segment.direction : { x: -segment.direction.x, z: -segment.direction.z },
    {
      id: `${segment.objectId}:${endpointIndex}`,
      endpointIndex,
      segmentT: atStart ? 0 : 1,
    },
  );
}

export function getConnectableSitePathEndpoints(siteObjects) {
  return [...groupBy(getConnectableSitePathSegments(siteObjects), (segment) => segment.objectId).values()]
    .flatMap((segments) => {
      const ordered = [...segments].sort((left, right) => left.segmentIndex - right.segmentIndex);
      return [createEndpoint(ordered[0], true, 0), createEndpoint(ordered.at(-1), false, ordered.length)];
    });
}

function projectPointToSegment(point, segment) {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 0.0001) return null;
  const t = ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) / lengthSquared;
  const position = {
    x: segment.start.x + dx * t,
    y: segment.start.y + (segment.end.y - segment.start.y) * t,
    z: segment.start.z + dz * t,
  };
  return { t, position, distance: Math.hypot(point.x - position.x, point.z - position.z) };
}

function segmentIntersection(left, right) {
  const leftX = left.end.x - left.start.x;
  const leftZ = left.end.z - left.start.z;
  const rightX = right.end.x - right.start.x;
  const rightZ = right.end.z - right.start.z;
  const denominator = leftX * rightZ - leftZ * rightX;
  if (Math.abs(denominator) < PARALLEL_EPSILON) return null;
  const deltaX = right.start.x - left.start.x;
  const deltaZ = right.start.z - left.start.z;
  const leftT = (deltaX * rightZ - deltaZ * rightX) / denominator;
  const rightT = (deltaX * leftZ - deltaZ * leftX) / denominator;
  if (leftT <= 0.02 || leftT >= 0.98 || rightT <= 0.02 || rightT >= 0.98) return null;
  return {
    leftT,
    rightT,
    position: {
      x: left.start.x + leftX * leftT,
      y: left.start.y + (left.end.y - left.start.y) * leftT,
      z: left.start.z + leftZ * leftT,
    },
  };
}

function getConnectionTolerance(left, right) {
  return Math.min(1.25, Math.max(0.35, Math.min(left.width, right.width) * 0.22));
}

function getMagneticSnapTolerance(left, right) {
  return Math.min(3, Math.max(0.75, Math.min(left.width, right.width) * 0.55));
}

function sameLevel(left, right) {
  return Math.abs(left.position.y - right.position.y) <= MAX_ELEVATION_DELTA;
}

function directionsOverlap(left, right) {
  return left.direction.x * right.direction.x + left.direction.z * right.direction.z > 0.94;
}

function endpointsConnect(left, right) {
  if (left.profile !== right.profile || left.objectId === right.objectId || !sameLevel(left, right)) return false;
  if (directionsOverlap(left, right)) return false;
  return Math.hypot(left.position.x - right.position.x, left.position.z - right.position.z)
    <= getConnectionTolerance(left, right);
}

function endpointsCanMagneticallySnap(left, right) {
  if (left.profile !== right.profile || left.objectId === right.objectId || !sameLevel(left, right)) return false;
  if (directionsOverlap(left, right)) return false;
  return Math.hypot(left.position.x - right.position.x, left.position.z - right.position.z)
    <= getMagneticSnapTolerance(left, right);
}

function getJunctionType(approaches) {
  if (approaches.length >= 5) return SITE_PATH_JUNCTION_TYPES.MULTI;
  if (approaches.length === 4) return SITE_PATH_JUNCTION_TYPES.CROSS;
  if (approaches.length === 3) return SITE_PATH_JUNCTION_TYPES.T_JUNCTION;
  if (approaches.length !== 2) return SITE_PATH_JUNCTION_TYPES.MULTI;
  const dot = approaches[0].direction.x * approaches[1].direction.x
    + approaches[0].direction.z * approaches[1].direction.z;
  if (dot < -0.94) return SITE_PATH_JUNCTION_TYPES.STRAIGHT;
  if (Math.abs(dot) <= 0.22) return SITE_PATH_JUNCTION_TYPES.L_CORNER;
  return SITE_PATH_JUNCTION_TYPES.CURVE;
}

function annotateSnapCandidate(candidate) {
  const type = candidate.targetSegment
    ? SITE_PATH_JUNCTION_TYPES.T_JUNCTION
    : getJunctionType([candidate.sourceEndpoint, candidate.targetEndpoint]);
  return { ...candidate, type, label: JUNCTION_LABELS[type] };
}

export function findSitePathMagneticSnap(activeObject, siteObjects) {
  if (!activeObject?.id) return null;
  const activeEndpoints = getConnectableSitePathEndpoints([activeObject]);
  if (!activeEndpoints.length) return null;
  const otherObjects = siteObjects.filter((object) => object.id !== activeObject.id);
  const targetEndpoints = getConnectableSitePathEndpoints(otherObjects);
  const targetSegments = getConnectableSitePathSegments(otherObjects);
  let nearest = null;

  activeEndpoints.forEach((sourceEndpoint) => {
    targetEndpoints.forEach((targetEndpoint) => {
      if (!endpointsCanMagneticallySnap(sourceEndpoint, targetEndpoint)) return;
      const distance = Math.hypot(
        sourceEndpoint.position.x - targetEndpoint.position.x,
        sourceEndpoint.position.z - targetEndpoint.position.z,
      );
      if (nearest && nearest.distance <= distance) return;
      nearest = {
        profile: sourceEndpoint.profile,
        distance,
        sourceEndpoint,
        targetEndpoint,
        offset: {
          x: targetEndpoint.position.x - sourceEndpoint.position.x,
          z: targetEndpoint.position.z - sourceEndpoint.position.z,
        },
      };
    });
    targetSegments.forEach((targetSegment) => {
      if (sourceEndpoint.profile !== targetSegment.profile) return;
      const projection = projectPointToSegment(sourceEndpoint.position, targetSegment);
      if (!projection || projection.t <= 0.08 || projection.t >= 0.92) return;
      if (Math.abs(sourceEndpoint.position.y - projection.position.y) > MAX_ELEVATION_DELTA) return;
      const directionDot = Math.abs(
        sourceEndpoint.direction.x * targetSegment.direction.x
        + sourceEndpoint.direction.z * targetSegment.direction.z,
      );
      if (directionDot > 0.94 || projection.distance > getMagneticSnapTolerance(sourceEndpoint, targetSegment)) return;
      if (nearest && nearest.distance <= projection.distance) return;
      const targetEndpoint = createApproach(targetSegment, projection.position, targetSegment.direction, {
        id: `${targetSegment.id}:anchor:1`, segmentT: projection.t,
      });
      nearest = {
        profile: sourceEndpoint.profile,
        distance: projection.distance,
        sourceEndpoint,
        targetEndpoint,
        targetSegment,
        offset: {
          x: projection.position.x - sourceEndpoint.position.x,
          z: projection.position.z - sourceEndpoint.position.z,
        },
      };
    });
  });
  return nearest ? annotateSnapCandidate(nearest) : null;
}

function findRoot(parents, index) {
  let root = index;
  while (parents[root] !== root) root = parents[root];
  while (parents[index] !== index) {
    const next = parents[index];
    parents[index] = root;
    index = next;
  }
  return root;
}

function union(parents, left, right) {
  const leftRoot = findRoot(parents, left);
  const rightRoot = findRoot(parents, right);
  if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
}

function cross(left, middle, right) {
  return (middle.x - left.x) * (right.z - left.z) - (middle.z - left.z) * (right.x - left.x);
}

function convexHull(points) {
  const unique = [...new Map(points.map((point) => [`${point.x.toFixed(5)}:${point.z.toFixed(5)}`, point])).values()]
    .sort((left, right) => left.x - right.x || left.z - right.z);
  if (unique.length <= 2) return unique;
  const lower = [];
  unique.forEach((point) => {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper = [];
  [...unique].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function roundPolygon(points, amount = 0.16, iterations = 2) {
  let rounded = points;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    rounded = rounded.flatMap((point, index) => {
      const next = rounded[(index + 1) % rounded.length];
      return [
        { x: point.x * (1 - amount) + next.x * amount, z: point.z * (1 - amount) + next.z * amount },
        { x: point.x * amount + next.x * (1 - amount), z: point.z * amount + next.z * (1 - amount) },
      ];
    });
  }
  return rounded;
}

export function buildSitePathJunctionPolygon(center, approaches, type) {
  const candidates = approaches.flatMap((approach) => {
    const defaultRadius = Math.max(approach.width * 0.58, 0.65);
    const requestedRadius = Math.max(0.25, finite(approach.parameters?.connectionRadius, defaultRadius));
    const depth = Math.min(approach.segmentLength * 0.42, Math.max(defaultRadius, requestedRadius));
    const normal = { x: -approach.direction.z, z: approach.direction.x };
    return [-1, 1].map((side) => ({
      x: center.x + approach.direction.x * depth + normal.x * approach.width / 2 * side,
      z: center.z + approach.direction.z * depth + normal.z * approach.width / 2 * side,
    }));
  });
  const hull = convexHull(candidates);
  if (hull.length < 3) return [];
  if (type === SITE_PATH_JUNCTION_TYPES.STRAIGHT) return hull;
  return roundPolygon(hull);
}

function dedupeApproaches(approaches) {
  return [...new Map(approaches.map((approach) => {
    const angle = Math.atan2(approach.direction.z, approach.direction.x);
    return [`${approach.segmentId}:${Math.round(angle * 1000)}`, approach];
  })).values()];
}

function getCandidateCenter(approaches) {
  return approaches.reduce((result, approach) => ({
    x: result.x + approach.position.x / approaches.length,
    y: result.y + approach.position.y / approaches.length,
    z: result.z + approach.position.z / approaches.length,
  }), { x: 0, y: 0, z: 0 });
}

function createJunction(approaches, centerOverride = null) {
  const uniqueApproaches = dedupeApproaches(approaches);
  const center = centerOverride ?? getCandidateCenter(uniqueApproaches);
  const type = getJunctionType(uniqueApproaches);
  return {
    id: uniqueApproaches.map((approach) => approach.id).sort().join("|"),
    profile: uniqueApproaches[0].profile,
    center,
    width: Math.max(...uniqueApproaches.map((approach) => approach.width)),
    radius: Math.max(...uniqueApproaches.map((approach) => (
      Math.max(approach.width * 0.58, finite(approach.parameters?.connectionRadius, 0.65))
    ))),
    type,
    label: JUNCTION_LABELS[type],
    straight: type === SITE_PATH_JUNCTION_TYPES.STRAIGHT,
    endpoints: uniqueApproaches,
    approaches: uniqueApproaches,
    objectIds: [...new Set(uniqueApproaches.map((approach) => approach.objectId))],
    polygon: buildSitePathJunctionPolygon(center, uniqueApproaches, type),
  };
}

function createSegmentApproaches(segment, position, segmentT) {
  return [
    createApproach(segment, position, { x: -segment.direction.x, z: -segment.direction.z }, {
      id: `${segment.id}:anchor:-1:${segmentT.toFixed(4)}`, segmentT,
    }),
    createApproach(segment, position, segment.direction, {
      id: `${segment.id}:anchor:1:${segmentT.toFixed(4)}`, segmentT,
    }),
  ];
}

function collectEndpointJunctionCandidates(endpoints) {
  const parents = endpoints.map((_, index) => index);
  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      if (endpointsConnect(endpoints[left], endpoints[right])) union(parents, left, right);
    }
  }
  const clusters = new Map();
  endpoints.forEach((endpoint, index) => {
    const root = findRoot(parents, index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(endpoint);
  });
  return [...clusters.values()]
    .filter((cluster) => new Set(cluster.map((endpoint) => endpoint.objectId)).size >= 2)
    .map((approaches) => ({ approaches, center: getCandidateCenter(approaches) }));
}

function collectInternalBendCandidates(segments) {
  return [...groupBy(segments, (segment) => segment.objectId).values()].flatMap((objectSegments) => {
    const ordered = [...objectSegments].sort((left, right) => left.segmentIndex - right.segmentIndex);
    return ordered.slice(0, -1).flatMap((left, index) => {
      const right = ordered[index + 1];
      if (Math.hypot(left.end.x - right.start.x, left.end.z - right.start.z) > 0.02) return [];
      const approaches = [
        createApproach(left, left.end, { x: -left.direction.x, z: -left.direction.z }, {
          id: `${left.id}:bend:end`, endpointIndex: left.segmentIndex + 1, segmentT: 1,
        }),
        createApproach(right, right.start, right.direction, {
          id: `${right.id}:bend:start`, endpointIndex: right.segmentIndex, segmentT: 0,
        }),
      ];
      const dot = approaches[0].direction.x * approaches[1].direction.x
        + approaches[0].direction.z * approaches[1].direction.z;
      return dot < -0.995 ? [] : [{ approaches, center: left.end }];
    });
  });
}

function collectEndpointSegmentCandidates(endpoints, segments, occupiedEndpointIds) {
  return endpoints.flatMap((endpoint) => {
    if (occupiedEndpointIds.has(endpoint.id)) return [];
    let nearest = null;
    segments.forEach((segment) => {
      if (endpoint.profile !== segment.profile || endpoint.objectId === segment.objectId) return;
      const projection = projectPointToSegment(endpoint.position, segment);
      if (!projection || projection.t <= 0.08 || projection.t >= 0.92) return;
      if (Math.abs(endpoint.position.y - projection.position.y) > MAX_ELEVATION_DELTA) return;
      const directionDot = Math.abs(
        endpoint.direction.x * segment.direction.x + endpoint.direction.z * segment.direction.z,
      );
      if (directionDot > 0.94 || projection.distance > getConnectionTolerance(endpoint, segment)) return;
      if (!nearest || projection.distance < nearest.distance) nearest = { segment, ...projection };
    });
    return nearest ? [{
      approaches: [endpoint, ...createSegmentApproaches(nearest.segment, nearest.position, nearest.t)],
      center: nearest.position,
    }] : [];
  });
}

function collectSegmentIntersectionCandidates(segments) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      if (left.objectId === right.objectId || left.profile !== right.profile) continue;
      if (Math.abs(left.start.y - right.start.y) > MAX_ELEVATION_DELTA) continue;
      const intersection = segmentIntersection(left, right);
      if (!intersection) continue;
      candidates.push({
        approaches: [
          ...createSegmentApproaches(left, intersection.position, intersection.leftT),
          ...createSegmentApproaches(right, intersection.position, intersection.rightT),
        ],
        center: intersection.position,
      });
    }
  }
  return candidates;
}

function mergeJunctionCandidates(candidates) {
  const groups = [];
  candidates.forEach((candidate) => {
    const profile = candidate.approaches[0]?.profile;
    const candidateWidth = Math.max(...candidate.approaches.map((approach) => approach.width));
    const group = groups.find((item) => (
      item.profile === profile
      && Math.abs(item.center.y - candidate.center.y) <= MAX_ELEVATION_DELTA
      && Math.hypot(item.center.x - candidate.center.x, item.center.z - candidate.center.z)
        <= Math.min(item.width, candidateWidth) * 0.16
    ));
    if (!group) {
      groups.push({ ...candidate, profile, width: candidateWidth });
      return;
    }
    group.approaches.push(...candidate.approaches);
    group.center = getCandidateCenter(group.approaches);
    group.width = Math.max(group.width, candidateWidth);
  });
  return groups.map((group) => createJunction(group.approaches, group.center));
}

function mergeTrimRanges(ranges) {
  const merged = [];
  [...ranges].sort((left, right) => left.start - right.start).forEach((range) => {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end + 0.001) {
      merged.push({ ...range });
      return;
    }
    previous.end = Math.max(previous.end, range.end);
    if (previous.type !== range.type) previous.type = SITE_PATH_JUNCTION_TYPES.MULTI;
  });
  return merged;
}

function buildRenderContexts(siteObjects, segments, junctions) {
  const contexts = Object.fromEntries(siteObjects
    .filter((object) => CONNECTABLE_PROFILES.has(object.profile))
    .map((object) => [object.id, { connectedEndpointIndexes: [], segmentTrims: {} }]));
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  junctions.forEach((junction) => {
    junction.approaches.forEach((approach) => {
      const context = contexts[approach.objectId];
      const segment = segmentMap.get(approach.segmentId);
      if (!context || !segment) return;
      if (approach.endpointIndex !== null) context.connectedEndpointIndexes.push(approach.endpointIndex);
      if (junction.type === SITE_PATH_JUNCTION_TYPES.STRAIGHT) return;
      const requestedRadius = Math.max(0.25, finite(approach.parameters?.connectionRadius, approach.width * 0.58));
      const cutDistance = Math.min(segment.length * 0.42, Math.max(approach.width * 0.58, requestedRadius) + 0.35);
      const along = segment.length * approach.segmentT;
      context.segmentTrims[segment.segmentIndex] ??= [];
      context.segmentTrims[segment.segmentIndex].push({
        start: approach.segmentT <= 0.001 ? 0 : Math.max(0, along - cutDistance),
        end: approach.segmentT >= 0.999 ? segment.length : Math.min(segment.length, along + cutDistance),
        junctionId: junction.id,
        type: junction.type,
      });
    });
  });
  Object.values(contexts).forEach((context) => {
    context.connectedEndpointIndexes = [...new Set(context.connectedEndpointIndexes)];
    Object.entries(context.segmentTrims).forEach(([segmentIndex, ranges]) => {
      context.segmentTrims[segmentIndex] = mergeTrimRanges(ranges);
    });
  });
  return contexts;
}

function buildGraph(segments, endpoints, junctions) {
  const nodes = junctions.map((junction) => ({
    id: `SITE_PATH_NODE:${junction.id}`,
    profile: junction.profile,
    position: junction.center,
    type: junction.type,
    edgeIds: [...new Set(junction.approaches.map((approach) => approach.segmentId))],
    objectIds: junction.objectIds,
  }));
  const connectedEndpointIds = new Set(junctions.flatMap((junction) => (
    junction.approaches.filter((approach) => approach.endpointIndex !== null).map((approach) => approach.id)
  )));
  endpoints.filter((endpoint) => !connectedEndpointIds.has(endpoint.id)).forEach((endpoint) => {
    nodes.push({
      id: `SITE_PATH_NODE:${endpoint.id}`,
      profile: endpoint.profile,
      position: endpoint.position,
      type: "END",
      edgeIds: [endpoint.segmentId],
      objectIds: [endpoint.objectId],
    });
  });
  return {
    nodes,
    edges: segments.map((segment) => ({
      id: segment.id,
      objectId: segment.objectId,
      profile: segment.profile,
      start: segment.start,
      end: segment.end,
      width: segment.width,
      length: segment.length,
    })),
  };
}

export function resolveSitePathNetwork(siteObjects) {
  const segments = getConnectableSitePathSegments(siteObjects);
  const endpoints = getConnectableSitePathEndpoints(siteObjects);
  const endpointCandidates = collectEndpointJunctionCandidates(endpoints);
  const occupiedEndpointIds = new Set(endpointCandidates.flatMap((candidate) => candidate.approaches.map((approach) => approach.id)));
  const junctions = mergeJunctionCandidates([
    ...endpointCandidates,
    ...collectInternalBendCandidates(segments),
    ...collectEndpointSegmentCandidates(endpoints, segments, occupiedEndpointIds),
    ...collectSegmentIntersectionCandidates(segments),
  ]);
  return {
    ...buildGraph(segments, endpoints, junctions),
    junctions,
    renderContextsByObjectId: buildRenderContexts(siteObjects, segments, junctions),
  };
}

export function resolveSitePathJunctions(siteObjects) {
  return resolveSitePathNetwork(siteObjects).junctions;
}
