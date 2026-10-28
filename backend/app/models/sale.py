from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Sale(Base):
    __tablename__ = "sales"

    sale_id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="RESTRICT"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="RESTRICT"), nullable=False)
    staff_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    sale_date = Column(DateTime, nullable=False, server_default=func.now())
    sale_price = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(10, 2), nullable=False, default=0)
    payment_type = Column(String(30), nullable=False, default="Cash")
    status = Column(String(20), nullable=False, default="Pending")
    notes = Column(Text)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    staff = relationship("User", back_populates="sales", foreign_keys=[staff_id])
    commission = relationship("Commission", back_populates="sale", uselist=False)
