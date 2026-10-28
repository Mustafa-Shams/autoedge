import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter } from "lucide-react";
import { salesApi } from "../../api/salesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatCurrency, formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["", "Pending", "Completed", "Cancelled"];

const COLUMNS = [
  { key: "vehicle_id", label: "Vehicle ID" },
  { key: "customer_id", label: "Customer ID" },
  { key: "sale_price", label: "Price", render: (v) => formatCurrency(v) },
  { key: "payment_type", label: "Payment" },
  { key: "sale_date", label: "Date", render: (v) => formatDate(v) },
  { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
];

export default function SalesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", statusFilter, page],
    queryFn: () =>
      salesApi.list({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, status: statusFilter || undefined }),
  });

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Sales</h2>
            <p className="text-sm text-text-secondary mt-0.5">Vehicle sales records</p>
          </div>
          <button
            onClick={() => navigate("/sales/new")}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        </div>

        <div className="relative w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent-blue appearance-none">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
          </select>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : sales.length === 0 ? (
          <EmptyState title="No sales found" message="Record your first sale to get started." />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={sales.map((s) => ({ ...s, id: s.sale_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </PageWrapper>
  );
}

