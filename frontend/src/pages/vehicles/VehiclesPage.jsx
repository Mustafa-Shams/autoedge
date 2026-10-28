import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter } from "lucide-react";
import { vehiclesApi } from "../../api/vehiclesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../utils/formatters";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = ["", "Available", "Reserved", "Sold"];

const COLUMNS = [
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "year", label: "Year", width: 80 },
  { key: "color", label: "Color" },
  { key: "condition_type", label: "Condition" },
  {
    key: "price",
    label: "Price",
    render: (val) => formatCurrency(val),
  },
  {
    key: "status",
    label: "Status",
    render: (val) => <StatusBadge status={val} />,
  },
];

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", search, statusFilter, page],
    queryFn: () =>
      vehiclesApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        make: search || undefined,
      }),
  });

  const canAdd = ["manager", "sales_executive"].includes(role);
  const totalPages = Math.max(1, Math.ceil(vehicles.length / PAGE_SIZE));

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Vehicle Inventory
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage all vehicles in the showroom
            </p>
          </div>
          {canAdd && (
            <button
              onClick={() => navigate("/vehicles/new")}
              className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by make or model..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-3 py-2 text-sm placeholder-text-muted focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent-blue appearance-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "All Statuses"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingSpinner />
        ) : vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles found"
            message="Try adjusting your filters or add a new vehicle."
          />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={vehicles.map((v) => ({ ...v, id: v.vehicle_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/vehicles/${row.vehicle_id}`)}
          />
        )}
      </div>
    </PageWrapper>
  );
}

