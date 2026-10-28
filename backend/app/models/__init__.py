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
]
