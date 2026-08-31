import * as THREE from "three";

import { textureAssetRepository } from "@/features/digitalTwin/editor/api/textureAssetRepository";
import { normalizeUserTexture, USER_TEXTURE_TARGETS, USER_TEXTURE_WRAPS } from "@/features/digitalTwin/editor/model/userTexture";
import { cloneMaterialForMutation } from "@/features/digitalTwin/editor/three/presetMaterial";

const cache = new Map();
const pendingLoads = new Map();

async function createCacheEntry(asset) {
  const objectUrl = URL.createObjectURL(asset.blob);
  const loader = new THREE.TextureLoader();
  try {
    const texture = await loader.loadAsync(objectUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, objectUrl, references: 0 };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function primeUserTextureAsset(asset) {
  if (!asset?.id || !asset.blob || cache.has(asset.id)) return;
  if (!pendingLoads.has(asset.id)) pendingLoads.set(asset.id, createCacheEntry(asset));
  try {
    cache.set(asset.id, await pendingLoads.get(asset.id));
  } finally {
    pendingLoads.delete(asset.id);
  }
}

function wrapValue(wrap) {
  if (wrap === USER_TEXTURE_WRAPS.CLAMP) return THREE.ClampToEdgeWrapping;
  if (wrap === USER_TEXTURE_WRAPS.MIRROR) return THREE.MirroredRepeatWrapping;
  return THREE.RepeatWrapping;
}

async function acquire(assetId) {
  let entry = cache.get(assetId);
  if (!entry) {
    const asset = await textureAssetRepository.get(assetId);
    if (!asset?.blob) throw new Error("MISSING_LOCAL_FILE");
    await primeUserTextureAsset(asset);
    entry = cache.get(assetId);
  }
  entry.references += 1;
  return entry.texture;
}

function release(assetId) {
  const entry = cache.get(assetId);
  if (!entry) return;
  entry.references = Math.max(0, entry.references - 1);
  if (entry.references > 0) return;
  entry.texture.dispose();
  URL.revokeObjectURL(entry.objectUrl);
  cache.delete(assetId);
}

function matchesTarget(object, target) {
  if (target === USER_TEXTURE_TARGETS.ALL) return object.userData.textureSurface !== "EXCLUDE";
  if (target.startsWith("SLOT:")) return object.userData.materialSlot === target.slice(5);
  return object.userData.textureSurface === target;
}

export async function applyUserTextureToObject(object, binding, onStatus) {
  const normalized = normalizeUserTexture(binding);
  if (!normalized) return;
  object.userData.userTexturePending = true;
  try {
    const sourceTexture = await acquire(normalized.textureAssetId);
    if (object.userData.disposed) { release(normalized.textureAssetId); return; }
    let applied = 0;
    let missingUv = false;
    const textureInstances = [];
    object.traverse((child) => {
      if (!child.isMesh || !matchesTarget(child, normalized.target)) return;
      if (!child.geometry?.getAttribute("uv")) { missingUv = true; return; }
      const applyMaterial = (material) => {
        if (!material || material.isLineBasicMaterial) return material;
        const clone = cloneMaterialForMutation(material);
        const texture = sourceTexture.clone();
        texture.source = sourceTexture.source;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = wrapValue(normalized.wrap);
        texture.wrapT = wrapValue(normalized.wrap);
        texture.repeat.set(normalized.repeat.x / normalized.scale, normalized.repeat.y / normalized.scale);
        texture.offset.set(normalized.offset.x, normalized.offset.y);
        texture.center.set(0.5, 0.5);
        texture.rotation = normalized.rotation;
        texture.needsUpdate = true;
        textureInstances.push(texture);
        clone.map = texture;
        clone.color.set(0xffffff);
        clone.userData = { ...clone.userData, borrowedTextures: true };
        clone.needsUpdate = true;
        applied += 1;
        return clone;
      };
      child.material = Array.isArray(child.material) ? child.material.map(applyMaterial) : applyMaterial(child.material);
    });
    if (!applied) {
      textureInstances.forEach((texture) => texture.dispose());
      release(normalized.textureAssetId);
      onStatus?.(missingUv ? "MISSING_UV" : "UNSUPPORTED_TARGET");
      return;
    }
    object.userData.releaseUserTexture = () => {
      textureInstances.forEach((texture) => texture.dispose());
      release(normalized.textureAssetId);
    };
    onStatus?.(missingUv ? "PARTIAL_UV" : "READY");
  } catch (error) {
    onStatus?.(error?.message === "MISSING_LOCAL_FILE" ? "MISSING_LOCAL_FILE" : "FAILED");
  } finally {
    object.userData.userTexturePending = false;
  }
}
