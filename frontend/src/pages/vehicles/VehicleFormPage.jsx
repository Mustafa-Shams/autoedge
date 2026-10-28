import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { vehiclesApi } from "../../api/vehiclesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const CONDITION_TYPES = ["New", "Used", "Certified"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const STATUSES = ["Available", "Reserved", "Sold"];

export default function VehicleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => vehiclesApi.get(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? vehiclesApi.update(id, data) : vehiclesApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(["vehicles"]);
      navigate(`/vehicles/${data.vehicle_id}`);
    },
  });

  if (isEdit && isLoading) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(isEdit ? `/vehicles/${id}` : "/vehicles")}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Edit Vehicle" : "Add New Vehicle"}
          </h2>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit((data) => mutation.mutateAsync(data))}
          className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make" error={errors.make?.message}>
              <input {...register("make", { required: "Make is required" })} placeholder="Toyota" className="input" />
            </Field>
            <Field label="Model" error={errors.model?.message}>
              <input {...register("model", { required: "Model is required" })} placeholder="Camry" className="input" />
            </Field>
            <Field label="Year" error={errors.year?.message}>
              <input type="number" {...register("year", { required: true, min: 1900, max: 2100, valueAsNumber: true })} placeholder="2023" className="input" />
            </Field>
            <Field label="Color">
              <input {...register("color")} placeholder="Silver" className="input" />
            </Field>
            <Field label="Fuel Type">
              <select {...register("fuel_type")} className="input">
                <option value="">Select...</option>
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Transmission">
              <select {...register("transmission")} className="input">
                <option value="">Select...</option>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Body Type">
              <input {...register("body_type")} placeholder="Sedan" className="input" />
            </Field>
            <Field label="Condition">
              <select {...register("condition_type")} className="input">
                {CONDITION_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Mileage (km)">
              <input type="number" {...register("mileage_km", { valueAsNumber: true })} placeholder="0" className="input" />
            </Field>
            <Field label="VIN Number">
              <input {...register("vin_number")} placeholder="1HGBH41JXMN109186" className="input" />
            </Field>
            <Field label="Price (USD)" error={errors.price?.message}>
              <input type="number" step="0.01" {...register("price", { required: "Price is required", valueAsNumber: true })} placeholder="28500.00" className="input" />
            </Field>
            {isEdit && (
              <Field label="Status">
                <select {...register("status")} className="input">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Notes">
            <textarea {...register("notes")} rows={3} placeholder="Additional details..." className="input resize-none" />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">
              {mutation.error?.response?.data?.detail ?? "An error occurred."}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/vehicles/${id}` : "/vehicles")}
              className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60"
            >
              {isSubmitting || mutation.isPending
                ? "Saving..."
                : isEdit
                ? "Update Vehicle"
                : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-status-cancelled mt-1">{error}</p>}
    </div>
  );
}

