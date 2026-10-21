import * as THREE from "three";

let queue = Promise.resolve();
const abortError = () => new DOMException("Cancelled", "AbortError");

// Shared by editor and viewers. At most one parse/fetch job runs at a time.
export function parseScanInWorker(source, type, signal) {
  const job = queue.then(async () => {
    if (signal?.aborted) throw abortError();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./scanParser.worker.js", import.meta.url), { type: "module" });
      const finish = (error, data) => {
        signal?.removeEventListener("abort", cancel);
        worker.terminate();
        if (error) reject(error); else resolve(data);
      };
      const cancel = () => finish(abortError());
      // Large scans may take longer than a minute. Stop on explicit cancellation
      // or a worker error instead of rejecting a valid scan by elapsed time.
      signal?.addEventListener("abort", cancel, { once: true });
      worker.onerror = () => finish(new Error("MODEL_WORKER_FAILED"));
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.geometries);
      // Structured-clone the Blob without expanding it into a UI-thread buffer.
      // Remote relative URLs must resolve against the page, not the worker file.
      try {
        worker.postMessage(source instanceof Blob ? { type, blob: source }
          : { type, source: new URL(source, window.location.href).href });
      } catch (error) { finish(error); }
    });
  });
  // Keep sequencing only, never retain the last scan's large typed buffers.
  queue = job.then(() => undefined, () => undefined);
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
