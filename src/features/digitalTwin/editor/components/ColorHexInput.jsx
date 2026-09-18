import { useState } from "react";

export default function ColorHexInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(null);
  return <input {...props} type="text" value={draft ?? value.toUpperCase()} maxLength={7}
    onChange={(event) => {
      const next = event.target.value;
      setDraft(next);
      if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next);
    }}
    onBlur={() => setDraft(null)}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} />;
}
