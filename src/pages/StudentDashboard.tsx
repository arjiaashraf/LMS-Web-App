import {
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Award,
  Bell,
  Clock3,
  User,
  Settings,
  LogOut,
  GraduationCap,
  ChevronRight,
  Video,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

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
  cgpa: string | null;
  upcomingAssignments: AssignmentPreview[];
  upcomingExams: ExamPreview[];
};

const emptyDashboard: DashboardData = {
  name: "Student",
  email: "",
  enrolledCoursesCount: 0,
  pendingAssignmentsCount: 0,
  attendancePercentage: null,
  cgpa: null,
  upcomingAssignments: [],
  upcomingExams: [],
};

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Not scheduled";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PK", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function StudentDashboard() {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let studentId = 0;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role !== "student" || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
        navigate("/login", { replace: true });
        return;
      }
      studentId = Number(user.id);
    } catch {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/student/dashboard/${studentId}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load dashboard");
        if (active) {
          setStudentData(data);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Dashboard unavailable");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    // Refresh data while dashboard is open. Do not reset content between refreshes.
    const interval = window.setInterval(() => { void load(); }, 60000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen hidden md:flex flex-col">
        {/* LOGO */}
        
{/* CAMPUS 95 BRANDING */}

<div className="h-24 shrink-0 flex items-center justify-center px-5 border-b border-slate-700">
  <div className="w-full max-w-[240px] h-[80px] bg-white rounded-xl flex items-center justify-center px-3 shadow-sm">
    <img
      src="/campus95-logo.png"
      alt="Campus 95 - Success Ahead"
      className="w-full h-full object-contain"
    />
  </div>
</div>


        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/student-dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white"
          >
            <GraduationCap size={20} />
            Dashboard
          </Link>

          <Link
            to="/student-courses"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <BookOpen size={20} />
            My Courses
          </Link>

          <Link
            to="/student-assignments"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ClipboardList size={20} />
            Assignments
          </Link>

          {/* ONLINE CLASSES LINK ADDED HERE */}
          <Link
            to="/student-classes"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Video size={20} />
            Online Classes
          </Link>

          <Link
            to="/student-attendance"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <CalendarCheck size={20} />
            Attendance
          </Link>

          <Link
            to="/student-results"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Award size={20} />
            Results
          </Link>

          <Link
            to="/student-announcements"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Bell size={20} />
            Announcements
          </Link>

          <div className="pt-5 pb-2 px-4">
            <p className="text-xs uppercase text-slate-500 font-semibold">Account</p>
          </div>

          <Link
            to="/student-profile"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <User size={20} />
            Profile
          </Link>

          <Link
            to="/student-settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        {/* LOGOUT */}
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

      {/* MAIN AREA */}
      <div className="flex-1 min-w-0">
        {/* HEADER */}
        <header className="bg-white border-b h-20 flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Student Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back! Here's your academic overview.</p>
          </div>

          <Link to="/student-profile">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="hidden sm:block text-right">
                <p className="font-semibold text-slate-700">{studentData.name}</p>
                <p className="text-xs text-slate-500">Student</p>
              </div>
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                {getInitials(studentData.name)}
              </div>
            </div>
          </Link>
        </header>

        {/* CONTENT */}
        <main className="p-6 max-w-7xl mx-auto">
          {/* WELCOME */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-7 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-blue-100 text-sm">Welcome back,</p>
                <h2 className="text-3xl font-bold mt-1">{studentData.name} 👋</h2>
                <p className="text-blue-100 mt-2">Active Student Portal</p>
              </div>
              <Link
                to="/student-profile"
                className="bg-white text-blue-600 px-5 py-3 rounded-lg font-semibold hover:bg-blue-50 text-center"
              >
                View Profile
              </Link>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
              Could not refresh dashboard: {error}
            </div>
          )}

          {/* STAT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-7">
            {/* COURSES */}
            <Link
              to="/student-courses"
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Enrolled Courses</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-2">{loading ? "…" : studentData.enrolledCoursesCount}</h2>
                </div>
                <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                  <BookOpen size={25} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-blue-600 text-sm mt-4 font-medium">
                View Courses <ChevronRight size={16} />
              </div>
            </Link>

            {/* ASSIGNMENTS */}
            <Link
              to="/student-assignments"
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Pending Assignments</p>
                  <h2 className="text-3xl font-bold text-orange-600 mt-2">{loading ? "…" : studentData.pendingAssignmentsCount}</h2>
                </div>
                <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                  <ClipboardList size={25} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-orange-600 text-sm mt-4 font-medium">
                View Assignments <ChevronRight size={16} />
              </div>
            </Link>

            {/* ATTENDANCE */}
            <Link
              to="/student-attendance"
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Attendance</p>
                  <h2 className="text-3xl font-bold text-green-600 mt-2">{loading ? "…" : studentData.attendancePercentage ?? "N/A"}</h2>
                </div>
                <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                  <CalendarCheck size={25} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm mt-4 font-medium">
                View Attendance <ChevronRight size={16} />
              </div>
            </Link>
          </div>

          {/* LOWER SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* UPCOMING ASSIGNMENTS */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Upcoming Assignments</h2>
                  <p className="text-sm text-slate-500 mt-1">Your upcoming academic tasks</p>
                </div>
                <Link to="/student-assignments" className="text-blue-600 text-sm font-medium hover:underline">
                  View All
                </Link>
              </div>

              <div className="divide-y">
                {studentData.upcomingAssignments.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">No upcoming assignments.</p>
                ) : studentData.upcomingAssignments.map((assignment) => (
                  <Link key={assignment.id} to="/student-assignments" className="p-5 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                        <ClipboardList size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">{assignment.title}</p>
                        <p className="text-sm text-slate-500 mt-1">{assignment.course_title} · Due: {formatDate(assignment.due_date)}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>

            {/* UPCOMING EXAMS — based on published exam schedules */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Upcoming Exams</h2>
                  <p className="text-sm text-slate-500 mt-1">Published exams in your enrolled batches</p>
                </div>
                <Link to="/student-announcements" className="text-blue-600 text-sm font-medium hover:underline">
                  View All
                </Link>
              </div>

              <div className="divide-y">
                {studentData.upcomingExams.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">No upcoming exams.</p>
                ) : studentData.upcomingExams.map((exam) => (
                  <Link key={exam.id} to="/student-announcements" className="p-5 flex items-start gap-4 hover:bg-slate-50">
                    <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
                      <Clock3 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{exam.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{exam.course_title}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatDate(exam.exam_date)} · {exam.exam_start_time.slice(0, 5)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;