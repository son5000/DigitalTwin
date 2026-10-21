import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { parseObjStream } from "./scanObjStream.js";

// Only typed buffers cross the worker boundary; no large JSON geometry copies.
export function parseScan(type, buffer, streamed = null) {
  const geometries = [];
  const transfers = new Set();
  function pack(geometry, kind, materials = []) {
    if (kind === "Mesh" && !geometry.hasAttribute("normal")) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const attributes = {};
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      attributes[name] = { array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized };
      transfers.add(attribute.array.buffer);
    }
    const index = geometry.index?.array;
    if (index) transfers.add(index.buffer);
    geometries.push({ kind, attributes, index, groups: geometry.groups, materials,
      box: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
      sphere: { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } });
  }
  if (streamed) {
    streamed.forEach(({ geometry, materials }) => pack(geometry, "Mesh", materials));
  } else if (type === "OBJ") {
    const root = new OBJLoader().parse(new TextDecoder().decode(buffer));
    root.traverse((object) => {
      if (!object.geometry) return;
      pack(object.geometry, object.type, (Array.isArray(object.material) ? object.material : [object.material]).map((m) => m.toJSON()));
    });
  } else if (type === "PLY") {
    const geometry = new PLYLoader().parse(buffer);
    pack(geometry, geometry.index?.count ? "Mesh" : "Points");
  } else throw new Error("UNSUPPORTED");
  if (!geometries.some((g) => g.attributes.position?.array.length)) throw new Error("EMPTY_MODEL");
  return { geometries, transfers: [...transfers] };
}

export async function parseScanSource(data) {
  let blob = data.blob;
  if (!blob && data.source) {
    const response = await fetch(data.source);
    if (!response.ok) throw new Error("MODEL_DOWNLOAD_FAILED");
    blob = await response.blob();
  }
  const streamed = data.type === "OBJ" && blob ? await parseObjStream(blob) : null;
  return parseScan(data.type, streamed ? null : data.buffer ?? await blob.arrayBuffer(), streamed);
}

if (typeof self !== "undefined") self.onmessage = async ({ data }) => {
  try {
    const result = await parseScanSource(data);
    self.postMessage({ geometries: result.geometries }, result.transfers);
  } catch (error) { self.postMessage({ error: error.message }); }
};
