import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commissionsApi } from "../../api/commissionsApi";
import PageWrapper from "../../components/layout/PageWrapper";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;

export default function CommissionsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["commissions", page],
    queryFn: () =>
      commissionsApi.list({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }) => commissionsApi.update(id, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["commissions"] }),
  });

  const totalPages = Math.max(1, Math.ceil(commissions.length / PAGE_SIZE));

  const columns = [
    {
      key: "staff_name",
      label: "Staff",
      render: (v, row) => v ?? `Staff #${row.staff_id}`,
    },
    {
      key: "vehicle_info",
      label: "Vehicle",
      render: (v, row) => v ?? `Sale #${row.sale_id}`,
    },
    { key: "rate_percent", label: "Rate", render: (v) => `${v}%` },
    {
      key: "commission_amt",
      label: "Amount",
      render: (v) => formatCurrency(v),
    },
    { key: "created_at", label: "Date", render: (v) => formatDate(v) },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    ...(role === "manager"
      ? [
          {
            key: "actions",
            label: "Action",
            render: (_, row) => (
              <div className="flex gap-2">
                {row.status === "Pending" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveMutation.mutate({
                        id: row.commission_id,
                        status: "Approved",
                      });
                    }}
                    className="text-xs px-2 py-1 rounded bg-status-scheduled/20 text-status-scheduled hover:bg-status-scheduled/30"
                  >
                    Approve
                  </button>
                )}
                {row.status === "Approved" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveMutation.mutate({
                        id: row.commission_id,
                        status: "Paid",
                      });
                    }}
                    className="text-xs px-2 py-1 rounded bg-status-available/20 text-status-available hover:bg-status-available/30"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Commissions</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {role === "manager"
              ? "All staff commissions"
              : "Your commissions"}
          </p>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : commissions.length === 0 ? (
          <EmptyState
            title="No commissions yet"
            message="Commissions are auto-created when a completed sale is recorded."
          />
        ) : (
          <DataTable
            columns={columns}
            data={commissions.map((c) => ({ ...c, id: c.commission_id }))}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </PageWrapper>
  );
}
