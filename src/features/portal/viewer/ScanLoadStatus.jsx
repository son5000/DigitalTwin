import { useSyncExternalStore } from "react";
import { getScanLoadState, subscribeScanLoadState } from "../../digitalTwin/editor/three/scanLoadState";

export default function ScanLoadStatus({ equipmentId }) {
  const state = useSyncExternalStore(subscribeScanLoadState, () => getScanLoadState(equipmentId));
  if (!state) return null;
  return <p role="status" aria-live="polite">{state}</p>;
}
