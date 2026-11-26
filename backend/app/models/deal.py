from sqlalchemy import (
    CheckConstraint, Column, DateTime, DDL, ForeignKey, ForeignKeyConstraint,
    Index, Integer, Numeric, String, UniqueConstraint, event, text,
)

from app.db.base import Base


class InventoryUnit(Base):
    __tablename__ = "inventory_units"
    __table_args__ = (
        CheckConstraint("vehicle_id IS NOT NULL OR intake_trade_id IS NOT NULL", name="ck_unit_origin"),
        UniqueConstraint("vehicle_id", "unit_id", name="uq_unit_listing"),
        Index("uq_current_unit_vin", "vin", unique=True, postgresql_where=text("superseded_by_trade IS NULL"),
              sqlite_where=text("superseded_by_trade IS NULL")),
        CheckConstraint(
            "(vin IS NULL AND verified_at IS NULL AND verified_by IS NULL) OR "
            "(vin IS NOT NULL AND length(vin) = 17 AND vin = upper(vin) "
            "AND verified_at IS NOT NULL AND verified_by IS NOT NULL)",
            name="ck_unit_verification",
        ),
    )

    unit_id = Column(Integer, primary_key=True)
    intake_trade_id = Column(Integer, ForeignKey("trade_acquisitions.trade_in_id"), unique=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), index=True)
    vin = Column(String(17))
    superseded_by_trade = Column(Integer, ForeignKey("trade_in_requests.trade_in_id"), unique=True)
    verified_by = Column(Integer, ForeignKey("users.user_id"))
    verified_at = Column(DateTime)


class Deal(Base):
    __tablename__ = "deals"
    __table_args__ = (
        Index("uq_shopping_pair", "customer_id", "vehicle_id", unique=True,
              postgresql_where=text("stage='Shopping'"), sqlite_where=text("stage='Shopping'")),
        ForeignKeyConstraint(["vehicle_id", "unit_id"], ["inventory_units.vehicle_id", "inventory_units.unit_id"]),
        CheckConstraint(
            "(stage IN ('Shopping','Earlier activity') AND unit_id IS NULL AND reservation_id IS NULL AND sale_id IS NULL) OR "
            "(stage = 'Refunded' AND sale_id IS NOT NULL AND unit_id IS NULL AND refund_approved_by IS NOT NULL) OR "
            "(stage IN ('Cancelled', 'Expired') AND unit_id IS NULL AND reservation_id IS NOT NULL) OR "
            "(stage = 'Reserved' AND unit_id IS NOT NULL AND reservation_id IS NOT NULL AND sale_id IS NULL) OR "
            "(stage IN ('Historical sale', 'Awaiting pickup', 'Collected') AND unit_id IS NOT NULL AND sale_id IS NOT NULL)",
            name="ck_deal_stage",
        ),
    )

    deal_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id"), nullable=False)
    unit_id = Column(Integer, unique=True)
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id"), unique=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), unique=True)
    stage = Column(String(20), nullable=False)
    refund_requested_at = Column(DateTime)
    refund_approved_by = Column(Integer, ForeignKey("users.user_id"))
    cash_received = Column(Numeric(12, 2))
    external_funding = Column(Numeric(12, 2))
    payment_reference = Column(String(100))
    payment_verified_by = Column(Integer, ForeignKey("users.user_id"))
    payment_verified_at = Column(DateTime)
    pickup_deadline = Column(DateTime)


# SQLite fixtures use create_all. PostgreSQL installs the equivalent trigger in 0006.
event.listen(InventoryUnit.__table__, "after_create", DDL("""
    CREATE TRIGGER stock_units_on_insert AFTER INSERT ON vehicles
    BEGIN
        INSERT INTO inventory_units(vehicle_id)
        WITH RECURSIVE units(n) AS (
            SELECT 1 WHERE NEW.stock_quantity > 0
            UNION ALL SELECT n + 1 FROM units WHERE n < NEW.stock_quantity
        ) SELECT NEW.vehicle_id FROM units;
    END
""").execute_if(dialect="sqlite"))
event.listen(InventoryUnit.__table__, "before_drop", DDL(
    "DROP TRIGGER IF EXISTS stock_units_on_insert"
).execute_if(dialect="sqlite"))
