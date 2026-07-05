"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CopyPlus,
  Lock,
  MessageCirclePlus,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useState,
} from "react";
import { type EditorObject } from "../store/editorStore";

export type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
  rotation: number;
};

export function SelectionOverlay({
  object,
  box,
  selectedCount,
  stageSize,
  onComment,
  onDuplicate,
  onDelete,
  onToggleLock,
  onFlow,
  onRotate,
  onOpenContextMenu,
}: {
  object: EditorObject | null;
  box: SelectionBox | null;
  selectedCount: number;
  stageSize: { width: number; height: number };
  onComment?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onFlow: (direction: FlowDirection) => void;
  onRotate: (rotation: number) => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const [rotating, setRotating] = useState(false);

  if (!box) return null;
  const isMultiSelection = selectedCount > 1;

  return (
    <>
      <SelectionBorder box={box} showHandles={!rotating} />
      {!rotating && object ? (
        <SelectionQuickActions
          object={object}
          box={box}
          stageSize={stageSize}
          onComment={onComment}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleLock={onToggleLock}
          onOpenContextMenu={onOpenContextMenu}
        />
      ) : null}
      {!rotating && isMultiSelection ? (
        <MultiSelectionQuickActions
          box={box}
          stageSize={stageSize}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleLock={onToggleLock}
          onOpenContextMenu={onOpenContextMenu}
        />
      ) : null}
      {object ? (
        <SelectionNudgeControls
          object={object}
          box={box}
          rotating={rotating}
          onRotatingChange={setRotating}
          onFlow={onFlow}
          onRotate={onRotate}
        />
      ) : null}
    </>
  );
}

function SelectionBorder({
  box,
  showHandles,
}: {
  box: SelectionBox;
  showHandles: boolean;
}) {
  const violet = "#7c5cff";
  const corner =
    "absolute h-[11px] w-[11px] rounded-full border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]";
  const pill =
    "absolute rounded-full border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]";

  return (
    <div
      className="pointer-events-none absolute z-[54]"
      style={{
        left: box.centerX,
        top: box.centerY,
        width: box.width,
        height: box.height,
        transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
        transformOrigin: "center",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ border: `1.5px solid ${violet}` }}
      />

      {showHandles ? (
        <>
          <span
            className={`${corner} -left-[5.5px] -top-[5.5px]`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${corner} -right-[5.5px] -top-[5.5px]`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${corner} -bottom-[5.5px] -left-[5.5px]`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${corner} -bottom-[5.5px] -right-[5.5px]`}
            style={{ borderColor: violet }}
          />

          <span
            className={`${pill} left-1/2 top-[-3px] h-[6px] w-[22px] -translate-x-1/2`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${pill} bottom-[-3px] left-1/2 h-[6px] w-[22px] -translate-x-1/2`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${pill} left-[-3px] top-1/2 h-[22px] w-[6px] -translate-y-1/2`}
            style={{ borderColor: violet }}
          />
          <span
            className={`${pill} right-[-3px] top-1/2 h-[22px] w-[6px] -translate-y-1/2`}
            style={{ borderColor: violet }}
          />
        </>
      ) : null}
    </div>
  );
}

function SelectionQuickActions({
  object,
  box,
  stageSize,
  onComment,
  onDuplicate,
  onDelete,
  onToggleLock,
  onOpenContextMenu,
}: {
  object: EditorObject;
  box: SelectionBox;
  stageSize: { width: number; height: number };
  onComment?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const toolbarWidth = 190;
  const toolbarPoint = getRotatedPoint(
    box.centerX,
    box.top - 40,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const left = Math.min(
    Math.max(toolbarPoint.x - toolbarWidth / 2, 12),
    Math.max(12, stageSize.width - toolbarWidth - 12),
  );
  const top = Math.max(12, toolbarPoint.y - 20);

  return (
    <div className="absolute z-[60]" style={{ left, top }}>
      <div className="flex h-10 items-center gap-1 rounded-full bg-white px-2 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
        <OverlayIconButton label="Comment" onClick={onComment}>
          <MessageCirclePlus size={18} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton
          label={object.locked ? "Unlock" : "Lock"}
          onClick={onToggleLock}
        >
          {object.locked ? (
            <Unlock size={17} strokeWidth={2} />
          ) : (
            <Lock size={17} strokeWidth={2} />
          )}
        </OverlayIconButton>
        <OverlayIconButton label="Duplicate" onClick={onDuplicate}>
          <CopyPlus size={17} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton label="Delete" onClick={onDelete}>
          <Trash2 size={17} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton label="More" onClick={onOpenContextMenu}>
          <MoreHorizontal size={19} strokeWidth={2.4} />
        </OverlayIconButton>
      </div>
    </div>
  );
}

function MultiSelectionQuickActions({
  box,
  stageSize,
  onDuplicate,
  onDelete,
  onToggleLock,
  onOpenContextMenu,
}: {
  box: SelectionBox;
  stageSize: { width: number; height: number };
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const toolbarWidth = 188;
  const left = Math.min(
    Math.max(box.centerX - toolbarWidth / 2, 12),
    Math.max(12, stageSize.width - toolbarWidth - 12),
  );
  const top = Math.max(12, box.top - 52);

  return (
    <div className="absolute z-[60]" style={{ left, top }}>
      <div className="flex h-10 items-center gap-1 rounded-full bg-white px-3 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
        <button
          type="button"
          className="h-7 rounded-full px-2 text-sm font-bold transition hover:bg-slate-100"
        >
          Group
        </button>
        <OverlayIconButton label="Lock" onClick={onToggleLock}>
          <Lock size={17} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton label="Duplicate" onClick={onDuplicate}>
          <CopyPlus size={17} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton label="Delete" onClick={onDelete}>
          <Trash2 size={17} strokeWidth={2} />
        </OverlayIconButton>
        <OverlayIconButton label="More" onClick={onOpenContextMenu}>
          <MoreHorizontal size={19} strokeWidth={2.4} />
        </OverlayIconButton>
      </div>
    </div>
  );
}

function SelectionNudgeControls({
  object,
  box,
  rotating,
  onRotatingChange,
  onFlow,
  onRotate,
}: {
  object: EditorObject;
  box: SelectionBox;
  rotating: boolean;
  onRotatingChange: (rotating: boolean) => void;
  onFlow: (direction: FlowDirection) => void;
  onRotate: (rotation: number) => void;
}) {
  const centerOffset = 13;
  const sideGap = 16;
  const verticalGap = 15;
  const topPoint = getRotatedPoint(
    box.centerX,
    box.top - 29,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const leftPoint = getRotatedPoint(
    box.left - sideGap - 13,
    box.centerY,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const rightPoint = getRotatedPoint(
    box.right + sideGap + 13,
    box.centerY,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const bottomPoint = getRotatedPoint(
    box.centerX,
    box.bottom + verticalGap + 13,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const rotatePoint = getRotatedPoint(
    box.centerX,
    box.bottom + 67,
    box.centerX,
    box.centerY,
    box.rotation,
  );
  const getAngle = (clientX: number, clientY: number, hostRect: DOMRect) =>
    (Math.atan2(
      clientY - (hostRect.top + box.centerY),
      clientX - (hostRect.left + box.centerX),
    ) *
      180) /
    Math.PI;

  const handleRotatePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (object.locked) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const host = event.currentTarget.parentElement;
    const hostRect = host?.getBoundingClientRect();
    if (!hostRect) return;

    onRotatingChange(true);

    const startAngle = getAngle(event.clientX, event.clientY, hostRect);
    const startRotation = object.rotation ?? 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();

      const nextAngle = getAngle(moveEvent.clientX, moveEvent.clientY, hostRect);
      const nextRotation = startRotation + nextAngle - startAngle;
      onRotate(((nextRotation % 360) + 360) % 360);
    };

    const handlePointerUp = () => {
      onRotatingChange(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  return (
    <>
      {!rotating ? (
        <>
          <RoundControlButton
            label="Quick flow up"
            onClick={() => onFlow("up")}
            style={{
              left: topPoint.x - centerOffset,
              top: topPoint.y - centerOffset,
            }}
          >
            <ArrowUp size={15} strokeWidth={2.1} />
          </RoundControlButton>
          <RoundControlButton
            label="Quick flow left"
            onClick={() => onFlow("left")}
            style={{
              left: leftPoint.x - centerOffset,
              top: leftPoint.y - centerOffset,
            }}
          >
            <ArrowLeft size={15} strokeWidth={2.1} />
          </RoundControlButton>
          <RoundControlButton
            label="Quick flow right"
            onClick={() => onFlow("right")}
            style={{
              left: rightPoint.x - centerOffset,
              top: rightPoint.y - centerOffset,
            }}
          >
            <ArrowRight size={15} strokeWidth={2.1} />
          </RoundControlButton>
          <RoundControlButton
            label="Quick flow down"
            onClick={() => onFlow("down")}
            style={{
              left: bottomPoint.x - centerOffset,
              top: bottomPoint.y - centerOffset,
            }}
          >
            <ArrowDown size={15} strokeWidth={2.1} />
          </RoundControlButton>
          <RoundControlButton
            label="Rotate"
            onPointerDown={handleRotatePointerDown}
            style={{
              left: rotatePoint.x - centerOffset,
              top: rotatePoint.y - centerOffset,
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <RotateCcw size={15} strokeWidth={2} />
          </RoundControlButton>
        </>
      ) : null}
    </>
  );
}

type FlowDirection = "up" | "right" | "down" | "left";

function getRotatedPoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  rotation: number,
) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - centerX;
  const dy = y - centerY;

  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
}

function OverlayIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function RoundControlButton({
  label,
  style,
  onClick,
  onPointerDown,
  className = "",
  children,
}: {
  label: string;
  style: CSSProperties;
  onClick?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`pointer-events-auto absolute z-[59] grid h-[26px] w-[26px] place-items-center rounded-full bg-white text-slate-900 shadow-[0_5px_16px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 transition hover:bg-slate-50 ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
