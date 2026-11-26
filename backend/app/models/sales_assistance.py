from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, text

from app.core.time import utcnow
from app.db.base import Base


class SalesAssistance(Base):
    __tablename__ = "sales_assistance"
    __table_args__ = (
        Index("uq_open_assistance", "customer_id", "vehicle_id", unique=True,
              postgresql_where=text("closed_at IS NULL"), sqlite_where=text("closed_at IS NULL")),
        CheckConstraint(
            "(kind='Conversation' AND enquiry_id IS NOT NULL AND test_drive_id IS NULL) OR "
            "(kind='Test drive' AND test_drive_id IS NOT NULL AND enquiry_id IS NULL) OR "
            "(kind='Walk-in' AND enquiry_id IS NULL AND test_drive_id IS NULL)",
            name="ck_assistance_source"),
    )

    deal_id = Column(Integer, ForeignKey("deals.deal_id", ondelete="SET NULL"), index=True)
    assistance_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    recorded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    kind = Column(String(20), nullable=False)
    note = Column(String(500), nullable=False)
    enquiry_id = Column(Integer, ForeignKey("enquiries.enquiry_id"), unique=True)
    test_drive_id = Column(Integer, ForeignKey("test_drives.test_drive_id"), unique=True)
    recorded_at = Column(DateTime, default=utcnow, nullable=False)
    closed_at = Column(DateTime)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), unique=True)
