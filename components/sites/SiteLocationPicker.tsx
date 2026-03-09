"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";

export type SiteCoords = { lat: number; lng: number };

export default function SiteLocationPicker(props: {
  value: SiteCoords | null;
  onChange: (next: SiteCoords) => void;
  disabled?: boolean;
  height?: number;
}) {
  const { value, onChange, disabled, height = 240 } = props;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);
  const initializedRef = React.useRef(false);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  React.useEffect(() => {
    if (initializedRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: isDark
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
      center: value ? [value.lng, value.lat] : [24.5, -29.5],
      zoom: value ? 14 : 4.5,
      attributionControl: false,
    });

    mapRef.current = map;
    initializedRef.current = true;

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("click", (e) => {
      if (disabled) return;
      const next = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      onChange(next);
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style when theme changes
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";
    try {
      map.setStyle(style);
    } catch {
      // ignore
    }
  }, [isDark]);

  // Render/refresh marker when value changes
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [value.lng, value.lat];
    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({
        color: "#0f766e",
        draggable: !disabled,
      })
        .setLngLat(lngLat)
        .addTo(map);

      marker.on("dragend", () => {
        if (disabled) return;
        const ll = marker.getLngLat();
        onChange({ lat: ll.lat, lng: ll.lng });
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat(lngLat);
      try {
        markerRef.current.setDraggable(!disabled);
      } catch {
        // ignore
      }
    }

    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) });
  }, [value]);

  React.useEffect(() => {
    if (!markerRef.current) return;
    try {
      markerRef.current.setDraggable(!disabled);
    } catch {
      // ignore
    }
  }, [disabled]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div className="rounded border border-zinc-200/50 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-900/30 dark:text-zinc-300">
        Map picker unavailable: missing `NEXT_PUBLIC_MAPBOX_TOKEN`.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded border border-zinc-200/50 dark:border-zinc-700/50"
      style={{ height }}
    />
  );
}
