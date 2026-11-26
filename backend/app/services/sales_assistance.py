from app.core.time import utcnow
from app.models.enquiry import Enquiry, EnquiryMessage
from app.models.sales_assistance import SalesAssistance
from app.models.test_drive import TestDrive


def open_record(db, customer_id, vehicle_id):
    return db.query(SalesAssistance).filter_by(customer_id=customer_id, vehicle_id=vehicle_id, closed_at=None).one_or_none()


def evidence(db, user, customer_id, vehicle_id):
    pair = dict(customer_id=customer_id, vehicle_id=vehicle_id)
    items = []
    if user.access.get("enquiries", "none") != "none":
        replies = db.query(Enquiry, EnquiryMessage.sender_user_id).join(EnquiryMessage).filter_by(sender_type="staff")
        replies = replies.filter(Enquiry.customer_id == customer_id, Enquiry.vehicle_id == vehicle_id, Enquiry.sale_id.is_(None))
        if user.role != "manager":
            replies = replies.filter(EnquiryMessage.sender_user_id == user.user_id)
        items.extend(dict(kind="Conversation", source_id=e.enquiry_id, owner_id=staff, label=e.subject)
                     for e, staff in replies.distinct().all())
    if user.access.get("test_drives", "none") != "none":
        drives = db.query(TestDrive).filter_by(**pair, status="Completed").filter(TestDrive.assigned_to.isnot(None))
        if user.role != "manager":
            drives = drives.filter_by(assigned_to=user.user_id)
        items.extend(dict(kind="Test drive", source_id=d.test_drive_id, owner_id=d.assigned_to,
                          label=f"Completed test drive #{d.test_drive_id} on {d.scheduled_date}") for d in drives)
    return items


def attach_owner(db, sale, deal):
    record = open_record(db, sale.customer_id, sale.vehicle_id)
    if record and record.deal_id in (None, deal.deal_id):
        record.deal_id = deal.deal_id
        record.sale_id = sale.sale_id
        record.closed_at = utcnow()
        sale.staff_id = record.owner_id
