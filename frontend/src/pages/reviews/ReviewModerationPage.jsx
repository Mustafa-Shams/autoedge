import ModalOverlay from '../../components/common/ModalOverlay';
import BackButton from "../../components/common/BackButton";
/**
 * ReviewModerationPage — staff page for managers to view and moderate customer reviews.
 * Spec 7.6, 10.4 — manager can toggle is_visible on reviews.
 * Decision #24: Clicking a row opens a detail modal with full review text.
 */
import { useState, useEffect, useCallback } from 'react';
import { getReviews, setReviewVisibility } from '../../api/reviewsApi';
import { apiError } from '../../utils/apiError';
import { Star, Eye, EyeOff, RefreshCw, Filter, AlertTriangle, X, Car, User, Calendar } from 'lucide-react';

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [visibilityFilter, setVisibilityFilter] = useState(''); // '' | 'true' | 'false'
  const [ratingFilter, setRatingFilter] = useState(''); // '' | '1'-'5'
  const [togglingId, setTogglingId] = useState(null);

  // Detail modal
  const [selectedReview, setSelectedReview] = useState(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (visibilityFilter !== '') params.is_visible = visibilityFilter === 'true';
      if (ratingFilter !== '') params.rating = parseInt(ratingFilter);
      const res = await getReviews(params);
      setReviews(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [page, visibilityFilter, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleToggleVisibility = async (reviewId, currentVisible) => {
    try {
      setTogglingId(reviewId);
      await setReviewVisibility(reviewId, { is_visible: !currentVisible });
      await fetchReviews();
      // Also update selected review if open
      if (selectedReview?.review_id === reviewId) {
        setSelectedReview((prev) => ({ ...prev, is_visible: !currentVisible }));
      }
    } catch (err) {
      setError(apiError(err, 'Could not update review visibility.'));
    } finally {
      setTogglingId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const renderStars = (rating, size = 'w-3.5 h-3.5') => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg
            key={s}
            className={`${size} ${s <= rating ? 'text-status-reserved fill-status-reserved' : 'text-bg-border'}`}
            viewBox="0 0 24 24"
            fill={s <= rating ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ))}
      </div>
    );
  };

  return (

    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
            <Star className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Review Moderation</h1>
            <p className="text-sm text-text-secondary">
              Manage customer reviews — hide inappropriate content
            </p>
          </div>
        </div>
        <button
          onClick={fetchReviews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-text-muted" />
        <select
          value={visibilityFilter}
          onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        >
          <option value="">All visibility</option>
          <option value="true">Visible</option>
          <option value="false">Hidden</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={String(r)}>{r} star{r !== 1 ? 's' : ''}</option>
          ))}
        </select>
        <span className="text-xs text-text-muted ml-auto">
          {total} review{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-status-cancelled flex-shrink-0" />
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && reviews.length === 0 && (
        <div className="text-center py-20 bg-bg-card border border-bg-border rounded-xl">
          <Star className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Reviews Found</h3>
          <p className="text-sm text-text-secondary">
            {visibilityFilter || ratingFilter ? 'Try adjusting your filters.' : 'No customer reviews yet.'}
          </p>
        </div>
      )}

      {/* Reviews table */}
      {!loading && reviews.length > 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Rating</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Review</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {reviews.map((review) => (
                  <tr
                    key={review.review_id}
                    className="hover:bg-bg-elevated/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedReview(review)}
                  >
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-text-primary">
                        {review.vehicle_label || `#${review.vehicle_id}`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-sm text-text-primary block">{review.customer_name || 'Unknown'}</span>
                        <span className="text-xs text-text-muted">{review.customer_email || ''}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {renderStars(review.rating)}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      {review.title && (
                        <span className="text-sm font-medium text-text-primary block mb-0.5 truncate">{review.title}</span>
                      )}
                      <span className="text-xs text-text-secondary line-clamp-2">{review.body}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-text-secondary">{formatDate(review.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      {review.is_visible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-available/10 text-status-available text-xs font-medium rounded-full">
                          <Eye className="w-3 h-3" />
                          Visible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-cancelled/10 text-status-cancelled text-xs font-medium rounded-full">
                          <EyeOff className="w-3 h-3" />
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(review.review_id, review.is_visible); }}
                        disabled={togglingId === review.review_id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                          review.is_visible
                            ? 'bg-status-cancelled/10 text-status-cancelled hover:bg-status-cancelled/20'
                            : 'bg-status-available/10 text-status-available hover:bg-status-available/20'
                        }`}
                      >
                        {togglingId === review.review_id ? (
                          <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : review.is_visible ? (
                          <><EyeOff className="w-3.5 h-3.5" /> Hide</>
                        ) : (
                          <><Eye className="w-3.5 h-3.5" /> Show</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-bg-border">
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReview && (
        <ModalOverlay onDismiss={() => setSelectedReview(null)} aria-label="Review details" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedReview(null)} />
          <div  className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-bg-border sticky top-0 bg-bg-card z-10">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-accent-blue" />
                <h2 className="text-lg font-bold text-text-primary">Review Detail</h2>
                <BackButton onClick={() => setSelectedReview(null)} />
              </div>
              <button
                aria-label="Close review details"
                onClick={() => setSelectedReview(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Rating */}
              <div className="flex items-center gap-3">
                {renderStars(selectedReview.rating, 'w-5 h-5')}
                <span className="text-sm text-text-secondary font-medium">{selectedReview.rating}/5</span>
                {selectedReview.is_visible ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-available/10 text-status-available text-xs font-medium rounded-full ml-auto">
                    <Eye className="w-3 h-3" /> Visible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-cancelled/10 text-status-cancelled text-xs font-medium rounded-full ml-auto">
                    <EyeOff className="w-3 h-3" /> Hidden
                  </span>
                )}
              </div>

              {/* Title & Body */}
              {selectedReview.title && (
                <h3 className="text-base font-semibold text-text-primary">{selectedReview.title}</h3>
              )}
              <div className="bg-bg-elevated rounded-xl p-4">
                <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {selectedReview.body}
                </p>
              </div>

              {/* Vehicle */}
              <div className="bg-bg-elevated rounded-xl p-4">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider mb-2">
                  <Car className="w-3.5 h-3.5" /> Vehicle
                </div>
                <p className="text-sm text-text-primary font-medium">
                  {selectedReview.vehicle_label || `Vehicle #${selectedReview.vehicle_id}`}
                </p>
              </div>

              {/* Customer */}
              <div className="bg-bg-elevated rounded-xl p-4">
                <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider mb-2">
                  <User className="w-3.5 h-3.5" /> Customer
                </div>
                <p className="text-sm text-text-primary font-medium">{selectedReview.customer_name || 'Unknown'}</p>
                {selectedReview.customer_email && (
                  <p className="text-xs text-text-secondary mt-0.5">{selectedReview.customer_email}</p>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Calendar className="w-4 h-4 text-text-muted" />
                Posted on {formatDate(selectedReview.created_at)}
              </div>

              {/* Toggle Visibility */}
              <button
                onClick={() => handleToggleVisibility(selectedReview.review_id, selectedReview.is_visible)}
                disabled={togglingId === selectedReview.review_id}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 ${
                  selectedReview.is_visible
                    ? 'bg-status-cancelled/10 text-status-cancelled hover:bg-status-cancelled/20 border border-status-cancelled/30'
                    : 'bg-status-available/10 text-status-available hover:bg-status-available/20 border border-status-available/30'
                }`}
              >
                {togglingId === selectedReview.review_id ? (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : selectedReview.is_visible ? (
                  <><EyeOff className="w-4 h-4" /> Hide This Review</>
                ) : (
                  <><Eye className="w-4 h-4" /> Show This Review</>
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>

  );
}
