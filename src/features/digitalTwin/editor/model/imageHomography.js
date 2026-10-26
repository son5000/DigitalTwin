export const IDENTITY_3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
// Order is clockwise when viewed in bottom-left-origin UV coordinates.
export const IMAGE_CORNERS = Object.freeze(["왼쪽 위", "오른쪽 위", "오른쪽 아래", "왼쪽 아래"]);
export const UNIT_QUAD = Object.freeze([[0, 1], [1, 1], [1, 0], [0, 0]].map(Object.freeze));
export const DEFAULT_PERSPECTIVE = Object.freeze({ enabled: false, source: UNIT_QUAD, target: UNIT_QUAD });

export function multiply3(a, b) {
  return Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return a[row * 3] * b[col] + a[row * 3 + 1] * b[col + 3] + a[row * 3 + 2] * b[col + 6];
  });
}

export function inverse3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const values = [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  const det = a * values[0] + b * values[3] + c * values[6];
  return Number.isFinite(det) && Math.abs(det) > 1e-12 ? values.map((v) => v / det) : null;
}

export function projectPoint(matrix, [x, y]) {
  const w = matrix[6] * x + matrix[7] * y + matrix[8];
  return Math.abs(w) > 1e-10 ? [(matrix[0] * x + matrix[1] * y + matrix[2]) / w, (matrix[3] * x + matrix[4] * y + matrix[5]) / w] : null;
}

function validQuad(points, min, max) {
  if (!Array.isArray(points) || points.length !== 4 || points.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => !Number.isFinite(v) || v < min || v > max))) return false;
  return points.every((a, index) => {
    const b = points[(index + 1) % 4], c = points[(index + 2) % 4];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-6;
  });
}

function squareToQuad([p0, p1, p2, p3]) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  return [p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0],
    p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1], g, h, 1];
}

export function homographyFromQuads(source, target) {
  if (!validQuad(source, 0, 1) || !validQuad(target, -2, 3)) return null;
  const from = squareToQuad(source), to = squareToQuad(target), inverse = from && inverse3(from);
  if (!inverse || !to) return null;
  const matrix = multiply3(to, inverse);
  if (!inverse3(matrix)) return null;
  const weights = source.map(([u, v]) => matrix[6] * u + matrix[7] * v + matrix[8]);
  if (weights.some((w) => Math.abs(w) < 1e-8 || Math.sign(w) !== Math.sign(weights[0]))) return null;
  return matrix;
}

export function normalizePerspective(value) {
  const source = value?.source ?? UNIT_QUAD, target = value?.target ?? UNIT_QUAD;
  if (!homographyFromQuads(source, target)) return { ...DEFAULT_PERSPECTIVE };
  return { enabled: value?.enabled === true, source: source.map((p) => [...p]), target: target.map((p) => [...p]) };
}

// CSS uses top-left pixels, while the renderer/export use bottom-left UV.
export function imageCssMatrix(matrix, width, height) {
  const flip = [1, 0, 0, 0, -1, 1, 0, 0, 1];
  const m = multiply3(multiply3(flip, matrix), flip);
  return `matrix3d(${[m[0], m[3] * height / width, 0, m[6] / width,
    m[1] * width / height, m[4], 0, m[7] / height, 0, 0, 1, 0,
    m[2] * width, m[5] * height, 0, m[8]].join(",")})`;
}
