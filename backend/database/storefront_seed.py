"""Storefront seed data — spec section 12.

Idempotent: safe to re-run (uses ON CONFLICT DO NOTHING / existence checks).
All password hashes come from hash_password() (Article XVI).

Usage:
    cd backend
    python database/storefront_seed.py
"""
import json
import random
import string
import sys
from datetime import datetime, timedelta, timezone, date, time
from decimal import Decimal
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.core.time import utcnow
from app.db.session import engine, SessionLocal
from app.models import *  # noqa — ensure all models loaded


# ── Helpers ──────────────────────────────────────────────────────────

def _generate_account_number() -> str:
    digits = "".join(random.choices(string.digits, k=10))
    return f"AE{digits}"


def _generate_card_last4() -> str:
    return "".join(random.choices(string.digits, k=4))


def _generate_ref_code() -> str:
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    rand = "".join(random.choices(string.digits, k=6))
    return f"TXN-{date_part}-{rand}"


# ── Vehicle data ─────────────────────────────────────────────────────

# Backfill data for the 8 existing vehicles (ordered by original seed)
EXISTING_VEHICLES_BACKFILL = [
    {
        "make": "Toyota", "model": "Camry", "year": 2023,
        "stock_quantity": 4, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "engine": "2.5L 4-Cylinder", "horsepower": 203, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Toyota Camry is a reliable mid-size sedan known for its comfort, fuel efficiency, and strong resale value. Features include a touchscreen infotainment system, advanced safety features, and a spacious interior.",
    },
    {
        "make": "Honda", "model": "Civic", "year": 2022,
        "stock_quantity": 2, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "CVT", "condition_type": "Used",
        "engine": "2.0L 4-Cylinder", "horsepower": 158, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Honda Civic offers a fun-to-drive experience with excellent fuel economy. This compact sedan features a modern interior, Honda Sensing safety suite, and a turbocharged engine option.",
    },
    {
        "make": "BMW", "model": "3 Series", "year": 2023,
        "stock_quantity": 3, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "engine": "2.0L Turbo 4-Cylinder", "horsepower": 255, "seats": 5,
        "drivetrain": "RWD", "is_published": True,
        "description": "The BMW 3 Series is a luxury sports sedan that combines dynamic performance with refined comfort. Features iDrive infotainment, premium leather, and BMW's renowned driving dynamics.",
    },
    {
        "make": "Ford", "model": "F-150", "year": 2021,
        "stock_quantity": 0, "body_type": "Truck", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "Used",
        "engine": "3.5L V6 EcoBoost", "horsepower": 400, "seats": 5,
        "drivetrain": "4WD", "is_published": True,
        "description": "America's best-selling truck, the Ford F-150 combines capability with comfort. Features include a powerful EcoBoost engine, Pro Power Onboard, and the largest touchscreen in its class.",
    },
    {
        "make": "Tesla", "model": "Model 3", "year": 2023,
        "stock_quantity": 5, "body_type": "Sedan", "fuel_type": "Electric",
        "transmission": "Single-Speed", "condition_type": "New",
        "engine": "Dual Motor Electric", "horsepower": 346, "seats": 5,
        "drivetrain": "AWD", "is_published": True,
        "description": "The Tesla Model 3 is a premium all-electric sedan with an impressive range, Autopilot capability, and minimalist interior. Features over-the-air updates and a 15-inch touchscreen.",
    },
    {
        "make": "Hyundai", "model": "Tucson", "year": 2022,
        "stock_quantity": 2, "body_type": "SUV", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "engine": "2.5L 4-Cylinder", "horsepower": 187, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Hyundai Tucson offers bold styling, a comfortable ride, and generous standard features. Its parametric jewel-like grille design stands out in the compact SUV segment.",
    },
    {
        "make": "Kia", "model": "Sportage", "year": 2023,
        "stock_quantity": 3, "body_type": "SUV", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "engine": "2.5L 4-Cylinder", "horsepower": 187, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Kia Sportage combines rugged good looks with a premium interior. Features include a dual panoramic display, Kia Connect services, and advanced driver-assist technology.",
    },
    {
        "make": "Mazda", "model": "CX-5", "year": 2021,
        "stock_quantity": 1, "body_type": "SUV", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "Used",
        "engine": "2.5L 4-Cylinder Turbo", "horsepower": 256, "seats": 5,
        "drivetrain": "AWD", "is_published": True,
        "description": "The Mazda CX-5 delivers a premium driving experience with Kodo design language and an upscale interior. Known for its engaging handling and quality materials.",
    },
]

