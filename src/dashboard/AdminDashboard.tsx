import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  FileText,
  Settings,
  LogOut,
  Menu,
  Video,
  BarChart3,
  X,
  CheckCircle,
}  from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<Array<{ id: number; name: string; email: string; role: string; status: string }>>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");
  
  // Stats state for real database counts
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    pendingUsers: 0,
    activeCourses: 0
  });

  // Session Protection: Check if admin is logged in
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      const session = JSON.parse(user);
      if (session.role !== "admin") navigate("/login");
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  // Fetch Pending Users from Backend
  const fetchPendingUsers = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/pending-users");
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setPendingUsers(data);
      }
    } catch (error) {
      console.error("Error fetching pending users:", error);
    }
  };

  // Fetch Dashboard Stats from Backend
  const fetchStats = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/stats");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load statistics");
      setStats({
        totalStudents: Number(data.totalStudents ?? 0),
        totalTeachers: Number(data.totalTeachers ?? 0),
        pendingUsers: Number(data.pendingUsers ?? 0),
        activeCourses: Number(data.activeCourses ?? 0),
      });
      setStatsError("");
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStatsError("Unable to refresh dashboard statistics. Please check the server.");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void fetchPendingUsers();
    void fetchStats();
    const interval = window.setInterval(() => {
      void fetchPendingUsers();
      void fetchStats();
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  // Approve User Function
  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/approve-user/${id}`, {
        method: "PUT",
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        // Refresh both pending list and stats counts
        fetchPendingUsers();
        fetchStats();
      } else {
        alert("Failed to approve user.");
      }
    } catch (error) {
      console.error("Error approving user:", error);
    }
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
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (confirmLogout) {
      localStorage.removeItem("user"); // Clear session
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 bottom-0">
        
{/* CAMPUS 95 BRANDING */}

<div className="h-24 shrink-0 flex items-center justify-center px-5 border-b border-slate-700">
  <div className="w-full max-w-[210px] h-[70px] bg-white rounded-xl flex items-center justify-center px-3 shadow-sm">
    <img
      src="/campus95-logo.png"
      alt="Campus 95 - Success Ahead"
      className="w-full h-full object-contain"
    />
  </div>
</div>


        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenu(false)} />
          <aside className="relative w-72 h-full bg-slate-900 text-white flex flex-col">
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-700">
              <div className="flex items-center">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <GraduationCap size={25} />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold">LMS</h1>
                  <p className="text-xs text-slate-400">Management System</p>
                </div>
              </div>
              <button onClick={() => setMobileMenu(false)} className="text-slate-300 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenu(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
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
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 md:ml-64">
        {/* TOP HEADER */}
        <header className="h-20 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome back, Administrator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">Administrator</p>
              <p className="text-xs text-slate-500">Super Admin</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <main className="p-6">
          
          {/* PENDING APPROVALS SECTION */}
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-amber-200">
            <div className="p-6 border-b bg-amber-50 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-amber-900">Pending Account Approvals</h2>
                <p className="text-sm text-amber-700">New students and teachers waiting for approval</p>
              </div>
              <span className="bg-amber-200 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                {pendingUsers.length} Pending
              </span>
            </div>

            <div className="p-6">
              {pendingUsers.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No pending accounts right now.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-slate-600 text-sm">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Email</th>
                        <th className="pb-3 font-semibold">Role</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {pendingUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="py-3 font-medium">{user.name}</td>
                          <td className="py-3 text-slate-500">{user.email}</td>
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
                              onClick={() => handleApprove(user.id)}
                              className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition shadow-sm"
                            >
                              <CheckCircle size={16} /> Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {statsError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{statsError}</p>
          )}

          {/* STATISTICS (Connected to Database Real Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500">Total Students</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-2">{loadingStats ? "..." : stats.totalStudents}</h2>
                  <p className="text-sm text-green-600 mt-2">Active database count</p>
                </div>
                <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                  <Users size={23} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500">Teachers</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-2">{loadingStats ? "..." : stats.totalTeachers}</h2>
                  <p className="text-sm text-green-600 mt-2">Active database count</p>
                </div>
                <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                  <GraduationCap size={23} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500">Active Courses</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-2">{loadingStats ? "..." : stats.activeCourses}</h2>
                  <p className="text-sm text-blue-600 mt-2">Published courses in database</p>
                </div>
                <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                  <BookOpen size={23} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500">Pending Approvals</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-2">{loadingStats ? "..." : stats.pendingUsers}</h2>
                  <p className="text-sm text-orange-600 mt-2">Needs attention</p>
                </div>
                <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                  <ClipboardList size={23} />
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;