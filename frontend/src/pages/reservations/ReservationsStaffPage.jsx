import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Car,
  User,
  DollarSign,
  Calendar,
  Eye,
  ArrowUpDown,
} from "lucide-react";
import reservationsApi from "../../api/reservationsApi";
import { useAuth } from "../../hooks/useAuth";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Expired", label: "Expired" },
];

const STATUS_CONFIG = {
  Active: {
    icon: Clock,
    bgClass: "bg-blue-900/30",
    textClass: "text-accent-blue",
    borderClass: "border-accent-blue/30",
  },
  Completed: {
    icon: CheckCircle,
    bgClass: "bg-green-900/30",
    textClass: "text-status-active",
    borderClass: "border-status-active/30",
  },
  Cancelled: {
    icon: XCircle,
    bgClass: "bg-red-900/30",
    textClass: "text-status-cancelled",
    borderClass: "border-status-cancelled/30",
  },
  Expired: {
    icon: AlertTriangle,
    bgClass: "bg-yellow-900/30",
    textClass: "text-status-pending",
    borderClass: "border-status-pending/30",
  },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Active;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function formatCurrency(val) {
  if (val == null) return "—";
  return `$${Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function ReservationsStaffPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Detail modal
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["staff-reservations", statusFilter, page, pageSize],
    queryFn: () =>
      reservationsApi.getAll({
        status_filter: statusFilter || undefined,
        page,
        page_size: pageSize,
      }),
    keepPreviousData: true,
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => reservationsApi.cancel(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(["staff-reservations"]);
      setCancelTarget(null);
      setSelectedReservation(null);
      // Show result message briefly
      alert(response.data.message || "Reservation cancelled successfully.");
    },
    onError: (err) => {
      alert(
        err.response?.data?.detail || "Failed to cancel reservation."
      );
    },
  });

  const reservations = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Client-side search filter (customer name, vehicle)
  const filtered = searchQuery
    ? reservations.filter((r) => {
        const q = searchQuery.toLowerCase();
        const customerName = (r.customer_name || "").toLowerCase();
        const vehicleLabel =
          `${r.vehicle_year || ""} ${r.vehicle_make || ""} ${r.vehicle_model || ""}`.toLowerCase();
        return customerName.includes(q) || vehicleLabel.includes(q);
      })
    : reservations;

  // Stats summary
  const activeCount = statusFilter === "Active" ? total : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-blue/10 rounded-lg">
            <Bookmark className="w-6 h-6 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Reservations
            </h1>
            <p className="text-sm text-text-muted">
              Manage customer vehicle reservations
            </p>
          </div>
        </div>
        <div className="text-sm text-text-muted">
          {total} total reservation{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer or vehicle..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-status-cancelled">
            <p>Failed to load reservations.</p>
            <p className="text-sm text-text-muted mt-1">
              {error?.response?.data?.detail || error?.message}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">No reservations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Deposit
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Reserved
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Expires
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {filtered.map((r) => {
                  const daysLeft = daysUntilExpiry(r.expires_at);
                  const vehicleLabel = [
                    r.vehicle_year,
                    r.vehicle_make,
                    r.vehicle_model,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr
                      key={r.reservation_id}
                      className="hover:bg-bg-elevated/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedReservation(r)}
                    >
                      <td className="px-4 py-3 text-text-secondary font-mono">
                        #{r.reservation_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-text-primary font-medium">
                          {r.customer_name || "Unknown"}
                        </div>
                        <div className="text-xs text-text-muted">
                          {r.customer_email || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-text-primary">
                          {vehicleLabel || "Unknown"}
                        </div>
                        {r.vehicle_price != null && (
                          <div className="text-xs text-text-muted">
                            {formatCurrency(r.vehicle_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {formatCurrency(r.deposit_amount)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(r.reserved_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-text-secondary">
                          {formatDate(r.expires_at)}
                        </div>
                        {r.status === "Active" && daysLeft != null && (
                          <div
                            className={`text-xs mt-0.5 ${
                              daysLeft <= 2
                                ? "text-status-cancelled font-medium"
                                : daysLeft <= 5
                                  ? "text-status-pending"
                                  : "text-text-muted"
                            }`}
                          >
                            {daysLeft <= 0
                              ? "Expiring today"
                              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReservation(r);
                            }}
                            className="p-1.5 text-text-muted hover:text-accent-blue hover:bg-bg-elevated rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {role === "manager" && r.status === "Active" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelTarget(r);
                              }}
                              className="p-1.5 text-text-muted hover:text-status-cancelled hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Cancel reservation"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-bg-border text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-secondary px-3">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-bg-border text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-bg-border">
              <div className="flex items-center gap-3">
                <Bookmark className="w-5 h-5 text-accent-blue" />
                <h2 className="text-lg font-bold text-text-primary">
                  Reservation #{selectedReservation.reservation_id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReservation(null)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedReservation.status} />
                {selectedReservation.status === "Active" && (
                  <span className="text-sm text-text-muted">
                    {(() => {
                      const d = daysUntilExpiry(selectedReservation.expires_at);
                      if (d === null) return "";
                      if (d <= 0) return "Expiring today!";
                      return `${d} day${d !== 1 ? "s" : ""} remaining`;
                    })()}
                  </span>
                )}
              </div>

              {/* Customer Info */}
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  Customer
                </div>
                <p className="text-text-primary font-medium">
                  {selectedReservation.customer_name || "Unknown"}
                </p>
                {selectedReservation.customer_email && (
                  <p className="text-sm text-text-secondary">
                    {selectedReservation.customer_email}
                  </p>
                )}
                {selectedReservation.customer_phone && (
                  <p className="text-sm text-text-secondary">
                    {selectedReservation.customer_phone}
                  </p>
                )}
              </div>

              {/* Vehicle Info */}
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider">
                  <Car className="w-3.5 h-3.5" />
                  Vehicle
                </div>
                <p className="text-text-primary font-medium">
                  {[
                    selectedReservation.vehicle_year,
                    selectedReservation.vehicle_make,
                    selectedReservation.vehicle_model,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Unknown"}
                </p>
                {selectedReservation.vehicle_price != null && (
                  <p className="text-sm text-status-active font-medium">
                    {formatCurrency(selectedReservation.vehicle_price)}
                  </p>
                )}
              </div>

              {/* Financial Info */}
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider">
                  <DollarSign className="w-3.5 h-3.5" />
                  Financial
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-text-muted">Deposit</p>
                    <p className="text-text-primary font-medium">
                      {formatCurrency(selectedReservation.deposit_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Hold Period</p>
                    <p className="text-text-primary font-medium">
                      {selectedReservation.hold_days} days
                    </p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  Timeline
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-text-muted">Reserved</p>
                    <p className="text-sm text-text-primary">
                      {formatDateTime(selectedReservation.reserved_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Expires</p>
                    <p className="text-sm text-text-primary">
                      {formatDateTime(selectedReservation.expires_at)}
                    </p>
                  </div>
                  {selectedReservation.closed_at && (
                    <div className="col-span-2">
                      <p className="text-xs text-text-muted">Closed</p>
                      <p className="text-sm text-text-primary">
                        {formatDateTime(selectedReservation.closed_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedReservation.notes && (
                <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
                    Notes
                  </p>
                  <p className="text-sm text-text-secondary">
                    {selectedReservation.notes}
                  </p>
                </div>
              )}

              {/* Cancel Button (manager only, Active only) */}
              {role === "manager" &&
                selectedReservation.status === "Active" && (
                  <button
                    onClick={() => setCancelTarget(selectedReservation)}
                    className="w-full py-2.5 bg-status-cancelled/10 text-status-cancelled border border-status-cancelled/30 rounded-lg text-sm font-medium hover:bg-status-cancelled/20 transition-colors"
                  >
                    Cancel Reservation & Refund
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/20 rounded-full">
                <AlertTriangle className="w-5 h-5 text-status-cancelled" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                Cancel Reservation?
              </h3>
            </div>

            <p className="text-sm text-text-secondary mb-2">
              Are you sure you want to cancel reservation{" "}
              <strong>#{cancelTarget.reservation_id}</strong> for{" "}
              <strong>{cancelTarget.customer_name}</strong>?
            </p>
            <p className="text-sm text-text-muted mb-5">
              A refund (minus cancellation fee) will be credited to the
              customer's bank account.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-elevated border border-bg-border transition-colors"
              >
                Keep Active
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelTarget.reservation_id)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-status-cancelled text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending
                  ? "Cancelling..."
                  : "Cancel & Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
