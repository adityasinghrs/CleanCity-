import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="brand">♻️ CleanCity</Link>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/feed">Community</NavLink>
        <NavLink to="/track">Track</NavLink>
        <NavLink to="/transparency">Transparency</NavLink>
        {user?.role === "user" && (
          <>
            <NavLink to="/complaint">Report Issue</NavLink>
            <NavLink to="/my-complaints">My Complaints</NavLink>
          </>
        )}
        {user?.role === "admin" && <NavLink to="/admin">Dashboard</NavLink>}
        {!user ? (
          <>
            <NavLink to="/login">Login</NavLink>
            <Link to="/register" className="btn btn-sm">Sign up</Link>
          </>
        ) : (
          <>
            <NavLink to="/profile" className="hello">👋 {user.name}</NavLink>
            <button className="btn btn-outline btn-sm" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
