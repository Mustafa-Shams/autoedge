import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Star,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { vehiclesApi } from "../../api/vehiclesApi";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import BackButton from "../../components/common/BackButton";

const CONDITION_TYPES = ["New", "Used", "Certified"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const BODY_TYPES = ["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Convertible", "Wagon", "Van"];
const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"];

const MAX_ADDITIONAL = 8;

function isValidUrl(str) {
  return /^https?:\/\/.+/i.test(str?.trim());
}

export default function VehicleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Image state — {image_url, sort_order, credit?, source_url?}
  const [imageUrls, setImageUrls] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [imageSaveError, setImageSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const newUrlRef = useRef(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => vehiclesApi.get(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, getValues, formState: { errors } } = useForm();

  // Populate form + images when existing data loads
  useEffect(() => {
    if (existing) {
      reset(existing);
      // Load existing images from the backend (Decision #23 — VehicleResponse now includes images[])
      if (existing.images && existing.images.length > 0) {
        setImageUrls(
          existing.images
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((img) => ({
              image_url: img.image_url,
              sort_order: img.sort_order,
              credit: img.credit || null,
              source_url: img.source_url || null,
            }))
        );
      }
    }
  }, [existing, reset]);

  // Vehicle create/update mutation — NO onSuccess navigate (we handle it after images)
  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? vehiclesApi.update(id, data) : vehiclesApi.create(data),
  });

  // ── Image helpers ──────────────────────────────────────────────────

  function addImageUrl() {
    const url = newImageUrl.trim();
    setUrlError("");
    if (!url) return;
    if (!isValidUrl(url)) {
      setUrlError("URL must start with http:// or https://");
      return;
    }
    // Check for duplicates — also check against main_image_url
    const mainUrl = getValues("main_image_url")?.trim();
    const allUrls = imageUrls.map((img) => img.image_url);
    if (mainUrl && url === mainUrl) {
      setUrlError("This URL is already set as the main image");
      return;
    }
    if (allUrls.includes(url)) {
      setUrlError("Duplicate URL — this image is already added");
      return;
    }
    if (imageUrls.length >= MAX_ADDITIONAL) {
      setUrlError(`Maximum ${MAX_ADDITIONAL} additional images allowed`);
      return;
    }
    setImageUrls([...imageUrls, { image_url: url, sort_order: imageUrls.length + 1 }]);
    setNewImageUrl("");
  }

  function removeImageUrl(index) {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
    setDeleteConfirm(null);
  }

  function moveImage(index, direction) {
    const newList = [...imageUrls];
    const target = index + direction;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setImageUrls(newList);
  }

  function makeMain(index) {
    // Swap: selected additional becomes main, old main becomes first additional
    const currentMain = getValues("main_image_url")?.trim() || "";
    const selectedImg = imageUrls[index];
    // Set the new main via react-hook-form
    // We'll need to use setValue which we get from useForm
    // Actually, we can just manipulate the DOM input directly or use reset
    // Better: modify the form data in onSubmit. For now, update the displayed state:
    const newList = [...imageUrls];
    newList.splice(index, 1);
    // If old main exists, insert it at the beginning of additional images
    if (currentMain) {
      newList.unshift({ image_url: currentMain, sort_order: 0 });
    }
    setImageUrls(newList);
    // Update the main_image_url input
    const mainInput = document.querySelector('input[name="main_image_url"]');
    if (mainInput) {
      // React-hook-form synthetic event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      nativeInputValueSetter.call(mainInput, selectedImg.image_url);
      mainInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function startEdit(index) {
    setEditingIndex(index);
    setEditValue(imageUrls[index].image_url);
  }

  function confirmEdit(index) {
    const url = editValue.trim();
    if (!isValidUrl(url)) return;
    // Check duplicates
    const others = imageUrls.filter((_, i) => i !== index).map((img) => img.image_url);
    const mainUrl = getValues("main_image_url")?.trim();
    if (others.includes(url) || (mainUrl && url === mainUrl)) return;
    const newList = [...imageUrls];
    newList[index] = { ...newList[index], image_url: url };
    setImageUrls(newList);
    setEditingIndex(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue("");
  }

  // ── Submit ─────────────────────────────────────────────────────────

  async function onSubmit(data) {
    setSaving(true);
    setImageSaveError("");

    // Auto-add pending URL if the user typed one but didn't click Add
    let finalImages = [...imageUrls];
    const pendingUrl = newImageUrl.trim();
    if (pendingUrl) {
      if (!isValidUrl(pendingUrl)) {
        setUrlError("URL must start with http:// or https://");
        setSaving(false);
        return;
      }
      const allUrls = finalImages.map((img) => img.image_url);
      const mainUrl = data.main_image_url?.trim();
      if (!allUrls.includes(pendingUrl) && pendingUrl !== mainUrl && finalImages.length < MAX_ADDITIONAL) {
        finalImages.push({ image_url: pendingUrl, sort_order: finalImages.length + 1 });
        setNewImageUrl("");
      }
    }

    // Parse numeric fields
    const payload = {
      ...data,
      price: parseFloat(data.price),
      mileage_km: parseInt(data.mileage_km) || 0,
      stock_quantity: Number.isInteger(data.stock_quantity) ? data.stock_quantity : 1,
      horsepower: data.horsepower ? parseInt(data.horsepower) : null,
      seats: data.seats ? parseInt(data.seats) : null,
      year: parseInt(data.year),
      is_published: data.is_published === true || data.is_published === "true",
    };

    // Clean up empty strings → null for optional fields
    for (const key of ["description", "main_image_url", "engine", "drivetrain", "vin_number", "notes", "color"]) {
      if (payload[key] === "") payload[key] = null;
    }

    // Don't send main_image_url in the vehicle payload — it will be set via bulk images
    // Actually, keep it so the vehicle row is correct even without the bulk call
    // But we'll also set it in the bulk call.

    try {
      const result = await mutation.mutateAsync(payload);
      const vehicleId = result.vehicle_id;

      // Atomic image save via bulk endpoint (Decision #23)
      await vehiclesApi.replaceImages(vehicleId, {
        main_image_url: payload.main_image_url || null,
        images: finalImages.map((img, i) => ({
          image_url: img.image_url,
          sort_order: i + 1,
          credit: img.credit || null,
          source_url: img.source_url || null,
        })),
      });

      // Invalidate queries and navigate
      queryClient.invalidateQueries(["vehicles"]);
      queryClient.invalidateQueries(["vehicle", String(vehicleId)]);
      navigate(`/vehicles/${vehicleId}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        // Show specific validation errors from the bulk endpoint
        if (Array.isArray(detail)) {
          setImageSaveError(detail.map((d) => d.msg || d.message || JSON.stringify(d)).join("; "));
        } else if (typeof detail === "string") {
          setImageSaveError(detail);
        } else {
          setImageSaveError(JSON.stringify(detail));
        }
      } else {
        setImageSaveError(err.message || "An error occurred while saving.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && isLoading) return <LoadingSpinner />;

  return (

      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackButton fallback={isEdit ? `/vehicles/${id}` : "/vehicles"} label="Back" />
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
                  <input readOnly value={existing?.status ?? ""} className="input" />
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

          {/* ── Images Section (Decision #23) ────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Images
            </h3>

            {/* Main image URL with thumbnail */}
            <Field label="Main Image URL (cover photo)">
              <input {...register("main_image_url")} placeholder="https://..." className="input" />
            </Field>
            {/* Main image preview */}
            <MainImagePreview getValues={getValues} />

            {/* Additional images */}
            <div className="mt-5">
              <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
                Additional Image URLs ({imageUrls.length}/{MAX_ADDITIONAL})
              </label>

              {/* Image list */}
              <div className="space-y-2">
                {imageUrls.map((img, i) => (
                  <div
                    key={`img-${i}`}
                    className="flex items-center gap-2 group"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-9 rounded-md overflow-hidden bg-bg-elevated border border-bg-border flex-shrink-0">
                      <img
                        src={img.image_url}
                        alt={`Additional ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>

                    {/* URL display / edit */}
                    <div className="flex-1 min-w-0">
                      {editingIndex === i ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 input text-xs py-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); confirmEdit(i); }
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <button type="button" onClick={() => confirmEdit(i)} className="p-1 text-status-available hover:text-status-available/80">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={cancelEdit} className="p-1 text-text-muted hover:text-text-secondary">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-lg px-3 py-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                          <span className="text-xs text-text-secondary truncate">{img.image_url}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {editingIndex !== i && (
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        {/* Make main */}
                        <button
                          type="button"
                          onClick={() => makeMain(i)}
                          className="p-1.5 text-text-muted hover:text-amber-400 transition-colors"
                          title="Make this the main image"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          className="p-1.5 text-text-muted hover:text-accent-blue transition-colors"
                          title="Edit URL"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Move up */}
                        <button
                          type="button"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        {/* Move down */}
                        <button
                          type="button"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === imageUrls.length - 1}
                          className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        {deleteConfirm === i ? (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-[10px] text-status-cancelled">Delete?</span>
                            <button type="button" onClick={() => removeImageUrl(i)} className="p-1 text-status-cancelled hover:text-status-cancelled/80">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => setDeleteConfirm(null)} className="p-1 text-text-muted hover:text-text-secondary">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(i)}
                            className="p-1.5 text-text-muted hover:text-status-cancelled transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new URL */}
                {imageUrls.length < MAX_ADDITIONAL && (
                  <div className="flex gap-2 mt-2">
                    <input
                      ref={newUrlRef}
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => { setNewImageUrl(e.target.value); setUrlError(""); }}
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

              {/* URL validation error */}
              {urlError && (
                <p className="text-xs text-status-cancelled mt-1">{urlError}</p>
              )}

              {/* Pending URL warning */}
              {newImageUrl.trim() && !urlError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>This URL will be auto-added when you save.</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <Field label="Notes (staff only)">
            <textarea {...register("notes")} rows={2} placeholder="Internal notes..." className="input resize-none" />
          </Field>

          {/* Error messages */}
          {(mutation.isError || imageSaveError) && (
            <p className="text-sm text-status-cancelled">
              {imageSaveError || mutation.error?.response?.data?.detail || "An error occurred."}
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
              disabled={saving || mutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white disabled:opacity-60"
            >
              {saving || mutation.isPending
                ? "Saving..."
                : isEdit
                ? "Update Vehicle"
                : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>

  );
}

// ── Main image thumbnail preview ─────────────────────────────────────

function MainImagePreview({ getValues }) {
  const [src, setSrc] = useState("");
  const [show, setShow] = useState(false);

  // Poll the form value every 500ms (simpler than registering a watcher)
  useEffect(() => {
    const interval = setInterval(() => {
      const val = getValues("main_image_url") || "";
      if (val !== src) {
        setSrc(val);
        setShow(isValidUrl(val));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [getValues, src]);

  if (!show || !src) return null;

  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="w-20 h-14 rounded-lg overflow-hidden bg-bg-elevated border border-bg-border">
        <img
          src={src}
          alt="Main preview"
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      </div>
      <span className="text-[10px] text-text-muted">Main image preview</span>
    </div>
  );
}

// ── Field component ──────────────────────────────────────────────────

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
