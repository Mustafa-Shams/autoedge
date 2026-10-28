import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { serviceApi } from "../../api/serviceApi";
import { vehiclesApi } from "../../api/vehiclesApi";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Cancelled"];

export default function ServiceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["service-job", id],
    queryFn: () => serviceApi.get(id),
    enabled: isEdit,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: () => vehiclesApi.list({ limit: 200 }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: () => customersApi.list({ limit: 200 }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { status: "Pending" },
  });

  useEffect(() => {
    if (existing) reset({
      ...existing,
      job_date: existing.job_date?.slice(0, 10),
    });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? serviceApi.update(id, data)
        : serviceApi.create({
            ...data,
            vehicle_id: parseInt(data.vehicle_id),
            customer_id: parseInt(data.customer_id),
            estimated_cost: data.estimated_cost ? parseFloat(data.estimated_cost) : null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries(["service-jobs"]);
      navigate("/service");
    },
  });

  if (isEdit && loadingExisting) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/service")} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Update Service Job" : "Create Service Job"}
          </h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEdit && (
              <>
                <Field label="Vehicle" error={errors.vehicle_id?.message}>
                  <select {...register("vehicle_id", { required: "Vehicle is required" })} className="input">
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.year} {v.make} {v.model}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Customer" error={errors.customer_id?.message}>
                  <select {...register("customer_id", { required: "Customer is required" })} className="input">
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Job Type" error={errors.job_type?.message}>
              <input {...register("job_type", { required: "Job type is required" })} placeholder="Oil Change, Brake Service..." className="input" />
            </Field>
            <Field label="Job Date">
              <input type="date" {...register("job_date")} className="input" />
            </Field>
            <Field label="Status">
              <select {...register("status")} className="input">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Estimated Cost (USD)">
              <input type="number" step="0.01" {...register("estimated_cost")} placeholder="500.00" className="input" />
            </Field>
            {isEdit && (
              <Field label="Final Cost (USD)">
                <input type="number" step="0.01" {...register("final_cost")} placeholder="480.00" className="input" />
              </Field>
            )}
          </div>
          <Field label="Description">
            <textarea {...register("description")} rows={3} className="input resize-none" placeholder="Describe the service work..." />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">{mutation.error?.response?.data?.detail ?? "An error occurred."}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate("/service")} className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60">
              {isSubmitting || mutation.isPending ? "Saving..." : isEdit ? "Update Job" : "Create Job"}
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

