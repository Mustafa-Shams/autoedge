# AutoEdge redesign build plan

## Resume and checkpoint protocol

At the beginning of every build session, including after a quota reset, read the current redesign checkpoint at the top of HANDOFF.md first. Then read this plan, inspect the working tree and compare it with the checkpoint. Preserve existing edits. Resume the first unfinished acceptance check. A reset by itself does not launch a new session.

Before editing a step, mark it in progress in HANDOFF.md with its intended outcome. After verifying it, update HANDOFF.md **first**, before moving to another step. Record changed paths, checks and results, partial work, outstanding decisions and the exact next action. A partial change stays in progress. Use local disposable data for writes, migrations and browser submissions. Leave GitHub pushes and production deployment to the owner.

## Implementation sequence and acceptance checks

1. Repair the audited purchase-adjacent flows. Verify test-drive submission, service cancellation and refund, and vehicle selection in the EMI calculator with a catalog spanning multiple pages.
2. Introduce a shared deal and individual inventory units. Preserve existing IDs, holds, receipts, sales and stock ledgers. Map historical aggregate stock without inventing VINs. Reconcile inventory before and after migration. Test upgrades on throwaway PostgreSQL.
3. Deliver one complete self-service purchase. Buy now or Complete purchase allocates one unit, credits any paid deposit once, charges the demo wallet, creates one sale and receipt, and queues pickup. Insufficient funds, expired holds, retries and two buyers racing for the last unit must leave consistent balances and stock.
4. Build My purchases and staff handover. Show price, deposit, verified credit, balance, deadline, refund terms, messages and next action. Distinguish paid from collected. Confirm pickup once and add that unit to the customer's garage. Support assisted and walk-in deals through the same completion logic.
5. Connect enquiries, appointments and test drives to deals. Give each team member a role-specific Today queue. Record qualifying assistance and ownership before payment. Show why a commission is owed, make it payable at handover, and award zero individual commission on self-service sales. Preserve historical attribution.
6. Connect trade-in offers to purchases. Draft on acceptance, schedule inspection, require customer approval of revised terms, record physical intake and apply credit once. Separate acquisition price, preparation cost and retail price. Publish after staff verifies photos, descriptions and availability.
7. Reorganize staff navigation into Today, Sales, Inventory, Service, Customers and Administration. Retain searchable lists, linked detail pages, existing role ceilings, activity, staff and technician profiles. Put exceptions, appointments and handovers on the responsible person's queue. Group commissions and email diagnostics with their operational context.
8. Redesign storefront navigation, inventory cards, filters, gallery, comparison and wishlist. Preserve search, scroll and login return paths. Provide Buy now, Reserve, enquiry, test drive and restock actions according to availability. Link wallet charges, refunds, messages and notifications to their purchases, receipts or bookings. Simplify the simulated card interface.
9. Finish garage and after-sales journeys. Connect booking, technician assignment, service job, parts, status, cancellation, refund, receipt and service history for the same car. Keep email delivery independent of successful business transactions.
10. Verify both interfaces on mobile, desktop and keyboard. Resolve low contrast, unnamed inputs and buttons, modal Escape/focus restoration and vehicle-detail overflow. Test empty, loading, failed and retry states. Run backend suite, both builds, disposable PostgreSQL migrations and browser journeys for self-service, assisted and abandoned trade-in purchases. Document owner deployment commands and remaining limitations.

## Approved business rules

- The demo wallet pays for storefront purchases. EMI remains an estimate. Existing reservation refund rules apply to holds.
- A customer can purchase before staff verify the VIN. Handover requires staff verification against the physical unit.
- A manager-approved cancellation before pickup returns 20% of the cash and wallet payments, including paid deposits. If the showroom received a trade-in, both parties must agree to return it and staff must confirm physical return before releasing either vehicle.
- One salesperson with recorded qualifying assistance before payment earns a commission at handover. Qualifying assistance is a sale-related conversation, completed test drive, or walk-in appointment.
- Trade-in credit requires inspection, customer approval of current terms and physical intake. A standalone acquisition requires a manager-recorded payment before resale. For trade-in value above a purchase balance, the customer and manager agree on the exact excess before purchase, and staff record the separate payment at pickup.
- If historical sale and reservation ownership is ambiguous, the migration stops and identifies the record for reconciliation.

## Connected workflow verification

Resume from the numbered follow-up in HANDOFF.md. The shared deal, signed reservation quote, intake verification, persistent private unit, role-based work routing, sale commission details and delivery-time email rendering extend the original ten steps. Apply Alembic revisions through 0015 before serving either updated portal. The deployment owner retains control of production rollout.
