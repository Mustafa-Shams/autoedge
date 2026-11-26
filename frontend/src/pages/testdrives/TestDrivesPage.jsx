import ModalOverlay from '../../components/common/ModalOverlay';
import { useAuth } from "../../hooks/useAuth";
import { hasModuleAccess } from "../../utils/staffAccess";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Filter, Globe, Monitor, Check, X, Clock } from "lucide-react";
import { testDrivesApi } from "../../api/testDrivesApi";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["", "Requested", "Scheduled", "Completed", "Cancelled", "No-Show", "Expired"];
const LEAD_OPTIONS = ["", "New", "Interested", "Hot", "Converted", "Lost"];

function formatTime(timeStr) {
  if (!timeStr) return "—";
  // timeStr could be "09:00:00" or "09:00"
  const parts = timeStr.split(":");
  const hour = parseInt(parts[0]);
  const min = parts[1] || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min} ${ampm}`;
}

function timeUntilExpiry(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = exp - now;
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m left`;
}

export default function TestDrivesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasModuleAccess(user, "test_drives", true);
  const [params] = useSearchParams();
  const record = params.get("id");
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [page, setPage] = useState(1);
  const [declineId, setDeclineId] = useState(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data: testDrives = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["test-drives", record, statusFilter, leadFilter, page],
    queryFn: () => record ? testDrivesApi.get(record).then(row => [row]) :
      testDrivesApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        lead_status: leadFilter || undefined,
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id) => testDrivesApi.confirm(id, {}),
    onSuccess: () => queryClient.invalidateQueries(["test-drives"]),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }) => testDrivesApi.decline(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries(["test-drives"]);
      setDeclineId(null);
      setDeclineReason("");
    },
  });

  function handleDeclineSubmit(id) {
    if (declineReason.trim()) {
      declineMutation.mutate({ id, reason: declineReason.trim() });
    }
  }

  const totalPages = Math.max(1, Math.ceil(testDrives.length / PAGE_SIZE));

  const COLUMNS = [
    {
      key: "customer_name",
      label: "Customer",
      render: (v, row) => v ?? `Customer #${row.customer_id}`,
    },
    {
      key: "vehicle_info",
      label: "Vehicle",
      render: (v, row) => v ?? `Vehicle #${row.vehicle_id}`,
    },
    {
      key: "source",
      label: "Source",
      width: 90,
      render: (v) =>
        v === "Online" ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/15 text-accent-blue">
            <Globe className="w-3 h-3" /> Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-bg-elevated text-text-muted">
            <Monitor className="w-3 h-3" /> Staff
          </span>
        ),
    },
    {
      key: "assigned_staff_name",
      label: "Assigned To",
      render: (v) => v ?? <span className="text-text-muted italic">Unassigned</span>,
    },
    { key: "scheduled_date", label: "Date", render: (v) => formatDate(v) },
    {
      key: "scheduled_time",
      label: "Time",
      width: 90,
      render: (v) => <span className="text-text-secondary">{formatTime(v)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={v} />
          {v === "Requested" && row.expires_at && (
            <span className="text-xs text-yellow-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {timeUntilExpiry(row.expires_at)}
            </span>
          )}
        </div>
      ),
    },
    { key: "lead_status", label: "Lead", render: (v) => <StatusBadge status={v} /> },
    {
      key: "actions",
      label: "Actions",
      width: 180,
      render: (_, row) => {
        if (!canWrite || row.status !== "Requested") return null;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => confirmMutation.mutate(row.test_drive_id)}
              disabled={confirmMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-status-available/15 text-status-available hover:bg-status-available/25 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Confirm
            </button>
            <button
              onClick={() => setDeclineId(row.test_drive_id)}
              disabled={declineMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-status-cancelled/15 text-status-cancelled hover:bg-status-cancelled/25 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        );
      },
    },
  ];

  return (

      <div className="space-y-5">
        {isError && <p role="alert">Could not load this record. <button className="underline" onClick={() => refetch()}>Retry</button></p>}
        {record && <Link className="underline" to="/test-drives">View all records</Link>}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Test Drives
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage test drive bookings and online requests
            </p>
          </div>
          {canWrite && <button
            onClick={() => navigate("/test-drives/new")}
            className="flex items-center gap-2 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Book Test Drive
          </button>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent-blue appearance-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "All Statuses"}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <select
              value={leadFilter}
              onChange={(e) => {
                setLeadFilter(e.target.value);
                setPage(1);
              }}
              className="bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent-blue appearance-none"
            >
              {LEAD_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "All Leads"}
                </option>
              ))}
            </select>
          </div>

          {/* Quick filter: show pending requests count */}
          {testDrives.some((td) => td.status === "Requested") && !statusFilter && (
            <button
              onClick={() => setStatusFilter("Requested")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              {testDrives.filter((td) => td.status === "Requested").length} pending request(s)
            </button>
          )}
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : testDrives.length === 0 ? (
          <EmptyState
            title="No test drives found"
            message="Book a test drive to get started."
          />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={testDrives.map((t) => ({ ...t, id: t.test_drive_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onRowClick={(row) =>
              navigate(canWrite ? `/test-drives/${row.test_drive_id}/edit` : `/test-drives?id=${row.test_drive_id}`)
            }
          />
        )}

        {/* Decline reason modal */}
        {declineId && (
          <ModalOverlay onDismiss={() => setDeclineId(null)} aria-label="Decline test drive" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeclineId(null)}>
            <div
              className="bg-bg-card border border-bg-border rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-text-primary">Decline Test Drive</h3>
              <p className="text-sm text-text-secondary">
                Please provide a reason for declining this test drive request.
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                placeholder="Reason for declining..."
                className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm placeholder-text-muted focus:outline-none focus:border-accent-blue resize-none"
                autoFocus
              />
              {declineMutation.isError && (
                <p className="text-xs text-status-cancelled">
                  {declineMutation.error?.response?.data?.detail ?? "Failed to decline."}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setDeclineId(null); setDeclineReason(""); }}
                  className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeclineSubmit(declineId)}
                  disabled={!declineReason.trim() || declineMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-status-cancelled hover:bg-status-cancelled/80 text-white disabled:opacity-50"
                >
                  {declineMutation.isPending ? "Declining..." : "Decline"}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>

  );
}
