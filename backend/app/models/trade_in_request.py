from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class TradeInRequest(Base):
    __tablename__ = "trade_in_requests"

    trade_in_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False)
    target_vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="SET NULL"))
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    mileage_km = Column(Integer, nullable=False)
    color = Column(String(40))
    condition_rating = Column(String(10), nullable=False)
    description = Column(Text)
    expected_price = Column(Numeric(12, 2))
    indicative_low = Column(Numeric(12, 2))
    indicative_high = Column(Numeric(12, 2))
    status = Column(String(15), nullable=False, default="Submitted")
    offered_value = Column(Numeric(12, 2))
    offer_valid_until = Column(DateTime)
    appraised_by = Column(Integer, ForeignKey("users.user_id"))
    staff_notes = Column(Text)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="trade_in_requests")
    target_vehicle = relationship("Vehicle")
    appraiser = relationship("User")
    images = relationship("TradeInImage", back_populates="trade_in", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="trade_in")


class TradeInImage(Base):
    __tablename__ = "trade_in_images"

    image_id = Column(Integer, primary_key=True, index=True)
    trade_in_id = Column(Integer, ForeignKey("trade_in_requests.trade_in_id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=utcnow)

    trade_in = relationship("TradeInRequest", back_populates="images")
