
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { apiFetch } from "../services/api";

function VerifyEmail() {
  const [params] = useSearchParams();

  const [email, setEmail] = useState(
    params.get("email") || ""
  );
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed.");
      }

      setVerified(true);
      setMessage(data.message || "Email verified successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resending || loading) return;

    setError("");
    setMessage("");
    setResending(true);

    try {
      const response = await apiFetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Resend failed.");
      }

      setMessage(
        data.message || "A new verification code has been sent."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to resend code."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <img
          src="/campus95-logo.png"
          alt="Campus 95"
          className="h-20 object-contain mx-auto mb-6"
        />

        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <MailCheck
            size={40}
            className="text-blue-600 mb-4"
          />

          <h1 className="text-2xl font-bold">
            Verify Your Email
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Enter the 6-digit verification code sent to your email.
            It expires after 10 minutes.
          </p>

          {error && (
            <p
              role="alert"
              className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mt-5"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mt-5"
            >
              {message}
            </p>
          )}

          {!verified ? (
            <form onSubmit={verify} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="verify-email"
                  className="block text-sm font-medium mb-1"
                >
                  Email Address
                </label>
                <input
                  id="verify-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border p-3 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="verification-code"
                  className="block text-sm font-medium mb-1"
                >
                  Verification Code
                </label>
                <input
                  id="verification-code"
                  name="code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="6-digit OTP"
                  className="w-full text-center tracking-[0.4em] border p-3 rounded-lg text-xl"
                />
              </div>

              <button
                disabled={loading || resending}
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Email"}
              </button>

              <button
                type="button"
                disabled={loading || resending}
                onClick={() => void resend()}
                className="w-full text-blue-600 font-medium text-sm disabled:opacity-50"
              >
                {resending
                  ? "Sending code..."
                  : "Resend Verification Code"}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-slate-600">
              Verification complete. Wait for admin approval before logging in.
            </p>
          )}

          <div className="text-center mt-5">
            <Link
              to="/login"
              className="text-blue-600 text-sm font-semibold"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
