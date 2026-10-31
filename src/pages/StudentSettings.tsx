import {
  Settings,
  ArrowLeft,
  Bell,
  Lock,
  User,
  Save,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

function StudentSettings() {
  const [emailNotifications, setEmailNotifications] =
    useState(true);

  const [assignmentNotifications, setAssignmentNotifications] =
    useState(true);

  const [announcementNotifications, setAnnouncementNotifications] =
    useState(true);

  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">

      <header className="bg-white border-b h-20 flex items-center justify-between px-6">

        <div className="flex items-center gap-4">

          <Link
            to="/student-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={22} />
          </Link>

          <div>

            <h1 className="text-2xl font-bold text-slate-800">
              Settings
            </h1>

            <p className="text-sm text-slate-500">
              Manage your account preferences
            </p>

          </div>

        </div>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          MA
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
                Customize your LMS experience.
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
                Account
              </h2>

              <p className="text-sm text-slate-500">
                Manage your account information
              </p>

            </div>

          </div>

          <div className="space-y-4">

            <div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>

              <input
                type="text"
                defaultValue="Muhammad Ali"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

            <div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>

              <input
                type="email"
                defaultValue="student@example.com"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

          </div>

        </div>

        {/* NOTIFICATIONS */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

          <div className="flex items-center gap-3 mb-6">

            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <Bell size={22} />
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-800">
                Notifications
              </h2>

              <p className="text-sm text-slate-500">
                Control which notifications you receive
              </p>

            </div>

          </div>

          <div className="space-y-5">

            <label className="flex items-center justify-between cursor-pointer">

              <div>

                <p className="font-medium text-slate-700">
                  Email Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Receive important updates through email
                </p>

              </div>

              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) =>
                  setEmailNotifications(e.target.checked)
                }
                className="w-5 h-5"
              />

            </label>

            <label className="flex items-center justify-between cursor-pointer">

              <div>

                <p className="font-medium text-slate-700">
                  Assignment Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Get notified about assignment deadlines
                </p>

              </div>

              <input
                type="checkbox"
                checked={assignmentNotifications}
                onChange={(e) =>
                  setAssignmentNotifications(e.target.checked)
                }
                className="w-5 h-5"
              />

            </label>

            <label className="flex items-center justify-between cursor-pointer">

              <div>

                <p className="font-medium text-slate-700">
                  Announcement Notifications
                </p>

                <p className="text-sm text-slate-500">
                  Receive important institutional announcements
                </p>

              </div>

              <input
                type="checkbox"
                checked={announcementNotifications}
                onChange={(e) =>
                  setAnnouncementNotifications(e.target.checked)
                }
                className="w-5 h-5"
              />

            </label>

          </div>

        </div>

        {/* APPEARANCE */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

          <h2 className="text-lg font-bold text-slate-800 mb-5">
            Appearance
          </h2>

          <label className="flex items-center justify-between cursor-pointer">

            <div>

              <p className="font-medium text-slate-700">
                Dark Mode
              </p>

              <p className="text-sm text-slate-500">
                Change the appearance of your dashboard
              </p>

            </div>

            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="w-5 h-5"
            />

          </label>

        </div>

        {/* SECURITY */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

          <div className="flex items-center gap-3 mb-5">

            <div className="bg-red-100 text-red-600 p-3 rounded-lg">
              <Lock size={22} />
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-800">
                Security
              </h2>

              <p className="text-sm text-slate-500">
                Manage your account security
              </p>

            </div>

          </div>

          <button className="border border-slate-300 px-5 py-3 rounded-lg hover:bg-slate-50 font-medium">
            Change Password
          </button>

        </div>

        {/* SAVE */}

        <div className="flex justify-end">

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">

            <Save size={18} />

            Save Changes

          </button>

        </div>

      </main>

    </div>
  );
}

export default StudentSettings;