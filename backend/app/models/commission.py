from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Commission(Base):
    __tablename__ = "commissions"
    __table_args__ = (UniqueConstraint("sale_id", name="uq_commission_sale"),)

    commission_id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False, unique=True)
    rate_percent = Column(Numeric(5, 2), nullable=False, default=2.50)
    commission_amt = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False, default="Pending")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)

    # Relationships
    staff = relationship("User", back_populates="commissions")
    sale = relationship("Sale", back_populates="commission")
