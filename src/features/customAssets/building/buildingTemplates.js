const point = (x, z) => ({ x, z });

function rectangle(width, depth) {
  return [point(-width / 2, -depth / 2), point(width / 2, -depth / 2), point(width / 2, depth / 2), point(-width / 2, depth / 2)];
}

const template = (id, name, description, createPoints, createHoles) => Object.freeze({ id, name, description, createPoints, createHoles });

export const BUILDING_FOOTPRINT_TEMPLATES = Object.freeze([
  template("RECTANGLE", "직사각형", "가장 단순하고 편집하기 쉬운 기본 평면", rectangle),
  template("L_SHAPED", "ㄱ/L자형", "두 날개가 직각으로 만나는 평면", (w, d) => [point(-w / 2, -d / 2), point(w / 2, -d / 2), point(w / 2, 0), point(0, 0), point(0, d / 2), point(-w / 2, d / 2)]),
  template("U_SHAPED", "ㄷ/U자형", "중앙 외부 공간을 감싸는 평면", (w, d) => [point(-w / 2, -d / 2), point(-w / 6, -d / 2), point(-w / 6, d / 6), point(w / 6, d / 6), point(w / 6, -d / 2), point(w / 2, -d / 2), point(w / 2, d / 2), point(-w / 2, d / 2)]),
  template("T_SHAPED", "T자형", "가로 동과 중앙 세로 동이 결합된 평면", (w, d) => [point(-w / 2, -d / 2), point(w / 2, -d / 2), point(w / 2, -d / 6), point(w / 6, -d / 6), point(w / 6, d / 2), point(-w / 6, d / 2), point(-w / 6, -d / 6), point(-w / 2, -d / 6)]),
  template("CROSS", "십자형", "네 방향 날개를 가진 중심형 평면", (w, d) => [point(-w / 6, -d / 2), point(w / 6, -d / 2), point(w / 6, -d / 6), point(w / 2, -d / 6), point(w / 2, d / 6), point(w / 6, d / 6), point(w / 6, d / 2), point(-w / 6, d / 2), point(-w / 6, d / 6), point(-w / 2, d / 6), point(-w / 2, -d / 6), point(-w / 6, -d / 6)]),
  template("COURTYARD", "중정형", "내부 중정이 실제 Hole로 뚫린 평면", rectangle, (w, d) => [rectangle(w * 0.42, d * 0.42).reverse()]),
  template("STEPPED", "계단형", "상부로 갈수록 후퇴시키기 좋은 평면", (w, d) => [point(-w / 2, -d / 2), point(w / 2, -d / 2), point(w / 2, -d / 6), point(w / 6, -d / 6), point(w / 6, d / 6), point(-w / 6, d / 6), point(-w / 6, d / 2), point(-w / 2, d / 2)]),
  template("PODIUM_TOWER", "포디움+타워형", "저층 포디움과 상부 타워 구간을 함께 생성", rectangle),
  template("FREE_POLYGON", "자유 폴리곤형", "꼭짓점을 직접 이동해 만드는 자유 평면", (w, d) => [point(-w / 2, -d / 3), point(-w / 6, -d / 2), point(w / 2, -d / 4), point(w / 3, d / 2), point(-w / 3, d / 2)]),
]);

export const BUILDING_FOOTPRINT_TEMPLATE_MAP = Object.freeze(Object.fromEntries(BUILDING_FOOTPRINT_TEMPLATES.map((item) => [item.id, item])));

export function createBuildingFootprint(templateId = "RECTANGLE", width = 20, depth = 14) {
  const definition = BUILDING_FOOTPRINT_TEMPLATE_MAP[templateId] ?? BUILDING_FOOTPRINT_TEMPLATE_MAP.RECTANGLE;
  return {
    type: "polygon",
    templateId: definition.id,
    points: definition.createPoints(Math.max(1, width), Math.max(1, depth)),
    holes: definition.createHoles?.(Math.max(1, width), Math.max(1, depth)) ?? [],
  };
}

export function resizeBuildingFootprint(footprint, width, depth) {
  if (footprint.templateId && footprint.templateId !== "FREE_POLYGON") return createBuildingFootprint(footprint.templateId, width, depth);
  const xs = footprint.points.map((item) => item.x);
  const zs = footprint.points.map((item) => item.z);
  const currentWidth = Math.max(...xs) - Math.min(...xs) || 1;
  const currentDepth = Math.max(...zs) - Math.min(...zs) || 1;
  const scalePoint = (item) => ({ x: item.x * width / currentWidth, z: item.z * depth / currentDepth });
  return { ...footprint, points: footprint.points.map(scalePoint), holes: (footprint.holes ?? []).map((hole) => hole.map(scalePoint)) };
}
