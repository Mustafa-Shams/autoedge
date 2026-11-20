from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class CustomerVehicle(Base):
    __tablename__ = "customer_vehicles"

    cv_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    color = Column(String(40))
    plate_number = Column(String(20))
    vin_number = Column(String(30))
    source_sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="SET NULL"))
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="customer_vehicles")
    source_sale = relationship("Sale")
    service_bookings = relationship("ServiceBooking", back_populates="customer_vehicle")
    service_jobs = relationship("ServiceJob", back_populates="customer_vehicle")
