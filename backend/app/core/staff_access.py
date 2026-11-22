"""Effective staff access, with existing role permissions as the ceiling."""

ROLES = ("manager", "sales_executive", "receptionist", "technician")

MODULES = (
    "dashboard", "vehicles", "customers", "sales", "reservations", "test_drives",
    "service", "trade_ins", "restock", "reviews", "enquiries", "commissions",
    "email_log", "staff",
)
ACCESS_LEVELS = ("none", "view", "full")
ROLE_ACCESS = {
    "sales_executive": {
        "vehicles": "full", "customers": "full", "sales": "full", "reservations": "view",
        "test_drives": "full", "trade_ins": "full", "restock": "full",
        "enquiries": "full", "commissions": "view",
    },
    "receptionist": {
        "vehicles": "view", "customers": "full", "reservations": "view",
        "test_drives": "full", "service": "full", "enquiries": "full",
    },
    "technician": {"vehicles": "view", "service": "full"},
}


def effective_access(role: str, overrides: dict | None, handles_enquiries: bool) -> dict[str, str]:
    if role == "manager":
        return dict.fromkeys(MODULES, "full")
    preset = ROLE_ACCESS.get(role, {})
    overrides = overrides or {}
    result = {}
    for module in MODULES:
        maximum = preset.get(module, "none")
        requested = overrides.get(module, maximum)
        if requested not in ACCESS_LEVELS:
            requested = "none"
        result[module] = ACCESS_LEVELS[min(ACCESS_LEVELS.index(maximum), ACCESS_LEVELS.index(requested))]
    if not handles_enquiries:
        result["enquiries"] = "none"
    return result
