"""Email HTML templates for all notification types — spec 7.9.

Each function returns (subject, body_html).
Templates use inline CSS for email client compatibility.
"""


def _wrap(content: str, title: str) -> str:
    """Wrap content in a styled email container."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0F17;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:20px;font-weight:700;color:#4D7FFF;">🚗 AutoEdge</span>
  </div>
  <div style="background-color:#161821;border:1px solid #2A2D3E;border-radius:12px;padding:32px;">
    <h2 style="color:#E4E6F0;margin:0 0 16px;font-size:18px;">{title}</h2>
    {content}
  </div>
  <p style="text-align:center;color:#6B7280;font-size:11px;margin-top:24px;">
    This is an automated message from AutoEdge Car Showroom.
    <br>This is a demo project — no real transactions are involved.
  </p>
</div>
</body>
</html>"""


def _p(text: str) -> str:
    return f'<p style="color:#A0A4B8;font-size:14px;line-height:1.6;margin:0 0 12px;">{text}</p>'


def _button(url: str, label: str) -> str:
    return f'''<div style="text-align:center;margin-top:24px;">
  <a href="{url}" style="display:inline-block;padding:12px 28px;background-color:#4D7FFF;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">{label}</a>
</div>'''


def _highlight(label: str, value: str) -> str:
    return f'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2A2D3E;"><span style="color:#6B7280;font-size:13px;">{label}</span><span style="color:#E4E6F0;font-size:13px;font-weight:600;">{value}</span></div>'


# ── Template functions ──────────────────────────────────────────────

def welcome(store_url: str, customer_name: str) -> tuple[str, str]:
    subject = "Welcome to AutoEdge!"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p("Welcome to AutoEdge! Your account has been created successfully. "
             "You can now browse our inventory, reserve vehicles, book services, and more.")
        + _button(f"{store_url}/cars", "Browse Our Cars"),
        "Welcome to AutoEdge 🎉"
    )
    return subject, body


def reservation_confirmed(store_url: str, customer_name: str,
                          vehicle_label: str, deposit: str,
                          expires_at: str, reference_code: str) -> tuple[str, str]:
    subject = f"Reservation Confirmed — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your reservation for the <strong>{vehicle_label}</strong> has been confirmed.")
        + _highlight("Deposit", deposit)
        + _highlight("Reference", reference_code)
        + _highlight("Hold Until", expires_at)
        + _p("Visit your reservations page to view the receipt or manage your reservation.")
        + _button(f"{store_url}/account/reservations", "View Reservations"),
        "Reservation Confirmed ✅"
    )
    return subject, body


def reservation_cancelled(store_url: str, customer_name: str,
                          vehicle_label: str, refund_amount: str) -> tuple[str, str]:
    subject = f"Reservation Cancelled — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your reservation for the <strong>{vehicle_label}</strong> has been cancelled.")
        + _highlight("Refund", refund_amount)
        + _p("The refund has been credited to your AutoEdge Demo Bank account.")
        + _button(f"{store_url}/account/reservations", "View Reservations"),
        "Reservation Cancelled"
    )
    return subject, body


def reservation_expired(store_url: str, customer_name: str,
                        vehicle_label: str, refund_amount: str) -> tuple[str, str]:
    subject = f"Reservation Expired — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your reservation for the <strong>{vehicle_label}</strong> has expired.")
        + _highlight("Deposit Refunded", refund_amount)
        + _p("Your full deposit has been refunded. The vehicle is now available for others to reserve.")
        + _button(f"{store_url}/cars", "Browse Cars"),
        "Reservation Expired ⏰"
    )
    return subject, body


def reservation_expiring_soon(store_url: str, customer_name: str,
                              vehicle_label: str, expires_at: str) -> tuple[str, str]:
    subject = f"Reservation Expiring Soon — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your reservation for the <strong>{vehicle_label}</strong> is expiring soon.")
        + _highlight("Expires On", expires_at)
        + _p("Please visit the showroom to complete your purchase before the reservation expires.")
        + _button(f"{store_url}/account/reservations", "View Reservations"),
        "Reservation Expiring Soon ⚠️"
    )
    return subject, body


