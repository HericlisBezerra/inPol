/** Real map of Jundiaí (OpenStreetMap tiles via Leaflet), colored by sentiment/approval per bairro.
 *  SSR-safe: Leaflet is dynamically imported inside useEffect, so it never runs on the server.
 *  Each bairro is drawn as a range circle (raio em metros — escala com o zoom) preenchido pelo tom
 *  de sentimento, com rótulo permanente do índice (aprovação %). Bairros without coordinates are
 *  handled by the caller (unknown-to-Maps flow in Território). */
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapBairro = {
  name: string;
  approval: number;
  sentiment: number; // média -1..1
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

/** Raio (em metros) do alcance de cada bairro — cresce com o volume de mensagens,
 *  com piso/teto para manter a leitura no zoom de cidade. */
function rangeMeters(msgs: number): number {
  return Math.round(450 + Math.min(1150, msgs * 5));
}

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

      for (const b of bairros) {
        const color = TONE_HEX[b.tone];
        const sentStr = `${b.sentiment >= 0 ? "+" : ""}${b.sentiment.toFixed(2)}`;
        const popup = `<b>${b.name}</b><br>${b.approval}% aprovação · sentimento ${sentStr} · ${b.msgs} msgs${
          b.linked ? "<br><i>vinculado manualmente</i>" : ""
        }`;

        // Área/alcance do bairro (raio em metros → escala com o zoom).
        L.circle([b.lat, b.lng], {
          radius: rangeMeters(b.msgs),
          color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.28,
          dashArray: b.linked ? "5 5" : undefined,
        })
          .addTo(map)
          .bindPopup(popup)
          // Rótulo permanente com o índice de sentimento (aprovação %) sobre o bairro.
          .bindTooltip(`<span class="pct">${b.approval}%</span><span class="nm">${b.name}</span>`, {
            permanent: true,
            direction: "center",
            className: "bairro-label",
            opacity: 1,
          });

        // Ponto central (marca o local exato do bairro).
        L.circleMarker([b.lat, b.lng], {
          radius: 3,
          color: "#ffffff",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(popup);
      }
      if (bairros.length > 0) {
        const group = L.featureGroup(
          bairros.map((b) => L.circle([b.lat, b.lng], { radius: rangeMeters(b.msgs) })),
        );
        map.fitBounds(group.getBounds(), { padding: [30, 30] });
      } else {
        map.setView([-23.1857, -46.8978], 12); // Jundiaí centro
      }
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
