import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { authStore } from "../../store/authStore";
import ErrorBoundary from "../common/ErrorBoundary";
import ModalOverlay from "../common/ModalOverlay";
import Sidebar, { ModuleTabs } from "./Sidebar";
import Topbar from "./Topbar";

export default function PageWrapper() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (desktop.matches) setSidebarOpen(false); };
    desktop.addEventListener('change', onResize);
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
      desktop.removeEventListener('change', onResize);
      active = false;
      window.removeEventListener("focus", refreshSession);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {sidebarOpen && <ModalOverlay aria-label="Staff navigation" className="bg-black/60"
        onDismiss={() => setSidebarOpen(false)} onClick={e => { if (e.target === e.currentTarget) setSidebarOpen(false); }}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </ModalOverlay>}
      <div className="fixed left-0 top-0 z-40 hidden h-screen lg:block">
        <Sidebar />
      </div>

      {/* Topbar */}
      <Topbar onMenuClick={() => setSidebarOpen(true)} />

      {/* Main content */}
      <main className="lg:ml-60 pt-16 min-h-screen">
        <div className="p-4 sm:p-6"><ModuleTabs pathname={location.pathname} /><ErrorBoundary key={location.key}><Outlet /></ErrorBoundary></div>
      </main>
    </div>
  );
}
