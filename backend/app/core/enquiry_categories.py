"""Enquiry categories and which staff role handles each one.

The column stays free text (older installations may hold other values); the API accepts only CATEGORIES.
Rows with no recognised category are treated as Vehicle/Price when they concern a car or purchase,
otherwise as General.
"""
from sqlalchemy import and_, case, or_

from app.models.enquiry import Enquiry

CATEGORIES = ("Vehicle/Price", "Finance", "Service", "General")
ROLE_CATEGORIES = {
    "sales_executive": ("Vehicle/Price", "Finance"),
    "receptionist": ("Service", "General"),
}
# Unclaimed work in the Today queue goes to this role.
DUTY_ROLE = {"Vehicle/Price": "sales_executive", "Finance": "sales_executive",
             "Service": "receptionist", "General": "receptionist"}


def default_category(vehicle_id=None, sale_id=None):
    return "Vehicle/Price" if vehicle_id or sale_id else "General"


def effective_category(enquiry):
    if enquiry.category in CATEGORIES:
        return enquiry.category
    return default_category(enquiry.vehicle_id, enquiry.sale_id)


def category_expression():
    """SQL equivalent of effective_category for filtering."""
    return case(
        (Enquiry.category.in_(CATEGORIES), Enquiry.category),
        (or_(Enquiry.vehicle_id.isnot(None), Enquiry.sale_id.isnot(None)), "Vehicle/Price"),
        else_="General",
    )


def categories_for(user):
    if user.role == "manager":
        return CATEGORIES
    return ROLE_CATEGORIES.get(user.role, ())


def can_see(user, enquiry):
    return (user.role == "manager" or enquiry.assigned_to == user.user_id
            or effective_category(enquiry) in categories_for(user))


def visible_filter(user):
    """Filter clause for enquiries the staff member may read; None means everything."""
    if user.role == "manager":
        return None
    return or_(Enquiry.assigned_to == user.user_id,
               and_(category_expression().in_(categories_for(user))))


def label(enquiry):
    return f"{effective_category(enquiry)} · {enquiry.subject}"
