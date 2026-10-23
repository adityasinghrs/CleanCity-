import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const features = [
  ["📸", "Photo Proof", "Attach a picture of the garbage so it can be verified quickly."],
  ["📍", "GPS Location", "One tap to capture your exact location with a map link."],
  ["🔔", "Live Tracking", "Follow your complaint from Pending to In Progress to Resolved."],
  ["🛡️", "Admin Control", "Authorities manage, update and close complaints from a dashboard."],
  ["👍", "Community Upvotes", "Neighbours back an issue and push it up the smart priority list."],
  ["🏆", "Eco-Points", "Earn points for reporting, helping and getting issues resolved."],
  ["🔎", "Track by ID", "Every complaint gets a tracking ID anyone can check, no login needed."],
  ["📷", "Before / After", "Admins upload a proof photo when the area is cleaned."],
  ["🔥", "Hotspot Intelligence", "Clusters reports to find chronic dumping spots and suggests a permanent fix."],
  ["⏱️", "Service Promise (SLA)", "Every category has a deadline; overdue issues are flagged for escalation."],
];

export default function Home() {
  const { user } = useAuth();
  const [tid, setTid] = useState("");
  const navigate = useNavigate();
  const cta = !user ? "/register" : user.role === "admin" ? "/admin" : "/complaint";

  return (
    <>
      <section className="hero">
        <h1>Keep Your City <span>Clean</span></h1>
        <p>Spot garbage? Report it in seconds and track until it is cleared.</p>
        <div className="hero-actions">
          <Link to={cta} className="btn btn-lg">{user ? (user.role === "admin" ? "Open Dashboard" : "Report an Issue") : "Get Started"}</Link>
          {!user && <Link to="/login" className="btn btn-outline btn-lg">Login</Link>}
        </div>
        <form className="track-box" onSubmit={(e) => { e.preventDefault(); tid.trim() && navigate(`/track/${tid.trim()}`); }}>
          <input value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Have a tracking ID? e.g. GMS-A1B2C3" />
          <button className="btn">Track</button>
        </form>
      </section>
      <section className="container grid4">
        {features.map(([icon, title, text]) => (
          <div className="card feature" key={title}>
            <div className="icon">{icon}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
