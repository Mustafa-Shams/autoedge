from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class TechnicianProfile(Base):
    __tablename__ = "technician_profiles"

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    specialty = Column(String(30), nullable=False)
    years_experience = Column(Integer, nullable=False, default=0)
    bio = Column(Text)
    photo_url = Column(Text)
    is_bookable = Column(Boolean, nullable=False, default=True)

    # Relationships
    user = relationship("User", back_populates="technician_profile")
