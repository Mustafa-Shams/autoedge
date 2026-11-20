import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { vehiclesApi } from "../../api/vehiclesApi";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const CONDITION_TYPES = ["New", "Used", "Certified"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const BODY_TYPES = ["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Convertible", "Wagon", "Van"];
const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"];
const STATUSES = ["Available", "Reserved", "Sold"];

export default function VehicleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Image URLs state (up to 8 extra images)
  const [imageUrls, setImageUrls] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const { data: existing, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => vehiclesApi.get(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (existing) {
      reset(existing);
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? vehiclesApi.update(id, data) : vehiclesApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(["vehicles"]);
      navigate(`/vehicles/${data.vehicle_id}`);
    },
  });

  function addImageUrl() {
    const url = newImageUrl.trim();
    if (url && imageUrls.length < 8) {
      setImageUrls([...imageUrls, url]);
      setNewImageUrl("");
    }
  }

  function removeImageUrl(index) {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  }

  async function onSubmit(data) {
    // Parse numeric fields
    const payload = {
      ...data,
      price: parseFloat(data.price),
      mileage_km: parseInt(data.mileage_km) || 0,
      stock_quantity: parseInt(data.stock_quantity) || 1,
      horsepower: data.horsepower ? parseInt(data.horsepower) : null,
      seats: data.seats ? parseInt(data.seats) : null,
      year: parseInt(data.year),
      is_published: data.is_published === true || data.is_published === "true",
    };

    // Clean up empty strings → null for optional fields
    for (const key of ["description", "main_image_url", "engine", "drivetrain", "vin_number", "notes", "color"]) {
      if (payload[key] === "") payload[key] = null;
    }

    const result = await mutation.mutateAsync(payload);

    // If creating/editing and we have image URLs to add, add them one by one
    if (imageUrls.length > 0 && result.vehicle_id) {
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          await vehiclesApi.addImage(result.vehicle_id, {
            image_url: imageUrls[i],
            sort_order: i + 1,
          });
        } catch {
          // Don't fail the whole form if one image fails
        }
      }
    }
  }

  if (isEdit && isLoading) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-3xl space-y-5">
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
          onSubmit={handleSubmit(onSubmit)}
          className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-6"
        >
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <select {...register("body_type")} className="input">
                  <option value="">Select...</option>
                  {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
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
          </div>

          {/* Storefront Fields (P46) */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Storefront Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Stock Quantity">
                <input
                  type="number"
                  {...register("stock_quantity", { valueAsNumber: true, min: 0 })}
                  placeholder="1"
                  className="input"
                />
              </Field>
              <Field label="Engine">
                <input {...register("engine")} placeholder="2.5L 4-Cylinder" className="input" />
              </Field>
              <Field label="Horsepower">
                <input type="number" {...register("horsepower", { valueAsNumber: true })} placeholder="203" className="input" />
              </Field>
              <Field label="Seats">
                <input type="number" {...register("seats", { valueAsNumber: true })} placeholder="5" className="input" />
              </Field>
              <Field label="Drivetrain">
                <select {...register("drivetrain")} className="input">
                  <option value="">Select...</option>
                  {DRIVETRAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Published on Storefront">
                <select {...register("is_published")} className="input">
                  <option value={true}>Yes — Visible</option>
                  <option value={false}>No — Hidden</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Description */}
          <div>
            <Field label="Description">
              <textarea
                {...register("description")}
                rows={3}
                placeholder="Detailed vehicle description for the storefront..."
                className="input resize-none"
              />
            </Field>
          </div>

          {/* Image URLs */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Images
            </h3>

            <Field label="Main Image URL">
              <input {...register("main_image_url")} placeholder="https://..." className="input" />
            </Field>

            <div className="mt-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                Additional Image URLs (up to 8)
              </label>
              <div className="space-y-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
                      <ImageIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                      <span className="text-sm text-text-secondary truncate">{url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImageUrl(i)}
                      className="p-2 text-text-muted hover:text-status-cancelled transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {imageUrls.length < 8 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Paste image URL here..."
                      className="flex-1 input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      disabled={!newImageUrl.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-bg-border text-text-secondary hover:bg-bg-border disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1">
                {imageUrls.length}/8 additional images
              </p>
            </div>
          </div>

          {/* Notes */}
          <Field label="Notes (staff only)">
            <textarea {...register("notes")} rows={2} placeholder="Internal notes..." className="input resize-none" />
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
