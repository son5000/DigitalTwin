export const LAYOUT_STORAGE_KEY = "digital-twin-editor-layout";

export const LAYOUT_INITIALIZATION_STATUS = Object.freeze({
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  EMPTY: "EMPTY",
  ERROR: "ERROR",
});

export function readLocalLayout(storage, storageKey = LAYOUT_STORAGE_KEY) {
  try {
    const serialized = storage?.getItem?.(storageKey);
    if (!serialized) return { status: LAYOUT_INITIALIZATION_STATUS.EMPTY, layout: null, source: "LOCAL" };
    const layout = JSON.parse(serialized);
    if (!layout || typeof layout !== "object") throw new Error("저장 데이터가 올바른 객체가 아닙니다.");
    return { status: LAYOUT_INITIALIZATION_STATUS.SUCCESS, layout, source: "LOCAL" };
  } catch (error) {
    return {
      status: LAYOUT_INITIALIZATION_STATUS.ERROR,
      layout: null,
      source: "LOCAL",
      errorCode: "CORRUPT_LOCAL_DATA",
      message: "로컬 관측 구성을 읽을 수 없습니다. 기존 데이터는 삭제되지 않았습니다.",
      cause: error,
    };
  }
}

function withTimeout(promise, timeoutMs) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error("REMOTE_TIMEOUT")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

export async function initializeLayout({ storage, storageKey = LAYOUT_STORAGE_KEY, remoteLoader = null, timeoutMs = 2500 } = {}) {
  if (typeof remoteLoader === "function") {
    try {
      const remoteLayout = await withTimeout(Promise.resolve().then(remoteLoader), timeoutMs);
      if (remoteLayout && typeof remoteLayout === "object") {
        return { status: LAYOUT_INITIALIZATION_STATUS.SUCCESS, layout: remoteLayout, source: "REMOTE" };
      }
    } catch (remoteError) {
      const localResult = readLocalLayout(storage, storageKey);
      return { ...localResult, fallbackReason: remoteError?.message === "REMOTE_TIMEOUT" ? "REMOTE_TIMEOUT" : "REMOTE_ERROR" };
    }
  }
  return readLocalLayout(storage, storageKey);
}