import {
  User,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  CalendarDays,
  Edit,
  Upload,
  Save,
  X
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch as fetch } from "../services/api";

function StudentProfile() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Initial state ko empty rakha hai taake student khud apni details enter kare
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    qualification: "",
    department: "",
    program: "",
    semester: "",
    cgpa: "",
    profile_photo: "",
    address: ""
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
        setStudentId(userData.id);
        fetchStudentProfile(userData.id);
      }
    } catch (e) {
      console.error("Session error", e);
    }
  }, [navigate]);

  const fetchStudentProfile = async (id: number) => {
    try {
      const response = await fetch(`/api/student/${id}`);
      const data = await response.json();
      if (response.ok) {
        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          qualification: data.qualification || "",
          department: data.department || "",
          program: data.program || "",
          semester: data.semester || "",
          cgpa: data.cgpa || "",
          profile_photo: data.profile_photo || "",
          address: data.address || ""
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;

    try {
      const response = await fetch(`/api/student/update-profile/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setIsEditing(false);
        fetchStudentProfile(studentId);
      } else {
        alert(data.message || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Server error.");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link to="/student-dashboard" className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
            <p className="text-sm text-slate-500">View your personal and academic information</p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold overflow-hidden">
          {profile.profile_photo ? (
            <img src={profile.profile_photo} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            getInitials(profile.name || "Student")
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* PROFILE HEADER */}
        <div className="bg-blue-600 rounded-xl p-7 text-white mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-24 h-24 rounded-full bg-white text-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden border-2 border-white">
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                getInitials(profile.name || "Student")
              )}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold">{profile.name || "Student Name"}</h2>
              <p className="text-blue-100 mt-1">{profile.program || "Program Not Set"}</p>
              <p className="text-blue-200 text-sm mt-2">Student ID: STU-00{studentId}</p>
            </div>
          </div>
        </div>

        {/* EDIT FORM OR VIEW MODE */}
        {isEditing ? (
          <form onSubmit={handleUpdate} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800">Edit Profile & Academic Details</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center mb-4">
              <label className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-200 text-sm font-medium hover:bg-blue-100 transition flex items-center gap-2">
                <Upload size={16} /> Upload New Photo
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>

            {/* PERSONAL SECTION IN EDIT */}
            <div>
              <h3 className="text-md font-semibold text-slate-700 mb-3">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={profile.qualification}
                    onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Intermediate"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Islamabad, Pakistan"
                  />
                </div>
              </div>
            </div>

            {/* ACADEMIC SECTION IN EDIT */}
            <div className="pt-4 border-t">
              <h3 className="text-md font-semibold text-slate-700 mb-3">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Program</label>
                  <input
                    type="text"
                    value={profile.program}
                    onChange={(e) => setProfile({ ...profile, program: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. BS Software Engineering"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Semester</label>
                  <input
                    type="text"
                    value={profile.semester}
                    onChange={(e) => setProfile({ ...profile, semester: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 4th Semester"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Department</label>
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Current CGPA</label>
                  <input
                    type="text"
                    value={profile.cgpa}
                    onChange={(e) => setProfile({ ...profile, cgpa: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 3.62"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* PERSONAL INFORMATION */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                    <User size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
                    <p className="text-sm text-slate-500">Your personal details</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
                >
                  <Edit size={16} /> Edit Profile & Academic Info
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <Mail className="text-blue-600" size={20} />
                  <div>
                    <p className="text-xs text-slate-400">Email</p>
                    <p className="font-medium text-slate-700">{profile.email || "Not Provided"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="text-green-600" size={20} />
                  <div>
                    <p className="text-xs text-slate-400">Phone</p>
                    <p className="font-medium text-slate-700">{profile.phone || "Not Provided"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="text-red-600" size={20} />
                  <div>
                    <p className="text-xs text-slate-400">Address</p>
                    <p className="font-medium text-slate-700">{profile.address || "Not Provided"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CalendarDays className="text-purple-600" size={20} />
                  <div>
                    <p className="text-xs text-slate-400">Qualification</p>
                    <p className="font-medium text-slate-700">{profile.qualification || "Not Provided"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ACADEMIC INFORMATION */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Academic Information</h2>
                  <p className="text-sm text-slate-500">Your academic details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400">Program</p>
                  <p className="font-semibold text-slate-700 mt-1">{profile.program || "Not Provided"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400">Semester</p>
                  <p className="font-semibold text-slate-700 mt-1">{profile.semester || "Not Provided"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400">Department</p>
                  <p className="font-semibold text-slate-700 mt-1">{profile.department || "Not Provided"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400">Current CGPA</p>
                  <p className="font-semibold text-green-600 mt-1">{profile.cgpa ? `${profile.cgpa} / 4.00` : "Not Provided"}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default StudentProfile;