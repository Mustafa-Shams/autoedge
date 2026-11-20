from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class VehicleImage(Base):
    __tablename__ = "vehicle_images"

    image_id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    credit = Column(Text)
    source_url = Column(Text)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="images")
