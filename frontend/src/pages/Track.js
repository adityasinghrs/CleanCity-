import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../api";
import StatusBadge from "../components/StatusBadge";
import Timeline from "../components/Timeline";
import BeforeAfter from "../components/BeforeAfter";
import SlaBadge from "../components/SlaBadge";

export default function Track() {
  const { tid } = useParams();
  const [input, setInput] = useState(tid || "");
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setC(null); setError("");
    if (!tid) return;
    api.get(`/complaint/track/${tid}`).then((r) => setC(r.data)).catch((e) => setError(errMsg(e)));
  }, [tid]);

  return (
    <div className="container narrow">
      <form className="card" onSubmit={(e) => { e.preventDefault(); input.trim() && navigate(`/track/${input.trim()}`); }}>
        <h2>Track a Complaint</h2>
        <p className="muted">Enter your tracking ID. No login needed.</p>
        <div className="row">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="GMS-A1B2C3" />
          <button className="btn">Track</button>
        </div>
      </form>
      {error && <div className="card empty">{error}</div>}
      {c && (
        <div className="card complaint" style={{ marginTop: 20 }}>
          <BeforeAfter c={c} />
          <div className="body">
            <div className="between"><h3>{c.title}</h3><StatusBadge status={c.status} /></div>
            <span className="tag">{c.category}</span>
            <p className="muted small">📍 {c.location} · 🔖 {c.trackingId}</p>
            <p className="small">🤝 Service promise: <b>{c.sla?.slaHours} hours</b> (by {c.sla && new Date(c.sla.dueAt).toLocaleString()}) <SlaBadge sla={c.sla} /></p>
            {c.adminNote && <div className="note"><b>Admin note:</b> {c.adminNote}</div>}
            <h4>Progress</h4>
            <Timeline history={c.history} />
          </div>
        </div>
      )}
    </div>
  );
}
