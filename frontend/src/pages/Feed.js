import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import BeforeAfter from "../components/BeforeAfter";
import MapView from "../components/MapView";
import SlaBadge from "../components/SlaBadge";

export default function Feed() {
  const [list, setList] = useState([]);
  const [board, setBoard] = useState([]);
  const [view, setView] = useState("list");
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const load = () =>
    Promise.all([api.get("/complaint/feed"), api.get("/auth/leaderboard")])
      .then(([a, b]) => { setList(a.data); setBoard(b.data); })
      .catch((e) => toast(errMsg(e), "error"));
  // eslint-disable-next-line
  useEffect(() => { load(); }, []);

  const upvote = async (id) => {
    if (!user) return navigate("/login");
    try { const { data } = await api.post(`/complaint/${id}/upvote`); toast(data.upvoted ? "Upvoted 👍" : "Upvote removed"); load(); }
    catch (e) { toast(errMsg(e), "error"); }
  };

  return (
    <div className="container">
      <h2>Community Issues</h2>
      <p className="muted">Open problems around the city, sorted by smart priority. Upvote what you see too.</p>
      <div className="feed-layout">
        <div>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>📋 List</button>
          <button className={`chip ${view === "map" ? "active" : ""}`} onClick={() => setView("map")}>🗺️ Map</button>
        </div>
        {view === "map" ? <MapView items={list} /> : (
        <div className="grid3 feed-grid">
          {list.length === 0 && <div className="card empty">No open issues. Clean city! 🎉</div>}
          {list.map((c) => (
            <div className="card complaint" key={c._id}>
              <BeforeAfter c={c} />
              <div className="body">
                <div className="between"><h3>{c.title}</h3><StatusBadge status={c.status} /></div>
                <span className="tag">{c.category}</span> <PriorityBadge level={c.level} score={c.priority} /> <SlaBadge sla={c.sla} compact />
                <p className="muted small">📍 {c.location}</p>
                <div className="between">
                  <span className="muted small">🔖 {c.trackingId}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => upvote(c._id)}>👍 {c.upvoteCount}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
        </div>
        <aside className="card board">
          <h3>🏆 Top Citizens</h3>
          {board.length === 0 && <p className="muted small">Be the first on the board!</p>}
          <ol>{board.map((u) => <li key={u._id}><span>{u.name}</span><b>{u.points}</b></li>)}</ol>
          <p className="muted small">+10 report · +2 per upvote received · +20 when resolved</p>
        </aside>
      </div>
    </div>
  );
}