def test_drive_requested(store_url: str, customer_name: str,
                         vehicle_label: str, date: str, time: str) -> tuple[str, str]:
    subject = f"Test Drive Request Submitted — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your test drive request for the <strong>{vehicle_label}</strong> has been submitted.")
        + _highlight("Date", date)
        + _highlight("Time", time)
        + _p("Our staff will review and confirm your request shortly. "
             "You will be notified once it's confirmed.")
        + _button(f"{store_url}/account/test-drives", "View Test Drives"),
        "Test Drive Request Submitted 🚗"
    )
    return subject, body


def test_drive_confirmed(store_url: str, customer_name: str,
                         vehicle_label: str, date: str, time: str) -> tuple[str, str]:
    subject = f"Test Drive Confirmed — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Great news! Your test drive for the <strong>{vehicle_label}</strong> has been confirmed.")
        + _highlight("Date", date)
        + _highlight("Time", time)
        + _p("Please arrive 10 minutes early with a valid driving licence.")
        + _button(f"{store_url}/account/test-drives", "View Test Drives"),
        "Test Drive Confirmed ✅"
    )
    return subject, body


def test_drive_declined(store_url: str, customer_name: str,
                        vehicle_label: str, reason: str) -> tuple[str, str]:
    subject = f"Test Drive Declined — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Unfortunately, your test drive request for the <strong>{vehicle_label}</strong> "
             f"has been declined.")
        + _highlight("Reason", reason)
        + _p("You can submit a new request for a different date/time.")
        + _button(f"{store_url}/account/test-drives", "View Test Drives"),
        "Test Drive Declined"
    )
    return subject, body


def test_drive_expired(store_url: str, customer_name: str,
                       vehicle_label: str) -> tuple[str, str]:
    subject = f"Test Drive Request Expired — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your test drive request for the <strong>{vehicle_label}</strong> "
             f"has expired as it was not confirmed within 48 hours.")
        + _p("Feel free to submit a new request.")
        + _button(f"{store_url}/cars", "Browse Cars"),
        "Test Drive Expired ⏰"
    )
    return subject, body


def enquiry_replied(store_url: str, customer_name: str,
                    subject_line: str) -> tuple[str, str]:
    subject = f"New Reply to Your Enquiry — {subject_line}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Our team has replied to your enquiry: <strong>{subject_line}</strong>.")
        + _p("Visit your enquiries page to view the full conversation.")
        + _button(f"{store_url}/account/enquiries", "View Enquiries"),
        "New Reply to Your Enquiry 💬"
    )
    return subject, body


def trade_in_offer(store_url: str, customer_name: str,
                   vehicle_label: str, offered_value: str) -> tuple[str, str]:
    subject = f"Trade-In Offer Received — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"We've reviewed your trade-in request for the <strong>{vehicle_label}</strong> "
             f"and have an offer for you.")
        + _highlight("Offered Value", offered_value)
        + _p("You can accept or decline this offer on your trade-ins page. "
             "The offer is valid for 7 days.")
        + _button(f"{store_url}/account/trade-ins", "View Offer"),
        "Trade-In Offer 💰"
    )
    return subject, body


def trade_in_expired(store_url: str, customer_name: str,
                     vehicle_label: str) -> tuple[str, str]:
    subject = f"Trade-In Offer Expired — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"The trade-in offer for your <strong>{vehicle_label}</strong> has expired. "
             f"You can submit a new request if you're still interested.")
        + _button(f"{store_url}/account/trade-ins", "View Trade-Ins"),
        "Trade-In Offer Expired ⏰"
    )
    return subject, body


def service_booked(store_url: str, customer_name: str,
                   service_type: str, vehicle_label: str,
                   date: str, time: str, fee: str) -> tuple[str, str]:
    subject = f"Service Booking Confirmed — {service_type}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your service booking for <strong>{service_type}</strong> "
             f"on your <strong>{vehicle_label}</strong> has been placed.")
        + _highlight("Date", date)
        + _highlight("Time", time)
        + _highlight("Booking Fee", fee)
        + _p("Our team will review and confirm the booking shortly.")
        + _button(f"{store_url}/account/service-bookings", "View Bookings"),
        "Service Booking Placed 🔧"
    )
    return subject, body


