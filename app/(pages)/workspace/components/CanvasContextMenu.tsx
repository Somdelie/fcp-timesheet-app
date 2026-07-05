"use client";

import {
  Accessibility,
  Clipboard,
  Component,
  Copy,
  Link as LinkIcon,
  Lock,
  MessageCirclePlus,
  PaintRoller,
  Trash2,
  Unlock,
} from "lucide-react";
import { type ReactNode } from "react";
import { type EditorObject } from "../store/editorStore";

export function CanvasContextMenu({
  open,
  x,
  y,
  hasSelection,
  selectedObject,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onToggleLock,
}: {
  open: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  selectedObject: EditorObject | null;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
}) {
  if (!open) return null;

  const runAction = (action?: () => void) => {
    action?.();
    onClose();
  };

  return (
    <div
      className="absolute z-[90] w-64 overflow-hidden rounded-2xl bg-white py-2 text-sm text-slate-800 shadow-[0_22px_54px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ContextMenuAction
        label="Copy"
        shortcut="Ctrl+C"
        disabled={!hasSelection}
        onClick={() => runAction(onCopy)}
      >
        <Copy size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Copy style"
        shortcut="Ctrl+Alt+C"
        disabled={!hasSelection}
        onClick={() => runAction()}
      >
        <PaintRoller size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Paste"
        shortcut="Ctrl+V"
        onClick={() => runAction(onPaste)}
      >
        <Clipboard size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Duplicate"
        shortcut="Ctrl+D"
        disabled={!hasSelection}
        onClick={() => runAction(onDuplicate)}
      >
        <Copy size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Delete"
        shortcut="DELETE"
        disabled={!hasSelection}
        onClick={() => runAction(onDelete)}
      >
        <Trash2 size={18} strokeWidth={2.1} />
      </ContextMenuAction>

      <div className="my-1 border-t border-slate-100" />

      <ContextMenuAction
        label="Create component"
        shortcut="Ctrl+Alt+K"
        disabled={!hasSelection}
        onClick={() => runAction()}
      >
        <Component size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Comment"
        shortcut="Ctrl+Alt+N"
        disabled={!hasSelection}
        onClick={() => runAction()}
      >
        <MessageCirclePlus size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label={selectedObject?.locked ? "Unlock" : "Lock"}
        chevron
        disabled={!hasSelection}
        onClick={() => runAction(onToggleLock)}
      >
        {selectedObject?.locked ? (
          <Unlock size={18} strokeWidth={2.1} />
        ) : (
          <Lock size={18} strokeWidth={2.1} />
        )}
      </ContextMenuAction>
      <ContextMenuAction
        label="Link"
        shortcut="Ctrl+K"
        disabled={!hasSelection}
        onClick={() => runAction()}
      >
        <LinkIcon size={18} strokeWidth={2.1} />
      </ContextMenuAction>
      <ContextMenuAction
        label="Alternative text"
        disabled={!hasSelection}
        onClick={() => runAction()}
      >
        <Accessibility size={18} strokeWidth={2.1} />
      </ContextMenuAction>

      <div className="my-1 border-t border-slate-100" />

      <ContextMenuAction label="Disable Quick Flow" onClick={() => runAction()}>
        <QuickFlowIcon />
      </ContextMenuAction>
    </div>
  );
}

function ContextMenuAction({
  label,
  shortcut,
  chevron = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  chevron?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-5 w-5 place-items-center text-slate-950">
        {children}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
          {shortcut}
        </span>
      ) : null}
      {chevron ? (
        <span className="text-xl leading-none text-slate-950">&gt;</span>
      ) : null}
    </button>
  );
}

function QuickFlowIcon() {
  return (
    <span className="relative h-5 w-5">
      <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full border-2 border-current" />
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border-2 border-current" />
      <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full border-2 border-current" />
      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full border-2 border-current" />
      <span className="absolute left-[9px] top-[5px] h-3 w-[2px] bg-current" />
      <span className="absolute left-[5px] top-[9px] h-[2px] w-3 bg-current" />
    </span>
  );
}
