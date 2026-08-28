const MAX_IDLE_GEOMETRIES = 160;
const geometryCache = new Map();
const now = () => globalThis.performance?.now?.() ?? Date.now();

function pruneIdleGeometry() {
  if (geometryCache.size <= MAX_IDLE_GEOMETRIES) return;
  const idleEntries = [...geometryCache.entries()]
    .filter(([, entry]) => entry.references === 0)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed);
  while (geometryCache.size > MAX_IDLE_GEOMETRIES && idleEntries.length) {
    const [key, entry] = idleEntries.shift();
    entry.geometry.dispose();
    geometryCache.delete(key);
  }
}

export function acquireSharedGeometry(key, factory) {
  let entry = geometryCache.get(key);
  if (!entry) {
    const geometry = factory();
    geometry.userData.sharedGeometryKey = key;
    entry = { geometry, references: 0, lastUsed: now() };
    geometryCache.set(key, entry);
  }
  entry.references += 1;
  entry.lastUsed = now();
  pruneIdleGeometry();
  return entry.geometry;
}

export function releaseSharedGeometry(geometry) {
  const key = geometry?.userData?.sharedGeometryKey;
  if (!key) return false;
  const entry = geometryCache.get(key);
  if (entry) {
    entry.references = Math.max(0, entry.references - 1);
    entry.lastUsed = now();
  }
  return true;
}

export function getSharedGeometryCacheStats() {
  return {
    entries: geometryCache.size,
    activeReferences: [...geometryCache.values()].reduce((total, entry) => total + entry.references, 0),
  };
}
