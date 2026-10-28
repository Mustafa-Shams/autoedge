import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { salesApi } from "../../api/salesApi";
import { vehiclesApi } from "../../api/vehiclesApi";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../utils/formatters";

const PAYMENT_TYPES = ["Cash", "Finance", "Lease"];
const STATUS_OPTIONS = ["Pending", "Completed", "Cancelled"];

export default function SaleFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "for-sale"],
    queryFn: () => vehiclesApi.list({ status: "Available" }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: () => customersApi.list({ limit: 200 }),
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      staff_id: user?.user_id,
      discount: 0,
      payment_type: "Cash",
      status: "Pending",
    },
  });

  const salePrice = parseFloat(watch("sale_price")) || 0;
  const discount = parseFloat(watch("discount")) || 0;
  const commissionPreview = ((salePrice - discount) * 0.025).toFixed(2);

  const mutation = useMutation({
    mutationFn: (data) => salesApi.create({
      ...data,
      vehicle_id: parseInt(data.vehicle_id),
      customer_id: parseInt(data.customer_id),
      staff_id: user?.user_id,
      sale_price: parseFloat(data.sale_price),
      discount: parseFloat(data.discount) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["sales"]);
      queryClient.invalidateQueries(["commissions"]);
      navigate("/sales");
    },
  });

  return (
    <PageWrapper>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sales")} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">Record Sale</h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vehicle" error={errors.vehicle_id?.message}>
              <select {...register("vehicle_id", { required: "Vehicle is required" })} className="input">
                <option value="">Select vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>{v.year} {v.make} {v.model} — {formatCurrency(v.price)}</option>
                ))}
              </select>
            </Field>
            <Field label="Customer" error={errors.customer_id?.message}>
              <select {...register("customer_id", { required: "Customer is required" })} className="input">
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.full_name} — {c.phone}</option>
                ))}
              </select>
            </Field>
            <Field label="Sale Price (USD)" error={errors.sale_price?.message}>
              <input type="number" step="0.01" {...register("sale_price", { required: "Price is required" })} placeholder="28500.00" className="input" />
            </Field>
            <Field label="Discount (USD)">
              <input type="number" step="0.01" {...register("discount")} placeholder="0.00" className="input" />
            </Field>
            <Field label="Payment Type">
              <select {...register("payment_type")} className="input">
                {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select {...register("status")} className="input">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Commission Preview */}
          {salePrice > 0 && (
            <div className="bg-status-available/10 border border-status-available/20 rounded-lg px-4 py-3">
              <p className="text-xs text-text-muted mb-1">Commission Preview (2.5%)</p>
              <p className="text-lg font-bold text-status-available">${commissionPreview}</p>
              <p className="text-xs text-text-muted">Applied when sale status is Completed</p>
            </div>
          )}

          <Field label="Notes">
            <textarea {...register("notes")} rows={3} className="input resize-none" placeholder="Additional notes..." />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-status-cancelled">{mutation.error?.response?.data?.detail ?? "An error occurred."}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate("/sales")} className="px-4 py-2 rounded-lg text-sm border border-bg-border text-text-secondary hover:bg-bg-elevated">Cancel</button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white disabled:opacity-60">
              {isSubmitting || mutation.isPending ? "Saving..." : "Record Sale"}
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

