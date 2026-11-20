# Import all models here so Alembic can discover them
from app.db.base import Base
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.models.test_drive import TestDrive
from app.models.sale import Sale
from app.models.service_job import ServiceJob
from app.models.service_part import ServicePart
from app.models.commission import Commission
# Storefront models
from app.models.customer_account import CustomerAccount
from app.models.vehicle_image import VehicleImage
from app.models.reservation import Reservation
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_type import ServiceType
from app.models.technician_profile import TechnicianProfile
from app.models.service_booking import ServiceBooking
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.stock_movement import StockMovement
from app.models.restock_request import RestockRequest
from app.models.enquiry import Enquiry, EnquiryMessage
from app.models.trade_in_request import TradeInRequest, TradeInImage
from app.models.review import Review
from app.models.wishlist_item import WishlistItem
from app.models.notification import Notification
from app.models.email_outbox import EmailOutbox

__all__ = [
    "Base",
    "User",
    "Vehicle",
    "Customer",
    "TestDrive",
    "Sale",
    "ServiceJob",
    "ServicePart",
    "Commission",
    "CustomerAccount",
    "VehicleImage",
    "Reservation",
    "CustomerVehicle",
    "ServiceType",
    "TechnicianProfile",
    "ServiceBooking",
    "BankAccount",
    "BankTransaction",
    "StockMovement",
    "RestockRequest",
    "Enquiry",
    "EnquiryMessage",
    "TradeInRequest",
    "TradeInImage",
    "Review",
    "WishlistItem",
    "Notification",
    "EmailOutbox",
]
