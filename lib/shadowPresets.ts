/**
 * Shadow presets for the Firstclass Projects design tool.
 *
 * Usage:
 *   import { SHADOW_PRESETS, SHADOW_GROUPS, getShadowById } from "@/lib/shadowPresets";
 *
 *   // apply directly to a canvas element's style
 *   element.style.boxShadow = getShadowById("soft-card")!.value;
 *
 *   // or drive a picker panel
 *   SHADOW_GROUPS.map((group) => ...)
 */

export type ShadowCategoryKey =
  | "soft-elevated"
  | "material"
  | "colored-glow"
  | "neumorphic"
  | "sharp-retro"
  | "rings-focus"
  | "inset-depth"
  | "glass-ambient"
  | "real-world"
  | "3d-buttons"
  | "3d-blocks"
  | "3d-cube"
  | "3d-coins"
  | "3d-pressed";

export interface ShadowPreset {
  /** stable, kebab-case identifier — safe to persist against a user's saved design */
  id: string;
  /** display name shown in the picker UI */
  name: string;
  category: ShadowCategoryKey;
  /** ready-to-use CSS box-shadow value (no `box-shadow:` prefix, no trailing semicolon) */
  value: string;
  /**
   * Neumorphic shadows only work when the element's own background matches the
   * surrounding surface color. Set on presets that require it so the app can
   * auto-apply (or warn about) the right background.
   */
  requiresSurface?: { background: string; label: "light" | "dark" };
}

export interface ShadowCategoryMeta {
  key: ShadowCategoryKey;
  label: string;
}

export const SHADOW_CATEGORIES: ShadowCategoryMeta[] = [
  { key: "soft-elevated", label: "Soft & Elevated" },
  { key: "material", label: "Material Elevation" },
  { key: "colored-glow", label: "Colored Glows" },
  { key: "neumorphic", label: "Neumorphic" },
  { key: "sharp-retro", label: "Sharp & Retro" },
  { key: "rings-focus", label: "Rings & Focus" },
  { key: "inset-depth", label: "Inset & Depth" },
  { key: "glass-ambient", label: "Glass & Ambient" },
  { key: "real-world", label: "Real-World Picks" },
  { key: "3d-buttons", label: "3D Buttons" },
  { key: "3d-blocks", label: "3D Blocks" },
  { key: "3d-cube", label: "3D Cube & Isometric" },
  { key: "3d-coins", label: "3D Coins & Medals" },
  { key: "3d-pressed", label: "3D Pressed & Carved" },
];

