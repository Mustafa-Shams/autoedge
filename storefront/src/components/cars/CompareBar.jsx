import { Link } from 'react-router-dom';
import useCompare from '../../hooks/useCompare';

/**
 * CompareBar — sticky bar at the bottom listing up to 3 selected cars.
 * Shows "Compare now" and "Clear" buttons per spec 11.4.
 */
export default function CompareBar() {
  const { compareIds, clear, count } = useCompare();

  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-bg-card border-t border-bg-border shadow-2xl shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="text-sm font-medium text-text-primary">
                {count} car{count !== 1 ? 's' : ''} selected
              </span>
            </div>
            <span className="text-xs text-text-muted">
              {count < 2 ? `Select ${2 - count} more to compare` : `Up to ${3 - count} more`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={clear}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg transition-colors"
            >
              Clear
            </button>
            <Link
              to={count >= 2 ? `/compare?ids=${compareIds.join(',')}` : '#'}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                count >= 2
                  ? 'bg-accent-blue hover:bg-accent-blue-hover text-white'
                  : 'bg-accent-blue/30 text-white/50 cursor-not-allowed pointer-events-none'
              }`}
            >
              Compare now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
