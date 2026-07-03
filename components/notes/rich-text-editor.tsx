"use client";

import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import {
  FontFamily,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo,
  Redo,
  RemoveFormatting,
  ImagePlus,
  Palette,
  ChevronDown,
  ALargeSmall,
  Sigma,
  Type,
  Shapes,
  PenLine,
  Eraser,
  RotateCw,
  Table2,
  Rows3,
  Columns3,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const IMAGE_MIN_WIDTH = 30;
const IMAGE_MAX_WIDTH = 400;
const IMAGE_DEFAULT_WIDTH = 320;
const SHAPE_DEFAULT_WIDTH = 180;
const SIGNATURE_DEFAULT_WIDTH = 260;
const SHAPE_DEFAULT_STROKE = "#16988d";
const SHAPE_DEFAULT_FILL = "#dff7f5";
const SHAPE_DEFAULT_STROKE_WIDTH = 4;

const SHAPE_COLORS = [
  "#ffffff",
  "#111827",
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];

const TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Gray", value: "#6b7280" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

const FONT_SIZES = [
  { name: "Small", value: "12px" },
  { name: "Normal", value: "14px" },
  { name: "16", value: "16px" },
  { name: "Large", value: "18px" },
  { name: "20", value: "20px" },
  { name: "Extra large", value: "22px" },
  { name: "24", value: "24px" },
  { name: "28", value: "28px" },
  { name: "32", value: "32px" },
  { name: "36", value: "36px" },
  { name: "44", value: "44px" },
  { name: "54", value: "54px" },
  { name: "60", value: "60px" },
  { name: "72", value: "72px" },
];

const FONT_FAMILIES = [
  { name: "Default", value: "" },
  { name: "Aptos", value: "Aptos, Arial, sans-serif" },
  { name: "DM Sans", value: "var(--font-dm-sans), sans-serif" },
  { name: "Arial", value: "Arial, Helvetica, sans-serif" },
  { name: "Arial Black", value: "Arial Black, Gadget, sans-serif" },
  { name: "Bahnschrift", value: "Bahnschrift, Arial, sans-serif" },
  { name: "Calibri", value: "Calibri, Arial, sans-serif" },
  { name: "Cambria", value: "Cambria, Georgia, serif" },
  { name: "Candara", value: "Candara, Calibri, sans-serif" },
  { name: "Century Gothic", value: "Century Gothic, Arial, sans-serif" },
  { name: "Consolas", value: "Consolas, Monaco, monospace" },
  { name: "Constantia", value: "Constantia, Georgia, serif" },
  { name: "Corbel", value: "Corbel, Calibri, sans-serif" },
  { name: "Courier New", value: "Courier New, Courier, monospace" },
  { name: "Franklin Gothic", value: "Franklin Gothic Medium, Arial, sans-serif" },
  { name: "Garamond", value: "Garamond, Georgia, serif" },
  { name: "Georgia", value: "Georgia, Times New Roman, serif" },
  { name: "Gill Sans", value: "Gill Sans, Calibri, sans-serif" },
  { name: "Helvetica", value: "Helvetica Neue, Helvetica, Arial, sans-serif" },
  { name: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
  { name: "Lucida Console", value: "Lucida Console, Monaco, monospace" },
  { name: "Lucida Sans", value: "Lucida Sans Unicode, Lucida Grande, sans-serif" },
  { name: "Palatino", value: "Palatino Linotype, Book Antiqua, Palatino, serif" },
  { name: "Segoe UI", value: "Segoe UI, Arial, sans-serif" },
  { name: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { name: "Times New Roman", value: "Times New Roman, Times, serif" },
  { name: "Trebuchet MS", value: "Trebuchet MS, Helvetica, sans-serif" },
  { name: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { name: "Monospace", value: "var(--font-geist-mono), Consolas, monospace" },
  { name: "System", value: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
  { name: "Cursive", value: "Comic Sans MS, Comic Sans, cursive" },
  { name: "Fantasy", value: "Papyrus, fantasy" },
  { name: "Script", value: "Brush Script MT, Segoe Script, cursive" },
  { name: "Bookman", value: "Bookman Old Style, Georgia, serif" },
  { name: "Copperplate", value: "Copperplate, Copperplate Gothic Light, fantasy" },
  { name: "Didot", value: "Didot, Bodoni MT, serif" },
  { name: "Optima", value: "Optima, Segoe UI, sans-serif" },
  { name: "Rockwell", value: "Rockwell, Courier New, serif" },
  { name: "Perpetua", value: "Perpetua, Georgia, serif" },
];

const NOTE_SYMBOLS = [
  { symbol: "\u{1F600}", label: "grinning face happy smile" },
  { symbol: "\u{1F603}", label: "smiling face happy" },
  { symbol: "\u{1F642}", label: "slight smile face" },
  { symbol: "\u{1F609}", label: "wink face" },
  { symbol: "\u{1F60D}", label: "heart eyes love" },
  { symbol: "\u{1F914}", label: "thinking face question" },
  { symbol: "\u{1F621}", label: "angry face" },
  { symbol: "\u{1F44D}", label: "thumbs up approve yes" },
  { symbol: "\u{1F44E}", label: "thumbs down reject no" },
  { symbol: "\u{1F44F}", label: "clap applause" },
  { symbol: "\u{1F64F}", label: "please thanks prayer" },
  { symbol: "\u{1F91D}", label: "handshake agreement" },
  { symbol: "\u{1F6B9}", label: "man restroom male" },
  { symbol: "\u{1F6BA}", label: "woman restroom female" },
  { symbol: "\u267F", label: "wheelchair accessibility" },
  { symbol: "\u{1F6BE}", label: "water closet restroom wc" },
  { symbol: "\u26D1\uFE0F", label: "helmet safety construction" },
  { symbol: "\u2692\uFE0F", label: "hammer pick tool construction" },
  { symbol: "\u{1F527}", label: "wrench tool repair" },
  { symbol: "\u{1F9F1}", label: "brick wall construction" },
  { symbol: "\u{1F3D7}\uFE0F", label: "building construction site" },
  { symbol: "\u{1F4BC}", label: "briefcase work" },
  { symbol: "\u{1F4C5}", label: "calendar date schedule" },
  { symbol: "\u{1F4CC}", label: "pin pinned" },
  { symbol: "\u{1F4CD}", label: "location pin" },
  { symbol: "\u{1F4CE}", label: "paperclip attach" },
  { symbol: "\u{1F4DD}", label: "memo note" },
  { symbol: "\u{1F4E6}", label: "package box delivery" },
  { symbol: "\u{1F69A}", label: "truck delivery" },
  { symbol: "\u{1F4B2}", label: "dollar money" },
  { symbol: "\u{1F4B1}", label: "currency exchange money" },
  { symbol: "\u{1F4A1}", label: "idea light bulb" },
  { symbol: "\u{1F4A2}", label: "anger burst" },
  { symbol: "\u{1F4AF}", label: "hundred perfect" },
  { symbol: "\u{1F525}", label: "fire urgent hot" },
  { symbol: "\u2B50", label: "star favorite" },
  { symbol: "\u2728", label: "sparkles new" },
  { symbol: "\u2600\uFE0F", label: "sun sunny" },
  { symbol: "\u2601\uFE0F", label: "cloud weather" },
  { symbol: "\u2614", label: "umbrella rain" },
  { symbol: "\u26A1", label: "lightning power" },
  { symbol: "\u2705", label: "green check done complete" },
  { symbol: "\u2611\uFE0F", label: "ballot check checked" },
  { symbol: "\u2714\uFE0F", label: "check mark" },
  { symbol: "\u274C", label: "cross x cancel" },
  { symbol: "\u2716\uFE0F", label: "multiply x close" },
  { symbol: "\u26D4", label: "no entry stop blocked" },
  { symbol: "\u{1F6AB}", label: "prohibited no" },
  { symbol: "\u26A0\uFE0F", label: "warning alert" },
  { symbol: "\u2757", label: "exclamation important" },
  { symbol: "\u2753", label: "question help" },
  { symbol: "\u2139\uFE0F", label: "information info" },
  { symbol: "\u{1F198}", label: "sos emergency" },
  { symbol: "\u{1F197}", label: "ok okay" },
  { symbol: "\u{1F192}", label: "cool" },
  { symbol: "\u{1F195}", label: "new" },
  { symbol: "\u{1F196}", label: "ng no good" },
  { symbol: "\u{1F51E}", label: "under eighteen forbidden" },
  { symbol: "\u{1F6DC}", label: "wireless internet" },
  { symbol: "\u{1F4F6}", label: "signal wifi bars" },
  { symbol: "\u{1F50B}", label: "battery" },
  { symbol: "\u{1F50C}", label: "plug power" },
  { symbol: "\u25B6\uFE0F", label: "play start" },
  { symbol: "\u23F8\uFE0F", label: "pause" },
  { symbol: "\u23F9\uFE0F", label: "stop" },
  { symbol: "\u{1F504}", label: "refresh reload sync" },
  { symbol: "\u{1F500}", label: "shuffle arrows" },
  { symbol: "\u2B05\uFE0F", label: "left arrow" },
  { symbol: "\u27A1\uFE0F", label: "right arrow" },
  { symbol: "\u2B06\uFE0F", label: "up arrow" },
  { symbol: "\u2B07\uFE0F", label: "down arrow" },
  { symbol: "\u2194\uFE0F", label: "left right arrow" },
  { symbol: "\u2195\uFE0F", label: "up down arrow" },
  { symbol: "\u2197\uFE0F", label: "north east arrow" },
  { symbol: "\u{1F53A}", label: "red triangle up" },
  { symbol: "\u{1F53B}", label: "red triangle down" },
  { symbol: "\u{1F535}", label: "blue circle" },
  { symbol: "\u{1F534}", label: "red circle" },
  { symbol: "\u{1F7E2}", label: "green circle" },
  { symbol: "\u{1F7E1}", label: "yellow circle" },
  { symbol: "\u{1F7EA}", label: "purple square" },
  { symbol: "\u{1F7E6}", label: "blue square" },
  { symbol: "\u{1F7E9}", label: "green square" },
  { symbol: "\u{1F7E4}", label: "brown circle" },
  { symbol: "\u{1F539}", label: "small blue diamond" },
  { symbol: "\u{1F538}", label: "small orange diamond" },
  { symbol: "\u{1F533}", label: "white square button" },
  { symbol: "\u{1F518}", label: "radio button" },
  { symbol: "\u0030\uFE0F\u20E3", label: "number 0 zero" },
  { symbol: "\u0031\uFE0F\u20E3", label: "number 1 one" },
  { symbol: "\u0032\uFE0F\u20E3", label: "number 2 two" },
  { symbol: "\u0033\uFE0F\u20E3", label: "number 3 three" },
  { symbol: "\u0034\uFE0F\u20E3", label: "number 4 four" },
  { symbol: "\u0035\uFE0F\u20E3", label: "number 5 five" },
  { symbol: "\u0036\uFE0F\u20E3", label: "number 6 six" },
  { symbol: "\u0037\uFE0F\u20E3", label: "number 7 seven" },
  { symbol: "\u0038\uFE0F\u20E3", label: "number 8 eight" },
  { symbol: "\u0039\uFE0F\u20E3", label: "number 9 nine" },
  { symbol: "\u002A\uFE0F\u20E3", label: "asterisk keycap" },
  { symbol: "\u0023\uFE0F\u20E3", label: "hash keycap" },
  { symbol: "\u2648", label: "aries zodiac" },
  { symbol: "\u2649", label: "taurus zodiac" },
  { symbol: "\u264A", label: "gemini zodiac" },
  { symbol: "\u264B", label: "cancer zodiac" },
  { symbol: "\u264C", label: "leo zodiac" },
  { symbol: "\u264D", label: "virgo zodiac" },
  { symbol: "\u264E", label: "libra zodiac" },
  { symbol: "\u264F", label: "scorpio zodiac" },
  { symbol: "\u2650", label: "sagittarius zodiac" },
  { symbol: "\u2651", label: "capricorn zodiac" },
  { symbol: "\u2652", label: "aquarius zodiac" },
  { symbol: "\u2653", label: "pisces zodiac" },
  { symbol: "\u267B\uFE0F", label: "recycle" },
  { symbol: "\u262E\uFE0F", label: "peace" },
  { symbol: "\u269B\uFE0F", label: "atom science" },
  { symbol: "\u271D\uFE0F", label: "cross christian" },
  { symbol: "\u2734\uFE0F", label: "eight pointed star" },
  { symbol: "\u2733\uFE0F", label: "asterisk star" },
  { symbol: "\u{1F237}", label: "japanese monthly symbol" },
  { symbol: "\u2122\uFE0F", label: "trademark" },
  { symbol: "\u00A9\uFE0F", label: "copyright" },
  { symbol: "\u00AE\uFE0F", label: "registered" },
  { symbol: "\u00B0", label: "degree" },
  { symbol: "\u00B1", label: "plus minus" },
  { symbol: "\u00D7", label: "multiply times" },
  { symbol: "\u00F7", label: "divide" },
  { symbol: "\u2260", label: "not equal" },
  { symbol: "\u2264", label: "less equal" },
  { symbol: "\u2265", label: "greater equal" },
  { symbol: "\u221E", label: "infinity" },
];

type ShapeKind =
  | "line"
  | "dashed-line"
  | "arrow"
  | "double-arrow"
  | "elbow-connector"
  | "curved-line"
  | "rectangle"
  | "square"
  | "rounded-rectangle"
  | "circle"
  | "triangle"
  | "right-triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "trapezoid"
  | "parallelogram"
  | "plus"
  | "cross"
  | "can"
  | "cube"
  | "document"
  | "folded-corner"
  | "left-arrow"
  | "right-arrow"
  | "up-arrow"
  | "down-arrow"
  | "left-right-arrow"
  | "up-down-arrow"
  | "quad-arrow"
  | "chevron"
  | "flow-process"
  | "flow-decision"
  | "flow-data"
  | "flow-terminator"
  | "flow-database"
  | "flow-document"
  | "star-5"
  | "star-8"
  | "burst"
  | "heart"
  | "lightning"
  | "sun"
  | "moon"
  | "ribbon"
  | "scroll"
  | "speech-bubble"
  | "thought-bubble"
  | "callout"
  | "brace-pair"
  | "bracket-pair";

const NOTE_SHAPES: Array<{
  name: string;
  kind: ShapeKind;
  width: number;
  height: number;
}> = [
  { name: "Line", kind: "line", width: 220, height: 50 },
  { name: "Dashed line", kind: "dashed-line", width: 220, height: 50 },
  { name: "Arrow", kind: "arrow", width: 220, height: 50 },
  { name: "Double arrow", kind: "double-arrow", width: 220, height: 50 },
  { name: "Elbow connector", kind: "elbow-connector", width: 180, height: 120 },
  { name: "Curved line", kind: "curved-line", width: 180, height: 120 },
  { name: "Rectangle", kind: "rectangle", width: 180, height: 110 },
  { name: "Square", kind: "square", width: 140, height: 140 },
  { name: "Rounded rectangle", kind: "rounded-rectangle", width: 180, height: 110 },
  { name: "Circle", kind: "circle", width: 140, height: 140 },
  { name: "Triangle", kind: "triangle", width: 160, height: 140 },
  { name: "Right triangle", kind: "right-triangle", width: 160, height: 140 },
  { name: "Diamond", kind: "diamond", width: 150, height: 150 },
  { name: "Pentagon", kind: "pentagon", width: 150, height: 140 },
  { name: "Hexagon", kind: "hexagon", width: 160, height: 140 },
  { name: "Octagon", kind: "octagon", width: 150, height: 150 },
  { name: "Trapezoid", kind: "trapezoid", width: 180, height: 120 },
  { name: "Parallelogram", kind: "parallelogram", width: 180, height: 120 },
  { name: "Plus", kind: "plus", width: 150, height: 150 },
  { name: "Cross", kind: "cross", width: 150, height: 150 },
  { name: "Can", kind: "can", width: 150, height: 150 },
  { name: "Cube", kind: "cube", width: 160, height: 150 },
  { name: "Document", kind: "document", width: 150, height: 170 },
  { name: "Folded corner", kind: "folded-corner", width: 150, height: 170 },
  { name: "Left arrow", kind: "left-arrow", width: 190, height: 90 },
  { name: "Right arrow", kind: "right-arrow", width: 190, height: 90 },
  { name: "Up arrow", kind: "up-arrow", width: 110, height: 170 },
  { name: "Down arrow", kind: "down-arrow", width: 110, height: 170 },
  { name: "Left-right arrow", kind: "left-right-arrow", width: 210, height: 90 },
  { name: "Up-down arrow", kind: "up-down-arrow", width: 110, height: 190 },
  { name: "Quad arrow", kind: "quad-arrow", width: 170, height: 170 },
  { name: "Chevron", kind: "chevron", width: 150, height: 130 },
  { name: "Process", kind: "flow-process", width: 180, height: 100 },
  { name: "Decision", kind: "flow-decision", width: 150, height: 130 },
  { name: "Data", kind: "flow-data", width: 180, height: 110 },
  { name: "Terminator", kind: "flow-terminator", width: 180, height: 90 },
  { name: "Database", kind: "flow-database", width: 150, height: 150 },
  { name: "Document flow", kind: "flow-document", width: 170, height: 130 },
  { name: "5-point star", kind: "star-5", width: 150, height: 150 },
  { name: "8-point star", kind: "star-8", width: 150, height: 150 },
  { name: "Explosion", kind: "burst", width: 160, height: 150 },
  { name: "Heart", kind: "heart", width: 150, height: 140 },
  { name: "Lightning", kind: "lightning", width: 110, height: 160 },
  { name: "Sun", kind: "sun", width: 150, height: 150 },
  { name: "Moon", kind: "moon", width: 130, height: 150 },
  { name: "Ribbon", kind: "ribbon", width: 190, height: 100 },
  { name: "Scroll", kind: "scroll", width: 180, height: 120 },
  { name: "Speech bubble", kind: "speech-bubble", width: 180, height: 120 },
  { name: "Thought bubble", kind: "thought-bubble", width: 180, height: 120 },
  { name: "Callout", kind: "callout", width: 180, height: 120 },
  { name: "Braces", kind: "brace-pair", width: 150, height: 150 },
  { name: "Brackets", kind: "bracket-pair", width: 150, height: 150 },
];

function clampImageWidth(width: number) {
  return Math.min(IMAGE_MAX_WIDTH, Math.max(IMAGE_MIN_WIDTH, width));
}

function polygonPoints(
  sides: number,
  centerX: number,
  centerY: number,
  radius: number,
  rotation = -90,
) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((rotation + (index * 360) / sides) * Math.PI) / 180;
    return `${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`;
  }).join(" ");
}

function starPoints(
  points: number,
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = ((-90 + (index * 180) / points) * Math.PI) / 180;
    return `${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`;
  }).join(" ");
}

