import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { EDITOR_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";

const THEME_STORAGE_KEY = "digital-twin-editor-theme";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? EDITOR_THEMES.DARK
    : EDITOR_THEMES.LIGHT;
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === EDITOR_THEMES.LIGHT || savedTheme === EDITOR_THEMES.DARK) {
    return savedTheme;
  }

  return getSystemTheme();
}

export default function useEditorTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setTheme(getSystemTheme());
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme =
        currentTheme === EDITOR_THEMES.DARK
          ? EDITOR_THEMES.LIGHT
          : EDITOR_THEMES.DARK;
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
}