# 8 NEW vehicles to add
NEW_VEHICLES = [
    {
        "make": "Mercedes-Benz", "model": "C-Class", "year": 2023,
        "color": "Obsidian Black", "price": Decimal("52000.00"),
        "stock_quantity": 2, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "2.0L Turbo 4-Cylinder", "horsepower": 255, "seats": 5,
        "drivetrain": "RWD", "is_published": True,
        "description": "The Mercedes-Benz C-Class is the epitome of luxury and technology in the compact sedan segment. Features MBUX infotainment, digital instrument cluster, and the latest driver-assist systems.",
    },
    {
        "make": "Audi", "model": "A4", "year": 2023,
        "color": "Glacier White", "price": Decimal("45000.00"),
        "stock_quantity": 3, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "2.0L TFSI Turbo", "horsepower": 201, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Audi A4 combines Vorsprung durch Technik with everyday luxury. Features Audi virtual cockpit, MMI touch infotainment, and Quattro all-weather confidence.",
    },
    {
        "make": "Toyota", "model": "Corolla", "year": 2022,
        "color": "Celestite Gray", "price": Decimal("24000.00"),
        "stock_quantity": 6, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "CVT", "condition_type": "Used",
        "mileage_km": 15000, "status": "Available",
        "engine": "1.8L 4-Cylinder", "horsepower": 139, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Toyota Corolla is the world's best-selling car for good reason: exceptional reliability, fuel efficiency, and a comprehensive suite of standard safety features.",
    },
    {
        "make": "Honda", "model": "Accord", "year": 2023,
        "color": "Platinum White Pearl", "price": Decimal("32000.00"),
        "stock_quantity": 4, "body_type": "Sedan", "fuel_type": "Gasoline",
        "transmission": "CVT", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "1.5L Turbo 4-Cylinder", "horsepower": 192, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Honda Accord is a perennial favourite among mid-size sedans. It offers a spacious, well-crafted cabin, responsive handling, and Honda's complete safety suite.",
    },
    {
        "make": "Jeep", "model": "Wrangler", "year": 2022,
        "color": "Sarge Green", "price": Decimal("42000.00"),
        "stock_quantity": 2, "body_type": "SUV", "fuel_type": "Gasoline",
        "transmission": "Manual", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "3.6L Pentastar V6", "horsepower": 285, "seats": 5,
        "drivetrain": "4WD", "is_published": True,
        "description": "The Jeep Wrangler is the ultimate off-road icon. With legendary 4x4 capability, removable doors and roof, and trail-rated toughness, it goes where others can't.",
    },
    {
        "make": "Volkswagen", "model": "Golf", "year": 2023,
        "color": "Kings Red", "price": Decimal("29500.00"),
        "stock_quantity": 3, "body_type": "Hatchback", "fuel_type": "Gasoline",
        "transmission": "Automatic", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "1.4L Turbo 4-Cylinder", "horsepower": 147, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Volkswagen Golf combines practical hatchback versatility with German engineering. Features a refined ride, intuitive infotainment, and class-leading build quality.",
    },
    {
        "make": "Chevrolet", "model": "Camaro", "year": 2022,
        "color": "Rally Green", "price": Decimal("38000.00"),
        "stock_quantity": 0, "body_type": "Coupe", "fuel_type": "Gasoline",
        "transmission": "Manual", "condition_type": "Used",
        "mileage_km": 8500, "status": "Available",
        "engine": "2.0L Turbo 4-Cylinder", "horsepower": 275, "seats": 4,
        "drivetrain": "RWD", "is_published": True,
        "description": "The Chevrolet Camaro is an American muscle car legend. With aggressive styling, potent engine options, and a driver-focused cockpit, it delivers pure driving excitement.",
    },
    {
        "make": "Nissan", "model": "Leaf", "year": 2023,
        "color": "Jade Frost", "price": Decimal("33000.00"),
        "stock_quantity": 4, "body_type": "Hatchback", "fuel_type": "Electric",
        "transmission": "Single-Speed", "condition_type": "New",
        "mileage_km": 0, "status": "Available",
        "engine": "Electric Motor", "horsepower": 147, "seats": 5,
        "drivetrain": "FWD", "is_published": True,
        "description": "The Nissan Leaf is one of the most affordable all-electric vehicles. It offers zero emissions, e-Pedal one-pedal driving, and ProPILOT Assist for highway driving.",
    },
]

