"use client";

import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva";
import {
  type CircleEditorObject,
  type EditorObject,
  type ImageEditorObject,
  type LineEditorObject,
  type RectEditorObject,
  type TextEditorObject,
  useEditorStore,
} from "../store/editorStore";

export function CanvasObject({
  object,
  onSelect,
  onContextMenu,
  onChange,
}: {
  object: EditorObject;
  onSelect: (additive: boolean) => void;
  onContextMenu: (event: MouseEvent) => void;
  onChange: (patch: Partial<EditorObject>) => void;
}) {
  const size = getObjectSize(object);
  const usesCenteredOrigin = object.kind !== "line";
  const sharedProps = {
    id: object.id,
    x: usesCenteredOrigin ? object.x + size.width / 2 : object.x,
    y: usesCenteredOrigin ? object.y + size.height / 2 : object.y,
    rotation: object.rotation ?? 0,
    opacity: object.opacity ?? 1,
    draggable: !object.locked,
    visible: !object.hidden,
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOpacity: 0,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      onSelect(event.evt.shiftKey);
    },
    onTap: (event: Konva.KonvaEventObject<TouchEvent>) => {
      event.cancelBubble = true;
      onSelect(false);
    },
    onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      onContextMenu(event.evt);
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      const node = event.target;

      onChange({
        x: usesCenteredOrigin ? node.x() - size.width / 2 : node.x(),
        y: usesCenteredOrigin ? node.y() - size.height / 2 : node.y(),
      } as Partial<EditorObject>);
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      if (object.kind === "line") {
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        } as Partial<EditorObject>);
        return;
      }

      const widthObject = object as
        | RectEditorObject
        | CircleEditorObject
        | ImageEditorObject
        | TextEditorObject;
      const nextWidth = Math.max(12, widthObject.width * scaleX);
      const nextHeight =
        "height" in widthObject
          ? Math.max(12, widthObject.height * scaleY)
          : size.height;

      onChange({
        x: node.x() - nextWidth / 2,
        y: node.y() - nextHeight / 2,
        rotation: node.rotation(),
        width: nextWidth,
        height: "height" in widthObject ? nextHeight : undefined,
      } as Partial<EditorObject>);
    },
  };

  if (object.kind === "rect") {
    return <CanvasRect object={object} sharedProps={sharedProps} />;
  }

  if (object.kind === "circle") {
    return <CanvasCircle object={object} sharedProps={sharedProps} />;
  }

  if (object.kind === "line") {
    return <CanvasLine object={object} sharedProps={sharedProps} />;
  }

  if (object.kind === "image") {
    return <CanvasImage object={object} sharedProps={sharedProps} />;
  }

  return <CanvasText object={object} sharedProps={sharedProps} />;
}

function CanvasRect({
  object,
  sharedProps,
}: {
  object: RectEditorObject;
  sharedProps: Record<string, unknown>;
}) {
  return (
    <Rect
      {...sharedProps}
      offsetX={object.width / 2}
      offsetY={object.height / 2}
      width={object.width}
      height={object.height}
      fill={object.fill}
      stroke={object.stroke}
      strokeWidth={object.strokeWidth}
      cornerRadius={object.cornerRadius ?? 0}
    />
  );
}

function CanvasCircle({
  object,
  sharedProps,
}: {
  object: CircleEditorObject;
  sharedProps: Record<string, unknown>;
}) {
  return (
    <Circle
      {...sharedProps}
      radius={Math.min(object.width, object.height) / 2}
      scaleX={object.width / Math.min(object.width, object.height)}
      scaleY={object.height / Math.min(object.width, object.height)}
      fill={object.fill}
      stroke={object.stroke}
      strokeWidth={object.strokeWidth}
    />
  );
}

function CanvasLine({
  object,
  sharedProps,
}: {
  object: LineEditorObject;
  sharedProps: Record<string, unknown>;
}) {
  return (
    <Line
      {...sharedProps}
      points={object.points}
      stroke={object.stroke}
      strokeWidth={object.strokeWidth}
      lineCap="round"
      lineJoin="round"
    />
  );
}

function CanvasText({
  object,
  sharedProps,
}: {
  object: TextEditorObject;
  sharedProps: Record<string, unknown>;
}) {
  const setEditingTextId = useEditorStore((state) => state.setEditingTextId);

  const handleDoubleClick = () => {
    setEditingTextId(object.id);
  };

  return (
    <Text
      {...sharedProps}
      offsetX={object.width / 2}
      offsetY={(object.fontSize * 1.4) / 2}
      text={object.text}
      width={object.width}
      fill={object.fill}
      fontSize={object.fontSize}
      fontFamily={object.fontFamily}
      fontStyle={object.fontStyle}
      textDecoration={object.textDecoration}
      align={object.align ?? "left"}
      onDblClick={handleDoubleClick}
    />
  );
}

