
import {
  BookOpen, ClipboardList, CalendarCheck, Award,
  Clock3, User, Settings, LogOut, GraduationCap,
  ChevronRight, Video, Bell, Menu, X
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate
} from "react-router-dom";

import {
  useState,
  useEffect
} from "react";

import { apiFetch } from "../services/api";

type AssignmentPreview = {
  id: number;
  title: string;
  course_title: string;
  due_date: string;
};

type ExamPreview = {
  id: number;
  title: string;
  course_title: string;
  exam_date: string;
  exam_start_time: string;
};

type DashboardData = {
  name: string;
  email: string;
  enrolledCoursesCount: number;
  pendingAssignmentsCount: number;
  attendancePercentage: string | null;
  upcomingAssignments: AssignmentPreview[];
  upcomingExams: ExamPreview[];
};

const initialDashboard: DashboardData = {
  name: "Student",
  email: "",
  enrolledCoursesCount: 0,
  pendingAssignmentsCount: 0,
  attendancePercentage: null,
  upcomingAssignments: [],
  upcomingExams: []
};

const studentNavigation = [
  {
    name: "Dashboard",
    path: "/student-dashboard",
    icon: GraduationCap
  },
  {
    name: "My Courses",
    path: "/student-courses",
    icon: BookOpen
  },
  {
    name: "Assignments",
    path: "/student-assignments",
    icon: ClipboardList
  },
  {
    name: "Online Classes",
    path: "/student-classes",
    icon: Video
  },
  {
    name: "Attendance",
    path: "/student-attendance",
    icon: CalendarCheck
  },
  {
    name: "Results",
    path: "/student-results",
    icon: Award
  },
  {
    name: "Examinations",
    path: "/student-announcements",
    icon: Bell
  },
  {
    name: "Profile",
    path: "/student-profile",
    icon: User
  },
  {
    name: "Settings",
    path: "/student-settings",
    icon: Settings
  }
];

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return "Not scheduled";
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PK",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials.slice(0, 2) || "S";
}

