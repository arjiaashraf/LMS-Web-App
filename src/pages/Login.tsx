
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
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
        </div>
      </div>
    </div>
  );
}

export default Login;
