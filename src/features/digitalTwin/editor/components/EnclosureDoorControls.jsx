import { getEnclosure, getEnclosureDoorEntries } from "../model/equipmentEnclosure";
import styles from "./EnclosureDoorControls.module.css";
import ViewerOverlaySlot from "./ViewerOverlaySlot";

export default function EnclosureDoorControls({ equipment, onToggle }) {
  const c = getEnclosure(equipment);
  if (!c.enabled || !c.interactive || !(c.doorCount || c.rear.doorCount)) return null;
  const doors = getEnclosureDoorEntries(equipment);
  return <ViewerOverlaySlot name="controls"><div className={styles.controls} data-viewer-control="doors" data-single={doors.length === 1} data-camera-safe-ui role="group" aria-label="캐비넷 문 표시">
    {doors.map((door) => {
      const action = door.open ? "닫기" : "열기";
      const location = door.label.replace(" · ", " ").replace("왼쪽부터 ", "").replace(/ 문$/, "");
      return <button type="button" key={door.id} aria-label={`${door.label} ${action}${door.open && door.hideWhenOpen ? " · 숨김" : ""}`} aria-pressed={door.open} onClick={() => onToggle(door.index, !door.open, door.side)}>{doors.length === 1 ? `문 ${action}` : `${location} ${action}`}</button>;
    })}
  </div></ViewerOverlaySlot>;
}
