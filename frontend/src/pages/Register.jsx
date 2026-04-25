import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../css/auth.css";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const navigate = useNavigate();

  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthClass = ["", "weak", "fair", "good", "strong"];
  const strength = getPasswordStrength();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/auth/register", {
        name,
        email,
        password,
      });
      localStorage.setItem("token", res.data.token);
      navigate("/home");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L30 10V22L16 30L2 22V10L16 2Z" fill="url(#brandGrad2)" />
                <path d="M16 8L24 13V19L16 24L8 19V13L16 8Z" fill="rgba(255,255,255,0.15)" />
                <defs>
                  <linearGradient id="brandGrad2" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8" />
                    <stop offset="1" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-brand-name">CipherX</span>
          </div>

          <div className="auth-left-content">
            <h1 className="auth-hero-title">
              Start your<br />
              <span className="auth-hero-gradient">journey.</span>
            </h1>
            <p className="auth-hero-subtitle">
              Create an account and unlock the full power of CipherX in seconds.
            </p>

            <div className="auth-feature-list">
  <div className="auth-feature">
    <div className="auth-feature-dot" />
    <span>Intelligent Data Detection</span>
  </div>
  <div className="auth-feature">
    <div className="auth-feature-dot" />
    <span>Privacy Protection & Masking</span>
  </div>
  <div className="auth-feature">
    <div className="auth-feature-dot" />
    <span>Real-Time Analysis</span>
  </div>
</div>
          </div>

          {/* Decorative orbs */}
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="geo-grid" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-card auth-card-register">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Create account</h2>
            <p className="auth-card-subtitle">Join thousands of users already on CipherX</p>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleRegister}>
            {/* Name */}
            <div className={`auth-field ${nameFocused || name ? "active" : ""}`}>
              <label className="auth-label">Full name</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="register-name"
                  type="text"
                  className="auth-input"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email */}
            <div className={`auth-field ${emailFocused || email ? "active" : ""}`}>
              <label className="auth-label">Email address</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" />
                </svg>
                <input
                  id="register-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Two-column row for passwords */}
            <div className="auth-fields-row">
              {/* Password */}
              <div className={`auth-field ${passwordFocused || password ? "active" : ""}`}>
                <label className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="register-password"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className={`auth-field ${confirmFocused || confirmPassword ? "active" : ""}`}>
                <label className="auth-label">Confirm password</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <input
                    id="register-confirm"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* Password strength */}
            {password && (
              <div className="auth-strength">
                <div className="auth-strength-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`auth-strength-bar ${i <= strength ? strengthClass[strength] : ""}`}
                    />
                  ))}
                </div>
                <span className={`auth-strength-label ${strengthClass[strength]}`}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              className={`auth-btn-primary ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  Create account
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or register with</span>
          </div>

          <div className="auth-oauth-row">
            <a
              id="register-google"
              href="http://localhost:5000/auth/google"
              className="auth-oauth-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </a>

          </div>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}