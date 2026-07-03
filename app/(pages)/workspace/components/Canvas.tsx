"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.0015;

const canvasObjects = [
  {
    src: "/icons-3d/title.png",
    alt: "Text tool",
    className: "left-[47%] top-[36%] h-40 w-40",
  },
  {
    src: "/icons-3d/pencil.png",
    alt: "Pencil tool",
    className: "left-[55%] top-[39%] h-36 w-36 rotate-12",
  },
  {
    src: "/icons-3d/sgnage.png",
    alt: "Signature tool",
    className: "left-[40%] top-[49%] h-44 w-44 -rotate-12",
  },
  {
    src: "/icons-3d/tables.png",
    alt: "Table tool",
    className: "left-[50%] top-[54%] h-44 w-44",
  },
  {
    src: "/icons-3d/shapes.png",
    alt: "Shapes tool",
    className: "left-[42%] top-[61%] h-44 w-44 rotate-[-16deg]",
  },
];

export function WorkspaceCanvas() {
  const canvasRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const zoomDelta = -event.deltaY * ZOOM_STEP;

      setZoom((currentZoom) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + zoomDelta)),
      );
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <main
      ref={canvasRef}
      className="workspace-bg relative h-full overflow-y-auto overflow-x-hidden overscroll-contain bg-white"
      aria-label="Workspace canvas"
    >
      <div className="relative h-600 min-w-full">
        <div
          className="absolute left-1/2 top-1/2 h-400 w-550 transition-transform duration-75"
          style={{
            transform: `translate(-50%, -50%) scale(${zoom})`,
            transformOrigin: "center",
          }}
        >
          {canvasObjects.map((object) => (
            <Image
              key={object.src}
              src={object.src}
              alt={object.alt}
              width={176}
              height={176}
              className={`absolute object-contain ${object.className}`}
              draggable={false}
              priority
            />
          ))}
        </div>
        {/* <MarkerToolbar /> */}
      </div>

      <div className="sticky bottom-3 ml-auto mr-4 flex w-fit items-center gap-3 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
        <div className="h-1 w-28 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-500"
            style={{ width: `${Math.min(100, (zoom / MAX_ZOOM) * 100)}%` }}
          />
        </div>
        <span>{zoomPercent}%</span>
      </div>
    </main>
  );
}
