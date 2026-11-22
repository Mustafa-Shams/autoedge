from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Text
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
    certifications = Column(Text)  # comma-separated
    skills = Column(Text)  # comma-separated tags
    working_days = Column(String(50))  # e.g., "Mon-Fri"
    working_hours = Column(String(30))  # e.g., "9:00 AM - 5:00 PM"
    hourly_rate = Column(Numeric(10, 2))

    # Relationships
    user = relationship("User", back_populates="technician_profile")
