import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { authStore } from "../../store/authStore";
import ErrorBoundary from "../common/ErrorBoundary";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function PageWrapper() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    function refreshSession() {
      const { token } = authStore.getState();
      authApi.me().then((user) => {
        if (active && authStore.getState().token === token) authStore.login(token, user);
      }).catch(() => {});
    }
    refreshSession();
    window.addEventListener("focus", refreshSession);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshSession);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen z-40 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Topbar */}
      <Topbar onMenuClick={() => setSidebarOpen(true)} />

      {/* Main content */}
      <main className="lg:ml-60 pt-16 min-h-screen">
        <div className="p-4 sm:p-6"><ErrorBoundary key={location.key}><Outlet /></ErrorBoundary></div>
      </main>
    </div>
  );
}
