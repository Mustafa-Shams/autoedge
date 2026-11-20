/**
 * LoadingSpinner — centered spinner with optional text.
 * Used on every page/component that fetches data.
 */
export default function LoadingSpinner({
  text = 'Loading…',
  size = 'md',
  fullPage = false,
  className = '',
}) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const wrapperClasses = fullPage
    ? 'flex flex-col items-center justify-center min-h-[60vh]'
    : `flex flex-col items-center justify-center py-12 ${className}`;

  return (
    <div className={wrapperClasses}>
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-bg-border border-t-accent-blue animate-spin`}
      />
      {text && (
        <p className="mt-3 text-sm text-text-secondary">{text}</p>
      )}
    </div>
  );
}
