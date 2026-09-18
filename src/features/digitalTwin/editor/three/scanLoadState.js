const listeners = new Set();
const states = new Map();
export function setScanLoadState(id, state) {
  if (!id) return;
  states.delete(id);
  states.set(id, state);
  while (states.size > 32) states.delete(states.keys().next().value);
  listeners.forEach((listener) => listener());
}
export const getScanLoadState = (id) => states.get(id) ?? "";
export const subscribeScanLoadState = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
