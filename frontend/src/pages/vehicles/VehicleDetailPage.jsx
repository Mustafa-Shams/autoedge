import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { vehiclesApi } from "../../api/vehiclesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate } from "../../utils/formatters";

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => vehiclesApi.get(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => vehiclesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      navigate("/vehicles");
    },
  });

  if (isLoading) return <PageWrapper><LoadingSpinner /></PageWrapper>;
  if (!vehicle) return <PageWrapper><p className="text-text-muted">Vehicle not found.</p></PageWrapper>;

  const canEdit = ["manager", "sales_executive"].includes(role);
  const canDelete = role === "manager";

  const fields = [
    { label: "Make", value: vehicle.make },
    { label: "Model", value: vehicle.model },
    { label: "Year", value: vehicle.year },
    { label: "Color", value: vehicle.color ?? "—" },
    { label: "Fuel Type", value: vehicle.fuel_type ?? "—" },
    { label: "Transmission", value: vehicle.transmission ?? "—" },
    { label: "Body Type", value: vehicle.body_type ?? "—" },
    { label: "Condition", value: vehicle.condition_type },
    { label: "Mileage", value: `${vehicle.mileage_km?.toLocaleString()} km` },
    { label: "VIN Number", value: vehicle.vin_number ?? "—" },
    { label: "Price", value: formatCurrency(vehicle.price) },
    { label: "Date Added", value: formatDate(vehicle.date_added) },
  ];

  return (
    <PageWrapper>
      <div className="space-y-5 max-w-3xl">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/vehicles")}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Vehicles
          </button>
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={() => navigate(`/vehicles/${id}/edit`)}
                className="flex items-center gap-2 border border-bg-border text-text-secondary hover:bg-bg-elevated rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 bg-status-cancelled/10 hover:bg-status-cancelled/20 text-status-cancelled border border-status-cancelled/20 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {vehicle.color ?? ""} · {vehicle.condition_type}
              </p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>
          <div className="text-3xl font-bold text-accent-blue">
            {formatCurrency(vehicle.price)}
          </div>
        </div>

        {/* Details Grid */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Vehicle Details
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-text-muted mb-0.5">
                  {label}
                </dt>
                <dd className="text-sm text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          {vehicle.notes && (
            <div className="mt-4 pt-4 border-t border-bg-border">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1">
                Notes
              </dt>
              <dd className="text-sm text-text-secondary">{vehicle.notes}</dd>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete the ${vehicle.year} ${vehicle.make} ${vehicle.model}? This action cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
        confirmLabel="Delete"
        danger
      />
    </PageWrapper>
  );
}

