/**
 * SignupPage — full spec 7.1 and 11.4:
 * - Full name, phone, email (live availability check, debounced),
 *   password + confirm password (both with PasswordField eye toggle)
 * - Trim values on submit, inline validation messages
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import PasswordField from '../../components/forms/PasswordField';
import { checkEmail } from '../../api/storeApi';
import { isValidEmail, isValidPhone, isValidName, validatePassword, passwordsMatch } from '../../utils/validators';
import BackButton from '../../components/common/BackButton';

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, loggedIn } = useAuth();
  const nextUrl = searchParams.get('next') || '/account';

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [emailStatus, setEmailStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debouncedEmail = useDebounce(form.email, 500);

  // Redirect if already logged in
  useEffect(() => {
    if (loggedIn) navigate(nextUrl, { replace: true });
  }, [loggedIn, navigate, nextUrl]);

  // Live email check (debounced)
  useEffect(() => {
    if (!debouncedEmail || !isValidEmail(debouncedEmail)) {
      setEmailStatus(null);
      return;
    }

    let cancelled = false;
    setEmailStatus('checking');

    checkEmail(debouncedEmail)
      .then((res) => {
        if (!cancelled) {
          setEmailStatus(res.data.available ? 'available' : 'taken');
        }
      })
      .catch(() => {
        if (!cancelled) setEmailStatus(null);
      });

    return () => { cancelled = true; };
  }, [debouncedEmail]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setSubmitError('');
  };

  const validate = () => {
    const errs = {};

    if (!isValidName(form.full_name)) errs.full_name = 'Enter your full name (at least 2 characters)';
    if (!isValidEmail(form.email)) errs.email = 'Enter a valid email address';
    else if (emailStatus === 'taken') errs.email = 'This email is already registered';
    if (!isValidPhone(form.phone)) errs.phone = 'Enter a valid phone number (10-11 digits)';

    const pwResult = validatePassword(form.password);
    if (!pwResult.valid) errs.password = pwResult.errors[0];

    if (!passwordsMatch(form.password, form.confirm_password)) {
      errs.confirm_password = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    try {
      setSubmitting(true);
      // Trim on submit per spec
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password.trim(),
        confirm_password: form.confirm_password.trim(),
      });
      navigate(nextUrl, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setSubmitError(detail);
      } else if (Array.isArray(detail)) {
        setSubmitError(detail.map((d) => d.msg || d).join('; '));
      } else {
        setSubmitError('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = (field) =>
    `w-full px-4 py-2.5 bg-bg-elevated border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-colors ${
      errors[field] ? 'border-status-cancelled' : 'border-bg-border'
    }`;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-bg-card border border-bg-border rounded-xl p-8 max-w-md w-full">
        <BackButton fallback="/" label="Back" className="mb-4" />
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Create Account</h1>
          <p className="text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to={`/login${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`} className="text-accent-blue hover:text-accent-blue-hover">
              Log in
            </Link>
          </p>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-status-cancelled">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-text-secondary mb-1.5">
              Full Name <span className="text-status-cancelled">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              placeholder="John Doe"
              required
              autoComplete="name"
              className={inputClasses('full_name')}
            />
            {errors.full_name && <p className="mt-1 text-xs text-status-cancelled">{errors.full_name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-text-secondary mb-1.5">
              Phone <span className="text-status-cancelled">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
              required
              autoComplete="tel"
              className={inputClasses('phone')}
            />
            {errors.phone && <p className="mt-1 text-xs text-status-cancelled">{errors.phone}</p>}
          </div>

          {/* Email with live check */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
              Email <span className="text-status-cancelled">*</span>
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={`${inputClasses('email')} pr-10`}
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {emailStatus === 'checking' && (
                  <div className="w-4 h-4 border-2 border-text-muted border-t-accent-blue rounded-full animate-spin" />
                )}
                {emailStatus === 'available' && (
                  <svg className="w-4 h-4 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {emailStatus === 'taken' && (
                  <svg className="w-4 h-4 text-status-cancelled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {emailStatus === 'taken' && (
              <p className="mt-1 text-xs text-status-cancelled">This email is already registered</p>
            )}
            {emailStatus === 'available' && (
              <p className="mt-1 text-xs text-status-available">Email is available</p>
            )}
            {errors.email && emailStatus !== 'taken' && (
              <p className="mt-1 text-xs text-status-cancelled">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <PasswordField
            id="password"
            name="password"
            label="Password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            error={errors.password}
            required
            autoComplete="new-password"
          />

          {/* Confirm Password */}
          <PasswordField
            id="confirm_password"
            name="confirm_password"
            label="Confirm Password"
            value={form.confirm_password}
            onChange={handleChange}
            placeholder="Re-enter your password"
            error={errors.confirm_password}
            required
            autoComplete="new-password"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || emailStatus === 'taken'}
            className="w-full py-3 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {/* Demo note */}
        <div className="mt-6 bg-bg-elevated border border-bg-border rounded-lg p-3">
          <p className="text-[10px] text-text-muted text-center">
            Demo project — you can also log in with demo1@example.com / Demo@1234
          </p>
        </div>
      </div>
    </div>
  );
}