def service_confirmed(store_url: str, customer_name: str,
                      service_type: str, technician_name: str,
                      date: str, time: str) -> tuple[str, str]:
    subject = f"Service Confirmed — {service_type}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your service booking for <strong>{service_type}</strong> has been confirmed!")
        + _highlight("Technician", technician_name)
        + _highlight("Date", date)
        + _highlight("Time", time)
        + _p("Please arrive on time for your service appointment.")
        + _button(f"{store_url}/account/service-bookings", "View Bookings"),
        "Service Confirmed ✅"
    )
    return subject, body


def service_completed(store_url: str, customer_name: str,
                      service_type: str, vehicle_label: str) -> tuple[str, str]:
    subject = f"Service Completed — {service_type}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your <strong>{service_type}</strong> service on the "
             f"<strong>{vehicle_label}</strong> has been completed.")
        + _p("Thank you for choosing AutoEdge for your vehicle servicing needs.")
        + _button(f"{store_url}/account/service-bookings", "View Details"),
        "Service Completed ✅"
    )
    return subject, body


def restock_available(store_url: str, customer_name: str,
                      vehicle_label: str, vehicle_id: int) -> tuple[str, str]:
    subject = f"Back in Stock — {vehicle_label}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Great news! The <strong>{vehicle_label}</strong> you requested is now back in stock.")
        + _p("Don't miss out — reserve it before it's gone!")
        + _button(f"{store_url}/cars/{vehicle_id}", "View Car"),
        "Back in Stock! 🎉"
    )
    return subject, body


def purchase_completed(store_url: str, customer_name: str, vehicle_label: str,
                       payment_confirmed: bool = True, sale_id: int | None = None) -> tuple[str, str]:
    title = "Payment received" if payment_confirmed else "Purchase recorded"
    next_action = ("Collect your vehicle at the showroom. Staff will verify its VIN at handover."
                   if payment_confirmed else "The showroom will verify your payment before arranging pickup.")
    path = f"{store_url}/account/purchases"
    if sale_id is not None:
        path += f"#sale-{sale_id}"
    body = _wrap(_p(f"Hi {customer_name},") + _p(f"{title} · {vehicle_label}")
                 + _p(next_action) + _button(path, "View purchase receipt"), title)
    return f"{title} · {vehicle_label}", body


def top_up(store_url: str, customer_name: str, amount: str,
           new_balance: str) -> tuple[str, str]:
    subject = f"Demo Balance Topped Up — {amount}"
    body = _wrap(
        _p(f"Hi {customer_name},")
        + _p(f"Your AutoEdge Demo Bank account has been topped up by <strong>{amount}</strong>.")
        + _highlight("Top-Up Amount", amount)
        + _highlight("New Balance", new_balance)
        + _button(f"{store_url}/account/bank", "View Account"),
        "Balance Topped Up 💳"
    )
    return subject, body


# ── Template dispatcher ──────────────────────────────────────────────

TEMPLATES = {
    "welcome": welcome,
    "reservation_confirmed": reservation_confirmed,
    "reservation_cancelled": reservation_cancelled,
    "reservation_expired": reservation_expired,
    "reservation_expiring_soon": reservation_expiring_soon,
    "test_drive_requested": test_drive_requested,
    "test_drive_confirmed": test_drive_confirmed,
    "test_drive_declined": test_drive_declined,
    "test_drive_expired": test_drive_expired,
    "enquiry_replied": enquiry_replied,
    "trade_in_offer": trade_in_offer,
    "trade_in_expired": trade_in_expired,
    "service_booked": service_booked,
    "service_confirmed": service_confirmed,
    "service_completed": service_completed,
    "restock_available": restock_available,
    "purchase_completed": purchase_completed,
    "top_up": top_up,
}


def get_email_content(notification_type: str, store_url: str,
                      customer_name: str, **kwargs) -> tuple[str, str] | None:
    """Get (subject, body_html) for a notification type.

    Returns None if no template exists for the type.
    """
    template_fn = TEMPLATES.get(notification_type)
    if not template_fn:
        return None
    return template_fn(store_url=store_url, customer_name=customer_name, **kwargs)