function shapeToSvg(shape: {
  kind: ShapeKind;
  width: number;
  height: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}) {
  const stroke = shape.stroke ?? SHAPE_DEFAULT_STROKE;
  const fill = shape.fill ?? SHAPE_DEFAULT_FILL;
  const strokeWidth = shape.strokeWidth ?? SHAPE_DEFAULT_STROKE_WIDTH;
  const marker =
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="' +
    stroke +
    '"/></marker></defs>';
  const common = `stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}"`;
  const noFill = `stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"`;
  const lineY = shape.height / 2;
  const w = shape.width;
  const h = shape.height;
  const cx = w / 2;
  const cy = h / 2;

  const body: Record<ShapeKind, string> = {
    line: `<line x1="12" y1="${lineY}" x2="${shape.width - 12}" y2="${lineY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
    "dashed-line": `<line x1="12" y1="${lineY}" x2="${w - 12}" y2="${lineY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-dasharray="12 9"/>`,
    arrow: `${marker}<line x1="12" y1="${lineY}" x2="${shape.width - 18}" y2="${lineY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#arrow)"/>`,
    "double-arrow": `${marker}<line x1="18" y1="${lineY}" x2="${shape.width - 18}" y2="${lineY}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`,
    "elbow-connector": `${marker}<path d="M 20 20 H ${w - 45} V ${h - 20}" ${noFill} stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>`,
    "curved-line": `${marker}<path d="M 18 ${h - 24} C ${w * 0.35} 12, ${w * 0.65} 12, ${w - 18} ${h - 24}" ${noFill} stroke-linecap="round" marker-end="url(#arrow)"/>`,
    rectangle: `<rect x="10" y="10" width="${shape.width - 20}" height="${shape.height - 20}" ${common}/>`,
    square: `<rect x="10" y="10" width="${w - 20}" height="${h - 20}" ${common}/>`,
    "rounded-rectangle": `<rect x="10" y="10" width="${shape.width - 20}" height="${shape.height - 20}" rx="18" ${common}/>`,
    circle: `<ellipse cx="${shape.width / 2}" cy="${shape.height / 2}" rx="${shape.width / 2 - 10}" ry="${shape.height / 2 - 10}" ${common}/>`,
    triangle: `<polygon points="${shape.width / 2},10 ${shape.width - 10},${shape.height - 10} 10,${shape.height - 10}" ${common}/>`,
    "right-triangle": `<polygon points="12,12 ${w - 12},${h - 12} 12,${h - 12}" ${common}/>`,
    diamond: `<polygon points="${shape.width / 2},10 ${shape.width - 10},${shape.height / 2} ${shape.width / 2},${shape.height - 10} 10,${shape.height / 2}" ${common}/>`,
    pentagon: `<polygon points="${polygonPoints(5, cx, cy + 5, Math.min(w, h) / 2 - 12)}" ${common}/>`,
    hexagon: `<polygon points="${polygonPoints(6, cx, cy, Math.min(w, h) / 2 - 12, 30)}" ${common}/>`,
    octagon: `<polygon points="${polygonPoints(8, cx, cy, Math.min(w, h) / 2 - 12, 22.5)}" ${common}/>`,
    trapezoid: `<polygon points="${w * 0.28},12 ${w * 0.72},12 ${w - 12},${h - 12} 12,${h - 12}" ${common}/>`,
    parallelogram: `<polygon points="${w * 0.24},12 ${w - 12},12 ${w * 0.76},${h - 12} 12,${h - 12}" ${common}/>`,
    plus: `<polygon points="${w * 0.38},10 ${w * 0.62},10 ${w * 0.62},${h * 0.38} ${w - 10},${h * 0.38} ${w - 10},${h * 0.62} ${w * 0.62},${h * 0.62} ${w * 0.62},${h - 10} ${w * 0.38},${h - 10} ${w * 0.38},${h * 0.62} 10,${h * 0.62} 10,${h * 0.38} ${w * 0.38},${h * 0.38}" ${common}/>`,
    cross: `<polygon points="${w * 0.24},10 ${cx},${h * 0.36} ${w * 0.76},10 ${w - 10},${h * 0.24} ${w * 0.64},${cy} ${w - 10},${h * 0.76} ${w * 0.76},${h - 10} ${cx},${h * 0.64} ${w * 0.24},${h - 10} 10,${h * 0.76} ${w * 0.36},${cy} 10,${h * 0.24}" ${common}/>`,
    can: `<path d="M 20 30 C 20 15, ${w - 20} 15, ${w - 20} 30 V ${h - 28} C ${w - 20} ${h - 12}, 20 ${h - 12}, 20 ${h - 28} Z M 20 30 C 20 45, ${w - 20} 45, ${w - 20} 30" ${common}/><path d="M 20 ${h - 28} C 20 ${h - 12}, ${w - 20} ${h - 12}, ${w - 20} ${h - 28}" ${noFill}/>`,
    cube: `<path d="M 42 18 H ${w - 20} V ${h - 45} L ${w - 52} ${h - 18} H 20 V 45 Z" ${common}/><path d="M 20 45 H ${w - 52} L ${w - 20} 18 M ${w - 52} 45 V ${h - 18}" ${noFill}/>`,
    document: `<path d="M 18 12 H ${w - 18} V ${h - 26} C ${w * 0.72} ${h - 6}, ${w * 0.42} ${h - 44}, 18 ${h - 22} Z" ${common}/>`,
    "folded-corner": `<path d="M 18 12 H ${w - 42} L ${w - 18} 36 V ${h - 12} H 18 Z M ${w - 42} 12 V 36 H ${w - 18}" ${common}/>`,
    "left-arrow": `<polygon points="10,${cy} ${w * 0.36},12 ${w * 0.36},${h * 0.34} ${w - 10},${h * 0.34} ${w - 10},${h * 0.66} ${w * 0.36},${h * 0.66} ${w * 0.36},${h - 12}" ${common}/>`,
    "right-arrow": `<polygon points="${w - 10},${cy} ${w * 0.64},12 ${w * 0.64},${h * 0.34} 10,${h * 0.34} 10,${h * 0.66} ${w * 0.64},${h * 0.66} ${w * 0.64},${h - 12}" ${common}/>`,
    "up-arrow": `<polygon points="${cx},10 ${w - 10},${h * 0.38} ${w * 0.66},${h * 0.38} ${w * 0.66},${h - 10} ${w * 0.34},${h - 10} ${w * 0.34},${h * 0.38} 10,${h * 0.38}" ${common}/>`,
    "down-arrow": `<polygon points="${cx},${h - 10} ${w - 10},${h * 0.62} ${w * 0.66},${h * 0.62} ${w * 0.66},10 ${w * 0.34},10 ${w * 0.34},${h * 0.62} 10,${h * 0.62}" ${common}/>`,
    "left-right-arrow": `<polygon points="10,${cy} ${w * 0.24},12 ${w * 0.24},${h * 0.35} ${w * 0.76},${h * 0.35} ${w * 0.76},12 ${w - 10},${cy} ${w * 0.76},${h - 12} ${w * 0.76},${h * 0.65} ${w * 0.24},${h * 0.65} ${w * 0.24},${h - 12}" ${common}/>`,
    "up-down-arrow": `<polygon points="${cx},10 ${w - 10},${h * 0.24} ${w * 0.65},${h * 0.24} ${w * 0.65},${h * 0.76} ${w - 10},${h * 0.76} ${cx},${h - 10} 10,${h * 0.76} ${w * 0.35},${h * 0.76} ${w * 0.35},${h * 0.24} 10,${h * 0.24}" ${common}/>`,
    "quad-arrow": `<polygon points="${cx},10 ${w * 0.66},${h * 0.25} ${w * 0.58},${h * 0.25} ${w * 0.58},${h * 0.42} ${w * 0.75},${h * 0.42} ${w * 0.75},${h * 0.34} ${w - 10},${cy} ${w * 0.75},${h * 0.66} ${w * 0.75},${h * 0.58} ${w * 0.58},${h * 0.58} ${w * 0.58},${h * 0.75} ${w * 0.66},${h * 0.75} ${cx},${h - 10} ${w * 0.34},${h * 0.75} ${w * 0.42},${h * 0.75} ${w * 0.42},${h * 0.58} ${w * 0.25},${h * 0.58} ${w * 0.25},${h * 0.66} 10,${cy} ${w * 0.25},${h * 0.34} ${w * 0.25},${h * 0.42} ${w * 0.42},${h * 0.42} ${w * 0.42},${h * 0.25} ${w * 0.34},${h * 0.25}" ${common}/>`,
    chevron: `<polygon points="12,12 ${w * 0.62},${cy} 12,${h - 12} ${w * 0.38},${h - 12} ${w - 12},${cy} ${w * 0.38},12" ${common}/>`,
    "flow-process": `<rect x="12" y="12" width="${w - 24}" height="${h - 24}" ${common}/>`,
    "flow-decision": `<polygon points="${cx},10 ${w - 10},${cy} ${cx},${h - 10} 10,${cy}" ${common}/>`,
    "flow-data": `<polygon points="${w * 0.24},12 ${w - 12},12 ${w * 0.76},${h - 12} 12,${h - 12}" ${common}/>`,
    "flow-terminator": `<rect x="12" y="14" width="${w - 24}" height="${h - 28}" rx="${h / 2 - 14}" ${common}/>`,
    "flow-database": `<path d="M 20 30 C 20 15, ${w - 20} 15, ${w - 20} 30 V ${h - 28} C ${w - 20} ${h - 12}, 20 ${h - 12}, 20 ${h - 28} Z M 20 30 C 20 45, ${w - 20} 45, ${w - 20} 30" ${common}/><path d="M 20 ${h * 0.5} C 20 ${h * 0.64}, ${w - 20} ${h * 0.64}, ${w - 20} ${h * 0.5}" ${noFill}/>`,
    "flow-document": `<path d="M 12 12 H ${w - 12} V ${h - 28} C ${w * 0.7} ${h - 4}, ${w * 0.42} ${h - 42}, 12 ${h - 20} Z" ${common}/>`,
    "star-5": `<polygon points="${starPoints(5, cx, cy, Math.min(w, h) / 2 - 10, Math.min(w, h) / 4)}" ${common}/>`,
    "star-8": `<polygon points="${starPoints(8, cx, cy, Math.min(w, h) / 2 - 10, Math.min(w, h) / 4)}" ${common}/>`,
    burst: `<polygon points="${starPoints(12, cx, cy, Math.min(w, h) / 2 - 10, Math.min(w, h) / 3.2)}" ${common}/>`,
    heart: `<path d="M ${cx} ${h - 18} C 18 ${h * 0.55}, 12 ${h * 0.22}, ${w * 0.34} 18 C ${w * 0.44} 18, ${cx} ${h * 0.3}, ${cx} ${h * 0.3} C ${cx} ${h * 0.3}, ${w * 0.56} 18, ${w * 0.66} 18 C ${w - 12} ${h * 0.22}, ${w - 18} ${h * 0.55}, ${cx} ${h - 18} Z" ${common}/>`,
    lightning: `<polygon points="${w * 0.58},8 ${w * 0.22},${h * 0.56} ${w * 0.48},${h * 0.56} ${w * 0.36},${h - 8} ${w * 0.78},${h * 0.42} ${w * 0.52},${h * 0.42}" ${common}/>`,
    sun: `<polygon points="${starPoints(12, cx, cy, Math.min(w, h) / 2 - 8, Math.min(w, h) / 2.9)}" ${common}/><circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) / 4}" ${common}/>`,
    moon: `<path d="M ${w * 0.68} 12 C ${w * 0.35} 22, ${w * 0.24} ${h * 0.72}, ${w * 0.62} ${h - 12} C ${w * 0.34} ${h - 8}, 12 ${h * 0.72}, 12 ${cy} C 12 ${h * 0.24}, ${w * 0.34} 8, ${w * 0.68} 12 Z" ${common}/>`,
    ribbon: `<polygon points="12,20 ${w - 12},20 ${w * 0.82},${cy} ${w - 12},${h - 20} 12,${h - 20} ${w * 0.18},${cy}" ${common}/><line x1="${w * 0.18}" y1="${cy}" x2="${w * 0.82}" y2="${cy}" stroke="${stroke}" stroke-width="${Math.max(1, strokeWidth - 1)}"/>`,
    scroll: `<path d="M 28 22 H ${w - 30} C ${w - 8} 22, ${w - 8} 54, ${w - 30} 54 H 28 C 8 54, 8 22, 28 22 Z M 28 54 H ${w - 28} V ${h - 22} H 28 C 8 ${h - 22}, 8 ${h - 54}, 28 ${h - 54}" ${common}/>`,
    "speech-bubble": `<path d="M 16 14 H ${w - 16} V ${h - 36} H ${w * 0.48} L ${w * 0.32} ${h - 12} V ${h - 36} H 16 Z" ${common}/>`,
    "thought-bubble": `<ellipse cx="${cx}" cy="${h * 0.42}" rx="${w * 0.42}" ry="${h * 0.3}" ${common}/><circle cx="${w * 0.32}" cy="${h - 36}" r="9" ${common}/><circle cx="${w * 0.22}" cy="${h - 18}" r="5" ${common}/>`,
    callout: `<path d="M 14 14 H ${w - 14} V ${h * 0.68} H ${w * 0.62} L ${w * 0.5} ${h - 12} L ${w * 0.48} ${h * 0.68} H 14 Z" ${common}/>`,
    "brace-pair": `<path d="M ${w * 0.38} 12 C ${w * 0.16} 12, ${w * 0.32} ${h * 0.42}, 14 ${cy} C ${w * 0.32} ${h * 0.58}, ${w * 0.16} ${h - 12}, ${w * 0.38} ${h - 12} M ${w * 0.62} 12 C ${w * 0.84} 12, ${w * 0.68} ${h * 0.42}, ${w - 14} ${cy} C ${w * 0.68} ${h * 0.58}, ${w * 0.84} ${h - 12}, ${w * 0.62} ${h - 12}" ${noFill} stroke-linecap="round"/>`,
    "bracket-pair": `<path d="M ${w * 0.38} 12 H 20 V ${h - 12} H ${w * 0.38} M ${w * 0.62} 12 H ${w - 20} V ${h - 12} H ${w * 0.62}" ${noFill} stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">${body[shape.kind]}</svg>`;
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseImageWidth(value: unknown) {
  if (typeof value !== "string") return IMAGE_DEFAULT_WIDTH;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? clampImageWidth(parsed)
    : IMAGE_DEFAULT_WIDTH;
}

function parseImagePosition(value: unknown) {
  if (typeof value !== "string") return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isShapeKind(value: unknown): value is ShapeKind {
  return (
    typeof value === "string" &&
    NOTE_SHAPES.some((shape) => shape.kind === value)
  );
}

function getShapeKindFromAttributes(
  attributes: Record<string, unknown>,
): ShapeKind | null {
  if (isShapeKind(attributes.shapeKind)) return attributes.shapeKind;

  const label =
    typeof attributes.alt === "string"
      ? attributes.alt
      : typeof attributes.title === "string"
        ? attributes.title
        : "";
  const matchingShape = NOTE_SHAPES.find(
    (shape) => shape.name.toLowerCase() === label.toLowerCase(),
  );

  return matchingShape?.kind ?? null;
}

function parseShapeNumber(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseShapeStrokeWidth(value: unknown) {
  return Math.min(16, Math.max(1, parseShapeNumber(value, SHAPE_DEFAULT_STROKE_WIDTH)));
}

function parseShapeRotation(value: unknown) {
  return parseShapeNumber(value, 0);
}

function getShapeSvgFromAttributes(attributes: Record<string, unknown>) {
  const shapeKind = getShapeKindFromAttributes(attributes);
  if (!shapeKind) return null;

  const shapeDefaults = NOTE_SHAPES.find((shape) => shape.kind === shapeKind);

  return shapeToSvg({
    kind: shapeKind,
    width: parseShapeNumber(attributes.shapeWidth, shapeDefaults?.width ?? 180),
    height: parseShapeNumber(attributes.shapeHeight, shapeDefaults?.height ?? 120),
    stroke:
      typeof attributes.shapeStroke === "string"
        ? attributes.shapeStroke
        : SHAPE_DEFAULT_STROKE,
    fill:
      typeof attributes.shapeFill === "string"
        ? attributes.shapeFill
        : SHAPE_DEFAULT_FILL,
    strokeWidth: parseShapeStrokeWidth(attributes.shapeStrokeWidth),
  });
}

function getImageSrcFromAttributes(attributes: Record<string, unknown>) {
  const shapeSvg = getShapeSvgFromAttributes(attributes);
  return shapeSvg
    ? svgToDataUrl(shapeSvg)
    : typeof attributes.src === "string"
      ? attributes.src
      : "";
}

function ResizableImageNode({
  editor,
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const width = parseImageWidth(node.attrs.width);
  const x = parseImagePosition(node.attrs.x);
  const y = parseImagePosition(node.attrs.y);
  const isPlaced = x !== null && y !== null;
  const shapeKind = getShapeKindFromAttributes(node.attrs);
  const isShape = Boolean(shapeKind);
  const shapeDefaults = NOTE_SHAPES.find((shape) => shape.kind === shapeKind);
  const rotation = parseShapeRotation(node.attrs.shapeRotation);
  const src = getImageSrcFromAttributes(node.attrs);
  const shapeFill =
    typeof node.attrs.shapeFill === "string"
      ? node.attrs.shapeFill
      : SHAPE_DEFAULT_FILL;
  const shapeStroke =
    typeof node.attrs.shapeStroke === "string"
      ? node.attrs.shapeStroke
      : SHAPE_DEFAULT_STROKE;
  const shapeStrokeWidth = parseShapeStrokeWidth(node.attrs.shapeStrokeWidth);

  function stopControlPointer(event: React.PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function updateShapeAttributes(attributes: Record<string, string>) {
    updateAttributes({
      ...(shapeKind ? { shapeKind } : null),
      ...(shapeDefaults
        ? {
            shapeWidth: String(shapeDefaults.width),
            shapeHeight: String(shapeDefaults.height),
          }
        : null),
      ...attributes,
    });
  }

  function startMove(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const image = imageRef.current;
    const editorElement = editor.view.dom;
    if (!image || !editorElement) return;

    const imageRect = image.getBoundingClientRect();
    const editorRect = editorElement.getBoundingClientRect();
    const pointerOffsetX = event.clientX - imageRect.left;
    const pointerOffsetY = event.clientY - imageRect.top;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextX = Math.max(
        0,
        Math.min(
          editorRect.width - imageRect.width,
          moveEvent.clientX - editorRect.left - pointerOffsetX,
        ),
      );
      const nextY = Math.max(
        0,
        moveEvent.clientY - editorRect.top - pointerOffsetY,
      );

      updateAttributes({
        x: `${Math.round(nextX)}px`,
        y: `${Math.round(nextY)}px`,
      });
    }

    function handlePointerUp() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function startRotate(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const image = imageRef.current;
    if (!image) return;

    const imageRect = image.getBoundingClientRect();
    const centerX = imageRect.left + imageRect.width / 2;
    const centerY = imageRect.top + imageRect.height / 2;

    function handlePointerMove(moveEvent: PointerEvent) {
      const angle =
        (Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) *
          180) /
          Math.PI +
        90;

      updateShapeAttributes({ shapeRotation: `${Math.round(angle)}` });
    }

    function handlePointerUp() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function startResize(
    side: "left" | "right",
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth =
      imageRef.current?.getBoundingClientRect().width ?? width;

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientX - startX;
      const nextWidth = clampImageWidth(
        side === "right" ? startWidth + delta : startWidth - delta,
      );

      updateAttributes({ width: `${Math.round(nextWidth)}px` });
    }

    function handlePointerUp() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "relative my-2 inline-block max-w-full align-top",
        selected && "ring-2 ring-primary ring-offset-2",
      )}
      style={{
        width,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center",
        ...(isPlaced
          ? {
              position: "absolute",
              left: x,
              top: y,
              zIndex: selected ? 20 : 1,
            }
          : null),
      }}
    >
      <img
        ref={imageRef}
        src={src}
        alt={node.attrs.alt ?? ""}
        title={node.attrs.title ?? undefined}
        draggable={false}
        className="block h-auto max-w-full rounded-md"
        style={{ width: "100%", margin: 0, cursor: "default" }}
      />
      {selected && (
        <>
          <button
            type="button"
            aria-label="Drag image"
            className="absolute inset-0 cursor-grab bg-transparent active:cursor-grabbing"
            onPointerDown={startMove}
          />
          <button
            type="button"
            aria-label="Resize image from left edge"
            className="absolute bottom-0 left-0 top-0 z-10 w-3 cursor-ew-resize bg-primary/10 transition-colors hover:bg-primary/25"
            onPointerDown={(event) => startResize("left", event)}
          />
          <button
            type="button"
            aria-label="Resize image from right edge"
            className="absolute bottom-0 right-0 top-0 z-10 w-3 cursor-ew-resize bg-primary/10 transition-colors hover:bg-primary/25"
            onPointerDown={(event) => startResize("right", event)}
          />
          {isShape && (
            <>
              <button
                type="button"
                aria-label="Rotate shape"
                title="Drag to rotate"
                className="absolute right-2 top-2 z-30 flex size-8 items-center justify-center rounded-full border border-primary/50 bg-background text-primary shadow-sm cursor-grab active:cursor-grabbing"
                onPointerDown={startRotate}
              >
                <RotateCw className="size-3.5" />
              </button>
              <div
                className="absolute bottom-2 left-2 right-2 z-30 flex flex-wrap items-center gap-2 rounded border border-border/70 bg-background/95 p-2 text-xs shadow-lg"
                onPointerDown={stopControlPointer}
              >
                <label className="flex items-center gap-1" title="Fill color">
                  <span>Fill</span>
                  <input
                    type="color"
                    value={shapeFill}
                    onChange={(event) =>
                      updateShapeAttributes({ shapeFill: event.target.value })
                    }
                    className="size-6 cursor-pointer rounded border border-border/50 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-1" title="Stroke color">
                  <span>Stroke</span>
                  <input
                    type="color"
                    value={shapeStroke}
                    onChange={(event) =>
                      updateShapeAttributes({ shapeStroke: event.target.value })
                    }
                    className="size-6 cursor-pointer rounded border border-border/50 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-1" title="Stroke size">
                  <span>Size</span>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={shapeStrokeWidth}
                    onChange={(event) =>
                      updateShapeAttributes({
                        shapeStrokeWidth: event.target.value,
                      })
                    }
                    className="h-1 w-20 accent-primary"
                  />
                  <span className="w-5 text-right">{shapeStrokeWidth}</span>
                </label>
                <label className="flex items-center gap-1" title="Rotation">
                  <RotateCw className="size-3.5" />
                  <input
                    type="number"
                    min="-360"
                    max="360"
                    value={Math.round(rotation)}
                    onChange={(event) =>
                      updateShapeAttributes({
                        shapeRotation: event.target.value || "0",
                      })
                    }
                    className="h-6 w-14 rounded border border-border/60 bg-background px-1 text-right text-xs outline-none focus:border-primary/40"
                  />
                </label>
              </div>
            </>
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("src"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          src: getImageSrcFromAttributes(attributes),
        }),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("width") || element.style.width || null,
        renderHTML: (attributes: {
          width?: string | null;
          shapeRotation?: string | null;
        }) => {
          if (!attributes.width) return {};
          const width = `${parseImageWidth(attributes.width)}px`;
          const rotation = parseShapeRotation(attributes.shapeRotation);
          return {
            width,
            style: `width: ${width}; height: auto;${rotation ? ` transform: rotate(${rotation}deg); transform-origin: center;` : ""}`,
          };
        },
      },
      x: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-x") || element.style.left || null,
        renderHTML: (attributes: { x?: string | null; y?: string | null }) => {
          if (!attributes.x || !attributes.y) return {};
          return { "data-x": attributes.x };
        },
      },
      y: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-y") || element.style.top || null,
        renderHTML: (attributes: {
          width?: string | null;
          x?: string | null;
          y?: string | null;
          shapeRotation?: string | null;
        }) => {
          if (!attributes.x || !attributes.y) return {};
          const rotation = parseShapeRotation(attributes.shapeRotation);
          return {
            "data-y": attributes.y,
            style: `position: absolute; left: ${attributes.x}; top: ${attributes.y}; width: ${parseImageWidth(attributes.width)}px; height: auto;${rotation ? ` transform: rotate(${rotation}deg); transform-origin: center;` : ""}`,
          };
        },
      },
      shapeKind: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-kind") || null,
        renderHTML: (attributes: { shapeKind?: string | null }) =>
          attributes.shapeKind ? { "data-shape-kind": attributes.shapeKind } : {},
      },
      shapeWidth: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-width") || null,
        renderHTML: (attributes: { shapeWidth?: string | number | null }) =>
          attributes.shapeWidth
            ? { "data-shape-width": String(attributes.shapeWidth) }
            : {},
      },
      shapeHeight: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-height") || null,
        renderHTML: (attributes: { shapeHeight?: string | number | null }) =>
          attributes.shapeHeight
            ? { "data-shape-height": String(attributes.shapeHeight) }
            : {},
      },
      shapeStroke: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-stroke") || null,
        renderHTML: (attributes: { shapeStroke?: string | null }) =>
          attributes.shapeStroke
            ? { "data-shape-stroke": attributes.shapeStroke }
            : {},
      },
      shapeFill: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-fill") || null,
        renderHTML: (attributes: { shapeFill?: string | null }) =>
          attributes.shapeFill ? { "data-shape-fill": attributes.shapeFill } : {},
      },
      shapeStrokeWidth: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-stroke-width") || null,
        renderHTML: (attributes: {
          shapeStrokeWidth?: string | number | null;
        }) =>
          attributes.shapeStrokeWidth
            ? { "data-shape-stroke-width": String(attributes.shapeStrokeWidth) }
            : {},
      },
      shapeRotation: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-shape-rotation") || null,
        renderHTML: (attributes: {
          shapeRotation?: string | number | null;
        }) =>
          attributes.shapeRotation
            ? { "data-shape-rotation": String(attributes.shapeRotation) }
            : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNode);
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  editable?: boolean;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write something...",
  className,
  contentClassName,
  editable = true,
  minHeight = "120px",
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [, setSelectionVersion] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "note-data-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontSize.configure({ types: ["textStyle"] }),
      FontFamily.configure({ types: ["textStyle"] }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: () => {
      setSelectionVersion((version) => version + 1);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap relative text-sm text-foreground focus:outline-none leading-relaxed",
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed || editor.getHTML() === content) {
        return;
      }

      editor.commands.setContent(content, false);
    });

    return () => {
      cancelled = true;
    };
  }, [content, editor]);

  if (!editor) return null;

  if (!editable) {
    return (
      <EditorContent
        editor={editor}
        className={cn("rich-text-readonly", className)}
      />
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads/note-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      editor
        .chain()
        .focus()
        .setImage({
          src: data.url,
          alt: file.name,
          width: `${IMAGE_DEFAULT_WIDTH}px`,
        } as {
          src: string;
          alt?: string;
          title?: string;
        })
        .run();
    } catch {
      // Silently fail - user can retry
    }
  };

  const insertShape = (shape: (typeof NOTE_SHAPES)[number]) => {
    editor
      .chain()
      .focus()
      .setImage({
        src: svgToDataUrl(
          shapeToSvg({
            ...shape,
            stroke: SHAPE_DEFAULT_STROKE,
            fill: SHAPE_DEFAULT_FILL,
            strokeWidth: SHAPE_DEFAULT_STROKE_WIDTH,
          }),
        ),
        alt: shape.name,
        title: shape.name,
        width: `${Math.min(SHAPE_DEFAULT_WIDTH, shape.width)}px`,
        shapeKind: shape.kind,
        shapeWidth: String(shape.width),
        shapeHeight: String(shape.height),
        shapeStroke: SHAPE_DEFAULT_STROKE,
        shapeFill: SHAPE_DEFAULT_FILL,
        shapeStrokeWidth: String(SHAPE_DEFAULT_STROKE_WIDTH),
        shapeRotation: "0",
      } as {
        src: string;
        alt?: string;
        title?: string;
      })
      .run();
  };

  const getSignaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const point = getSignaturePoint(event);
    if (!canvas || !point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.strokeStyle = "#111827";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsSigning(true);
    setHasSignature(true);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = signatureCanvasRef.current;
    const point = getSignaturePoint(event);
    if (!canvas || !point) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopSignature = () => {
    setIsSigning(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const insertSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !hasSignature) return;

    editor
      .chain()
      .focus()
      .setImage({
        src: canvas.toDataURL("image/png"),
        alt: "Signature",
        title: "Signature",
        width: `${SIGNATURE_DEFAULT_WIDTH}px`,
      } as {
        src: string;
        alt?: string;
        title?: string;
      })
      .run();
    clearSignature();
  };

  const currentFontSize = editor.getAttributes("textStyle").fontSize as
    | string
    | undefined;
  const currentFontFamily = editor.getAttributes("textStyle").fontFamily as
    | string
    | undefined;
  const selectedImageAttributes = editor.isActive("image")
    ? (editor.getAttributes("image") as Record<string, unknown>)
    : {};
  const selectedShapeKind = getShapeKindFromAttributes(selectedImageAttributes);
  const selectedShapeDefaults = NOTE_SHAPES.find(
    (shape) => shape.kind === selectedShapeKind,
  );
  const hasSelectedShape = Boolean(selectedShapeKind);
  const selectedShapeStroke =
    typeof selectedImageAttributes.shapeStroke === "string"
      ? selectedImageAttributes.shapeStroke
      : SHAPE_DEFAULT_STROKE;
  const selectedShapeFill =
    typeof selectedImageAttributes.shapeFill === "string"
      ? selectedImageAttributes.shapeFill
      : SHAPE_DEFAULT_FILL;
  const selectedShapeStrokeWidth = parseShapeStrokeWidth(
    selectedImageAttributes.shapeStrokeWidth,
  );
  const selectedShapeRotation = parseShapeRotation(
    selectedImageAttributes.shapeRotation,
  );
  const normalizedSymbolSearch = symbolSearch.trim().toLowerCase();
  const filteredSymbols = normalizedSymbolSearch
    ? NOTE_SYMBOLS.filter(
        (item) =>
          item.symbol.includes(symbolSearch.trim()) ||
          item.label.includes(normalizedSymbolSearch),
      )
    : NOTE_SYMBOLS;

  const updateSelectedShape = (attributes: Record<string, string>) => {
    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        ...(selectedShapeKind ? { shapeKind: selectedShapeKind } : null),
        ...(selectedShapeDefaults
          ? {
              shapeWidth: String(selectedShapeDefaults.width),
              shapeHeight: String(selectedShapeDefaults.height),
            }
          : null),
        ...attributes,
      })
      .run();
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded border border-border/50 bg-secondary/20 transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/5",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border/40 bg-secondary/30 px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </ToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Text Color"
              className={cn(
                "flex h-7 items-center gap-0.5 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Palette className="size-3.5" />
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-2 w-48">
            <div className="grid grid-cols-6 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  title={color.name}
                  onClick={() => {
                    if (color.value) {
                      editor.chain().focus().setColor(color.value).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                  }}
                  className={cn(
                    "size-6 rounded border transition-all hover:scale-110",
                    color.value
                      ? "border-border/50"
                      : "border-dashed border-border bg-background",
                    editor.isActive("textStyle", { color: color.value }) &&
                      "ring-2 ring-primary ring-offset-1",
                  )}
                  style={
                    color.value ? { backgroundColor: color.value } : undefined
                  }
                >
                  {!color.value && (
                    <span className="flex items-center justify-center text-[10px] text-muted-foreground">
                      A
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="color"
                  className="size-6 rounded border border-border/50 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
                  onChange={(e) => {
                    editor.chain().focus().setColor(e.target.value).run();
                  }}
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Custom color
                </span>
              </label>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Font size"
              className={cn(
                "flex h-7 items-center gap-1 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <ALargeSmall className="size-3.5" />
              <span className="text-xs">
                {FONT_SIZES.find((size) => size.value === currentFontSize)
                  ?.name ?? "Size"}
              </span>
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36 p-1">
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() =>
                  editor.chain().focus().setFontSize(size.value).run()
                }
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary",
                  currentFontSize === size.value && "bg-secondary text-primary",
                )}
              >
                <span>{size.name}</span>
                <span className="text-muted-foreground">{size.value}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                editor.chain().focus().unsetFontSize().run()
              }
              className="mt-1 flex w-full rounded border-t border-border/50 px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Default size
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Font family"
              className={cn(
                "flex h-7 items-center gap-1 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Type className="size-3.5" />
              <span className="max-w-20 truncate text-xs">
                {FONT_FAMILIES.find(
                  (family) => family.value === (currentFontFamily ?? ""),
                )?.name ?? "Font"}
              </span>
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 p-1">
            {FONT_FAMILIES.map((family) => (
              <button
                key={family.name}
                type="button"
                onClick={() =>
                  family.value
                    ? editor.chain().focus().setFontFamily(family.value).run()
                    : editor.chain().focus().unsetFontFamily().run()
                }
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary",
                  (currentFontFamily ?? "") === family.value &&
                    "bg-secondary text-primary",
                )}
                style={family.value ? { fontFamily: family.value } : undefined}
              >
                {family.name}
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Insert symbol"
              className={cn(
                "flex h-7 items-center gap-0.5 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Sigma className="size-3.5" />
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-2">
            <input
              type="search"
              value={symbolSearch}
              onChange={(event) => setSymbolSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search symbols"
              className="mb-2 h-8 w-full rounded border border-border/60 bg-background px-2 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
            />
            <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto pr-1">
              {filteredSymbols.map((item) => (
                <button
                  key={`${item.symbol}-${item.label}`}
                  type="button"
                  title={item.label}
                  onClick={() =>
                    editor.chain().focus().insertContent(item.symbol).run()
                  }
                  className="flex size-8 items-center justify-center rounded text-base transition-colors hover:bg-secondary hover:text-primary"
                >
                  {item.symbol}
                </button>
              ))}
            </div>
            {filteredSymbols.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No symbols found
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          title="Heading 1"
        >
          <Heading1 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          <Heading3 className="size-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => imageInputRef.current?.click()}
          title="Insert Image"
        >
          <ImagePlus className="size-3.5" />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Insert data table"
              className={cn(
                "flex h-7 items-center gap-0.5 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
                editor.isActive("table") && "bg-primary/15 text-primary",
              )}
            >
              <Table2 className="size-3.5" />
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1">
            <button
              type="button"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
            >
              <Table2 className="size-3.5" />
              Insert 3 x 3 table
            </button>
            {editor.isActive("table") && (
              <>
                <div className="my-1 h-px bg-border/60" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                >
                  <Rows3 className="size-3.5" />
                  Add row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                >
                  <Rows3 className="size-3.5" />
                  Delete row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                >
                  <Columns3 className="size-3.5" />
                  Add column
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                >
                  <Columns3 className="size-3.5" />
                  Delete column
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                >
                  <Table2 className="size-3.5" />
                  Toggle header row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  Delete table
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Insert shape or line"
              className={cn(
                "flex h-7 items-center gap-0.5 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Shapes className="size-3.5" />
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-96 p-2">
            <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
              {NOTE_SHAPES.map((shape) => (
                <button
                  key={shape.name}
                  type="button"
                  onClick={() => insertShape(shape)}
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded border border-border/50 bg-background text-xs transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <ShapePreview shape={shape} />
                  <span className="max-w-full truncate px-1 text-muted-foreground">
                    {shape.name}
                  </span>
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasSelectedShape && (
          <>
            <ToolbarDivider />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Shape fill color"
                  className="flex h-7 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <span
                    className="size-3.5 rounded border border-border"
                    style={{ backgroundColor: selectedShapeFill }}
                  />
                  Fill
                  <ChevronDown className="size-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {SHAPE_COLORS.map((color) => (
                    <button
                      key={`fill-${color}`}
                      type="button"
                      title={color}
                      onClick={() => updateSelectedShape({ shapeFill: color })}
                      className={cn(
                        "size-6 rounded border border-border/60 transition-transform hover:scale-110",
                        selectedShapeFill === color &&
                          "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  <input
                    type="color"
                    value={selectedShapeFill}
                    onChange={(event) =>
                      updateSelectedShape({ shapeFill: event.target.value })
                    }
                    className="size-6 cursor-pointer rounded border border-border/50 bg-transparent p-0"
                  />
                  Custom fill
                </label>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Shape stroke color"
                  className="flex h-7 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <span
                    className="h-1 w-4 rounded-full"
                    style={{ backgroundColor: selectedShapeStroke }}
                  />
                  Stroke
                  <ChevronDown className="size-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {SHAPE_COLORS.map((color) => (
                    <button
                      key={`stroke-${color}`}
                      type="button"
                      title={color}
                      onClick={() =>
                        updateSelectedShape({ shapeStroke: color })
                      }
                      className={cn(
                        "size-6 rounded border border-border/60 transition-transform hover:scale-110",
                        selectedShapeStroke === color &&
                          "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  <input
                    type="color"
                    value={selectedShapeStroke}
                    onChange={(event) =>
                      updateSelectedShape({ shapeStroke: event.target.value })
                    }
                    className="size-6 cursor-pointer rounded border border-border/50 bg-transparent p-0"
                  />
                  Custom stroke
                </label>
              </DropdownMenuContent>
            </DropdownMenu>

            <label
              className="flex h-7 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground"
              title="Shape stroke size"
            >
              <span>Size</span>
              <input
                type="range"
                min="1"
                max="16"
                value={selectedShapeStrokeWidth}
                onChange={(event) =>
                  updateSelectedShape({
                    shapeStrokeWidth: event.target.value,
                  })
                }
                className="h-1 w-20 accent-primary"
              />
              <span className="w-5 text-right">{selectedShapeStrokeWidth}</span>
            </label>

            <label
              className="flex h-7 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground"
              title="Rotate shape"
            >
              <RotateCw className="size-3.5" />
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedShapeRotation}
                onChange={(event) =>
                  updateSelectedShape({
                    shapeRotation: event.target.value,
                  })
                }
                className="h-1 w-24 accent-primary"
              />
              <input
                type="number"
                min="-360"
                max="360"
                value={Math.round(selectedShapeRotation)}
                onChange={(event) =>
                  updateSelectedShape({
                    shapeRotation: event.target.value || "0",
                  })
                }
                className="h-6 w-14 rounded border border-border/60 bg-background px-1 text-right text-xs outline-none focus:border-primary/40"
              />
            </label>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Insert signature"
              className={cn(
                "flex h-7 items-center gap-0.5 rounded px-1.5 transition-colors",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <PenLine className="size-3.5" />
              <ChevronDown className="size-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-3">
            <canvas
              ref={signatureCanvasRef}
              width={560}
              height={180}
              className="h-28 w-full touch-none rounded border border-border/60 bg-background"
              onPointerDown={startSignature}
              onPointerMove={drawSignature}
              onPointerUp={stopSignature}
              onPointerCancel={stopSignature}
              onPointerLeave={stopSignature}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="flex h-8 items-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Eraser className="size-3.5" />
                Clear
              </button>
              <button
                type="button"
                onClick={insertSignature}
                disabled={!hasSignature}
                className={cn(
                  "h-8 rounded bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity",
                  !hasSignature && "cursor-not-allowed opacity-40",
                )}
              >
                Insert signature
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="size-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-3",
          contentClassName,
        )}
      />
    </div>
  );
}

function ShapePreview({
  shape,
}: {
  shape: (typeof NOTE_SHAPES)[number];
}) {
  return (
    <span
      className="flex h-7 w-16 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
      dangerouslySetInnerHTML={{
        __html: shapeToSvg({
          ...shape,
          width: shape.kind.includes("arrow") || shape.kind === "line" ? 90 : 56,
          height: shape.kind.includes("arrow") || shape.kind === "line" ? 28 : 42,
        }),
      }}
    />
  );
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex size-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        disabled && "opacity-30 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-border/50" />;
}
