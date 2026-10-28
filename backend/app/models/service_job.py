from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ServiceJob(Base):
    __tablename__ = "service_jobs"

    job_id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="RESTRICT"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="RESTRICT"), nullable=False)
    technician_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    job_type = Column(String(50), nullable=False)
    description = Column(Text)
    status = Column(String(20), nullable=False, default="Pending")
    job_date = Column(Date, nullable=False, server_default=func.current_date())
    estimated_cost = Column(Numeric(10, 2))
    final_cost = Column(Numeric(10, 2))
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    vehicle = relationship("Vehicle", back_populates="service_jobs")
    customer = relationship("Customer", back_populates="service_jobs")
    technician = relationship("User", back_populates="service_jobs", foreign_keys=[technician_id])
    parts = relationship("ServicePart", back_populates="job", cascade="all, delete-orphan")
