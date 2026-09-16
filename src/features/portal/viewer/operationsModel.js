export const SERVICE_TITLES = { assets: "자산 관리", people: "담당자·AS센터", tickets: "고장·정비 접수", reports: "운영 보고서", notifications: "알림 센터", settings: "뷰어 설정", profile: "마이페이지" };
export const TICKET_STATUSES = ["접수", "처리 중", "보류", "완료"];
export const ASSET_STATUSES = ["정상", "점검 필요", "고장", "사용 중지"];
export const PRIORITIES = ["긴급", "높음", "보통", "낮음"];
export const operationsKey = (projectId) => `digital-twin-operations-v1:${encodeURIComponent(projectId)}`;
export const emptyOperations = () => ({ version: 1, assets: [], people: [], tickets: [], reports: [], notifications: [], profile: {}, preferences: {} });

export function readOperations(storage, projectId) {
  const raw = storage.getItem(operationsKey(projectId));
  if (!raw) return emptyOperations();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || ["assets", "people", "tickets", "reports", "notifications"].some((key) => !Array.isArray(data[key])
    || data[key].some((item) => !item || typeof item.id !== "string" || (item.history && !Array.isArray(item.history))))
    || !data.profile || typeof data.profile !== "object" || !data.preferences || typeof data.preferences !== "object") throw new Error("운영 저장 데이터를 읽을 수 없습니다. 원본 데이터를 유지합니다.");
  return data;
}

export function readViewerPreferences(projectId) {
  try { return readOperations(window.localStorage, projectId).preferences; } catch { return {}; }
}

export function updateOperations(storage, projectId, change) {
  const next = change(readOperations(storage, projectId));
  storage.setItem(operationsKey(projectId), JSON.stringify(next));
  return next;
}

export function getOperationsDirectory(tree) {
  const path = (node) => {
    const labels = [];
    const visited = new Set([node.key]);
    let parent = tree.nodes.get(node.parentKey);
    while (parent && !visited.has(parent.key)) {
      visited.add(parent.key); labels.unshift(parent.label); parent = tree.nodes.get(parent.parentKey);
    }
    return labels.join(" / ") || "위치 미지정";
  };
  const nodes = [...tree.nodes.values()].filter((node) => !node.synthetic);
  return {
    assets: nodes.filter((node) => ["EQUIPMENT", "SITE_OBJECT"].includes(node.type)).map((node) => ({
      id: node.key, name: node.label, location: path(node), locationId: node.parentKey ?? "", worldKey: node.key, status: "정상",
    })),
    locations: nodes.filter((node) => ["SITE", "BUILDING", "FLOOR", "ROOM"].includes(node.type)).map((node) => ({ id: node.key, name: `${path(node) === "위치 미지정" ? "" : `${path(node)} / `}${node.label}` })),
  };
}

export function mergeOperationsAssets(worldAssets, savedAssets) {
  const saved = new Map(savedAssets.map((item) => [item.id, item]));
  const ids = new Set(worldAssets.map((item) => item.id));
  return [...worldAssets.map((item) => ({ ...item, ...saved.get(item.id), name: item.name, location: item.location, locationId: item.locationId, worldKey: item.worldKey })),
    ...savedAssets.filter((item) => !ids.has(item.id)).map((item) => ({ ...item, missing: Boolean(item.worldKey) }))];
}

export function saveOperationRecord(data, collection, record, actor = "운영자", now = new Date().toISOString()) {
  if (!["assets", "people", "tickets"].includes(collection)) throw new Error("지원하지 않는 관리 항목입니다.");
  if (!String(record.name ?? record.title ?? "").trim()) throw new Error("이름 또는 제목을 입력하세요.");
  if (collection === "assets" && !ASSET_STATUSES.includes(record.status)) throw new Error("자산 상태를 확인하세요.");
  if (collection === "people" && !["담당자", "AS센터"].includes(record.kind)) throw new Error("담당자 유형을 확인하세요.");
  if (collection === "tickets") {
    if (!TICKET_STATUSES.includes(record.status) || !PRIORITIES.includes(record.priority)) throw new Error("접수 상태와 우선순위를 확인하세요.");
    if (!record.assetId && !record.locationId) throw new Error("대상 설비 또는 위치를 선택하세요.");
    if (!record.description?.trim()) throw new Error("증상을 입력하세요.");
    if (record.status === "완료" && !record.resolution?.trim()) throw new Error("완료 시 조치 내용을 입력하세요.");
  }
  const old = data[collection].find((item) => item.id === record.id);
  const next = { ...record, id: old?.id ?? record.id ?? crypto.randomUUID(), createdAt: old?.createdAt ?? now, updatedAt: now };
  const statusChange = old?.status && old.status !== next.status ? `${old.status} → ${next.status}` : old ? "정보 수정" : "등록";
  next.history = [...(old?.history ?? []), { at: now, actor, action: statusChange, note: record.resolution || record.note || "" }];
  return { ...data, [collection]: old ? data[collection].map((item) => item.id === old.id ? next : item) : [...data[collection], next] };
}

export function ingestNotifications(data, incoming, now = new Date().toISOString()) {
  let changed = false;
  const notifications = [...data.notifications];
  incoming.forEach((item) => {
    // The same occurrence keeps its acknowledgment on subsequent viewer visits.
    const sourceKey = JSON.stringify([item.id, item.time ?? "", item.severity, item.title, item.message]);
    if (notifications.some((entry) => entry.sourceKey === sourceKey)) return;
    changed = true;
    notifications.push({ ...item, id: crypto.randomUUID(), sourceKey, createdAt: Number.isNaN(Date.parse(item.time)) ? now : new Date(item.time).toISOString(), status: "미확인", history: [{ at: now, actor: "시스템", action: "수신 기록" }] });
  });
  return changed ? { ...data, notifications } : data;
}

export function updateNotification(data, id, status, actor, note = "", now = new Date().toISOString()) {
  if (!["확인", "종결", "미확인"].includes(status)) throw new Error("알림 상태를 확인하세요.");
  if (status === "종결" && !note.trim()) throw new Error("종결 사유를 입력하세요.");
  return { ...data, notifications: data.notifications.map((item) => item.id !== id ? item : {
    ...item, status, updatedAt: now, history: [...(item.history || []), { at: now, actor, action: status, note }],
  }) };
}

export function createOperationsReport(data, assets, { title, from, to, author }, now = new Date().toISOString()) {
  if (!title.trim() || !from || !to || from > to) throw new Error("보고서 제목과 올바른 조회 기간을 입력하세요.");
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59.999`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("조회 기간을 확인하세요.");
  const within = (item) => Date.parse(item.createdAt) >= start && Date.parse(item.createdAt) <= end;
  return {
    id: crypto.randomUUID(), title: title.trim(), from, to, author, createdAt: now,
    assets: structuredClone(assets), tickets: structuredClone(data.tickets.filter(within)),
    notifications: structuredClone(data.notifications.filter(within)),
  };
}

export function reportCsv(report) {
  const cell = (value) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const rows = [["보고서", report.title, "시작일", report.from, "종료일", report.to], ["작성자", report.author, "생성일", report.createdAt],
    ["유형", "이름/제목", "위치", "상태", "등록/수신일", "조치/내용"],
    ...report.assets.map((item) => ["자산(생성 시점)", item.name, item.location, item.status, item.createdAt, item.note]),
    ...report.tickets.map((item) => ["접수", item.title, item.locationName, item.status, item.createdAt, item.resolution || item.description]),
    ...report.notifications.map((item) => ["알림", item.title, "", item.status, item.createdAt, item.message])];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
