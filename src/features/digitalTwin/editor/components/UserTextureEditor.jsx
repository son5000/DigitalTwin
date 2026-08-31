import { useEffect, useRef, useState } from "react";

import { textureAssetRepository } from "@/features/digitalTwin/editor/api/textureAssetRepository";
import { createUserTextureBinding, normalizeUserTexture, supportsUserTextureFile } from "@/features/digitalTwin/editor/model/userTexture";
import { primeUserTextureAsset } from "@/features/digitalTwin/editor/three/userTextureRuntime";

import NumericField from "./NumericField";
import styles from "./UserTextureEditor.module.css";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_TEXTURE_EDGE = 4096;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function decodeAndResize(file) {
  if (!supportsUserTextureFile(file)) throw new Error("JPG, PNG, WebP 이미지 파일만 업로드할 수 있습니다");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("이미지 용량은 20MB 이하여야 합니다");
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("손상되었거나 읽을 수 없는 이미지입니다"); }
  const maxEdge = Math.min(MAX_TEXTURE_EDGE, document.createElement("canvas").getContext("webgl2")?.getParameter(0x0D33) ?? MAX_TEXTURE_EDGE);
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  if (ratio === 1) return { blob: file, width, height, resized: false, close: () => bitmap.close() };
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/webp", 0.9));
  if (!blob) throw new Error("이미지를 안전한 크기로 변환하지 못했습니다");
  return { blob, width, height, resized: true, close: () => {} };
}

export default function UserTextureEditor({ value, targets, onChange }) {
  const inputRef = useRef(null);
  const [asset, setAsset] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const binding = normalizeUserTexture(value);
  const textureAssetId = binding?.textureAssetId ?? null;

  useEffect(() => {
    let active = true;
    let url = "";
    if (!textureAssetId) return undefined;
    textureAssetRepository.get(textureAssetId).then((found) => {
      if (!active) return;
      if (!found?.blob) { setAsset(null); setError("로컬 텍스처 파일을 찾을 수 없습니다 · 이미지를 다시 업로드하세요"); return; }
      url = URL.createObjectURL(found.blob);
      setAsset(found); setPreviewUrl(url); setError("");
    }).catch(() => active && setError("로컬 텍스처 파일을 찾을 수 없습니다 · 이미지를 다시 업로드하세요"));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [textureAssetId]);

  const upload = async (file) => {
    if (!file) return;
    setError("");
    try {
      const decoded = await decodeAndResize(file);
      const textureAssetId = `TEXTURE_${crypto.randomUUID()}`;
      const nextAsset = {
        id: textureAssetId, name: file.name, type: decoded.blob.type || file.type,
        size: decoded.blob.size, width: decoded.width, height: decoded.height,
        resized: decoded.resized, createdAt: new Date().toISOString(), blob: decoded.blob,
      };
      decoded.close();
      await textureAssetRepository.put(nextAsset);
      await primeUserTextureAsset(nextAsset);
      onChange(createUserTextureBinding(textureAssetId, binding?.target ?? targets[0].id));
      setAsset(nextAsset);
    } catch (uploadError) { setError(uploadError.message); }
  };

  const clearLocalTextures = async () => {
    const confirmed = window.confirm("이 브라우저에 임시 저장된 모든 텍스처를 삭제할까요? 사용 중인 오브젝트도 기본 재질로 표시되며 다시 업로드해야 합니다.");
    if (!confirmed) return;
    try {
      await textureAssetRepository.clear();
      window.location.reload();
    } catch {
      setError("로컬 임시 텍스처를 삭제하지 못했습니다");
    }
  };

  const update = (changes) => onChange(normalizeUserTexture({ ...binding, ...changes }));
  return (
    <div className={styles.editor} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files?.[0]); }}>
      <div className={styles.dropZone}>
        {binding && previewUrl ? <img src={previewUrl} alt="사용자 텍스처 미리보기" /> : <span>이미지를 놓거나 업로드하세요</span>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} />
      </div>
      {binding && asset ? <dl className={styles.metadata}><div><dt>파일</dt><dd>{asset.name}</dd></div><div><dt>해상도</dt><dd>{asset.width} × {asset.height}</dd></div><div><dt>용량</dt><dd>{formatBytes(asset.size)}</dd></div></dl> : null}
      <div className={styles.actions}>
        <button type="button" onClick={() => inputRef.current?.click()}>{binding ? "교체" : "이미지 업로드"}</button>
        {binding ? <button type="button" onClick={() => onChange(null)}>제거</button> : null}
        <button type="button" disabled={!binding} onClick={() => onChange(null)}>기본 재질로 복원</button>
        <button type="button" className={styles.dangerButton} onClick={clearLocalTextures}>로컬 임시 텍스처 전체 삭제</button>
      </div>
      {binding ? <>
        <label className={styles.selectField}><span>적용 면</span><select value={binding.target} onChange={(event) => update({ target: event.target.value })}>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
        <div className={styles.grid}>
          <NumericField label="반복 X" value={binding.repeat.x} min={0.01} step={0.1} onChange={(x) => update({ repeat: { ...binding.repeat, x } })} />
          <NumericField label="반복 Y" value={binding.repeat.y} min={0.01} step={0.1} onChange={(y) => update({ repeat: { ...binding.repeat, y } })} />
          <NumericField label="오프셋 X" value={binding.offset.x} step={0.05} onChange={(x) => update({ offset: { ...binding.offset, x } })} />
          <NumericField label="오프셋 Y" value={binding.offset.y} step={0.05} onChange={(y) => update({ offset: { ...binding.offset, y } })} />
          <NumericField label="회전" value={binding.rotation * 180 / Math.PI} step={1} unit="°" onChange={(degrees) => update({ rotation: degrees * Math.PI / 180 })} />
          <NumericField label="확대 비율" value={binding.scale} min={0.01} step={0.1} unit="배" onChange={(scale) => update({ scale })} />
        </div>
        <label className={styles.selectField}><span>래핑 방식</span><select value={binding.wrap} onChange={(event) => update({ wrap: event.target.value })}><option value="REPEAT">반복</option><option value="MIRROR">거울 반복</option><option value="CLAMP">가장자리 고정</option></select></label>
      </> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
