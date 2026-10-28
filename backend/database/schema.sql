-- ============================================================
-- AutoEdge Car Showroom Management System
-- Database Schema with Performance Indexes
-- ============================================================

-- TABLE 1: users
CREATE TABLE IF NOT EXISTS users (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(30)   NOT NULL CHECK (role IN ('manager','sales_executive','technician','receptionist')),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active   ON users(is_active);

-- TABLE 2: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id     SERIAL PRIMARY KEY,
    make           VARCHAR(50)   NOT NULL,
    model          VARCHAR(50)   NOT NULL,
    year           INTEGER       NOT NULL,
    color          VARCHAR(40),
    fuel_type      VARCHAR(20),
    transmission   VARCHAR(20),
    body_type      VARCHAR(20),
    condition_type VARCHAR(15)   NOT NULL DEFAULT 'New' CHECK (condition_type IN ('New','Used','Certified')),
    mileage_km     INTEGER       NOT NULL DEFAULT 0,
    vin_number     VARCHAR(30)   UNIQUE,
    price          NUMERIC(12,2) NOT NULL,
    status         VARCHAR(15)   NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Reserved','Sold')),
    notes          TEXT,
    date_added     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vehicles_status     ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_year       ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_price      ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_vehicles_condition  ON vehicles(condition_type);

-- TABLE 3: customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id  SERIAL PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(150) UNIQUE,
    phone        VARCHAR(20)  NOT NULL,
    address      TEXT,
    id_type      VARCHAR(20),
    id_number    VARCHAR(50),
    notes        TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_phone     ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email     ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_fullname  ON customers(full_name);

-- TABLE 4: test_drives
CREATE TABLE IF NOT EXISTS test_drives (
    test_drive_id  SERIAL PRIMARY KEY,
    customer_id    INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id     INTEGER      NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    assigned_to    INTEGER      REFERENCES users(user_id),
    booking_date   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_date DATE         NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Completed','Cancelled','No-Show')),
    notes          TEXT,
    lead_status    VARCHAR(20)  NOT NULL DEFAULT 'New' CHECK (lead_status IN ('New','Interested','Hot','Converted','Lost'))
);
CREATE INDEX IF NOT EXISTS idx_td_customer   ON test_drives(customer_id);
CREATE INDEX IF NOT EXISTS idx_td_vehicle    ON test_drives(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_td_assigned   ON test_drives(assigned_to);
CREATE INDEX IF NOT EXISTS idx_td_status     ON test_drives(status);
CREATE INDEX IF NOT EXISTS idx_td_lead       ON test_drives(lead_status);
CREATE INDEX IF NOT EXISTS idx_td_scheduled  ON test_drives(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_td_staff_date ON test_drives(assigned_to, scheduled_date);

-- TABLE 5: sales
CREATE TABLE IF NOT EXISTS sales (
    sale_id      SERIAL PRIMARY KEY,
    vehicle_id   INTEGER       NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
    customer_id  INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    staff_id     INTEGER       NOT NULL REFERENCES users(user_id),
    sale_date    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sale_price   NUMERIC(12,2) NOT NULL,
    discount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_type VARCHAR(30)   NOT NULL DEFAULT 'Cash' CHECK (payment_type IN ('Cash','Finance','Lease')),
    status       VARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Completed','Cancelled')),
    notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_vehicle    ON sales(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer   ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_staff      ON sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_status     ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_date       ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_staff_date ON sales(staff_id, sale_date);

-- TABLE 6: service_jobs
CREATE TABLE IF NOT EXISTS service_jobs (
    job_id        SERIAL PRIMARY KEY,
    vehicle_id    INTEGER      NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
    customer_id   INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    technician_id INTEGER      REFERENCES users(user_id),
    job_type      VARCHAR(50)  NOT NULL,
    description   TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Cancelled')),
    job_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
    estimated_cost NUMERIC(10,2),
    final_cost    NUMERIC(10,2),
    notes         TEXT,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sj_vehicle    ON service_jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sj_customer   ON service_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sj_technician ON service_jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_sj_status     ON service_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sj_date       ON service_jobs(job_date);
CREATE INDEX IF NOT EXISTS idx_sj_tech_date  ON service_jobs(technician_id, job_date);

-- TABLE 7: service_parts
CREATE TABLE IF NOT EXISTS service_parts (
    part_id     SERIAL PRIMARY KEY,
    job_id      INTEGER       NOT NULL REFERENCES service_jobs(job_id) ON DELETE CASCADE,
    part_name   VARCHAR(100)  NOT NULL,
    part_number VARCHAR(50),
    quantity    INTEGER       NOT NULL DEFAULT 1,
    unit_cost   NUMERIC(10,2) NOT NULL,
    total_cost  NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);
CREATE INDEX IF NOT EXISTS idx_parts_job ON service_parts(job_id);

-- TABLE 8: commissions
CREATE TABLE IF NOT EXISTS commissions (
    commission_id  SERIAL PRIMARY KEY,
    staff_id       INTEGER       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    sale_id        INTEGER       NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE UNIQUE,
    rate_percent   NUMERIC(5,2)  NOT NULL DEFAULT 2.50,
    commission_amt NUMERIC(10,2) NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Paid')),
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at        TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comm_staff        ON commissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_comm_sale         ON commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_comm_status       ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_comm_staff_status ON commissions(staff_id, status);
