/**
 * CarDetailPage — full vehicle detail per spec 11.4 and 11.2.
 * Gallery, specs, description, stock badge, rating + reviews, review form (logged-in),
 * Reserve/Test Drive/Enquiry/Wishlist/Compare buttons, EMI mini-calculator, related cars.
 * Out-of-stock: "Request this car" instead of Reserve/Test Drive.
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getVehicleDetail, getVehicleReviews } from '../../api/publicApi';
import { requestRestock, createReview } from '../../api/storeApi';
import ImageGallery from '../../components/cars/ImageGallery';
import SpecTable from '../../components/cars/SpecTable';
import StockBadge from '../../components/cars/StockBadge';
import StarRating from '../../components/common/StarRating';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import CompareBar from '../../components/cars/CompareBar';
import CheckoutModal from '../../components/payment/CheckoutModal';
import TestDriveModal from '../../components/cars/TestDriveModal';
import NewEnquiryModal from '../../components/enquiries/NewEnquiryModal';
import ReviewForm from '../../components/reviews/ReviewForm';
import useAuth from '../../hooks/useAuth';
import useCompare from '../../hooks/useCompare';
import { formatPrice, formatDate } from '../../utils/formatters';
import { calculateEmi, EMI_DEFAULTS, TERM_OPTIONS } from '../../utils/emi';

export default function CarDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { compareIds, toggle: toggleCompare, isSelected } = useCompare();

  const [vehicle, setVehicle] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, avg_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);

  // Checkout modal state (P38)
  const [showCheckout, setShowCheckout] = useState(false);

  // Test drive modal state (P39)
  const [showTestDrive, setShowTestDrive] = useState(false);

  // Enquiry modal state (P40)
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryPrefill, setEnquiryPrefill] = useState('');

  // Restock request state (P41)
  const [restockRequested, setRestockRequested] = useState(false);
  const [restockLoading, setRestockLoading] = useState(false);

  // EMI mini-calculator state
  const [emiInputs, setEmiInputs] = useState({
    downPaymentPct: EMI_DEFAULTS.downPaymentPct,
    annualRate: EMI_DEFAULTS.annualRate,
    termMonths: EMI_DEFAULTS.termMonths,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [detailRes, reviewsRes] = await Promise.all([
          getVehicleDetail(id),
          getVehicleReviews(id, { page: 1, page_size: 10 }),
        ]);
        setVehicle(detailRes.data);
        setReviews(reviewsRes.data.items || []);
        setReviewStats({
          total: reviewsRes.data.review_count || 0,
          avg_rating: parseFloat(reviewsRes.data.avg_rating) || 0,
        });
        setReviewTotal(reviewsRes.data.total || 0);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Vehicle not found');
        } else {
          setError('Failed to load vehicle details');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Load more reviews
  const loadMoreReviews = async () => {
    try {
      const nextPage = reviewPage + 1;
      const res = await getVehicleReviews(id, { page: nextPage, page_size: 10 });
      setReviews((prev) => [...prev, ...(res.data.items || [])]);
      setReviewPage(nextPage);
    } catch {
      // silently fail
    }
  };

  // Refresh reviews after submit/edit/delete (P42)
  const refreshReviews = async () => {
    try {
      const res = await getVehicleReviews(id, { page: 1, page_size: 10 });
      setReviews(res.data.items || []);
      setReviewStats({
        total: res.data.review_count || 0,
        avg_rating: parseFloat(res.data.avg_rating) || 0,
      });
      setReviewTotal(res.data.total || 0);
      setReviewPage(1);
    } catch {
      // silently fail
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading vehicle…" />;

  if (error || !vehicle) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          title={error || 'Vehicle not found'}
          description="This vehicle may have been removed or is no longer available."
          action={() => navigate('/cars')}
          actionLabel="Browse all cars"
        />
      </div>
    );
  }

  const isOutOfStock = vehicle.stock_quantity === 0;
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const emiResult = calculateEmi({
    price: parseFloat(vehicle.price),
    ...emiInputs,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link to="/" className="hover:text-text-secondary">Home</Link>
        <span>/</span>
        <Link to="/cars" className="hover:text-text-secondary">Cars</Link>
        <span>/</span>
        <span className="text-text-secondary">{vehicleName}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column — Gallery + Description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery */}
          <ImageGallery
            images={vehicle.images || []}
            vehicleName={vehicleName}
          />

          {/* Description */}
          {vehicle.description && (
            <div className="bg-bg-card border border-bg-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-3">About this vehicle</h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {vehicle.description}
              </p>
            </div>
          )}

          {/* Reviews section */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Reviews</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={reviewStats.avg_rating} size="sm" />
                  <span className="text-sm text-text-secondary">
                    {reviewStats.avg_rating.toFixed(1)} ({reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
              {loggedIn && (
                <ReviewForm vehicleId={id} onReviewSubmitted={refreshReviews} />
              )}
              {!loggedIn && (
                <p className="text-xs text-text-muted">
                  <a href={`/login?next=/cars/${id}`} className="text-accent-blue hover:text-accent-blue-hover">Log in</a> to write a review
                </p>
              )}
            </div>

            {reviews.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">No reviews yet. Be the first to review this vehicle!</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.review_id} className="border-b border-bg-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold">
                        {review.customer_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">{review.customer_name}</span>
                          {review.is_verified && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-status-available/20 text-status-available font-medium">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="xs" />
                          <span className="text-[10px] text-text-muted">{formatDate(review.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {review.title && (
                      <h4 className="text-sm font-medium text-text-primary mb-1">{review.title}</h4>
                    )}
                    {review.body && (
                      <p className="text-sm text-text-secondary leading-relaxed">{review.body}</p>
                    )}
                  </div>
                ))}

                {reviews.length < reviewTotal && (
                  <button
                    onClick={loadMoreReviews}
                    className="w-full py-2 text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                  >
                    Load more reviews
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column — Pricing, actions, specs, EMI */}
        <div className="space-y-6">
          {/* Pricing card */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 sticky top-20">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-text-primary">{vehicleName}</h1>
              <div className="flex items-center gap-2 mt-2">
                <StockBadge stock={vehicle.stock_quantity} />
                {vehicle.open_restock_requests > 0 && isOutOfStock && (
                  <span className="text-xs text-text-muted">
                    {vehicle.open_restock_requests} {vehicle.open_restock_requests === 1 ? 'person' : 'people'} waiting
                  </span>
                )}
              </div>
            </div>

            <p className="text-3xl font-bold text-accent-blue mb-6">
              {formatPrice(vehicle.price)}
            </p>

            {/* Action buttons */}
            <div className="space-y-3">
              {isOutOfStock ? (
                <>
                  <button
                    onClick={async () => {
                      if (!loggedIn) {
                        navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                        return;
                      }
                      if (restockRequested) return;
                      try {
                        setRestockLoading(true);
                        await requestRestock({ vehicle_id: vehicle.vehicle_id });
                        setRestockRequested(true);
                        // Refresh vehicle data to show updated restock count
                        getVehicleDetail(id).then((res) => setVehicle(res.data)).catch(() => {});
                      } catch (err) {
                        if (err.response?.status === 409) {
                          // Already requested
                          setRestockRequested(true);
                        }
                      } finally {
                        setRestockLoading(false);
                      }
                    }}
                    disabled={restockLoading || restockRequested}
                    className={`w-full py-3 font-semibold rounded-xl transition-colors ${
                      restockRequested
                        ? 'bg-status-available/20 text-status-available cursor-default'
                        : 'bg-accent-blue hover:bg-accent-blue-hover text-white'
                    } disabled:opacity-70`}
                  >
                    {restockLoading
                      ? 'Requesting…'
                      : restockRequested
                        ? '✓ Requested'
                        : loggedIn
                          ? 'Request this car'
                          : 'Log in to request'}
                  </button>
                  <button
                    onClick={() => {
                      if (!loggedIn) {
                        navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                        return;
                      }
                      setEnquiryPrefill(`Enquiry about ${vehicleName}`);
                      setShowEnquiry(true);
                    }}
                    className="w-full py-3 bg-bg-elevated hover:bg-bg-border text-text-primary font-medium rounded-xl border border-bg-border transition-colors"
                  >
                    Send enquiry
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (!loggedIn) {
                        navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                        return;
                      }
                      setShowCheckout(true);
                    }}
                    className="w-full py-3 bg-accent-blue hover:bg-accent-blue-hover text-white font-semibold rounded-xl transition-colors shadow-lg shadow-accent-blue/20"
                  >
                    Reserve this car
                  </button>
                  <button
                    onClick={() => {
                      if (!loggedIn) {
                        navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                        return;
                      }
                      setShowTestDrive(true);
                    }}
                    className="w-full py-3 bg-bg-elevated hover:bg-bg-border text-text-primary font-medium rounded-xl border border-bg-border transition-colors"
                  >
                    Book a test drive
                  </button>
                  <button
                    onClick={() => {
                      if (!loggedIn) {
                        navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                        return;
                      }
                      setEnquiryPrefill(`Enquiry about ${vehicleName}`);
                      setShowEnquiry(true);
                    }}
                    className="w-full py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Send enquiry
                  </button>
                </>
              )}

              {/* Wishlist + Compare row */}
              <div className="flex items-center gap-3 pt-3 border-t border-bg-border">
                <button
                  onClick={() => {
                    if (!loggedIn) navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                    // TODO: wishlist API in P36
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-text-secondary hover:text-status-cancelled bg-bg-elevated rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  Wishlist
                </button>
                <button
                  onClick={() => toggleCompare(vehicle.vehicle_id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors ${
                    isSelected(vehicle.vehicle_id)
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-secondary bg-bg-elevated hover:text-text-primary'
                  }`}
                >
                  <svg className="w-4 h-4" fill={isSelected(vehicle.vehicle_id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  {isSelected(vehicle.vehicle_id) ? 'Comparing' : 'Compare'}
                </button>
              </div>
            </div>
          </div>

          {/* Specs */}
          <SpecTable vehicle={vehicle} />

          {/* EMI Mini-Calculator */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">EMI Calculator</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Down Payment (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={emiInputs.downPaymentPct}
                  onChange={(e) => setEmiInputs((p) => ({ ...p, downPaymentPct: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Annual Interest Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.1"
                  value={emiInputs.annualRate}
                  onChange={(e) => setEmiInputs((p) => ({ ...p, annualRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Term (months)</label>
                <select
                  value={emiInputs.termMonths}
                  onChange={(e) => setEmiInputs((p) => ({ ...p, termMonths: parseInt(e.target.value, 10) }))}
                  className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t} months ({t / 12} year{t > 12 ? 's' : ''})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="mt-4 pt-4 border-t border-bg-border space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Monthly EMI</span>
                <span className="text-sm font-bold text-accent-blue">{formatPrice(emiResult.emi)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Down Payment</span>
                <span className="text-xs text-text-secondary">{formatPrice(emiResult.downPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Loan Amount</span>
                <span className="text-xs text-text-secondary">{formatPrice(emiResult.principal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Total Interest</span>
                <span className="text-xs text-text-secondary">{formatPrice(emiResult.totalInterest)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-bg-border">
                <span className="text-xs text-text-muted">Total Payable</span>
                <span className="text-sm font-semibold text-text-primary">{formatPrice(emiResult.totalPayable)}</span>
              </div>
            </div>

            <Link
              to={`/emi-calculator?price=${vehicle.price}`}
              className="block mt-4 text-center text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
            >
              Open full EMI calculator →
            </Link>

            <button
              onClick={() => {
                if (!loggedIn) {
                  navigate('/login?next=' + encodeURIComponent(`/cars/${id}`));
                  return;
                }
                setEnquiryPrefill(`Finance enquiry — ${vehicleName}`);
                setShowEnquiry(true);
              }}
              className="w-full mt-3 py-2 text-xs font-medium text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 rounded-lg transition-colors"
            >
              Ask about finance
            </button>
          </div>
        </div>
      </div>

      {/* Compare bar */}
      <CompareBar />

      {/* Checkout modal (P38) */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        vehicle={vehicle}
        onSuccess={() => {
          // Refresh vehicle data to show updated stock
          getVehicleDetail(id).then((res) => setVehicle(res.data)).catch(() => {});
        }}
      />

      {/* Test drive modal (P39) */}
      <TestDriveModal
        isOpen={showTestDrive}
        onClose={() => setShowTestDrive(false)}
        vehicle={vehicle}
      />

      {/* Enquiry modal (P40) */}
      <NewEnquiryModal
        isOpen={showEnquiry}
        onClose={() => setShowEnquiry(false)}
        onCreated={() => {
          setShowEnquiry(false);
          navigate('/account/enquiries');
        }}
        vehicleId={vehicle.vehicle_id}
        prefillSubject={enquiryPrefill}
      />
    </div>
  );
}
