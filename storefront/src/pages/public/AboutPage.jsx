/**
 * AboutPage — static page with "Demo project" note (spec 11.2).
 */
export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-6">About AutoEdge</h1>

      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-text-secondary text-lg leading-relaxed">
          AutoEdge is a modern online car showroom that brings the dealership experience to your fingertips.
          Browse our curated selection of vehicles, compare specifications side by side, calculate your financing
          options, and reserve your dream car — all from the comfort of your home.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 my-8">
          {[
            { num: '16+', label: 'Premium Vehicles' },
            { num: '8', label: 'Service Types' },
            { num: '5', label: 'Expert Technicians' },
          ].map((stat) => (
            <div key={stat.label} className="bg-bg-card border border-bg-border rounded-xl p-6 text-center">
              <p className="text-3xl font-bold text-accent-blue mb-1">{stat.num}</p>
              <p className="text-sm text-text-secondary">{stat.label}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-text-primary mt-8">What We Offer</h2>
        <ul className="space-y-3 text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent-blue mt-1">✓</span>
            <span>Online vehicle reservations with secure deposit system</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-blue mt-1">✓</span>
            <span>Convenient test drive scheduling</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-blue mt-1">✓</span>
            <span>Professional car servicing by certified technicians</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-blue mt-1">✓</span>
            <span>Fair trade-in valuations for your current vehicle</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-blue mt-1">✓</span>
            <span>Transparent pricing with EMI calculator</span>
          </li>
        </ul>
      </div>

      {/* Demo project disclaimer */}
      <div className="mt-12 bg-status-reserved/10 border border-status-reserved/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-status-reserved mb-2">⚠️ Demo Project Notice</h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          AutoEdge is a university demonstration project and is <strong>not a real car dealership</strong>.
          No real money is involved — all transactions use a simulated banking system. Vehicle images are
          for illustration purposes only. This project showcases modern full-stack web development with
          React, FastAPI, and PostgreSQL.
        </p>
      </div>
    </div>
  );
}
