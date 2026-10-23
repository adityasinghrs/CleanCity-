import { useState } from "react";
import api, { errMsg } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put("/auth/change-password", form);
      toast("Password updated ✅");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container narrow">
      <form className="card" onSubmit={submit}>
        <h2>My Profile</h2>
        <p className="muted">{user.name} · {user.email} · {user.role}</p>
        <h3>Change password</h3>
        <label>Current password</label>
        <input type="password" required autoComplete="current-password" value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <label>New password</label>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="Min 8 chars, letters + numbers" />
        <button className="btn btn-block" disabled={loading}>{loading ? "Saving..." : "Update password"}</button>
      </form>
    </div>
  );
}
