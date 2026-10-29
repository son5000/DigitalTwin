import { MAX_ARCHIVE_BYTES, MAX_CONFIG_BYTES, readProjectArchive, writeProjectArchive } from "./projectArchive.js";

export function safeBundleName(value) {
  // eslint-disable-next-line no-control-regex
  return String(value || "project").split(/[\\/]/).pop().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 160) || "project";
}
function parseDataUrl(value) {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
  const header = value.slice(0, comma), base64 = /;base64$/i.test(header);
  const bytes = base64 ? Uint8Array.from(atob(value.slice(comma + 1)), (char) => char.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(value.slice(comma + 1)));
  return { blob: new Blob([bytes], { type: header.slice(5).split(";")[0] }), header, base64 };
}
function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function encodeProjectZip(source, onProgress) {
  const files = [], entries = [], inlineCache = new Map();
  let bytes = 0;
  function addFile(blob, name, extra = {}) {
    bytes += blob.size;
    if (bytes > MAX_ARCHIVE_BYTES) throw new Error("첨부 파일 합계가 1GB를 넘습니다.");
    const path = `files/${String(files.length + 1).padStart(5, "0")}-${safeBundleName(name)}`;
    files.push({ path, name, size: blob.size, type: blob.type });
    entries.push({ path, blob });
    return { $file: path, ...extra };
  }
  function encode(value, name = "file") {
    if (value instanceof Blob) return addFile(value, name);
    if (typeof value === "string" && value.startsWith("data:")) {
      if (!inlineCache.has(value)) {
        const { blob, header, base64 } = parseDataUrl(value);
        const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" })[blob.type] ?? "bin";
        inlineCache.set(value, addFile(blob, `${name}.${extension}`, { encoding: "data-url", header, base64 }));
      }
      return inlineCache.get(value);
    }
    if (Array.isArray(value)) return value.map((child) => encode(child, name));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== "objectUrl")
      .map(([key, child]) => [key, encode(child, key === "blob" ? value.path || value.name || value.originalName || name : key)]));
    return value;
  }
  const bundle = encode({ ...source, version: 2 });
  bundle.files = files;
  const json = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  if (json.size > MAX_CONFIG_BYTES) throw new Error("설정 JSON이 64MB를 넘습니다.");
  return writeProjectArchive([{ path: "project.json", blob: json }, ...entries], onProgress);
}

export async function decodeProjectFile(file, onProgress) {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("1GB 이하의 ZIP 파일만 가져올 수 있습니다.");
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    if (file.size > 150 * 1024 * 1024) throw new Error("기존 JSON 구성 파일은 150MB 이하여야 합니다.");
    const source = JSON.parse(await file.text());
    if (source.version !== 1) throw new Error("project.json 단독으로는 가져올 수 없습니다. 원본 ZIP 파일을 선택하세요.");
    function decode(value) {
      if (value && typeof value === "object" && "$binary" in value) return parseDataUrl(value.$binary).blob;
      if (Array.isArray(value)) return value.map(decode);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
      return value;
    }
    return decode(source);
  }
  const archive = await readProjectArchive(file);
  const source = JSON.parse(await (await archive.read("project.json", "application/json")).text());
  if (source.version !== 2 || !Array.isArray(source.files)) throw new Error("지원하는 ZIP 구성 버전이 아닙니다.");
  const manifest = new Map(), cache = new Map();
  for (const item of source.files) {
    if (typeof item?.path !== "string" || !item.path.startsWith("files/") || manifest.has(item.path) || archive.entries.get(item.path)?.size !== item.size || typeof item.type !== "string") throw new Error("ZIP 첨부 파일 목록이 올바르지 않습니다.");
    manifest.set(item.path, item);
  }
  if (archive.entries.size !== manifest.size + 1) throw new Error("ZIP 파일 목록과 설정 JSON의 첨부 목록이 다릅니다.");
  for (const item of manifest.values()) {
    onProgress(`첨부 파일 검사 중 · ${item.name}`);
    cache.set(item.path, await archive.read(item.path, item.type));
  }
  const inlineCache = new Map();
  async function decode(value) {
    if (value && typeof value === "object" && "$file" in value) {
      const blob = cache.get(value.$file);
      if (!blob) throw new Error(`연결된 첨부 파일이 없습니다: ${value.$file}`);
      if (!value.encoding) return blob;
      if (value.encoding !== "data-url" || typeof value.header !== "string" || !value.header.startsWith("data:") || typeof value.base64 !== "boolean") throw new Error("이미지 파일 연결 정보가 올바르지 않습니다.");
      const key = `${value.$file}:${value.header}`;
      if (!inlineCache.has(key)) inlineCache.set(key, value.base64
        ? `${value.header},${(await blobDataUrl(blob)).split(",")[1]}`
        : `${value.header},${encodeURIComponent(await blob.text())}`);
      return inlineCache.get(key);
    }
    if (Array.isArray(value)) { const result = []; for (const child of value) result.push(await decode(child)); return result; }
    if (value && typeof value === "object") { const result = []; for (const [key, child] of Object.entries(value)) result.push([key, await decode(child)]); return Object.fromEntries(result); }
    return value;
  }
  return decode(source);
}