# Service types per spec table
SERVICE_TYPES = [
    {"name": "Oil Change", "base_price": Decimal("45.00"), "booking_fee": Decimal("5.00"), "duration_minutes": 45, "required_specialty": "Mechanic"},
    {"name": "Full Vehicle Service", "base_price": Decimal("180.00"), "booking_fee": Decimal("15.00"), "duration_minutes": 120, "required_specialty": "Mechanic"},
    {"name": "Brake Inspection & Repair", "base_price": Decimal("120.00"), "booking_fee": Decimal("10.00"), "duration_minutes": 60, "required_specialty": "Mechanic"},
    {"name": "Tyre Rotation & Wheel Alignment", "base_price": Decimal("70.00"), "booking_fee": Decimal("8.00"), "duration_minutes": 60, "required_specialty": "Tyre & Alignment"},
    {"name": "AC Service & Gas Refill", "base_price": Decimal("95.00"), "booking_fee": Decimal("10.00"), "duration_minutes": 60, "required_specialty": "AC Specialist"},
    {"name": "Battery & Electrical Diagnostics", "base_price": Decimal("60.00"), "booking_fee": Decimal("8.00"), "duration_minutes": 60, "required_specialty": "Electrician"},
    {"name": "Dent & Paint Touch-up", "base_price": Decimal("250.00"), "booking_fee": Decimal("20.00"), "duration_minutes": 120, "required_specialty": "Body & Paint"},
    {"name": "General Inspection", "base_price": Decimal("40.00"), "booking_fee": Decimal("5.00"), "duration_minutes": 45, "required_specialty": None},
]

# New technician users
NEW_TECHNICIANS = [
    {"full_name": "Elena Volt", "email": "elena@autoedge.com", "specialty": "Electrician", "years": 6, "bio": "Certified automotive electrician specializing in hybrid and EV systems. Expert in diagnostics and wiring."},
    {"full_name": "Raj Patel", "email": "raj@autoedge.com", "specialty": "AC Specialist", "years": 8, "bio": "Climate control specialist with expertise in all makes. Quick, reliable AC servicing and repair."},
    {"full_name": "Marcus Cole", "email": "marcus@autoedge.com", "specialty": "Body & Paint", "years": 12, "bio": "Master body and paint technician. Precision dent removal and colour-matched paint restoration."},
    {"full_name": "Lina Torres", "email": "lina@autoedge.com", "specialty": "Tyre & Alignment", "years": 5, "bio": "Wheel alignment and tyre specialist. Uses latest laser alignment technology for perfect results."},
]

# Demo customers
DEMO_CUSTOMERS = [
    {"full_name": "Ali Raza", "email": "demo1@example.com", "phone": "+92-300-1001001"},
    {"full_name": "Sarah Khan", "email": "demo2@example.com", "phone": "+92-300-2002002"},
    {"full_name": "Omar Farooq", "email": "demo3@example.com", "phone": "+92-300-3003003"},
]


