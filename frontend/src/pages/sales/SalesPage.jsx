import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { hasModuleAccess } from "../../utils/staffAccess";
import { Plus, Filter } from "lucide-react";
import { salesApi } from "../../api/salesApi";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatCurrency, formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["", "Pending", "Completed", "Cancelled"];

const COLUMNS = [
  {
    key: "vehicle_info",
    label: "Vehicle",
    render: (v, row) => v ?? `Vehicle #${row.vehicle_id}`,
  },
  {
    key: "customer_name",
    label: "Customer",
    render: (v, row) => v ?? `Customer #${row.customer_id}`,
  },
  {
    key: "staff_name",
    label: "Staff",
    render: (v, row) => v ?? (row.staff_id ? `Staff #${row.staff_id}` : "Self-service"),
  },
  { key: "sale_price", label: "Price", render: (v) => formatCurrency(v) },
  { key: "payment_type", label: "Payment" },
  { key: "sale_date", label: "Date", render: (v) => formatDate(v) },
  { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
];

function PickupCell({ sale, user, refresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event, action) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = form.tagName === "FORM" ? new FormData(form) : null;
    setBusy(true);
    setError("");
    try {
      if (action === "message") {
        const id = sale.enquiry_id || (await salesApi.conversation(sale.sale_id)).enquiry_id;
        navigate(`/enquiries/${id}`);
        return;
      }
      if (action === "payment") {
        await salesApi.verifyPayment(sale.sale_id, {
          cash_received: data.get("cash"), external_funding: data.get("funding") || "0",
          reference: data.get("reference"), trade_received: data.has("trade"),
        });
      } else if (action === "deadline") {
        await salesApi.schedulePickup(sale.sale_id, new Date(data.get("deadline")).toISOString());
      } else if (action === "refund") {
        await salesApi.approveRefund(sale.sale_id, data.has("trade"));
      } else {
        await salesApi.handover(sale.sale_id, data.get("vin"), data.get("settlement"));
      }
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save. Refresh and try again.");
    } finally { setBusy(false); }
  }
  if (!sale.pickup_status) return "—";
  const awaiting = sale.pickup_status === "Awaiting pickup";
  const canWrite = hasModuleAccess(user, "sales", true);
  return <div className="min-w-48 space-y-2">
    {sale.deal_id && <Link className="underline" to={`/deals/${sale.deal_id}`}>Deal #{sale.deal_id}</Link>}
    {sale.commission_details && <details><summary>Commission {formatCurrency(sale.commission_details.amount)}</summary>
      <p>{sale.commission_details.owner} · {sale.commission_details.rate}% · {sale.commission_details.status}</p>
      <p>{sale.commission_details.evidence}</p></details>}
    {!sale.staff_id && sale.pickup_status === "Collected" && <p>Self-service · no individual commission</p>}
    <p>{awaiting && !sale.payment_verified ? "Awaiting payment verification" : sale.pickup_status}</p>
    {awaiting && canWrite && !sale.payment_verified && <details><summary>Verify showroom payment</summary>
      <form className="space-y-2" onSubmit={e => submit(e, "payment")}>
        <p>Remaining balance {formatCurrency(sale.balance_due_at_showroom)}</p>
        <label className="block">Cash received<input className="input" type="number" name="cash" min="0" step="0.01" required /></label>
        {sale.payment_type !== "Cash" && <label className="block">Confirmed lender funding<input className="input" type="number" name="funding" min="0" step="0.01" required /></label>}
        <label className="block">Receipt or funding reference<input className="input" name="reference" required maxLength={100} /></label>
        {sale.trade_in_id && <label className="block"><input type="checkbox" required name="trade" /> I verified physical custody of trade-in #{sale.trade_in_id}.</label>}
        <button className="underline" disabled={busy}>Verify payment received</button>
      </form></details>}
    {awaiting && !sale.refund_requested && canWrite && <details><summary>Pickup arrangements</summary>
      {sale.pickup_deadline && <p>Collect by {new Date(sale.pickup_deadline).toLocaleString()}</p>}
      <form className="space-y-2" onSubmit={e => submit(e, "deadline")}>
        <label className="block">Collect by (local time)<input className="input" name="deadline" required type="datetime-local" /></label>
        <button className="underline" disabled={busy}>Save pickup deadline</button>
      </form>
      {sale.payment_verified && <form className="mt-3 space-y-2" onSubmit={e => submit(e, "handover")}>
        {Number(sale.excess_at_pickup) > 0 && <label className="block">Receipt for separate payment of {formatCurrency(sale.excess_at_pickup)} to the customer<input className="input" name="settlement" maxLength={100} required /></label>}
        <label className="block">VIN on unit #{sale.unit_id}<input className="input uppercase" name="vin" required maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title="17 characters excluding I, O and Q" /></label>
        <button className="underline" disabled={busy}>Verify VIN and confirm pickup</button>
      </form>}</details>}
    {awaiting && sale.refund_requested && <p>Cancellation awaiting manager approval.</p>}
    {awaiting && sale.refund_requested && user.role === "manager" && <form onSubmit={e => submit(e, "refund")}>
      {sale.trade_in_id && <label className="block"><input type="checkbox" name="trade" required /> I agree to the settlement and confirm return of trade-in #{sale.trade_in_id} to its owner.</label>}
      <button className="underline" disabled={busy}>Approve 20% refund and release car</button>
    </form>}
    {hasModuleAccess(user, "enquiries", !sale.enquiry_id) && (sale.enquiry_id || canWrite) &&
      <button disabled={busy} className="text-accent-blue" onClick={e => submit(e, "message")}>Purchase messages</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export default function SalesPage() {
  const [params] = useSearchParams();
  const receipt = params.get("receipt");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: sales = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["sales", user?.user_id, statusFilter, page, receipt],
    queryFn: () => receipt ? salesApi.get(receipt).then(s => [s]) :
      salesApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE + 1,
        status: statusFilter || undefined,
      }),
  });

  const totalPages = page + (sales.length > PAGE_SIZE ? 1 : 0);

  return (

      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Sales</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Vehicle sales records
            </p>
          </div>
          <button
            onClick={() => navigate("/sales/new")}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        </div>

        {receipt && <Link to="/sales" className="text-accent-blue">View all sales</Link>}
        {!receipt && <div className="relative w-52">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <select aria-label="Filter sales by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent-blue appearance-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || "All Statuses"}
              </option>
            ))}
          </select>
        </div>}

        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p role="alert">Sales could not load. <button onClick={() => refetch()}>Retry</button></p>
        ) : sales.length === 0 ? (
          <EmptyState
            title="No sales found"
            message="Record your first sale to get started."
          />
        ) : (
          <DataTable
            columns={[...COLUMNS, { key: "pickup", label: "Pickup", render: (_, sale) =>
              <PickupCell sale={sale} user={user} refresh={refetch} /> }]}
            data={sales.slice(0, PAGE_SIZE).map((s) => ({ ...s, id: s.sale_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

  );
}
