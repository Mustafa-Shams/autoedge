from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True)
    phone = Column(String(20), nullable=False)
    address = Column(Text)
    id_type = Column(String(20))
    id_number = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    test_drives = relationship("TestDrive", back_populates="customer")
    sales = relationship("Sale", back_populates="customer")
    service_jobs = relationship("ServiceJob", back_populates="customer")