function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenu, setMobileMenu] = useState(false);

  const [studentData, setStudentData] =
    useState<DashboardData>(initialDashboard);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ============================================
     STUDENT AUTHENTICATION + DASHBOARD DATA
     ============================================ */

  useEffect(() => {
    let studentId = 0;

    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      studentId = Number(user.id);

      if (
        user.role !== "student" ||
        !user.token ||
        !Number.isSafeInteger(studentId) ||
        studentId <= 0
      ) {
        navigate("/login", { replace: true });
        return;
      }
    } catch {
      navigate("/login", { replace: true });
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadDashboard = async () => {
      try {
        const response = await apiFetch(
          `/api/student/dashboard/${studentId}`,
          {
            signal: controller.signal
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load student dashboard."
          );
        }

        if (active) {
          setStudentData({
            name: data.name || "Student",
            email: data.email || "",
            enrolledCoursesCount: Number(
              data.enrolledCoursesCount ?? 0
            ),
            pendingAssignmentsCount: Number(
              data.pendingAssignmentsCount ?? 0
            ),
            attendancePercentage:
              data.attendancePercentage ?? null,
            upcomingAssignments: Array.isArray(
              data.upcomingAssignments
            )
              ? data.upcomingAssignments
              : [],
            upcomingExams: Array.isArray(
              data.upcomingExams
            )
              ? data.upcomingExams
              : []
          });

          setError("");
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return;

        console.error("Student dashboard error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Dashboard unavailable."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 60000);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [navigate]);

  /* ============================================
     LOGOUT
     ============================================ */

  const handleLogout = () => {
    if (
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  };

  /* ============================================
     SIDEBAR CONTENT
     ============================================ */

  const renderNavigation = (mobile = false) => (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {studentNavigation.map((item) => {
        const Icon = item.icon;
        const selected = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => mobile && setMobileMenu(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              selected
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

  const renderBranding = () => (
    <div className="h-24 shrink-0 flex items-center justify-center px-5 border-b border-slate-700">
      <div className="w-full max-w-[240px] h-[80px] bg-white rounded-xl flex items-center justify-center px-3 shadow-sm">
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
      title: "Enrolled Courses",
      value: studentData.enrolledCoursesCount,
      icon: BookOpen,
      link: "/student-courses",
      linkText: "View Courses",
      color: "text-blue-600",
      iconBackground: "bg-blue-100"
    },
    {
      title: "Pending Assignments",
      value: studentData.pendingAssignmentsCount,
      icon: ClipboardList,
      link: "/student-assignments",
      linkText: "View Assignments",
      color: "text-orange-600",
      iconBackground: "bg-orange-100"
    },
    {
      title: "Attendance",
      value: studentData.attendancePercentage ?? "N/A",
      icon: CalendarCheck,
      link: "/student-attendance",
      linkText: "View Attendance",
      color: "text-green-600",
      iconBackground: "bg-green-100"
    },
    {
      title: "Upcoming Exams",
      value: studentData.upcomingExams.length,
      icon: Award,
      link: "/student-announcements",
      linkText: "View Examinations",
      color: "text-purple-600",
      iconBackground: "bg-purple-100"
    }
  ];

  /* ============================================
     MAIN DASHBOARD UI
     ============================================ */

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 bottom-0">
        {renderBranding()}
        {renderNavigation()}

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition"
          >
            <LogOut size={20} />
            Logout
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
              {renderBranding()}

              <button
                onClick={() => setMobileMenu(false)}
                aria-label="Close menu"
                className="absolute top-2 right-2 text-slate-300 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            {renderNavigation(true)}

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

        {/* HEADER */}
        <header className="bg-white border-b h-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>

            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                Student Dashboard
              </h1>
              <p className="text-sm text-slate-500 hidden sm:block">
                Welcome back! Here's your academic overview.
              </p>
            </div>
          </div>

          <Link to="/student-profile">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="hidden sm:block text-right">
                <p className="font-semibold text-slate-700">
                  {studentData.name}
                </p>
                <p className="text-xs text-slate-500">
                  Student
                </p>
              </div>

              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                {getInitials(studentData.name)}
              </div>
            </div>
          </Link>
        </header>

        {/* CONTENT */}
        <main className="p-6 max-w-7xl mx-auto">

          {/* WELCOME BANNER */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-7 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-blue-100 text-sm">
                  Welcome back,
                </p>

                <h2 className="text-3xl font-bold mt-1">
                  {studentData.name} 👋
                </h2>

                <p className="text-blue-100 mt-2">
                  Active Student Portal
                </p>
              </div>

              <Link
                to="/student-profile"
                className="bg-white text-blue-600 px-5 py-3 rounded-lg font-semibold hover:bg-blue-50 text-center"
              >
                View Profile
              </Link>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm"
            >
              Could not refresh dashboard: {error}
            </div>
          )}

          {/* REAL DATABASE STATISTICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  to={card.link}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition block"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">
                        {card.title}
                      </p>

                      <h2
                        className={`text-3xl font-bold mt-2 ${card.color}`}
                      >
                        {loading ? "…" : card.value}
                      </h2>
                    </div>

                    <div
                      className={`${card.iconBackground} ${card.color} p-3 rounded-lg`}
                    >
                      <Icon size={25} />
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1 text-sm mt-4 font-medium ${card.color}`}
                  >
                    {card.linkText}
                    <ChevronRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ASSIGNMENTS + EXAMS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* UPCOMING ASSIGNMENTS */}
            <section className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Upcoming Assignments
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Your upcoming academic tasks
                  </p>
                </div>

                <Link
                  to="/student-assignments"
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View All
                </Link>
              </div>

              <div className="divide-y">
                {studentData.upcomingAssignments.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    {loading
                      ? "Loading assignments..."
                      : "No upcoming assignments."}
                  </p>
                ) : (
                  studentData.upcomingAssignments.map(
                    (assignment) => (
                      <Link
                        key={assignment.id}
                        to="/student-assignments"
                        className="p-5 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                            <ClipboardList size={20} />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-700">
                              {assignment.title}
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                              {assignment.course_title} · Due:{" "}
                              {formatDate(assignment.due_date)}
                            </p>
                          </div>
                        </div>

                        <ChevronRight
                          size={20}
                          className="text-slate-400"
                        />
                      </Link>
                    )
                  )
                )}
              </div>
            </section>

            {/* UPCOMING EXAMS */}
            <section className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Upcoming Exams
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Published exams in your enrolled batches
                  </p>
                </div>

                <Link
                  to="/student-announcements"
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View All
                </Link>
              </div>

              <div className="divide-y">
                {studentData.upcomingExams.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    {loading
                      ? "Loading exams..."
                      : "No upcoming exams."}
                  </p>
                ) : (
                  studentData.upcomingExams.map((exam) => (
                    <Link
                      key={exam.id}
                      to="/student-announcements"
                      className="p-5 flex items-start gap-4 hover:bg-slate-50"
                    >
                      <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
                        <Clock3 size={20} />
                      </div>

                      <div>
                        <p className="font-semibold text-slate-700">
                          {exam.title}
                        </p>

                        <p className="text-sm text-slate-500 mt-1">
                          {exam.course_title}
                        </p>

                        <p className="text-xs text-slate-400 mt-2">
                          {formatDate(exam.exam_date)} ·{" "}
                          {String(exam.exam_start_time || "").slice(0, 5)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;
