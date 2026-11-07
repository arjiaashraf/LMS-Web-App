
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, CalendarCheck, FileText, Settings,
  LogOut, Menu, Video, BarChart3, X, CheckCircle
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../services/api";

type PendingUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  email_verified?: number | boolean;
};

type Stats = {
  totalStudents: number;
  totalTeachers: number;
  pendingUsers: number;
  activeCourses: number;
};

const navigation = [
  { name: "Dashboard", path: "/admin-dashboard", icon: LayoutDashboard },
  { name: "Students", path: "/students", icon: Users },
  { name: "Teachers", path: "/teachers", icon: GraduationCap },
  { name: "Courses", path: "/courses", icon: BookOpen },
  { name: "Assignments", path: "/assignments", icon: ClipboardList },
  { name: "Attendance", path: "/attendance", icon: CalendarCheck },
  { name: "Exams & Results", path: "/exams", icon: FileText },
  { name: "Online Classes", path: "/announcements", icon: Video },
  { name: "Reports", path: "/reports", icon: BarChart3 },
  { name: "Settings", path: "/settings", icon: Settings }
];

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalTeachers: 0,
    pendingUsers: 0,
    activeCourses: 0
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      if (
        user.role !== "admin" ||
        typeof user.token !== "string" ||
        !user.token
      ) {
        logout();
      }
    } catch {
      logout();
    }
  }, [logout]);

  const fetchPendingUsers = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/pending-users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load pending accounts.");
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid pending accounts response.");
      }

      setPendingUsers(data);
      setPendingError("");
    } catch (error) {
      console.error("Pending users error:", error);
      setPendingError(
        error instanceof Error
          ? error.message
          : "Could not load pending accounts."
      );
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load statistics.");
      }

      setStats({
        totalStudents: Number(data.totalStudents ?? 0),
        totalTeachers: Number(data.totalTeachers ?? 0),
        pendingUsers: Number(data.pendingUsers ?? 0),
        activeCourses: Number(data.activeCourses ?? 0)
      });

      setStatsError("");
    } catch (error) {
      console.error("Admin statistics error:", error);
      setStatsError("Could not refresh statistics. Check the backend.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    void fetchPendingUsers();
    void fetchStats();

    const interval = window.setInterval(() => {
      void fetchPendingUsers();
      void fetchStats();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [fetchPendingUsers, fetchStats]);

  const handleApprove = async (id: number) => {
    if (approvingId !== null) return;

    setApprovingId(id);

    try {
      const response = await apiFetch(
        `/api/admin/approve-user/${id}`,
        { method: "PUT" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Approval failed.");
      }

      alert(data.message || "User approved successfully!");

      await Promise.all([
        fetchPendingUsers(),
        fetchStats()
      ]);
    } catch (error) {
      console.error("Approval error:", error);
      alert(
        error instanceof Error ? error.message : "Approval failed."
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  const SidebarNavigation = ({
    mobile = false
  }: {
    mobile?: boolean;
  }) => (
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => mobile && setMobileMenu(false)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon size={20} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  const Branding = () => (
    <div className="h-24 shrink-0 flex items-center justify-center px-4 border-b border-slate-700">
      <div className="w-full max-w-[210px] h-[70px] bg-white rounded-xl flex items-center justify-center px-3 shadow-sm">
        <img
          src="/campus95-logo.png"
          alt="Campus 95 - Success Ahead"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );

  const statCards = [
    {
      label: "Total Students",
      value: stats.totalStudents,
      description: "Active database count",
      icon: Users,
      tone: "text-blue-600 bg-blue-100",
      descriptionTone: "text-green-600"
    },
    {
      label: "Teachers",
      value: stats.totalTeachers,
      description: "Active database count",
      icon: GraduationCap,
      tone: "text-purple-600 bg-purple-100",
      descriptionTone: "text-green-600"
    },
    {
      label: "Active Courses",
      value: stats.activeCourses,
      description: "Published courses in database",
      icon: BookOpen,
      tone: "text-green-600 bg-green-100",
      descriptionTone: "text-blue-600"
    },
    {
      label: "Pending Approvals",
      value: stats.pendingUsers,
      description: "Needs attention",
      icon: ClipboardList,
      tone: "text-orange-600 bg-orange-100",
      descriptionTone: "text-orange-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 bottom-0">
        <Branding />
        <SidebarNavigation />

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenu(false)}
          />

          <aside className="relative w-72 h-full bg-slate-900 text-white flex flex-col">
            <div className="relative">
              <Branding />
              <button
                onClick={() => setMobileMenu(false)}
                aria-label="Close menu"
                className="absolute right-2 top-2 text-slate-300 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <SidebarNavigation mobile />

            <div className="p-4 border-t border-slate-700">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0 md:ml-64">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Admin Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                Welcome back, Administrator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">
                Administrator
              </p>
              <p className="text-xs text-slate-500">
                Super Admin
              </p>
            </div>

            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* PENDING ACCOUNT APPROVALS */}
          <section className="mb-6 bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
            <div className="p-6 border-b bg-amber-50 flex justify-between items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-amber-900">
                  Pending Account Approvals
                </h2>
                <p className="text-sm text-amber-700">
                  New students and teachers waiting for approval
                </p>
              </div>

              <span className="bg-amber-200 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                {pendingUsers.length} Pending
              </span>
            </div>

            <div className="p-6">
              {loadingPending ? (
                <p className="text-slate-500 text-center py-4">
                  Loading pending accounts...
                </p>
              ) : pendingError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm"
                >
                  {pendingError}
                </p>
              ) : pendingUsers.length === 0 ? (
                <p className="text-slate-500 text-center py-4">
                  No pending accounts right now.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-slate-600 text-sm">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Email</th>
                        <th className="pb-3 font-semibold">Role</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 text-right font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y text-slate-700">
                      {pendingUsers.map((user) => {
                        const verified =
                          Number(user.email_verified) === 1;

                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="py-3 font-medium">
                              {user.name}
                            </td>

                            <td className="py-3 text-slate-500">
                              {user.email}
                            </td>

                            <td className="py-3 capitalize">
                              <span
                                className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                                  user.role === "instructor"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>

                            <td className="py-3">
                              <span className="px-2.5 py-1 text-xs rounded-full bg-orange-100 text-orange-700 font-medium">
                                {user.status}
                              </span>
                            </td>

                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => void handleApprove(user.id)}
                                disabled={
                                  approvingId !== null || !verified
                                }
                                className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CheckCircle size={16} />
                                {approvingId === user.id
                                  ? "Approving..."
                                  : !verified
                                  ? "Email Not Verified"
                                  : "Approve"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {statsError && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm"
            >
              {statsError}
            </p>
          )}

          {/* REAL DATABASE STATISTICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-sm text-slate-500">
                        {card.label}
                      </p>

                      <h2 className="text-3xl font-bold text-slate-800 mt-2">
                        {loadingStats ? "..." : card.value}
                      </h2>

                      <p
                        className={`text-sm mt-2 ${card.descriptionTone}`}
                      >
                        {card.description}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg ${card.tone}`}>
                      <Icon size={23} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
