import { useState } from "react";

import MaterialAppearanceEditor from "./MaterialAppearanceEditor";
import styles from "./MaterialSlotEditor.module.css";

export default function MaterialSlotEditor({ slots = [], appearances = {}, disabled = false, presetIds, onChange }) {
  const [activeSlotId, setActiveSlotId] = useState(slots[0]?.id ?? null);
  if (!slots.length) return null;
  const activeSlot = slots.find((slot) => slot.id === activeSlotId) ?? slots[0];
  const appearance = { ...activeSlot.defaultAppearance, ...appearances[activeSlot.id] };

  return (
    <div className={styles.editor}>
      <div className={styles.tabs} role="tablist" aria-label="오브젝트 재질 영역">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            role="tab"
            aria-selected={slot.id === activeSlot.id}
            className={slot.id === activeSlot.id ? styles.active : ""}
            onClick={() => setActiveSlotId(slot.id)}
          >
            <span style={{ backgroundColor: appearances[slot.id]?.color ?? slot.defaultAppearance?.color }} aria-hidden="true" />
            {slot.label}
          </button>
        ))}
      </div>
      <MaterialAppearanceEditor
        appearance={appearance}
        disabled={disabled}
        presetIds={presetIds}
        compact
        onChange={(changes) => onChange({ [activeSlot.id]: changes })}
      />
    </div>
  );
}
