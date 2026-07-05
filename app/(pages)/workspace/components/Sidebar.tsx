"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Crown,
  Download,
  Folder,
  Mic,
  Plus,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { signatureFontCategories, signatureFontOptions } from "@/lib/fonts";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Marker from "./Marker";
import { useEditorStore, type EditorObject } from "../store/editorStore";

function makeCanvasId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<string | null>("tools");

  const sidebarItems = [
    { title: "Templates", icon: "/icons-3d/Brands.png", tab: "templates" },
    { title: "Elements", icon: "/icons-3d/elements.png", tab: "elements" },
    { title: "Text", icon: "/icons-3d/text.png", tab: "text" },
    { title: "Brand", icon: "/icons-3d/brand.png", tab: "brand", badge: true },
    { title: "Canva AI", icon: "/icons-3d/tools.png", tab: "canva-ai" },
    { title: "Uploads", icon: "/icons-3d/uploads.png", tab: "uploads" },
    { title: "Tools", icon: "/icons-3d/tools.png", tab: "tools" },
    { title: "Projects", icon: "/icons-3d/projects.png", tab: "projects" },
  ];

  const handleTabClick = (tab: string) => {
    setActiveTab(tab === activeTab ? null : tab);
  };

  return (
    <aside className="sticky top-0 z-30 self-start h-[calc(100vh-9rem)] w-36 overflow-visible">
      <div className="relative flex h-full items-start">
        <nav className="flex h-full w-[68px] flex-col items-center gap-1 border-r border-slate-200 bg-white py-3 text-slate-600 shadow-[4px_0_18px_rgba(15,23,42,0.06)]">
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.tab;

            return (
              <button
                key={item.tab}
                type="button"
                className={`relative flex h-[60px] w-full flex-col items-center justify-center gap-1 text-[11px] leading-none transition ${
                  isActive ? "font-semibold text-slate-950" : "text-slate-600"
                }`}
                onClick={() => handleTabClick(item.tab)}
              >
                {item.badge ? (
                  <Crown
                    size={11}
                    className="absolute right-3 top-1 text-slate-300"
                    strokeWidth={2}
                  />
                ) : null}
                <span className="flex h-8 w-8 items-center justify-center">
                  <Image
                    src={item.icon}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <span className="max-w-[62px] truncate px-1">{item.title}</span>
              </button>
            );
          })}
        </nav>

        {activeTab === "tools" ? (
          <ToolsToolbar onClose={() => setActiveTab(null)} />
        ) : null}

        {activeTab === "elements" ? (
          <ElementsPanel onClose={() => setActiveTab(null)} />
        ) : null}
      </div>
    </aside>
  );
}

const elementTabs = ["All", "Graphics", "Photos", "Frames", "Lines"] as const;

const graphicElements = [
  { name: "Pointer", src: "/icons-3d/pointer.png" },
  { name: "Pencil", src: "/icons-3d/pencil.png" },
  { name: "Shapes", src: "/icons-3d/shapes.png" },
  { name: "Line", src: "/icons-3d/line.png" },
  { name: "Sticky note", src: "/icons-3d/notes.png" },
  { name: "Signature", src: "/icons-3d/sgnage.png" },
  { name: "Table", src: "/icons-3d/tables.png" },
  { name: "Upload", src: "/icons-3d/uploads.png" },
];

const photoElements = [
  { name: "Elements", src: "/icons-3d/elements.png" },
  { name: "Brand", src: "/icons-3d/brand.png" },
  { name: "Tools", src: "/icons-3d/tools.png" },
  { name: "Projects", src: "/icons-3d/projects.png" },
  { name: "Dashboard", src: "/icons-3d/Dashboard.png" },
];

const frameElements = [
  "rounded-square",
  "rectangle",
  "circle",
  "oval",
  "speech-bubble",
  "shield",
] as const;

type GraphicsCategory = "shapes" | "lines" | "graphics" | "frames";
type BuiltInGraphic = {
  id: string;
  label: string;
  category: GraphicsCategory;
  color: string;
  tags: string[];
  path: (color: string) => ReactNode;
};

const G = (
  id: string,
  label: string,
  category: GraphicsCategory,
  color: string,
  tags: string[],
  path: (color: string) => ReactNode,
): BuiltInGraphic => ({ id, label, category, color, tags, path });

