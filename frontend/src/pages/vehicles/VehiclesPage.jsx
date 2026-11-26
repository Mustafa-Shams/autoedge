import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { vehiclesApi } from "../../api/vehiclesApi";
import { useDebounce } from "../../hooks/useDebounce";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { hasModuleAccess } from "../../utils/staffAccess";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../utils/formatters";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const STATUS_OPTIONS = ["", "Available", "Reserved", "Sold"];

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState({ key: "vehicle_id", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search so we don't fire on every keystroke
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", debouncedSearch, statusFilter, page, pageSize, sort],
    queryFn: () =>
      vehiclesApi.list({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        status: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
        sort: sort.key,
        direction: sort.direction,
      }),
  });

  const vehicles = data?.items ?? (Array.isArray(data) ? data : []);
  const totalVehicles = data?.total ?? vehicles.length;
  const totalPages = Math.max(1, Math.ceil(totalVehicles / pageSize));

  const canEdit = hasModuleAccess(user, "vehicles", true);
  const canAdd = canEdit;

  // Range display
  const rangeStart = totalVehicles === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalVehicles);

  // Published toggle mutation
  const togglePublishMutation = useMutation({
    mutationFn: ({ vehicleId, is_published }) =>
      vehiclesApi.update(vehicleId, { is_published }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  function handleTogglePublish(e, vehicle) {
    e.stopPropagation(); // Don't navigate to detail
    togglePublishMutation.mutate({
      vehicleId: vehicle.vehicle_id,
      is_published: !vehicle.is_published,
    });
  }

  // Page numbers to display (window of up to 5 centered on current)
  function getPageNumbers() {
    const pages = [];
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // Build columns with Stock and Published
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
      key: "stock_quantity",
      label: "Stock",
      width: 70,
      render: (val) => (
        <span
          className={`text-sm font-semibold ${
            val === 0
              ? "text-status-cancelled"
              : val <= 3
              ? "text-yellow-400"
              : "text-status-available"
          }`}
        >
          {val}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (val, vehicle) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={val} />
          {vehicle.active_reservation_count > 0 && (
            <span className="rounded bg-status-reserved/15 px-2 py-0.5 text-xs text-status-reserved">
              Reserved: {vehicle.active_reservation_count}
            </span>
          )}
        </div>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "is_published",
            label: "Published",
            width: 90,
            render: (val, row) => (
              <button
                onClick={(e) => handleTogglePublish(e, row)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  val
                    ? "bg-status-available/15 text-status-available hover:bg-status-available/25"
                    : "bg-bg-elevated text-text-muted hover:bg-bg-border"
                }`}
                title={val ? "Click to unpublish" : "Click to publish"}
              >
                {val ? (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Live
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hidden
                  </>
                )}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (

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
              className="flex items-center gap-2 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search make, model, year, color or VIN"
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
          <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-muted"
                        style={col.width ? { width: col.width } : {}}
                      >
                        <button type="button" onClick={() => {
                          setSort({ key: col.key, direction: sort.key === col.key && sort.direction === "asc" ? "desc" : "asc" });
                          setPage(1);
                        }}>
                          {col.label} {sort.key === col.key && (sort.direction === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((row, i) => (
                    <tr
                      key={row.vehicle_id ?? i}
                      onClick={() => navigate(`/vehicles/${row.vehicle_id}`)}
                      className={`border-b border-bg-border last:border-0 transition-colors ${
                        i % 2 === 0 ? "bg-bg-card" : "bg-bg-elevated/30"
                      } cursor-pointer hover:bg-bg-elevated`}
                    >
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-text-primary">
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-bg-border">
              {/* Showing info */}
              <div className="flex items-center gap-4">
                <span className="text-xs text-text-muted">
                  Showing {rangeStart}–{rangeEnd} of {totalVehicles} vehicles
                </span>
                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-muted" htmlFor="page-size">
                    Per page:
                  </label>
                  <select
                    id="page-size"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-bg-elevated border border-bg-border text-text-primary rounded-md px-2 py-1 text-xs focus:outline-none focus:border-accent-blue appearance-none cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Page controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-bg-border text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {getPageNumbers().map((pn) => (
                    <button
                      key={pn}
                      onClick={() => setPage(pn)}
                      className={`min-w-[2rem] h-8 rounded-lg text-xs font-medium transition-colors ${
                        pn === page
                          ? "bg-accent-blue-strong text-white"
                          : "border border-bg-border text-text-secondary hover:bg-bg-elevated"
                      }`}
                    >
                      {pn}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-bg-border text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

  );
}
