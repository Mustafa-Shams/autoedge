"""Customer-visible changes to appointments and acquisition terms."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, event, inspect
from sqlalchemy.orm import Session

from app.core.time import utcnow
from app.db.base import Base
from app.models.test_drive import TestDrive
from app.models.trade_acquisition import TradeAcquisition
from app.models.trade_in_request import TradeInRequest


class DealActivity(Base):
    __tablename__ = "deal_activity"
    activity_id = Column(Integer, primary_key=True)
    trade_in_id = Column(Integer, ForeignKey("trade_in_requests.trade_in_id", ondelete="CASCADE"), index=True)
    test_drive_id = Column(Integer, ForeignKey("test_drives.test_drive_id", ondelete="CASCADE"), index=True)
    at = Column(DateTime, nullable=False, default=utcnow)
    title = Column(String(180), nullable=False)


@event.listens_for(Session, "before_flush")
def retain_milestones(session, _context, _instances):
    # Observe changes in the same transaction, including staff edits and expiry sweeps.
    for record in list(session.dirty):
        attrs = inspect(record).attrs
        if isinstance(record, TestDrive):
            if any(attrs[name].history.has_changes() for name in ("status", "scheduled_date", "scheduled_time")):
                session.add(DealActivity(test_drive_id=record.test_drive_id,
                    title=f"Test drive {record.status.lower()} · {record.scheduled_date} {record.scheduled_time or ''}"))
        elif isinstance(record, TradeInRequest) and attrs.status.history.has_changes():
            amount = f" · ${record.offered_value:,.2f}" if record.status in ("Offer Made","Accepted") and record.offered_value else ""
            session.add(DealActivity(trade_in_id=record.trade_in_id, title=f"Trade-in {record.status.lower()}{amount}"))
        elif isinstance(record, TradeAcquisition):
            title = None
            if attrs.terms_version.history.has_changes() and record.inspected_value is not None:
                title = f"Inspection terms v{record.terms_version} · ${record.inspected_value:,.2f}"
            elif attrs.approved_version.history.has_changes() and record.approved_version:
                title = f"Customer approved inspection terms v{record.approved_version}"
            elif attrs.listing_id.history.has_changes() and record.listing_id:
                title = f"Resale listing #{record.listing_id} published"
            elif attrs.inspection_at.history.has_changes() and record.inspection_at:
                title = f"Inspection scheduled for {record.inspection_at:%Y-%m-%d %H:%M} UTC"
            if title:
                session.add(DealActivity(trade_in_id=record.trade_in_id, title=title))
