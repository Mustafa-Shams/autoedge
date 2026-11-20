from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), primary_key=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), primary_key=True)
    added_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="wishlist_items")
    vehicle = relationship("Vehicle", back_populates="wishlist_items")
