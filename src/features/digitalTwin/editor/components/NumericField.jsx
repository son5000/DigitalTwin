import { useEffect, useRef, useState } from "react";

import styles from "./NumericField.module.css";

function formatValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? String(Number(numericValue.toFixed(4)))
    : "";
}

export default function NumericField({
  label,
  value,
  unit,
  step = 0.1,
  min,
  disabled = false,
  onChange,
}) {
  const [draftValue, setDraftValue] = useState(() => formatValue(value));
  const isEditingRef = useRef(false);
  const externalValueRef = useRef(value);

  useEffect(() => {
    externalValueRef.current = value;
    if (!isEditingRef.current || disabled) {
      setDraftValue(formatValue(value));
    }
  }, [disabled, value]);

  function handleChange(event) {
    const nextDraft = event.target.value;
    setDraftValue(nextDraft);

    if (nextDraft.trim() === "") {
      return;
    }

    const nextValue = Number(nextDraft);

    if (Number.isFinite(nextValue)) {
      onChange(nextValue);
    }
  }

  function handleBlur() {
    isEditingRef.current = false;
    const parsedValue = Number(draftValue);

    if (draftValue.trim() === "" || !Number.isFinite(parsedValue)) {
      setDraftValue(formatValue(value));
      return;
    }

    const committedValue = min === undefined
      ? parsedValue
      : Math.max(min, parsedValue);
    setDraftValue(formatValue(committedValue));

    if (committedValue !== Number(value)) {
      onChange(committedValue);
    }
    window.requestAnimationFrame(() => {
      setDraftValue(formatValue(externalValueRef.current));
    });
  }

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputShell}>
        <input
          type="number"
          value={draftValue}
          min={min}
          step={step}
          disabled={disabled}
          onFocus={() => { isEditingRef.current = true; }}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </label>
  );
}
