import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { Bookmark, ArrowRightLeft, Info } from "lucide-react";
import { salesApi } from "../../api/salesApi";
import { vehiclesApi } from "../../api/vehiclesApi";
import { customersApi } from "../../api/customersApi";
import PageWrapper from "../../components/layout/PageWrapper";
import { useAuth } from "../../hooks/useAuth";
import BackButton from "../../components/common/BackButton";
import { formatCurrency } from "../../utils/formatters";

const PAYMENT_TYPES = ["Cash", "Finance", "Lease"];
const STATUS_OPTIONS = ["Pending", "Completed", "Cancelled"];

export default function SaleFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedReservation, setSelectedReservation] = useState(null);
  const [selectedTradeIn, setSelectedTradeIn] = useState(null);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "for-sale"],
    queryFn: () => vehiclesApi.list({ limit: 200 }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: () => customersApi.list({ limit: 200 }),
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      staff_id: user?.user_id,
      discount: 0,
      payment_type: "Cash",
      status: "Pending",
    },
  });

  const selectedCustomerId = watch("customer_id");
  const salePrice = parseFloat(watch("sale_price")) || 0;
  const discount = parseFloat(watch("discount")) || 0;

  // Fetch customer credits when customer is selected
  const { data: credits } = useQuery({
    queryKey: ["customer-credits", selectedCustomerId],
    queryFn: () => salesApi.getCustomerCredits(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  // Calculate balance due
  const depositCredit = selectedReservation
    ? parseFloat(selectedReservation.deposit_amount) || 0
    : 0;
  const tradeInCredit = selectedTradeIn
    ? parseFloat(selectedTradeIn.offered_value) || 0
    : 0;
  const balanceDue = Math.max(0, salePrice - discount - depositCredit - tradeInCredit);
  const commissionPreview = ((salePrice - discount) * 0.025).toFixed(2);

  // Auto-fill vehicle when selecting a reservation
  useEffect(() => {
    if (selectedReservation) {
      setValue("vehicle_id", String(selectedReservation.vehicle_id));
      // Try to auto-fill price from the vehicle
      const vehicle = vehicles.find(v => v.vehicle_id === selectedReservation.vehicle_id);
      if (vehicle && !salePrice) {
        setValue("sale_price", vehicle.price);
      }
    }
  }, [selectedReservation, vehicles, setValue, salePrice]);

  const mutation = useMutation({
    mutationFn: (data) => salesApi.create({
      ...data,
      vehicle_id: parseInt(data.vehicle_id),
      customer_id: parseInt(data.customer_id),
      staff_id: user?.user_id,
      sale_price: parseFloat(data.sale_price),
      discount: parseFloat(data.discount) || 0,
      reservation_id: selectedReservation?.reservation_id || null,
      trade_in_id: selectedTradeIn?.trade_in_id || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["sales"]);
      queryClient.invalidateQueries(["commissions"]);
      navigate("/sales");
    },
  });

  return (
    <PageWrapper>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <BackButton fallback="/sales" label="Back" />
          <h2 className="text-2xl font-bold text-text-primary">Record Sale</h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="space-y-6">
          {/* Main sale form */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
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
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.year} {v.make} {v.model} — {formatCurrency(v.price)}
                      {v.stock_quantity === 0 ? " (Out of Stock)" : ""}
                    </option>
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
          </div>

          {/* Customer Credits Panel (P46 — spec 11.5) */}
          {credits && (credits.active_reservations.length > 0 || credits.accepted_trade_ins.length > 0) && (
            <div className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-5">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide flex items-center gap-2">
                <Info className="w-4 h-4 text-accent-blue" />
                Customer Credits Available
              </h3>

              {/* Active Reservations */}
              {credits.active_reservations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5" /> Active Reservations
                  </h4>
                  <div className="space-y-2">
                    {credits.active_reservations.map((res) => (
                      <label
                        key={res.reservation_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedReservation?.reservation_id === res.reservation_id
                            ? "border-accent-blue bg-accent-blue/10"
                            : "border-bg-border bg-bg-elevated hover:border-bg-border/80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reservation"
                          checked={selectedReservation?.reservation_id === res.reservation_id}
                          onChange={() =>
                            setSelectedReservation(
                              selectedReservation?.reservation_id === res.reservation_id ? null : res
                            )
                          }
                          className="accent-accent-blue"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {res.vehicle_label}
                          </p>
                          <p className="text-xs text-text-muted">
                            Deposit: {formatCurrency(res.deposit_amount)} · {res.hold_days}-day hold
                            {res.expires_at && ` · Expires: ${new Date(res.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-status-available">
                          −{formatCurrency(res.deposit_amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted Trade-Ins */}
              {credits.accepted_trade_ins.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Accepted Trade-Ins
                  </h4>
                  <div className="space-y-2">
                    {credits.accepted_trade_ins.map((ti) => (
                      <label
                        key={ti.trade_in_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTradeIn?.trade_in_id === ti.trade_in_id
                            ? "border-accent-blue bg-accent-blue/10"
                            : "border-bg-border bg-bg-elevated hover:border-bg-border/80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="tradeIn"
                          checked={selectedTradeIn?.trade_in_id === ti.trade_in_id}
                          onChange={() =>
                            setSelectedTradeIn(
                              selectedTradeIn?.trade_in_id === ti.trade_in_id ? null : ti
                            )
                          }
                          className="accent-accent-blue"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {ti.year} {ti.make} {ti.model}
                          </p>
                          <p className="text-xs text-text-muted">
                            Offered value: {formatCurrency(ti.offered_value)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-status-available">
                          −{formatCurrency(ti.offered_value)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Price Summary (P46 — balance due at showroom) */}
          {salePrice > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Price Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Sale Price</span>
                  <span className="text-text-primary font-medium">{formatCurrency(salePrice)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Discount</span>
                    <span className="text-status-available">−{formatCurrency(discount)}</span>
                  </div>
                )}
                {depositCredit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Reservation Deposit</span>
                    <span className="text-status-available">−{formatCurrency(depositCredit)}</span>
                  </div>
                )}
                {tradeInCredit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Trade-In Credit</span>
                    <span className="text-status-available">−{formatCurrency(tradeInCredit)}</span>
                  </div>
                )}
                <div className="border-t border-bg-border pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-text-primary">Balance Due at Showroom</span>
                  <span className="text-lg font-bold text-text-primary">{formatCurrency(balanceDue)}</span>
                </div>
              </div>

              {/* Commission Preview */}
              <div className="mt-3 bg-status-available/10 border border-status-available/20 rounded-lg px-4 py-3">
                <p className="text-xs text-text-muted mb-1">Commission Preview (2.5%)</p>
                <p className="text-lg font-bold text-status-available">${commissionPreview}</p>
                <p className="text-xs text-text-muted">Applied when sale status is Completed</p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6">
            <Field label="Notes">
              <textarea {...register("notes")} rows={3} className="input resize-none" placeholder="Additional notes..." />
            </Field>
          </div>

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
