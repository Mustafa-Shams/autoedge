from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utcnow


class EmailOutbox(Base):
    __tablename__ = "email_outbox"

    email_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="SET NULL"))
    to_email = Column(String(150), nullable=False)
    subject = Column(String(200), nullable=False)
    render_context = Column(JSON)
    body_html = Column(Text, nullable=False)
    status = Column(String(12), nullable=False, default="Queued")
    error_message = Column(Text)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    sent_at = Column(DateTime)

    # Relationships
    customer = relationship("Customer")
