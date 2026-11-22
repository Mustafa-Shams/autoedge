from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
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
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    test_drives = relationship("TestDrive", back_populates="customer")
    sales = relationship("Sale", back_populates="customer")
    service_jobs = relationship("ServiceJob", back_populates="customer")
    # Storefront
    account = relationship("CustomerAccount", back_populates="customer", uselist=False)
    bank_account = relationship("BankAccount", back_populates="customer", uselist=False)
    reservations = relationship("Reservation", back_populates="customer")
    customer_vehicles = relationship("CustomerVehicle", back_populates="customer")
    enquiries = relationship("Enquiry", back_populates="customer")
    reviews = relationship("Review", back_populates="customer")
    wishlist_items = relationship("WishlistItem", back_populates="customer")
    notifications = relationship("Notification", back_populates="customer")
    restock_requests = relationship("RestockRequest", back_populates="customer")
    trade_in_requests = relationship("TradeInRequest", back_populates="customer")
    service_bookings = relationship("ServiceBooking", back_populates="customer")
