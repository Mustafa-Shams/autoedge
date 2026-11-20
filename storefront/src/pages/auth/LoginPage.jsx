/**
 * LoginPage — spec 11.4:
 * - Email + password (trimmed on submit), generic error, ?next= redirect after login
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import PasswordField from '../../components/forms/PasswordField';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loggedIn } = useAuth();
  const nextUrl = searchParams.get('next') || '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (loggedIn) navigate(nextUrl, { replace: true });
  }, [loggedIn, navigate, nextUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter your email and password');
      return;
    }

    try {
      setSubmitting(true);
      await login(trimmedEmail, trimmedPassword);
      navigate(nextUrl, { replace: true });
    } catch (err) {
      // Generic error per spec — don't reveal if email exists
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = 'w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-colors';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-bg-card border border-bg-border rounded-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Welcome Back</h1>
          <p className="text-sm text-text-secondary">
            Don't have an account?{' '}
            <Link to={`/signup${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`} className="text-accent-blue hover:text-accent-blue-hover">
              Sign up
            </Link>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-status-cancelled">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={inputClasses}
            />
          </div>

          {/* Password */}
          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Your password"
            required
            autoComplete="current-password"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-accent-blue hover:bg-accent-blue-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 bg-bg-elevated border border-bg-border rounded-lg p-4">
          <p className="text-xs font-medium text-text-secondary mb-2">Demo Accounts:</p>
          <div className="space-y-1 text-xs text-text-muted">
            <p><code className="bg-bg-primary px-1 rounded">demo1@example.com</code> / <code className="bg-bg-primary px-1 rounded">Demo@1234</code></p>
            <p><code className="bg-bg-primary px-1 rounded">demo2@example.com</code> / <code className="bg-bg-primary px-1 rounded">Demo@1234</code></p>
            <p><code className="bg-bg-primary px-1 rounded">demo3@example.com</code> / <code className="bg-bg-primary px-1 rounded">Demo@1234</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