function CanvasImage({
  object,
  sharedProps,
}: {
  object: ImageEditorObject;
  sharedProps: Record<string, unknown>;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const nextImage = new window.Image();
    nextImage.onload = () => {
      if (!disposed) setImage(nextImage);
    };

    if (object.src.endsWith(".svg")) {
      fetch(object.src)
        .then((response) => response.text())
        .then((svg) => {
          if (disposed) return;

          const isLineAsset = object.src.includes("/lines-pack/");
          const fill = isLineAsset ? "none" : (object.fill ?? "transparent");
          const stroke = object.stroke ?? object.fill ?? "#0f172a";
          const strokeWidth = object.strokeWidth ?? 1.5;
          let tintedSvg = cropSvgToDrawnBounds(
            svg.replaceAll("currentColor", stroke),
            object.src.includes("/shapes/") ? strokeWidth : null,
          );

          tintedSvg = tintedSvg.replace(
            /<svg([^>]*)\sfill=(["'])[^"']*\2/,
            `<svg$1 fill="${fill}"`,
          );

          if (!/<svg[^>]*\sfill=/.test(tintedSvg)) {
            tintedSvg = tintedSvg.replace("<svg ", `<svg fill="${fill}" `);
          }

          if (tintedSvg.includes("stroke-width")) {
            tintedSvg = tintedSvg.replace(
              /stroke-width=(["'])[^"']*\1/g,
              `stroke-width="${strokeWidth}"`,
            );
          } else {
            tintedSvg = tintedSvg.replace(
              "<svg ",
              `<svg stroke-width="${strokeWidth}" `,
            );
          }

          nextImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            tintedSvg,
          )}`;
        })
        .catch(() => {
          nextImage.src = object.src;
        });
    } else {
      nextImage.src = object.src;
    }

    return () => {
      disposed = true;
      nextImage.onload = null;
    };
  }, [object.fill, object.src, object.stroke, object.strokeWidth]);

  return (
    <KonvaImage
      {...sharedProps}
      offsetX={object.width / 2}
      offsetY={object.height / 2}
      image={image ?? undefined}
      width={object.width}
      height={object.height}
    />
  );
}

function cropSvgToDrawnBounds(svg: string, strokeWidth: number | null) {
  if (strokeWidth === null) return svg;

  const viewBoxMatch = svg.match(/viewBox=(["'])([^"']+)\1/);
  if (!viewBoxMatch) return svg;

  const points: Array<{ x: number; y: number }> = [];
  const addPoint = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  };

  for (const match of svg.matchAll(/<rect\b[^>]*>/g)) {
    const tag = match[0];
    const x = getSvgNumber(tag, "x") ?? 0;
    const y = getSvgNumber(tag, "y") ?? 0;
    const width = getSvgNumber(tag, "width");
    const height = getSvgNumber(tag, "height");

    if (width !== null && height !== null) {
      addPoint(x, y);
      addPoint(x + width, y + height);
    }
  }

  for (const match of svg.matchAll(/<circle\b[^>]*>/g)) {
    const tag = match[0];
    const cx = getSvgNumber(tag, "cx");
    const cy = getSvgNumber(tag, "cy");
    const r = getSvgNumber(tag, "r");

    if (cx !== null && cy !== null && r !== null) {
      addPoint(cx - r, cy - r);
      addPoint(cx + r, cy + r);
    }
  }

  for (const match of svg.matchAll(/<ellipse\b[^>]*>/g)) {
    const tag = match[0];
    const cx = getSvgNumber(tag, "cx");
    const cy = getSvgNumber(tag, "cy");
    const rx = getSvgNumber(tag, "rx");
    const ry = getSvgNumber(tag, "ry");

    if (cx !== null && cy !== null && rx !== null && ry !== null) {
      addPoint(cx - rx, cy - ry);
      addPoint(cx + rx, cy + ry);
    }
  }

  for (const match of svg.matchAll(/<(?:path|polygon|polyline)\b[^>]*>/g)) {
    const tag = match[0];
    const coordinates = [
      ...tag.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi),
    ].map(([value]) => Number(value));

    for (let index = 0; index < coordinates.length - 1; index += 2) {
      addPoint(coordinates[index], coordinates[index + 1]);
    }
  }

  if (points.length === 0) return svg;

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const pad = Math.max(0, strokeWidth) / 2;
  const quote = viewBoxMatch[1];
  const nextViewBox = [
    minX - pad,
    minY - pad,
    maxX - minX + pad * 2,
    maxY - minY + pad * 2,
  ].join(" ");

  return svg.replace(viewBoxMatch[0], `viewBox=${quote}${nextViewBox}${quote}`);
}

function getSvgNumber(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`${attribute}=(["'])([^"']+)\\1`));
  return match ? Number(match[2]) : null;
}

function getObjectSize(object: EditorObject) {
  if (object.kind === "line") {
    const xs = object.points.filter((_, index) => index % 2 === 0);
    const ys = object.points.filter((_, index) => index % 2 === 1);

    return {
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    };
  }

  if (object.kind === "text") {
    return {
      width: object.width,
      height: object.fontSize * 1.4,
    };
  }

  return {
    width: object.width,
    height: object.height,
  };
}

export function TextEditorOverlay({
  object,
  zoom,
  pan,
  onChange,
}: {
  object: TextEditorObject;
  zoom: number;
  pan: { x: number; y: number };
  onChange: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setEditingTextId = useEditorStore((state) => state.setEditingTextId);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.select();
  }, [object.id]);

  return (
    <textarea
      ref={textareaRef}
      value={object.text}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditingTextId(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setEditingTextId(null);
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          setEditingTextId(null);
        }
      }}
      className="absolute z-[60] resize-none overflow-hidden rounded border border-violet-400 bg-white/95 p-1 leading-tight text-slate-950 outline-none shadow-[0_10px_28px_rgba(15,23,42,0.16)]"
      style={{
        left: pan.x + object.x * zoom,
        top: pan.y + object.y * zoom,
        width: Math.max(80, object.width * zoom),
        minHeight: Math.max(36, object.fontSize * 1.45 * zoom),
        fontSize: object.fontSize * zoom,
        fontFamily: object.fontFamily,
        color: object.fill,
        transform: `rotate(${object.rotation ?? 0}deg)`,
        transformOrigin: "top left",
      }}
    />
  );
}
