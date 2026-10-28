from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(Integer, primary_key=True, index=True)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    color = Column(String(40))
    fuel_type = Column(String(20))
    transmission = Column(String(20))
    body_type = Column(String(20))
    condition_type = Column(String(15), nullable=False, default="New")
    mileage_km = Column(Integer, nullable=False, default=0)
    vin_number = Column(String(30), unique=True)
    price = Column(Numeric(12, 2), nullable=False)
    status = Column(String(15), nullable=False, default="Available")
    notes = Column(Text)
    date_added = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    test_drives = relationship("TestDrive", back_populates="vehicle")
    sales = relationship("Sale", back_populates="vehicle")
    service_jobs = relationship("ServiceJob", back_populates="vehicle")
