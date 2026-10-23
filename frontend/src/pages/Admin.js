import { useCallback, useEffect, useState } from "react";
import api, { img, errMsg } from "../api";
import { useToast } from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import Timeline from "../components/Timeline";
import BeforeAfter from "../components/BeforeAfter";
import MapView from "../components/MapView";
import SlaBadge from "../components/SlaBadge";
import { photoHash } from "../utils/phash";

const STATUSES = ["Pending", "In Progress", "Resolved"];

const mapLink = (loc) => {
  const m = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/.exec(loc || "");
  return m ? `https://www.google.com/maps?q=${m[1]},${m[2]}` : `https://www.google.com/maps/search/${encodeURIComponent(loc || "")}`;
};

const Bars = ({ rows, label, value }) => {
  const max = Math.max(1, ...rows.map(value));
  return rows.map((r, i) => (
    <div className="bar-row" key={i}>
      <span>{label(r)}</span>
      <div className="bar"><i style={{ width: `${(value(r) / max) * 100}%` }} /></div>
      <b>{value(r)}</b>
    </div>
  ));
};

export default function Admin() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, byCategory: [], days: [], avgResolutionHours: null });
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounced search sent to the server
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState("list");
  const [mapItems, setMapItems] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [overdue, setOverdue] = useState(false);          // SLA filter: only overdue complaints
  const [showHot, setShowHot] = useState(false);          // Hotspot Intelligence panel
  const [hot, setHot] = useState({ hotspots: [], analysed: 0 });
  const [radius, setRadius] = useState(100);              // hotspot radius in metres (applied when the slider is released)
  const [radiusDraft, setRadiusDraft] = useState(100);
  const [showRoute, setShowRoute] = useState(false);     // Smart Crew Route Planner panel
  const [plan, setPlan] = useState(null);
  const [maxStops, setMaxStops] = useState(8);
  const [fromMe, setFromMe] = useState(false);            // start the route from the admin's current GPS position
  const [planning, setPlanning] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const params = { page, limit: 12, q, ...(filter !== "All" && { status: filter }), ...(overdue && { sla: "overdue" }) };
      const [a, b] = await Promise.all([api.get("/complaint", { params }), api.get("/complaint/stats")]);
      setList(a.data.items);
      setPages(a.data.pages);
      setTotal(a.data.total);
      setStats(b.data);
      if (view === "map" || showHot) setMapItems((await api.get("/complaint/map")).data);
      if (showHot) setHot((await api.get("/complaint/hotspots", { params: { radius } })).data);
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }, [toast, page, q, filter, view, overdue, showHot, radius]);

  useEffect(() => { load(); }, [load]);

  const makePlan = async () => {
    setPlanning(true);
    try {
      const params = { stops: maxStops };
      if (fromMe) {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
        params.lat = pos.coords.latitude; params.lng = pos.coords.longitude;
      }
      setPlan((await api.get("/complaint/route", { params })).data);
      setMapItems((await api.get("/complaint/map")).data);
    } catch (e) { toast(typeof e?.code === "number" ? "Could not read your location. Untick 'start from my location'." : errMsg(e), "error"); }
    finally { setPlanning(false); }
  };

  // wait 350 ms after typing stops, then search on the server (and go back to page 1)
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const update = async (id, body, msg) => {
    try {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, v));
      await api.put(`/complaint/${id}`, fd);
      toast(msg); load();
    } catch (e) { toast(errMsg(e), "error"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this complaint permanently?")) return;
    try { await api.delete(`/complaint/${id}`); toast("Complaint deleted"); load(); }
    catch (e) { toast(errMsg(e), "error"); }
  };

  const editNote = (c) => {
    const note = window.prompt("Note for the user:", c.adminNote || "");
    if (note !== null) update(c._id, { adminNote: note }, "Note saved");
  };

  const proof = async (c, file) => {
    if (!file) return;
    const proofHash = await photoHash(file); // lets the server check the "after" photo is not just the "before" photo
    update(c._id, { status: "Resolved", resolvedImage: file, ...(proofHash && { proofHash }) }, "Resolved with proof photo ✅");
  };

  const exportCsv = async () => {
    let all = list;
    try {
      all = [];
      for (let p = 1, n = 1; p <= n; p++) {
        const { data } = await api.get("/complaint", { params: { page: p, limit: 50, q, ...(filter !== "All" && { status: filter }), ...(overdue && { sla: "overdue" }) } });
        all.push(...data.items); n = data.pages;
      }
    } catch (e) { return toast(errMsg(e), "error"); }
    const rows = [["TrackingID", "Title", "Category", "Status", "Priority", "SLA hours", "Overdue", "Location", "User", "Created"],
      ...all.map((c) => [c.trackingId, c.title, c.category, c.status, c.level, c.sla?.slaHours, c.sla?.overdue ? "YES" : "no", c.location, c.user?.name, new Date(c.createdAt).toLocaleString()])];
    const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "complaints.csv";
    a.click();
  };

  const shown = list; // filtering, search and pagination happen on the server

  const cards = [
    ["Total", stats.total, "slate"],
    ["Pending", stats.pending, "orange"],
    ["In Progress", stats.inProgress, "blue"],
    ["Resolved", stats.resolved, "green"],
  ];

  return (
    <div className="container">
      <div className="page-head"><h2>Admin Dashboard</h2><button className="btn btn-outline btn-sm" onClick={exportCsv}>⬇ Export CSV</button></div>
      <div className="grid4 stats">
        {cards.map(([label, n, color]) => (
          <div key={label} className={`card stat ${color}`}><span>{label}</span><b>{n}</b></div>
        ))}
      </div>

      <div className="grid3 analytics">
        <div className="card"><h4>By category</h4><Bars rows={stats.byCategory} label={(r) => r.category} value={(r) => r.n} /></div>
        <div className="card"><h4>Last 7 days</h4><Bars rows={stats.days} label={(r) => r.day} value={(r) => r.n} /></div>
        <div className="card stat green"><span>Avg. resolution time</span>
          <b>{stats.avgResolutionHours == null ? "—" : `${stats.avgResolutionHours} h`}</b></div>
      </div>

      <div className="toolbar">
        <input placeholder="🔍 Search title, ID, location, user..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="chips">
          {["All", ...STATUSES].map((s) => (
            <button key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => { setFilter(s); setPage(1); }}>{s}</button>
          ))}
          <button className={`chip ${overdue ? "active" : ""}`} onClick={() => { setOverdue(!overdue); setPage(1); }}>⏰ Overdue (SLA)</button>
          <button className={`chip ${view === "map" ? "active" : ""}`} onClick={() => setView(view === "map" ? "list" : "map")}>🗺️ Map</button>
          <button className={`chip ${showHot ? "active" : ""}`} onClick={() => setShowHot(!showHot)}>🔥 Hotspots</button>
          <button className={`chip ${showRoute ? "active" : ""}`} onClick={() => setShowRoute(!showRoute)}>🚚 Crew Route</button>
        </div>
      </div>

      {showHot && (
        <div className="card hot-panel">
          <div className="between">
            <div>
              <h3 style={{ margin: 0 }}>🔥 Hotspot Intelligence</h3>
              <p className="muted small">Reports (including resolved ones) are clustered with DBSCAN. A spot that was cleaned and then reported again is a chronic hotspot.</p>
            </div>
            <label className="small" style={{ margin: 0, minWidth: 190 }}>Cluster radius: <b>{radiusDraft} m</b>
              <input type="range" min="50" max="300" step="10" value={radiusDraft} onChange={(e) => setRadiusDraft(+e.target.value)}
                onMouseUp={() => setRadius(radiusDraft)} onTouchEnd={() => setRadius(radiusDraft)} onKeyUp={() => setRadius(radiusDraft)} />
            </label>
          </div>
          <MapView items={mapItems} hotspots={hot.hotspots} height={360} />
          {hot.hotspots.length === 0 && <p className="empty">No hotspots yet. Need {hot.minReports || 3}+ reports within {radius} m ({hot.analysed} located reports analysed).</p>}
          <div className="grid3">
            {hot.hotspots.map((h, i) => (
              <div className={`hot-card ${h.level}`} key={i}>
                <div className="between"><b>#{i + 1} · {h.level}</b><span className="muted small">score {h.score}</span></div>
                <p className="small">📍 {h.sampleLocation}</p>
                <p className="small">{h.total} reports · <b>{h.open} open</b> · came back after cleanup: <b>{h.recurrences}×</b></p>
                <p className="small"><span className="tag">{h.dominantCategory}</span></p>
                <div className="note">💡 {h.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRoute && (
        <div className="card hot-panel">
          <div className="between">
            <div>
              <h3 style={{ margin: 0 }}>🚚 Smart Crew Route Planner</h3>
              <p className="muted small">Picks the most urgent open complaints (priority + overdue SLA + hotspot bonus) and orders them so urgent work is reached first with the least driving.</p>
            </div>
            <div className="row" style={{ alignItems: "center" }}>
              <label className="small" style={{ margin: 0 }}>Stops: <b>{maxStops}</b>
                <input type="range" min="2" max="15" value={maxStops} onChange={(e) => setMaxStops(+e.target.value)} />
              </label>
              <label className="small" style={{ margin: 0 }}><input type="checkbox" checked={fromMe} onChange={(e) => setFromMe(e.target.checked)} style={{ width: "auto" }} /> start from my location</label>
              <button className="btn btn-sm" disabled={planning} onClick={makePlan}>{planning ? "Planning…" : "Plan route"}</button>
            </div>
          </div>
          {plan && plan.stops.length === 0 && <p className="empty">No open complaints with GPS location to plan.</p>}
          {plan && plan.stops.length > 0 && (
            <>
              <MapView items={mapItems} route={plan.stops} height={360} />
              <div className="grid4 stats">
                <div className="card stat blue"><span>Total drive</span><b>{plan.totalKm} km</b></div>
                <div className="card stat orange"><span>Crew time (est.)</span><b>{Math.round(plan.etaMinutes / 6) / 10} h</b></div>
                <div className="card stat green"><span>Less driving vs priority order</span><b>{plan.improvement.distancePct}%</b></div>
                <div className="card stat slate"><span>Urgent work reached sooner</span><b>{plan.improvement.urgencyDelayPct}%</b></div>
              </div>
              <ol className="route-list">
                {plan.stops.map((s) => (
                  <li key={s.trackingId}>
                    <b>{s.title}</b> <span className="tag">{s.category}</span> {s.overdue && <span className="tag late">⏰ overdue</span>}
                    <span className="muted small"> · {s.trackingId} · +{(s.legMeters / 1000).toFixed(1)} km · arrive in ~{s.etaMinutes} min · 📍 {s.location}</span>
                  </li>
                ))}
              </ol>
              <p className="muted small">Considered {plan.considered} open complaints. Assumes 20 km/h city driving and 15 min of work per stop.</p>
            </>
          )}
        </div>
      )}

      {view === "map" && !showHot && !showRoute && <MapView items={mapItems} />}

      {shown.length === 0 && <div className="card empty">No complaints found</div>}

      <div className="grid3">
        {shown.map((c) => (
          <div className="card complaint" key={c._id}>
            <div onClick={() => c.image && setZoom(img(c.image))}><BeforeAfter c={c} /></div>
            <div className="body">
              <div className="between"><h3>{c.title}</h3><StatusBadge status={c.status} /></div>
              <span className="tag">{c.category}</span> <PriorityBadge level={c.level} score={c.priority} /> <SlaBadge sla={c.sla} />
              {c.description && <p>{c.description}</p>}
              <p className="muted small">🔖 {c.trackingId} · 👍 {c.upvoteCount}</p>
              <p className="muted small">👤 {c.user?.name || "Unknown"} ({c.user?.email || "-"})</p>
              <p className="muted small">📍 <a href={mapLink(c.location)} target="_blank" rel="noreferrer">{c.location}</a></p>
              <p className="muted small">🕒 {new Date(c.createdAt).toLocaleString()}</p>
              {c.possibleDuplicateOf && <div className="note">📷 Photo looks like <a href={`/track/${c.possibleDuplicateOf}`}>{c.possibleDuplicateOf}</a>. Possible duplicate.</div>}
              {c.proofWarning && <div className="note danger">⚠️ {c.proofWarning}</div>}
              {c.adminNote && <div className="note"><b>Note:</b> {c.adminNote}</div>}
              <details><summary>Timeline</summary><Timeline history={c.history} /></details>
              <div className="actions">
                <select value={c.status} onChange={(e) => update(c._id, { status: e.target.value }, "Status updated")}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" onClick={() => editNote(c)}>📝 Note</button>
                <label className="btn btn-outline btn-sm">📷 Proof
                  <input type="file" accept="image/*" hidden onChange={(e) => proof(c, e.target.files[0])} />
                </label>
                <button className="btn btn-danger btn-sm" onClick={() => remove(c._id)}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pager">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
        <span className="muted small">Page {page} of {pages} · {total} complaints</span>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
      </div>

      {zoom && (
        <div className="modal" onClick={() => setZoom(null)}>
          <img src={zoom} alt="full" />
        </div>
      )}
    </div>
  );
}
