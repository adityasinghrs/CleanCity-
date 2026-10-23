import { useEffect, useState } from "react";
import api, { errMsg } from "../api";

const show = (v, unit = "") => (v == null ? "—" : `${v}${unit}`);

// Public page: shows citizens how the city is really performing (no login, no personal data)
export default function Transparency() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/complaint/public-stats").then((r) => setS(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="container"><div className="card empty">{error}</div></div>;
  if (!s) return <div className="container"><div className="card empty">Loading…</div></div>;

  const max = Math.max(1, ...s.byCategory.map((r) => r.n));
  return (
    <div className="container">
      <div className="page-head"><h2>📊 City Transparency</h2></div>
      <p className="muted">Live numbers from every complaint filed on CleanCity. The city is judged against its own promised deadlines (SLA).</p>
      <div className="grid4 stats">
        <div className="card stat slate"><span>Total reports</span><b>{s.total}</b></div>
        <div className="card stat green"><span>Resolved</span><b>{show(s.resolutionRatePct, "%")}</b></div>
        <div className="card stat blue"><span>Resolved within promise</span><b>{show(s.slaComplianceOfResolvedPct, "%")}</b></div>
        <div className="card stat orange"><span>Overdue right now</span><b>{s.overdue}</b></div>
      </div>
      <div className="grid3">
        <div className="card stat green"><span>Average time to resolve</span><b>{show(s.avgResolutionHours, " h")}</b></div>
        <div className="card"><h4>Reports by category</h4>
          {s.byCategory.map((r) => (
            <div className="bar-row" key={r.category}><span>{r.category}</span><div className="bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></div><b>{r.n}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}
