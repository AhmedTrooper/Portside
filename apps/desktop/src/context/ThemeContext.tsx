import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Theme, defineTheme, type DefinedTheme, type ThemeMode } from "@astryxdesign/core/theme";
import { y2kTheme } from "../themes/y2k/y2kTheme";

const LOCAL_STORAGE_MODE_KEY = "devopseasy_theme_mode";
const LOCAL_STORAGE_CUSTOM_THEME_KEY = "devopseasy_custom_theme_json";

interface ThemeContextType {
  mode: "light" | "dark";
  toggleMode: () => void;
  setMode: (mode: "light" | "dark") => void;
  customThemeJson: string;
  setCustomThemeJson: (jsonString: string) => boolean;
  clearCustomTheme: () => void;
  activeTheme: DefinedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_MODE_KEY);
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  const [customThemeJson, setCustomThemeJsonState] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_CUSTOM_THEME_KEY) || "";
  });

  const toggleMode = () => {
    setModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(LOCAL_STORAGE_MODE_KEY, next);
      return next;
    });
  };

  const setMode = (newMode: "light" | "dark") => {
    setModeState(newMode);
    localStorage.setItem(LOCAL_STORAGE_MODE_KEY, newMode);
  };

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
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        customThemeJson,
        setCustomThemeJson,
        clearCustomTheme,
        activeTheme,
      }}
    >
      <Theme theme={activeTheme} mode={mode as ThemeMode}>
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
