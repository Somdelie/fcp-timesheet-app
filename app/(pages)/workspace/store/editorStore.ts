"use client";

import { create } from "zustand";

export type EditorTool =
  | "select"
  | "shape"
  | "line"
  | "text"
  | "image"
  | "draw";

export type EditorObjectKind = "rect" | "circle" | "line" | "text" | "image";

type EditorObjectBase = {
  id: string;
  kind: EditorObjectKind;
  x: number;
  y: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
};

export type RectEditorObject = EditorObjectBase & {
  kind: "rect";
  width: number;
  height: number;
  cornerRadius?: number;
};

export type CircleEditorObject = EditorObjectBase & {
  kind: "circle";
  width: number;
  height: number;
};

export type LineEditorObject = EditorObjectBase & {
  kind: "line";
  points: number[];
  connector?: {
    fromId: string;
    toId: string;
    direction: "up" | "right" | "down" | "left";
  };
};

export type TextEditorObject = EditorObjectBase & {
  kind: "text";
  text: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontStyle?: string;
  textDecoration?: string;
  align?: "left" | "center" | "right";
};

export type ImageEditorObject = EditorObjectBase & {
  kind: "image";
  src: string;
  width: number;
  height: number;
};

export type EditorObject =
  | RectEditorObject
  | CircleEditorObject
  | LineEditorObject
  | TextEditorObject
  | ImageEditorObject;

type EditorStore = {
  objects: EditorObject[];
  selectedIds: string[];
  clipboard: EditorObject[];
  zoom: number;
  pan: { x: number; y: number };
  viewport: { width: number; height: number };
  canvasBackground: string;
  tool: EditorTool;
  editingTextId: string | null;
  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setViewport: (viewport: { width: number; height: number }) => void;
  setCanvasBackground: (color: string) => void;
  selectObject: (id: string | null, additive?: boolean) => void;
  clearSelection: () => void;
  updateObject: (id: string, patch: Partial<EditorObject>) => void;
  deleteSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  toggleSelectedLock: () => void;
  addObject: (object: EditorObject) => void;
  addObjectAtCenter: (object: EditorObject) => void;
  setEditingTextId: (id: string | null) => void;
  addTextObject: (x: number, y: number) => void;
};

const starterObjects: EditorObject[] = [];

export const useEditorStore = create<EditorStore>((set) => ({
  objects: starterObjects,
  selectedIds: [],
  clipboard: [],
  zoom: 0.58,
  pan: { x: 0, y: 0 },
  viewport: { width: 1024, height: 640 },
  canvasBackground: "#ffffff",
  tool: "select",
  editingTextId: null,
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setViewport: (viewport) => set({ viewport }),
  setCanvasBackground: (color) => set({ canvasBackground: color }),
  selectObject: (id, additive = false) =>
    set((state) => {
      if (!id) return { selectedIds: [] };
      if (!additive) return { selectedIds: [id] };

      return {
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedIds, id],
      };
    }),
  clearSelection: () => set({ selectedIds: [] }),
  updateObject: (id, patch) =>
    set((state) => ({
      objects: state.objects.map((object) =>
        object.id === id ? ({ ...object, ...patch } as EditorObject) : object,
      ),
    })),
  deleteSelected: () =>
    set((state) => ({
      objects: state.objects.filter(
        (object) => !state.selectedIds.includes(object.id),
      ),
      selectedIds: [],
    })),
  copySelected: () =>
    set((state) => ({
      clipboard: state.objects
        .filter((object) => state.selectedIds.includes(object.id))
        .map((object) => ({ ...object })),
    })),
  pasteClipboard: () =>
    set((state) => {
      if (state.clipboard.length === 0) return state;

      const stamp = Date.now();
      const copies = state.clipboard.map((object, index) => ({
        ...object,
        id: `${object.id}-paste-${stamp}-${index}`,
        x: object.x + 32,
        y: object.y + 32,
        locked: false,
      })) as EditorObject[];

      return {
        objects: [...state.objects, ...copies],
        clipboard: copies.map((object) => ({ ...object })),
        selectedIds: copies.map((object) => object.id),
        tool: "select",
      };
    }),
  duplicateSelected: () =>
    set((state) => {
      const selectedObjects = state.objects.filter((object) =>
        state.selectedIds.includes(object.id),
      );
      const copies = selectedObjects.map((object) => ({
        ...object,
        id: `${object.id}-copy-${Date.now()}`,
        x: object.x + 28,
        y: object.y + 28,
        locked: false,
      })) as EditorObject[];

      return {
        objects: [...state.objects, ...copies],
        clipboard: copies.map((object) => ({ ...object })),
        selectedIds: copies.map((object) => object.id),
      };
    }),
  selectAll: () =>
    set((state) => ({
      selectedIds: state.objects
        .filter((object) => !object.locked && !object.hidden)
        .map((object) => object.id),
    })),
  toggleSelectedLock: () =>
    set((state) => ({
      objects: state.objects.map((object) =>
        state.selectedIds.includes(object.id)
          ? { ...object, locked: !object.locked }
          : object,
      ),
    })),
  addObject: (object) =>
    set((state) => ({
      objects: [...state.objects, object],
      selectedIds: [object.id],
    })),
  addObjectAtCenter: (object) =>
    set((state) => {
      const centerX = (state.viewport.width / 2 - state.pan.x) / state.zoom;
      const centerY = (state.viewport.height / 2 - state.pan.y) / state.zoom;
      const width = "width" in object ? object.width : 0;
      const height = "height" in object ? object.height : 0;
      const centeredObject = {
        ...object,
        x: centerX - width / 2,
        y: centerY - height / 2,
      } as EditorObject;

      return {
        objects: [...state.objects, centeredObject],
        selectedIds: [object.id],
        tool: "select",
      };
    }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  addTextObject: (x, y) =>
    set((state) => {
      const id = `text-${Date.now()}`;
      const newObject: TextEditorObject = {
        id,
        kind: "text",
        x,
        y,
        width: 300,
        text: "Edit me",
        fill: "#0f172a",
        fontSize: 24,
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "400",
      };
      return {
        objects: [...state.objects, newObject],
        selectedIds: [id],
        editingTextId: id,
      };
    }),
}));
