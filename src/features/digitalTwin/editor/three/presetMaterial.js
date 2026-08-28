import * as THREE from "three";

import { normalizeMaterialAppearance } from "@/features/digitalTwin/editor/constants/materialPresets";

const TEXTURE_SIZE = 128;
const textureCache = new Map();
const materialCache = new Map();
const MAX_IDLE_MATERIALS = 128;
const now = () => globalThis.performance?.now?.() ?? Date.now();

function noise(x, y, seed = 0) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function patternValue(pattern, x, y) {
  const u = x / TEXTURE_SIZE;
  const v = y / TEXTURE_SIZE;
  const grain = noise(x, y);
  if (pattern === "NONE") return 0.92;
  if (pattern === "BRICK") {
    const row = Math.floor(v * 8);
    const bx = (u * 5 + (row % 2) * 0.5) % 1;
    const by = (v * 8) % 1;
    return bx < 0.045 || by < 0.07 ? 0.48 : 0.86 + grain * 0.1;
  }
  if (pattern === "TILE" || pattern === "CEILING") {
    const cells = pattern === "CEILING" ? 6 : 5;
    const gx = (u * cells) % 1;
    const gy = (v * cells) % 1;
    return gx < 0.045 || gy < 0.045 ? 0.5 : 0.94 - grain * 0.04;
  }
  if (pattern === "WOOD") return 0.72 + Math.sin((u * 14 + noise(y, 2) * 2) * Math.PI) * 0.13 + grain * 0.05;
  if (pattern === "MARBLE") return 0.86 + Math.sin((u * 3 + v * 1.6 + noise(x >> 3, y >> 3)) * Math.PI) * 0.09;
  if (pattern === "STONE") return 0.68 + noise(x >> 3, y >> 3) * 0.22 + grain * 0.05;
  if (pattern === "TERRAZZO") return 0.72 + noise(x >> 2, y >> 2) * 0.2 + (grain > 0.82 ? 0.16 : 0);
  if (pattern === "ASPHALT") return 0.55 + grain * 0.32;
  if (pattern === "CARPET") return 0.58 + noise(x, y, 4) * 0.18 + ((x + y) % 3) * 0.025;
  if (pattern === "BRUSHED") return 0.76 + noise(x, y >> 4) * 0.16 + Math.sin(y * 0.9) * 0.035;
  if (pattern === "GALVANIZED") return 0.68 + noise(x >> 2, y >> 2) * 0.25;
  if (pattern === "RUST") return 0.55 + noise(x >> 2, y >> 2) * 0.34;
  if (pattern === "RUBBER") return 0.62 + ((x + y) % 8 < 2 ? 0.12 : 0) + grain * 0.08;
  if (pattern === "FROST") return 0.8 + grain * 0.16;
  if (pattern === "MESH") return (x % 14 < 3 || y % 14 < 3) ? 0.92 : 0.3;
  if (pattern === "PANEL") return x % 32 < 3 ? 0.58 : 0.9 + grain * 0.04;
  if (pattern === "CHECKER_PLATE") {
    const diamond = Math.abs((x % 20) - 10) + Math.abs((y % 20) - 10);
    return diamond < 5 || Math.abs(((x + 10) % 20) - 10) + Math.abs(((y + 10) % 20) - 10) < 5 ? 1 : 0.65;
  }
  if (pattern === "CLOUD") return 0.72 + noise(x >> 3, y >> 3) * 0.2;
  return 0.78 + grain * 0.16;
}

