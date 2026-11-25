export function sensorLookupPath(serialNumber, equipmentId) {
  const serial = typeof serialNumber === "string" ? serialNumber.trim() : "";
  if (!serial) throw new Error("시리얼 번호를 입력하세요.");
  if (!equipmentId || typeof equipmentId !== "string") throw new Error("연결할 설비를 선택하세요.");
  return `/sensors/by-serial?${new URLSearchParams({ serialNumber: serial, equipmentId })}`;
}

export function normalizeSensorLookup(result, serialNumber, equipmentId) {
  const sensor = result?.sensor ?? result?.data?.sensor;
  const id = typeof sensor?.id === "string" ? sensor.id.trim()
    : Number.isSafeInteger(sensor?.id) && sensor.id >= 0 ? String(sensor.id) : "";
  if (!id || typeof sensor.serialNumber !== "string" || sensor.serialNumber.trim() !== serialNumber.trim())
    throw new Error("조회된 센서 식별자 또는 시리얼 번호가 요청과 다릅니다.");
  // Omitted ownership is unknown, not proof that the sensor is unassigned.
  if (!Object.hasOwn(sensor, "equipmentId") || (sensor.equipmentId !== null && (typeof sensor.equipmentId !== "string" || !sensor.equipmentId.trim())))
    throw new Error("센서의 설비 연결 여부를 확인할 수 없습니다. 서버 응답의 equipmentId를 확인하세요.");
  if (sensor.equipmentId !== null && sensor.equipmentId !== equipmentId)
    throw new Error("다른 설비에 연결된 센서입니다. 기존 연결을 확인하세요.");
  return { id, serialNumber: sensor.serialNumber.trim(), equipmentId: sensor.equipmentId };
}

// Editor lookup applies identity only; live values and device specifications stay out.
export function sensorLookupChanges(result, sensor, equipmentId, demo = false) {
  const sameSensor = sensor.serverSensorId === result.id && sensor.serialNumber?.trim() === result.serialNumber;
  return {
    serverSensorId: result.id, serverKey: result.id, serialNumber: result.serialNumber,
    equipmentIds: [equipmentId], dataSource: demo ? "DEMO" : "SERVER",
    ...(!sameSensor ? { calibration: null, calibrationConfirmed: false, calibrationConfirmationFrame: null, calibrationConfirmationModel: null } : {}),
  };
}

export function sensorSerialChanges(serialNumber) {
  return { serialNumber, serverSensorId: null, serverKey: "", frameUrl: "", frameMeasuredAt: null,
    dataSource: null, connectionStatus: "UNKNOWN", reportedCapabilities: [],
    calibration: null, calibrationConfirmed: false, calibrationConfirmationFrame: null, calibrationConfirmationModel: null };
}

export function sensorLookupErrorMessage(error) {
  if (error.name === "TimeoutError") return "센서 확인 시간이 초과되었습니다. 다시 확인하세요.";
  if (error.name === "TypeError" && !error.status) return "센서 서버에 연결하지 못했습니다. 서버 주소와 CORS 설정을 확인하세요.";
  const message = error.status === 404 ? "센서를 확인하지 못했습니다. 시리얼 번호와 서버 등록 상태를 확인하세요."
    : error.status === 409 ? "센서의 설비 연결이 충돌합니다. 기존 연결을 확인하세요."
      : error.message || "센서를 확인하지 못했습니다.";
  return error.requestId ? `${message} (요청 ID: ${error.requestId})` : message;
}
