import { GraduationCap, BookOpen, LogOut, User, Settings, FileText, Video, ClipboardCheck, ClipboardList } from "lucide-react";
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
        <div className="h-20 flex items-center px-6 border-b border-slate-700">
          <div className="bg-purple-600 p-2 rounded-lg">
            <GraduationCap size={25} />
          </div>
          <div className="ml-3">
            <h1 className="text-xl font-bold">LMS</h1>
            <p className="text-xs text-slate-400">Instructor Portal</p>
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
            <div className="bg-white rounded-xl shadow-sm p-6 border">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome, {profile.name || "Instructor"}!</h2>
              <p className="text-slate-600 mb-4">
                Here you can manage your uploaded courses, track enrolled students, create assignments, manage online classes, record attendance, manage exams, and update your profile.
              </p>
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