"use client";

import Konva from "konva";
import { Minus, Plus } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { CanvasObject, TextEditorOverlay } from "./CanvasObjects";
import { SelectionOverlay, type SelectionBox } from "./SelectionOverlay";
import { SelectionStyleToolbar } from "./SelectionStyleToolbar";
import {
  type EditorObject,
  type TextEditorObject,
  useEditorStore,
} from "../store/editorStore";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.0015;
const WORLD_SIZE = 5000;

type MarqueeSelection = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  additive: boolean;
  baseIds: string[];
};

export function WorkspaceCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [marquee, setMarquee] = useState<MarqueeSelection | null>(null);

  const objects = useEditorStore((state) => state.objects);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);
  const tool = useEditorStore((state) => state.tool);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setPan = useEditorStore((state) => state.setPan);
  const setViewport = useEditorStore((state) => state.setViewport);
  const selectObject = useEditorStore((state) => state.selectObject);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const copySelected = useEditorStore((state) => state.copySelected);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const selectAll = useEditorStore((state) => state.selectAll);
  const toggleSelectedLock = useEditorStore(
    (state) => state.toggleSelectedLock,
  );
  const addTextObject = useEditorStore((state) => state.addTextObject);
  const editingTextId = useEditorStore((state) => state.editingTextId);

  useHotkeys("delete,backspace", deleteSelected, {
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("ctrl+c,meta+c", copySelected, {
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("ctrl+v,meta+v", pasteClipboard, {
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("ctrl+d,meta+d", duplicateSelected, {
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("ctrl+a,meta+a", selectAll, {
    enableOnFormTags: false,
    preventDefault: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setStageSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
      setViewport({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [setViewport]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceDown(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceDown(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;

    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [objects, selectedIds]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectionBox(null);
      return;
    }

    const selectedObjects = objects.filter((object) =>
      selectedIds.includes(object.id),
    );
    if (selectedObjects.length === 0) {
      setSelectionBox(null);
      return;
    }

    const bounds =
      selectedObjects.length === 1
        ? getObjectBounds(selectedObjects[0])
        : getObjectsBounds(selectedObjects);
    const left = pan.x + bounds.x * zoom;
    const top = pan.y + bounds.y * zoom;
    const width = bounds.width * zoom;
    const height = bounds.height * zoom;

    setSelectionBox({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
      rotation: selectedObjects.length === 1 ? (selectedObjects[0].rotation ?? 0) : 0,
    });
  }, [objects, selectedIds, zoom, pan, stageSize]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const updateZoom = (nextZoom: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (!event.evt.ctrlKey) return;

    event.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - pan.x) / zoom,
      y: (pointer.y - pan.y) / zoom,
    };
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom - event.evt.deltaY * ZOOM_SPEED),
    );

    setZoom(nextZoom);
    setPan({
      x: pointer.x - mousePointTo.x * nextZoom,
      y: pointer.y - mousePointTo.y * nextZoom,
    });
  };

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    setContextMenu(null);

    if (event.target === event.target.getStage()) {
      // Handle text tool click
      if (tool === "text") {
        const stage = stageRef.current;
        if (!stage) return;

        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;

        // Convert screen coordinates to world coordinates
        const x = (pointerPos.x - pan.x) / zoom;
        const y = (pointerPos.y - pan.y) / zoom;

        addTextObject(x, y);
        return;
      }

      if (spaceDown || tool !== "select") {
        if (!event.evt.shiftKey) clearSelection();
        return;
      }

      const point = getWorldPointer(stageRef.current, pan, zoom);
      if (!point) return;

      setMarquee({
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        additive: event.evt.shiftKey,
        baseIds: event.evt.shiftKey ? selectedIds : [],
      });

      if (!event.evt.shiftKey) clearSelection();
    }
  };

  const handleStageMouseMove = () => {
    if (!marquee) return;

    const point = getWorldPointer(stageRef.current, pan, zoom);
    if (!point) return;

    setMarquee({
      ...marquee,
      x: Math.min(marquee.startX, point.x),
      y: Math.min(marquee.startY, point.y),
      width: Math.abs(point.x - marquee.startX),
      height: Math.abs(point.y - marquee.startY),
    });
  };

  const handleStageMouseUp = () => {
    if (!marquee) return;

    const selectedByBox =
      marquee.width > 3 / zoom || marquee.height > 3 / zoom
        ? objects
            .filter(
              (object) =>
                !object.hidden &&
                !object.locked &&
                object.kind !== "line" &&
                rectsIntersect(getObjectBounds(object), marquee),
            )
            .map((object) => object.id)
        : [];

    const nextSelectedIds = marquee.additive
      ? Array.from(new Set([...marquee.baseIds, ...selectedByBox]))
      : selectedByBox;

    useEditorStore.setState({ selectedIds: nextSelectedIds });
    setMarquee(null);
  };

  const openContextMenu = (event: MouseEvent, objectId?: string) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    if (objectId && !selectedIds.includes(objectId)) {
      selectObject(objectId, event.shiftKey);
    }

    if (!objectId && selectedIds.length === 0) {
      clearSelection();
    }

    const rect = container.getBoundingClientRect();
    const menuWidth = 260;
    const menuHeight = 430;
    const x = Math.min(
      Math.max(8, event.clientX - rect.left),
      Math.max(8, rect.width - menuWidth - 8),
    );
    const y = Math.min(
      Math.max(8, event.clientY - rect.top),
      Math.max(8, rect.height - menuHeight - 8),
    );

    setContextMenu({ x, y });
  };

  const handleStageContextMenu = (
    event: Konva.KonvaEventObject<PointerEvent>,
  ) => {
    if (event.target !== event.target.getStage()) return;
    openContextMenu(event.evt);
  };

  const handleStageDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (!spaceDown) return;

    setPan({
      x: event.target.x(),
      y: event.target.y(),
    });
  };

  const zoomPercent = Math.round(zoom * 100);
  const editingTextObject = objects.find(
    (object): object is TextEditorObject =>
      object.kind === "text" && object.id === editingTextId,
  );
  const selectedObject =
    selectedIds.length === 1
      ? (objects.find((object) => object.id === selectedIds[0]) ?? null)
      : null;
  const updateObject = (id: string, patch: Partial<EditorObject>) => {
    useEditorStore.setState((state) => ({
      objects: updateObjectAndConnectors(state.objects, id, patch),
    }));
  };
  const createQuickFlowObject = (direction: FlowDirection) => {
    if (!selectedObject || selectedObject.locked) return;

    const bounds = getObjectBounds(selectedObject);
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const rotation = ((selectedObject.rotation ?? 0) * Math.PI) / 180;
    const axis = getFlowAxis(direction, rotation);
    const sourceExtent =
      direction === "left" || direction === "right"
        ? bounds.width / 2
        : bounds.height / 2;
    const targetExtent = sourceExtent;
    const gap = 140 / zoom;
    const centerDistance = sourceExtent + gap + targetExtent;
    const nextCenter = {
      x: center.x + axis.x * centerDistance,
      y: center.y + axis.y * centerDistance,
    };
    const nextId = `${selectedObject.id}-flow-${Date.now()}`;
    const connectorId = `${nextId}-connector`;
    const nextObject = {
      ...selectedObject,
      id: nextId,
      x: nextCenter.x - bounds.width / 2,
      y: nextCenter.y - bounds.height / 2,
      locked: false,
    } as EditorObject;
    const connector: EditorObject = {
      id: connectorId,
      kind: "line",
      x: 0,
      y: 0,
      points: getConnectorPoints(selectedObject, nextObject, direction),
      stroke: "#9aa5b1",
      strokeWidth: 3,
      opacity: 1,
      locked: true,
      connector: {
        fromId: selectedObject.id,
        toId: nextId,
        direction,
      },
    };

    useEditorStore.setState((state) => ({
      objects: [...state.objects, connector, nextObject],
      selectedIds: [nextId],
      tool: "select",
    }));
  };
  const rotateSelectedObject = (rotation: number) => {
    if (!selectedObject || selectedObject.locked) return;

    updateObject(selectedObject.id, {
      rotation,
    } as Partial<EditorObject>);
  };

  return (
    <main
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-white bg-[radial-gradient(#d7dbe2_1.4px,transparent_1.4px)] [background-size:18px_18px]"
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={pan.x}
        y={pan.y}
        scaleX={zoom}
        scaleY={zoom}
        draggable={spaceDown}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onContextMenu={handleStageContextMenu}
        onDragEnd={handleStageDragEnd}
        className={spaceDown ? "cursor-grabbing" : "cursor-default"}
      >
        <Layer>
          <Rect
            x={-WORLD_SIZE / 2}
            y={-WORLD_SIZE / 2}
            width={WORLD_SIZE}
            height={WORLD_SIZE}
            fill="rgba(255,255,255,0.01)"
            listening={false}
          />

          {objects.map((object) => (
            <CanvasObject
              key={object.id}
              object={object}
              onSelect={(additive) => selectObject(object.id, additive)}
              onContextMenu={(event) => openContextMenu(event, object.id)}
              onChange={(patch) => updateObject(object.id, patch)}
            />
          ))}

          {marquee && (marquee.width > 0 || marquee.height > 0) ? (
            <Rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(124,92,255,0.08)"
              stroke="#7c5cff"
              strokeWidth={1 / zoom}
              dash={[6 / zoom, 4 / zoom]}
              listening={false}
            />
          ) : null}

          <Transformer
            ref={transformerRef}
            // Keep Konva Transformer only as the resize/rotate engine.
            // The visible Canva-style border/handles are rendered by SelectionOverlay below.
            rotateEnabled={true}
            borderEnabled={false}
            anchorSize={20}
            anchorCornerRadius={10}
            anchorStroke="rgba(0,0,0,0)"
            anchorFill="rgba(0,0,0,0)"
            anchorStrokeWidth={0}
            padding={0}
            keepRatio={false}
            enabledAnchors={[
              "top-left",
              "top-center",
              "top-right",
              "middle-left",
              "middle-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ]}
            rotateAnchorOffset={34}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 12 || newBox.height < 12) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {editingTextObject ? (
        <TextEditorOverlay
          object={editingTextObject}
          zoom={zoom}
          pan={pan}
          onChange={(text) => updateObject(editingTextObject.id, { text })}
        />
      ) : null}

      {/* <div className="pointer-events-none absolute left-4 top-4 z-50 rounded bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.12)] ring-1 ring-black/5 backdrop-blur-xl">
        Hold Space to pan. Ctrl + wheel to zoom.
      </div> */}

      <SelectionStyleToolbar
        object={selectedObject}
        onObjectChange={(patch) => {
          if (!selectedObject) return;
          updateObject(selectedObject.id, patch);
        }}
      />

      <SelectionOverlay
        object={selectedObject}
        box={selectionBox}
        selectedCount={selectedIds.length}
        stageSize={stageSize}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onToggleLock={toggleSelectedLock}
        onFlow={createQuickFlowObject}
        onRotate={rotateSelectedObject}
        onOpenContextMenu={(event) => {
          event.stopPropagation();
          openContextMenu(event.nativeEvent, selectedObject?.id);
        }}
      />

      <CanvasContextMenu
        open={Boolean(contextMenu)}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        hasSelection={selectedIds.length > 0}
        selectedObject={selectedObject}
        onClose={() => setContextMenu(null)}
        onCopy={copySelected}
        onPaste={pasteClipboard}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onToggleLock={toggleSelectedLock}
      />

      <div className="absolute bottom-4 right-6 z-50 flex items-center gap-3 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => updateZoom(zoom - 0.05)}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-slate-100"
        >
          <Minus size={15} />
        </button>

        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => updateZoom(Number(event.target.value))}
          className="w-32 accent-slate-500"
        />

        <button
          type="button"
          onClick={() => updateZoom(zoom + 0.05)}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-slate-100"
        >
          <Plus size={15} />
        </button>

        <span className="min-w-12 text-right">{zoomPercent}%</span>
      </div>
    </main>
  );
}

function getObjectBounds(object: EditorObject) {
  if (object.kind === "line") {
    const xs = object.points.filter((_, index) => index % 2 === 0);
    const ys = object.points.filter((_, index) => index % 2 === 1);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
      x: object.x + minX,
      y: object.y + minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  if (object.kind === "text") {
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.fontSize * 1.4,
    };
  }

  return {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  };
}

function getObjectsBounds(objects: EditorObject[]) {
  const bounds = objects.map(getObjectBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function getWorldPointer(
  stage: Konva.Stage | null,
  pan: { x: number; y: number },
  zoom: number,
) {
  const pointer = stage?.getPointerPosition();
  if (!pointer) return null;

  return {
    x: (pointer.x - pan.x) / zoom,
    y: (pointer.y - pan.y) / zoom,
  };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

type FlowDirection = "up" | "right" | "down" | "left";

function updateObjectAndConnectors(
  objects: EditorObject[],
  id: string,
  patch: Partial<EditorObject>,
) {
  const updatedObjects = objects.map((object) =>
    object.id === id ? ({ ...object, ...patch } as EditorObject) : object,
  );

  return updatedObjects.map((object) => {
    if (object.kind !== "line" || !object.connector) return object;

    const fromObject = updatedObjects.find(
      (candidate) => candidate.id === object.connector?.fromId,
    );
    const toObject = updatedObjects.find(
      (candidate) => candidate.id === object.connector?.toId,
    );

    if (!fromObject || !toObject) return object;

    return {
      ...object,
      x: 0,
      y: 0,
      points: getConnectorPoints(
        fromObject,
        toObject,
        object.connector.direction,
      ),
    };
  });
}

function getConnectorPoints(
  fromObject: EditorObject,
  toObject: EditorObject,
  direction: FlowDirection,
) {
  const fromAnchor = getConnectorAnchor(fromObject, direction);
  const toAnchor = getConnectorAnchor(toObject, getOppositeDirection(direction));

  if (direction === "left" || direction === "right") {
    const midX = (fromAnchor.x + toAnchor.x) / 2;

    return [
      fromAnchor.x,
      fromAnchor.y,
      midX,
      fromAnchor.y,
      midX,
      toAnchor.y,
      toAnchor.x,
      toAnchor.y,
    ];
  }

  const midY = (fromAnchor.y + toAnchor.y) / 2;

  return [
    fromAnchor.x,
    fromAnchor.y,
    fromAnchor.x,
    midY,
    toAnchor.x,
    midY,
    toAnchor.x,
    toAnchor.y,
  ];
}

function getConnectorAnchor(object: EditorObject, direction: FlowDirection) {
  const bounds = getObjectBounds(object);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const axis = getFlowAxis(
    direction,
    ((object.rotation ?? 0) * Math.PI) / 180,
  );
  const extent =
    direction === "left" || direction === "right"
      ? bounds.width / 2
      : bounds.height / 2;

  return {
    x: center.x + axis.x * extent,
    y: center.y + axis.y * extent,
  };
}

function getOppositeDirection(direction: FlowDirection): FlowDirection {
  if (direction === "up") return "down";
  if (direction === "right") return "left";
  if (direction === "down") return "up";
  return "right";
}

function getFlowAxis(direction: FlowDirection, rotation: number) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  if (direction === "right") return { x: cos, y: sin };
  if (direction === "left") return { x: -cos, y: -sin };
  if (direction === "down") return { x: -sin, y: cos };
  return { x: sin, y: -cos };
}
