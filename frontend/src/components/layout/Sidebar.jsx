import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  CalendarCheck,
  CalendarClock,
  ShoppingCart,
  Wrench,
  DollarSign,
  MessageSquare,
  Mail,
  Package,
  Star,
  ArrowRightLeft,
  Bookmark,
  UserCog,
  LogOut,
  X,
} from "lucide-react";
import { hasModuleAccess } from "../../utils/staffAccess";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { to: "/deals", module: "sales", label: "Deals", icon: ShoppingCart },
  {
    to: "/dashboard",
    module: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/vehicles",
    module: "vehicles",
    label: "Vehicles",
    icon: Car,
  },
  {
    to: "/customers",
    module: "customers",
    label: "Customers",
    icon: Users,
  },
  {
    to: "/test-drives",
    module: "test_drives",
    label: "Test Drives",
    icon: CalendarCheck,
  },
  {
    to: "/sales",
    module: "sales",
    label: "Sales and pickups",
    icon: ShoppingCart,
  },
  {
    to: "/reservations",
    module: "reservations",
    label: "Reservations",
    icon: Bookmark,
  },
  {
    to: "/service",
    module: "service",
    label: "Workshop jobs",
    icon: Wrench,
  },
  {
    to: "/service-bookings",
    module: "service",
    label: "Service Bookings",
    icon: CalendarClock,
  },
  {
    to: "/commissions",
    module: "commissions",
    label: "Commissions",
    icon: DollarSign,
  },
  {
    to: "/trade-ins",
    module: "trade_ins",
    label: "Trade-Ins",
    icon: ArrowRightLeft,
  },
  {
    to: "/restock-priority",
    module: "restock",
    label: "Restock Priority",
    icon: Package,
  },
  {
    to: "/reviews",
    module: "reviews",
    label: "Reviews",
    icon: Star,
  },
  {
    to: "/enquiries",
    module: "enquiries",
    label: "Enquiries",
    icon: MessageSquare,
  },
  {
    to: "/email-log",
    module: "email_log",
    label: "Email Log",
    icon: Mail,
  },
  {
    to: "/staff",
    module: "staff",
    label: "Staff",
    icon: UserCog,
  },
];

const groups = [
    ["Sales", ["sales", "reservations", "test_drives", "enquiries", "commissions"]],
    ["Inventory", ["vehicles", "trade_ins", "restock", "reviews"]],
    ["Service", ["service"]],
    ["Customers", ["customers"]],
    ["Administration", ["dashboard", "staff", "email_log"]],
  ];

export function ModuleTabs({ pathname }) {
  const { user } = useAuth();
  const active = navItems.find(item => pathname === item.to || pathname.startsWith(item.to + "/"));
  const group = groups.find(([, modules]) => modules.includes(active?.module));
  if (!group) return null;
  const items = navItems.filter(item => group[1].includes(item.module) && hasModuleAccess(user, item.module));
  if (items.length < 2) return null;
  return <nav aria-label={group[0] + " sections"} className="mb-5 flex flex-wrap gap-2 border-b border-bg-border pb-2">
    {items.map(item => <NavLink key={item.to} to={item.to} className={({isActive}) => "rounded-lg px-3 py-2 text-sm " +
      (isActive ? "bg-bg-elevated font-semibold underline" : "text-text-secondary")}>{item.label}</NavLink>)}</nav>;
}

export default function Sidebar({ onClose }) {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const visibleItems = navItems.filter((item) => hasModuleAccess(user, item.module));
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
      <nav aria-label="Staff modules" className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.length > 0 && <NavLink to="/today" onClick={onClose} className="block px-3 py-2.5 text-sm font-semibold">Today</NavLink>}
        <input aria-label="Find a staff module" placeholder="Find a module" type="search" className="input mb-2" value={search} onChange={e => setSearch(e.target.value)} />
        {groups.map(([name, modules]) => {
          const items = visibleItems.filter(i => modules.includes(i.module) && (name+" "+i.label).toLowerCase().includes(search.trim().toLowerCase()));
          return items.length > 0 && <section key={name} aria-label={name}>
          <h2 className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{name}</h2>
          {items.map(({ to, label, icon: Icon }) => (
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
          ))}</section>;
        })}
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
