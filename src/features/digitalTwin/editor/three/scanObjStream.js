import { BufferGeometry, BufferAttribute, Color, MeshPhongMaterial, SRGBColorSpace, Vector3 } from "three";

// Scan twice: count first, then fill exact-sized typed buffers. Never retain
// the complete OBJ text, a file-wide line array, or expandable JS vertex arrays.
async function eachLine(blob, visit) {
  const reader = blob.stream().getReader();
  const decoder = new TextDecoder();
  let pending = "", continued = "";
  const line = (raw) => {
    const text = raw.replace(/\r$/, "");
    if (text.endsWith("\\")) { continued += text.slice(0, -1) + " "; return; }
    visit((continued + text).split("#", 1)[0].trim());
    continued = "";
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let start = 0, end;
      while ((end = pending.indexOf("\n", start)) !== -1) {
        line(pending.slice(start, end)); start = end + 1;
      }
      pending = pending.slice(start);
      if (done) { if (pending || continued) line(pending); break; }
    }
  } finally { reader.releaseLock(); }
}

export async function parseObjStream(blob) {
  let vertexCount = 0, uvCount = 0, normalCount = 0, hasColors = false;
  let objectIndex = 0, unsupported = false;
  const counts = new Map();
  await eachLine(blob, (line) => {
    if (!line) return;
    const parts = line.split(/\s+/), command = parts[0];
    if (command === "v") { vertexCount++; hasColors ||= parts.length >= 7; }
    else if (command === "vt") uvCount++;
    else if (command === "vn") normalCount++;
    else if (command === "o" || command === "g") objectIndex++;
    else if (command === "l" || command === "p") unsupported = true;
    else if (command === "f") {
      if (parts.length < 4) throw new Error("OBJ 면의 정점 정보가 올바르지 않습니다.");
      const count = counts.get(objectIndex) ?? { vertices: 0, uv: false };
      count.vertices += (parts.length - 3) * 3;
      count.uv ||= parts.slice(1).some((part) => Boolean(part.split("/")[1]));
      counts.set(objectIndex, count);
    }
  });
  // Retain the existing loader for uncommon line/point-only OBJ files.
  if (unsupported || !counts.size) return null;
  const vertices = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(uvCount * 2);
  const normals = new Float32Array(normalCount * 3);
  const colors = hasColors ? new Float32Array(vertexCount * 3).fill(1) : null;
  const outputs = new Map([...counts].map(([id, count]) => [id, {
    position: new Float32Array(count.vertices * 3), normal: new Float32Array(count.vertices * 3),
    uv: count.uv ? new Float32Array(count.vertices * 2) : null,
    color: hasColors ? new Float32Array(count.vertices * 3) : null,
    offset: 0, groups: [], materials: [], materialKeys: new Map(),
  }]));
  let vi = 0, ti = 0, ni = 0, materialName = "", smooth = true;
  objectIndex = 0;
  const color = new Color(), a = new Vector3(), b = new Vector3(), c = new Vector3();
  const index = (value, count) => {
    const number = Number(value), resolved = number > 0 ? number - 1 : count + number;
    if (!Number.isInteger(number) || number === 0 || resolved < 0 || resolved >= count) throw new Error("OBJ 정점 참조가 올바르지 않습니다.");
    return resolved;
  };
  await eachLine(blob, (line) => {
    if (!line) return;
    const parts = line.split(/\s+/), command = parts[0];
    if (command === "v") {
      vertices.set(parts.slice(1, 4).map(Number), vi * 3);
      if (colors && parts.length >= 7) { color.setRGB(Number(parts[4]), Number(parts[5]), Number(parts[6]), SRGBColorSpace); colors.set([color.r, color.g, color.b], vi * 3); }
      vi++;
    } else if (command === "vt") { uvs.set([Number(parts[1]), Number(parts[2] ?? 0)], ti++ * 2); }
    else if (command === "vn") { normals.set(parts.slice(1, 4).map(Number), ni++ * 3); }
    else if (command === "o" || command === "g") objectIndex++;
    else if (command === "usemtl") materialName = line.slice(6).trim();
    else if (command === "s") smooth = parts[1] !== "0" && parts[1] !== "off";
    else if (command === "f") {
      const output = outputs.get(objectIndex);
      const key = JSON.stringify([materialName, smooth]);
      if (!output.materialKeys.has(key)) {
        const material = new MeshPhongMaterial({ name: materialName, flatShading: !smooth, vertexColors: hasColors });
        output.materialKeys.set(key, output.materials.length);
        output.materials.push(material.toJSON()); material.dispose();
      }
      const materialIndex = output.materialKeys.get(key);
      if (output.groups.at(-1)?.materialIndex !== materialIndex) output.groups.push({ start: output.offset, count: 0, materialIndex });
      const refs = parts.slice(1).map((part) => {
        const [v, vt, vn] = part.split("/");
        return [index(v, vi), vt ? index(vt, ti) : null, vn ? index(vn, ni) : null];
      });
      for (let i = 1; i < refs.length - 1; i++) {
        const triangle = [refs[0], refs[i], refs[i + 1]];
        a.fromArray(vertices, triangle[0][0] * 3); b.fromArray(vertices, triangle[1][0] * 3); c.fromArray(vertices, triangle[2][0] * 3);
        c.sub(b); a.sub(b); c.cross(a).normalize();
        for (const [v, vt, vn] of triangle) {
          const offset = output.offset++;
          output.position.set(vertices.subarray(v * 3, v * 3 + 3), offset * 3);
          if (vn !== null) output.normal.set(normals.subarray(vn * 3, vn * 3 + 3), offset * 3);
          else output.normal.set([c.x, c.y, c.z], offset * 3);
          if (output.uv && vt !== null) output.uv.set(uvs.subarray(vt * 2, vt * 2 + 2), offset * 2);
          if (colors) output.color.set(colors.subarray(v * 3, v * 3 + 3), offset * 3);
        }
        output.groups.at(-1).count += 3;
      }
    }
  });
  return [...outputs.values()].map((output) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(output.position, 3));
    geometry.setAttribute("normal", new BufferAttribute(output.normal, 3));
    if (output.uv) geometry.setAttribute("uv", new BufferAttribute(output.uv, 2));
    if (output.color) geometry.setAttribute("color", new BufferAttribute(output.color, 3));
    geometry.groups = output.groups;
    return { geometry, materials: output.materials };
  });
}