const GRAPHICS_PACK = [
  G("sq", "Square", "shapes", "#0ea5e9", ["square", "shape"], (color) => (
    <rect x="10" y="10" width="28" height="28" rx="2" fill={color} />
  )),
  G(
    "rsq",
    "Rounded square",
    "shapes",
    "#0ea5e9",
    ["square", "rounded", "shape"],
    (color) => (
      <rect x="10" y="10" width="28" height="28" rx="9" fill={color} />
    ),
  ),
  G(
    "rect",
    "Rectangle",
    "shapes",
    "#0ea5e9",
    ["rectangle", "shape"],
    (color) => <rect x="6" y="14" width="36" height="20" rx="2" fill={color} />,
  ),
  G(
    "circle",
    "Circle",
    "shapes",
    "#f97316",
    ["circle", "round", "shape"],
    (color) => <circle cx="24" cy="24" r="16" fill={color} />,
  ),
  G(
    "oval",
    "Oval",
    "shapes",
    "#f97316",
    ["oval", "ellipse", "shape"],
    (color) => <ellipse cx="24" cy="24" rx="18" ry="12" fill={color} />,
  ),
  G(
    "triangle",
    "Triangle",
    "shapes",
    "#a855f7",
    ["triangle", "shape"],
    (color) => <path d="M24 8 L40 38 L8 38 Z" fill={color} />,
  ),
  G(
    "diamond",
    "Diamond",
    "shapes",
    "#a855f7",
    ["diamond", "rhombus", "shape"],
    (color) => <path d="M24 6 L42 24 L24 42 L6 24 Z" fill={color} />,
  ),
  G(
    "pentagon",
    "Pentagon",
    "shapes",
    "#22c55e",
    ["pentagon", "shape"],
    (color) => <path d="M24 6 L42 19 L35 40 L13 40 L6 19 Z" fill={color} />,
  ),
  G(
    "hexagon",
    "Hexagon",
    "shapes",
    "#22c55e",
    ["hexagon", "shape"],
    (color) => (
      <path d="M15 8 L33 8 L42 24 L33 40 L15 40 L6 24 Z" fill={color} />
    ),
  ),
  G(
    "star4",
    "Four-point star",
    "shapes",
    "#eab308",
    ["star", "shape", "sparkle"],
    (color) => (
      <path
        d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z"
        fill={color}
      />
    ),
  ),
  G(
    "line-solid",
    "Straight line",
    "lines",
    "#475569",
    ["line", "straight"],
    (color) => (
      <line
        x1="6"
        y1="24"
        x2="42"
        y2="24"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    ),
  ),
  G(
    "line-dashed",
    "Dashed line",
    "lines",
    "#475569",
    ["line", "dashed"],
    (color) => (
      <line
        x1="6"
        y1="24"
        x2="42"
        y2="24"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 5"
      />
    ),
  ),
  G(
    "line-dotted",
    "Dotted line",
    "lines",
    "#475569",
    ["line", "dotted"],
    (color) => (
      <line
        x1="6"
        y1="24"
        x2="42"
        y2="24"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0.5 6"
      />
    ),
  ),
  G(
    "line-wavy",
    "Wavy line",
    "lines",
    "#475569",
    ["line", "wave", "squiggle"],
    (color) => (
      <path
        d="M4 24 Q12 14 20 24 T36 24 T44 24"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    ),
  ),
  G(
    "line-arrow",
    "Arrow",
    "lines",
    "#475569",
    ["arrow", "line", "pointer"],
    (color) => (
      <g
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <line x1="6" y1="24" x2="38" y2="24" />
        <path d="M29 15 L38 24 L29 33" />
      </g>
    ),
  ),
  G(
    "line-double-arrow",
    "Double arrow",
    "lines",
    "#475569",
    ["arrow", "line"],
    (color) => (
      <g
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <line x1="10" y1="24" x2="38" y2="24" />
        <path d="M17 16 L9 24 L17 32" />
        <path d="M31 16 L39 24 L31 32" />
      </g>
    ),
  ),
  G(
    "line-curved-arrow",
    "Curved arrow",
    "lines",
    "#475569",
    ["arrow", "curved", "line"],
    (color) => (
      <g
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M8 30 Q24 6 40 20" />
        <path d="M31 15 L40 20 L37 30" />
      </g>
    ),
  ),
  G(
    "divider",
    "Divider",
    "lines",
    "#475569",
    ["divider", "line", "rule"],
    (color) => (
      <g stroke={color} strokeWidth="2.5" strokeLinecap="round">
        <line x1="4" y1="24" x2="16" y2="24" />
        <circle cx="24" cy="24" r="2.5" fill={color} stroke="none" />
        <line x1="32" y1="24" x2="44" y2="24" />
      </g>
    ),
  ),
  G("heart", "Heart", "graphics", "#f43f5e", ["heart", "love"], (color) => (
    <path
      d="M24 40 C10 30 4 22 4 15 C4 8 10 4 15 6 C19 7.5 22 11 24 14 C26 11 29 7.5 33 6 C38 4 44 8 44 15 C44 22 38 30 24 40 Z"
      fill={color}
    />
  )),
  G(
    "star5",
    "Star",
    "graphics",
    "#eab308",
    ["star", "sparkle", "favorite"],
    (color) => (
      <path
        d="M24 4 L29.5 18 L44 19 L32.5 28.5 L36.5 43 L24 34.5 L11.5 43 L15.5 28.5 L4 19 L18.5 18 Z"
        fill={color}
      />
    ),
  ),
  G(
    "sparkle",
    "Sparkle",
    "graphics",
    "#f59e0b",
    ["sparkle", "shine", "star"],
    (color) => (
      <path
        d="M24 4 C25 14 26 18 38 20 C26 22 25 26 24 36 C23 26 22 22 10 20 C22 18 23 14 24 4 Z"
        fill={color}
      />
    ),
  ),
  G("cloud", "Cloud", "graphics", "#38bdf8", ["cloud", "weather"], (color) => (
    <path
      d="M14 32 C8 32 4 28 4 23 C4 18 8 15 12 15.5 C13 10 18 6 24 6 C30 6 35 10.5 35.5 16 C40.5 16.5 44 20.5 44 25 C44 29 40 32 36 32 Z"
      fill={color}
    />
  )),
  G(
    "lightning",
    "Lightning bolt",
    "graphics",
    "#eab308",
    ["lightning", "bolt", "energy"],
    (color) => (
      <path d="M27 4 L11 26 L21 26 L18 44 L38 20 L27 20 Z" fill={color} />
    ),
  ),
  G(
    "pin",
    "Location pin",
    "graphics",
    "#ef4444",
    ["pin", "location", "map"],
    (color) => (
      <path
        d="M24 4 C16 4 10 10 10 18 C10 28 24 44 24 44 C24 44 38 28 38 18 C38 10 32 4 24 4 Z M24 24 a6 6 0 1 1 0-12 6 6 0 0 1 0 12 Z"
        fill={color}
        fillRule="evenodd"
      />
    ),
  ),
  G(
    "frame-square",
    "Square frame",
    "frames",
    "#334155",
    ["frame", "square"],
    (color) => (
      <rect
        x="8"
        y="8"
        width="32"
        height="32"
        rx="2"
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
    ),
  ),
  G(
    "frame-circle",
    "Circle frame",
    "frames",
    "#334155",
    ["frame", "circle"],
    (color) => (
      <circle
        cx="24"
        cy="24"
        r="16"
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
    ),
  ),
  G(
    "frame-arch",
    "Arch frame",
    "frames",
    "#334155",
    ["frame", "arch"],
    (color) => (
      <path
        d="M10 40 V22 C10 12 16 6 24 6 C32 6 38 12 38 22 V40"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    ),
  ),
  G(
    "frame-polaroid",
    "Polaroid frame",
    "frames",
    "#334155",
    ["frame", "polaroid", "photo"],
    (color) => (
      <g fill="none" stroke={color} strokeWidth="3">
        <rect x="8" y="6" width="32" height="28" rx="1" />
        <line x1="8" y1="38" x2="40" y2="38" strokeWidth="6" />
      </g>
    ),
  ),
];

const elementCategoryMeta: Record<
  GraphicsCategory,
  { label: string; from: string; to: string }
> = {
  shapes: { label: "Shapes", from: "#2dd4bf", to: "#0d9488" },
  lines: { label: "Lines", from: "#94a3b8", to: "#475569" },
  graphics: { label: "Graphics", from: "#fb923c", to: "#ef4444" },
  frames: { label: "Frames", from: "#a3e635", to: "#65a30d" },
};

