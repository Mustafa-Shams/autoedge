/**
 * ContactPage — static page with "Demo project" note (spec 11.2).
 */
import { Link } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BackButton fallback="/" label="Back" className="mb-4" />
      <h1 className="text-3xl font-bold text-text-primary mb-6">Contact Us</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contact info */}
        <div className="space-y-6">
          <p className="text-text-secondary leading-relaxed">
            Have questions about a vehicle, need help with your account, or want to learn more about our services?
            We're here to help.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Enquiries</h3>
                <p className="text-sm text-text-secondary">
                  For vehicle-specific questions, use the{' '}
                  <Link to="/cars" className="text-accent-blue hover:text-accent-blue-hover">enquiry feature</Link>{' '}
                  on any car page.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Phone</h3>
                <p className="text-sm text-text-secondary">(555) 123-4567 (demo)</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Address</h3>
                <p className="text-sm text-text-secondary">123 AutoEdge Blvd, Demo City (demo)</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Hours</h3>
                <p className="text-sm text-text-secondary">Mon-Sat: 9 AM – 7 PM, Sun: 10 AM – 5 PM (demo)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Demo notice card */}
        <div>
          <div className="bg-bg-card border border-bg-border rounded-xl p-8 h-full flex flex-col justify-center">
            <div className="bg-status-reserved/10 border border-status-reserved/20 rounded-lg p-4 mb-6">
              <p className="text-xs font-semibold text-status-reserved mb-1">⚠️ Demo Project</p>
              <p className="text-xs text-text-secondary">
                This is not a real dealership. For vehicle-related questions in this demo, use the in-app enquiry system.
              </p>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/cars" className="block text-sm text-accent-blue hover:text-accent-blue-hover">
                → Browse our inventory
              </Link>
              <Link to="/service" className="block text-sm text-accent-blue hover:text-accent-blue-hover">
                → View service options
              </Link>
              <Link to="/signup" className="block text-sm text-accent-blue hover:text-accent-blue-hover">
                → Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
