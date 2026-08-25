import { AddIcon, CheckIcon } from "@/components/icons";
import { OBJECT_LIBRARY_DRAG_TYPE } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";

import ObjectPreview from "./ObjectPreview";
import styles from "./ObjectLibrary.module.css";

export default function ObjectItem({ definition, active, onSelect }) {
  function handleDragStart(event) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(OBJECT_LIBRARY_DRAG_TYPE, definition.id);
    event.dataTransfer.setData("text/plain", definition.id);
    onSelect(definition.id);
  }

  return (
    <button
      type="button"
      className={`${styles.item} ${active ? styles.itemActive : ""}`}
      aria-pressed={active}
      draggable
      title={`${definition.name} 배치 · 드래그 또는 클릭`}
      onClick={() => onSelect(definition.id)}
      onDragStart={handleDragStart}
    >
      <ObjectPreview definition={definition} />
      <span className={styles.itemText}>
        <strong>{definition.name}</strong>
      </span>
      <span className={styles.itemAction} aria-hidden="true">
        {active ? <CheckIcon size={15} /> : <AddIcon size={15} />}
      </span>
    </button>
  );
}
