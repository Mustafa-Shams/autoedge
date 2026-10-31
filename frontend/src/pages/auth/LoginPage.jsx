import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Eye, EyeOff } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { authStore } from "../../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Trim whitespace so pasted values with leading/trailing spaces don't fail
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    try {
      // FastAPI OAuth2 form expects form-data
      const form = new URLSearchParams();
      form.append("username", trimmedEmail);
      form.append("password", trimmedPassword);

      const res = await axiosInstance.post("/api/v1/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const { access_token, role } = res.data;

      // Get user profile
      const meRes = await axiosInstance.get("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      authStore.login(access_token, { ...meRes.data, role });

      // Redirect based on role
      if (role === "manager") {
        navigate("/dashboard");
      } else {
        navigate("/vehicles");
      }
    } catch (err) {
      // Always show a clear, user-friendly message — never leak server internals
      const status = err.response?.status;
      if (status === 401 || status === 400) {
        setError("Invalid email or password. Please try again.");
      } else if (status >= 500) {
        setError("Server error. Please try again later.");
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-accent-blue rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Car className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">AutoEdge</h1>
          <p className="text-sm text-text-secondary mt-1">
            Car Showroom Management System
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            Sign in to your account
          </h2>
          <p className="text-xs text-text-muted mb-6">
            Enter your credentials to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@autoedge.com"
                className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2.5 text-sm placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2.5 pr-10 text-sm placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-status-cancelled bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Contact your manager to get an account
        </p>
      </div>
    </div>
  );
}

