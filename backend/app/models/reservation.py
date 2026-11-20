from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class Reservation(Base):
    __tablename__ = "reservations"

    reservation_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="RESTRICT"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="RESTRICT"), nullable=False)
    deposit_amount = Column(Numeric(12, 2), nullable=False)
    hold_days = Column(Integer, nullable=False)
    reserved_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
    status = Column(String(15), nullable=False, default="Active")
    closed_at = Column(DateTime)
    notes = Column(Text)

    # Relationships
    customer = relationship("Customer", back_populates="reservations")
    vehicle = relationship("Vehicle", back_populates="reservations")
    sale = relationship("Sale", back_populates="reservation", uselist=False)
    bank_transactions = relationship("BankTransaction", back_populates="reservation")
