// Explicitly selected UI fixtures. Never substitute these for failed live data.
export function demoFrame(kind = "VISION") {
  const thermal = kind === "THERMAL";
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${thermal ? "#122364" : "#d2dce0"}"/><rect x="190" y="25" width="260" height="310" fill="${thermal ? "#bf3929" : "#547989"}" stroke="white" stroke-width="3"/><path d="M320 30V330M195 90H445" stroke="${thermal ? "#ffc751" : "#9ab5be"}" stroke-width="3"/><circle cx="360" cy="210" r="45" fill="${thermal ? "#ffdc52" : "#274550"}"/><text x="20" y="345" fill="${thermal ? "white" : "#243640"}" font-size="20">DEMO / ${kind} / NOT A MEASUREMENT</text></svg>`)}`;
}
export function demoSensor(serialNumber, equipmentId, deviceKind = "VISION") {
  return { id: `demo:${serialNumber}`, serialNumber, equipmentId, deviceKind, sensorType: ["VISION", "THERMAL"].includes(deviceKind) ? "CAMERA" : "SENSOR",
    frameUrl: demoFrame(deviceKind), frameMeasuredAt: new Date().toISOString(), dataSource: "DEMO", connectionStatus: "DEMO",
    fieldOfView: 50, aspectRatio: 16 / 9, resolution: { width: 640, height: 360 }, capabilities: ["VISION", "THERMAL", "ULTRASOUND", "AUDIO"] };
}
export function demoReading(roi, now = Date.now()) {
  const values = { "temperature.max": 72.5, "temperature.min": 31.2, "temperature.avg": 48.6, "ultrasound.db": 65.4, "vision.changePercent": 12.4 };
  return { roiId: roi.id, equipmentId: roi.equipmentId, revision: roi.revision, measuredAt: new Date(now).toISOString(), quality: "GOOD", values, status: "NORMAL", dataSource: "DEMO" };
}
export function demoAudioBlob(processing = "AUDIBLE") {
  const rate = 16000, samples = rate * 2, buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * (processing === "HETERODYNE" ? 660 : 440) * i / rate) * 2200 * Math.min(i / 800, (samples - i) / 800, 1), true);
  return new Blob([buffer], { type: "audio/wav" });
}
