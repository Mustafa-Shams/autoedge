/**
 * ReviewsPage — account page listing all reviews written by the current customer.
 * Shows vehicle label, rating, title, body, visibility status, edit/delete actions.
 * Spec 7.6 — customer may edit/delete own review.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyReviews, updateReview, deleteReview } from '../../api/storeApi';
import StarRating from '../../components/common/StarRating';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatDate } from '../../utils/formatters';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyReviews();
      setReviews(res.data || []);
    } catch {
      setError('Failed to load your reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const startEdit = (review) => {
    setEditingId(review.review_id);
    setEditRating(review.rating);
    setEditTitle(review.title || '');
    setEditBody(review.body || '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSaveEdit = async (reviewId) => {
    if (editRating < 1 || editRating > 5) {
      setEditError('Please select a rating.');
      return;
    }
    if (editBody.trim().length < 10) {
      setEditError('Review must be at least 10 characters.');
      return;
    }
    try {
      setSaving(true);
      setEditError(null);
      await updateReview(reviewId, {
        rating: editRating,
        title: editTitle.trim() || null,
        body: editBody.trim(),
      });
      setEditingId(null);
      await fetchReviews();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update review.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteReview(deleteTarget.review_id);
      setDeleteTarget(null);
      await fetchReviews();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">My Reviews</h1>
      <p className="text-text-secondary mb-6">Reviews you've written for vehicles</p>

      {/* Error */}
      {error && (
        <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && reviews.length === 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No reviews yet</h3>
          <p className="text-sm text-text-secondary mb-4">
            You haven't reviewed any vehicles yet.
          </p>
          <Link
            to="/cars"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-xl transition-colors"
          >
            Browse Cars
          </Link>
        </div>
      )}

      {/* Reviews list */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.review_id}
              className="bg-bg-card border border-bg-border rounded-xl p-5"
            >
              {editingId === review.review_id ? (
                /* ── Edit mode ── */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-text-primary">
                      Editing review for{' '}
                      <Link to={`/cars/${review.vehicle_id}`} className="text-accent-blue hover:text-accent-blue-hover">
                        {review.vehicle_label || `Vehicle #${review.vehicle_id}`}
                      </Link>
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="mb-3">
                    <label className="block text-xs text-text-secondary mb-1">Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setEditRating(star)}
                          className="p-0.5"
                        >
                          <svg
                            className={`w-5 h-5 ${star <= editRating ? 'text-status-reserved fill-status-reserved' : 'text-bg-border'}`}
                            viewBox="0 0 24 24"
                            fill={star <= editRating ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-3">
                    <label className="block text-xs text-text-secondary mb-1">Title (optional)</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={120}
                      className="w-full px-3 py-2 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                    />
                  </div>

                  {/* Body */}
                  <div className="mb-3">
                    <label className="block text-xs text-text-secondary mb-1">Review (min 10 chars)</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors resize-none"
                    />
                  </div>

                  {editError && (
                    <p className="text-xs text-status-cancelled mb-3">{editError}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveEdit(review.review_id)}
                      disabled={saving}
                      className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Link
                        to={`/cars/${review.vehicle_id}`}
                        className="text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                      >
                        {review.vehicle_label || `Vehicle #${review.vehicle_id}`}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-xs text-text-muted">
                          {formatDate(review.created_at)}
                        </span>
                        {!review.is_visible && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-status-reserved/10 text-status-reserved rounded-full font-medium">
                            Hidden by moderator
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(review)}
                        className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(review)}
                        className="text-xs text-status-cancelled hover:text-status-cancelled/80 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {review.title && (
                    <h3 className="text-sm font-medium text-text-primary mb-1">{review.title}</h3>
                  )}
                  <p className="text-sm text-text-secondary leading-relaxed">{review.body}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Review"
        message={`Are you sure you want to delete your review for ${deleteTarget?.vehicle_label || 'this vehicle'}? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
