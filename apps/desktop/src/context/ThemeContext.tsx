import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Theme, defineTheme, type DefinedTheme } from "@astryxdesign/core/theme";
import { y2kTheme } from "../themes/y2k/y2kTheme";
import { readPreference } from "../utils/preferences";

const LOCAL_STORAGE_MODE_KEY = "portside_theme_mode";
const LOCAL_STORAGE_CUSTOM_THEME_KEY = "portside_custom_theme_json";

interface ThemeContextType {
  mode: "dark";
  customThemeJson: string;
  setCustomThemeJson: (jsonString: string) => boolean;
  clearCustomTheme: () => void;
  activeTheme: DefinedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [customThemeJson, setCustomThemeJsonState] = useState<string>(() => {
    return readPreference(localStorage, LOCAL_STORAGE_CUSTOM_THEME_KEY, "_custom_theme_json") || "";
  });

  const setCustomThemeJson = (jsonString: string): boolean => {
    try {
      if (!jsonString.trim()) {
        localStorage.removeItem(LOCAL_STORAGE_CUSTOM_THEME_KEY);
        setCustomThemeJsonState("");
        return true;
      }
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== "object" || parsed === null) return false;
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_THEME_KEY, jsonString);
      setCustomThemeJsonState(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  const clearCustomTheme = () => {
    localStorage.removeItem(LOCAL_STORAGE_CUSTOM_THEME_KEY);
    setCustomThemeJsonState("");
  };

  const activeTheme = useMemo<DefinedTheme>(() => {
    if (!customThemeJson.trim()) return y2kTheme;
    try {
      const parsed = JSON.parse(customThemeJson);
      return defineTheme({
        name: parsed.name || "custom-theme",
        tokens: parsed.tokens || {},
        typography: parsed.typography,
        radius: parsed.radius,
        motion: parsed.motion,
        components: parsed.components,
      });
    } catch {
      return y2kTheme;
    }
  }, [customThemeJson]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    localStorage.setItem(LOCAL_STORAGE_MODE_KEY, "dark");
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode: "dark",
        customThemeJson,
        setCustomThemeJson,
        clearCustomTheme,
        activeTheme,
      }}
    >
      <Theme theme={activeTheme} mode="dark">
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return context;
}
