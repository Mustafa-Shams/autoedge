import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter } from "lucide-react";
import { testDrivesApi } from "../../api/testDrivesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["", "Scheduled", "Completed", "Cancelled", "No-Show"];
const LEAD_OPTIONS = ["", "New", "Interested", "Hot", "Converted", "Lost"];

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
    key: "assigned_staff_name",
    label: "Assigned To",
    render: (v) => v ?? <span className="text-text-muted italic">Unassigned</span>,
  },
  { key: "scheduled_date", label: "Date", render: (v) => formatDate(v) },
  { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
  { key: "lead_status", label: "Lead", render: (v) => <StatusBadge status={v} /> },
];

export default function TestDrivesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: testDrives = [], isLoading } = useQuery({
    queryKey: ["test-drives", statusFilter, leadFilter, page],
    queryFn: () =>
      testDrivesApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        lead_status: leadFilter || undefined,
      }),
  });

  const totalPages = Math.max(1, Math.ceil(testDrives.length / PAGE_SIZE));

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Test Drives
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage test drive bookings and leads
            </p>
          </div>
          <button
            onClick={() => navigate("/test-drives/new")}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Book Test Drive
          </button>
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
              navigate(`/test-drives/${row.test_drive_id}/edit`)
            }
          />
        )}
      </div>
    </PageWrapper>
  );
}
