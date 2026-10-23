import { useEffect, useRef } from "react";

// Interactive map (Leaflet + OpenStreetMap). Leaflet is loaded from a CDN in public/index.html.
const COLORS = { High: "#dc2626", Medium: "#f59e0b", Low: "#16a34a", Done: "#64748b" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const NONE = []; // stable default so the map is not redrawn (and re-zoomed) on every parent render
const HOT = { Critical: "#b91c1c", High: "#ea580c", Watch: "#ca8a04" };

export default function MapView({ items, hotspots = NONE, route = NONE, height = 440 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const L = window.L;

  useEffect(() => {
    if (!L || !el.current) return;
    map.current = L.map(el.current).setView([22.9734, 78.6569], 5); // India overview
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [L]);

  useEffect(() => {
    if (!L || !map.current) return;
    layer.current.clearLayers();
    const pts = [];
    items.forEach((c) => {
      const co = c.coords?.coordinates;
      if (!co || co.length !== 2) return;
      const ll = [co[1], co[0]];
      pts.push(ll);
      L.circleMarker(ll, { radius: 9, color: "#fff", weight: 2, fillColor: COLORS[c.level] || "#64748b", fillOpacity: 0.95 })
        .bindPopup(`<b>${esc(c.title)}</b><br/>${esc(c.category)} · ${esc(c.level)}<br/>🔖 ${esc(c.trackingId)} · 👍 ${c.upvoteCount ?? 0}<br/><a href="/track/${esc(c.trackingId)}">Track</a>`)
        .addTo(layer.current);
    });
    // Hotspot Intelligence: translucent circles around chronic spots, drawn under the pins
    hotspots.forEach((h) => {
      const col = HOT[h.level] || HOT.Watch;
      L.circle([h.center.lat, h.center.lng], { radius: h.radius, color: col, weight: 2, dashArray: "6 4", fillColor: col, fillOpacity: 0.18 })
        .bindPopup(`<b>🔥 ${esc(h.level)} hotspot</b><br/>${h.total} reports · ${h.open} open · cleaned and back ${h.recurrences}x<br/>${esc(h.recommendation)}`)
        .addTo(layer.current);
      pts.push([h.center.lat, h.center.lng]);
    });
    // Smart Crew Route: numbered stops joined by a line, in visiting order
    if (route.length) {
      const line = route.map((s) => [s.lat, s.lng]);
      L.polyline(line, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(layer.current);
      route.forEach((s) => {
        L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [26, 26], html: `<div class="route-pin${s.overdue ? " late" : ""}">${Number(s.order)}</div>` }) })
          .bindPopup(`<b>Stop ${Number(s.order)}: ${esc(s.title)}</b><br/>${esc(s.category)} · ${esc(s.trackingId)}<br/>ETA +${Number(s.etaMinutes)} min${s.overdue ? " · ⏰ overdue" : ""}`)
          .addTo(layer.current);
      });
      pts.push(...line);
    }
    if (pts.length) map.current.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  }, [items, hotspots, route, L]);

  if (!L) return <div className="card empty">Map could not load (check your internet connection).</div>;
  const located = items.filter((c) => c.coords?.coordinates?.length === 2).length;
  return (
    <div>
      <div ref={el} className="map" style={{ height }} />
      <p className="muted small">
        {located} of {items.length} issues have GPS location ·{" "}
        <span style={{ color: COLORS.High }}>● High</span> <span style={{ color: COLORS.Medium }}>● Medium</span>{" "}
        <span style={{ color: COLORS.Low }}>● Low</span>{hotspots.length > 0 && <> · <span style={{ color: HOT.Critical }}>◌ dashed circle = hotspot</span></>}
      </p>
    </div>
  );
}
