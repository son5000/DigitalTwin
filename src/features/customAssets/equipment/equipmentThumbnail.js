function escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]); }

export function createEquipmentThumbnail(asset, theme = "dark") {
  const dark = theme === "dark"; const background = dark ? "#101b24" : "#eef5f8"; const stroke = dark ? "#7dd3fc" : "#176b91";
  const bounds = asset.bounds ?? { width: 1, depth: 1 }; const scale = Math.min(170 / Math.max(1, bounds.width), 110 / Math.max(1, bounds.depth));
  const paths = asset.parts.slice(0, 80).map((part) => { const x = 128 + (part.position.x - (asset.origin?.x ?? 0)) * scale; const y = 86 + (part.position.z - (asset.origin?.z ?? 0)) * scale; const length = Math.max(8, (part.parameters?.length ?? 0.5) * scale); const rotation = -(part.rotation?.y ?? 0) * 180 / Math.PI; return `<line x1="${x - length / 2}" y1="${y}" x2="${x + length / 2}" y2="${y}" transform="rotate(${rotation} ${x} ${y})"/>`; }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 256 160"><rect width="256" height="160" fill="${background}"/><g stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${paths}</g><text x="14" y="146" fill="${dark ? "#b9d5e2" : "#315766"}" font-family="sans-serif" font-size="10">${escape(asset.name)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
