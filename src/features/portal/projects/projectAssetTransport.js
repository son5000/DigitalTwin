import { isRecord, projectApiBase, projectRequest } from "./projectConfigurationApi.js";
import { readProjectArchive } from "./projectArchive.js";

export const NATIVE_ASSET_KIND = "NATIVE_BUNDLE";
export const MAX_REMOTE_ASSET_BYTES = 512 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/i;
export function assertAssetReference(reference) {
  if (!isRecord(reference) || typeof reference.asset_id !== "string" || !reference.asset_id.trim()
    || !HASH.test(reference.manifest_sha256 ?? "")
    || (reference.kind != null && ![NATIVE_ASSET_KIND, "DISPLAY_ASSET"].includes(reference.kind))
    || (reference.kind === NATIVE_ASSET_KIND && !HASH.test(reference.archive_sha256 ?? ""))) {
    throw new Error("서버 자산의 ID·종류·SHA-256 형식을 확인해 주세요.");
  }
  return reference;
}

export function validateAssetManifest(manifest = []) {
  if (!Array.isArray(manifest)) throw new Error("서버의 자산 목록 형식을 확인해 주세요.");
  const ids = new Set();
  for (const reference of manifest) {
    assertAssetReference(reference);
    if (ids.has(reference.asset_id)) throw new Error("서버 자산 목록에 중복 ID가 있습니다.");
    ids.add(reference.asset_id);
  }
  if (manifest.filter((item) => item.kind === NATIVE_ASSET_KIND).length > 1) throw new Error("프로젝트 원본 자산 ZIP은 하나만 연결할 수 있습니다.");
  return manifest;
}

export async function sha256(blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyAssetBlob(blob, expectedHash, expectedSize) {
  if (!(blob instanceof Blob) || blob.size > MAX_REMOTE_ASSET_BYTES || !HASH.test(expectedHash ?? "")
    || (expectedSize != null && blob.size !== expectedSize)
    || await sha256(blob) !== expectedHash.toLowerCase()) throw new Error("서버 자산 파일의 크기 또는 SHA-256이 일치하지 않습니다.");
  return blob;
}

// Pin file downloads to API paths. Never follow an arbitrary URL from a manifest.
export async function downloadAssetFile(path, signal, { base = projectApiBase, fetcher = fetch } = {}) {
  if (!base) throw new Error("프로젝트 API 주소가 설정되지 않았습니다.");
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
  const response = await fetcher(`${base}${path}`, { signal: requestSignal, credentials: "same-origin", redirect: "error" });
  if (!response.ok) throw new Error(`서버 자산 파일을 내려받지 못했습니다 (${response.status}).`);
  if (Number(response.headers.get("content-length")) > MAX_REMOTE_ASSET_BYTES) throw new Error("자산 파일은 512MiB 이하여야 합니다.");
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REMOTE_ASSET_BYTES) { await reader.cancel(); throw new Error("자산 파일은 512MiB 이하여야 합니다."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
}

// Proposed backend contract: docs/integration/backend-viewer-asset-handoff.md.
export async function uploadNativeAssetBundle(projectId, blob, signal, request = projectRequest) {
  if (blob.size > MAX_REMOTE_ASSET_BYTES) throw new Error("서버에 저장할 원본 자산 ZIP은 512MiB 이하여야 합니다.");
  const archiveHash = await sha256(blob);
  const archive = await readProjectArchive(blob);
  const manifestHash = await sha256(await archive.read("project.json", "application/json"));
  const form = new FormData();
  form.append("file", blob, "project-assets.zip");
  form.append("metadata", JSON.stringify({ externalProjectId: projectId, format: "digital-twin-assets", version: 2,
    archive_sha256: archiveHash, clientRequestId: crypto.randomUUID() }));
  let result;
  try {
    result = await request("/project-assets", { method: "POST", body: form, signal, timeout: 120000 });
  } catch (error) {
    if ([404, 405, 501].includes(error.status)) throw new Error("백엔드의 원본 자산 저장 API(POST /api/v1/project-assets)가 아직 준비되지 않았습니다. 로컬 저장은 유지됩니다.", { cause: error });
    throw error;
  }
  const reference = assertAssetReference(result?.asset);
  if (reference.kind !== NATIVE_ASSET_KIND || reference.archive_sha256.toLowerCase() !== archiveHash
    || reference.manifest_sha256.toLowerCase() !== manifestHash) throw new Error("서버가 저장한 원본 ZIP의 해시를 확인할 수 없습니다.");
  return reference;
}

export async function downloadNativeAssetBundle(reference, signal, download = downloadAssetFile) {
  assertAssetReference(reference);
  const blob = await download(`/project-assets/${encodeURIComponent(reference.asset_id)}/file`, signal);
  await verifyAssetBlob(blob, reference.archive_sha256);
  const archive = await readProjectArchive(blob);
  await verifyAssetBlob(await archive.read("project.json", "application/json"), reference.manifest_sha256);
  return blob;
}
