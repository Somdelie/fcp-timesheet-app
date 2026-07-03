"use client";

import { motion } from "framer-motion";
import { Crown, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import Marker from "./Marker";

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
      </div>
    </aside>
  );
}

function ToolsToolbar({ onClose }: { onClose: () => void }) {
  const [activeTool, setActiveTool] = useState<string | null>("Pointer");

  const toolbarItems = [
    {
      icon: "/icons-3d/pointer.png",
      label: "Pointer",
    },
    { icon: "/icons-3d/pencil.png", label: "Brush" },
    { icon: "/icons-3d/shapes.png", label: "Shape" },
    { icon: "/icons-3d/line.png", label: "Line" },
    { icon: "/icons-3d/notes.png", label: "Sticky" },
    { icon: "/icons-3d/title.png", label: "Text" },
    { icon: "/icons-3d/sgnage.png", label: "Signature" },
    { icon: "/icons-3d/tables.png", label: "Table" },
  ];

  return (
    <div className="relative ml-3 flex items-start overflow-visible pt-9">
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Close tools"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div className="flex w-14 flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset]">
          {toolbarItems.map((item) => {
            const isActive = activeTool === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-100 ${
                  isActive && item.label === "Pointer"
                    ? "ring-1 ring-violet-200"
                    : isActive && item.label === "Brush"
                      ? "ring-1 ring-rose-200"
                      : isActive
                        ? "ring-1 ring-slate-200"
                        : ""
                }`}
                title={item.label}
                aria-label={item.label}
                onClick={() => setActiveTool(item.label)}
              >
                <Image
                  src={item.icon}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              </button>
            );
          })}
        </div>
      </div>

      <PencilToolMenu open={activeTool === "Brush"} />
      <ShapeToolMenu open={activeTool === "Shape"} />
    </div>
  );
}

function ShapeToolMenu({ open }: { open: boolean }) {
  const shapes = [
    "square",
    "rounded",
    "circle",
    "triangle-up",
    "triangle-down",
    "diamond",
    "pentagon",
    "hexagon",
    "star",
    "pill",
    "ring",
    "line",
  ];

  return (
    <motion.div
      initial={false}
      animate={{
        x: open ? 10 : -12,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute left-14 top-12 z-40 flex h-[408px] w-16 flex-col items-center gap-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-5 shadow-xl"
    >
      {shapes.map((shape) => (
        <button
          key={shape}
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          title={shape}
          aria-label={shape}
        >
          <ShapePreview shape={shape} />
        </button>
      ))}
    </motion.div>
  );
}

function ShapePreview({ shape }: { shape: string }) {
  switch (shape) {
    case "square":
      return <span className="block h-6 w-6 bg-slate-950" />;
    case "rounded":
      return <span className="block h-6 w-6 rounded bg-slate-950" />;
    case "circle":
      return <span className="block h-6 w-6 rounded-full bg-slate-950" />;
    case "triangle-up":
      return (
        <span className="block h-0 w-0 border-x-[12px] border-b-[24px] border-x-transparent border-b-slate-950" />
      );
    case "triangle-down":
      return (
        <span className="block h-0 w-0 border-x-[12px] border-t-[24px] border-x-transparent border-t-slate-950" />
      );
    case "diamond":
      return <span className="block h-5 w-5 rotate-45 bg-slate-950" />;
    case "pentagon":
      return (
        <span className="block h-7 w-7 bg-slate-950 [clip-path:polygon(50%_0,100%_38%,82%_100%,18%_100%,0_38%)]" />
      );
    case "hexagon":
      return (
        <span className="block h-7 w-7 bg-slate-950 [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]" />
      );
    case "star":
      return (
        <span className="block h-7 w-7 bg-slate-950 [clip-path:polygon(50%_0,61%_35%,98%_35%,68%_56%,79%_91%,50%_70%,21%_91%,32%_56%,2%_35%,39%_35%)]" />
      );
    case "pill":
      return <span className="block h-4 w-8 rounded-full bg-slate-950" />;
    case "ring":
      return (
        <span className="block h-7 w-7 rounded-full border-[5px] border-slate-950" />
      );
    default:
      return <span className="block h-1 w-8 bg-slate-950" />;
  }
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
      className="absolute left-14 top-[148px] z-40 w-16 overflow-visible rounded-[22px] border border-slate-200 bg-white px-1 py-3 shadow-[rgba(0,0,0,0.4)_0px_2px_4px,rgba(0,0,0,0.3)_0px_7px_13px_-3px,rgba(0,0,0,0.2)_0px_-3px_0px_inset]"
    >
      <span className="absolute -left-[8px] top-[42px] h-4 w-4 rotate-45 border-b border-l border-slate-200 bg-white" />
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
          className="relative flex h-8 w-[72px] cursor-pointer items-center overflow-visible"
          onClick={() => setSelectedTool("Eraser")}
          onMouseEnter={() => setEraserPulled(true)}
          onMouseLeave={() => setEraserPulled(false)}
          title="Eraser"
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
        </button>

        <div className="h-px w-11 bg-slate-200" />

        <button
          type="button"
          className="h-7 w-7 rounded-full bg-red-600 bg-gradient-to-b from-red-500 to-red-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)] active:shadow-[0_0px_1px_rgba(0,0,0,0.5)] active:scale-[0.995]"
          title="Color"
          aria-label="Color"
        />

        <button
          type="button"
          className="flex h-6 w-7 flex-col items-center justify-center gap-0.5"
          title="Settings"
          aria-label="Settings"
        >
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <span className="h-1 w-5 rounded-full bg-black shadow-[0_1px_1px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]" />
        </button>
      </div>
    </motion.div>
  );
}
