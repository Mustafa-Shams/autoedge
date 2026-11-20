from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class ServiceBooking(Base):
    __tablename__ = "service_bookings"

    booking_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="RESTRICT"), nullable=False)
    cv_id = Column(Integer, ForeignKey("customer_vehicles.cv_id", ondelete="RESTRICT"), nullable=False)
    service_type_id = Column(Integer, ForeignKey("service_types.service_type_id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("users.user_id"))
    booking_date = Column(Date, nullable=False)
    time_slot = Column(Time, nullable=False)
    notes = Column(Text)
    fee_amount = Column(Numeric(8, 2), nullable=False)
    status = Column(String(15), nullable=False, default="Booked")
    service_job_id = Column(Integer, ForeignKey("service_jobs.job_id", ondelete="SET NULL"))
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="service_bookings")
    customer_vehicle = relationship("CustomerVehicle", back_populates="service_bookings")
    service_type = relationship("ServiceType")
    technician = relationship("User")
    job = relationship("ServiceJob", back_populates="storefront_booking")
    bank_transactions = relationship("BankTransaction", back_populates="service_booking")
