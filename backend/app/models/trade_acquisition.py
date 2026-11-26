from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, text
from sqlalchemy.orm import relationship

from app.db.base import Base


class TradeAcquisition(Base):
    __tablename__ = "trade_acquisitions"
    __table_args__ = (
        Index("uq_held_trade_vin", "vin", unique=True, postgresql_where=text("returned_at IS NULL AND listing_id IS NULL"),
              sqlite_where=text("returned_at IS NULL AND listing_id IS NULL")),
    )

    trade_in_id = Column(Integer, ForeignKey("trade_in_requests.trade_in_id"), primary_key=True)
    inspection_at = Column(DateTime)
    inspected_value = Column(Numeric(12, 2))
    findings = Column(Text)
    terms_version = Column(Integer, nullable=False, default=0)
    approved_version = Column(Integer)
    excess_amount = Column(Numeric(12, 2), nullable=False, default=0)
    excess_terms = Column(Text)
    terms_by = Column(Integer, ForeignKey("users.user_id"))
    vin = Column(String(17))
    ownership_reference = Column(String(100))
    odometer_km = Column(Integer)
    checked_at = Column(DateTime)
    checked_by = Column(Integer, ForeignKey("users.user_id"))
    intake_version = Column(Integer)
    stock_unit = relationship("InventoryUnit", uselist=False, foreign_keys="InventoryUnit.intake_trade_id")
    intake_at = Column(DateTime)
    intake_by = Column(Integer, ForeignKey("users.user_id"))
    returned_at = Column(DateTime)
    settlement_reference = Column(String(100))
    settled_amount = Column(Numeric(12, 2))
    settled_at = Column(DateTime)
    settlement_by = Column(Integer, ForeignKey("users.user_id"))
    preparation_cost = Column(Numeric(12, 2))
    retail_price = Column(Numeric(12, 2))
    retail_description = Column(Text)
    listing_id = Column(Integer, ForeignKey("vehicles.vehicle_id"), unique=True)
    published_by = Column(Integer, ForeignKey("users.user_id"))
    trade = relationship("TradeInRequest", back_populates="acquisition")
