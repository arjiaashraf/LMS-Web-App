
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const response = await apiFetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      navigate(
        `/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
        { replace: true }
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Campus 95 Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/campus95-logo.png"
            alt="Campus 95"
            className="h-20 object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-slate-800">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Join Campus 95 Learning Management System
          </p>

          {/* Error Message */}
          {error && (
            <p
              role="alert"
              className="mt-5 p-3 text-sm bg-red-50 text-red-700 rounded-lg"
            >
              {error}
            </p>
          )}

          {/* Registration Form */}
          <form
            onSubmit={handleRegister}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="register-name"
                className="block text-sm font-medium mb-1"
              >
                Full Name
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={100}
                className="w-full rounded-lg border p-3"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium mb-1"
              >
                Email Address
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Enter your real email"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-sm font-medium mb-1"
              >
                Password
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="register-role"
                className="block text-sm font-medium mb-1"
              >
                Register As
              </label>
              <select
                id="register-role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border p-3 bg-white"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg"
            >
              {loading
                ? "Creating account..."
                : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already registered?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-semibold"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
