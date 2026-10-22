import { getEnclosure, getEnclosureDoorEntries } from "../model/equipmentEnclosure";
import styles from "./EnclosureDoorControls.module.css";
import ViewerOverlaySlot from "./ViewerOverlaySlot";

export default function EnclosureDoorControls({ equipment, onToggle }) {
  const c = getEnclosure(equipment);
  if (!c.enabled || !c.interactive || !(c.doorCount || c.rear.doorCount)) return null;
  return <ViewerOverlaySlot name="controls"><div className={styles.controls} data-viewer-control="doors" data-camera-safe-ui role="group" aria-label="캐비넷 문 표시">
    {getEnclosureDoorEntries(equipment).map((door) => <button type="button" key={door.id} aria-pressed={door.open} onClick={() => onToggle(door.index, !door.open, door.side)}>{door.label} {door.open ? "닫기" : "열기"}{door.open && door.hideWhenOpen ? " · 숨김" : ""}</button>)}
  </div></ViewerOverlaySlot>;
}
