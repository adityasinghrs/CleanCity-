import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast";
import exifr from "exifr";
import Tesseract from "tesseract.js";
import { photoHash } from "../utils/phash";

const categories = ["Overflowing Bin", "Illegal Dumping", "Missed Pickup", "Hazardous Waste", "Other"];

export default function Complaint() {
  const [form, setForm] = useState({ title: "", category: categories[0], description: "", location: "" });
  const [coords, setCoords] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locSource, setLocSource] = useState("");
  const [hash, setHash] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const checkNearby = async (c, category, h = hash) => {
    try {
      const { data } = await api.get("/complaint/nearby", { params: { lat: c.lat, lng: c.lng, category, hash: h || undefined } });
      setNearby(data);
    } catch { setNearby([]); }
  };

  const changeCategory = (e) => {
    set("category")(e);
    if (coords) checkNearby(coords, e.target.value);
  };

  const applyCoords = (c, source) => {
    setCoords(c);
    setForm((f) => ({ ...f, location: `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` }));
    setLocSource(source);
    checkNearby(c, form.category);
  };

  // Manual fallback: only when the user asks for it (never silently, it may be the wrong place)
  const getDeviceLocation = () => {
    if (!navigator.geolocation) return toast("Geolocation not supported", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "device");
      },
      () => { setLocating(false); toast("Could not get device location. Type it manually.", "error"); }
    );
  };

  // Many "GPS Map Camera" apps print "Lat 12.825014, Long 77.662313" on the picture instead of
  // saving it in the file. Read that text with OCR.
  const readStampedCoords = async (file) => {
    const { data } = await Tesseract.recognize(file, "eng");
    const m = data.text.match(/lat[a-z]*[\s:.]*(-?\d{1,2}\.\d{3,})[^\d-]{0,12}long?[a-z]*[\s:.]*(-?\d{1,3}\.\d{3,})/i);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };

  const pickImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setLocSource("");
    const h = await photoHash(file); // fingerprint, so a look-alike photo nearby can be detected
    setHash(h);
    // 1) GPS saved inside the photo (EXIF)
    try {
      const gps = await exifr.gps(file);
      if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
        applyCoords({ lat: gps.latitude, lng: gps.longitude }, "photo");
        toast("Location read from photo 📍");
        return;
      }
    } catch { /* no EXIF */ }
    // 2) Coordinates printed on the photo (GPS Map Camera style)
    setLocating(true);
    try {
      const c = await readStampedCoords(file);
      if (c) {
        applyCoords(c, "stamp");
        toast("Location read from the text on the photo 📍");
        setLocating(false);
        return;
      }
    } catch { /* OCR failed */ }
    setLocating(false);
    setCoords(null);
    setForm((f) => ({ ...f, location: "" }));
    toast("No GPS found in this photo. Use current location or type it.", "error");
  };

  const upvote = async (id) => {
    try { await api.post(`/complaint/${id}/upvote`); toast("Upvoted! You earned 1 Eco-Point 🌱"); navigate("/feed"); }
    catch (e) { toast(errMsg(e), "error"); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (coords) { fd.append("lat", coords.lat); fd.append("lng", coords.lng); }
      if (image) fd.append("image", image);
      if (image && hash) fd.append("photoHash", hash);
      const { data } = await api.post("/complaint", fd);
      toast(`Submitted! Tracking ID: ${data.trackingId} (+10 Eco-Points)`);
      navigate("/my-complaints");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container narrow">
      <form className="card" onSubmit={submit}>
        <h2>Report a Garbage Issue</h2>
        <p className="muted">Give a few details so we can act quickly</p>

        <label>Title *</label>
        <input required value={form.title} onChange={set("title")} placeholder="e.g. Garbage pile near bus stop" />

        <label>Category</label>
        <select value={form.category} onChange={changeCategory}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>

        <label>Description</label>
        <textarea rows="3" value={form.description} onChange={set("description")} placeholder="Describe the problem..." />

        <label>Photo (location is taken from the photo's GPS)</label>
        <input type="file" accept="image/*" onChange={pickImage} />
        {preview && <img src={preview} alt="preview" className="preview" />}

        <label>Location *</label>
        <input required value={form.location} onChange={set("location")} placeholder="Auto-filled from photo, or type address" />
        <p className="muted small">
          {locating ? "Getting location..." :
            locSource === "photo" ? "✅ Location read from the photo" :
            locSource === "stamp" ? "✅ Location read from the coordinates printed on the photo" :
            locSource === "device" ? "📍 Using your current device location" :
            "Add a photo with GPS, or use the button / type the location."}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={getDeviceLocation} disabled={locating}>
          {locating ? "Please wait..." : "📍 Use my current location instead"}
        </button>

        {nearby.length > 0 && (
          <div className="note">
            <b>⚠️ Already reported within 150 m:</b> upvote instead of creating a duplicate.
            {nearby.map((n) => (
              <div key={n._id} className="between small" style={{ marginTop: 6 }}>
                <span>{n.title} · 👍 {n.upvoteCount}{n.visualMatch && <span className="badge red" style={{ marginLeft: 6 }}>📷 photo looks the same</span>}</span>
                <button type="button" className="btn btn-sm" onClick={() => upvote(n._id)}>👍 Me too</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-block" disabled={loading}>{loading ? "Submitting..." : "Submit Complaint"}</button>
      </form>
    </div>
  );
}