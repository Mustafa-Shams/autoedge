import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;

const COLUMNS = [
  { key: "full_name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", render: (v) => v ?? "—" },
  { key: "address", label: "Address", render: (v) => v ?? "—" },
  { key: "created_at", label: "Added", render: (v) => formatDate(v) },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search, page],
    queryFn: () =>
      customersApi.list({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: search || undefined,
      }),
  });

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Customers</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage customer records
            </p>
          </div>
          <button
            onClick={() => navigate("/customers/new")}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg pl-9 pr-3 py-2 text-sm placeholder-text-muted focus:outline-none focus:border-accent-blue"
          />
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers found" message="Add your first customer to get started." />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={customers.map((c) => ({ ...c, id: c.customer_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/customers/${row.customer_id}/edit`)}
          />
        )}
      </div>
    </PageWrapper>
  );
}

