from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    test_drives = relationship("TestDrive", back_populates="assigned_staff", foreign_keys="TestDrive.assigned_to")
    sales = relationship("Sale", back_populates="staff", foreign_keys="Sale.staff_id")
    service_jobs = relationship("ServiceJob", back_populates="technician", foreign_keys="ServiceJob.technician_id")
    commissions = relationship("Commission", back_populates="staff")
