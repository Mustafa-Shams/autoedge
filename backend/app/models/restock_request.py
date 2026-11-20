from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class RestockRequest(Base):
    __tablename__ = "restock_requests"

    request_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    status = Column(String(12), nullable=False, default="Open")
    created_at = Column(DateTime, nullable=False, default=utcnow)
    fulfilled_at = Column(DateTime)

    # Relationships
    customer = relationship("Customer", back_populates="restock_requests")
    vehicle = relationship("Vehicle", back_populates="restock_requests")
