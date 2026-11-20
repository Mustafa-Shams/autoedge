/**
 * ProcessingSteps — animated steps: "Contacting bank…", "Authorising payment…",
 * "Payment confirmed" over 1.5–2s (purely cosmetic, spec 8.4).
 * The backend call runs at the same time.
 */
import { useState, useEffect } from 'react';

const STEPS = [
  { label: 'Contacting bank…', durationMs: 600 },
  { label: 'Authorising payment…', durationMs: 700 },
  { label: 'Payment confirmed', durationMs: 500 },
];

export default function ProcessingSteps({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState([]);

  useEffect(() => {
    if (currentStep >= STEPS.length) {
      // All steps done
      const timer = setTimeout(() => {
        onComplete?.();
      }, 400); // small pause to show the final check
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCompleted((prev) => [...prev, currentStep]);
      setCurrentStep((prev) => prev + 1);
    }, STEPS[currentStep].durationMs);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="flex flex-col items-center py-8">
      {/* Animated spinner during processing */}
      {currentStep < STEPS.length && (
        <div className="w-16 h-16 mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-bg-border" />
          <div className="absolute inset-0 rounded-full border-4 border-t-accent-blue animate-spin" />
        </div>
      )}

      {/* Success check when all done */}
      {currentStep >= STEPS.length && (
        <div className="w-16 h-16 mb-6 rounded-full bg-status-available/20 flex items-center justify-center animate-in zoom-in duration-300">
          <svg className="w-8 h-8 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}

      {/* Steps list */}
      <div className="space-y-3 w-full max-w-xs">
        {STEPS.map((step, idx) => {
          const isDone = completed.includes(idx);
          const isActive = currentStep === idx;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 transition-opacity duration-300 ${
                isActive || isDone ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {/* Step indicator */}
              {isDone ? (
                <div className="w-5 h-5 rounded-full bg-status-available/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : isActive ? (
                <div className="w-5 h-5 rounded-full border-2 border-accent-blue border-t-transparent animate-spin flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-bg-border flex-shrink-0" />
              )}

              {/* Label */}
              <span className={`text-sm ${isDone ? 'text-status-available' : isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