function createBaseTextures(pattern, aging) {
  const cacheKey = `${pattern}:${Math.round(aging * 20)}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const colorData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const bumpData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const index = y * TEXTURE_SIZE + x;
      const dirt = noise(x >> 2, y >> 2, 7) * aging;
      const value = Math.max(0.18, Math.min(1, patternValue(pattern, x, y) - dirt * 0.28));
      const channel = Math.round(value * 255);
      colorData[index * 4] = channel;
      colorData[index * 4 + 1] = Math.round(channel * (1 - dirt * 0.12));
      colorData[index * 4 + 2] = Math.round(channel * (1 - dirt * 0.2));
      colorData[index * 4 + 3] = 255;
      bumpData[index] = channel;
    }
  }
  const map = new THREE.DataTexture(colorData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.DataTexture(bumpData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RedFormat);
  [map, bumpMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
  });
  const result = { map, bumpMap };
  textureCache.set(cacheKey, result);
  return result;
}

function configuredTexture(source, appearance) {
  const texture = source.clone();
  const repeat = Math.max(0.1, Number(appearance.textureScale) || 1);
  texture.repeat.set(repeat, repeat);
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(Number(appearance.textureRotation) || 0);
  texture.needsUpdate = true;
  return texture;
}

function materialKey(appearance) {
  return JSON.stringify([
    appearance.materialPresetId,
    appearance.color,
    appearance.pattern,
    appearance.textureScale,
    appearance.textureRotation,
    appearance.bumpStrength,
    appearance.roughness,
    appearance.metalness,
    appearance.reflectivity,
    appearance.transmission,
    appearance.opacity,
    appearance.aging,
    appearance.emissive ?? null,
    appearance.emissiveIntensity ?? 0,
  ]);
}

function disposeCachedMaterial(material) {
  ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "alphaMap"].forEach((key) => material[key]?.dispose());
  material.dispose();
}

function pruneIdleMaterials() {
  if (materialCache.size <= MAX_IDLE_MATERIALS) return;
  const idle = [...materialCache.entries()]
    .filter(([, entry]) => entry.references === 0)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed);
  while (materialCache.size > MAX_IDLE_MATERIALS && idle.length) {
    const [key, entry] = idle.shift();
    disposeCachedMaterial(entry.material);
    materialCache.delete(key);
  }
}

export function createPresetMaterial(sourceAppearance, overrides = {}) {
  const appearance = normalizeMaterialAppearance({ ...sourceAppearance, ...overrides });
  const key = materialKey(appearance);
  const cached = materialCache.get(key);
  if (cached) {
    cached.references += 1;
    cached.lastUsed = now();
    return cached.material;
  }
  const { map, bumpMap } = createBaseTextures(
    appearance.pattern ?? normalizeMaterialAppearance({ materialPresetId: appearance.materialPresetId }).pattern,
    Math.max(0, Math.min(1, appearance.aging ?? 0)),
  );
  const opacity = Math.max(0.05, Math.min(1, appearance.opacity ?? 1));
  const transmission = Math.max(0, Math.min(1, appearance.transmission ?? 0));
  const material = new THREE.MeshPhysicalMaterial({
    color: appearance.color,
    map: configuredTexture(map, appearance),
    bumpMap: configuredTexture(bumpMap, appearance),
    bumpScale: Math.max(0, appearance.bumpStrength ?? 0),
    roughness: Math.max(0, Math.min(1, appearance.roughness ?? 0.5)),
    metalness: Math.max(0, Math.min(1, appearance.metalness ?? 0)),
    reflectivity: Math.max(0, Math.min(1, appearance.reflectivity ?? 0.5)),
    clearcoat: Math.max(0, Math.min(0.65, (appearance.reflectivity ?? 0.5) * 0.5)),
    clearcoatRoughness: Math.max(0.05, appearance.roughness ?? 0.5),
    transmission,
    emissive: appearance.emissive ?? 0x000000,
    emissiveIntensity: appearance.emissiveIntensity ?? 0,
    transparent: opacity < 1 || transmission > 0,
    opacity,
    depthWrite: opacity >= 0.96 && transmission <= 0.05,
    side: THREE.DoubleSide,
  });
  material.userData.sharedMaterialKey = key;
  materialCache.set(key, { material, references: 1, lastUsed: now() });
  pruneIdleMaterials();
  return material;
}

export function releaseSharedMaterial(material) {
  const key = material?.userData?.sharedMaterialKey;
  if (!key) return false;
  const entry = materialCache.get(key);
  if (entry) {
    entry.references = Math.max(0, entry.references - 1);
    entry.lastUsed = now();
  }
  return true;
}

export function cloneMaterialForMutation(material) {
  if (!material?.userData?.sharedMaterialKey) return material;
  const key = material.userData.sharedMaterialKey;
  const clone = material.clone();
  delete clone.userData.sharedMaterialKey;
  clone.userData.borrowedSharedMaterialKey = key;
  clone.userData.borrowedTextures = true;
  return clone;
}

export function releaseBorrowedSharedMaterial(material) {
  const key = material?.userData?.borrowedSharedMaterialKey;
  if (!key) return false;
  const entry = materialCache.get(key);
  if (entry) {
    entry.references = Math.max(0, entry.references - 1);
    entry.lastUsed = now();
  }
  return true;
}

export function getPresetMaterialCacheStats() {
  return {
    entries: materialCache.size,
    activeReferences: [...materialCache.values()].reduce((total, entry) => total + entry.references, 0),
  };
}
