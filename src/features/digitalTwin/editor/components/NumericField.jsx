import { useEffect, useRef, useState } from "react";

import styles from "./NumericField.module.css";

function formatValue(value, precision = 4) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? String(Number(numericValue.toFixed(precision)))
    : "";
}

export default function NumericField({
  label,
  value,
  unit,
  step = 0.1,
  min,
  displayPrecision = 4,
  disabled = false,
  onChange,
}) {
  const precision = Math.min(10, Math.max(0, Math.trunc(displayPrecision)));
  const [draftValue, setDraftValue] = useState(() => formatValue(value, precision));
  const isEditingRef = useRef(false);
  const editedRef = useRef(false);
  const externalValueRef = useRef(value);

  useEffect(() => {
    externalValueRef.current = value;
    if (!isEditingRef.current || disabled) {
      setDraftValue(formatValue(value, precision));
    }
  }, [disabled, value, precision]);

  function handleChange(event) {
    const nextDraft = event.target.value;
    editedRef.current = true;
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
    if (!editedRef.current) {
      setDraftValue(formatValue(externalValueRef.current, precision));
      return;
    }
    const parsedValue = Number(draftValue);

    if (draftValue.trim() === "" || !Number.isFinite(parsedValue)) {
      setDraftValue(formatValue(value, precision));
      return;
    }

    const committedValue = min === undefined
      ? parsedValue
      : Math.max(min, parsedValue);
    setDraftValue(formatValue(committedValue, precision));

    if (committedValue !== Number(value)) {
      onChange(committedValue);
    }
    window.requestAnimationFrame(() => {
      if (!isEditingRef.current) setDraftValue(formatValue(externalValueRef.current, precision));
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
          inputMode="decimal"
          title={Number.isFinite(Number(value)) ? `정밀 값: ${Number(value)}${unit ? ` ${unit}` : ""}` : undefined}
          onFocus={() => {
            isEditingRef.current = true;
            editedRef.current = false;
            setDraftValue(Number.isFinite(Number(value)) ? String(Number(value)) : "");
          }}
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
