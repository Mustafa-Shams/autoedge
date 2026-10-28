from sqlalchemy import Column, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class ServicePart(Base):
    __tablename__ = "service_parts"

    part_id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("service_jobs.job_id", ondelete="CASCADE"), nullable=False)
    part_name = Column(String(100), nullable=False)
    part_number = Column(String(50))
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Numeric(10, 2), nullable=False)

    # Relationships
    job = relationship("ServiceJob", back_populates="parts")

    @property
    def total_cost(self):
        return self.quantity * self.unit_cost
