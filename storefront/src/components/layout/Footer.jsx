import { Link } from 'react-router-dom';

/**
 * Footer — site footer with navigation, credits, and demo disclaimer.
 * Per spec 11.4: "Car photos courtesy of Pexels and Wikimedia Commons contributors."
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bg-card border-t border-bg-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-accent-blue-strong rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <span className="text-lg font-bold text-text-primary">AutoEdge</span>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed">
              Your premium online car showroom experience. Browse, compare, and reserve your dream car.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Browse</h4>
            <ul className="space-y-2">
              <li><Link to="/cars" className="text-sm text-text-secondary hover:text-text-primary transition-colors">All Cars</Link></li>
              <li><Link to="/compare" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Compare Cars</Link></li>
              <li><Link to="/emi-calculator" className="text-sm text-text-secondary hover:text-text-primary transition-colors">EMI Calculator</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Services</h4>
            <ul className="space-y-2">
              <li><Link to="/service" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Car Service</Link></li>
              <li><Link to="/trade-in" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Trade-In</Link></li>
              <li><Link to="/about" className="text-sm text-text-secondary hover:text-text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal / Demo */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Information</h4>
            <div className="bg-bg-elevated border border-bg-border rounded-lg p-3 mb-3">
              <p className="text-xs text-status-reserved font-medium mb-1">⚠️ Demo Project</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                This is a university project — not a real dealership. No real money is involved. All transactions use simulated bank accounts.
              </p>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Car photos courtesy of Pexels and Wikimedia Commons contributors. Images are for illustration only.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-bg-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            &copy; {currentYear} AutoEdge. University demo project.
          </p>
          <p className="text-xs text-text-muted">
            Built with React, FastAPI, and PostgreSQL
          </p>
        </div>
      </div>
    </footer>
  );
}
