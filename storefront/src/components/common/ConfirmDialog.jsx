import ModalOverlay from './ModalOverlay';


/**
 * ConfirmDialog — modal dialog for confirming destructive actions.
 * Used for cancel reservation, delete review, remove from wishlist, etc.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'info'
  isLoading = false,
}) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-status-cancelled hover:bg-status-cancelled/80',
    warning: 'bg-status-reserved hover:bg-status-reserved/80',
    info: 'bg-accent-blue hover:bg-accent-blue-hover',
  };

  const variantIconColors = {
    danger: 'text-status-cancelled',
    warning: 'text-status-reserved',
    info: 'text-accent-blue',
  };

  return (
    <ModalOverlay onDismiss={isLoading ? undefined : onClose} aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (!isLoading && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-card border border-bg-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex-shrink-0 ${variantIconColors[variant]}`}>
            {variant === 'danger' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : variant === 'warning' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            )}
          </div>
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-text-primary">
            {title}
          </h3>
        </div>

        {/* Message */}
        {message && (
          <p className="text-sm text-text-secondary mb-6 ml-9">{message}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${variantStyles[variant]}`}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
