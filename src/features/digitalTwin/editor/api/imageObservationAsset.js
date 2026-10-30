import { textureAssetRepository } from "./textureAssetRepository.js";
import { sensorImageTransform } from "../model/sensorImageTransform.js";
import { getSensorFrame, monitoringApiBase } from "./monitoringClient.js";

// Keep the unprocessed reference frame as a binary asset, not base64 in layout JSON.
export async function captureObservationImage(sensor, displayedFrame = null) {
  let source = sensorImageTransform(sensor).source;
  if (displayedFrame?.url) source = { ...source, url: displayedFrame.url, measuredAt: displayedFrame.measuredAt };
  else if (source.type === "SERVER" && monitoringApiBase && sensor.serverSensorId) {
    const frame = await getSensorFrame(sensor.serverSensorId,AbortSignal.timeout(15000),"VISION");
    source = { ...source, url:frame.url, measuredAt:frame.measuredAt };
  }
  if (!source.url) throw new Error("비전 카메라의 원본 이미지를 먼저 불러오세요.");
  const response = await fetch(source.url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`원본 이미지를 가져오지 못했습니다 (${response.status}).`);
  const blob = await response.blob();
  if (blob.size > 32 * 1024 * 1024) throw new Error("관측 기준 이미지는 32MB 이하로 등록하세요.");
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width, height = bitmap.height; bitmap.close();
  const id = `vision-original-${crypto.randomUUID()}`;
  const extension = ({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/svg+xml":"svg"})[blob.type] ?? "image";
  const name = `vision-${sensor.id}-${Date.now()}.${extension}`;
  await textureAssetRepository.put({ id, name, blob, width, height, createdAt:new Date().toISOString() });
  return { textureAssetId:id, name, width, height, sensorBindingId:sensor.id, serverSensorId:sensor.serverSensorId ?? null,
    serialNumber:sensor.serialNumber ?? "", sourceUrl:source.url, measuredAt:source.measuredAt, capturedAt:new Date().toISOString(), kind:"UNPROCESSED_CAMERA_FRAME" };
}
