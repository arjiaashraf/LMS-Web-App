
import {
  GraduationCap, BookOpen, LogOut, User, Settings,
  FileText, Video, ClipboardCheck, ClipboardList,
  Users, CalendarClock, RefreshCw, ChevronRight
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

import InstructorCourses from "./InstructorCourses";
import InstructorAssignments from "./InstructorAssignments";
import InstructorOnlineClasses from "./InstructorOnlineClasses";
import InstructorAttendance from "./InstructorAttendance";
import InstructorExams from "./InstructorExams";

import { apiFetch } from "../services/api";

type Tab =
  | "dashboard"
  | "profile"
  | "courses"
  | "assignments"
  | "classes"
  | "attendance"
  | "exams";

type DashboardData = {
  assignedCoursesCount: number;
  activeStudentsCount: number;
  pendingAssignmentReviewsCount: number;
  totalExamsCount: number;
  upcomingClasses: Array<{
    id: number;
    course_title: string;
    session_date: string;
    start_time: string;
    status: string;
  }>;
  recentSubmissions: Array<{
    submission_id: number;
    student_name: string;
    assignment_title: string;
    course_title: string;
    status: string;
    submitted_at: string | null;
  }>;
};

type TeacherProfile = {
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialisation: string;
  department: string;
  profile_photo: string;
};

const initialProfile: TeacherProfile = {
  name: "",
  email: "",
  phone: "",
  qualification: "",
  specialisation: "",
  department: "",
  profile_photo: ""
};

function InstructorDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<Tab>("dashboard");

  const [teacherId, setTeacherId] =
    useState<number | null>(null);

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [dashboardLoading, setDashboardLoading] =
    useState(false);

  const [dashboardError, setDashboardError] =
    useState("");

  const [profile, setProfile] =
    useState<TeacherProfile>(initialProfile);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  /* ============================================
     AUTHENTICATION + TEACHER PROFILE
     ============================================ */

  const fetchTeacherProfile = useCallback(
    async (id: number) => {
      try {
        const response = await apiFetch(
          `/api/teacher/${id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load teacher profile."
          );
        }

        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          qualification: data.qualification || "",
          specialisation: data.specialisation || "",
          department: data.department || "",
          profile_photo: data.profile_photo || ""
        });
      } catch (error) {
        console.error("Teacher profile error:", error);
      }
    },
    []
  );

  useEffect(() => {
    try {
      const userData = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      const id = Number(
        String(userData.id ?? "").split(":")[0]
      );

      if (
        userData.role !== "instructor" ||
        !userData.token ||
        !Number.isSafeInteger(id) ||
        id <= 0
      ) {
        logout();
        return;
      }

      setTeacherId(id);
      void fetchTeacherProfile(id);
    } catch {
      logout();
    }
  }, [fetchTeacherProfile, logout]);

  /* ============================================
     REAL INSTRUCTOR DASHBOARD
     ============================================ */

  useEffect(() => {
    if (!teacherId || activeTab !== "dashboard") return;

    let active = true;

    const load = async () => {
      try {
        if (active) setDashboardLoading(true);

        const response = await apiFetch(
          `/api/teacher/dashboard/${teacherId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load dashboard."
          );
        }

        if (active) {
          setDashboard(data);
          setDashboardError("");
        }
      } catch (error) {
        if (active) {
          setDashboardError(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard."
          );
        }
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [teacherId, activeTab]);

  /* ============================================
     PROFILE IMAGE
     ============================================ */

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setProfile((prev) => ({
        ...prev,
        profile_photo: String(reader.result || "")
      }));
    };

    reader.readAsDataURL(file);
  };

  /* ============================================
     UPDATE INSTRUCTOR PROFILE
     ============================================ */

  const handleProfileUpdate = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!teacherId || savingProfile) return;

    setSavingProfile(true);

    try {
      const response = await apiFetch(
        `/api/teacher/update-profile/${teacherId}`,
        {
          method: "PUT",
          body: JSON.stringify(profile)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update profile."
        );
      }

      alert(data.message || "Profile updated successfully!");

      await fetchTeacherProfile(teacherId);
    } catch (error) {
      console.error("Profile update error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Server error while updating profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  /* ============================================
     SIDEBAR ITEMS
     ============================================ */

  const sidebarItems: Array<{
    tab: Tab;
    name: string;
    icon: typeof BookOpen;
  }> = [
    {
      tab: "dashboard",
      name: "Dashboard",
      icon: GraduationCap
    },
    {
      tab: "courses",
      name: "My Courses",
      icon: BookOpen
    },
    {
      tab: "assignments",
      name: "Assignments",
      icon: FileText
    },
    {
      tab: "classes",
      name: "Online Classes",
      icon: Video
    },
    {
      tab: "attendance",
      name: "Attendance",
      icon: ClipboardCheck
    },
    {
      tab: "exams",
      name: "Exams & Results",
      icon: ClipboardList
    },
    {
      tab: "profile",
      name: "My Profile",
      icon: Settings
    }
  ];

  const headings: Record<Tab, string> = {
    dashboard: "Instructor Dashboard",
    profile: "Teacher Profile Management",
    courses: "Course Management",
    assignments: "Assignment Management",
    classes: "Online Classes & Schedule",
    attendance: "Attendance Management",
    exams: "Exams & Results Management"
  };

  const summaryCards = [
    {
      label: "Assigned Courses",
      value: dashboard?.assignedCoursesCount,
      icon: BookOpen,
      target: "courses" as Tab,
      tone: "text-blue-600 bg-blue-50"
    },
    {
      label: "Active Students",
      value: dashboard?.activeStudentsCount,
      icon: Users,
      target: "courses" as Tab,
      tone: "text-green-600 bg-green-50"
    },
    {
      label: "Submissions to Review",
      value: dashboard?.pendingAssignmentReviewsCount,
      icon: ClipboardCheck,
      target: "assignments" as Tab,
      tone: "text-orange-600 bg-orange-50"
    },
    {
      label: "Created Exams",
      value: dashboard?.totalExamsCount,
      icon: ClipboardList,
      target: "exams" as Tab,
      tone: "text-purple-600 bg-purple-50"
    }
  ];

  const profileFields: Array<{
    label: string;
    key: "phone" | "qualification" |
         "specialisation" | "department";
    placeholder: string;
  }> = [
    {
      label: "Phone Number",
      key: "phone",
      placeholder: "Enter phone number"
    },
    {
      label: "Qualification",
      key: "qualification",
      placeholder: "e.g. M.Sc Computer Science, Ph.D"
    },
    {
      label: "Specialisation",
      key: "specialisation",
      placeholder: "e.g. Artificial Intelligence, Web Development"
    },
    {
      label: "Department",
      key: "department",
      placeholder: "e.g. Computer Science & IT"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 bottom-0">

        {/* CAMPUS 95 LOGO */}
        <div className="h-24 shrink-0 flex items-center justify-center px-5 border-b border-slate-700">
          <div className="w-full max-w-[240px] h-[80px] bg-white rounded-xl flex items-center justify-center px-3 shadow-sm">
            <img
              src="/campus95-logo.png"
              alt="Campus 95 - Success Ahead"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.tab;

            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  selected
                    ? "bg-purple-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">
                  {item.name}
                </span>
              </button>
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

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0 md:ml-64">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            {headings[activeTab]}
          </h1>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {profile.name || "Instructor"}
              </p>
              <p className="text-xs text-slate-500">
                {profile.department || "Instructor"}
              </p>
            </div>

            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden border">
              {profile.profile_photo ? (
                <img
                  src={profile.profile_photo}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={20} />
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-7">
                <h2 className="text-2xl font-bold">
                  Welcome, {profile.name || "Instructor"}! 👋
                </h2>
                <p className="text-purple-100 mt-2">
                  Your teaching overview, based on real LMS data.
                </p>
              </div>

              {dashboardError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl"
                >
                  {dashboardError} — Check that the instructor
                  dashboard API is running.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {summaryCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveTab(item.target)}
                      className="bg-white rounded-xl border p-5 shadow-sm text-left hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500">
                            {item.label}
                          </p>
                          <p className="text-3xl font-bold text-slate-800 mt-2">
                            {dashboardLoading && !dashboard
                              ? "…"
                              : item.value ?? "—"}
                          </p>
                        </div>

                        <div className={`p-3 rounded-xl ${item.tone}`}>
                          <Icon size={24} />
                        </div>
                      </div>

                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-600">
                        View Details
                        <ChevronRight size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* UPCOMING CLASSES */}
                <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="flex justify-between items-center px-6 py-5 border-b">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        Upcoming Online Classes
                      </h3>
                      <p className="text-sm text-slate-500">
                        Scheduled classes from your batches
                      </p>
                    </div>

                    <button
                      className="text-purple-600 text-sm font-medium"
                      onClick={() => setActiveTab("classes")}
                    >
                      View All
                    </button>
                  </div>

                  {!dashboard?.upcomingClasses?.length ? (
                    <p className="p-6 text-sm text-slate-500">
                      {dashboardLoading && !dashboard
                        ? "Loading classes..."
                        : "No upcoming classes."}
                    </p>
                  ) : (
                    <div className="divide-y">
                      {dashboard.upcomingClasses.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-5"
                        >
                          <div className="bg-purple-50 text-purple-600 rounded-lg p-2">
                            <CalendarClock size={20} />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.course_title}
                            </p>

                            <p className="text-sm text-slate-500">
                              {item.session_date} ·{" "}
                              {String(item.start_time).slice(0, 5)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* RECENT SUBMISSIONS */}
                <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="flex justify-between items-center px-6 py-5 border-b">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        Recent Assignment Submissions
                      </h3>
                      <p className="text-sm text-slate-500">
                        Latest submissions from your students
                      </p>
                    </div>

                    <button
                      className="text-purple-600 text-sm font-medium"
                      onClick={() => setActiveTab("assignments")}
                    >
                      View All
                    </button>
                  </div>

                  {!dashboard?.recentSubmissions?.length ? (
                    <p className="p-6 text-sm text-slate-500">
                      {dashboardLoading && !dashboard
                        ? "Loading submissions..."
                        : "No submissions yet."}
                    </p>
                  ) : (
                    <div className="divide-y">
                      {dashboard.recentSubmissions.map((item) => (
                        <div
                          key={item.submission_id}
                          className="flex justify-between items-start gap-4 p-5"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.assignment_title}
                            </p>
                            <p className="text-sm text-slate-500">
                              {item.student_name} ·{" "}
                              {item.course_title}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              item.status === "Graded"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {dashboardLoading && dashboard && (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw size={13} />
                  Refreshing dashboard…
                </p>
              )}
            </div>
          )}

          {/* EXISTING INSTRUCTOR MODULES */}
          {activeTab === "courses" && (
            <InstructorCourses
              teacherId={teacherId}
              teacherName={profile.name}
            />
          )}

          {activeTab === "assignments" && (
            <InstructorAssignments teacherId={teacherId} />
          )}

          {activeTab === "classes" && (
            <InstructorOnlineClasses
              onBack={() => setActiveTab("dashboard")}
            />
          )}

          {activeTab === "attendance" && (
            <InstructorAttendance
              onBack={() => setActiveTab("dashboard")}
            />
          )}

          {activeTab === "exams" && (
            <InstructorExams
              onBack={() => setActiveTab("dashboard")}
            />
          )}

          {/* PROFILE MANAGEMENT */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-xl shadow-sm p-6 border max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                Update Profile Details
              </h2>

              <form
                onSubmit={handleProfileUpdate}
                className="space-y-4"
              >
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden border-2 border-purple-600 mb-3 flex items-center justify-center">
                    {profile.profile_photo ? (
                      <img
                        src={profile.profile_photo}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={40} className="text-slate-400" />
                    )}
                  </div>

                  <label className="cursor-pointer bg-purple-50 text-purple-700 px-4 py-2 rounded-lg border border-purple-200 text-sm font-medium hover:bg-purple-100 transition flex items-center gap-2">
                    Upload Profile Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name (Read-only)
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email (Read-only)
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {profileFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {field.label}
                    </label>

                    <input
                      type="text"
                      value={profile[field.key]}
                      onChange={(event) => {
                        setProfile((prev) => ({
                          ...prev,
                          [field.key]: event.target.value
                        }));
                      }}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {savingProfile
                    ? "Saving..."
                    : "Save Profile Changes"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default InstructorDashboard;
