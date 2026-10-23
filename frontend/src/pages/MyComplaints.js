import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import Timeline from "../components/Timeline";
import BeforeAfter from "../components/BeforeAfter";

export default function MyComplaints() {
  const [list, setList] = useState([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get("/complaint/mine"), api.get("/auth/me")])
      .then(([a, b]) => { setList(a.data); setPoints(b.data.points || 0); })
      .catch((e) => toast(errMsg(e), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  return (
    <div className="container">
      <div className="page-head">
        <div><h2>My Complaints</h2><span className="pill">🌱 {points} Eco-Points</span></div>
        <Link to="/complaint" className="btn btn-sm">+ New Complaint</Link>
      </div>
      {loading && <p className="muted">Loading...</p>}
      {!loading && list.length === 0 && <div className="card empty">You have not reported anything yet.</div>}
      <div className="grid3">
        {list.map((c) => (
          <div className="card complaint" key={c._id}>
            <BeforeAfter c={c} />
            <div className="body">
              <div className="between"><h3>{c.title}</h3><StatusBadge status={c.status} /></div>
              <span className="tag">{c.category}</span>
              <p className="muted small">🔖 <Link to={`/track/${c.trackingId}`}>{c.trackingId}</Link> · 👍 {c.upvoteCount}</p>
              {c.description && <p>{c.description}</p>}
              <p className="muted small">📍 {c.location}</p>
              <p className="muted small">🕒 {new Date(c.createdAt).toLocaleString()}</p>
              {c.adminNote && <div className="note"><b>Admin note:</b> {c.adminNote}</div>}
              <details><summary>View timeline</summary><Timeline history={c.history} /></details>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
