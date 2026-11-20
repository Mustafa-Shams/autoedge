/**
 * NewTradeInPage — submit a trade-in request with vehicle details and 3-8 photos.
 * Spec 7.7: indicative estimate shown after submit.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createTradeIn } from '../../api/storeApi';
import ImageUploader from '../../components/forms/ImageUploader';
import { formatPrice } from '../../utils/formatters';

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const CURRENT_YEAR = new Date().getFullYear();

export default function NewTradeInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetVehicleId = searchParams.get('target') || '';

  const [form, setForm] = useState({
    target_vehicle_id: targetVehicleId,
    make: '',
    model: '',
    year: '',
    mileage_km: '',
    color: '',
    condition_rating: '',
    description: '',
    expected_price: '',
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // response after successful submit

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.make.trim()) return setError('Make is required.');
    if (!form.model.trim()) return setError('Model is required.');
    if (!form.year || form.year < 1900 || form.year > CURRENT_YEAR + 1) return setError('Enter a valid year.');
    if (!form.mileage_km || form.mileage_km < 0) return setError('Enter valid mileage.');
    if (!form.condition_rating) return setError('Select a condition rating.');
    if (images.length < 3) return setError('At least 3 photos are required.');
    if (images.length > 8) return setError('Maximum 8 photos allowed.');

    try {
      setSubmitting(true);
      const data = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: parseInt(form.year),
        mileage_km: parseInt(form.mileage_km),
        color: form.color.trim() || null,
        condition_rating: form.condition_rating,
        description: form.description.trim() || null,
        expected_price: form.expected_price ? parseFloat(form.expected_price) : null,
        image_urls: images,
      };
      if (form.target_vehicle_id) {
        data.target_vehicle_id = parseInt(form.target_vehicle_id);
      }

      const res = await createTradeIn(data);
      setResult(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join('; '));
      } else {
        setError('Failed to submit trade-in request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Show result after successful submit
  if (result) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Trade-In Submitted!</h1>
        <p className="text-text-secondary mb-6">
          Your trade-in request for the {result.year} {result.make} {result.model} has been submitted.
        </p>

        <div className="bg-bg-card border border-bg-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Indicative Estimate</h2>

          {result.indicative_low && result.indicative_high ? (
            <div className="text-center py-4">
              <p className="text-sm text-text-secondary mb-2">Estimated value range:</p>
              <p className="text-3xl font-bold text-accent-blue">
                {formatPrice(result.indicative_low)} — {formatPrice(result.indicative_high)}
              </p>
              <p className="text-xs text-text-muted mt-3">
                This is an informational estimate based on our catalog prices. The actual offer will
                be made by our team after reviewing your photos and vehicle details.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-text-secondary mb-2">
                We will appraise your vehicle after reviewing your photos.
              </p>
              <p className="text-xs text-text-muted mt-2">
                No matching vehicles in our catalog for an automatic estimate.
                Our team will review and provide a personalized offer.
              </p>
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-bg-border rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              Our team will review your photos and vehicle details
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              You'll receive an offer with a fair value for your car
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              Accept the offer to use it as credit towards a new purchase
            </li>
          </ol>
        </div>

        {/* Demo note per Article XVIII */}
        <div className="bg-status-reserved/5 border border-status-reserved/20 rounded-xl p-4 mb-6">
          <p className="text-xs text-status-reserved">
            🏷️ Demo project — no real money or vehicle transactions involved.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/account/trade-ins"
            className="px-6 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-xl transition-colors"
          >
            View My Trade-Ins
          </Link>
          <Link
            to="/cars"
            className="px-6 py-2.5 bg-bg-elevated hover:bg-bg-border text-text-primary text-sm font-medium rounded-xl border border-bg-border transition-colors"
          >
            Browse Cars
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">New Trade-In</h1>
      <p className="text-text-secondary mb-6">Submit your vehicle for a trade-in valuation</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vehicle details */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Your Vehicle Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Make */}
            <div>
              <label htmlFor="trade-make" className="block text-sm font-medium text-text-secondary mb-1.5">Make *</label>
              <input
                id="trade-make"
                type="text"
                name="make"
                value={form.make}
                onChange={handleChange}
                placeholder="e.g. Toyota"
                required
                aria-required="true"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              />
            </div>

            {/* Model */}
            <div>
              <label htmlFor="trade-model" className="block text-sm font-medium text-text-secondary mb-1.5">Model *</label>
              <input
                id="trade-model"
                type="text"
                name="model"
                value={form.model}
                onChange={handleChange}
                placeholder="e.g. Camry"
                required
                aria-required="true"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              />
            </div>

            {/* Year */}
            <div>
              <label htmlFor="trade-year" className="block text-sm font-medium text-text-secondary mb-1.5">Year *</label>
              <input
                id="trade-year"
                type="number"
                name="year"
                value={form.year}
                onChange={handleChange}
                min="1900"
                max={CURRENT_YEAR + 1}
                placeholder={String(CURRENT_YEAR)}
                required
                aria-required="true"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              />
            </div>

            {/* Mileage */}
            <div>
              <label htmlFor="trade-mileage" className="block text-sm font-medium text-text-secondary mb-1.5">Mileage (km) *</label>
              <input
                id="trade-mileage"
                type="number"
                name="mileage_km"
                value={form.mileage_km}
                onChange={handleChange}
                min="0"
                placeholder="e.g. 50000"
                required
                aria-required="true"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              />
            </div>

            {/* Color */}
            <div>
              <label htmlFor="trade-color" className="block text-sm font-medium text-text-secondary mb-1.5">
                Color <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="trade-color"
                type="text"
                name="color"
                value={form.color}
                onChange={handleChange}
                placeholder="e.g. Silver"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              />
            </div>

            {/* Condition */}
            <div>
              <label htmlFor="trade-condition" className="block text-sm font-medium text-text-secondary mb-1.5">Condition *</label>
              <select
                id="trade-condition"
                name="condition_rating"
                value={form.condition_rating}
                onChange={handleChange}
                required
                aria-required="true"
                className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
              >
                <option value="">Select condition</option>
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label htmlFor="trade-description" className="block text-sm font-medium text-text-secondary mb-1.5">
              Description <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="trade-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional details about your vehicle (maintenance history, modifications, damage, etc.)"
              className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors resize-none"
            />
          </div>

          {/* Expected price */}
          <div className="mt-4">
            <label htmlFor="trade-expected-price" className="block text-sm font-medium text-text-secondary mb-1.5">
              Expected Price <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="trade-expected-price"
              type="number"
              name="expected_price"
              value={form.expected_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="What you hope to get"
              className="w-full px-3 py-2.5 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
            />
          </div>

          {/* Target vehicle */}
          {form.target_vehicle_id && (
            <div className="mt-4 p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
              <p className="text-xs text-accent-blue">
                Trading in towards vehicle #{form.target_vehicle_id}
              </p>
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Vehicle Photos</h2>
          <p className="text-sm text-text-secondary mb-4">
            Upload 3-8 clear photos of your vehicle (exterior, interior, odometer, any damage)
          </p>
          <ImageUploader
            images={images}
            onChange={setImages}
            disabled={submitting}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4">
            <p className="text-sm text-status-cancelled">{error}</p>
          </div>
        )}

        {/* Demo note */}
        <div className="bg-status-reserved/5 border border-status-reserved/20 rounded-xl p-4">
          <p className="text-xs text-status-reserved">
            🏷️ Demo project — no real money or vehicle transactions involved.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || images.length < 3}
            className="px-6 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Trade-In Request'
            )}
          </button>
          <Link
            to="/account/trade-ins"
            className="px-6 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