export const SHADOW_PRESETS: ShadowPreset[] = [
  // ---- Soft & Elevated -----------------------------------------------------
  { id: "whisper", name: "Whisper", category: "soft-elevated", value: "0 1px 2px rgba(15, 23, 42, 0.06)" },
  { id: "soft-card", name: "Soft Card", category: "soft-elevated", value: "0 2px 8px rgba(15, 23, 42, 0.08)" },
  { id: "gentle-lift", name: "Gentle Lift", category: "soft-elevated", value: "0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.08)" },
  { id: "floating-card", name: "Floating Card", category: "soft-elevated", value: "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.08)" },
  { id: "hovering", name: "Hovering", category: "soft-elevated", value: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)" },
  { id: "hero-panel", name: "Hero Panel", category: "soft-elevated", value: "0 25px 50px -12px rgba(15, 23, 42, 0.25)" },
  { id: "ambient-wide", name: "Ambient Wide", category: "soft-elevated", value: "0 8px 30px rgba(15, 23, 42, 0.12)" },
  { id: "cushioned", name: "Cushioned", category: "soft-elevated", value: "0 1px 3px rgba(15,23,42,0.06), 0 12px 24px rgba(15,23,42,0.08)" },

  // ---- Material Elevation ----------------------------------------------------
  { id: "elevation-1", name: "Elevation 1", category: "material", value: "0 1px 1px rgba(0,0,0,0.11), 0 2px 2px rgba(0,0,0,0.11)" },
  { id: "elevation-2", name: "Elevation 2", category: "material", value: "0 2px 2px rgba(0,0,0,0.1), 0 3px 4px rgba(0,0,0,0.1)" },
  { id: "elevation-3", name: "Elevation 3", category: "material", value: "0 4px 4px rgba(0,0,0,0.1), 0 6px 8px rgba(0,0,0,0.1)" },
  { id: "elevation-4", name: "Elevation 4", category: "material", value: "0 8px 8px rgba(0,0,0,0.1), 0 10px 16px rgba(0,0,0,0.12)" },
  { id: "elevation-5", name: "Elevation 5", category: "material", value: "0 16px 16px rgba(0,0,0,0.1), 0 18px 28px rgba(0,0,0,0.14)" },

  // ---- Colored Glows ----------------------------------------------------------
  { id: "firstclass-green", name: "Firstclass Green", category: "colored-glow", value: "0 8px 24px rgba(22, 163, 74, 0.35)" },
  { id: "violet-bloom", name: "Violet Bloom", category: "colored-glow", value: "0 10px 25px rgba(139, 92, 246, 0.4)" },
  { id: "sky-glow", name: "Sky Glow", category: "colored-glow", value: "0 10px 25px rgba(56, 189, 248, 0.4)" },
  { id: "rose-blush", name: "Rose Blush", category: "colored-glow", value: "0 10px 25px rgba(244, 63, 94, 0.4)" },
  { id: "amber-warmth", name: "Amber Warmth", category: "colored-glow", value: "0 10px 25px rgba(245, 158, 11, 0.4)" },
  { id: "neon-pink", name: "Neon Pink", category: "colored-glow", value: "0 0 20px rgba(236, 72, 153, 0.6), 0 0 40px rgba(236, 72, 153, 0.35)" },
  { id: "neon-cyan", name: "Neon Cyan", category: "colored-glow", value: "0 0 20px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.35)" },
  { id: "duotone-edge", name: "Duotone Edge", category: "colored-glow", value: "-6px 6px 0 rgba(239, 68, 68, 0.5), 6px -6px 0 rgba(59, 130, 246, 0.5)" },

  // ---- Neumorphic ---------------------------------------------------------------
  { id: "neumorph-soft-light", name: "Soft Neumorph (light)", category: "neumorphic", value: "8px 8px 16px #d6dbe1, -8px -8px 16px #ffffff", requiresSurface: { background: "#e8ecf1", label: "light" } },
  { id: "neumorph-pressed-light", name: "Pressed Neumorph (light)", category: "neumorphic", value: "inset 6px 6px 12px #d6dbe1, inset -6px -6px 12px #ffffff", requiresSurface: { background: "#e8ecf1", label: "light" } },
  { id: "neumorph-soft-dark", name: "Soft Neumorph (dark)", category: "neumorphic", value: "8px 8px 16px #14171f, -8px -8px 16px #363e52", requiresSurface: { background: "#252b3a", label: "dark" } },
  { id: "neumorph-pressed-dark", name: "Pressed Neumorph (dark)", category: "neumorphic", value: "inset 6px 6px 12px #14171f, inset -6px -6px 12px #363e52", requiresSurface: { background: "#252b3a", label: "dark" } },

  // ---- Sharp & Retro --------------------------------------------------------------
  { id: "hard-offset", name: "Hard Offset", category: "sharp-retro", value: "4px 4px 0 rgba(15, 23, 42, 1)" },
  { id: "hard-offset-violet", name: "Hard Offset Violet", category: "sharp-retro", value: "5px 5px 0 #7c3aed" },
  { id: "hard-offset-green", name: "Hard Offset Green", category: "sharp-retro", value: "5px 5px 0 #16a34a" },
  { id: "double-stack", name: "Double Stack", category: "sharp-retro", value: "3px 3px 0 #0f172a, 6px 6px 0 #cbd5e1" },
  { id: "long-shadow", name: "Long Shadow", category: "sharp-retro", value: "1px 1px 0 rgba(15,23,42,0.2), 2px 2px 0 rgba(15,23,42,0.18), 3px 3px 0 rgba(15,23,42,0.16), 4px 4px 0 rgba(15,23,42,0.14), 5px 5px 0 rgba(15,23,42,0.12), 6px 6px 0 rgba(15,23,42,0.1)" },

  // ---- Rings & Focus ----------------------------------------------------------------
  { id: "focus-ring", name: "Focus Ring", category: "rings-focus", value: "0 0 0 3px rgba(59, 130, 246, 0.45)" },
  { id: "focus-ring-green", name: "Focus Ring Green", category: "rings-focus", value: "0 0 0 3px rgba(22, 163, 74, 0.4)" },
  { id: "double-ring", name: "Double Ring", category: "rings-focus", value: "0 0 0 2px #ffffff, 0 0 0 4px #0f172a" },
  { id: "outline-card", name: "Outline Card", category: "rings-focus", value: "0 0 0 1px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.08)" },
  { id: "error-ring", name: "Error Ring", category: "rings-focus", value: "0 0 0 3px rgba(239, 68, 68, 0.35)" },

  // ---- Inset & Depth -----------------------------------------------------------------
  { id: "inset-soft", name: "Inset Soft", category: "inset-depth", value: "inset 0 2px 4px rgba(15, 23, 42, 0.08)" },
  { id: "inset-deep", name: "Inset Deep", category: "inset-depth", value: "inset 0 4px 12px rgba(15, 23, 42, 0.25)" },
  { id: "inset-top-light", name: "Inset Top Light", category: "inset-depth", value: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 4px rgba(15,23,42,0.15)" },
  { id: "well", name: "Well", category: "inset-depth", value: "inset 0 2px 6px rgba(15,23,42,0.2), inset 0 -1px 0 rgba(255,255,255,0.4)" },

  // ---- Glass & Ambient -----------------------------------------------------------------
  { id: "frosted-panel", name: "Frosted Panel", category: "glass-ambient", value: "0 8px 32px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.4)" },
  { id: "soft-ambient", name: "Soft Ambient", category: "glass-ambient", value: "0 2px 4px rgba(15,23,42,0.04), 0 12px 24px rgba(15,23,42,0.08), 0 24px 48px rgba(15,23,42,0.06)" },
  { id: "floor-shadow", name: "Floor Shadow", category: "glass-ambient", value: "0 30px 20px -25px rgba(15, 23, 42, 0.3)" },
  { id: "layered-depth", name: "Layered Depth", category: "glass-ambient", value: "0 1px 1px rgba(15,23,42,0.09), 0 2px 2px rgba(15,23,42,0.09), 0 4px 4px rgba(15,23,42,0.09), 0 8px 8px rgba(15,23,42,0.09)" },

  // ---- Real-World Picks -----------------------------------------------------------------
  { id: "dark-ring-lift", name: "Dark Ring + Lift", category: "real-world", value: "rgba(6, 24, 44, 0.4) 0px 0px 0px 2px, rgba(6, 24, 44, 0.65) 0px 4px 6px -1px, rgba(255, 255, 255, 0.08) 0px 1px 0px inset" },
  { id: "paper-shadow", name: "Paper Shadow", category: "real-world", value: "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px" },
  { id: "elevated-panel", name: "Elevated Panel", category: "real-world", value: "rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px" },
  { id: "pressed-button", name: "Pressed Button", category: "real-world", value: "rgba(0, 0, 0, 0.4) 0px 2px 4px, rgba(0, 0, 0, 0.3) 0px 7px 13px -3px, rgba(0, 0, 0, 0.2) 0px -3px 0px inset" },
  { id: "subtle-outline", name: "Subtle Outline", category: "real-world", value: "rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgb(209, 213, 219) 0px 0px 0px 1px inset" },

  // ---- 3D Buttons — chunky raised button using a stacked "side" of the same hue ----
  { id: "btn-3d-green", name: "Green 3D Button", category: "3d-buttons", value: "0 1px 0 #15803d, 0 2px 0 #15803d, 0 3px 0 #15803d, 0 4px 0 #15803d, 0 5px 0 #15803d, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-blue", name: "Blue 3D Button", category: "3d-buttons", value: "0 1px 0 #1d4ed8, 0 2px 0 #1d4ed8, 0 3px 0 #1d4ed8, 0 4px 0 #1d4ed8, 0 5px 0 #1d4ed8, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-red", name: "Red 3D Button", category: "3d-buttons", value: "0 1px 0 #b91c1c, 0 2px 0 #b91c1c, 0 3px 0 #b91c1c, 0 4px 0 #b91c1c, 0 5px 0 #b91c1c, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-purple", name: "Purple 3D Button", category: "3d-buttons", value: "0 1px 0 #6d28d9, 0 2px 0 #6d28d9, 0 3px 0 #6d28d9, 0 4px 0 #6d28d9, 0 5px 0 #6d28d9, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-orange", name: "Orange 3D Button", category: "3d-buttons", value: "0 1px 0 #c2410c, 0 2px 0 #c2410c, 0 3px 0 #c2410c, 0 4px 0 #c2410c, 0 5px 0 #c2410c, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-yellow", name: "Yellow 3D Button", category: "3d-buttons", value: "0 1px 0 #a16207, 0 2px 0 #a16207, 0 3px 0 #a16207, 0 4px 0 #a16207, 0 5px 0 #a16207, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-pink", name: "Pink 3D Button", category: "3d-buttons", value: "0 1px 0 #be185d, 0 2px 0 #be185d, 0 3px 0 #be185d, 0 4px 0 #be185d, 0 5px 0 #be185d, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-teal", name: "Teal 3D Button", category: "3d-buttons", value: "0 1px 0 #0f766e, 0 2px 0 #0f766e, 0 3px 0 #0f766e, 0 4px 0 #0f766e, 0 5px 0 #0f766e, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "btn-3d-slate", name: "Slate 3D Button", category: "3d-buttons", value: "0 1px 0 #1e293b, 0 2px 0 #1e293b, 0 3px 0 #1e293b, 0 4px 0 #1e293b, 0 5px 0 #1e293b, 0 6px 10px rgba(0,0,0,0.45)" },
  { id: "btn-3d-light", name: "Light 3D Button", category: "3d-buttons", value: "0 1px 0 #cbd5e1, 0 2px 0 #cbd5e1, 0 3px 0 #cbd5e1, 0 4px 0 #cbd5e1, 0 4px 8px rgba(15,23,42,0.15)" },

  // ---- 3D Blocks — neubrutalist hard offsets at varying depth ----
  { id: "block-depth-2", name: "Block Depth 2", category: "3d-blocks", value: "2px 2px 0 #0f172a" },
  { id: "block-depth-6", name: "Block Depth 6", category: "3d-blocks", value: "6px 6px 0 #0f172a" },
  { id: "block-depth-8-violet", name: "Block Depth 8 Violet", category: "3d-blocks", value: "8px 8px 0 #7c3aed" },
  { id: "block-depth-10-green", name: "Block Depth 10 Green", category: "3d-blocks", value: "10px 10px 0 #16a34a" },
  { id: "block-depth-12-blue", name: "Block Depth 12 Blue", category: "3d-blocks", value: "12px 12px 0 #2563eb" },
  { id: "block-two-tone", name: "Two-Tone Block", category: "3d-blocks", value: "4px 4px 0 #ffffff, 8px 8px 0 #0f172a" },
  { id: "block-two-tone-rose", name: "Two-Tone Block Rose", category: "3d-blocks", value: "4px 4px 0 #fecdd3, 8px 8px 0 #be123c" },
  { id: "block-two-tone-amber", name: "Two-Tone Block Amber", category: "3d-blocks", value: "4px 4px 0 #fde68a, 8px 8px 0 #b45309" },
  { id: "block-triple-stack", name: "Triple Stack Block", category: "3d-blocks", value: "3px 3px 0 #ffffff, 6px 6px 0 #94a3b8, 9px 9px 0 #0f172a" },
  { id: "block-deep-brutalist", name: "Deep Brutalist", category: "3d-blocks", value: "14px 14px 0 #0f172a, 20px 20px 30px rgba(15,23,42,0.25)" },

  // ---- 3D Cube & Isometric — receding faces / staircase offsets ----
  { id: "iso-staircase", name: "Isometric Staircase", category: "3d-cube", value: "8px 8px 0 rgba(15,23,42,0.15), 16px 16px 0 rgba(15,23,42,0.1), 24px 24px 0 rgba(15,23,42,0.05)" },
  { id: "iso-staircase-violet", name: "Isometric Staircase Violet", category: "3d-cube", value: "8px 8px 0 rgba(124,58,237,0.25), 16px 16px 0 rgba(124,58,237,0.15), 24px 24px 0 rgba(124,58,237,0.08)" },
  { id: "diamond-bevel", name: "Diamond Bevel", category: "3d-cube", value: "-6px -6px 0 #f1f5f9, 6px 6px 0 #0f172a" },
  { id: "diamond-bevel-green", name: "Diamond Bevel Green", category: "3d-cube", value: "-6px -6px 0 #bbf7d0, 6px 6px 0 #14532d" },
  { id: "cube-right-face", name: "Cube Right Face", category: "3d-cube", value: "10px 0 0 #1e293b, 10px 10px 0 #0f172a" },
  { id: "cube-right-face-blue", name: "Cube Right Face Blue", category: "3d-cube", value: "10px 0 0 #1e40af, 10px 10px 0 #172554" },
  { id: "floating-cube", name: "Floating Cube", category: "3d-cube", value: "0 10px 0 0 #ffffff, 0 10px 10px 0 rgba(15,23,42,0.25)" },
  { id: "beveled-panel", name: "Beveled Panel", category: "3d-cube", value: "inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 rgba(15,23,42,0.3), 4px 4px 10px rgba(15,23,42,0.2)" },
  { id: "extruded-tile", name: "Extruded Tile", category: "3d-cube", value: "0 6px 0 #cbd5e1, 0 10px 15px rgba(15,23,42,0.2)" },
  { id: "extruded-tile-dark", name: "Extruded Tile Dark", category: "3d-cube", value: "0 6px 0 #0f172a, 0 10px 20px rgba(0,0,0,0.4)" },

  // ---- 3D Coins & Medals — metallic side-bands like a stamped disc ----
  { id: "coin-gold", name: "Gold Coin", category: "3d-coins", value: "0 2px 0 #b45309, 0 4px 0 #92400e, 0 6px 10px rgba(0,0,0,0.4)" },
  { id: "coin-silver", name: "Silver Coin", category: "3d-coins", value: "0 2px 0 #94a3b8, 0 4px 0 #64748b, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "coin-bronze", name: "Bronze Coin", category: "3d-coins", value: "0 2px 0 #92400e, 0 4px 0 #78350f, 0 6px 10px rgba(0,0,0,0.4)" },
  { id: "coin-rose-gold", name: "Rose Gold Coin", category: "3d-coins", value: "0 2px 0 #8c4a52, 0 4px 0 #6b333a, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "coin-platinum", name: "Platinum Coin", category: "3d-coins", value: "0 2px 0 #cbd5e1, 0 4px 0 #94a3b8, 0 6px 10px rgba(0,0,0,0.3)" },
  { id: "medal-gold-thick", name: "Thick Gold Medal", category: "3d-coins", value: "0 2px 0 #b45309, 0 4px 0 #92400e, 0 6px 0 #78350f, 0 8px 14px rgba(0,0,0,0.4)" },
  { id: "medal-silver-thick", name: "Thick Silver Medal", category: "3d-coins", value: "0 2px 0 #94a3b8, 0 4px 0 #64748b, 0 6px 0 #475569, 0 8px 14px rgba(0,0,0,0.35)" },
  { id: "coin-copper", name: "Copper Puck", category: "3d-coins", value: "0 2px 0 #9a3412, 0 4px 0 #7c2d12, 0 6px 10px rgba(0,0,0,0.4)" },
  { id: "gem-emerald", name: "Emerald Gem", category: "3d-coins", value: "0 2px 0 #047857, 0 4px 0 #065f46, 0 6px 10px rgba(0,0,0,0.35)" },
  { id: "gem-sapphire", name: "Sapphire Gem", category: "3d-coins", value: "0 2px 0 #1d4ed8, 0 4px 0 #1e3a8a, 0 6px 10px rgba(0,0,0,0.35)" },

  // ---- 3D Pressed & Carved — inverse depth, like material cut into a surface ----
  { id: "carved-panel", name: "Carved Panel", category: "3d-pressed", value: "inset 0 2px 0 rgba(0,0,0,0.3), inset 0 4px 0 rgba(0,0,0,0.15), inset 0 -1px 0 rgba(255,255,255,0.4)" },
  { id: "deep-pit", name: "Deep Pit", category: "3d-pressed", value: "inset 0 6px 10px rgba(0,0,0,0.5), inset 0 -2px 0 rgba(255,255,255,0.15)" },
  { id: "carved-green", name: "Carved Green", category: "3d-pressed", value: "inset 0 2px 0 #14532d, inset 0 4px 0 #052e16, inset 0 -1px 0 rgba(255,255,255,0.3)" },
  { id: "carved-blue", name: "Carved Blue", category: "3d-pressed", value: "inset 0 2px 0 #1e3a8a, inset 0 4px 0 #172554, inset 0 -1px 0 rgba(255,255,255,0.3)" },
  { id: "carved-red", name: "Carved Red", category: "3d-pressed", value: "inset 0 2px 0 #7f1d1d, inset 0 4px 0 #450a0a, inset 0 -1px 0 rgba(255,255,255,0.3)" },
  { id: "screen-bezel", name: "Screen Bezel", category: "3d-pressed", value: "inset 0 0 0 6px #0f172a, inset 0 0 20px rgba(0,0,0,0.6)" },
  { id: "groove", name: "Groove", category: "3d-pressed", value: "inset 2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(255,255,255,0.2)" },
  { id: "notch", name: "Notch", category: "3d-pressed", value: "inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.5)" },
  { id: "sunken-gold", name: "Sunken Gold", category: "3d-pressed", value: "inset 0 2px 0 #92400e, inset 0 4px 8px rgba(0,0,0,0.4)" },
  { id: "sunken-slate", name: "Sunken Slate", category: "3d-pressed", value: "inset 0 2px 0 #1e293b, inset 0 4px 8px rgba(0,0,0,0.5)" },
];

export interface ShadowGroup extends ShadowCategoryMeta {
  presets: ShadowPreset[];
}

/** Presets pre-grouped by category, in display order — handy for rendering a picker panel directly. */
export const SHADOW_GROUPS: ShadowGroup[] = SHADOW_CATEGORIES.map((meta) => ({
  ...meta,
  presets: SHADOW_PRESETS.filter((p) => p.category === meta.key),
}));

/** Look up a single preset by its stable id (e.g. what you'd persist on a saved design element). */
export function getShadowById(id: string): ShadowPreset | undefined {
  return SHADOW_PRESETS.find((p) => p.id === id);
}

/** All presets in one category. */
export function getShadowsByCategory(category: ShadowCategoryKey): ShadowPreset[] {
  return SHADOW_PRESETS.filter((p) => p.category === category);
}

/** Build a React inline style object from a preset id — returns {} if the id isn't found. */
export function shadowStyle(id: string): { boxShadow?: string; background?: string } {
  const preset = getShadowById(id);
  if (!preset) return {};
  return {
    boxShadow: preset.value,
    ...(preset.requiresSurface ? { background: preset.requiresSurface.background } : {}),
  };
}

/** Full CSS declaration string, e.g. for exporting a design as static CSS. */
export function toCssDeclaration(id: string): string {
  const preset = getShadowById(id);
  return preset ? `box-shadow: ${preset.value};` : "";
}
