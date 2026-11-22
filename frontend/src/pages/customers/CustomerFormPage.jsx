import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { customersApi } from "../../api/customersApi";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { apiError } from "../../utils/apiError";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import BackButton from "../../components/common/BackButton";

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const { data: existing, isLoading, isError } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm({ shouldUnregister: true });

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? customersApi.update(id, { ...data, email: data.email || null }) : customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (action) => action === "delete" ? customersApi.remove(id) : customersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      navigate("/customers");
    },
  });
  const passwordName = isEdit ? "new_password" : "password";

  if (isEdit && isLoading) return <LoadingSpinner />;

  if (isEdit && isError) {
    return <><BackButton fallback="/customers" /><p role="alert">Could not load this customer.</p></>;
  }

  return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/customers" label="Back" />
          <h1 className="text-2xl font-bold text-text-primary">
            {isEdit ? "Edit Customer" : "Add Customer"}
          </h1>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.full_name?.message}>
              <input {...register("full_name", { required: "Name is required" })} placeholder="Ali Hassan" className="input" />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register("phone", { required: "Phone is required" })} placeholder="+1-555-0101" className="input" />
            </Field>
            <Field label="Email">
              <input type="email" {...register("email", { required: !isEdit && "Email is required" })} placeholder="ali@email.com" className="input" />
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

          {isEdit && (
            <button type="button" className="text-sm font-medium text-accent-blue"
              onClick={() => setShowPasswordFields(!showPasswordFields)}>
              {showPasswordFields ? "Cancel password change" : "Set / reset password"}
            </button>
          )}
          {(!isEdit || showPasswordFields) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isEdit ? "Set new password" : "Password"} error={errors[passwordName]?.message}>
                <input type="password" autoComplete="new-password" className="input"
                  {...register(passwordName, {
                    required: "Password is required",
                    validate: (password) =>
                      (password.length >= 8 && /[a-z]/i.test(password) && /[0-9]/.test(password))
                      || "Use at least eight characters, including a letter and a number.",
                  })} />
              </Field>
              <Field label="Confirm password" error={errors.confirm_password?.message}>
                <input type="password" autoComplete="new-password" className="input"
                  {...register("confirm_password", {
                    validate: (value) => value === getValues(passwordName) || "Passwords do not match.",
                  })} />
              </Field>
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">{apiError(mutation.error, "Could not save the customer.")}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate("/customers")} className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60">
              {isSubmitting || mutation.isPending ? "Saving..." : isEdit ? "Update Customer" : "Add Customer"}
            </button>
          </div>
        </form>
        {isEdit && role === "manager" && (
          <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
            <h2 className="font-semibold text-text-primary">Customer status</h2>
            <p className="text-sm text-text-secondary">{existing?.is_active ? "Active" : "Inactive"}</p>
            <div className="flex gap-3">
              {existing?.is_active && (
                <button type="button" disabled={removeMutation.isPending} className="text-sm text-status-pending"
                  onClick={() => setConfirmation("deactivate")}>Deactivate customer</button>
              )}
              <button type="button" disabled={removeMutation.isPending} className="text-sm text-status-cancelled"
                onClick={() => setConfirmation("delete")}>Delete customer</button>
            </div>
            {removeMutation.isError && <p role="alert" className="text-sm text-status-cancelled">
              {apiError(removeMutation.error, "Could not change customer status.")}
            </p>}
          </section>
        )}
        <ConfirmDialog
          isOpen={confirmation !== null}
          title={confirmation === "delete" ? "Delete this customer?" : "Deactivate this customer?"}
          message={confirmation === "delete"
            ? "This permanently removes a customer without transaction or service history."
            : "The customer will lose storefront access and their records will be kept."}
          confirmLabel={confirmation === "delete" ? "Delete" : "Deactivate"}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            removeMutation.mutate(confirmation);
            setConfirmation(null);
          }}
        />
      </div>

  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-status-cancelled mt-1">{error}</span>}
    </label>
  );
}

