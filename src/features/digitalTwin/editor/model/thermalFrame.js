export const THERMAL_SAMPLE_URL = "/samples/thermal_sample.csv";
export const MAX_THERMAL_CSV_BYTES = 16 * 1024 * 1024;
export const THERMAL_PALETTES = Object.freeze({ JET: "JET · 파랑 → 빨강", IRON: "검정 → 주황 → 흰색", GRAY: "흑백" });
const stops = {
  IRON: [[0, 0, 0], [73, 13, 116], [181, 40, 61], [246, 137, 18], [255, 255, 220]],
  GRAY: [[0, 0, 0], [255, 255, 255]],
};
const jetStops = [[0, [0, 0, 128]], [.125, [0, 0, 255]], [.375, [0, 255, 255]], [.625, [255, 255, 0]], [.875, [255, 0, 0]], [1, [128, 0, 0]]];

export function activeThermalSample(sensor) {
  const sample = sensor?.thermalSample;
  return sample?.enabled === true && sample.url === THERMAL_SAMPLE_URL ? sample : null;
}

export function validTemperatureGrid(grid) {
  return Number.isInteger(grid?.width) && Number.isInteger(grid?.height) && grid.width > 0 && grid.height > 0
    && grid.width <= 2048 && grid.height <= 2048 && grid.width * grid.height <= 1048576
    && Array.isArray(grid.values) && grid.values.length === grid.width * grid.height
    && grid.values.every((value) => value === null || Number.isFinite(value));
}

// Immutable frames can be checked once, instead of scanning every pixel on each animation frame.
const checkedGrids = new WeakMap();
const gridSummaries = new WeakMap();
export function isTemperatureFrame(grid) {
  if (!grid || typeof grid !== "object") return false;
  if (!checkedGrids.has(grid)) checkedGrids.set(grid, validTemperatureGrid(grid));
  return checkedGrids.get(grid);
}

export function temperatureSummary(grid) {
  if (!isTemperatureFrame(grid)) return null;
  if (gridSummaries.has(grid)) return gridSummaries.get(grid);
  let min = Infinity, max = -Infinity, sum = 0, count = 0, maxIndex = 0;
  grid.values.forEach((value, index) => {
    if (value === null) return;
    if (value > max) { max = value; maxIndex = index; }
    min = Math.min(min, value); sum += value; count++;
  });
  const summary = count ? { min, max, average: sum / count, count, maxIndex } : null;
  gridSummaries.set(grid, summary);
  return summary;
}

export function parseTemperatureCsv(text) {
  if (typeof text !== "string" || text.length > MAX_THERMAL_CSV_BYTES) throw new Error("온도 CSV는 16MB 이하의 텍스트여야 합니다.");
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error("온도 CSV가 비어 있습니다.");
  const rows = trimmed.split(/\r\n|\n|\r/);
  if (rows.length > 2048) throw new Error("온도 행렬은 세로 2048픽셀 이하여야 합니다.");
  let width = 0;
  const values = [];
  rows.forEach((row, y) => {
    const cells = /[,;\t]/.test(row) ? row.split(/[,;\t]/) : row.trim().split(/\s+/);
    if (!y) width = cells.length;
    if (!width || width > 2048 || width * rows.length > 1048576) throw new Error("온도 행렬은 가로 2048픽셀, 전체 1,048,576픽셀 이하여야 합니다.");
    if (!row.trim() || cells.length !== width) throw new Error(`${y + 1}행의 열 개수가 다릅니다. 각 행은 동일한 픽셀 수여야 합니다.`);
    cells.forEach((cell, x) => {
      const token = cell.trim().replace(/^"(.*)"$/, "$1");
      if (!token || /^(null|nan)$/i.test(token)) { values.push(null); return; }
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) || !Number.isFinite(Number(token))) throw new Error(`${y + 1}행 ${x + 1}열의 온도가 올바르지 않습니다. 헤더 없이 °C 숫자만 입력하세요.`);
      values.push(Number(token));
    });
  });
  const grid = { width, height: rows.length, values };
  if (!temperatureSummary(grid)) throw new Error("CSV에 유효한 온도가 없습니다.");
  return grid;
}

export function thermalColor(t, palette = "JET") {
  if (palette === "JET" || palette === "SPECTRUM") {
    const position = Math.max(0, Math.min(1, t));
    const end = jetStops.findIndex(([at]) => at >= position);
    if (end === 0) return jetStops[0][1];
    const [startAt, startColor] = jetStops[end - 1], [endAt, endColor] = jetStops[end];
    const ratio = (position - startAt) / (endAt - startAt);
    return startColor.map((value, channel) => Math.round(value + (endColor[channel] - value) * ratio));
  }
  const colors = stops[palette] ?? stops.GRAY;
  const position = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(position)), ratio = position - index;
  return colors[index].map((value, channel) => Math.round(value + (colors[index + 1][channel] - value) * ratio));
}

export function thermalGradient(palette) {
  if (palette === "JET" || palette === "SPECTRUM") return `linear-gradient(to right, ${jetStops.map(([at, color]) => `rgb(${color.join(" ")}) ${at * 100}%`).join(", ")})`;
  return `linear-gradient(to right, ${(stops[palette] ?? stops.GRAY).map((color) => `rgb(${color.join(" ")})`).join(", ")})`;
}

const colorTables = new Map();
function colorTable(palette) {
  if (!colorTables.has(palette)) {
    const table = new Uint8Array(256 * 3);
    for (let index = 0; index < 256; index++) table.set(thermalColor(index / 255, palette), index * 3);
    colorTables.set(palette, table);
  }
  return colorTables.get(palette);
}

export function temperaturePixels(grid, min, max, palette = "JET", flipY = true) {
  if (!isTemperatureFrame(grid) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  const pixels = new Uint8Array(grid.width * grid.height * 4);
  const colors = colorTable(palette), span = max - min;
  // CSV/canvas rows start at the top; DataTexture UV starts at the bottom.
  grid.values.forEach((value, index) => {
    if (value === null) return;
    const target = (flipY ? (grid.height - 1 - Math.floor(index / grid.width)) * grid.width + index % grid.width : index) * 4;
    const color = Math.round((span === 0 ? .5 : Math.max(0, Math.min(1, (value - min) / span))) * 255) * 3;
    pixels[target] = colors[color]; pixels[target + 1] = colors[color + 1]; pixels[target + 2] = colors[color + 2];
    pixels[target + 3] = 255;
  });
  return pixels;
}

export function estimateVerticalFov(height, distance) {
  if (![height, distance].every((value) => Number.isFinite(value) && value > 0)) return null;
  return 2 * Math.atan(height / (2 * distance)) * 180 / Math.PI;
}

let samplePromise;
export function loadThermalSample() {
  if (!samplePromise) samplePromise = fetch(THERMAL_SAMPLE_URL, { signal: AbortSignal.timeout(10000) }).then(async (response) => {
    if (!response.ok) throw new Error(`열화상 샘플을 불러오지 못했습니다 (${response.status}).`);
    return parseTemperatureCsv(await response.text());
  }).catch((error) => { samplePromise = null; throw error; });
  return samplePromise;
}
