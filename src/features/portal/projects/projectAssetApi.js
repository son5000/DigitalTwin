import { assertProjectId } from "./projectConfigurationApi.js";
import { createProjectAssetArchive } from "./projectBundle.js";
import { decodeProjectFile } from "./projectBundleFiles.js";
import { downloadNativeAssetBundle, NATIVE_ASSET_KIND, uploadNativeAssetBundle, validateAssetManifest } from "./projectAssetTransport.js";
import { loadDisplayAsset } from "./displayAssetApi.js";
import { assertAssetsComplete, restoreAssetRecords, validateNativeAssets } from "./projectAssetRestore.js";
import { equipmentAssetRepository } from "../../digitalTwin/editor/api/equipmentAssetRepository.js";
import { textureAssetRepository } from "../../digitalTwin/editor/api/textureAssetRepository.js";
import { customAssetRepository } from "../../customAssets/storage/customAssetRepository";
import { setRuntimeCustomAssets } from "../../customAssets/core/customAssetRegistry.js";

export async function uploadProjectAssets(projectId, layout, signal) {
  assertProjectId(projectId);
  signal?.throwIfAborted();
  const archive = await createProjectAssetArchive(projectId, layout);
  signal?.throwIfAborted();
  return archive ? [await uploadNativeAssetBundle(projectId, archive, signal)] : [];
}

export async function loadProjectAssets(projectId, revision, layout, signal, assetManifest = []) {
  assertProjectId(projectId);
  if (!Number.isInteger(revision) || revision < 1) throw new Error("프로젝트 버전을 확인해 주세요.");
  validateAssetManifest(assetManifest);
  signal?.throwIfAborted();
  const assets = { equipment: [], textures: [], custom: [] };
  const bindings = (layout.equipmentAssetBindings ?? layout.observationConfig?.equipmentAssetBindings ?? []).map((binding) => ({ ...binding }));
  for (const reference of assetManifest) {
    if (reference.kind === NATIVE_ASSET_KIND) {
      const archive = await downloadNativeAssetBundle(reference, signal);
      const restored = validateNativeAssets(await decodeProjectFile(archive, () => {}));
      for (const kind of Object.keys(assets)) assets[kind].push(...restored[kind]);
    } else {
      const targets = bindings.filter((binding) => (binding.backendAsset?.asset_id ?? binding.assetId) === reference.asset_id);
      if (!targets.length) throw new Error(`표시 자산 ${reference.asset_id}에 연결된 설비 모델 설정이 없습니다. equipmentAssetBindings를 포함해 다시 게시해 주세요.`);
      const record = await loadDisplayAsset(reference, signal);
      for (const target of targets) {
        const id = target.assetId || reference.asset_id;
        if (!assets.equipment.some((item) => item.id === id)) assets.equipment.push({ ...record, id });
        Object.assign(target, { assetId: id, assetType: record.assetType, sourceType: "UPLOAD", sourceKey: record.primaryFileName,
          backendAsset: { ...reference }, status: "READY" });
      }
    }
  }
  const restoredLayout = { ...layout, equipmentAssetBindings: bindings,
    observationConfig: { ...layout.observationConfig, equipmentAssetBindings: bindings } };
  validateNativeAssets({ format: "digital-twin-assets", version: 2, assets });
  assertAssetsComplete(restoredLayout, assets);
  await restoreAssetRecords(assets, { equipment: equipmentAssetRepository, textures: textureAssetRepository, custom: customAssetRepository }, signal);
  if (assets.custom.length) setRuntimeCustomAssets(await customAssetRepository.list());
  signal?.throwIfAborted();
  Object.assign(layout, restoredLayout);
}

export const loadViewerProjectAssets = loadProjectAssets;
