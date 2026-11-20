from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    bank_account_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False, unique=True)
    bank_name = Column(String(60), nullable=False, default="AutoEdge Demo Bank")
    account_number = Column(String(20), nullable=False, unique=True)
    card_last4 = Column(String(4), nullable=False)
    balance = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="bank_account")
    transactions = relationship("BankTransaction", back_populates="bank_account",
                                order_by="BankTransaction.created_at.desc()")
