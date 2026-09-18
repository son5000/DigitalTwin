import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

// Only typed buffers cross the worker boundary; no large JSON geometry copies.
export function parseScan(type, buffer) {
  const geometries = [];
  const transfers = new Set();
  let bytes = 0;
  function pack(geometry, kind, materials = []) {
    if (kind === "Mesh" && !geometry.hasAttribute("normal")) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const attributes = {};
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      attributes[name] = { array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized };
      transfers.add(attribute.array.buffer);
      bytes += attribute.array.byteLength;
    }
    const index = geometry.index?.array;
    if (index) { transfers.add(index.buffer); bytes += index.byteLength; }
    if (bytes > 128 * 1024 * 1024) throw new Error("MODEL_MEMORY_LIMIT");
    geometries.push({ kind, attributes, index, groups: geometry.groups, materials,
      box: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
      sphere: { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } });
  }
  if (type === "OBJ") {
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

if (typeof self !== "undefined") self.onmessage = ({ data }) => {
  try {
    const result = parseScan(data.type, data.buffer);
    self.postMessage({ geometries: result.geometries }, result.transfers);
  } catch (error) { self.postMessage({ error: error.message }); }
};
