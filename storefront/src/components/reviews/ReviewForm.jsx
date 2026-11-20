/**
 * ReviewForm — inline review form on CarDetailPage.
 * Spec 7.6: logged-in only; one per (vehicle, customer); rating 1-5; body min 10 chars.
 * If user has already reviewed, shows their existing review with edit/delete options.
 */
import { useState, useEffect } from 'react';
import { createReview, updateReview, deleteReview, getMyReviews } from '../../api/storeApi';
import StarRating from '../common/StarRating';

export default function ReviewForm({ vehicleId, onReviewSubmitted }) {
  const [myReview, setMyReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Check if user already reviewed this vehicle
  useEffect(() => {
    const checkExisting = async () => {
      try {
        setLoading(true);
        const res = await getMyReviews();
        const existing = (res.data || []).find((r) => r.vehicle_id === parseInt(vehicleId));
        if (existing) {
          setMyReview(existing);
          setRating(existing.rating);
          setTitle(existing.title || '');
          setBody(existing.body || '');
        }
      } catch {
        // Silently fail — user might not be authenticated yet
      } finally {
        setLoading(false);
      }
    };
    checkExisting();
  }, [vehicleId]);

  const resetForm = () => {
    setRating(0);
    setTitle('');
    setBody('');
    setError(null);
    setEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (rating < 1 || rating > 5) {
      setError('Please select a rating (1-5 stars).');
      return;
    }
    if (body.trim().length < 10) {
      setError('Review must be at least 10 characters.');
      return;
    }

    try {
      setSubmitting(true);
      if (myReview && editing) {
        // Update
        const res = await updateReview(myReview.review_id, { rating, title: title || null, body });
        setMyReview(res.data);
        setEditing(false);
        setSuccess('Review updated successfully!');
      } else {
        // Create
        const res = await createReview({ vehicle_id: parseInt(vehicleId), rating, title: title || null, body });
        setMyReview(res.data);
        setSuccess('Review submitted successfully!');
      }
      onReviewSubmitted?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setError('You have already reviewed this vehicle.');
      } else if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join('; '));
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    try {
      setDeleting(true);
      await deleteReview(myReview.review_id);
      setMyReview(null);
      resetForm();
      setSuccess('Review deleted.');
      onReviewSubmitted?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch {
      setError('Failed to delete review.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  // If already reviewed and not editing — show existing review summary
  if (myReview && !editing) {
    return (
      <div className="bg-bg-elevated border border-bg-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">Your Review</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-status-cancelled hover:text-status-cancelled/80 transition-colors disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <StarRating rating={myReview.rating} size="sm" />
          {!myReview.is_visible && (
            <span className="text-[10px] px-1.5 py-0.5 bg-status-reserved/10 text-status-reserved rounded-full">
              Hidden by moderator
            </span>
          )}
        </div>
        {myReview.title && (
          <h4 className="text-sm font-medium text-text-primary mb-1">{myReview.title}</h4>
        )}
        <p className="text-sm text-text-secondary leading-relaxed">{myReview.body}</p>

        {success && (
          <p className="mt-3 text-xs text-status-available">{success}</p>
        )}
      </div>
    );
  }

  // Review form (new or editing)
  return (
    <form onSubmit={handleSubmit} className="bg-bg-elevated border border-bg-border rounded-xl p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">
        {editing ? 'Edit Your Review' : 'Write a Review'}
      </h3>

      {/* Rating selector */}
      <div className="mb-4">
        <label className="block text-xs text-text-secondary mb-1.5">Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-0.5 transition-transform hover:scale-110"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            >
              <svg
                className={`w-6 h-6 ${star <= rating ? 'text-status-reserved fill-status-reserved' : 'text-bg-border'}`}
                viewBox="0 0 24 24"
                fill={star <= rating ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          ))}
          <span className="ml-2 text-xs text-text-muted">
            {rating > 0 ? `${rating}/5` : 'Select'}
          </span>
        </div>
      </div>

      {/* Title (optional) */}
      <div className="mb-3">
        <label className="block text-xs text-text-secondary mb-1.5">
          Title <span className="text-text-muted">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Sum up your experience"
          className="w-full px-3 py-2 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
        />
      </div>

      {/* Body (required) */}
      <div className="mb-4">
        <label className="block text-xs text-text-secondary mb-1.5">
          Review <span className="text-text-muted">(min 10 characters)</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Share your experience with this vehicle…"
          className="w-full px-3 py-2 bg-bg-primary border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors resize-none"
        />
        <p className="text-[10px] text-text-muted mt-1 text-right">
          {body.trim().length}/10 min
        </p>
      </div>

      {/* Error / Success */}
      {error && (
        <p className="text-xs text-status-cancelled mb-3">{error}</p>
      )}
      {success && (
        <p className="text-xs text-status-available mb-3">{success}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setRating(myReview.rating);
              setTitle(myReview.title || '');
              setBody(myReview.body || '');
              setError(null);
            }}
            className="px-4 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || rating < 1 || body.trim().length < 10}
          className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {editing ? 'Updating…' : 'Submitting…'}
            </>
          ) : (
            editing ? 'Update Review' : 'Submit Review'
          )}
        </button>
      </div>
    </form>
  );
}
