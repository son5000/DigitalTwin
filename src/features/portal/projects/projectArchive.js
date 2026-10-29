// Reuse the ZIP implementation shipped with the installed Three.js build.
import { Zip, ZipPassThrough, Inflate } from "three/addons/libs/fflate.module.js";

export const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
export const MAX_CONFIG_BYTES = 64 * 1024 * 1024;
const CHUNK_BYTES = 256 * 1024;
const MAX_ENTRIES = 10000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function updateCrc(crc, bytes) {
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return crc;
}
function validPath(path) {
  // eslint-disable-next-line no-control-regex
  return path && !path.startsWith("/") && !/[\\:\x00]/.test(path)
    && path.split("/").every((part) => part && part !== "." && part !== "..");
}
function invalid() { throw new Error("ZIP 파일이 손상되었거나 지원하지 않는 형식입니다. 원본 ZIP을 다시 선택하세요."); }

// STORE mode avoids CPU-heavy compression and base64 expansion of large scans.
// Feed bounded chunks so a 300MB OBJ never needs one giant ArrayBuffer.
export async function writeProjectArchive(entries, onProgress = () => {}) {
  const total = entries.reduce((sum, entry) => sum + entry.blob.size, 0);
  if (entries.length > MAX_ENTRIES || total > MAX_ARCHIVE_BYTES) throw new Error("설정과 첨부 파일 합계는 1GB 이하여야 합니다.");
  const parts = [], names = new Set();
  let error, size = 0, processed = 0, lastPercent = -1;
  const zip = new Zip((failure, data) => {
    if (failure) { error = failure; return; }
    size += data.length;
    parts.push(data);
  });
  for (const { path, blob } of entries) {
    if (!validPath(path) || names.has(path) || encoder.encode(path).length > 65535) invalid();
    names.add(path);
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const chunk = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
      entry.push(chunk, false);
      processed += chunk.length;
      if (error) throw error;
      const percent = Math.round(processed / Math.max(1, total) * 100);
      if (percent !== lastPercent) onProgress(`ZIP 생성 중 · ${percent}%`);
      lastPercent = percent;
    }
    entry.push(new Uint8Array(), true);
  }
  zip.end();
  if (error) throw error;
  if (size > MAX_ARCHIVE_BYTES) throw new Error("ZIP 파일은 1GB 이하여야 합니다.");
  return new Blob(parts, { type: "application/zip" });
}

// Read the central directory before inflating anything. Check declared sizes,
// paths, duplicate entries and CRC, including JSON, before publishing a project.
export async function readProjectArchive(blob) {
  if (blob.size > MAX_ARCHIVE_BYTES || blob.size < 22) invalid();
  const tailStart = Math.max(0, blob.size - 65557);
  const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
  let end = tail.byteLength - 22;
  while (end >= 0 && (tail.getUint32(end, true) !== 0x06054b50 || end + 22 + tail.getUint16(end + 20, true) !== tail.byteLength)) end--;
  if (end < 0 || tail.getUint16(end + 4, true) || tail.getUint16(end + 6, true)) invalid();
  const count = tail.getUint16(end + 10, true), directorySize = tail.getUint32(end + 12, true), directoryOffset = tail.getUint32(end + 16, true);
  if (!count || count > MAX_ENTRIES || tail.getUint16(end + 8, true) !== count || directoryOffset + directorySize !== tailStart + end || directorySize > 16 * 1024 * 1024) invalid();
  const directory = new Uint8Array(await blob.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
  const view = new DataView(directory.buffer);
  const entries = new Map();
  let offset = 0, total = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) invalid();
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true), compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const start = view.getUint32(offset + 42, true);
    if (offset + 46 + nameLength + extraLength + commentLength > view.byteLength) invalid();
    const path = decoder.decode(directory.subarray(offset + 46, offset + 46 + nameLength));
    if ((flags & 1) || ![0, 8].includes(method) || view.getUint16(offset + 34, true) || start + 30 > directoryOffset) invalid();
    if (!validPath(path) || entries.has(path) || size > MAX_ARCHIVE_BYTES || (method === 0 && compressed !== size)) invalid();
    total += size;
    if (total > MAX_ARCHIVE_BYTES || (path === "project.json" && size > MAX_CONFIG_BYTES)) invalid();
    entries.set(path, { flags, method, crc, compressed, size, start });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== directorySize || !entries.has("project.json")) invalid();
  return {
    entries,
    async read(path, type = "application/octet-stream") {
      const entry = entries.get(path);
      if (!entry) throw new Error(`ZIP에 필요한 파일이 없습니다: ${path}`);
      const header = new DataView(await blob.slice(entry.start, entry.start + 30).arrayBuffer());
      if (header.getUint32(0, true) !== 0x04034b50 || header.getUint16(6, true) !== entry.flags || header.getUint16(8, true) !== entry.method) invalid();
      const nameLength = header.getUint16(26, true), extraLength = header.getUint16(28, true);
      const start = entry.start + 30 + nameLength + extraLength;
      if (start + entry.compressed > directoryOffset) invalid();
      if (decoder.decode(await blob.slice(entry.start + 30, entry.start + 30 + nameLength).arrayBuffer()) !== path) invalid();
      const parts = [];
      let size = 0, crc = -1;
      const receive = (bytes) => {
        size += bytes.length;
        if (size > entry.size) invalid();
        crc = updateCrc(crc, bytes);
        parts.push(new Blob([bytes]));
      };
      const inflater = entry.method === 8 ? new Inflate(receive) : null;
      for (let offset = 0; offset < entry.compressed; offset += CHUNK_BYTES) {
        const bytes = new Uint8Array(await blob.slice(start + offset, start + Math.min(offset + CHUNK_BYTES, entry.compressed)).arrayBuffer());
        if (inflater) inflater.push(bytes, offset + bytes.length === entry.compressed);
        else receive(bytes);
      }
      if (size !== entry.size || ((crc ^ -1) >>> 0) !== entry.crc) throw new Error(`파일 무결성 확인에 실패했습니다: ${path}`);
      return new Blob(parts, { type });
    },
  };
}
