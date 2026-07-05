"use client";

import {
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  type EditorObject,
  type TextEditorObject,
} from "../store/editorStore";

export function SelectionStyleToolbar({
  object,
  onObjectChange,
}: {
  object: EditorObject | null;
  onObjectChange: (patch: Partial<EditorObject>) => void;
}) {
  const [activePopover, setActivePopover] = useState<string | null>(null);

  if (!object) return null;

  const togglePopover = (key: string) => {
    setActivePopover((current) => (current === key ? null : key));
  };
  const isSvgAsset = object.kind === "image" && object.src.endsWith(".svg");
  const isLineAsset =
    object.kind === "image" && object.src.includes("/lines-pack/");

  const updateText = (patch: Partial<TextEditorObject>) => {
    onObjectChange(patch as Partial<EditorObject>);
  };

  const textStyle =
    object.kind === "text" ? (object.fontStyle ?? "normal") : "";
  const isBold = textStyle.includes("bold");
  const isItalic = textStyle.includes("italic");
  const textDecoration =
    object.kind === "text" ? (object.textDecoration ?? "") : "";

  const nextFontStyle = (nextBold: boolean, nextItalic: boolean) => {
    if (nextBold && nextItalic) return "bold italic";
    if (nextBold) return "bold";
    if (nextItalic) return "italic";
    return "normal";
  };

  const toggleTextDecoration = (decoration: "underline" | "line-through") => {
    if (object.kind !== "text") return;
    const parts = new Set(textDecoration.split(" ").filter(Boolean));
    if (parts.has(decoration)) {
      parts.delete(decoration);
    } else {
      parts.add(decoration);
    }
    updateText({ textDecoration: Array.from(parts).join(" ") });
  };

  const cycleTextAlign = () => {
    if (object.kind !== "text") return;
    const current = object.align ?? "left";
    updateText({
      align:
        current === "left" ? "center" : current === "center" ? "right" : "left",
    });
  };

  if (object.kind === "text") {
    return (
      <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2 py-2 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-xl">
        <select
          value={object.fontFamily}
          onChange={(event) => updateText({ fontFamily: event.target.value })}
          className="h-9 w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition hover:bg-slate-50"
          aria-label="Font"
        >
          <option value="Inter, Arial, sans-serif">Canva Sans</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <ToolbarNumberStepper
          label="Text size"
          value={object.fontSize}
          min={8}
          max={160}
          onChange={(fontSize) => updateText({ fontSize })}
        />
        <ToolbarTextColorButton
          label="Text color"
          value={object.fill ?? "#000000"}
          onChange={(fill) => onObjectChange({ fill })}
        />
        <ToolbarMiniButton
          label="Bold"
          active={isBold}
          onClick={() =>
            updateText({ fontStyle: nextFontStyle(!isBold, isItalic) })
          }
        >
          <span className="text-base font-black leading-none">B</span>
        </ToolbarMiniButton>
        <ToolbarMiniButton
          label="Italic"
          active={isItalic}
          onClick={() =>
            updateText({ fontStyle: nextFontStyle(isBold, !isItalic) })
          }
        >
          <span className="text-base font-serif italic leading-none">I</span>
        </ToolbarMiniButton>
        <ToolbarMiniButton
          label="Underline"
          active={textDecoration.includes("underline")}
          onClick={() => toggleTextDecoration("underline")}
        >
          <span className="text-base leading-none underline">U</span>
        </ToolbarMiniButton>
        <ToolbarMiniButton
          label="Strikethrough"
          active={textDecoration.includes("line-through")}
          onClick={() => toggleTextDecoration("line-through")}
        >
          <span className="text-base leading-none line-through">S</span>
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Case">
          <span className="text-sm font-bold leading-none">aA</span>
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Align" onClick={cycleTextAlign}>
          <AlignIcon />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Bullets">
          <ListIcon />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Spacing">
          <SpacingIcon />
        </ToolbarMiniButton>
        <ToolbarRangeButton
          label="Opacity"
          min={0.1}
          max={1}
          step={0.05}
          value={object.opacity ?? 1}
          format={(value) => `${Math.round(value * 100)}%`}
          open={activePopover === "opacity"}
          onToggle={() => togglePopover("opacity")}
          buttonContent={<OpacityIcon />}
          onChange={(opacity) => onObjectChange({ opacity })}
        />
        <ToolbarDivider />
        <ToolbarTextButton label="Effects" />
        <ToolbarTextButton label="Position" />
        <ToolbarMiniButton label="Copy style">
          <PaintRollerIcon />
        </ToolbarMiniButton>
      </div>
    );
  }

  const isLineLike = object.kind === "line" || isLineAsset;
  const isShapeLike =
    object.kind === "rect" ||
    object.kind === "circle" ||
    (isSvgAsset && !isLineAsset);
  const shapeFill = object.fill ?? object.stroke ?? "#0f172a";
  const strokeColor = object.stroke ?? object.fill ?? "#0f172a";

  if (isLineLike) {
    return (
      <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2 py-2 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-xl">
        <ToolbarColorButton
          label="Line color"
          value={strokeColor}
          onChange={(color) =>
            onObjectChange(
              object.kind === "image"
                ? { fill: color, stroke: color }
                : { stroke: color },
            )
          }
        />
        <ToolbarRangeButton
          label="Line width"
          min={0.5}
          max={24}
          step={0.5}
          value={object.strokeWidth ?? 1.5}
          open={activePopover === "stroke-width"}
          onToggle={() => togglePopover("stroke-width")}
          buttonContent={<StrokeWidthIcon />}
          onChange={(strokeWidth) => onObjectChange({ strokeWidth })}
        />
        <ToolbarMiniButton label="Corner">
          <CornerRadiusIcon />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Start arrow">
          <ArrowIcon direction="left" />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Line type">
          <LineTypeIcon />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="End arrow">
          <ArrowIcon direction="right" />
        </ToolbarMiniButton>
        <ToolbarMiniButton label="Curve">
          <CurveIcon />
        </ToolbarMiniButton>
        <ToolbarRangeButton
          label="Opacity"
          min={0.1}
          max={1}
          step={0.05}
          value={object.opacity ?? 1}
          format={(value) => `${Math.round(value * 100)}%`}
          open={activePopover === "opacity"}
          onToggle={() => togglePopover("opacity")}
          buttonContent={<OpacityIcon />}
          onChange={(opacity) => onObjectChange({ opacity })}
        />
        <ToolbarDivider />
        <ToolbarTextButton label="Position" />
        <ToolbarMiniButton label="Copy style">
          <PaintRollerIcon />
        </ToolbarMiniButton>
      </div>
    );
  }

  return (
    <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2 py-2 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-xl">
      {isShapeLike ? <ToolbarTextButton label="Edit" /> : null}
      {isShapeLike ? (
        <ToolbarColorButton
          label="Fill"
          value={shapeFill}
          onChange={(fill) =>
            onObjectChange(object.kind === "image" ? { fill } : { fill })
          }
        />
      ) : null}
      {isShapeLike ? (
        <ToolbarColorButton
          label="Border"
          value={strokeColor}
          onChange={(stroke) => onObjectChange({ stroke })}
        />
      ) : null}
      <ToolbarRangeButton
        label="Border width"
        min={0}
        max={24}
        step={0.5}
        value={object.strokeWidth ?? 0}
        open={activePopover === "stroke-width"}
        onToggle={() => togglePopover("stroke-width")}
        buttonContent={<StrokeWidthIcon />}
        onChange={(strokeWidth) => onObjectChange({ strokeWidth })}
      />
      {object.kind === "rect" ? (
        <ToolbarRangeButton
          label="Corners"
          min={0}
          max={60}
          step={1}
          value={object.cornerRadius ?? 0}
          open={activePopover === "corners"}
          onToggle={() => togglePopover("corners")}
          buttonContent={<CornerRadiusIcon />}
          onChange={(cornerRadius) =>
            onObjectChange({ cornerRadius } as Partial<EditorObject>)
          }
        />
      ) : (
        <ToolbarMiniButton label="Corners">
          <CornerRadiusIcon />
        </ToolbarMiniButton>
      )}
      <ToolbarRangeButton
        label="Opacity"
        min={0.1}
        max={1}
        step={0.05}
        value={object.opacity ?? 1}
        format={(value) => `${Math.round(value * 100)}%`}
        open={activePopover === "opacity"}
        onToggle={() => togglePopover("opacity")}
        buttonContent={<OpacityIcon />}
        onChange={(opacity) => onObjectChange({ opacity })}
      />
      <ToolbarDivider />
      <ToolbarTextButton label="Effects" />
      <ToolbarTextButton label="Position" />
      <ToolbarMiniButton label="Copy style">
        <PaintRollerIcon />
      </ToolbarMiniButton>
    </div>
  );
}
function ToolbarTextButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="h-8 rounded-full px-3 text-sm font-bold transition hover:bg-slate-100"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ToolbarMiniButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`grid h-8 w-8 place-items-center rounded-full transition ${
        active ? "bg-violet-100 text-violet-700" : "hover:bg-slate-100"
      }`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ToolbarNumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const update = (nextValue: number) => {
    onChange(Math.min(max, Math.max(min, nextValue)));
  };

  return (
    <div
      className="flex h-9 items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm font-bold"
      aria-label={label}
    >
      <button
        type="button"
        className="grid h-full w-8 place-items-center hover:bg-slate-50"
        onClick={() => update(value - 1)}
        aria-label={`Decrease ${label}`}
      >
        -
      </button>
      <span className="min-w-10 text-center">{value}</span>
      <button
        type="button"
        className="grid h-full w-8 place-items-center hover:bg-slate-50"
        onClick={() => update(value + 1)}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

function ToolbarTextColorButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full transition hover:bg-slate-100"
      aria-label={label}
      title={label}
    >
      <span className="relative text-base font-black leading-none">
        A
        <span
          className="absolute -bottom-1 left-0 h-1 w-full rounded-full"
          style={{ backgroundColor: value }}
        />
      </span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  );
}

function ToolbarColorButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full transition hover:bg-slate-100"
      aria-label={label}
    >
      <span className="relative h-6 w-6 overflow-hidden rounded-full border-[5px] border-slate-950 shadow-inner">
        <span
          className="block h-full w-full"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
    </label>
  );
}

function ToolbarRangeButton({
  label,
  min,
  max,
  step,
  value,
  format = (nextValue) => `${nextValue}`,
  open,
  onToggle,
  buttonContent,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  open: boolean;
  onToggle: () => void;
  buttonContent: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition ${
          open ? "bg-violet-100 text-violet-700" : "hover:bg-slate-100"
        }`}
        onClick={onToggle}
        aria-label={label}
      >
        {buttonContent}
      </button>
      {open ? (
        <div className="absolute left-1/2 top-11 z-[70] w-44 -translate-x-1/2 rounded-2xl bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{label}</span>
            <span>{format(value)}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-full accent-violet-600"
          />
        </div>
      ) : null}
    </div>
  );
}

function StrokeWidthIcon() {
  return (
    <span className="flex h-5 w-5 flex-col justify-center gap-[3px]">
      <span className="h-[2px] w-5 rounded-full bg-current" />
      <span className="h-[3px] w-5 rounded-full bg-current" />
      <span className="h-[4px] w-5 rounded-full bg-current" />
    </span>
  );
}

function CornerRadiusIcon() {
  return (
    <span className="h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-current" />
  );
}

function AlignIcon() {
  return (
    <span className="flex h-5 w-5 flex-col justify-center gap-[3px]">
      <span className="h-[2px] w-5 rounded-full bg-current" />
      <span className="h-[2px] w-3 rounded-full bg-current" />
      <span className="h-[2px] w-4 rounded-full bg-current" />
    </span>
  );
}

function ListIcon() {
  return (
    <span className="grid h-5 w-5 grid-cols-[4px_1fr] items-center gap-x-1 gap-y-[3px]">
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-[2px] rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-[2px] rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-[2px] rounded-full bg-current" />
    </span>
  );
}

function SpacingIcon() {
  return (
    <span className="relative h-5 w-5">
      <span className="absolute left-1/2 top-0 h-5 w-[2px] -translate-x-1/2 rounded-full bg-current" />
      <span className="absolute left-[5px] top-[2px] h-2 w-2 rotate-45 border-l-2 border-t-2 border-current" />
      <span className="absolute bottom-[2px] left-[5px] h-2 w-2 rotate-[225deg] border-l-2 border-t-2 border-current" />
    </span>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <span className="relative h-5 w-5">
      <span className="absolute left-1 top-1/2 h-[2px] w-4 -translate-y-1/2 rounded-full bg-current" />
      <span
        className={`absolute top-[6px] h-2 w-2 rotate-45 border-current ${
          direction === "right"
            ? "right-1 border-r-2 border-t-2"
            : "left-1 border-b-2 border-l-2"
        }`}
      />
    </span>
  );
}

function LineTypeIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center gap-1">
      <span className="h-[2px] w-2 rounded-full bg-current" />
      <span className="h-[2px] w-2 rounded-full bg-current" />
    </span>
  );
}

function CurveIcon() {
  return (
    <span className="h-5 w-5 rounded-tl-full border-l-2 border-t-2 border-current" />
  );
}

function PaintRollerIcon() {
  return (
    <span className="relative h-5 w-5">
      <span className="absolute left-1 top-1 h-3 w-4 rounded-sm border-2 border-current" />
      <span className="absolute left-[9px] top-[13px] h-2 w-[2px] rounded-full bg-current" />
      <span className="absolute left-[7px] bottom-0 h-[2px] w-3 rounded-full bg-current" />
    </span>
  );
}

function OpacityIcon() {
  return (
    <span className="grid h-5 w-5 grid-cols-3 grid-rows-3 gap-0.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="rounded-[1px] bg-current opacity-70" />
      ))}
    </span>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-slate-200" />;
}