function ElementsPanel({ onClose }: { onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const popularSearches = ["Square", "Rectangle", "Line"];
  const visibleGraphics = GRAPHICS_PACK.filter((asset) => {
    if (!normalizedSearch) return true;

    const categoryLabel =
      elementCategoryMeta[asset.category].label.toLowerCase();

    return (
      asset.label.toLowerCase().includes(normalizedSearch) ||
      categoryLabel.includes(normalizedSearch) ||
      asset.tags.some((tag) => tag.includes(normalizedSearch))
    );
  });
  const recentlyUsed = GRAPHICS_PACK.filter((asset) =>
    ["line-solid", "sq", "circle"].includes(asset.id),
  );
  const recommendedItems = visibleGraphics.length
    ? visibleGraphics.slice(0, 10)
    : GRAPHICS_PACK.slice(0, 10);
  const browseCategories = (
    Object.entries(elementCategoryMeta) as Array<
      [GraphicsCategory, (typeof elementCategoryMeta)[GraphicsCategory]]
    >
  ).map(([category, meta]) => ({
    category,
    ...meta,
    preview: GRAPHICS_PACK.find((asset) => asset.category === category),
  }));

  return (
    <motion.div
      initial={false}
      animate={{ x: 10, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-[68px] top-0 z-40 flex h-[calc(100vh-9rem)] w-[280px] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[8px_0_24px_rgba(15,23,42,0.08)]"
    >
      <div className="space-y-3 border-b border-slate-100 p-3">
        <div className="flex h-11 items-center gap-2 rounded border border-violet-200 bg-white px-3 shadow-[0_8px_20px_rgba(124,58,237,0.08)]">
          <Plus size={18} strokeWidth={2.1} className="text-slate-950" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Describe your ideal element"
            aria-label="Search elements"
          />
          <button
            type="button"
            className="group relative flex h-7 w-7 items-center justify-center rounded transition hover:bg-slate-100"
            aria-label="Voice search"
          >
            <Mic size={16} strokeWidth={2.2} />
            <TooltipLabel label="Voice search" side="top" />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
          <button
            type="button"
            className="flex h-10 items-center justify-center gap-2 rounded border border-slate-200 bg-white text-xs font-bold text-slate-950 transition hover:bg-slate-50"
          >
            <Image
              src="/icons-3d/elements.png"
              alt=""
              width={22}
              height={22}
              className="h-5 w-5 object-contain"
            />
            Generate
          </button>
          <button
            type="button"
            className="flex h-10 w-9 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label="Generate options"
          >
            <ChevronDown size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="h-10 rounded bg-primary px-4 text-sm font-bold text-white shadow-[0_10px_20px_rgba(124,58,237,0.2)] transition hover:bg-primary/90"
          >
            Search
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-color:rgba(100,116,139,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60">
        <ElementGraphicShelf title="Recently used" items={recentlyUsed} />
        <ElementGraphicShelf
          title="Recommended for you"
          items={recommendedItems}
        />

        <section className="mb-6">
          <h3 className="mb-3 text-sm font-bold text-slate-800">
            Popular searches
          </h3>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popularSearches.map((term) => (
              <button
                key={term}
                type="button"
                className="h-8 shrink-0 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setSearchTerm(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-3 text-sm font-bold text-slate-800">
            Browse categories
          </h3>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            {browseCategories.map((category) => (
              <button
                key={category.label}
                type="button"
                className="group flex min-w-0 flex-col items-center gap-1 text-center"
                onClick={() => setSearchTerm(category.label)}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded shadow-[0_6px_12px_rgba(15,23,42,0.12)] transition group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${category.from}, ${category.to})`,
                  }}
                >
                  {category.preview ? (
                    <GraphicPreview
                      asset={category.preview}
                      color="#ffffff"
                      className="h-8 w-8 drop-shadow-[0_2px_2px_rgba(15,23,42,0.22)]"
                    />
                  ) : null}
                </span>
                <span className="max-w-[72px] truncate text-[11px] text-slate-700">
                  {category.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function ElementGraphicShelf({
  title,
  items,
}: {
  title: string;
  items: BuiltInGraphic[];
}) {
  const addObjectAtCenter = useEditorStore((state) => state.addObjectAtCenter);

  if (items.length === 0) return null;

  const handleElementClick = (item: BuiltInGraphic) => {
    const newObject = createObjectFromGraphic(item);
    addObjectAtCenter(newObject);
  };

  const createObjectFromGraphic = (graphic: BuiltInGraphic): EditorObject => {
    const id = makeCanvasId(graphic.id);

    // Create appropriate shape based on graphic
    if (
      graphic.category === "shapes" ||
      graphic.category === "frames" ||
      graphic.category === "graphics"
    ) {
      // For circles
      if (graphic.id === "circle" || graphic.id === "frame-circle") {
        return {
          id,
          kind: "circle",
          x: 0,
          y: 0,
          width: 80,
          height: 80,
          fill: graphic.color,
          stroke: graphic.color,
          strokeWidth: 2,
          opacity: 1,
        };
      }
      // For ovals and other ellipses
      if (graphic.id === "oval") {
        return {
          id,
          kind: "circle",
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          fill: graphic.color,
          stroke: graphic.color,
          strokeWidth: 2,
          opacity: 1,
        };
      }
      // Default to rectangle for most shapes
      return {
        id,
        kind: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: graphic.color,
        stroke: graphic.color,
        strokeWidth: 2,
        cornerRadius:
          graphic.id === "rsq" || graphic.id === "frame-square" ? 8 : 0,
        opacity: 1,
      };
    }

    // Lines
    if (graphic.category === "lines") {
      return {
        id,
        kind: "line",
        x: 0,
        y: 0,
        points: [0, 0, 150, 0],
        stroke: graphic.color,
        strokeWidth: 3,
        opacity: 1,
      };
    }

    // Default fallback
    return {
      id,
      kind: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: graphic.color,
      stroke: graphic.color,
      strokeWidth: 2,
      opacity: 1,
    };
  };

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-950"
        >
          See all
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={`${title}-${item.id}`}
            type="button"
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-slate-50 transition hover:bg-slate-100"
            aria-label={item.label}
            onClick={() => handleElementClick(item)}
          >
            <GraphicPreview asset={item} className="h-12 w-12" />
            <TooltipLabel label={item.label} side="top" />
          </button>
        ))}
      </div>
    </section>
  );
}

function GraphicPreview({
  asset,
  className = "h-12 w-12",
  color = asset.color,
}: {
  asset: BuiltInGraphic;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {asset.path(color)}
    </svg>
  );
}

function ElementPrimitiveShelf({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; kind: "line" | "square" | "circle" }>;
}) {
  const addObject = useEditorStore((state) => state.addObject);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);

  const handleElementClick = (item: {
    name: string;
    kind: "line" | "square" | "circle";
  }) => {
    const id = `${item.kind}-${Date.now()}`;
    const containerWidth = 1024;
    const containerHeight = 600;
    const x = (containerWidth / 2 - pan.x) / zoom;
    const y = (containerHeight / 2 - pan.y) / zoom;

    let newObject: EditorObject;

    if (item.kind === "circle") {
      newObject = {
        id,
        kind: "circle",
        x,
        y,
        width: 80,
        height: 80,
        fill: "#64748b",
        stroke: "#64748b",
        strokeWidth: 2,
        opacity: 1,
      };
    } else if (item.kind === "square") {
      newObject = {
        id,
        kind: "rect",
        x,
        y,
        width: 100,
        height: 100,
        fill: "#64748b",
        stroke: "#64748b",
        strokeWidth: 2,
        opacity: 1,
      };
    } else {
      // line
      newObject = {
        id,
        kind: "line",
        x,
        y,
        points: [0, 0, 150, 0],
        stroke: "#64748b",
        strokeWidth: 3,
        opacity: 1,
      };
    }

    addObject(newObject);
  };

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-950"
        >
          See all
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={item.name}
            type="button"
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-slate-50 transition hover:bg-slate-100"
            aria-label={item.name}
            onClick={() => handleElementClick(item)}
          >
            {item.kind === "line" ? (
              <span className="h-0.5 w-14 rounded-full bg-slate-900" />
            ) : null}
            {item.kind === "square" ? (
              <span className="h-14 w-14 bg-slate-800" />
            ) : null}
            {item.kind === "circle" ? (
              <span className="h-14 w-14 rounded-full bg-slate-800" />
            ) : null}
            <TooltipLabel label={item.name} side="top" />
          </button>
        ))}
      </div>
    </section>
  );
}

function ElementShelf({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; src: string }>;
}) {
  const addObject = useEditorStore((state) => state.addObject);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);

  if (items.length === 0) return null;

  const handleElementClick = (item: { name: string; src: string }) => {
    const id = `element-${item.name}-${Date.now()}`;
    const containerWidth = 1024;
    const containerHeight = 600;
    const x = (containerWidth / 2 - pan.x) / zoom;
    const y = (containerHeight / 2 - pan.y) / zoom;

    const newObject: EditorObject = {
      id,
      kind: "rect",
      x,
      y,
      width: 120,
      height: 120,
      fill: "#94a3b8",
      stroke: "#64748b",
      strokeWidth: 2,
      opacity: 1,
    };

    addObject(newObject);
  };

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <button
          type="button"
          className="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          See all
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={`${title}-${item.name}`}
            type="button"
            className="group relative flex h-24 w-24 shrink-0 items-center justify-center rounded bg-slate-50 transition hover:bg-slate-100"
            aria-label={item.name}
            onClick={() => handleElementClick(item)}
          >
            <Image
              src={item.src}
              alt=""
              width={72}
              height={72}
              className="max-h-20 max-w-20 object-contain"
            />
            <TooltipLabel label={item.name} side="top" />
          </button>
        ))}
      </div>
    </section>
  );
}

type ElementAddMenuItem = {
  label: string;
  icon: LucideIcon;
  chevron?: boolean;
  separated?: boolean;
  badge?: string;
  premium?: boolean;
};

const elementAddMenuItems: ElementAddMenuItem[] = [
  { label: "Upload", icon: Upload },
  { label: "Add from Canva", icon: Folder, chevron: true },
  { label: "Import", icon: Download, chevron: true, separated: true },
  { label: "Styles", icon: Palette, badge: "New", separated: true },
  {
    label: "AI quality (Premium)",
    icon: Sparkles,
    badge: "New",
    premium: true,
    chevron: true,
  },
];

function ElementsAddMenu() {
  return (
    <motion.div
      initial={{ y: -6, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="absolute left-4 right-[-6px] top-[calc(100%-4px)] z-50 overflow-hidden rounded border border-slate-200 bg-white py-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
    >
      {elementAddMenuItems.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            type="button"
            className={`flex h-12 w-full items-center gap-3 px-5 text-left text-base text-slate-800 transition hover:bg-slate-50 ${
              item.separated ? "border-t border-slate-100" : ""
            }`}
          >
            <Icon size={21} strokeWidth={2.1} className="text-slate-950" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                {item.premium ? "New" : item.badge}
              </span>
            ) : null}
            {item.chevron ? (
              <ChevronDown
                size={18}
                strokeWidth={2.2}
                className="-rotate-90 text-slate-950"
              />
            ) : null}
          </button>
        );
      })}
    </motion.div>
  );
}

function ToolsToolbar({ onClose }: { onClose: () => void }) {
  const [activeTool, setActiveTool] = useState<string | null>("Selection");
  const setEditorTool = useEditorStore((state) => state.setTool);

  const toolbarItems = [
    {
      icon: "/icons-3d/pointer.png",
      label: "Selection",
    },
    { icon: "/icons-3d/pencil.png", label: "Brush" },
    { icon: "/icons-3d/shapes.png", label: "Shape" },
    { icon: "/icons-3d/line.png", label: "Line" },
    { icon: "/icons-3d/notes.png", label: "Sticky" },
    { icon: "/icons-3d/title.png", label: "Text" },
    { icon: "/icons-3d/sgnage.png", label: "Signature" },
    { icon: "/icons-3d/tables.png", label: "Table" },
  ];

  const handleToolClick = (label: string) => {
    setActiveTool(label);

    // Map tool names to editor store tool names
    if (label === "Selection") {
      setEditorTool("select");
    } else if (label === "Brush") {
      setEditorTool("draw");
    } else if (label === "Text") {
      setEditorTool("text");
    } else if (label === "Shape") {
      setEditorTool("shape");
    } else if (label === "Line") {
      setEditorTool("line");
    }
  };

  return (
    <div className="relative ml-3 flex items-start overflow-visible pt-9">
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="group relative mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Close tools"
        >
          <X size={18} strokeWidth={2} />
          <TooltipLabel label="Close" />
        </button>

        <div className="flex w-14 flex-col items-center gap-3 rounded border border-slate-200 bg-white px-2 py-4 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset]">
          {toolbarItems.map((item) => {
            const isActive = activeTool === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={`group relative flex h-9 w-9 items-center justify-center rounded transition hover:bg-slate-100 ${
                  isActive && item.label === "Selection"
                    ? "ring-1 ring-violet-200"
                    : isActive && item.label === "Brush"
                      ? "ring-1 ring-rose-200"
                      : isActive
                        ? "ring-1 ring-slate-200"
                        : ""
                }`}
                aria-label={item.label}
                onClick={() => handleToolClick(item.label)}
              >
                <Image
                  src={item.icon}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
                <TooltipLabel label={item.label} />
              </button>
            );
          })}
        </div>
      </div>

      <PencilToolMenu open={activeTool === "Brush"} />
      <ShapeToolMenu open={activeTool === "Shape"} />
      <LineToolMenu open={activeTool === "Line"} />
      <StickyNoteMenu open={activeTool === "Sticky"} />
      <SignatureToolMenu
        open={activeTool === "Signature"}
        onClose={() => setActiveTool("Selection")}
      />
    </div>
  );
}

const shapeAssets = [
  "arch",
  "arrow-double",
  "arrow-down-left",
  "arrow-down",
  "arrow-left",
  "arrow-right",
  "arrow-up-right",
  "arrow-up",
  "asterisk",
  "banner",
  "blob",
  "bowtie",
  "chevron",
  "circle",
  "cloud",
  "cone",
  "crescent",
  "cross",
  "cube",
  "curved-arrow",
  "cylinder",
  "dart",
  "decagon",
  "diamond",
  "dodecagon",
  "egg",
  "flag",
  "flower",
  "gear",
  "gem",
  "heart",
  "hemisphere",
  "hendecagon",
  "heptagon",
  "hexagon",
  "hexagonal-prism",
  "hourglass",
  "house",
  "infinity",
  "kite",
  "leaf",
  "lens",
  "lightning-bolt",
  "location-pin",
  "maltese-cross",
  "moon",
  "nonagon",
  "obtuse-triangle",
  "octagon",
  "octahedron",
  "oval",
  "parallelogram",
  "pentagon",
  "petal",
  "plus-circle",
  "puzzle-piece",
  "pyramid",
  "quarter-circle",
  "quatrefoil",
  "rectangle",
  "rectangular-prism",
  "refresh-arrow",
  "ribbon",
  "right-trapezoid",
  "right-triangle",
  "ring",
  "rounded-square",
  "scalene-triangle",
  "semicircle",
  "shield",
  "speech-bubble",
  "sphere",
  "spiral",
  "square",
  "star-10-point",
  "star-4-point",
  "star-6-point",
  "star-7-point",
  "star-8-point",
  "star-9-point",
  "star",
  "starburst",
  "sun",
  "target",
  "teardrop",
  "tetrahedron",
  "torus",
  "trapezoid",
  "trefoil",
  "triangle",
  "triangular-prism",
  "wave",
  "yin-yang",
  "zigzag",
] as const;

const lineAssets = [
  "angle-line",
  "arc-line-down",
  "arc-line",
  "arrow-line-diagonal",
  "arrow-line-double",
  "arrow-line-left",
  "arrow-line-right",
  "arrow-line-up",
  "bracket-curly",
  "bracket-curve",
  "bracket-round",
  "bracket-square",
  "chevron-lines",
  "converging-lines",
  "cross-lines",
  "curved-line",
  "dash-dot-line",
  "dashed-line",
  "diagonal-cross",
  "diagonal-line-reverse",
  "diagonal-line",
  "divider-diamond-center",
  "divider-dot-center",
  "dotted-line",
  "double-line",
  "infinity-line",
  "long-dash-line",
  "loop-line",
  "measuring-line",
  "parallel-diagonal",
  "parallel-lines",
  "railroad-line",
  "s-curve",
  "solid-line",
  "spiral-line",
  "stepped-line",
  "tapered-line",
  "thick-line",
  "thin-line",
  "triple-line",
  "underline-swash",
  "vertical-line",
  "wave-line",
  "zigzag-line",
  "zigzag-sharp",
] as const;

function shapeLabel(shape: string) {
  return shape
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function TooltipLabel({
  label,
  side = "right",
}: {
  label: string;
  side?: "right" | "top";
}) {
  const position =
    side === "top"
      ? "bottom-full left-1/2 mb-1 -translate-x-1/2 translate-y-1 group-hover:translate-y-0"
      : "left-full top-1/2 ml-2 -translate-y-1/2 -translate-x-1 group-hover:translate-x-0";

  return (
    <span
      className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium leading-none text-slate-700 opacity-0 shadow-[0_8px_18px_rgba(15,23,42,0.16)] transition duration-150 group-hover:opacity-100 ${position}`}
    >
      {label}
    </span>
  );
}

function ShapeToolMenu({ open }: { open: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const addObjectAtCenter = useEditorStore((state) => state.addObjectAtCenter);
  const filteredShapes = shapeAssets.filter((shape) =>
    shapeLabel(shape).toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const handleShapeClick = (shape: (typeof shapeAssets)[number]) => {
    addObjectAtCenter({
      id: makeCanvasId(shape),
      kind: "image",
      src: `/shapes/${shape}.svg`,
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      fill: "#facc15",
      stroke: "#0f172a",
      strokeWidth: 1.5,
      opacity: 1,
    });
  };

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-12 z-40 flex h-[408px] w-36 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-l-[22px] border border-slate-200 bg-white px-3 py-4 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset] [scrollbar-color:rgba(100,116,139,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500/70"
    >
      <input
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search"
        className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
        aria-label="Search shapes"
      />

      <div className="grid grid-cols-3 gap-2">
        {filteredShapes.map((shape) => (
          <button
            key={shape}
            type="button"
            className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded transition hover:bg-slate-100"
            aria-label={shapeLabel(shape)}
            onClick={() => handleShapeClick(shape)}
          >
            <ShapePreview shape={shape} />
            <TooltipLabel label={shapeLabel(shape)} side="top" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ShapePreview({ shape }: { shape: string }) {
  return (
    <Image
      src={`/shapes/${shape}.svg`}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 object-contain"
    />
  );
}

function LineToolMenu({ open }: { open: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const addObjectAtCenter = useEditorStore((state) => state.addObjectAtCenter);
  const filteredLines = lineAssets.filter((line) =>
    shapeLabel(line).toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const handleLineClick = (line: (typeof lineAssets)[number]) => {
    addObjectAtCenter({
      id: makeCanvasId(line),
      kind: "image",
      src: `/lines-pack/${line}.svg`,
      x: 0,
      y: 0,
      width: 180,
      height: 64,
      fill: "#0f172a",
      stroke: "#0f172a",
      strokeWidth: 1.5,
      opacity: 1,
    });
  };

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-[192px] z-40 flex h-[360px] w-36 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-l-[22px] border border-slate-200 bg-white px-3 py-4 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset] [scrollbar-color:rgba(100,116,139,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500/70"
    >
      <input
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search"
        className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
        aria-label="Search lines"
      />

      <div className="grid grid-cols-2 gap-2">
        {filteredLines.map((line) => (
          <button
            key={line}
            type="button"
            className="group relative flex h-9 w-full shrink-0 items-center justify-center rounded transition hover:bg-slate-100"
            aria-label={shapeLabel(line)}
            onClick={() => handleLineClick(line)}
          >
            <LinePreview line={line} />
            <TooltipLabel label={shapeLabel(line)} side="top" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function LinePreview({ line }: { line: string }) {
  return (
    <Image
      src={`/lines-pack/${line}.svg`}
      alt=""
      width={42}
      height={24}
      className="h-6 w-11 object-contain"
    />
  );
}

const stickyNoteColors = [
  { label: "Yellow note", color: "#FFC400", fold: "#FF8A00" },
  { label: "Orange note", color: "#FFB85C", fold: "#F97316" },
  { label: "Pink note", color: "#FF6383", fold: "#E11D48" },
  { label: "Blue note", color: "#61B6FF", fold: "#2563EB" },
  { label: "Green note", color: "#46D47D", fold: "#16A34A" },
  { label: "Purple note", color: "#A970FF", fold: "#7C3AED" },
] as const;

function StickyNoteMenu({ open }: { open: boolean }) {
  const [selectedNote, setSelectedNote] = useState("Yellow note");
  const addObjectAtCenter = useEditorStore((state) => state.addObjectAtCenter);

  const handleNoteClick = (note: (typeof stickyNoteColors)[number]) => {
    setSelectedNote(note.label);
    addObjectAtCenter({
      id: makeCanvasId("note"),
      kind: "rect",
      x: 0,
      y: 0,
      width: 150,
      height: 120,
      fill: note.color,
      stroke: note.fold,
      strokeWidth: 2,
      cornerRadius: 10,
      opacity: 1,
    });
  };

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-[264px] z-40 flex w-16 flex-col items-center gap-4 rounded border border-slate-200 bg-white px-2 py-4 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset]"
    >
      <span className="absolute -left-[8px] top-[24px] h-4 w-4 rotate-45 border-b border-l border-slate-200 bg-white" />

      {stickyNoteColors.map((note) => {
        const isSelected = selectedNote === note.label;

        return (
          <button
            key={note.label}
            type="button"
            className={`group relative flex h-9 w-9 items-center justify-center rounded transition hover:bg-slate-100 ${
              isSelected ? "bg-slate-100 ring-1 ring-slate-200" : ""
            }`}
            aria-label={note.label}
            aria-pressed={isSelected}
            onClick={() => handleNoteClick(note)}
          >
            <StickyNotePreview color={note.color} fold={note.fold} />
            <TooltipLabel label={note.label} />
          </button>
        );
      })}
    </motion.div>
  );
}

function StickyNotePreview({ color, fold }: { color: string; fold: string }) {
  return (
    <span
      className="relative block h-6 w-6 rounded-md border border-black/5 shadow-[0_2px_2px_rgba(15,23,42,0.18),inset_1px_1px_0_rgba(255,255,255,0.48),inset_-1px_-1px_0_rgba(15,23,42,0.08)]"
      style={{ backgroundColor: color }}
    >
      <span
        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-br-md rounded-tl-md border-l border-t border-white/30 shadow-[inset_1px_1px_0_rgba(255,255,255,0.28)]"
        style={{ backgroundColor: fold }}
      />
      <span className="absolute left-1.5 top-1.5 h-px w-3 rounded-full bg-white/45" />
    </span>
  );
}

const signatureColors = ["#050505", "#7C3AED", "#2563EB", "#E11D48"];
type SignatureFontOption = (typeof signatureFontOptions)[number];
type SignatureFontCategory = (typeof signatureFontCategories)[number];
type SignatureTab = "Text" | "Draw" | "Upload";

function SignatureToolMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addObjectAtCenter = useEditorStore((state) => state.addObjectAtCenter);
  const [activeSignatureTab, setActiveSignatureTab] =
    useState<SignatureTab>("Text");
  const [signatureName, setSignatureName] = useState("Cautious Ndlovu");
  const [searchTerm, setSearchTerm] = useState("");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [activeFontCategory, setActiveFontCategory] =
    useState<SignatureFontCategory>(signatureFontCategories[0]);
  const [selectedFont, setSelectedFont] = useState<SignatureFontOption>(
    signatureFontOptions[0],
  );
  const [selectedColor, setSelectedColor] = useState("#050505");
  const [saveSignature, setSaveSignature] = useState(true);
  const normalizedFontSearch = searchTerm.trim().toLowerCase();
  const filteredFonts = signatureFontOptions.filter(
    (font) =>
      font.category === activeFontCategory &&
      font.name.toLowerCase().includes(normalizedFontSearch),
  );
  const handleAddSignature = () => {
    addObjectAtCenter({
      id: makeCanvasId("signature"),
      kind: "text",
      x: 0,
      y: 0,
      width: 360,
      text: signatureName || "Your signature",
      fill: selectedColor,
      fontSize: 42,
      fontFamily: selectedFont.name,
      fontStyle: "400",
    });
    onClose();
  };

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-0 z-40 flex h-[540px] w-82 flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-[rgba(0,0,0,0.22)_0px_8px_18px,rgba(0,0,0,0.18)_0px_18px_32px_-14px,rgba(0,0,0,0.12)_0px_-3px_0px_inset]"
    >
      <span className="absolute -left-[8px] top-[368px] h-4 w-4 rotate-45 border-b border-l border-slate-200 bg-white" />

      <div className="border-b border-slate-100 px-4 pb-0 pt-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="group relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100"
            aria-label="Back to tools"
            onClick={onClose}
          >
            <ArrowLeft size={19} strokeWidth={2.2} />
            <TooltipLabel label="Back" />
          </button>
          <div className="text-sm font-bold text-slate-950">
            Create signature
          </div>
          <button
            type="button"
            className="group relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100"
            aria-label="Close signature"
            onClick={onClose}
          >
            <X size={19} strokeWidth={2.2} />
            <TooltipLabel label="Close" side="top" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 text-sm font-medium text-slate-700">
          {(["Text", "Draw", "Upload"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`relative h-11 transition hover:text-slate-950 ${
                activeSignatureTab === tab ? "text-slate-950" : ""
              }`}
              onClick={() => {
                setActiveSignatureTab(tab);
                setFontDropdownOpen(false);
              }}
            >
              {tab}
              {activeSignatureTab === tab ? (
                <motion.span
                  layoutId="signature-tab-underline"
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {fontDropdownOpen && activeSignatureTab === "Text" ? (
        <div className="absolute inset-x-4 bottom-4 top-[116px] z-50 flex flex-col overflow-hidden rounded border border-slate-200 bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.24),0_4px_12px_rgba(15,23,42,0.12)]">
          <div className="flex shrink-0 items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1 text-slate-500 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
            <Search size={17} strokeWidth={2} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder='Try "Calligraphy" or "Open Sans"'
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="Search signature fonts"
            />
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100"
              aria-label="Close font picker"
              onClick={() => setFontDropdownOpen(false)}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>

          <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {signatureFontCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={`shrink-0 rounded border px-3 py-1 text-xs font-semibold transition ${
                  activeFontCategory === category
                    ? "border-violet-300 bg-violet-50 text-violet-700 shadow-[0_4px_10px_rgba(124,58,237,0.12)]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-pressed={activeFontCategory === category}
                onClick={() => setActiveFontCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mb-2 mt-3 flex shrink-0 items-center gap-2 text-xs font-bold text-slate-900">
            <TrendingUp size={15} strokeWidth={2.2} />
            Popular fonts
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-color:rgba(100,116,139,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60">
            {filteredFonts.length > 0 ? (
              filteredFonts.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-[15px] text-slate-700 transition hover:bg-slate-100 ${
                    selectedFont.name === font.name
                      ? "bg-slate-100 font-semibold"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedFont(font);
                    setFontDropdownOpen(false);
                  }}
                >
                  <span className={font.className}>{font.name}</span>
                  {selectedFont.name === font.name ? (
                    <Check
                      size={16}
                      className="text-violet-600"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </button>
              ))
            ) : (
              <div className="rounded px-3 py-6 text-center text-sm text-slate-400">
                No fonts found
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-color:rgba(100,116,139,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60">
        {activeSignatureTab === "Text" ? (
          <div className="space-y-4">
            <div className="flex h-36 items-center justify-center rounded border border-slate-200 bg-white px-4 text-center">
              <div
                className={`${selectedFont.className} text-3xl leading-tight`}
                style={{ color: selectedColor }}
              >
                {signatureName || "Your signature"}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-950">
                Full name
              </span>
              <input
                type="text"
                value={signatureName}
                onChange={(event) => setSignatureName(event.target.value)}
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                aria-label="Signature full name"
              />
            </label>

            <div className="relative">
              <span className="mb-2 block text-sm font-bold text-slate-950">
                Font
              </span>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:bg-slate-50"
                onClick={() => setFontDropdownOpen((value) => !value)}
                aria-expanded={fontDropdownOpen}
                aria-label="Choose signature font"
              >
                <span className={selectedFont.className}>
                  {selectedFont.name}
                </span>
                <ChevronDown
                  size={17}
                  strokeWidth={2.2}
                  className={`transition ${fontDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>
        ) : null}

        {activeSignatureTab === "Draw" ? (
          <SignatureDrawPad color={selectedColor} />
        ) : null}

        {activeSignatureTab === "Upload" ? (
          <div className="flex h-full min-h-[250px] flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-violet-600 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
              <Upload size={22} strokeWidth={2.2} />
            </div>
            <div className="text-sm font-bold text-slate-950">
              Upload signature
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Drop an image here or choose a signature file.
            </div>
            <button
              type="button"
              className="mt-4 h-9 rounded bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Choose file
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-white p-4">
        <div
          className={
            activeSignatureTab === "Text"
              ? "text-sm font-bold text-slate-900"
              : "text-sm font-bold text-slate-900"
          }
        >
          Color
        </div>
        <div className="mt-2 flex items-center gap-3">
          {signatureColors.map((color) => (
            <button
              key={color}
              type="button"
              className={`h-8 w-8 rounded-full border-2 bg-white p-1 transition ${
                selectedColor === color
                  ? "border-violet-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              aria-label={`${color} signature color`}
              onClick={() => setSelectedColor(color)}
            >
              <span
                className="block h-full w-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </button>
          ))}
          <button
            type="button"
            className={`group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[conic-gradient(from_0deg,#ef4444,#facc15,#22c55e,#3b82f6,#a855f7,#ef4444)] text-slate-950 shadow-[0_2px_5px_rgba(15,23,42,0.18)] transition ${
              signatureColors.includes(selectedColor)
                ? ""
                : "ring-2 ring-violet-500 ring-offset-2"
            }`}
            aria-label="Custom color"
          >
            <input
              type="color"
              value={selectedColor}
              onChange={(event) => setSelectedColor(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Choose custom signature color"
            />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-lg leading-none">
              +
            </span>
            <TooltipLabel label="Custom color" side="top" />
          </button>
        </div>

        <button
          type="button"
          className="mt-4 flex items-center gap-3 text-sm text-slate-900"
          onClick={() => setSaveSignature((value) => !value)}
          aria-pressed={saveSignature}
        >
          <span
            className={`flex h-6 w-10 items-center rounded-full p-0.5 transition ${
              saveSignature ? "bg-primary" : "bg-slate-300"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-violet-600 transition ${
                saveSignature ? "translate-x-4" : ""
              }`}
            >
              {saveSignature ? <Check size={14} strokeWidth={3} /> : null}
            </span>
          </span>
          Save signature
        </button>

        <button
          type="button"
          className="mt-4 h-11 w-full bg-primary rounded text-sm font-bold text-white transition hover:bg-primary/90 active:scale-[0.995] cursor-pointer"
          onClick={handleAddSignature}
        >
          Add signature
        </button>
      </div>
    </motion.div>
  );
}

type SignaturePoint = { x: number; y: number; w: number };
type SignatureStroke = { points: SignaturePoint[]; color: string };

const SIGNATURE_NIB_X = 20.5;
const SIGNATURE_NIB_Y = 96;
const SIGNATURE_REST_ANGLE = -38;
const SIGNATURE_MAX_SWING = 16;
const SIGNATURE_FOLLOW_EASE_IDLE = 0.16;
const SIGNATURE_FOLLOW_EASE_DRAW = 0.55;
const SIGNATURE_ANGLE_EASE = 0.22;
const SIGNATURE_GUIDE_BOTTOM = 36;
const SIGNATURE_CONTROL_X_EASE = 0.78;
const SIGNATURE_CONTROL_Y_EASE = 0.72;
const SIGNATURE_BASELINE_MAGNET = 0.62;

function drawSignatureStroke(
  ctx: CanvasRenderingContext2D,
  points: SignaturePoint[],
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (points.length < 2) {
    if (points.length === 1) {
      const point = points[0];
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = (previous.w + point.w) / 2;
    ctx.moveTo(previous.x, previous.y);
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

function SignatureDrawPad({ color }: { color: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const penRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const currentRef = useRef<SignatureStroke | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<SignaturePoint | null>(null);
  const penPositionRef = useRef({ x: 0, y: 0 });
  const penTargetRef = useRef({ x: 0, y: 0 });
  const penAngleRef = useRef(SIGNATURE_REST_ANGLE);
  const angleTargetRef = useRef(SIGNATURE_REST_ANGLE);
  const rafRef = useRef<number | null>(null);
  const colorRef = useRef(color);
  const altKeyDownRef = useRef(false);
  const pointerInsideRef = useRef(false);
  const [weight, setWeight] = useState(4);
  const weightRef = useRef(weight);
  const [altKeyDown, setAltKeyDown] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [drawingState, setDrawingState] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    weightRef.current = weight;
  }, [weight]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    strokesRef.current.forEach((stroke) => {
      drawSignatureStroke(ctx, stroke.points, stroke.color);
    });
  }, []);

  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    redrawAll();
  }, [redrawAll]);

  useEffect(() => {
    fitCanvas();
    window.addEventListener("resize", fitCanvas);

    return () => window.removeEventListener("resize", fitCanvas);
  }, [fitCanvas]);

  useEffect(() => {
    const tick = () => {
      const positionEase = drawingRef.current
        ? SIGNATURE_FOLLOW_EASE_DRAW
        : SIGNATURE_FOLLOW_EASE_IDLE;

      penPositionRef.current.x +=
        (penTargetRef.current.x - penPositionRef.current.x) * positionEase;
      penPositionRef.current.y +=
        (penTargetRef.current.y - penPositionRef.current.y) * positionEase;
      penAngleRef.current +=
        (angleTargetRef.current - penAngleRef.current) * SIGNATURE_ANGLE_EASE;

      if (penRef.current) {
        penRef.current.style.transform = `
  translate(${penPositionRef.current.x}px, ${penPositionRef.current.y}px)
  rotate(${penAngleRef.current}deg)
  scale(${drawingRef.current ? 0.92 : 1})
`;
      }

      if (dotRef.current) {
        dotRef.current.style.left = `${penPositionRef.current.x}px`;
        dotRef.current.style.top = `${penPositionRef.current.y}px`;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const relativePoint = useCallback((event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) return { x: 0, y: 0 };

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const drawingPoint = useCallback(
    (event: React.PointerEvent) => {
      const rawPoint = relativePoint(event);

      if (!event.ctrlKey) return rawPoint;

      const rect = containerRef.current?.getBoundingClientRect();
      const lastPoint = lastPointRef.current;
      const baselineY = rect
        ? rect.height - SIGNATURE_GUIDE_BOTTOM
        : rawPoint.y;
      const guidedY =
        baselineY + (rawPoint.y - baselineY) * SIGNATURE_BASELINE_MAGNET;

      if (!lastPoint) {
        return {
          x: rawPoint.x,
          y: guidedY,
        };
      }

      return {
        x: lastPoint.x + (rawPoint.x - lastPoint.x) * SIGNATURE_CONTROL_X_EASE,
        y: lastPoint.y + (guidedY - lastPoint.y) * SIGNATURE_CONTROL_Y_EASE,
      };
    },
    [relativePoint],
  );

  const setPenTarget = useCallback((x: number, y: number) => {
    penTargetRef.current = {
      x: x - SIGNATURE_NIB_X,
      y: y - SIGNATURE_NIB_Y,
    };
  }, []);

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;

    drawingRef.current = false;
    setDrawingState(false);

    if (currentRef.current && currentRef.current.points.length > 0) {
      strokesRef.current.push(currentRef.current);
      setHasInk(true);
    }

    currentRef.current = null;
    lastPointRef.current = null;
    angleTargetRef.current = SIGNATURE_REST_ANGLE;
  }, []);

  const startStroke = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (drawingRef.current) return;

      const { x, y } = drawingPoint(event);
      const point = { x, y, w: weightRef.current };

      drawingRef.current = true;
      setDrawingState(true);
      currentRef.current = { points: [point], color: colorRef.current };
      lastPointRef.current = point;
      setPenTarget(x, y);
    },
    [drawingPoint, setPenTarget],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      if (event.repeat) return;

      event.preventDefault();
      altKeyDownRef.current = true;
      setAltKeyDown(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;

      event.preventDefault();
      altKeyDownRef.current = false;
      setAltKeyDown(false);
      endStroke();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [endStroke]);

  const handlePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerInsideRef.current = true;
    setHovering(true);
    const { x, y } = relativePoint(event);
    penPositionRef.current = {
      x: x - SIGNATURE_NIB_X,
      y: y - SIGNATURE_NIB_Y,
    };
    setPenTarget(x, y);
    angleTargetRef.current = SIGNATURE_REST_ANGLE;
  };

  const handlePointerLeave = () => {
    pointerInsideRef.current = false;
    setHovering(false);
    endStroke();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = drawingPoint(event);
    setPenTarget(x, y);

    if (
      altKeyDownRef.current &&
      pointerInsideRef.current &&
      !drawingRef.current
    ) {
      startStroke(event);
    }

    if (!drawingRef.current || !currentRef.current) return;

    const lastPoint = lastPointRef.current;
    const dx = lastPoint ? x - lastPoint.x : 0;
    const dy = lastPoint ? y - lastPoint.y : 0;
    const distance = Math.hypot(dx, dy);

    if (lastPoint && distance < 0.6) return;

    const speedFactor = event.ctrlKey
      ? 1
      : Math.max(0.45, Math.min(1.35, 1.15 - distance / 28));
    const point = { x, y, w: weightRef.current * speedFactor };
    currentRef.current.points.push(point);
    lastPointRef.current = point;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const points = currentRef.current.points;

    if (ctx && points.length >= 2) {
      drawSignatureStroke(
        ctx,
        points.slice(Math.max(0, points.length - 2)),
        currentRef.current.color,
      );
    }

    if (distance > 0.6) {
      const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const lean = Math.max(
        -SIGNATURE_MAX_SWING,
        Math.min(SIGNATURE_MAX_SWING, rawAngle * (event.ctrlKey ? 0.12 : 0.25)),
      );
      angleTargetRef.current = SIGNATURE_REST_ANGLE + lean;
    }
  };

  const handleUndo = () => {
    strokesRef.current.pop();
    setHasInk(strokesRef.current.length > 0);
    redrawAll();
  };

  const handleClear = () => {
    strokesRef.current = [];
    currentRef.current = null;
    setHasInk(false);
    redrawAll();
  };

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerCancel={endStroke}
        className="relative h-36 select-none overflow-hidden rounded border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
        style={{ cursor: "none", touchAction: "none" }}
      >
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-slate-200" />
        <div
          className={`pointer-events-none absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm transition ${
            altKeyDown ? "text-violet-600" : "text-slate-500"
          }`}
        >
          {altKeyDown ? "DRAWING" : "HOLD ALT"}
        </div>

        {!hasInk && !drawingState ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Hold Alt and move your mouse to draw
          </div>
        ) : null}

        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div
          ref={dotRef}
          className="pointer-events-none absolute rounded-full bg-slate-900 transition-opacity duration-150"
          style={{
            width: drawingState ? 14 : 10,
            height: drawingState ? 5 : 4,
            marginLeft: SIGNATURE_NIB_X - 7,
            marginTop: SIGNATURE_NIB_Y - 2,
            opacity: hovering ? (drawingState ? 0.45 : 0.15) : 0,
            filter: "blur(1px)",
            transform: `rotate(${penAngleRef.current}deg)`,
            transition:
              "opacity 150ms ease, width 150ms ease, height 150ms ease",
          }}
        />

        <div
          ref={penRef}
          className="pointer-events-none absolute left-0 top-0 transition-opacity duration-200 ease-out"
          style={{
            opacity: hovering ? 1 : 0,
            transformOrigin: `${SIGNATURE_NIB_X}px ${SIGNATURE_NIB_Y}px`,
            filter: "drop-shadow(0 6px 6px rgba(15,23,42,0.25))",
            willChange: "transform",
          }}
        >
          <SignaturePen />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!hasInk}
          className="h-10 rounded border border-slate-200 bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasInk}
          className="h-10 rounded border border-slate-200 bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        >
          Clear Signature
        </button>
      </div>

      <div>
        <div className="mb-3 text-sm font-bold text-slate-950">Weight</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="8"
            value={weight}
            onChange={(event) => setWeight(Number(event.target.value))}
            className="h-1 flex-1 accent-violet-600"
            aria-label="Signature weight"
          />
          <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 text-sm text-slate-950">
            {weight}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignaturePen() {
  const rawId = useId().replace(/:/g, "");
  const bodyId = `${rawId}-body`;
  const metalId = `${rawId}-metal`;
  const goldId = `${rawId}-gold`;

  return (
    <svg width="42" height="100" viewBox="0 0 42 100" fill="none">
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="42" y2="0">
          <stop stopColor="#2e1065" />
          <stop offset=".35" stopColor="#7c3aed" />
          <stop offset=".55" stopColor="#c4b5fd" />
          <stop offset=".72" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>

        <linearGradient id={metalId} x1="0" y1="0" x2="42" y2="0">
          <stop stopColor="#52525b" />
          <stop offset=".45" stopColor="#fafafa" />
          <stop offset="1" stopColor="#71717a" />
        </linearGradient>

        <linearGradient id={goldId} x1="0" y1="0" x2="42" y2="0">
          <stop stopColor="#92400e" />
          <stop offset=".5" stopColor="#fde68a" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
      </defs>

      <rect
        x="8"
        y="0"
        width="26"
        height="58"
        rx="7"
        fill={`url(#${bodyId})`}
      />
      <rect
        x="12"
        y="3"
        width="3"
        height="52"
        rx="1.5"
        fill="white"
        opacity=".55"
      />
      <rect
        x="27"
        y="4"
        width="2"
        height="50"
        rx="1"
        fill="black"
        opacity=".18"
      />

      <rect x="8" y="56" width="26" height="6" fill={`url(#${goldId})`} />

      <path d="M10 62H32L25 84H17L10 62Z" fill={`url(#${metalId})`} />
      <path d="M17 84H25L21 98L17 84Z" fill="#111827" />

      <path
        d="M21 84V96"
        stroke="#020617"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="21" cy="98" r="1.6" fill="#020617" />
    </svg>
  );
}

function PencilToolMenu({ open }: { open: boolean }) {
  const [hoveredMarker, setHoveredMarker] = useState<
    "Pen" | "Marker" | "Highlighter" | null
  >(null);
  const [selectedTool, setSelectedTool] = useState<
    "Pen" | "Marker" | "Highlighter" | "Eraser"
  >("Pen");
  const [eraserPulled, setEraserPulled] = useState(false);
  const eraserIsPulled = selectedTool === "Eraser" || eraserPulled;

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-[148px] z-40 w-16 overflow-visible rounded border border-slate-200 bg-white px-1 py-3 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset]"
    >
      <span className="absolute -left-[8px] top-[42px] h-4 w-4 rotate-45 border-b border-l border-slate-200 bg-white" />
      <span className="pointer-events-none absolute bottom-4 left-[13px] top-4 z-20 w-px bg-slate-200/80 shadow-[1px_0_2px_rgba(15,23,42,0.08)]" />
      <div
        className="relative z-10 flex flex-col items-center gap-2"
        style={{ clipPath: "inset(0 -64px 0 12px)" }}
      >
        <div
          className="group relative flex h-8 w-[72px] cursor-pointer items-center justify-center overflow-visible"
          onClick={() => {
            setSelectedTool("Pen");
          }}
          onMouseEnter={() => setHoveredMarker("Pen")}
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <div className="scale-[0.62]">
            <Marker
              color="#ff5757"
              label="Pen"
              pressed={selectedTool === "Pen"}
              pulled={selectedTool === "Pen" || hoveredMarker === "Pen"}
              size="fine"
            />
          </div>
        </div>
        <div
          className="group relative flex h-8 w-[72px] cursor-pointer items-center justify-center overflow-visible"
          onClick={() => {
            setSelectedTool("Marker");
          }}
          onMouseEnter={() => setHoveredMarker("Marker")}
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <div className="scale-[0.62]">
            <Marker
              color="#ff2020"
              label="Marker"
              pressed={selectedTool === "Marker"}
              pulled={selectedTool === "Marker" || hoveredMarker === "Marker"}
            />
          </div>
        </div>
        <div
          className="group relative flex h-8 w-[72px] cursor-pointer items-center justify-center overflow-visible"
          onClick={() => {
            setSelectedTool("Highlighter");
          }}
          onMouseEnter={() => setHoveredMarker("Highlighter")}
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <div className="scale-[0.62]">
            <Marker
              color="#FFD600"
              label="Highlighter"
              pressed={selectedTool === "Highlighter"}
              pulled={
                selectedTool === "Highlighter" ||
                hoveredMarker === "Highlighter"
              }
            />
          </div>
        </div>

        <div className="h-px w-11 bg-slate-200" />

        <button
          type="button"
          className="group relative flex h-8 w-[72px] cursor-pointer items-center overflow-visible"
          onClick={() => setSelectedTool("Eraser")}
          onMouseEnter={() => setEraserPulled(true)}
          onMouseLeave={() => setEraserPulled(false)}
          aria-label="Eraser"
          aria-pressed={selectedTool === "Eraser"}
        >
          <motion.span
            animate={{ width: eraserIsPulled ? 70 : 52 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute left-[5px] top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-r-md bg-[linear-gradient(145deg,#ff7c90_0%,#ff4f6d_50%,#dc3656_100%)] shadow-[0_4px_6px_rgba(15,23,42,.1),inset_1px_1px_3px_rgba(255,255,255,.38),inset_-3px_-4px_5px_rgba(144,22,48,.12)]"
          >
            <motion.span
              animate={{ width: eraserIsPulled ? 46 : 32 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute left-2 top-1 h-1 rounded-full bg-white/28"
            />
            <span className="absolute left-0 top-0 h-2 w-full bg-white/14" />
            <span className="absolute right-[14px] top-0 h-full w-px bg-rose-800/20" />
            <span className="absolute right-2.5 top-0 h-full w-1 bg-rose-400/55" />
            <span className="absolute right-1 top-0 h-full w-1.5 rounded-r-md bg-rose-100" />
            <span className="absolute bottom-0 left-0 h-1.5 w-full bg-rose-950/8" />
          </motion.span>
          <TooltipLabel label="Eraser" side="top" />
        </button>

        <div className="h-px w-11 bg-slate-200" />

        <button
          type="button"
          className="group relative h-7 w-7 rounded-full bg-red-600 bg-gradient-to-b from-red-500 to-red-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)] active:scale-[0.995] active:shadow-[0_0px_1px_rgba(0,0,0,0.5)]"
          aria-label="Color"
        >
          <TooltipLabel label="Color" side="top" />
        </button>

        <button
          type="button"
          className="group relative flex h-6 w-7 flex-col items-center justify-center gap-0.5"
          aria-label="Settings"
        >
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <TooltipLabel label="Settings" side="top" />
        </button>
      </div>
    </motion.div>
  );
}
