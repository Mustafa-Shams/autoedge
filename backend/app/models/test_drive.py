from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class TestDrive(Base):
    __tablename__ = "test_drives"

    test_drive_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    booking_date = Column(DateTime, nullable=False, server_default=func.now())
    scheduled_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="Scheduled")
    notes = Column(Text)
    lead_status = Column(String(20), nullable=False, default="New")

    # Relationships
    customer = relationship("Customer", back_populates="test_drives")
    vehicle = relationship("Vehicle", back_populates="test_drives")
    assigned_staff = relationship("User", back_populates="test_drives", foreign_keys=[assigned_to])
