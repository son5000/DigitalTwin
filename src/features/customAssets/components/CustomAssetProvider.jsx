import { useCallback, useEffect, useMemo, useState } from "react";

import { setRuntimeCustomAssets } from "../core/customAssetRegistry";
import { cloneCustomAsset, createCustomAssetId } from "../core/customAssetTypes";
import { customAssetRepository } from "../storage/customAssetRepository";
import { CustomAssetContext } from "./customAssetContext";

export function CustomAssetProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const items = await customAssetRepository.list();
      setAssets(items);
      setRuntimeCustomAssets(items);
      setError("");
      return items;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "커스텀 에셋을 불러오지 못했습니다.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    const unsubscribe = customAssetRepository.subscribe(refresh);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  const save = useCallback(async (asset) => {
    const saved = await customAssetRepository.save(asset);
    await refresh();
    return saved;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await customAssetRepository.delete(id);
    await refresh();
  }, [refresh]);

  const duplicate = useCallback(async (source) => {
    const timestamp = new Date().toISOString();
    const copy = {
      ...cloneCustomAsset(source),
      id: createCustomAssetId(source.type),
      name: `${source.name} 복사본`,
      status: "draft",
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await save(copy);
    return copy;
  }, [save]);

  const value = useMemo(() => ({
    assets,
    loading,
    error,
    revision: assets.map((asset) => `${asset.id}:${asset.revision}:${asset.updatedAt}`).join("|"),
    refresh,
    save,
    remove,
    duplicate,
    repository: customAssetRepository,
  }), [assets, duplicate, error, loading, refresh, remove, save]);

  return <CustomAssetContext.Provider value={value}>{children}</CustomAssetContext.Provider>;
}
