import { useCallback, useState } from "react";

export const EDITOR_PREFERENCES_STORAGE_KEY = "digital-twin-editor-preferences";
export const DEFAULT_EDITOR_PREFERENCES = Object.freeze({ shadowEnabled: true });

export function normalizeEditorPreferences(value) {
  return {
    shadowEnabled: typeof value?.shadowEnabled === "boolean" ? value.shadowEnabled : true,
  };
}

function getInitialPreferences() {
  try {
    return normalizeEditorPreferences(JSON.parse(localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}

export default function useEditorPreferences() {
  const [editorPreferences, setEditorPreferences] = useState(getInitialPreferences);
  const setShadowEnabled = useCallback((shadowEnabled) => {
    setEditorPreferences((current) => {
      const next = normalizeEditorPreferences({ ...current, shadowEnabled });
      localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { editorPreferences, setShadowEnabled };
}
