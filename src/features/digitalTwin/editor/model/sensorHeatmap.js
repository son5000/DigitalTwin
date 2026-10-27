export const HEATMAP_PALETTES = Object.freeze({
  SPECTRUM: { label: "스펙트럼", colors: ["#2456d8", "#21c5b5", "#f5df43", "#ed352c"] },
  EMBER: { label: "열원", colors: ["#481567", "#b52f63", "#f98e35", "#fff2a3"] },
  VIRIDIS: { label: "청록·노랑", colors: ["#440154", "#31688e", "#35b779", "#fde725"] },
});
export const HEATMAP_STYLES = Object.freeze({ SOFT: "부드러운 확산", BANDS: "단계형 등고선", RINGS: "동심원" });
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== "" && value !== null ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeHeatmap(value = {}) {
  return { radius: number(value.radius, .2, .01, 10), opacity: number(value.opacity, .8, .1, 1),
    falloff: number(value.falloff, 1.4, .3, 4), palette: HEATMAP_PALETTES[value.palette] ? value.palette : "SPECTRUM",
    style: HEATMAP_STYLES[value.style] ? value.style : "SOFT",
    preview: value.preview === true, equipmentId: value.equipmentId ?? null,
    position: Object.fromEntries(["x", "y", "z"].map((axis) => [axis, number(value.position?.[axis], axis === "y" ? .5 : 0, -1e6, 1e6)])),
    normal: value.normal && [value.normal.x, value.normal.y, value.normal.z].every(Number.isFinite) && Math.hypot(value.normal.x, value.normal.y, value.normal.z) > 1e-6 ? { ...value.normal } : { x: 0, y: 0, z: 1 } };
}
