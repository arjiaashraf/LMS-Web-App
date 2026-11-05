import { GraduationCap, BookOpen, LogOut, User, Settings, FileText, Video, ClipboardCheck, ClipboardList, Users, CalendarClock, RefreshCw, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import InstructorCourses from "./InstructorCourses";
import InstructorAssignments from "./InstructorAssignments";
import InstructorOnlineClasses from "./InstructorOnlineClasses";
import InstructorAttendance from "./InstructorAttendance";
import InstructorExams from "./InstructorExams";

function InstructorDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "courses" | "assignments" | "classes" | "attendance" | "exams">("dashboard");
  const [teacherId, setTeacherId] = useState<number | null>(null);
  type DashboardData = {
    assignedCoursesCount: number;
    activeStudentsCount: number;
    pendingAssignmentReviewsCount: number;
    totalExamsCount: number;
    upcomingClasses: Array<{
      id: number; course_title: string; session_date: string;
      start_time: string; status: string;
    }>;
    recentSubmissions: Array<{
      submission_id: number; student_name: string;
      assignment_title: string; course_title: string;
      status: string; submitted_at: string | null;
    }>;
  };

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    qualification: "",
    specialisation: "",
    department: "",
    profile_photo: ""
  });

 useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }
    try {
      const userData = JSON.parse(userStr);
      if (userData.id) {
        // Clean ID in case it contains malformed data like "11:1"
        const rawId = String(userData.id).split(":")[0];
        const cleanId = Number(rawId);
        
        setTeacherId(cleanId);
        fetchTeacherProfile(cleanId);
      }
    } catch (e) {
      console.error("Error parsing user session", e);
    }
  }, [navigate]);

  // Refresh on opening Dashboard and once every minute while viewing it.
  useEffect(() => {
    if (!teacherId || activeTab !== "dashboard") return;
    let active = true;

    const load = async () => {
      try {
        if (active) setDashboardLoading(true);
        const response = await fetch(`http://localhost:5000/api/teacher/dashboard/${teacherId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load dashboard.");
        if (active) {
          setDashboard(data);
          setDashboardError("");
        }
      } catch (error) {
        if (active) setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard.");
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [teacherId, activeTab]);

  const fetchTeacherProfile = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teacher/${id}`);
      const data = await response.json();
      if (response.ok) {
        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          qualification: data.qualification || "",
          specialisation: data.specialisation || "",
          department: data.department || "",
          profile_photo: data.profile_photo || ""
        });
      }
    } catch (error) {
      console.error("Error fetching teacher profile:", error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, profile_photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;

    try {
      const response = await fetch(`http://localhost:5000/api/teacher/update-profile/${teacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
      } else {
        alert(data.message || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Server error while updating profile.");
    }
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (confirmLogout) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 bottom-0">
       
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


        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "dashboard" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <GraduationCap size={20} />
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("courses")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "courses" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <BookOpen size={20} />
            <span className="font-medium">My Courses</span>
          </button>

          <button
            onClick={() => setActiveTab("assignments")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "assignments" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FileText size={20} />
            <span className="font-medium">Assignments</span>
          </button>

          <button
            onClick={() => setActiveTab("classes")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "classes" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Video size={20} />
            <span className="font-medium">Online Classes</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "attendance" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ClipboardCheck size={20} />
            <span className="font-medium">Attendance</span>
          </button>

          {/* EXAMS & RESULTS TAB */}
          <button
            onClick={() => setActiveTab("exams")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "exams" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ClipboardList size={20} />
            <span className="font-medium">Exams & Results</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              activeTab === "profile" ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Settings size={20} />
            <span className="font-medium">My Profile</span>
          </button>
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
      <div className="flex-1 md:ml-64">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6">
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === "dashboard" && "Instructor Dashboard"}
            {activeTab === "profile" && "Teacher Profile Management"}
            {activeTab === "courses" && "Course Management"}
            {activeTab === "assignments" && "Assignment Management"}
            {activeTab === "classes" && "Online Classes & Schedule"}
            {activeTab === "attendance" && "Attendance Management"}
            {activeTab === "exams" && "Exams & Results Management"}
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{profile.name || "Instructor"}</p>
              <p className="text-xs text-slate-500">{profile.department || "Instructor"}</p>
            </div>
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden border">
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-7">
                <h2 className="text-2xl font-bold">Welcome, {profile.name || "Instructor"}! 👋</h2>
                <p className="text-purple-100 mt-2">Your teaching overview, based on real LMS data.</p>
              </div>

              {dashboardError && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                  {dashboardError} — Check that the instructor dashboard API is running.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {[
                  { label: "Assigned Courses", value: dashboard?.assignedCoursesCount, icon: BookOpen, target: "courses" as const, tone: "text-blue-600 bg-blue-50" },
                  { label: "Active Students", value: dashboard?.activeStudentsCount, icon: Users, target: "courses" as const, tone: "text-green-600 bg-green-50" },
                  { label: "Submissions to Review", value: dashboard?.pendingAssignmentReviewsCount, icon: ClipboardCheck, target: "assignments" as const, tone: "text-orange-600 bg-orange-50" },
                  { label: "Created Exams", value: dashboard?.totalExamsCount, icon: ClipboardList, target: "exams" as const, tone: "text-purple-600 bg-purple-50" },
                ].map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button key={item.label} type="button" onClick={() => setActiveTab(item.target)}
                      className="bg-white rounded-xl border p-5 shadow-sm text-left hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500">{item.label}</p>
                          <p className="text-3xl font-bold text-slate-800 mt-2">
                            {dashboardLoading && !dashboard ? "…" : item.value ?? "—"}
                          </p>
                        </div>
                        <div className={`p-3 rounded-xl ${item.tone}`}><IconComponent size={24} /></div>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-600">
                        View Details <ChevronRight size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="flex justify-between items-center px-6 py-5 border-b">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">Upcoming Online Classes</h3>
                      <p className="text-sm text-slate-500">Scheduled classes from your batches</p>
                    </div>
                    <button className="text-purple-600 text-sm font-medium" onClick={() => setActiveTab("classes")}>View All</button>
                  </div>
                  {!dashboard?.upcomingClasses?.length ? (
                    <p className="p-6 text-sm text-slate-500">{dashboardLoading && !dashboard ? "Loading classes..." : "No upcoming classes."}</p>
                  ) : (
                    <div className="divide-y">
                      {dashboard.upcomingClasses.map((c) => (
                        <div key={c.id} className="flex items-start gap-3 p-5">
                          <div className="bg-purple-50 text-purple-600 rounded-lg p-2"><CalendarClock size={20} /></div>
                          <div>
                            <p className="font-semibold text-slate-800">{c.course_title}</p>
                            <p className="text-sm text-slate-500">{c.session_date} · {String(c.start_time).slice(0, 5)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="flex justify-between items-center px-6 py-5 border-b">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">Recent Assignment Submissions</h3>
                      <p className="text-sm text-slate-500">Latest submissions from your students</p>
                    </div>
                    <button className="text-purple-600 text-sm font-medium" onClick={() => setActiveTab("assignments")}>View All</button>
                  </div>
                  {!dashboard?.recentSubmissions?.length ? (
                    <p className="p-6 text-sm text-slate-500">{dashboardLoading && !dashboard ? "Loading submissions..." : "No submissions yet."}</p>
                  ) : (
                    <div className="divide-y">
                      {dashboard.recentSubmissions.map((sub) => (
                        <div key={sub.submission_id} className="flex justify-between items-start gap-4 p-5">
                          <div>
                            <p className="font-semibold text-slate-800">{sub.assignment_title}</p>
                            <p className="text-sm text-slate-500">{sub.student_name} · {sub.course_title}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sub.status === "Graded" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {sub.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
              {dashboardLoading && dashboard && <p className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw size={13} /> Refreshing dashboard…</p>}
            </div>
          )}

          {activeTab === "courses" && (
            <InstructorCourses teacherId={teacherId} teacherName={profile.name} />
          )}

          {activeTab === "assignments" && (
            <InstructorAssignments teacherId={teacherId} />
          )}

          {activeTab === "classes" && (
            <InstructorOnlineClasses onBack={() => setActiveTab("dashboard")} />
          )}

          {activeTab === "attendance" && (
            <InstructorAttendance onBack={() => setActiveTab("dashboard")} />
          )}

          {activeTab === "exams" && (
            <InstructorExams onBack={() => setActiveTab("dashboard")} />
          )}

          {activeTab === "profile" && (
            <div className="bg-white rounded-xl shadow-sm p-6 border max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Update Profile Details</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden border-2 border-purple-600 mb-3 flex items-center justify-center">
                    {profile.profile_photo ? (
                      <img src={profile.profile_photo} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-slate-400" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-purple-50 text-purple-700 px-4 py-2 rounded-lg border border-purple-200 text-sm font-medium hover:bg-purple-100 transition flex items-center gap-2">
                    Upload Profile Photo
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name (Read-only)</label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email (Read-only)</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={profile.qualification}
                    onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                    placeholder="e.g. M.Sc Computer Science, Ph.D"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specialisation</label>
                  <input
                    type="text"
                    value={profile.specialisation}
                    onChange={(e) => setProfile({ ...profile, specialisation: e.target.value })}
                    placeholder="e.g. Artificial Intelligence, Web Development"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    placeholder="e.g. Computer Science & IT"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition shadow-sm"
                >
                  Save Profile Changes
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