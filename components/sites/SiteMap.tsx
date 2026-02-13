"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";

export type SiteMapMarker = {
  id: string;
  name: string;
  code?: string | null;
  lat: number;
  lng: number;
  region?: string;
  status?: "active" | "warning" | "error";
};

export default function SitesMap({ sites }: { sites: SiteMapMarker[] }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);
  const markersRef = React.useRef<Map<string, mapboxgl.Marker>>(new Map());
  const mapInitializedRef = React.useRef(false);

  const [selectedSite, setSelectedSite] = React.useState<SiteMapMarker | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [is3D, setIs3D] = React.useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const filteredSites = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sites;

    return sites.filter((s) => {
      const haystack = [s.name, s.code ?? "", s.region ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sites, searchQuery]);

  // Initialize map only once
  React.useEffect(() => {
    if (mapInitializedRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }

    mapboxgl.accessToken = token;

    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:
        resolvedTheme === "dark"
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/light-v11",
      center: [24.5, -29.5],
      zoom: 4.5,
      pitch: 45,
      bearing: -15,
      antialias: true,
      attributionControl: false,
    });

    mapRef.current = map;
    mapInitializedRef.current = true;

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      // Add terrain
      try {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

        // Add 3D building layer
        const layers = map.getStyle().layers;
        const labelLayerId = layers.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
        )?.id;

        map.addLayer(
          {
            id: "add-3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 10,
            paint: {
              "fill-extrusion-color":
                resolvedTheme === "dark" ? "#1e293b" : "#b0bec5",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.6,
            },
          },
          labelLayerId,
        );

        // Add 3D building shadow/outline
        map.addLayer({
          id: "building-outline",
          source: "composite",
          "source-layer": "building",
          type: "line",
          minzoom: 14,
          paint: {
            "line-color": resolvedTheme === "dark" ? "#475569" : "#999",
            "line-width": 0.5,
            "line-opacity": 0.3,
          },
        });
      } catch (e) {
        console.log("3D buildings layer already exists or unavailable");
      }

      addMarkersToMap(map, sites);
    });

    return () => {
      // Don't remove on unmount if needed for persistence
    };
  }, []);

  // Update map style when theme changes
  React.useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return;

    const map = mapRef.current;
    const newStyle = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

    map.setStyle(newStyle);

    // Re-add terrain and 3D buildings after style change
    map.once("style.load", () => {
      try {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

        const layers = map.getStyle().layers;
        const labelLayerId = layers.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
        )?.id;

        map.addLayer(
          {
            id: "add-3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 10,
            paint: {
              "fill-extrusion-color": isDark ? "#1e293b" : "#b0bec5",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.6,
            },
          },
          labelLayerId,
        );

        map.addLayer({
          id: "building-outline",
          source: "composite",
          "source-layer": "building",
          type: "line",
          minzoom: 14,
          paint: {
            "line-color": isDark ? "#475569" : "#999",
            "line-width": 0.5,
            "line-opacity": 0.3,
          },
        });
      } catch (e) {
        console.log("Error re-adding 3D layers after theme change");
      }

      // Re-add markers after style change
      markersRef.current.forEach((marker) => marker.remove());
      addMarkersToMap(map, sites);
    });
  }, [isDark]);

  // Update markers when sites or selection changes
  React.useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return;

    updateMarkers(
      mapRef.current,
      filteredSites,
      selectedSite?.id || null,
      hoveredId,
    );
  }, [filteredSites, selectedSite, hoveredId]);

  // Reconcile markers when filtering changes (adds/removes markers)
  React.useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return;
    addMarkersToMap(mapRef.current, filteredSites);
  }, [filteredSites]);

  // Clear selection if it no longer matches the filtered list
  React.useEffect(() => {
    if (!selectedSite) return;
    if (!filteredSites.some((s) => s.id === selectedSite.id)) {
      setSelectedSite(null);
    }
  }, [filteredSites, selectedSite]);

  const addMarkersToMap = (map: mapboxgl.Map, sitesToAdd: SiteMapMarker[]) => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    sitesToAdd.forEach((site) => {
      const marker = new mapboxgl.Marker({
        color: getMarkerColor(site, selectedSite, hoveredId),
      })
        .setLngLat([site.lng, site.lat])
        .addTo(map);

      const element = marker.getElement();
      element.style.cursor = "pointer";
      element.style.transition = "all 0.3s ease";

      element.addEventListener("click", () => {
        setSelectedSite(site);
        focusSite(map, site, is3D);
      });

      element.addEventListener("mouseenter", () => {
        setHoveredId(site.id);
      });

      element.addEventListener("mouseleave", () => {
        setHoveredId(null);
      });

      markersRef.current.set(site.id, marker);
    });
  };

  const updateMarkers = (
    map: mapboxgl.Map,
    sitesToUpdate: SiteMapMarker[],
    selectedId: string | null,
    hoveredId: string | null,
  ) => {
    sitesToUpdate.forEach((site) => {
      const marker = markersRef.current.get(site.id);
      if (marker) {
        const newColor = getMarkerColor(
          site,
          sitesToUpdate.find((s) => s.id === selectedId) || null,
          hoveredId,
        );
        const element = marker.getElement();
        element.style.filter =
          hoveredId === site.id
            ? "drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))"
            : "";
        (element.querySelector("svg") as SVGElement)?.style?.setProperty(
          "fill",
          newColor,
        );
      }
    });
  };

  const handleReset = () => {
    setSelectedSite(null);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [24.5, -29.5],
        zoom: 4.5,
        pitch: is3D ? 45 : 0,
        bearing: is3D ? -15 : 0,
        duration: 1000,
      });
    }
  };

  const handleSiteClick = (site: SiteMapMarker) => {
    setSelectedSite(site);
    if (mapRef.current) {
      focusSite(mapRef.current, site, is3D);
    }
  };

  const toggle3D = () => {
    if (mapRef.current) {
      const newIs3D = !is3D;
      setIs3D(newIs3D);
      mapRef.current.flyTo({
        pitch: newIs3D ? 45 : 0,
        bearing: newIs3D ? -15 : 0,
        duration: 1000,
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "warning":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#10b981";
    }
  };

  // Generate theme-aware styles
  const themedStyles = getThemedStyles(isDark);

  const searchIsActive = searchQuery.trim().length > 0;
  const locationCountLabel = searchIsActive
    ? `${filteredSites.length} of ${sites.length}`
    : `${sites.length}`;

  return (
    <div style={themedStyles.container}>
      <div style={themedStyles.mapWrapper}>
        <div ref={containerRef} style={themedStyles.map} />

        {/* Header */}
        <div style={themedStyles.header}>
          <div style={themedStyles.headerLeft}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "#0f766e" }}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div>
              <div style={themedStyles.headerTitle}>Sites Map</div>
              <div style={themedStyles.headerSubtitle}>
                {searchIsActive
                  ? `${filteredSites.length} of ${sites.length} locations`
                  : `${sites.length} locations`}
              </div>
            </div>
          </div>
        </div>

        {/* 3D Toggle Button */}
        <button
          onClick={toggle3D}
          style={themedStyles.toggle3DButton}
          title="Toggle 3D view"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
            <path d="M12 22V2" />
            <path d="M2 7h20" />
          </svg>
          {is3D ? "2D" : "3D"}
        </button>
      </div>

      {/* Right Panel */}
      <div style={themedStyles.panel}>
        {/* Panel Header */}
        <div style={themedStyles.panelHeader}>
          <h2 style={themedStyles.panelTitle}>Sites Locations</h2>
          <div style={themedStyles.locationCount}>{locationCountLabel}</div>
        </div>

        {/* Search Bar */}
        <div style={themedStyles.searchContainer}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search location..."
            style={themedStyles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
          />
        </div>

        {/* Tabs */}
        <div style={themedStyles.tabs}>
          <div style={{ ...themedStyles.tab, ...themedStyles.tabActive }}>
            All
          </div>
          <div style={themedStyles.tab}>Active</div>
          <div style={themedStyles.tab}>Issues</div>
        </div>

        {/* Sites List */}
        <div style={themedStyles.sitesList}>
          {filteredSites.length === 0 ? (
            <div
              style={{
                padding: "12px",
                color: isDark ? "#94a3b8" : "#64748b",
                fontSize: 13,
              }}
            >
              No matching sites.
            </div>
          ) : (
            filteredSites.map((site) => (
              <div
                key={site.id}
                onClick={() => handleSiteClick(site)}
                onMouseEnter={() => setHoveredId(site.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  ...themedStyles.siteRow,
                  ...(selectedSite?.id === site.id
                    ? themedStyles.siteRowActive
                    : hoveredId === site.id
                      ? themedStyles.siteRowHover
                      : {}),
                }}
              >
                <div style={themedStyles.siteRowLeft}>
                  <div
                    style={{
                      ...themedStyles.siteStatus,
                      backgroundColor: getStatusColor(site.status),
                    }}
                  />
                  <div style={themedStyles.siteInfo}>
                    <div style={themedStyles.siteName}>{site.name}</div>
                    <div style={themedStyles.siteCode}>{site.code}</div>
                  </div>
                </div>
                {site.region && (
                  <div style={themedStyles.siteRegion}>{site.region}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {selectedSite && (
          <button onClick={handleReset} style={themedStyles.resetButton}>
            Reset View
          </button>
        )}
      </div>
    </div>
  );
}

function focusSite(map: mapboxgl.Map, s: SiteMapMarker, is3D: boolean) {
  map.flyTo({
    center: [s.lng, s.lat],
    zoom: 16,
    pitch: is3D ? 60 : 0,
    bearing: is3D ? -25 : 0,
    duration: 1000,
  });
}

function getMarkerColor(
  site: SiteMapMarker,
  selectedSite: SiteMapMarker | null,
  hoveredId: string | null,
): string {
  if (selectedSite?.id === site.id) return "#0f766e";
  if (hoveredId === site.id) return "#14b8a6";

  switch (site.status) {
    case "error":
      return "#dc2626";
    case "warning":
      return "#f59e0b";
    default:
      return "#0d9488";
  }
}

function getThemedStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
    container: {
      display: "flex",
      height: "100vh",
      width: "100%",
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    mapWrapper: {
      flex: 1,
      position: "relative",
      backgroundColor: "transparent",
    },
    map: {
      height: "100%",
      width: "100%",
    },
    header: {
      position: "absolute",
      top: 20,
      left: 20,
      zIndex: 10,
      backgroundColor: isDark ? "#1e293b" : "white",
      padding: "12px 16px",
      borderRadius: 12,
      boxShadow: isDark
        ? "0 2px 12px rgba(0, 0, 0, 0.3)"
        : "0 2px 12px rgba(0, 0, 0, 0.08)",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    headerLeft: {
      display: "flex",
      gap: 12,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: isDark ? "#f1f5f9" : "#0f172a",
      margin: 0,
    },
    headerSubtitle: {
      fontSize: 12,
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 2,
    },
    toggle3DButton: {
      position: "absolute",
      bottom: 80,
      right: 20,
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: 6,
      backgroundColor: isDark ? "#1e293b" : "white",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      padding: "10px 14px",
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      color: isDark ? "#14b8a6" : "#0f766e",
      cursor: "pointer",
      boxShadow: isDark
        ? "0 2px 12px rgba(0, 0, 0, 0.3)"
        : "0 2px 12px rgba(0, 0, 0, 0.08)",
      transition: "all 0.2s ease",
    },
    panel: {
      width: 300,
      backgroundColor: isDark ? "#1e293b" : "white",
      borderLeft: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    panelHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px 20px 16px",
      borderBottom: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    panelTitle: {
      fontSize: 18,
      fontWeight: 700,
      margin: 0,
      color: isDark ? "#f1f5f9" : "#0f172a",
    },
    locationCount: {
      fontSize: 14,
      fontWeight: 600,
      color: isDark ? "#14b8a6" : "#0f766e",
      backgroundColor: isDark ? "#134e4a" : "#d1fae5",
      padding: "4px 10px",
      borderRadius: 6,
    },
    searchContainer: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 16px",
      margin: "12px 16px",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      borderRadius: 8,
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      color: isDark ? "#94a3b8" : "#64748b",
    },
    searchInput: {
      flex: 1,
      border: "none",
      background: "transparent",
      outline: "none",
      fontSize: 14,
      color: isDark ? "#f1f5f9" : "#0f172a",
      fontFamily: "inherit",
    },
    tabs: {
      display: "flex",
      gap: 8,
      padding: "0 16px 12px",
      borderBottom: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    tab: {
      fontSize: 13,
      fontWeight: 600,
      padding: "8px 12px",
      borderRadius: 6,
      cursor: "pointer",
      color: isDark ? "#94a3b8" : "#64748b",
      transition: "all 0.2s ease",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
    },
    tabActive: {
      color: isDark ? "#14b8a6" : "#0f766e",
      backgroundColor: isDark ? "#134e4a" : "#d1fae5",
    },
    sitesList: {
      flex: 1,
      overflowY: "auto",
      padding: "12px 12px",
    },
    siteRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 12px",
      marginBottom: "6px",
      borderRadius: 5,
      cursor: "pointer",
      transition: "all 0.2s ease",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "transparent",
      borderBottomWidth: 4,
      borderBottomStyle: "solid",
      borderBottomColor: "transparent",
    },
    siteRowHover: {
      backgroundColor: isDark ? "#134e4a" : "#f0fdf4",
      borderColor: isDark ? "#0f766e" : "#d1fae5",
      borderBottomColor: isDark ? "#0f766e" : "#d1fae5",
    },
    siteRowActive: {
      backgroundColor: isDark ? "#0f766e" : "#d1fae5",
      borderColor: isDark ? "#14b8a6" : "#86efac",
      borderBottomColor: isDark ? "#14b8a6" : "#86efac",
    },
    siteRowLeft: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      flex: 1,
    },
    siteStatus: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      flexShrink: 0,
    },
    siteInfo: {
      flex: 1,
    },
    siteName: {
      fontSize: 14,
      fontWeight: 600,
      color: isDark ? "#f1f5f9" : "#0f172a",
      marginBottom: 2,
    },
    siteCode: {
      fontSize: 12,
      color: isDark ? "#64748b" : "#94a3b8",
    },
    siteRegion: {
      fontSize: 12,
      color: isDark ? "#94a3b8" : "#64748b",
      fontWeight: 500,
    },
    resetButton: {
      margin: "12px 12px",
      padding: "10px 16px",
      backgroundColor: isDark ? "#14b8a6" : "#0f766e",
      color: "white",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
  };
}
