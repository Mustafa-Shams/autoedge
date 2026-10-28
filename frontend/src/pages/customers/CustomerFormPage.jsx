import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? customersApi.update(id, data) : customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["customers"]);
      navigate("/customers");
    },
  });

  if (isEdit && isLoading) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/customers")} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Edit Customer" : "Add Customer"}
          </h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.full_name?.message}>
              <input {...register("full_name", { required: "Name is required" })} placeholder="Ali Hassan" className="input" />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register("phone", { required: "Phone is required" })} placeholder="+1-555-0101" className="input" />
            </Field>
            <Field label="Email">
              <input type="email" {...register("email")} placeholder="ali@email.com" className="input" />
            </Field>
            <Field label="ID Type">
              <input {...register("id_type")} placeholder="Passport" className="input" />
            </Field>
            <Field label="ID Number">
              <input {...register("id_number")} placeholder="AB123456" className="input" />
            </Field>
          </div>
          <Field label="Address">
            <input {...register("address")} placeholder="123 Main St" className="input" />
          </Field>
          <Field label="Notes">
            <textarea {...register("notes")} rows={3} className="input resize-none" placeholder="Additional notes..." />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">{mutation.error?.response?.data?.detail ?? "An error occurred."}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate("/customers")} className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60">
              {isSubmitting || mutation.isPending ? "Saving..." : isEdit ? "Update Customer" : "Add Customer"}
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

