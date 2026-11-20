-- AutoEdge Storefront Schema — Documentation Copy
-- Generated from AUTOEDGE_STOREFRONT_SPEC.md section 6
-- This file is for reference only; Alembic manages the actual migrations.

-- ═══════════════════════════════════════════════════════════════════
-- 6.1 NEW TABLES (19 total)
-- ═══════════════════════════════════════════════════════════════════

CREATE SEQUENCE txn_ref_seq START 1;

-- 1. customer accounts (login identity for the storefront)
CREATE TABLE customer_accounts (
    account_id     SERIAL PRIMARY KEY,
    customer_id    INTEGER      NOT NULL UNIQUE REFERENCES customers(customer_id) ON DELETE CASCADE,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at  TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ca_email_lower CHECK (email = LOWER(TRIM(email)))
);

-- 2. extra vehicle photos
CREATE TABLE vehicle_images (
    image_id   SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    image_url  TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    credit     TEXT,
    source_url TEXT
);
CREATE INDEX idx_vimg_vehicle ON vehicle_images(vehicle_id, sort_order);

-- 3. reservations
CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    customer_id    INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    vehicle_id     INTEGER       NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE RESTRICT,
    deposit_amount NUMERIC(12,2) NOT NULL CHECK (deposit_amount > 0),
    hold_days      INTEGER       NOT NULL CHECK (hold_days BETWEEN 7 AND 30),
    reserved_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMP     NOT NULL,
    status         VARCHAR(15)   NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Converted','Cancelled','Expired')),
    closed_at      TIMESTAMP,
    notes          TEXT
);
CREATE INDEX idx_res_customer ON reservations(customer_id);
CREATE INDEX idx_res_vehicle  ON reservations(vehicle_id);
CREATE INDEX idx_res_status   ON reservations(status);
CREATE INDEX idx_res_expiry   ON reservations(expires_at) WHERE status = 'Active';
CREATE UNIQUE INDEX uq_res_active_per_customer_vehicle ON reservations(customer_id, vehicle_id) WHERE status = 'Active';

