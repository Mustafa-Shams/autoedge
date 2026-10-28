export function hasRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

export function canAccess(userRole, feature) {
  const permissions = {
    dashboard:          ["manager"],
    vehicles_write:     ["manager", "sales_executive"],
    vehicles_delete:    ["manager"],
    customers_write:    ["manager", "sales_executive", "receptionist"],
    test_drives_write:  ["manager", "sales_executive", "receptionist"],
    sales_write:        ["manager", "sales_executive"],
    sales_view_all:     ["manager"],
    service_write:      ["manager", "technician", "receptionist"],
    service_update:     ["manager", "technician"],
    commissions_all:    ["manager"],
    commissions_approve:["manager"],
    users_manage:       ["manager"],
  };
  return permissions[feature]?.includes(userRole) ?? false;
}
