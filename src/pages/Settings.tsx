import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Bell,
  Palette,
  Save,
  ShieldCheck,
  Settings as SettingsIcon,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

function Settings() {
  const [activeTab, setActiveTab] = useState("profile");

  const [profile, setProfile] = useState({
    name: "Administrator",
    email: "admin@lms.com",
    phone: "+92 300 1234567",
    role: "Super Admin",
  });

  const [password, setPassword] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });

  const [notifications, setNotifications] = useState({
    email: true,
    assignments: true,
    attendance: true,
    exams: false,
    announcements: true,
  });

  const [appearance, setAppearance] = useState({
    theme: "Light",
    language: "English",
    compactMode: false,
  });

  const [message, setMessage] = useState("");

  const showSavedMessage = () => {
    setMessage("Settings saved successfully!");

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setPassword((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      password.newPassword !==
      password.confirm
    ) {
      window.alert(
        "New password and confirm password do not match."
      );
      return;
    }

    if (password.newPassword.length < 6) {
      window.alert(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setPassword({
      current: "",
      newPassword: "",
      confirm: "",
    });

    showSavedMessage();
  };

  const tabs = [
    {
      id: "profile",
      name: "Profile",
      icon: User,
    },
    {
      id: "security",
      name: "Security",
      icon: Lock,
    },
    {
      id: "notifications",
      name: "Notifications",
      icon: Bell,
    },
    {
      id: "appearance",
      name: "Appearance",
      icon: Palette,
    },
  ];

  const navigate = useNavigate();

useEffect(() => {
  const user = localStorage.getItem("user");
  if (!user) {
    navigate("/login");
  }
}, [navigate]);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}

      <header className="bg-white border-b px-6 py-5">

        <div className="flex items-center gap-3">

          <Link
            to="/admin-dashboard"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
            <SettingsIcon size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Settings
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Manage your LMS account and preferences
            </p>
          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="p-6">

        {/* SUCCESS MESSAGE */}

        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-lg">
            {message}
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* SIDEBAR */}

          <div className="bg-white rounded-xl shadow-sm p-4 h-fit">

            <div className="mb-5 px-3">

              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold mb-3">
                A
              </div>

              <h2 className="font-bold text-slate-800">
                Administrator
              </h2>

              <p className="text-sm text-slate-500">
                Super Admin
              </p>

            </div>

            <div className="space-y-1">

              {tabs.map((tab) => {
                const Icon = tab.icon;

                const isActive =
                  activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setActiveTab(tab.id)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={19} />

                    <span className="font-medium">
                      {tab.name}
                    </span>
                  </button>
                );
              })}

            </div>

          </div>

          {/* CONTENT */}

          <div className="lg:col-span-3">

            {/* PROFILE */}

            {activeTab === "profile" && (

              <div className="bg-white rounded-xl shadow-sm p-6">

                <div className="mb-6">

                  <h2 className="text-xl font-bold text-slate-800">
                    Profile Information
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Update your administrator profile
                  </p>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={profile.name}
                      onChange={handleProfileChange}
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleProfileChange}
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={profile.phone}
                      onChange={handleProfileChange}
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Role
                    </label>

                    <input
                      type="text"
                      value={profile.role}
                      disabled
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-slate-100 text-slate-500"
                    />

                  </div>

                </div>

                <div className="mt-6">

                  <button
                    onClick={showSavedMessage}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium"
                  >
                    <Save size={18} />
                    Save Profile
                  </button>

                </div>

              </div>
            )}

            {/* SECURITY */}

            {activeTab === "security" && (

              <div className="bg-white rounded-xl shadow-sm p-6">

                <div className="flex items-center gap-3 mb-6">

                  <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                    <ShieldCheck size={22} />
                  </div>

                  <div>

                    <h2 className="text-xl font-bold text-slate-800">
                      Security
                    </h2>

                    <p className="text-sm text-slate-500">
                      Manage your password and account security
                    </p>

                  </div>

                </div>

                <form
                  onSubmit={handlePasswordSubmit}
                  className="space-y-5 max-w-xl"
                >

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Current Password
                    </label>

                    <input
                      type="password"
                      name="current"
                      value={password.current}
                      onChange={handlePasswordChange}
                      required
                      placeholder="Enter current password"
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      New Password
                    </label>

                    <input
                      type="password"
                      name="newPassword"
                      value={password.newPassword}
                      onChange={handlePasswordChange}
                      required
                      placeholder="Enter new password"
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Confirm New Password
                    </label>

                    <input
                      type="password"
                      name="confirm"
                      value={password.confirm}
                      onChange={handlePasswordChange}
                      required
                      placeholder="Confirm new password"
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    />

                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium"
                  >
                    <Lock size={18} />
                    Change Password
                  </button>

                </form>

              </div>
            )}

            {/* NOTIFICATIONS */}

            {activeTab === "notifications" && (

              <div className="bg-white rounded-xl shadow-sm p-6">

                <div className="mb-6">

                  <h2 className="text-xl font-bold text-slate-800">
                    Notifications
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Choose which notifications you want to receive
                  </p>

                </div>

                <div className="space-y-5">

                  {/* EMAIL */}

                  <label className="flex items-center justify-between gap-4 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div className="flex items-center gap-3">

                      <Bell className="text-blue-600" size={20} />

                      <div>

                        <p className="font-medium text-slate-800">
                          Email Notifications
                        </p>

                        <p className="text-sm text-slate-500">
                          Receive important updates by email
                        </p>

                      </div>

                    </div>

                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          email: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                  {/* ASSIGNMENTS */}

                  <label className="flex items-center justify-between gap-4 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div>

                      <p className="font-medium text-slate-800">
                        Assignment Notifications
                      </p>

                      <p className="text-sm text-slate-500">
                        Get updates about assignments
                      </p>

                    </div>

                    <input
                      type="checkbox"
                      checked={notifications.assignments}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          assignments: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                  {/* ATTENDANCE */}

                  <label className="flex items-center justify-between gap-4 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div>

                      <p className="font-medium text-slate-800">
                        Attendance Notifications
                      </p>

                      <p className="text-sm text-slate-500">
                        Receive attendance alerts
                      </p>

                    </div>

                    <input
                      type="checkbox"
                      checked={notifications.attendance}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          attendance: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                  {/* EXAMS */}

                  <label className="flex items-center justify-between gap-4 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div>

                      <p className="font-medium text-slate-800">
                        Exam Notifications
                      </p>

                      <p className="text-sm text-slate-500">
                        Receive exam and result updates
                      </p>

                    </div>

                    <input
                      type="checkbox"
                      checked={notifications.exams}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          exams: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                  {/* ANNOUNCEMENTS */}

                  <label className="flex items-center justify-between gap-4 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div>

                      <p className="font-medium text-slate-800">
                        Announcements
                      </p>

                      <p className="text-sm text-slate-500">
                        Receive LMS announcements
                      </p>

                    </div>

                    <input
                      type="checkbox"
                      checked={notifications.announcements}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          announcements: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                </div>

                <button
                  onClick={showSavedMessage}
                  className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium"
                >
                  <Save size={18} />
                  Save Notifications
                </button>

              </div>
            )}

            {/* APPEARANCE */}

            {activeTab === "appearance" && (

              <div className="bg-white rounded-xl shadow-sm p-6">

                <div className="mb-6">

                  <h2 className="text-xl font-bold text-slate-800">
                    Appearance
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Customize the LMS interface
                  </p>

                </div>

                <div className="space-y-6 max-w-xl">

                  {/* THEME */}

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Theme
                    </label>

                    <select
                      value={appearance.theme}
                      onChange={(e) =>
                        setAppearance({
                          ...appearance,
                          theme: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option>Light</option>
                      <option>Dark</option>
                      <option>System Default</option>
                    </select>

                  </div>

                  {/* LANGUAGE */}

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Language
                    </label>

                    <select
                      value={appearance.language}
                      onChange={(e) =>
                        setAppearance({
                          ...appearance,
                          language: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option>English</option>
                      <option>Urdu</option>
                    </select>

                  </div>

                  {/* COMPACT MODE */}

                  <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-slate-50">

                    <div>

                      <p className="font-medium text-slate-800">
                        Compact Mode
                      </p>

                      <p className="text-sm text-slate-500">
                        Use smaller spacing throughout the dashboard
                      </p>

                    </div>

                    <input
                      type="checkbox"
                      checked={appearance.compactMode}
                      onChange={(e) =>
                        setAppearance({
                          ...appearance,
                          compactMode: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />

                  </label>

                  <button
                    onClick={showSavedMessage}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium"
                  >
                    <Save size={18} />
                    Save Appearance
                  </button>

                </div>

              </div>
            )}

          </div>

        </div>

      </main>

    </div>
  );
}

export default Settings;