-- 4. customer-owned cars ("My Garage")
CREATE TABLE customer_vehicles (
    cv_id          SERIAL PRIMARY KEY,
    customer_id    INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    make           VARCHAR(50) NOT NULL,
    model          VARCHAR(50) NOT NULL,
    year           INTEGER     NOT NULL,
    color          VARCHAR(40),
    plate_number   VARCHAR(20),
    vin_number     VARCHAR(30),
    source_sale_id INTEGER REFERENCES sales(sale_id) ON DELETE SET NULL,
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cv_customer ON customer_vehicles(customer_id);
CREATE UNIQUE INDEX uq_cv_plate ON customer_vehicles(customer_id, plate_number) WHERE plate_number IS NOT NULL;

-- 5. service catalogue
CREATE TABLE service_types (
    service_type_id    SERIAL PRIMARY KEY,
    name               VARCHAR(60)   NOT NULL UNIQUE,
    description        TEXT,
    base_price         NUMERIC(10,2) NOT NULL,
    booking_fee        NUMERIC(8,2)  NOT NULL,
    duration_minutes   INTEGER       NOT NULL DEFAULT 60,
    required_specialty VARCHAR(30),
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE
);

-- 6. technician public profiles
CREATE TABLE technician_profiles (
    user_id          INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    specialty        VARCHAR(30) NOT NULL
                     CHECK (specialty IN ('Mechanic','Electrician','AC Specialist','Body & Paint','Tyre & Alignment')),
    years_experience INTEGER     NOT NULL DEFAULT 0,
    bio              TEXT,
    photo_url        TEXT,
    is_bookable      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- 7. service bookings
CREATE TABLE service_bookings (
    booking_id      SERIAL PRIMARY KEY,
    customer_id     INTEGER       NOT NULL REFERENCES customers(customer_id)        ON DELETE RESTRICT,
    cv_id           INTEGER       NOT NULL REFERENCES customer_vehicles(cv_id)       ON DELETE RESTRICT,
    service_type_id INTEGER       NOT NULL REFERENCES service_types(service_type_id),
    technician_id   INTEGER       REFERENCES users(user_id),
    booking_date    DATE          NOT NULL,
    time_slot       TIME          NOT NULL,
    notes           TEXT,
    fee_amount      NUMERIC(8,2)  NOT NULL,
    status          VARCHAR(15)   NOT NULL DEFAULT 'Booked'
                    CHECK (status IN ('Booked','Confirmed','Completed','Cancelled','No-Show')),
    service_job_id  INTEGER       REFERENCES service_jobs(job_id) ON DELETE SET NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sb_customer ON service_bookings(customer_id);
CREATE INDEX idx_sb_status   ON service_bookings(status);
CREATE INDEX idx_sb_date     ON service_bookings(booking_date);
CREATE UNIQUE INDEX uq_sb_tech_slot ON service_bookings(technician_id, booking_date, time_slot)
    WHERE technician_id IS NOT NULL AND status IN ('Booked','Confirmed');

-- 8. simulated bank
CREATE TABLE bank_accounts (
    bank_account_id SERIAL PRIMARY KEY,
    customer_id     INTEGER       NOT NULL UNIQUE REFERENCES customers(customer_id) ON DELETE CASCADE,
    bank_name       VARCHAR(60)   NOT NULL DEFAULT 'AutoEdge Demo Bank',
    account_number  VARCHAR(20)   NOT NULL UNIQUE,
    card_last4      CHAR(4)       NOT NULL,
    balance         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_transactions (
    txn_id             SERIAL PRIMARY KEY,
    bank_account_id    INTEGER       NOT NULL REFERENCES bank_accounts(bank_account_id) ON DELETE CASCADE,
    txn_type           VARCHAR(30)   NOT NULL
                       CHECK (txn_type IN ('Opening Balance','Top Up','Reservation Deposit','Service Booking Fee','Refund')),
    direction          VARCHAR(6)    NOT NULL CHECK (direction IN ('Credit','Debit')),
    amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    balance_after      NUMERIC(14,2) NOT NULL,
    reference_code     VARCHAR(30)   NOT NULL UNIQUE,
    idempotency_key    VARCHAR(64)   UNIQUE,
    description        VARCHAR(200),
    reservation_id     INTEGER REFERENCES reservations(reservation_id)       ON DELETE SET NULL,
    service_booking_id INTEGER REFERENCES service_bookings(booking_id)       ON DELETE SET NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bt_account_date ON bank_transactions(bank_account_id, created_at DESC);
CREATE INDEX idx_bt_reservation  ON bank_transactions(reservation_id);
CREATE INDEX idx_bt_booking      ON bank_transactions(service_booking_id);

-- 9. inventory ledger
CREATE TABLE stock_movements (
    movement_id  SERIAL PRIMARY KEY,
    vehicle_id   INTEGER     NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    change_qty   INTEGER     NOT NULL CHECK (change_qty <> 0),
    reason       VARCHAR(30) NOT NULL
                 CHECK (reason IN ('Reservation','Reservation Cancelled','Reservation Expired','Sale','Restock','Manual Adjustment')),
    reference_id INTEGER,
    created_by   INTEGER REFERENCES users(user_id),
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sm_vehicle ON stock_movements(vehicle_id, created_at DESC);

-- 10. restock requests
CREATE TABLE restock_requests (
    request_id   SERIAL PRIMARY KEY,
    customer_id  INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id   INTEGER     NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    status       VARCHAR(12) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Fulfilled','Withdrawn')),
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMP
);
CREATE INDEX idx_rr_vehicle_status ON restock_requests(vehicle_id, status);
CREATE UNIQUE INDEX uq_rr_open ON restock_requests(customer_id, vehicle_id) WHERE status = 'Open';

-- 11. enquiries
CREATE TABLE enquiries (
    enquiry_id  SERIAL PRIMARY KEY,
    customer_id INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id  INTEGER      REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    subject     VARCHAR(150) NOT NULL,
    status      VARCHAR(10)  NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Answered','Closed')),
    assigned_to INTEGER      REFERENCES users(user_id),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_enq_customer ON enquiries(customer_id);
CREATE INDEX idx_enq_status   ON enquiries(status, updated_at DESC);
CREATE INDEX idx_enq_assigned ON enquiries(assigned_to);

CREATE TABLE enquiry_messages (
    message_id     SERIAL PRIMARY KEY,
    enquiry_id     INTEGER     NOT NULL REFERENCES enquiries(enquiry_id) ON DELETE CASCADE,
    sender_type    VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer','staff')),
    sender_user_id INTEGER     REFERENCES users(user_id),
    body           TEXT        NOT NULL,
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_em_enquiry ON enquiry_messages(enquiry_id, created_at);

-- 12. trade-in requests
CREATE TABLE trade_in_requests (
    trade_in_id        SERIAL PRIMARY KEY,
    customer_id        INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    target_vehicle_id  INTEGER       REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    make               VARCHAR(50)   NOT NULL,
    model              VARCHAR(50)   NOT NULL,
    year               INTEGER       NOT NULL,
    mileage_km         INTEGER       NOT NULL CHECK (mileage_km >= 0),
    color              VARCHAR(40),
    condition_rating   VARCHAR(10)   NOT NULL CHECK (condition_rating IN ('Excellent','Good','Fair','Poor')),
    description        TEXT,
    expected_price     NUMERIC(12,2),
    indicative_low     NUMERIC(12,2),
    indicative_high    NUMERIC(12,2),
    status             VARCHAR(15)   NOT NULL DEFAULT 'Submitted'
                       CHECK (status IN ('Submitted','Under Review','Offer Made','Accepted','Declined','Expired','Completed','Cancelled')),
    offered_value      NUMERIC(12,2),
    offer_valid_until  TIMESTAMP,
    appraised_by       INTEGER       REFERENCES users(user_id),
    staff_notes        TEXT,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ti_customer ON trade_in_requests(customer_id);
CREATE INDEX idx_ti_status   ON trade_in_requests(status);

CREATE TABLE trade_in_images (
    image_id    SERIAL PRIMARY KEY,
    trade_in_id INTEGER   NOT NULL REFERENCES trade_in_requests(trade_in_id) ON DELETE CASCADE,
    image_url   TEXT      NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tii_trade ON trade_in_images(trade_in_id);

-- 13. reviews
CREATE TABLE reviews (
    review_id   SERIAL PRIMARY KEY,
    vehicle_id  INTEGER     NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    customer_id INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(120),
    body        TEXT        NOT NULL,
    is_visible  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_review_one_per_customer_vehicle UNIQUE (vehicle_id, customer_id)
);
CREATE INDEX idx_rev_vehicle ON reviews(vehicle_id, is_visible);

-- 14. wishlist
CREATE TABLE wishlist_items (
    customer_id INTEGER   NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id  INTEGER   NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, vehicle_id)
);

-- 15. notifications
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    customer_id     INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    type            VARCHAR(40)  NOT NULL,
    title           VARCHAR(150) NOT NULL,
    message         TEXT         NOT NULL,
    link_path       VARCHAR(200),
    is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notif_customer ON notifications(customer_id, is_read, created_at DESC);

-- 16. email outbox / log
CREATE TABLE email_outbox (
    email_id      SERIAL PRIMARY KEY,
    customer_id   INTEGER      REFERENCES customers(customer_id) ON DELETE SET NULL,
    to_email      VARCHAR(150) NOT NULL,
    subject       VARCHAR(200) NOT NULL,
    body_html     TEXT         NOT NULL,
    status        VARCHAR(12)  NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued','Sent','Failed','Suppressed')),
    error_message TEXT,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at       TIMESTAMP
);
CREATE INDEX idx_eo_status ON email_outbox(status, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════
-- 6.2 ALTERATIONS TO EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN handles_enquiries BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE vehicles
    ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
    ADD COLUMN description    TEXT,
    ADD COLUMN main_image_url TEXT,
    ADD COLUMN engine         VARCHAR(60),
    ADD COLUMN horsepower     INTEGER,
    ADD COLUMN seats          INTEGER,
    ADD COLUMN drivetrain     VARCHAR(20),
    ADD COLUMN is_published   BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_vehicles_stock     ON vehicles(stock_quantity);
CREATE INDEX idx_vehicles_published ON vehicles(is_published);
CREATE INDEX idx_vehicles_body      ON vehicles(body_type);
CREATE INDEX idx_vehicles_fuel      ON vehicles(fuel_type);

ALTER TABLE test_drives
    ADD COLUMN scheduled_time TIME,
    ADD COLUMN source         VARCHAR(10) NOT NULL DEFAULT 'Staff' CHECK (source IN ('Staff','Online')),
    ADD COLUMN expires_at     TIMESTAMP;
ALTER TABLE test_drives DROP CONSTRAINT test_drives_status_check;
ALTER TABLE test_drives ADD CONSTRAINT test_drives_status_check
    CHECK (status IN ('Requested','Scheduled','Completed','Cancelled','No-Show','Expired'));
CREATE UNIQUE INDEX uq_td_slot ON test_drives(vehicle_id, scheduled_date, scheduled_time)
    WHERE status IN ('Requested','Scheduled') AND scheduled_time IS NOT NULL;
CREATE INDEX idx_td_expires ON test_drives(expires_at) WHERE status = 'Requested';

ALTER TABLE sales
    ADD COLUMN reservation_id  INTEGER REFERENCES reservations(reservation_id),
    ADD COLUMN trade_in_id     INTEGER REFERENCES trade_in_requests(trade_in_id),
    ADD COLUMN deposit_credit  NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN trade_in_credit NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE INDEX idx_sales_reservation ON sales(reservation_id);

ALTER TABLE service_jobs ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE service_jobs ADD COLUMN customer_vehicle_id INTEGER REFERENCES customer_vehicles(cv_id) ON DELETE RESTRICT;
ALTER TABLE service_jobs ADD CONSTRAINT chk_sj_vehicle_ref CHECK (vehicle_id IS NOT NULL OR customer_vehicle_id IS NOT NULL);
CREATE INDEX idx_sj_cust_vehicle ON service_jobs(customer_vehicle_id);


-- ═══════════════════════════════════════════════════════════════════
-- 6.3 TRIGGER
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_sync_vehicle_status() RETURNS trigger AS $$
BEGIN
    IF NEW.stock_quantity > 0 THEN
        NEW.status := 'Available';
    ELSIF EXISTS (SELECT 1 FROM reservations r WHERE r.vehicle_id = NEW.vehicle_id AND r.status = 'Active') THEN
        NEW.status := 'Reserved';
    ELSE
        NEW.status := 'Sold';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_status_sync
BEFORE UPDATE OF stock_quantity ON vehicles
FOR EACH ROW EXECUTE FUNCTION fn_sync_vehicle_status();


-- ═══════════════════════════════════════════════════════════════════
-- 6.4 VIEWS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_vehicle_catalog AS
SELECT v.vehicle_id, v.make, v.model, v.year, v.color, v.fuel_type, v.transmission, v.body_type,
       v.condition_type, v.mileage_km, v.price, v.stock_quantity, v.main_image_url, v.description,
       v.engine, v.horsepower, v.seats, v.drivetrain,
       COALESCE(rv.avg_rating, 0)::NUMERIC(3,2) AS avg_rating,
       COALESCE(rv.review_count, 0)             AS review_count,
       COALESCE(rq.open_requests, 0)            AS open_restock_requests
FROM vehicles v
LEFT JOIN (SELECT vehicle_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
           FROM reviews WHERE is_visible GROUP BY vehicle_id) rv ON rv.vehicle_id = v.vehicle_id
LEFT JOIN (SELECT vehicle_id, COUNT(*) AS open_requests
           FROM restock_requests WHERE status = 'Open' GROUP BY vehicle_id) rq ON rq.vehicle_id = v.vehicle_id
WHERE v.is_published;

CREATE OR REPLACE VIEW v_restock_priority AS
SELECT v.vehicle_id, v.make, v.model, v.year, v.price,
       COUNT(rr.request_id) AS open_requests,
       MIN(rr.created_at)   AS oldest_request_at
FROM vehicles v
JOIN restock_requests rr ON rr.vehicle_id = v.vehicle_id AND rr.status = 'Open'
WHERE v.stock_quantity = 0
GROUP BY v.vehicle_id, v.make, v.model, v.year, v.price
ORDER BY open_requests DESC, oldest_request_at ASC;