def seed(db: Session):
    """Run all seed steps."""
    now = utcnow()

    # ── 1. Backfill existing vehicles ────────────────────────────────
    print("1. Backfilling existing vehicles...")
    for vdata in EXISTING_VEHICLES_BACKFILL:
        vehicle = db.query(Vehicle).filter(
            Vehicle.make == vdata["make"],
            Vehicle.model == vdata["model"],
            Vehicle.year == vdata["year"],
        ).first()
        if vehicle:
            for key, val in vdata.items():
                if key not in ("make", "model", "year"):
                    setattr(vehicle, key, val)
            print(f"  Updated: {vdata['make']} {vdata['model']} {vdata['year']} (stock={vdata['stock_quantity']})")
        else:
            print(f"  ⚠️  Not found: {vdata['make']} {vdata['model']} {vdata['year']}")

    db.flush()

    # ── 2. Add 8 new vehicles ────────────────────────────────────────
    print("\n2. Adding 8 new vehicles...")
    for vdata in NEW_VEHICLES:
        existing = db.query(Vehicle).filter(
            Vehicle.make == vdata["make"],
            Vehicle.model == vdata["model"],
            Vehicle.year == vdata["year"],
        ).first()
        if existing:
            print(f"  Already exists: {vdata['make']} {vdata['model']} {vdata['year']}")
            # Update fields anyway
            for key, val in vdata.items():
                setattr(existing, key, val)
        else:
            v = Vehicle(**vdata)
            db.add(v)
            print(f"  Added: {vdata['make']} {vdata['model']} {vdata['year']} (stock={vdata['stock_quantity']})")

    db.flush()

    # ── 3. Set images from vehicle_images.json ───────────────────────
    print("\n3. Setting vehicle images...")
    images_file = Path(__file__).parent / "vehicle_images.json"
    if images_file.exists():
        with open(images_file) as f:
            images_data = json.load(f)

        for key, photos in images_data.items():
            parts = key.split("|")
            if len(parts) != 3:
                continue
            make, model, year = parts[0], parts[1], int(parts[2])
            vehicle = db.query(Vehicle).filter(
                Vehicle.make == make, Vehicle.model == model, Vehicle.year == year
            ).first()
            if not vehicle or not photos:
                continue

            # Set main_image_url from first photo
            vehicle.main_image_url = photos[0]["url"]

            # Insert vehicle_images (clear existing first for idempotency)
            db.query(VehicleImage).filter(VehicleImage.vehicle_id == vehicle.vehicle_id).delete()
            for i, p in enumerate(photos):
                img = VehicleImage(
                    vehicle_id=vehicle.vehicle_id,
                    image_url=p["url"],
                    sort_order=i,
                    credit=p.get("credit"),
                    source_url=p.get("source_url"),
                )
                db.add(img)
            print(f"  {make} {model} {year}: {len(photos)} images")

        db.flush()
    else:
        print("  ⚠️  vehicle_images.json not found — skipping images (fallback will be used)")

    # ── 4. Service types ─────────────────────────────────────────────
    print("\n4. Adding service types...")
    for st_data in SERVICE_TYPES:
        existing = db.query(ServiceType).filter(ServiceType.name == st_data["name"]).first()
        if existing:
            print(f"  Already exists: {st_data['name']}")
        else:
            st = ServiceType(**st_data)
            db.add(st)
            print(f"  Added: {st_data['name']}")

    db.flush()

    # ── 5. Technician profiles ───────────────────────────────────────
    print("\n5. Setting up technician profiles...")
    tech_password = hash_password("Admin@1234")

    # Tom Tech (existing) → Mechanic profile
    tom = db.query(User).filter(User.email == "tom@autoedge.com").first()
    if tom:
        existing_profile = db.query(TechnicianProfile).filter(TechnicianProfile.user_id == tom.user_id).first()
        if not existing_profile:
            tp = TechnicianProfile(
                user_id=tom.user_id,
                specialty="Mechanic",
                years_experience=10,
                bio="Senior mechanic with 10 years of experience. Specializes in engine diagnostics and full vehicle servicing.",
                is_bookable=True,
            )
            db.add(tp)
            print(f"  Added profile for Tom Tech (Mechanic)")
        else:
            print(f"  Profile already exists for Tom Tech")
    else:
        print(f"  ⚠️  Tom Tech not found — skipping profile")

    # New technician users
    for tech in NEW_TECHNICIANS:
        existing_user = db.query(User).filter(User.email == tech["email"]).first()
        if not existing_user:
            user = User(
                full_name=tech["full_name"],
                email=tech["email"],
                password_hash=tech_password,
                role="technician",
                is_active=True,
            )
            db.add(user)
            db.flush()
            tp = TechnicianProfile(
                user_id=user.user_id,
                specialty=tech["specialty"],
                years_experience=tech["years"],
                bio=tech["bio"],
                is_bookable=True,
            )
            db.add(tp)
            print(f"  Added: {tech['full_name']} ({tech['specialty']})")
        else:
            # Ensure profile exists
            existing_profile = db.query(TechnicianProfile).filter(TechnicianProfile.user_id == existing_user.user_id).first()
            if not existing_profile:
                tp = TechnicianProfile(
                    user_id=existing_user.user_id,
                    specialty=tech["specialty"],
                    years_experience=tech["years"],
                    bio=tech["bio"],
                    is_bookable=True,
                )
                db.add(tp)
            print(f"  Already exists: {tech['full_name']}")

    db.flush()

    # ── 6. Enquiry access ────────────────────────────────────────────
    print("\n6. Setting enquiry access...")
    for email in ["sarah@autoedge.com", "rita@autoedge.com"]:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.handles_enquiries = True
            print(f"  {user.full_name}: handles_enquiries = True")
        else:
            print(f"  ⚠️  {email} not found")

    db.flush()

    # ── 7. Demo customers ───────────────────────────────────────────
    print("\n7. Creating demo customers...")
    demo_password = hash_password("Demo@1234")
    starting_balance = settings.DEMO_STARTING_BALANCE
    demo_customer_ids = []

    for dc in DEMO_CUSTOMERS:
        # Check if account already exists
        existing_acct = db.query(CustomerAccount).filter(
            CustomerAccount.email == dc["email"]
        ).first()

        if existing_acct:
            print(f"  Already exists: {dc['email']}")
            demo_customer_ids.append(existing_acct.customer_id)
            continue

        # Create customer
        customer = db.query(Customer).filter(Customer.email == dc["email"]).first()
        if not customer:
            customer = Customer(
                full_name=dc["full_name"],
                email=dc["email"],
                phone=dc["phone"],
            )
            db.add(customer)
            db.flush()

        # Create account
        acct = CustomerAccount(
            customer_id=customer.customer_id,
            email=dc["email"],
            password_hash=demo_password,
            is_active=True,
        )
        db.add(acct)
        db.flush()

        # Create bank account
        acct_num = _generate_account_number()
        while db.query(BankAccount).filter(BankAccount.account_number == acct_num).first():
            acct_num = _generate_account_number()

        bank = BankAccount(
            customer_id=customer.customer_id,
            bank_name="AutoEdge Demo Bank",
            account_number=acct_num,
            card_last4=_generate_card_last4(),
            balance=starting_balance,
        )
        db.add(bank)
        db.flush()

        # Opening balance transaction
        ref = _generate_ref_code()
        while db.query(BankTransaction).filter(BankTransaction.reference_code == ref).first():
            ref = _generate_ref_code()

        txn = BankTransaction(
            bank_account_id=bank.bank_account_id,
            txn_type="Opening Balance",
            direction="Credit",
            amount=starting_balance,
            balance_after=starting_balance,
            reference_code=ref,
            description=f"Welcome to AutoEdge! Starting demo balance.",
        )
        db.add(txn)

        # Welcome notification
        notif = Notification(
            customer_id=customer.customer_id,
            type="welcome",
            title="Welcome to AutoEdge!",
            message=f"Welcome {dc['full_name']}! Your demo account is ready with a balance of ${starting_balance:,.2f}.",
            link_path="/account",
        )
        db.add(notif)

        demo_customer_ids.append(customer.customer_id)
        print(f"  Created: {dc['full_name']} ({dc['email']})")

    db.flush()

    # ── 8. Demo data ─────────────────────────────────────────────────
    print("\n8. Creating demo data...")

    # 8a. Restock requests — 3 on F-150, 1 on Camaro
    f150 = db.query(Vehicle).filter(Vehicle.make == "Ford", Vehicle.model == "F-150").first()
    camaro = db.query(Vehicle).filter(Vehicle.make == "Chevrolet", Vehicle.model == "Camaro").first()

    if f150 and len(demo_customer_ids) >= 3:
        for i, cid in enumerate(demo_customer_ids[:3]):
            existing = db.query(RestockRequest).filter(
                RestockRequest.customer_id == cid,
                RestockRequest.vehicle_id == f150.vehicle_id,
                RestockRequest.status == "Open",
            ).first()
            if not existing:
                rr = RestockRequest(
                    customer_id=cid,
                    vehicle_id=f150.vehicle_id,
                    status="Open",
                )
                db.add(rr)
                print(f"  Restock request: customer {cid} → F-150")

    if camaro and len(demo_customer_ids) >= 1:
        existing = db.query(RestockRequest).filter(
            RestockRequest.customer_id == demo_customer_ids[0],
            RestockRequest.vehicle_id == camaro.vehicle_id,
            RestockRequest.status == "Open",
        ).first()
        if not existing:
            rr = RestockRequest(
                customer_id=demo_customer_ids[0],
                vehicle_id=camaro.vehicle_id,
                status="Open",
            )
            db.add(rr)
            print(f"  Restock request: customer {demo_customer_ids[0]} → Camaro")

    db.flush()

    # 8b. Reviews — 6 reviews across 4 vehicles
    print("  Adding reviews...")
    review_data = [
        {"make": "Toyota", "model": "Camry", "cid_idx": 0, "rating": 5, "title": "Best family car!", "body": "We absolutely love our Camry. The ride is smooth, the cabin is quiet, and the fuel economy is outstanding. Highly recommend for anyone looking for a reliable sedan."},
        {"make": "Toyota", "model": "Camry", "cid_idx": 1, "rating": 4, "title": "Solid choice", "body": "Great car overall. The interior is comfortable and well-built. Only wish it had a bit more power, but the fuel savings make up for it."},
        {"make": "Honda", "model": "Civic", "cid_idx": 0, "rating": 5, "title": "Fun to drive!", "body": "The Civic is such a joy to drive. The handling is precise, the engine is peppy enough for daily commuting, and it looks great too. Honda really nailed this generation."},
        {"make": "Tesla", "model": "Model 3", "cid_idx": 1, "rating": 5, "title": "The future is here", "body": "Going electric was the best decision. The acceleration is incredible, Autopilot is impressive, and never going to a gas station again is liberating. The 15-inch screen is fantastic."},
        {"make": "Tesla", "model": "Model 3", "cid_idx": 2, "rating": 4, "title": "Almost perfect", "body": "Amazing technology and performance. The range is great for daily use. Only knocked one star because the ride can be a bit firm on rough roads. Otherwise, a phenomenal vehicle."},
        {"make": "Kia", "model": "Sportage", "cid_idx": 2, "rating": 4, "title": "Great value SUV", "body": "The Sportage offers incredible value for money. The interior feels premium, the tech features are plentiful, and it drives confidently. Kia has come a long way."},
    ]

    for rd in review_data:
        if rd["cid_idx"] >= len(demo_customer_ids):
            continue
        cid = demo_customer_ids[rd["cid_idx"]]
        vehicle = db.query(Vehicle).filter(
            Vehicle.make == rd["make"], Vehicle.model == rd["model"]
        ).first()
        if not vehicle:
            continue

        existing = db.query(Review).filter(
            Review.vehicle_id == vehicle.vehicle_id,
            Review.customer_id == cid,
        ).first()
        if existing:
            continue

        review = Review(
            vehicle_id=vehicle.vehicle_id,
            customer_id=cid,
            rating=rd["rating"],
            title=rd["title"],
            body=rd["body"],
            is_visible=True,
        )
        db.add(review)
        print(f"    Review: {rd['make']} {rd['model']} by customer {cid} ({rd['rating']}★)")

    db.flush()

    # 8c. Wishlist items — 2 items
    print("  Adding wishlist items...")
    tesla = db.query(Vehicle).filter(Vehicle.make == "Tesla", Vehicle.model == "Model 3").first()
    bmw = db.query(Vehicle).filter(Vehicle.make == "BMW", Vehicle.model == "3 Series").first()

    for vehicle, cid_idx in [(tesla, 1), (bmw, 2)]:
        if vehicle and cid_idx < len(demo_customer_ids):
            cid = demo_customer_ids[cid_idx]
            existing = db.query(WishlistItem).filter(
                WishlistItem.customer_id == cid,
                WishlistItem.vehicle_id == vehicle.vehicle_id,
            ).first()
            if not existing:
                wi = WishlistItem(customer_id=cid, vehicle_id=vehicle.vehicle_id)
                db.add(wi)
                print(f"    Wishlist: customer {cid} → {vehicle.make} {vehicle.model}")

    db.flush()

    # 8d. Active reservation (demo1, 14-day hold on Kia Sportage)
    print("  Adding reservation...")
    kia = db.query(Vehicle).filter(Vehicle.make == "Kia", Vehicle.model == "Sportage").first()

    if kia and len(demo_customer_ids) >= 1:
        cid = demo_customer_ids[0]
        existing_res = db.query(Reservation).filter(
            Reservation.customer_id == cid,
            Reservation.vehicle_id == kia.vehicle_id,
            Reservation.status == "Active",
        ).first()

        if not existing_res:
            deposit = round(kia.price * Decimal("10") / Decimal("100"), 2)

            # Get customer's bank account
            bank = db.query(BankAccount).filter(BankAccount.customer_id == cid).first()
            if bank and bank.balance >= deposit:
                # Create reservation
                expires = now + timedelta(days=14)
                res = Reservation(
                    customer_id=cid,
                    vehicle_id=kia.vehicle_id,
                    deposit_amount=deposit,
                    hold_days=14,
                    reserved_at=now,
                    expires_at=expires,
                    status="Active",
                )
                db.add(res)
                db.flush()

                # Debit bank
                bank.balance -= deposit
                ref = _generate_ref_code()
                while db.query(BankTransaction).filter(BankTransaction.reference_code == ref).first():
                    ref = _generate_ref_code()

                txn = BankTransaction(
                    bank_account_id=bank.bank_account_id,
                    txn_type="Reservation Deposit",
                    direction="Debit",
                    amount=deposit,
                    balance_after=bank.balance,
                    reference_code=ref,
                    description=f"Reservation deposit for {kia.year} {kia.make} {kia.model}",
                    reservation_id=res.reservation_id,
                )
                db.add(txn)

                # Decrement stock + stock movement
                kia.stock_quantity -= 1
                sm = StockMovement(
                    vehicle_id=kia.vehicle_id,
                    change_qty=-1,
                    reason="Reservation",
                    reference_id=res.reservation_id,
                )
                db.add(sm)

                # Notification
                notif = Notification(
                    customer_id=cid,
                    type="reservation_confirmed",
                    title="Reservation Confirmed!",
                    message=f"Your reservation for the {kia.year} {kia.make} {kia.model} has been confirmed. Deposit: ${deposit:,.2f}. Expires: {expires.strftime('%Y-%m-%d')}.",
                    link_path="/account/reservations",
                )
                db.add(notif)

                print(f"    Reservation: customer {cid} → {kia.make} {kia.model} (deposit ${deposit}, 14-day hold)")
        else:
            print(f"    Reservation already exists for customer {cid} → {kia.make} {kia.model}")

    db.flush()

    # 8e. Enquiry thread with staff reply
    print("  Adding enquiry thread...")
    if len(demo_customer_ids) >= 2:
        cid = demo_customer_ids[1]
        existing_enq = db.query(Enquiry).filter(Enquiry.customer_id == cid).first()

        if not existing_enq:
            camry = db.query(Vehicle).filter(Vehicle.make == "Toyota", Vehicle.model == "Camry").first()
            sarah = db.query(User).filter(User.email == "sarah@autoedge.com").first()

            enq = Enquiry(
                customer_id=cid,
                vehicle_id=camry.vehicle_id if camry else None,
                subject="Question about the Toyota Camry financing options",
                status="Answered",
                assigned_to=sarah.user_id if sarah else None,
            )
            db.add(enq)
            db.flush()

            # Customer's initial message
            msg1 = EnquiryMessage(
                enquiry_id=enq.enquiry_id,
                sender_type="customer",
                body="Hi, I'm interested in the 2023 Toyota Camry. Could you tell me more about financing options? I'd like to know about the monthly payment plans available.",
            )
            db.add(msg1)

            # Staff reply
            if sarah:
                msg2 = EnquiryMessage(
                    enquiry_id=enq.enquiry_id,
                    sender_type="staff",
                    sender_user_id=sarah.user_id,
                    body="Thank you for your interest in the Toyota Camry! We offer flexible financing through our partner banks with competitive interest rates starting from 7.5% APR. You can use the EMI calculator on our website to estimate monthly payments. For the Camry, a 20% down payment with a 48-month term gives a very manageable monthly installment. Would you like to visit for a test drive?",
                )
                db.add(msg2)

            print(f"    Enquiry: customer {cid} about Toyota Camry (1 customer msg + 1 staff reply)")
        else:
            print(f"    Enquiry already exists for customer {cid}")

    db.flush()

    # ── Commit all changes ───────────────────────────────────────────
    db.commit()

    # ── Print summary ────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("SEED SUMMARY")
    print(f"{'='*60}")

    vehicle_count = db.query(Vehicle).count()
    published = db.query(Vehicle).filter(Vehicle.is_published == True).count()
    oos = db.query(Vehicle).filter(Vehicle.stock_quantity == 0).count()
    service_type_count = db.query(ServiceType).count()
    tech_count = db.query(TechnicianProfile).count()
    customer_count = db.query(CustomerAccount).count()
    restock_count = db.query(RestockRequest).filter(RestockRequest.status == "Open").count()
    review_count = db.query(Review).count()
    res_count = db.query(Reservation).filter(Reservation.status == "Active").count()
    enq_count = db.query(Enquiry).count()
    wishlist_count = db.query(WishlistItem).count()

    print(f"  Vehicles:           {vehicle_count} ({published} published, {oos} out of stock)")
    print(f"  Service types:      {service_type_count}")
    print(f"  Technician profiles:{tech_count}")
    print(f"  Demo customers:     {customer_count}")
    print(f"  Open restock:       {restock_count}")
    print(f"  Reviews:            {review_count}")
    print(f"  Active reservations:{res_count}")
    print(f"  Enquiries:          {enq_count}")
    print(f"  Wishlist items:     {wishlist_count}")

    # Verify ledger consistency
    print(f"\n  Ledger check:")
    for dc in DEMO_CUSTOMERS:
        acct = db.query(CustomerAccount).filter(CustomerAccount.email == dc["email"]).first()
        if acct:
            bank = db.query(BankAccount).filter(BankAccount.customer_id == acct.customer_id).first()
            if bank:
                from sqlalchemy import func as sqf
                credits = db.query(sqf.coalesce(sqf.sum(BankTransaction.amount), 0)).filter(
                    BankTransaction.bank_account_id == bank.bank_account_id,
                    BankTransaction.direction == "Credit",
                ).scalar()
                debits = db.query(sqf.coalesce(sqf.sum(BankTransaction.amount), 0)).filter(
                    BankTransaction.bank_account_id == bank.bank_account_id,
                    BankTransaction.direction == "Debit",
                ).scalar()
                expected = credits - debits
                actual = bank.balance
                match = "✅" if expected == actual else "❌"
                print(f"    {dc['email']}: balance=${actual}, credits-debits=${expected} {match}")

    print(f"\n✅ Seed complete!")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()
