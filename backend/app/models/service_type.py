from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text
from app.db.base import Base


class ServiceType(Base):
    __tablename__ = "service_types"

    service_type_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(60), nullable=False, unique=True)
    description = Column(Text)
    base_price = Column(Numeric(10, 2), nullable=False)
    booking_fee = Column(Numeric(8, 2), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    required_specialty = Column(String(30))  # NULL = any technician
    is_active = Column(Boolean, nullable=False, default=True)
