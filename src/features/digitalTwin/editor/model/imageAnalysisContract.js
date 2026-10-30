import { multiply3, inverse3 } from "./imageHomography.js";
import { sensorImageTransform } from "./sensorImageTransform.js";

const FLIP_ORIGIN = [1, 0, 0, 0, -1, 1, 0, 0, 1];
const topLeftMatrix = (matrix) => multiply3(multiply3(FLIP_ORIGIN, matrix), FLIP_ORIGIN);
const topLeftPoints = (points) => points.map(([x, y]) => [x, 1 - y]);

// Shader UV stays bottom-left internally. Every public image coordinate uses
// top-left origin, right/down axes, pixel edges (pixel centres are x+.5,y+.5).
export function imageAnalysisTransform(sensor, originalImage) {
  const internal = sensorImageTransform(sensor);
  const { parameters: p } = internal;
  const source = originalImage ? { ...internal.source, ...originalImage, url: originalImage.sourceUrl } : internal.source;
  const { width, height } = source;
  const forward = topLeftMatrix(internal.sourceUvToTargetUv);
  const inverse = topLeftMatrix(internal.targetUvToSourceUv);
  const crop = [1 / p.cropWidth, 0, -p.cropX / p.cropWidth, 0, 1 / p.cropHeight, -(1 - p.cropY - p.cropHeight) / p.cropHeight, 0, 0, 1];
  const pixelScale = width && height ? [width, 0, 0, 0, height, 0, 0, 0, 1] : null;
  const pixels = (matrix) => pixelScale ? multiply3(multiply3(pixelScale, matrix), inverse3(pixelScale)) : null;
  return {
    schemaVersion: 4, source,
    coordinates: { origin: "TOP_LEFT", xAxis: "RIGHT", yAxis: "DOWN", unit: "NORMALIZED", pixelOrigin: "TOP_LEFT",
      pixelConvention: "PIXEL_EDGES; CENTER=(COLUMN+0.5,ROW+0.5)", matrixLayout: "ROW_MAJOR", vectorConvention: "COLUMN_VECTOR", homogeneousDivide: "xy / w" },
    processedRaster: { width: width ?? null, height: height ?? null, purpose: "REFERENCE_COORDINATES_ONLY_NOT_RENDER_RESOLUTION" },
    parameters: { scaleX: p.scaleX, scaleY: p.scaleY, zoom: p.zoom, flipX: p.flipX, flipY: p.flipY,
      pivotX: p.pivotX, pivotY: 1 - p.pivotY, offsetX: p.offsetX, offsetY: -p.offsetY,
      rotation: -p.rotation, rotationUnit: "DEG", positiveRotation: "CLOCKWISE",
      cropX: p.cropX, cropY: 1 - p.cropY - p.cropHeight, cropWidth: p.cropWidth, cropHeight: p.cropHeight },
    stages: [
      { operation: "CROP", from: "SOURCE", to: "CROPPED", matrix: crop, inverseMatrix: inverse3(crop) },
      { operation: "PERSPECTIVE", from: "CROPPED", to: "RECTIFIED", enabled: internal.perspective.enabled,
        source: topLeftPoints(internal.perspective.source), target: topLeftPoints(internal.perspective.target),
        matrix: topLeftMatrix(internal.perspective.matrix), inverseMatrix: topLeftMatrix(internal.perspective.inverseMatrix) },
      { operation: "PIVOT_FLIP_SCALE_ZOOM_ROTATE_TRANSLATE", from: "RECTIFIED", to: "PROCESSED",
        matrix: topLeftMatrix(internal.rectifiedUvToTargetUv), inverseMatrix: topLeftMatrix(internal.targetUvToRectifiedUv) },
    ],
    sourceToProcessed: forward, processedToSource: inverse,
    sourcePixelsToProcessedPixels: pixels(forward), processedPixelsToSourcePixels: pixels(inverse),
    cropPixels: width && height ? { x: p.cropX * width, y: (1 - p.cropY - p.cropHeight) * height, width: p.cropWidth * width, height: p.cropHeight * height } : null,
    cornerOrder: ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT", "BOTTOM_LEFT"], clipping: internal.clipping,
  };
}

export function imageRegionCoordinates(corners, width, height) {
  const describe = (vertices) => {
    const xs = vertices.map(([x]) => x), ys = vertices.map(([, y]) => y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { corners: vertices, bounds: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
      edgeLengths: vertices.map((a, i) => Math.hypot(a[0] - vertices[(i + 1) % 4][0], a[1] - vertices[(i + 1) % 4][1])),
      area: Math.abs(vertices.reduce((sum, a, i) => { const b = vertices[(i + 1) % 4]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2 };
  };
  const pixelGeometry = width && height ? describe(corners.map(([x, y]) => [x * width, y * height])) : null;
  return { origin: "TOP_LEFT", unit: "NORMALIZED", ...describe(corners), pixels: pixelGeometry?.corners ?? null, pixelGeometry };
}
