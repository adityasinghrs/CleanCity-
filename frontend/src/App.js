import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./components/Toast";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Complaint from "./pages/Complaint";
import MyComplaints from "./pages/MyComplaints";
import Admin from "./pages/Admin";
import Feed from "./pages/Feed";
import Track from "./pages/Track";
import Profile from "./pages/Profile";
import Transparency from "./pages/Transparency";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/complaint" element={<ProtectedRoute role="user"><Complaint /></ProtectedRoute>} />
              <Route path="/my-complaints" element={<ProtectedRoute role="user"><MyComplaints /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/transparency" element={<Transparency />} />
              <Route path="/track" element={<Track />} />
              <Route path="/track/:tid" element={<Track />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="footer">♻️ CleanCity · Garbage Management System</footer>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
