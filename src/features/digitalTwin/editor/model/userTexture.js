export const USER_TEXTURE_TARGETS = Object.freeze({
  ALL: "ALL",
  EXTERIOR: "EXTERIOR",
  ROOF: "ROOF",
});

export const USER_TEXTURE_WRAPS = Object.freeze({
  REPEAT: "REPEAT",
  CLAMP: "CLAMP",
  MIRROR: "MIRROR",
});

export const DEFAULT_USER_TEXTURE_SETTINGS = Object.freeze({
  target: USER_TEXTURE_TARGETS.ALL,
  repeat: { x: 1, y: 1 },
  offset: { x: 0, y: 0 },
  rotation: 0,
  scale: 1,
  wrap: USER_TEXTURE_WRAPS.REPEAT,
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeUserTexture(texture) {
  if (!texture?.textureAssetId) return null;
  const target = typeof texture.target === "string" ? texture.target : USER_TEXTURE_TARGETS.ALL;
  const wrap = Object.values(USER_TEXTURE_WRAPS).includes(texture.wrap) ? texture.wrap : USER_TEXTURE_WRAPS.REPEAT;
  return {
    textureAssetId: texture.textureAssetId,
    target,
    repeat: {
      x: Math.max(0.01, finite(texture.repeat?.x, 1)),
      y: Math.max(0.01, finite(texture.repeat?.y, 1)),
    },
    offset: { x: finite(texture.offset?.x, 0), y: finite(texture.offset?.y, 0) },
    rotation: finite(texture.rotation, 0),
    scale: Math.max(0.01, finite(texture.scale, 1)),
    wrap,
  };
}

export function createUserTextureBinding(textureAssetId, target = USER_TEXTURE_TARGETS.ALL) {
  return normalizeUserTexture({ ...DEFAULT_USER_TEXTURE_SETTINGS, textureAssetId, target });
}

export function supportsUserTextureFile(file) {
  return Boolean(file && ["image/jpeg", "image/png", "image/webp"].includes(file.type));
}
