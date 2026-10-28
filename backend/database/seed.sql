-- AutoEdge Seed Data
-- Default password for all users: Admin@1234
-- Hash generated with bcrypt (12 rounds)

-- Users (password: Admin@1234)
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Admin Manager',  'admin@autoedge.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhCanbu5pm2YkPqvxTi4PS', 'manager'),
('Sarah Sales',    'sarah@autoedge.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhCanbu5pm2YkPqvxTi4PS', 'sales_executive'),
('Tom Tech',       'tom@autoedge.com',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhCanbu5pm2YkPqvxTi4PS', 'technician'),
('Rita Reception', 'rita@autoedge.com',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhCanbu5pm2YkPqvxTi4PS', 'receptionist')
ON CONFLICT (email) DO NOTHING;

-- Vehicles
INSERT INTO vehicles (make, model, year, color, fuel_type, transmission, condition_type, price, status) VALUES
('Toyota',  'Camry',    2023, 'Silver',   'Petrol',   'Automatic', 'New',       28500.00, 'Available'),
('Honda',   'Civic',    2022, 'White',    'Petrol',   'Automatic', 'Used',      19900.00, 'Available'),
('BMW',     '3 Series', 2023, 'Black',    'Petrol',   'Automatic', 'New',       52000.00, 'Available'),
('Ford',    'F-150',    2021, 'Red',      'Diesel',   'Automatic', 'Used',      34000.00, 'Reserved'),
('Tesla',   'Model 3',  2023, 'Blue',     'Electric', 'Automatic', 'New',       44900.00, 'Available'),
('Hyundai', 'Tucson',   2022, 'Grey',     'Petrol',   'Automatic', 'Certified', 23500.00, 'Available'),
('Kia',     'Sportage', 2023, 'White',    'Hybrid',   'Automatic', 'New',       31000.00, 'Available'),
('Mazda',   'CX-5',     2021, 'Deep Red', 'Petrol',   'Automatic', 'Used',      22000.00, 'Available')
ON CONFLICT DO NOTHING;

-- Customers
INSERT INTO customers (full_name, email, phone, address) VALUES
('Ali Hassan',    'ali@email.com',    '+1-555-0101', '123 Main St'),
('Maria Garcia',  'maria@email.com',  '+1-555-0102', '456 Oak Ave'),
('John Williams', 'john@email.com',   '+1-555-0103', '789 Pine Rd'),
('Fatima Khan',   'fatima@email.com', '+1-555-0104', '321 Elm Blvd'),
('David Chen',    'david@email.com',  '+1-555-0105', '654 Maple Dr')
ON CONFLICT (email) DO NOTHING;
