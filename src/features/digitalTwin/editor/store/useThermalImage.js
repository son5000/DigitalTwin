import { useMemo } from "react";
import { temperaturePixels, temperatureSummary } from "../model/thermalFrame";

export default function useThermalImage(grid, settings) {
  const summary = useMemo(() => temperatureSummary(grid), [grid]);
  const { palette } = settings;
  const source = useMemo(() => {
    if (!summary) return "";
    const pixels = temperaturePixels(grid, summary.min, summary.max, palette, false);
    if (!pixels) return "";
    const canvas = document.createElement("canvas");
    canvas.width = grid.width; canvas.height = grid.height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), grid.width, grid.height), 0, 0);
    return canvas.toDataURL("image/png");
  }, [grid, summary, palette]);
  return { source, summary };
}
