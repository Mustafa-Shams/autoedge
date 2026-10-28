import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { testDrivesApi } from "../../api/testDrivesApi";
import { vehiclesApi } from "../../api/vehiclesApi";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const STATUS_OPTIONS = ["Scheduled", "Completed", "Cancelled", "No-Show"];
const LEAD_OPTIONS = ["New", "Interested", "Hot", "Converted", "Lost"];

export default function TestDriveFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["test-drive", id],
    queryFn: () => testDrivesApi.get(id),
    enabled: isEdit,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-available"],
    queryFn: () => vehiclesApi.available(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: () => customersApi.list({ limit: 200 }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { status: "Scheduled", lead_status: "New" },
  });

  useEffect(() => {
    if (existing) reset({ ...existing, scheduled_date: existing.scheduled_date?.slice(0, 10) });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? testDrivesApi.update(id, data) : testDrivesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["test-drives"]);
      navigate("/test-drives");
    },
  });

  if (isEdit && loadingExisting) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/test-drives")} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Update Test Drive" : "Book Test Drive"}
          </h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync({
          ...d,
          customer_id: parseInt(d.customer_id),
          vehicle_id: parseInt(d.vehicle_id),
          assigned_to: d.assigned_to ? parseInt(d.assigned_to) : null,
        }))} className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer" error={errors.customer_id?.message}>
              <select {...register("customer_id", { required: "Customer is required" })} className="input">
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.full_name} — {c.phone}</option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle" error={errors.vehicle_id?.message}>
              <select {...register("vehicle_id", { required: "Vehicle is required" })} className="input">
                <option value="">Select vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>{v.year} {v.make} {v.model} — {v.status}</option>
                ))}
              </select>
            </Field>
            <Field label="Scheduled Date" error={errors.scheduled_date?.message}>
              <input type="date" {...register("scheduled_date", { required: "Date is required" })} className="input" />
            </Field>
            <Field label="Status">
              <select {...register("status")} className="input">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Lead Status">
              <select {...register("lead_status")} className="input">
                {LEAD_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea {...register("notes")} rows={3} className="input resize-none" placeholder="Additional notes..." />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">{mutation.error?.response?.data?.detail ?? "An error occurred."}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate("/test-drives")} className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60">
              {isSubmitting || mutation.isPending ? "Saving..." : isEdit ? "Update" : "Book Test Drive"}
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
      <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-status-cancelled mt-1">{error}</p>}
    </div>
  );
}

