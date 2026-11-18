import { isRecord, projectRequest } from "./projectConfigurationApi.js";
import { assertAssetReference, downloadAssetFile, MAX_REMOTE_ASSET_BYTES, verifyAssetBlob } from "./projectAssetTransport.js";

export function parseDisplayAsset(result, reference) {
  assertAssetReference(reference);
  const manifest = result?.manifest;
  if (result?.asset_id !== reference.asset_id || result.manifest_sha256?.toLowerCase() !== reference.manifest_sha256.toLowerCase()
    || !isRecord(manifest) || manifest.format_version !== "1.0" || manifest.asset_id !== reference.asset_id
    || !Array.isArray(result.members) || !Array.isArray(manifest.members) || !Array.isArray(manifest.materials)) {
    throw new Error("서버 표시 자산의 ID·명세 버전·해시가 일치하지 않습니다.");
  }
  const ids = new Set();
  let size = 0;
  for (const member of result.members) {
    const declared = manifest.members.find((item) => item.member_id === member.member_id);
    if (typeof member.member_id !== "string" || !member.member_id || ids.has(member.member_id)
      || !["MODEL", "TEXTURE"].includes(member.kind) || !Number.isSafeInteger(member.size_bytes) || member.size_bytes < 1
      || !/^[a-f0-9]{64}$/i.test(member.sha256 ?? "") || !declared
      || declared.sha256 !== member.sha256 || declared.size_bytes !== member.size_bytes || declared.kind !== member.kind) {
      throw new Error("서버 표시 자산의 파일 명세가 올바르지 않습니다.");
    }
    ids.add(member.member_id);
    size += member.size_bytes;
  }
  if (size > MAX_REMOTE_ASSET_BYTES || ids.size !== manifest.members.length
    || result.members.filter((item) => item.kind === "MODEL").length !== 1
    || !result.members.some((item) => item.member_id === manifest.model_member && item.kind === "MODEL")) {
    throw new Error("표시 자산에는 하나의 모델이 필요하며 파일 합계는 512MiB 이하여야 합니다.");
  }
  const materialIds = new Set();
  for (const material of manifest.materials) {
    if (!Number.isInteger(material.material_index) || material.material_index < 0 || materialIds.has(material.material_index)
      || !result.members.some((item) => item.member_id === material.texture_member && item.kind === "TEXTURE")) {
      throw new Error("서버 표시 자산의 재질·텍스처 연결이 올바르지 않습니다.");
    }
    materialIds.add(material.material_index);
  }
  return result;
}

export async function loadDisplayAsset(reference, signal, { request = projectRequest, download = downloadAssetFile } = {}) {
  const path = `/display-assets/${encodeURIComponent(assertAssetReference(reference).asset_id)}`;
  const result = parseDisplayAsset(await request(path, { signal }), reference);
  const files = [];
  for (const member of result.members) {
    signal?.throwIfAborted();
    const blob = await download(`${path}/files/${encodeURIComponent(member.member_id)}`, signal);
    await verifyAssetBlob(blob, member.sha256, member.size_bytes);
    files.push({ name: member.member_id, path: member.member_id, blob, size: blob.size, type: blob.type });
  }
  const primary = files.find((file) => file.name === result.manifest.model_member);
  const magic = new Uint8Array(await primary.blob.slice(0, 4).arrayBuffer());
  const assetType = magic[0] === 0x67 && magic[1] === 0x6c && magic[2] === 0x54 && magic[3] === 0x46 ? "GLB" : "GLTF";
  if (assetType === "GLTF") {
    const model = JSON.parse(await primary.blob.text());
    if (model.asset?.version !== "2.0") throw new Error("glTF 2.0 표시 모델이 필요합니다.");
  }
  return { id: reference.asset_id, primaryFileName: primary.name, primaryFilePath: primary.path, files,
    assetType, displayMaterials: result.manifest.materials, backendAsset: { ...reference } };
}
