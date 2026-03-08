"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ColorTheme =
  | "green"
  | "blue"
  | "slate"
  | "purple"
  | "mint"
  | "sky"
  | "rose"
  | "lavender"
  | "navy"
  | "teal"
  | "orange"
  | "amber";

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(
  undefined,
);

export function ColorThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("green");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("color-theme") as ColorTheme | null;
    if (stored) setColorThemeState(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-color-theme", colorTheme);
    localStorage.setItem("color-theme", colorTheme);
  }, [colorTheme, mounted]);

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
  };

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context)
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  return context;
}
