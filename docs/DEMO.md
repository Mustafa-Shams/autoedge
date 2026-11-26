# AutoEdge demo script

Three buyer stories that show the whole workflow: one shared deal number from the first question to pickup, where the car and the money are at every step, who acts next, and who earns commission.

Every step below was run on a local copy of the database on November 26 (see "Verified locally" at the end). The amounts come from that run. On the live site the cars and IDs can differ, but the rules and the clicks are the same.

## Before you start

| Portal | Address | Accounts |
|---|---|---|
| Storefront | https://autoedge-storefront.vercel.app | `demo1@example.com`, `demo2@example.com`, `demo3@example.com` (password `Demo@1234`) |
| Staff portal | https://autoedge-three.vercel.app | `admin@autoedge.com` (Manager), `sarah@autoedge.com` (Sales Executive), `rita@autoedge.com` (Receptionist), password `Admin@1234` |

- Use two browser windows: a normal one for the customer and a private one for staff, because each portal keeps its login per tab.
- Each customer starts with a $50,000.00 demo wallet. Check it under **My Account → Demo wallet** before you begin.
- Pick a car with at least two units in stock for each story. The car page shows "In Stock" and the staff **Vehicles** list shows the unit count.

## The four questions, and where to show the answers

| Question | Customer screen | Staff screen |
|---|---|---|
| Who has the car? | **My purchases** ("Awaiting pickup" or the VIN after pickup), **Garage** | **Sales and pickups**, the deal page under **Deals** |
| Where is the money? | **Demo wallet** statement (Debit and Credit columns) | Receipt on **Sales and pickups**, deal page "due" amount |
| Who acts next? | **My deals → the deal** ("next action") | **Today** (one task per person, with the owner's name) |
| Who gets commission? | Never shown to customers | **Commissions**, and the "Commission at pickup" line in **Sales assistance** |

---

## Story 1: Self-service Buy now (no commission)

Customer `demo2@example.com` buys a car online without any staff help. Example from the local run: 2023 Toyota Camry, $28,500.00.

| # | Who | Exact clicks | Car is with | Money | Next action | Commission |
|---|---|---|---|---|---|---|
| 1 | Customer | **Log in**, enter email and password, **Log In**. Click **Cars**, open the car, click **Buy now**. | Showroom (unit in stock) | Wallet $50,000.00 | Customer pays | None |
| 2 | Customer | On the checkout page, type the login password in **Confirm your account password** (this is the card PIN; the link under it explains), click **Pay $28,500.00 and reserve pickup**. | Showroom, one unit now allocated to this deal; listing stock drops by one | Wallet $21,500.00. The statement shows **-$28,500.00** in the Debit column | Staff confirm pickup | None |
| 3 | Customer | **My Account → My purchases**: stage "Awaiting pickup", deal number, receipt, pickup deadline. | Showroom | Paid in full, balance due $0.00 | Staff | None |
| 4 | Sarah | Sign in. **Today** shows **Confirm pickup** for this sale, owner "Sarah Sales". Click it. | Showroom | Paid | Sarah | None |
| 5 | Sarah | On **Sales and pickups**, type the 17-character VIN from the car into **VIN on unit #…**, click **Verify VIN and confirm pickup**. | Customer. Deal stage "Collected"; the car appears in the customer's **Garage** with that VIN | Unchanged | Nobody | **None: self-service sales earn no commission** |

Show afterwards: **Garage** lists the car with "Purchase receipt"; **Commissions** has no row for this sale.

---

## Story 2: Assisted buy after a test drive (Sarah earns 2.5%)

Customer `demo3@example.com` books a test drive, Sarah takes them out, then the customer buys online. Example: 2022 Honda Civic, $19,900.00.

| # | Who | Exact clicks | Car is with | Money | Next action | Commission |
|---|---|---|---|---|---|---|
| 1 | Customer | Open the car, click **Book a test drive**, choose **Select Date** and **Select Time Slot**, click **Request Test Drive**. | Showroom | Wallet $50,000.00 | Staff confirm within 48 hours, or the request expires | None |
| 2 | Customer | **My Account → My deals**: a deal number now exists for this car (stage "Shopping"). It is the same number all the way to pickup. | Showroom | — | Staff | None |
| 3 | Sarah | **Today** shows **Review test drive**. Open **Test Drives**, click **Confirm** on the row. The drive is assigned to Sarah. | Showroom | — | Drive happens | None |
| 4 | Sarah | After the drive, click the row on **Test Drives** to edit it, set **Status** to **Completed**, click **Update**. | Showroom | — | Sarah records ownership | None |
| 5 | Sarah | Open **Sales and pickups → Record Sale**. Choose the customer in **Customer** and the car in **Vehicle**. In the **Sales assistance** box open **Assign an owner before payment**, choose **Test drive · Completed test drive #…** under **Qualifying assistance**, type what you helped with, click **Save pre-payment ownership**. Leave the page without clicking **Record Sale**; the customer pays online. | Showroom | — | Customer pays | "Commission at pickup $497.50" is shown, but nothing is owed yet |
| 6 | Customer | Back on the car page, **Buy now**, password, **Pay $19,900.00 and reserve pickup**. | Showroom, unit allocated | Wallet $30,100.00 | Staff confirm pickup | Still not owed |
| 7 | Customer | **My deals**: the purchase is on the same deal number as the test drive. | Showroom | Paid | Staff | — |
| 8 | Sarah | **Today → Confirm pickup**, enter the VIN, **Verify VIN and confirm pickup**. | Customer (Garage) | Unchanged | Manager approves and pays commission | **Sarah: $497.50 (2.5% of $19,900.00), status Pending** |
| 9 | Admin | **Commissions** shows Sarah's row with the evidence "Test drive · …". Click **Approve**, then **Mark Paid** when it is paid out. | Customer | Commission payable to Sarah | — | Paid once |

Points to make: ownership must be recorded before payment, one salesperson per deal, and a second purchase of another unit would need new evidence.

---

## Story 3: Reserve with a trade-in, then walk away

A new customer reserves a car, offers their old car as a trade-in, accepts the offer, then changes their mind. Example: 2022 Hyundai Tucson, $23,500.00, 7-day hold. Sign up a fresh customer from **Sign up** so the wallet starts at $50,000.00.

| # | Who | Exact clicks | Car is with | Money | Next action | Commission |
|---|---|---|---|---|---|---|
| 1 | Customer | Open the car, click **Reserve this car**, choose **Hold Period** "7 days", type the password (PIN), click **Pay $2,350.00**. | Showroom, one unit held for this deal; stock drops by one | Wallet $47,650.00 (10% deposit debited) | Customer buys within 7 days, or the hold expires | None |
| 2 | Customer | On the same car page click **Trade in your car towards this one**. The form says "Trading towards 2022 Hyundai Tucson". Fill in make, model, year, mileage and condition, add at least three photos, click **Submit Trade-In Request**. | New car: showroom. Old car: customer | Unchanged | Staff value the trade-in | None |
| 3 | Sarah | **Trade-Ins**, click **Make Offer** on the request, enter $5,500 in **Your Offer**, click **Submit Offer**. | Same | Unchanged | Customer answers the offer | None |
| 4 | Customer | **My Account → Trade-Ins**, click **Accept Offer**, confirm **Accept**. The showroom now has a private acquisition draft; nothing is published and the old car stays with the customer until physical intake. | Same | Unchanged; the $5,500 would only be credited after inspection, approval and intake | Staff arrange inspection | None |
| 5 | Customer | Walks away: **Trade-Ins → Cancel Request** (allowed until physical intake), then **Reservations → Cancel Reservation**. | New car back in showroom stock; old car never left the customer | Wallet $49,765.00: refund of $2,115.00 (90% of the deposit); the $235.00 fee stays with the showroom | Nobody | None |

Show afterwards: the deal stage is "Cancelled", the statement shows the deposit as a Debit and the refund as a Credit, and the car's stock is back to its starting count.

If the customer had already **paid in full** and then cancelled before pickup, the rule is different: a manager must approve, the wallet gets 20% of what was paid, and a trade-in that the showroom already holds is returned only after both sides agree.

---

## Verified locally

On November 26 all three stories ran against a freshly migrated local PostgreSQL copy (Alembic head `0016_enquiry_category`) with the seed data. The recorded results matched the tables above:

| Story | Deal stages seen | Wallet after | Commission |
|---|---|---|---|
| 1 | Awaiting pickup → Collected | $21,500.00 | none |
| 2 | Shopping → Awaiting pickup → Collected, one deal number | $30,100.00 | Sarah Sales, $497.50, Pending |
| 3 | Reserved → Cancelled | $49,765.00 (deposit $2,350.00, refund $2,115.00) | none |
