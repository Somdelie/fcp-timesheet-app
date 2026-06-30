"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useColorTheme } from "./color-theme-provider";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const colorThemes = [
  { value: "green" as const, label: "Green", color: "#16a34a", type: "solid" },
  { value: "blue" as const, label: "Blue", color: "#2563eb", type: "solid" },
  { value: "slate" as const, label: "Slate", color: "#334155", type: "solid" },
  {
    value: "purple" as const,
    label: "Purple",
    color: "#7c3aed",
    type: "solid",
  },
  {
    value: "orange" as const,
    label: "Orange",
    color: "#ea580c",
    type: "solid",
  },
  { value: "mint" as const, label: "Mint", color: "#16a34a", type: "light" },
  { value: "sky" as const, label: "Sky", color: "#2563eb", type: "light" },
  { value: "rose" as const, label: "Rose", color: "#e11d48", type: "light" },
  {
    value: "lavender" as const,
    label: "Lavender",
    color: "#7c3aed",
    type: "light",
  },
  { value: "navy" as const, label: "Navy", color: "#1e3a5f", type: "light" },
  { value: "teal" as const, label: "Teal", color: "#0d9488", type: "light" },
  { value: "amber" as const, label: "Amber", color: "#ea580c", type: "light" },
];

export function ModeToggle() {
  const { setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="group relative bg-transparent hover:bg-transparent transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:scale-110 active:translate-y-0 active:scale-95"
        >
          <img
            src="/icons-3d/sun.png"
            alt=""
            className="h-8 w-8 object-contain drop-shadow-sm transition-all duration-300 ease-out group-hover:rotate-[-8deg] dark:scale-0 dark:-rotate-90 dark:opacity-0"
          />
          <img
            src="/icons-3d/moon.png"
            alt=""
            className="absolute h-8 w-8 rotate-90 scale-0 object-contain opacity-0 drop-shadow-sm transition-all duration-300 ease-out group-hover:rotate-[8deg] dark:rotate-0 dark:scale-100 dark:opacity-100"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Mode</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Solid Themes</DropdownMenuLabel>
        {colorThemes
          .filter((t) => t.type === "solid")
          .map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setColorTheme(t.value)}
            >
              <span
                className="mr-2 h-4 w-4 rounded-full inline-block border border-black/10"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
              {colorTheme === t.value && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Light Themes</DropdownMenuLabel>
        {colorThemes
          .filter((t) => t.type === "light")
          .map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setColorTheme(t.value)}
            >
              <span
                className="mr-2 h-4 w-4 rounded-full inline-block border border-black/10"
                style={{
                  background: `linear-gradient(135deg, ${t.color}22, ${t.color}44)`,
                }}
              />
              {t.label}
              {colorTheme === t.value && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
