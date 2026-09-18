import * as THREE from "three";

let queue = Promise.resolve();
const abortError = () => new DOMException("Cancelled", "AbortError");

// Shared by editor and viewers. At most one parse/fetch job runs at a time.
export function parseScanInWorker(source, type, signal) {
  const job = queue.then(async () => {
    if (signal?.aborted) throw abortError();
    const response = await fetch(source, { signal });
    if (!response.ok) throw new Error("MODEL_DOWNLOAD_FAILED");
    if (Number(response.headers.get("content-length")) > 256 * 1024 * 1024) throw new Error("MODEL_FILE_LIMIT");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 256 * 1024 * 1024) throw new Error("MODEL_FILE_LIMIT");
    if (signal?.aborted) throw abortError();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./scanParser.worker.js", import.meta.url), { type: "module" });
      const finish = (error, data) => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", cancel);
        worker.terminate();
        if (error) reject(error); else resolve(data);
      };
      const cancel = () => finish(abortError());
      const timeout = setTimeout(() => finish(new Error("MODEL_TIMEOUT")), 60000);
      signal?.addEventListener("abort", cancel, { once: true });
      worker.onerror = () => finish(new Error("MODEL_WORKER_FAILED"));
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.geometries);
      worker.postMessage({ type, buffer }, [buffer]);
    });
  });
  queue = job.catch(() => {});
  return job;
}

export function restoreScanGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(data.attributes)) {
    geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
  }
  if (data.index) geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  data.groups.forEach((g) => geometry.addGroup(g.start, g.count, g.materialIndex));
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(data.box.min), new THREE.Vector3().fromArray(data.box.max));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(data.sphere.center), data.sphere.radius);
  return geometry;
}
