from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class CustomerAccount(Base):
    __tablename__ = "customer_accounts"

    account_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False, unique=True)
    email = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="account")
    # bank_account links through customer_id (same column name on both tables)
    bank_account = relationship(
        "BankAccount",
        primaryjoin="CustomerAccount.customer_id == BankAccount.customer_id",
        foreign_keys="BankAccount.customer_id",
        uselist=False,
        viewonly=True,
    )
