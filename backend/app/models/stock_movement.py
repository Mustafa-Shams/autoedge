from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class StockMovement(Base):
    __tablename__ = "stock_movements"

    movement_id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    change_qty = Column(Integer, nullable=False)
    reason = Column(String(30), nullable=False)
    reference_id = Column(Integer)  # reservation_id / sale_id / NULL
    created_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="stock_movements")
    created_by_user = relationship("User")
