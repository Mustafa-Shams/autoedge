import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { serviceApi } from "../../api/serviceApi";
import { apiError } from "../../utils/apiError";
import BackButton from "../../components/common/BackButton";
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

  const { data: options, isLoading: loadingOptions, isError: optionsError } = useQuery({
    queryKey: ["service-form-options"],
    queryFn: serviceApi.formOptions,
  });
  const { vehicles = [], customers = [], technicians = [] } = options ?? {};

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { status: "Pending" },
  });

  useEffect(() => {
    if (existing)
      reset({
        ...existing,
        job_date: existing.job_date?.slice(0, 10),
      });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? serviceApi.update(id, {
            ...data,
            job_date: data.job_date || null,
            technician_id: data.technician_id
              ? parseInt(data.technician_id)
              : null,
            estimated_cost: data.estimated_cost
              ? parseFloat(data.estimated_cost)
              : null,
            final_cost: data.final_cost ? parseFloat(data.final_cost) : null,
          })
        : serviceApi.create({
            ...data,
            job_date: data.job_date || null,
            vehicle_id: parseInt(data.vehicle_id),
            customer_id: parseInt(data.customer_id),
            technician_id: data.technician_id
              ? parseInt(data.technician_id)
              : null,
            estimated_cost: data.estimated_cost
              ? parseFloat(data.estimated_cost)
              : null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-jobs"] });
      navigate("/service");
    },
  });

  if (isEdit && loadingExisting)
    return (

        <LoadingSpinner />

    );

  return (

      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/service" label="Back" />
          <h2 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Update Service Job" : "Create Service Job"}
          </h2>
        </div>

        {optionsError && <p role="alert" className="text-status-cancelled">Could not load service job options.</p>}
        {loadingOptions && <LoadingSpinner />}
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEdit && (
              <>
                <Field label="Vehicle" error={errors.vehicle_id?.message}>
                  <select
                    {...register("vehicle_id", {
                      required: "Vehicle is required",
                    })}
                    className="input"
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.year} {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Customer" error={errors.customer_id?.message}>
                  <select
                    {...register("customer_id", {
                      required: "Customer is required",
                    })}
                    className="input"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field label="Job Type" error={errors.job_type?.message}>
              <input
                {...register("job_type", { required: "Job type is required" })}
                placeholder="Oil Change, Brake Service..."
                className="input"
              />
            </Field>

            <Field label="Assign Technician">
              <select {...register("technician_id")} className="input">
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Job Date">
              <input
                type="date"
                {...register("job_date")}
                className="input"
              />
            </Field>

            <Field label="Status">
              <select {...register("status")} className="input">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estimated Cost (USD)">
              <input
                type="number"
                step="0.01"
                {...register("estimated_cost")}
                placeholder="500.00"
                className="input"
              />
            </Field>

            {isEdit && (
              <Field label="Final Cost (USD)">
                <input
                  type="number"
                  step="0.01"
                  {...register("final_cost")}
                  placeholder="480.00"
                  className="input"
                />
              </Field>
            )}
          </div>

          <Field label="Description">
            <textarea
              {...register("description")}
              rows={3}
              className="input resize-none"
              placeholder="Describe the service work..."
            />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">
              {apiError(mutation.error, "Could not save the service job.")}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => navigate("/service")}
              className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending || loadingOptions || optionsError}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60"
            >
              {isSubmitting || mutation.isPending
                ? "Saving..."
                : isEdit
                ? "Update Job"
                : "Create Job"}
            </button>
          </div>
        </form>
      </div>

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
