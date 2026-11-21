import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";
import { apiFetch } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot / Reset Password states
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.verification_required) {
          navigate(
            `/verify-email?email=${encodeURIComponent(
              data.email || email.trim().toLowerCase()
            )}`
          );
          return;
        }

        throw new Error(
          data.message || "Invalid email or password."
        );
      }

      if (
        !["admin", "student", "instructor"].includes(data.role) ||
        !data.token
      ) {
        throw new Error("Invalid authentication response.");
      }

      // Compatibility with existing LMS components.
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          token: data.token,
        })
      );

      const destinations: Record<string, string> = {
        admin: "/admin-dashboard",
        student: "/student-dashboard",
        instructor: "/instructor-dashboard",
      };

      navigate(destinations[data.role], { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  };

  const openResetMode = () => {
    setResetMode(true);
    setResetStep("request");
    setResetEmail(email.trim().toLowerCase());
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setResetMessage("");
  };

  const backToLogin = () => {
    setResetMode(false);
    setResetError("");
    setResetMessage("");
  };

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    setResetLoading(true);

    const normalizedEmail = resetEmail.trim().toLowerCase();

    try {
      const response = await apiFetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send reset code."
        );
      }

      setResetEmail(normalizedEmail);
      setResetStep("confirm");
      setResetMessage(
        data.message ||
          "If this email is registered, a reset code has been sent."
      );
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : "Unable to send reset code."
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");

    if (newPassword.length < 8) {
      setResetError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetLoading(true);

    try {
      const response = await apiFetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code: resetCode.trim(),
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to reset password."
        );
      }

      setEmail(resetEmail.trim().toLowerCase());
      setPassword("");
      setResetMode(false);
      setError("");
      alert(
        data.message ||
          "Password reset successfully. Please sign in with your new password."
      );
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : "Unable to reset password."
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-7">
          <img
            src="/campus95-logo.png"
            alt="Campus 95 - Success Ahead"
            className="h-24 max-w-full object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!resetMode ? (
            <>
              <h1 className="text-2xl font-bold text-slate-800">
                Welcome Back
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Sign in to your Campus 95 account
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleLogin}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Email Address
                  </label>

                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="login-password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={openResetMode}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-lg border border-slate-300 pl-4 pr-11 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="text-center mt-6">
                <p className="text-sm text-slate-600">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Sign Up
                  </Link>
                </p>

                <Link
                  to="/verify-email"
                  className="inline-block mt-3 text-sm text-slate-500 hover:text-blue-600"
                >
                  Verify your email
                </Link>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToLogin}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 mb-4"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </button>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    Reset Password
                  </h1>
                  <p className="text-xs text-slate-500">
                    {resetStep === "request"
                      ? "Enter your registered email to receive a reset code"
                      : "Enter the reset code and choose a new password"}
                  </p>
                </div>
              </div>

              {resetError && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600"
                >
                  {resetError}
                </div>
              )}

              {resetMessage && (
                <div
                  role="status"
                  className="mt-5 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700"
                >
                  {resetMessage}
                </div>
              )}

              {resetStep === "request" ? (
                <form
                  onSubmit={handleRequestCode}
                  className="mt-6 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Registered Email Address
                    </label>

                    <input
                      id="reset-email"
                      name="resetEmail"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {resetLoading ? "Sending code..." : "Send Reset Code"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleConfirmReset}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="reset-code"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Reset Code
                    </label>

                    <input
                      id="reset-code"
                      name="resetCode"
                      type="text"
                      inputMode="numeric"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      New Password
                    </label>

                    <div className="relative">
                      <input
                        id="new-password"
                        name="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-slate-300 pl-4 pr-11 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={
                          showNewPassword ? "Hide new password" : "Show new password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-new-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Confirm New Password
                    </label>

                    <input
                      id="confirm-new-password"
                      name="confirmPassword"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setResetStep("request")}
                      className="text-xs font-medium text-slate-500 hover:text-blue-600"
                    >
                      Change email / resend code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {resetLoading ? "Resetting password..." : "Reset Password"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;