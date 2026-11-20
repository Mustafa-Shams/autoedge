from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    txn_id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.bank_account_id", ondelete="CASCADE"), nullable=False)
    txn_type = Column(String(30), nullable=False)
    direction = Column(String(6), nullable=False)  # 'Credit' or 'Debit'
    amount = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(14, 2), nullable=False)
    reference_code = Column(String(30), nullable=False, unique=True)
    idempotency_key = Column(String(64), unique=True)
    description = Column(String(200))
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id", ondelete="SET NULL"))
    service_booking_id = Column(Integer, ForeignKey("service_bookings.booking_id", ondelete="SET NULL"))
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    bank_account = relationship("BankAccount", back_populates="transactions")
    reservation = relationship("Reservation", back_populates="bank_transactions")
    service_booking = relationship("ServiceBooking", back_populates="bank_transactions")
