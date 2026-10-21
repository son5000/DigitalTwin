// Missing samples define only the screen-selection boundary, never measured surfaces.
export function buildRoiSurfaceSamples(samples, segments, fillMissing) {
  const sampleMask = samples.map(Boolean);
  const triangles = [], outline = [];
  for (let row = 0; row < segments; row++) for (let col = 0; col < segments; col++) {
    const i = row * (segments + 1) + col;
    for (const face of [[i, i + 1, i + segments + 1], [i + 1, i + segments + 2, i + segments + 1]]) {
      if (face.every((index) => sampleMask[index])) triangles.push(...face);
    }
  }
  if (!triangles.length) return null;
  const vertices = samples.map((point, index) => point ?? fillMissing(index));
  for (let col = 0; col <= segments; col++) outline.push(col);
  for (let row = 1; row <= segments; row++) outline.push(row * (segments + 1) + segments);
  for (let col = segments - 1; col >= 0; col--) outline.push(segments * (segments + 1) + col);
  for (let row = segments - 1; row > 0; row--) outline.push(row * (segments + 1));
  return { vertices, triangles, outline, sampleMask, missingSurfacePolicy: "EXCLUDE" };
}
