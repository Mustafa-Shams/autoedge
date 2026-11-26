/**
 * TradeInInfoPage — how trade-in works, "Start trade-in" CTA.
 * Spec 11.2, 7.7.
 */
import { Link } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';

const STEPS = [
  {
    num: '1',
    title: 'Submit your vehicle details',
    desc: 'Fill in your car\'s make, model, year, mileage, and condition. Upload 3-8 photos of your vehicle.',
  },
  {
    num: '2',
    title: 'Get an indicative estimate',
    desc: 'Our system calculates an estimated trade-in value based on current market data and your vehicle\'s condition.',
  },
  {
    num: '3',
    title: 'Receive our offer',
    desc: 'Our team reviews your submission and makes a fair offer within 1-2 business days.',
  },
  {
    num: '4',
    title: 'Accept and use the credit',
    desc: 'Accept the offer and the trade-in credit is applied toward your next vehicle purchase at AutoEdge.',
  },
];

export default function TradeInInfoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BackButton fallback="/" label="Back" className="mb-4" />
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Trade-In Your Car</h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Get a fair value for your current vehicle and use the credit toward your next purchase.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-text-primary mb-8 text-center">How It Works</h2>
        <div className="space-y-6">
          {STEPS.map((step) => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-accent-blue-strong text-white rounded-xl flex items-center justify-center text-lg font-bold">
                {step.num}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-base font-semibold text-text-primary mb-1">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What we need */}
      <section className="bg-bg-card border border-bg-border rounded-xl p-6 sm:p-8 mb-12">
        <h2 className="text-lg font-semibold text-text-primary mb-4">What you'll need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            'Vehicle make, model, and year',
            'Current mileage',
            'Condition assessment (Excellent, Good, Fair, Poor)',
            '3-8 clear photos (JPG, PNG, or WebP, max 5 MB each)',
            'Any additional notes about the vehicle',
            'Active AutoEdge account',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-sm text-text-secondary">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Estimate formula note */}
      <section className="bg-accent-blue/5 border border-accent-blue/10 rounded-xl p-6 mb-12">
        <h3 className="text-sm font-semibold text-text-primary mb-2">How we estimate value</h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          Our indicative estimate is based on the vehicle's market value, adjusted for age, mileage, and condition.
          The formula considers depreciation rates, current market prices for similar vehicles, and the condition
          multiplier you provide. The final offer may differ after our team's detailed review.
        </p>
      </section>

      {/* CTA */}
      <section className="text-center">
        <Link
          to="/signup"
          className="inline-block px-8 py-3.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-accent-blue/20"
        >
          Create Account to Start
        </Link>
        <p className="text-xs text-text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-blue hover:text-accent-blue-hover">Log in</Link>
          {' '}and go to Account → Trade-Ins → New.
        </p>
      </section>

      {/* Demo notice */}
      <div className="mt-12 bg-status-reserved/10 border border-status-reserved/20 rounded-xl p-4">
        <p className="text-xs text-text-secondary">
          <strong className="text-status-reserved">⚠️ Demo Project:</strong> This is a university project.
          Trade-in submissions use simulated valuations. No real money or vehicle exchanges are involved.
          Photos are uploaded to Cloudinary for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
