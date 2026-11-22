export const STAFF_ROLES = {
  manager: "Manager",
  sales_executive: "Sales Executive",
  receptionist: "Receptionist",
  technician: "Technician",
};

export const MODULE_LABELS = {
  dashboard: "Dashboard", vehicles: "Vehicles", customers: "Customers", sales: "Sales",
  reservations: "Reservations", test_drives: "Test Drives", service: "Service",
  trade_ins: "Trade-Ins", restock: "Restock Priority", reviews: "Reviews",
  enquiries: "Enquiries", commissions: "Commissions", email_log: "Email Log", staff: "Staff",
};

export const ACCESS_LABELS = { none: "No access", view: "View only", full: "Full access" };

const ROLE_PRESETS = {
  sales_executive: {
    vehicles: "full", customers: "full", sales: "full", reservations: "view",
    test_drives: "full", trade_ins: "full", restock: "full", enquiries: "full", commissions: "view",
  },
  receptionist: {
    vehicles: "view", customers: "full", reservations: "view", test_drives: "full",
    service: "full", enquiries: "full",
  },
  technician: { vehicles: "view", service: "full" },
};

export function roleAccess(role, module) {
  return role === "manager" ? "full" : (ROLE_PRESETS[role]?.[module] ?? "none");
}

export function hasModuleAccess(user, module, write = false) {
  if (!user) return false;
  if (module === "enquiries" && user.role !== "manager" && !user.handles_enquiries) return false;
  const level = user.access?.[module] ?? roleAccess(user.role, module);
  return write ? level === "full" : level !== "none";
}

const LANDING_PAGES = {
  dashboard: "/dashboard", vehicles: "/vehicles", customers: "/customers", sales: "/sales",
  reservations: "/reservations", test_drives: "/test-drives", service: "/service",
  trade_ins: "/trade-ins", restock: "/restock-priority", reviews: "/reviews",
  enquiries: "/enquiries", commissions: "/commissions", email_log: "/email-log", staff: "/staff",
};

export function staffHome(user) {
  const firstModule = Object.keys(LANDING_PAGES).find((module) => hasModuleAccess(user, module));
  return firstModule ? LANDING_PAGES[firstModule] : "/access-unavailable";
}
