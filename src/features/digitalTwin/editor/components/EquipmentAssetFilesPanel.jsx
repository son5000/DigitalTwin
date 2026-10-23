import { useEffect, useState } from "react";
import { equipmentAssetRepository } from "../api/equipmentAssetRepository";
import { fileExtension } from "../model/equipmentAssetFiles";
import styles from "./MonitoringSettingsPanel.module.css";

const pathKey = (path) => String(path ?? "").replace(/\\/g, "/").toLowerCase();
const matches = (file, path) => pathKey(file.path || file.name) === pathKey(path) || pathKey(file.name) === pathKey(path).split("/").pop();
const isImage = (file) => ["JPG", "JPEG", "PNG", "WEBP"].includes(fileExtension(file.name));

export default function EquipmentAssetFilesPanel({ binding, onUpdateAsset, onUpload, uploading, uploadNotice }) {
  const [loaded, setLoaded] = useState(null);
  const [references, setReferences] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (binding?.sourceType !== "UPLOAD") return;
    async function read() {
      try {
        const record = await equipmentAssetRepository.get(binding.assetId);
        if (!record) throw new Error("저장된 원본 파일을 찾을 수 없습니다. 파일 묶음을 다시 등록하세요.");
        if (active) setLoaded({ record, id: binding.assetId });
        const refs = [];
        const mtl = record.files.find((file) => matches(file, binding.relatedSourceKey));
        if (binding.assetType === "OBJ" && mtl) {
          const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js");
          const creator = new MTLLoader().parse(await mtl.blob.text(), "");
          for (const info of Object.values(creator.materialsInfo)) for (const [key, value] of Object.entries(info)) {
            if (key.startsWith("map_") || ["bump", "norm", "disp"].includes(key)) refs.push(creator.getTextureParams(value, {}).url);
          }
        } else if (binding.textureSourceKey) refs.push(binding.textureSourceKey);
        if (active) { setLoaded({ record, id: binding.assetId }); setReferences([...new Set(refs)]); setError(""); }
      } catch (issue) { if (active) setError(issue.message); }
    }
    void read();
    return () => { active = false; };
  }, [binding?.assetId, binding?.sourceType, binding?.assetType, binding?.relatedSourceKey, binding?.textureSourceKey]);
  const record = loaded && loaded.id === binding?.assetId ? loaded.record : null;
  const disabled = busy || uploading;
  async function commit(files, changes = {}, primary = {}) {
    const next = { ...record, ...primary, id: `EQUIPMENT_ASSET_${crypto.randomUUID()}`, files, createdAt: new Date().toISOString() };
    await equipmentAssetRepository.put(next);
    onUpdateAsset(binding.id, { ...changes, assetId: next.id, status: "READY", errorMessage: "" });
    setMessage("파일을 교체했습니다. 프로젝트를 저장하면 변경된 연결이 보관됩니다.");
  }
  async function replace(event, target) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !record) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const model = matches(target, record.primaryFilePath ?? record.primaryFileName);
      const ext = fileExtension(file.name);
      if (model ? !["OBJ", "PLY"].includes(ext) : isImage(target) ? !isImage(file) : ext !== "MTL") throw new Error("해당 항목에 맞는 파일 형식을 선택하세요.");
      // Keep support-file paths so MTL references survive image replacement.
      const replacement = { ...target, name: model ? file.name : target.name, path: model ? file.name : target.path,
        originalName: file.name, type: file.type, size: file.size, blob: file };
      await commit(record.files.map((item) => item === target ? replacement : item), model ? {
        name: file.name, sourceKey: file.name, assetType: ext, usageType: ext === "PLY" ? "POINT_CLOUD" : "MODEL",
        displayMode: binding.displayMode === "PROXY" ? "PROXY" : binding.includeProxy || binding.displayMode === "COMPARE" ? "COMPARE" : ext === "PLY" ? "POINT_CLOUD" : "ACTUAL",
      } : {}, model ? { primaryFileName: file.name, primaryFilePath: file.name } : {});
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  async function append(event) {
    const incoming = Array.from(event.target.files ?? []); event.target.value = "";
    if (!incoming.length || !record) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (incoming.some((file) => !isImage(file) && fileExtension(file.name) !== "MTL")) throw new Error("MTL 또는 JPG·PNG·WebP 파일을 선택하세요.");
      const files = [...record.files];
      for (const file of incoming) {
        const index = files.findIndex((entry) => matches(entry, file.name));
        const entry = { name: file.name, path: file.name, type: file.type, size: file.size, blob: file };
        if (index < 0) files.push(entry); else files[index] = entry;
      }
      await commit(files, { relatedSourceKey: binding.relatedSourceKey || incoming.find((file) => fileExtension(file.name) === "MTL")?.name || null,
        textureSourceKey: binding.textureSourceKey || incoming.find(isImage)?.name || null });
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <section className={styles.assetFiles} aria-label="설비 원본 파일">
    <strong>모델·재질·텍스처 파일</strong>
    {binding && <dl className={styles.summary}>
      <div><dt>모델</dt><dd>{binding.sourceKey || binding.name}</dd></div>
      <div><dt>재질 (MTL)</dt><dd>{binding.assetType === "OBJ" ? binding.relatedSourceKey || "미연결" : "PLY는 MTL을 사용하지 않습니다."}</dd></div>
      <div><dt>텍스처 연결</dt><dd>{binding.assetType === "OBJ" ? references.join(", ") || (record ? "MTL에서 참조하는 이미지 없음" : "MTL 파일에 지정된 이미지") : binding.textureSourceKey || "이미지 미연결 · 정점 색상 사용 가능"}</dd></div>
    </dl>}
    {!binding && <p className={styles.help}>등록된 스캔 모델이 없습니다.</p>}
    {record?.files.map((file, index) => {
      const model = matches(file, record.primaryFilePath ?? record.primaryFileName);
      const role = model ? "모델" : fileExtension(file.name) === "MTL" ? "재질" : references.some((ref) => matches(file, ref)) ? "참조 텍스처" : "첨부 파일";
      return <div key={index} className={styles.assetFileRow}><div><strong>{role}</strong><span>{file.originalName || file.name}</span>
        {file.originalName && file.originalName !== file.name && <small>재질 연결 이름: {file.name}</small>}</div>
        <label className={styles.uploadButton}>교체<input aria-label={`${file.originalName || file.name} 교체`} type="file" disabled={disabled} accept={model ? ".obj,.ply" : isImage(file) ? ".jpg,.jpeg,.png,.webp" : ".mtl"} onChange={(event) => replace(event, file)} /></label></div>;
    })}
    {record && <>
      {binding.assetType === "OBJ" && <label className={styles.field}><span>사용할 재질 파일</span><select disabled={disabled} value={binding.relatedSourceKey ?? ""} onChange={(event) => onUpdateAsset(binding.id, { relatedSourceKey: event.target.value || null })}><option value="">재질 미사용</option>{record.files.filter((file) => fileExtension(file.name) === "MTL").map((file) => <option key={file.path || file.name} value={file.path || file.name}>{file.originalName || file.name}</option>)}</select></label>}
      {binding.assetType === "PLY" && <label className={styles.field}><span>사용할 텍스처 (UV 필요)</span><select disabled={disabled} value={binding.textureSourceKey ?? ""} onChange={(event) => onUpdateAsset(binding.id, { textureSourceKey: event.target.value || null })}><option value="">이미지 미사용</option>{record.files.filter(isImage).map((file) => <option key={file.path || file.name} value={file.path || file.name}>{file.originalName || file.name}</option>)}</select></label>}
      {references.filter((ref) => !record.files.some((file) => matches(file, ref))).map((ref) => <p className={styles.help} role="alert" key={ref}>참조 이미지 누락: {ref}</p>)}
      <label className={styles.uploadButton}>재질·텍스처 추가<input type="file" multiple disabled={disabled} accept=".mtl,.jpg,.jpeg,.png,.webp" onChange={append} /></label>
    </>}
    <label className={styles.uploadButton}>모델 파일 묶음 등록·교체<input type="file" multiple disabled={disabled} accept=".obj,.ply,.mtl,.jpg,.jpeg,.png,.webp" onChange={onUpload} /></label>
    <p className={styles.help}>모델의 색상과 무늬를 표시하려면 OBJ, MTL, 이미지 파일을 함께 등록하세요.</p>
    {disabled && <p role="status">파일 저장 중…</p>}
    {(message || uploadNotice) && <p className={styles.help} role="status">{message || uploadNotice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
