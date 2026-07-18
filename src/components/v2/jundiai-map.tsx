/** Real map of Jundiaí (OpenStreetMap tiles via Leaflet), colored by approval per bairro.
 *  SSR-safe: Leaflet is dynamically imported inside useEffect, so it never runs on the server.
 *  Bairros without coordinates are handled by the caller (unknown-to-Maps flow in Território). */
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapBairro = {
  name: string;
  approval: number;
  msgs: number;
  tone: "green" | "warn" | "crit" | "flat";
  lat: number;
  lng: number;
  linked?: boolean; // was an unknown bairro the user linked to this location
};

/** Mirrors the v2 alert-level tokens (--v2-green / warn-strong / crit / faint).
 *  Leaflet draws on canvas/SVG via its JS API, so raw values are required here. */
const TONE_HEX: Record<MapBairro["tone"], string> = {
  green: "#0e7b5b",
  warn: "#e0a33b",
  crit: "#c43d2b",
  flat: "#a39d92",
};

export function JundiaiMap({ bairros, caption }: { bairros: MapBairro[]; caption: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const pts: [number, number][] = [];
      for (const b of bairros) {
        L.circleMarker([b.lat, b.lng], {
          radius: 9 + Math.min(9, Math.round(b.msgs / 55)),
          color: "#ffffff",
          weight: 2,
          fillColor: TONE_HEX[b.tone],
          fillOpacity: 0.85,
          dashArray: b.linked ? "3 3" : undefined,
        })
          .addTo(map)
          .bindTooltip(`${b.name} · ${b.approval}%`, { direction: "top", offset: [0, -4] })
          .bindPopup(
            `<b>${b.name}</b><br>${b.approval}% aprovação · ${b.msgs} msgs${
              b.linked ? "<br><i>vinculado manualmente</i>" : ""
            }`,
          );
        pts.push([b.lat, b.lng]);
      }
      if (pts.length > 1) map.fitBounds(pts, { padding: [42, 42] });
      else if (pts.length === 1) map.setView(pts[0], 13);
      else map.setView([-23.1857, -46.8978], 12); // Jundiaí centro
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [bairros]);

  return (
    <div className="relative h-[420px] w-full">
      <div ref={ref} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 z-[1000] grid place-items-center bg-v2-track font-mono text-[11px] tracking-[0.1em] text-v2-ink-3">
          CARREGANDO MAPA DE JUNDIAÍ…
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-md bg-white/85 px-2.5 py-[5px] font-mono text-[10px] font-semibold tracking-[0.1em] text-v2-ink-3">
        {caption}
      </div>
    </div>
  );
}
