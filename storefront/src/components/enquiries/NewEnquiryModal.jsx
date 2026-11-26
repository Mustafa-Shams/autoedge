import ModalOverlay from '../common/ModalOverlay';
/**
 * NewEnquiryModal — create a new enquiry thread per spec 7.5.
 * Supports optional pre-filled vehicle_id and subject (for "Ask about finance" etc).
 */
import { useState, useEffect, useRef } from 'react';
import { createEnquiry } from '../../api/storeApi';
import { ENQUIRY_CATEGORIES } from './CategoryBadge';

export default function NewEnquiryModal({
  isOpen, onClose, onCreated, vehicleId = null, prefillSubject = '', defaultCategory = null,
}) {
  const initialCategory = defaultCategory || (vehicleId ? 'Vehicle/Price' : '');
  const [category, setCategory] = useState(initialCategory);
  const [subject, setSubject] = useState(prefillSubject);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const subjectRef = useRef(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setSubject(prefillSubject);
      setCategory(initialCategory);
      setMessage('');
      setError(null);
      setSubmitting(false);
      setTimeout(() => subjectRef.current?.focus(), 100);
    }
  }, [isOpen, prefillSubject, initialCategory]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!category) {
      setError('Choose what your enquiry is about.');
      return;
    }
    if (trimmedSubject.length < 3) {
      setError('Subject must be at least 3 characters.');
      return;
    }
    if (trimmedMessage.length < 5) {
      setError('Message must be at least 5 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
      };
      if (vehicleId) payload.vehicle_id = vehicleId;
      await createEnquiry(payload);
      onCreated?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg || d).join(', '));
      } else {
        setError('Failed to create enquiry. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay onDismiss={submitting ? undefined : onClose} aria-label="New enquiry" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-bg-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bg-border">
          <h2 className="text-lg font-bold text-text-primary">New Enquiry</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category decides which team answers */}
          <div>
            <label htmlFor="enq-category" className="block text-sm font-medium text-text-secondary mb-1.5">
              What is it about?
            </label>
            <select
              id="enq-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              <option value="" disabled>Choose a topic…</option>
              {ENQUIRY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              {ENQUIRY_CATEGORIES.find((c) => c.value === category)?.team || 'We route your question to the right team.'}
            </p>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="enq-subject" className="block text-sm font-medium text-text-secondary mb-1.5">
              Subject
            </label>
            <input
              ref={subjectRef}
              id="enq-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Question about the 2024 BMW X5"
              maxLength={150}
              className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            <p className="text-xs text-text-muted mt-1">{subject.trim().length}/150 characters</p>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="enq-message" className="block text-sm font-medium text-text-secondary mb-1.5">
              Message
            </label>
            <textarea
              id="enq-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your question or enquiry here..."
              rows={5}
              className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-status-cancelled/10 border border-status-cancelled/30 rounded-lg text-sm text-status-cancelled">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : 'Send Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
