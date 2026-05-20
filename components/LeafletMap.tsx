"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet requires some marker icon overrides on the client
const fixLeafletIcon = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

interface LeafletMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropLat?: number | null;
  dropLng?: number | null;
}

export default function LeafletMap({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    fixLeafletIcon();

    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstance.current) {
      // Default center is Bangalore (India's tech hub / ONDC hub)
      const defaultLat = 12.9716;
      const defaultLng = 77.5946;

      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([defaultLat, defaultLng], 13);

      // Load stylized tiles (detect initial state)
      const isDark = document.documentElement.classList.contains("dark");
      const initialTileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      tileLayerRef.current = L.tileLayer(initialTileUrl, {
        maxZoom: 20,
      }).addTo(mapInstance.current);

      // Add a customized subtle zoom control at the bottom right
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(mapInstance.current);

      // Force recalculation of container size after quick mount
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize();
        }
      }, 250);
    }

    return () => {
      // Cleanup map instance on unmount
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Real-time map tile theme switching listener
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const map = mapInstance.current;
      if (!map || !tileLayerRef.current) return;

      const activeTheme = e.detail || (document.documentElement.classList.contains("dark") ? "dark" : "light");
      const targetUrl = activeTheme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      tileLayerRef.current.setUrl(targetUrl);
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    window.addEventListener("omnifare_theme_changed", handleThemeChange);

    // Sync check after mount
    const checkTheme = () => {
      const map = mapInstance.current;
      if (!map || !tileLayerRef.current) return;
      const isDark = document.documentElement.classList.contains("dark");
      const targetUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      tileLayerRef.current.setUrl(targetUrl);
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    };
    
    const timer = setTimeout(checkTheme, 100);

    return () => {
      window.removeEventListener("omnifare_theme_changed", handleThemeChange);
      clearTimeout(timer);
    };
  }, []);

  // Update markers and routing lines dynamically
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear previous route polyline
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const bounds: L.LatLngExpression[] = [];

    // Custom Emerald Pin for Pickup
    const pickupIcon = L.divIcon({
      className: "custom-pickup-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-8 w-8 rounded-full bg-emerald-500/20 animate-ping"></div>
          <div class="h-4 w-4 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-lg shadow-emerald-500/50"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Custom Coral/Rose Pin for Dropoff
    const dropIcon = L.divIcon({
      className: "custom-drop-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-8 w-8 rounded-full bg-rose-500/20 animate-ping"></div>
          <div class="h-4 w-4 rounded-full border-2 border-slate-950 bg-rose-500 shadow-lg shadow-rose-500/50"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (pickupLat && pickupLng) {
      const pos: L.LatLngExpression = [pickupLat, pickupLng];
      const marker = L.marker(pos, { icon: pickupIcon }).addTo(map);
      marker.bindPopup("<b class='text-slate-900'>Pickup Location</b>").openPopup();
      markersRef.current.push(marker);
      bounds.push(pos);
    }

    if (dropLat && dropLng) {
      const pos: L.LatLngExpression = [dropLat, dropLng];
      const marker = L.marker(pos, { icon: dropIcon }).addTo(map);
      marker.bindPopup("<b class='text-slate-900'>Dropoff Location</b>");
      markersRef.current.push(marker);
      bounds.push(pos);
    }

    // Fetch and draw street-accurate route via OSRM if we have both points
    if (pickupLat && pickupLng && dropLat && dropLng) {
      const drawRoute = async () => {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?geometries=geojson&overview=full`;
          const response = await fetch(osrmUrl);
          const data = await response.json();

          if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
            const coordinates = data.routes[0].geometry.coordinates.map(
              (coord: [number, number]) => [coord[1], coord[0]] as L.LatLngExpression
            );

            // Draw clean emerald street-following path
            const polyline = L.polyline(coordinates, {
              color: "#10b981", // Emerald-500
              weight: 4,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);

            routeLineRef.current = polyline;
          } else {
            throw new Error("Route geometry not available");
          }
        } catch (error) {
          // Fallback to direct geodesic line (straight dashed line) if OSRM fails
          console.warn("Falling back to straight dashed route line", error);
          const polyline = L.polyline([[pickupLat, pickupLng], [dropLat, dropLng]], {
            color: "#10b981",
            weight: 3,
            opacity: 0.65,
            dashArray: "6, 8",
          }).addTo(map);

          routeLineRef.current = polyline;
        }
      };

      drawRoute();
    }

    // Fit map to contain both markers beautifully
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
        duration: 1.2,
      });
    }
  }, [pickupLat, pickupLng, dropLat, dropLng]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {/* Visual Overlay vignette for high-end aesthetic */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-radial-gradient from-transparent via-transparent to-slate-950/40"></div>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
