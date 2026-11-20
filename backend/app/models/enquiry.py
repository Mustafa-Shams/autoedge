from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class Enquiry(Base):
    __tablename__ = "enquiries"

    enquiry_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="CASCADE"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="SET NULL"))
    subject = Column(String(150), nullable=False)
    status = Column(String(10), nullable=False, default="Open")
    assigned_to = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="enquiries")
    vehicle = relationship("Vehicle", back_populates="enquiries")
    assigned_staff = relationship("User", back_populates="assigned_enquiries", foreign_keys=[assigned_to])
    messages = relationship("EnquiryMessage", back_populates="enquiry", cascade="all, delete-orphan",
                            order_by="EnquiryMessage.created_at")


class EnquiryMessage(Base):
    __tablename__ = "enquiry_messages"

    message_id = Column(Integer, primary_key=True, index=True)
    enquiry_id = Column(Integer, ForeignKey("enquiries.enquiry_id", ondelete="CASCADE"), nullable=False)
    sender_type = Column(String(10), nullable=False)  # 'customer' or 'staff'
    sender_user_id = Column(Integer, ForeignKey("users.user_id"))  # set when sender_type = 'staff'
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationships
    enquiry = relationship("Enquiry", back_populates="messages")
    sender_user = relationship("User")
