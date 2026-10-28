import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter } from "lucide-react";
import { serviceApi } from "../../api/serviceApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatCurrency, formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["", "Pending", "In Progress", "Completed", "Cancelled"];

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
  { key: "job_type", label: "Job Type" },
  {
    key: "technician_name",
    label: "Technician",
    render: (v) =>
      v ?? <span className="text-text-muted italic">Unassigned</span>,
  },
  { key: "job_date", label: "Date", render: (v) => formatDate(v) },
  {
    key: "estimated_cost",
    label: "Est. Cost",
    render: (v) => (v ? formatCurrency(v) : "—"),
  },
  {
    key: "final_cost",
    label: "Final Cost",
    render: (v) => (v ? formatCurrency(v) : "—"),
  },
  { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
];

export default function ServicePage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["service-jobs", statusFilter, page],
    queryFn: () =>
      serviceApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
      }),
  });

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Service Jobs
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage vehicle service and maintenance
            </p>
          </div>
          <button
            onClick={() => navigate("/service/new")}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Service Job
          </button>
        </div>

        <div className="relative w-52">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <select
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
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No service jobs found"
            message="Create your first service job."
          />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={jobs.map((j) => ({ ...j, id: j.job_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/service/${row.job_id}/edit`)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
