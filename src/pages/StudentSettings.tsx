
import {
  Settings,
  ArrowLeft,
  Bell,
  User,
  Save,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";

type StudentProfile = {
  id: number;
  name: string;
  email: string;
};

type Preferences = {
  emailNotifications: boolean;
  assignmentNotifications: boolean;
  announcementNotifications: boolean;
  darkMode: boolean;
};

const defaultPreferences: Preferences = {
  emailNotifications: true,
  assignmentNotifications: true,
  announcementNotifications: true,
  darkMode: false,
};

function StudentSettings() {
  const navigate = useNavigate();

  const [profile, setProfile] =
    useState<StudentProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);

  const [message, setMessage] = useState("");

  const [studentId, setStudentId] =
    useState<number | null>(null);

  useEffect(() => {
    let id: number;

    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      id = Number(user.id);

      if (
        user.role !== "student" ||
        !user.token ||
        !Number.isSafeInteger(id) ||
        id <= 0
      ) {
        navigate("/login", { replace: true });
        return;
      }

      setStudentId(id);

      const stored = localStorage.getItem(
        `campus95_student_settings_${id}`
      );

      if (stored) {
        const parsed = JSON.parse(stored);

        setPreferences({
          emailNotifications:
            typeof parsed.emailNotifications === "boolean"
              ? parsed.emailNotifications
              : true,
          assignmentNotifications:
            typeof parsed.assignmentNotifications === "boolean"
              ? parsed.assignmentNotifications
              : true,
          announcementNotifications:
            typeof parsed.announcementNotifications === "boolean"
              ? parsed.announcementNotifications
              : true,
          darkMode:
            typeof parsed.darkMode === "boolean"
              ? parsed.darkMode
              : false,
        });
      }
    } catch {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    const fetchProfile = async () => {
      setLoading(true);

      try {
        const response = await apiFetch(
          `/api/student/${id}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load account."
          );
        }

        if (!controller.signal.aborted) {
          setProfile({
            id: Number(data.id),
            name: String(data.name || ""),
            email: String(data.email || ""),
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load account."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchProfile();

    return () => controller.abort();
  }, [navigate]);

  const updatePreference = (
    key: keyof Preferences,
    value: boolean
  ) => {
    setPreferences((previous) => ({
      ...previous,
      [key]: value,
    }));

    setMessage("");
  };

  const saveChanges = () => {
    if (!studentId) return;

    try {
      localStorage.setItem(
        `campus95_student_settings_${studentId}`,
        JSON.stringify(preferences)
      );

      setMessage(
        "Preferences saved on this device successfully."
      );
    } catch {
      setMessage(
        "Unable to save preferences in this browser."
      );
    }
  };

  const initials = profile?.name
    ? profile.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
    : "ST";

  return (
    <div
      className={`min-h-screen ${
        preferences.darkMode
          ? "bg-slate-900"
          : "bg-slate-100"
      }`}
    >
      {/* HEADER */}
      <header
        className={`border-b min-h-20 flex items-center justify-between px-6 py-4 ${
          preferences.darkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white"
        }`}
      >
        <div className="flex items-center gap-4">
          <Link
            to="/student-dashboard"
            className={`p-2 rounded-lg ${
              preferences.darkMode
                ? "text-white hover:bg-slate-700"
                : "hover:bg-slate-100"
            }`}
          >
            <ArrowLeft size={22} />
          </Link>

          <div>
            <h1
              className={`text-2xl font-bold ${
                preferences.darkMode
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              Settings
            </h1>

            <p className="text-sm text-slate-400">
              Manage your account preferences
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          {initials}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">

        {/* INTRO */}
        <div className="bg-slate-800 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-lg">
              <Settings size={30} />
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                Account Settings
              </h2>

              <p className="text-slate-300 mt-1">
                Customize your Campus 95 experience.
              </p>
            </div>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <User size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                My Account
              </h2>

              <p className="text-sm text-slate-500">
                Your registered account information
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <RefreshCw
                size={18}
                className="animate-spin"
              />
              Loading account...
            </div>
          ) : error ? (
            <p className="text-red-600" role="alert">
              {error}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  value={profile?.name || ""}
                  readOnly
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  value={profile?.email || ""}
                  readOnly
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-slate-50 text-slate-700"
                />
              </div>

              <Link
                to="/student/profile"
                className="inline-block text-blue-600 hover:underline text-sm font-medium"
              >
                Manage profile information
              </Link>
            </div>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <Bell size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Notification Preferences
              </h2>

              <p className="text-sm text-slate-500">
                Save your preferred notification settings
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="font-medium text-slate-700">
                  Email Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Preference for email updates
                </p>
              </div>

              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  updatePreference(
                    "emailNotifications",
                    e.target.checked
                  )
                }
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="font-medium text-slate-700">
                  Assignment Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Preference for assignment reminders
                </p>
              </div>

              <input
                type="checkbox"
                checked={preferences.assignmentNotifications}
                onChange={(e) =>
                  updatePreference(
                    "assignmentNotifications",
                    e.target.checked
                  )
                }
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="font-medium text-slate-700">
                  Announcement Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Preference for LMS announcements
                </p>
              </div>

              <input
                type="checkbox"
                checked={preferences.announcementNotifications}
                onChange={(e) =>
                  updatePreference(
                    "announcementNotifications",
                    e.target.checked
                  )
                }
                className="w-5 h-5"
              />
            </label>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Preferences are saved in this browser.
            Email and reminder delivery are not connected yet.
          </p>
        </div>

        {/* APPEARANCE */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <Monitor size={22} />
            </div>

            <h2 className="text-lg font-bold text-slate-800">
              Appearance
            </h2>
          </div>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-slate-700">
                Dark Mode
              </p>

              <p className="text-sm text-slate-500">
                Change this Settings page appearance
              </p>
            </div>

            <input
              type="checkbox"
              checked={preferences.darkMode}
              onChange={(e) =>
                updatePreference(
                  "darkMode",
                  e.target.checked
                )
              }
              className="w-5 h-5"
            />
          </label>
        </div>

        {/* SAVE */}
        <div className="flex flex-col items-end gap-3">
          {message && (
            <p
              role="status"
              className="text-sm font-medium text-green-500"
            >
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={saveChanges}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </main>
    </div>
  );
}

export default StudentSettings;
