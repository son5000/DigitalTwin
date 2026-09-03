import { useEffect, useState } from "react";

import { equipmentAssetRepository } from "@/features/digitalTwin/editor/api/equipmentAssetRepository";

export default function LocalEquipmentAssetImage({ binding, alt }) {
  const [source, setSource] = useState(binding?.objectUrl ?? (binding?.sourceType === "UPLOAD" ? "" : binding?.sourceKey ?? ""));

  useEffect(() => {
    if (binding?.objectUrl || binding?.sourceType !== "UPLOAD" || !binding?.assetId) return undefined;
    let active = true;
    let objectUrl = "";
    equipmentAssetRepository.get(binding.assetId).then((asset) => {
      const entry = asset?.files?.find((file) => file.name === asset.primaryFileName) ?? asset?.files?.[0];
      if (!active || !entry?.blob) return;
      objectUrl = URL.createObjectURL(entry.blob);
      setSource(objectUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [binding?.assetId, binding?.objectUrl, binding?.sourceKey, binding?.sourceType]);

  return source ? <img src={source} alt={alt} /> : <div role="status">로컬 관측 이미지를 찾을 수 없습니다.</div>;
}
