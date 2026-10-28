import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/vehicles": "Vehicle Inventory",
  "/customers": "Customers",
  "/test-drives": "Test Drives",
  "/sales": "Sales",
  "/service": "Service Jobs",
  "/commissions": "Commissions",
};

const ROLE_LABELS = {
  manager: "Manager",
  sales_executive: "Sales Executive",
  technician: "Technician",
  receptionist: "Receptionist",
};

const ROLE_COLORS = {
  manager: "bg-status-available/20 text-status-available",
  sales_executive: "bg-accent-blue/20 text-accent-blue",
  technician: "bg-status-reserved/20 text-status-reserved",
  receptionist: "bg-status-sold/20 text-status-sold",
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const { role, user } = useAuth();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ?? "AutoEdge";

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-60 h-16 bg-bg-card border-b border-bg-border flex items-center justify-between px-4 sm:px-6 z-30">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-text-muted hover:text-text-primary"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            ROLE_COLORS[role] ?? "bg-bg-elevated text-text-secondary"
          }`}
        >
          {ROLE_LABELS[role] ?? role}
        </span>
        <span className="hidden sm:block text-sm text-text-secondary">
          {user?.full_name}
        </span>
      </div>
    </header>
  );
}
