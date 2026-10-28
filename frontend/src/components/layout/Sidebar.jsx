import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  CalendarCheck,
  ShoppingCart,
  Wrench,
  DollarSign,
  LogOut,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["manager"],
  },
  {
    to: "/vehicles",
    label: "Vehicles",
    icon: Car,
    roles: ["manager", "sales_executive", "technician", "receptionist"],
  },
  {
    to: "/customers",
    label: "Customers",
    icon: Users,
    roles: ["manager", "sales_executive", "receptionist"],
  },
  {
    to: "/test-drives",
    label: "Test Drives",
    icon: CalendarCheck,
    roles: ["manager", "sales_executive", "receptionist"],
  },
  {
    to: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    roles: ["manager", "sales_executive"],
  },
  {
    to: "/service",
    label: "Service",
    icon: Wrench,
    roles: ["manager", "technician", "receptionist"],
  },
  {
    to: "/commissions",
    label: "Commissions",
    icon: DollarSign,
    roles: ["manager", "sales_executive"],
  },
];

export default function Sidebar({ onClose }) {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="h-screen w-60 bg-bg-card border-r border-bg-border flex flex-col">
      {/* Logo + mobile close */}
      <div className="p-6 border-b border-bg-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="w-6 h-6 text-accent-blue" />
          <span className="text-lg font-bold text-text-primary tracking-tight">
            AutoEdge
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden text-text-muted hover:text-text-primary"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "text-accent-blue bg-bg-elevated"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-bg-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {user?.full_name ?? "User"}
            </p>
            <p className="text-xs text-text-muted capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-status-cancelled hover:bg-bg-elevated transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
