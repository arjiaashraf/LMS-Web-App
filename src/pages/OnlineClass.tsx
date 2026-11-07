import { apiFetch } from "../services/api";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search,
  Video,
  Calendar,
  Clock,
  User,
  BookOpen,
  ArrowLeft,
  Eye,
  CheckCircle,
  XCircle,
  X,
  Users,
} from "lucide-react";

type AdminClassSchedule = {
  id: number;
  course_id: number;
  course_title: string;
  instructor_id: number;
  instructor_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  meeting_link: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
  enrolled_students_count: number;
  course_batch_id: number;
};

type EnrolledStudent = {
  id: number;
  name: string;
  email: string;
};

function OnlineClasses() {
  const [classes, setClasses] = useState<AdminClassSchedule[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<AdminClassSchedule | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [studentsError, setStudentsError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== "admin") {
        navigate("/login");
        return;
      }
      fetchAllClasses();
    } catch (e) {
      navigate("/login");
    }
  }, [navigate]);

  const fetchAllClasses = async () => {
    setLoadError("");
    try {
      const res = await apiFetch("/api/admin/class-schedules");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Classes API error (${res.status})`);
      if (!Array.isArray(data)) throw new Error("Invalid class schedules response.");
      setClasses(data);
    } catch (err) {
      console.error("Error fetching classes for admin:", err);
      setLoadError(err instanceof Error ? err.message : "Unable to load classes.");
    }
  };

  const handleViewDetails = async (cls: AdminClassSchedule) => {
    setSelectedClass(cls);
    setShowModal(true);
    setLoadingStudents(true);
    setEnrolledStudents([]);
    setStudentsError("");

    try {
      const res = await apiFetch( `/api/admin/class-batch-students/${cls.course_batch_id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Students API error (${res.status})`);
      if (!Array.isArray(data)) throw new Error("Invalid class students response.");
      setEnrolledStudents(data);
    } catch (err) {
      console.error("Error fetching enrolled students:", err);
      setStudentsError(err instanceof Error ? err.message : "Unable to load enrolled students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredClasses = classes.filter((cls) => {
    const search = searchTerm.toLowerCase();
    return (
      cls.course_title.toLowerCase().includes(search) ||
      cls.instructor_name.toLowerCase().includes(search) ||
      cls.status.toLowerCase().includes(search)
    );
  });

  const totalClasses = classes.length;
  const scheduledCount = classes.filter((c) => c.status === "Scheduled").length;
  const completedCount = classes.filter((c) => c.status === "Completed").length;
  const cancelledCount = classes.filter((c) => c.status === "Cancelled").length;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin-dashboard"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <Video size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Online Classes Monitoring</h1>
              <p className="text-sm text-slate-500 mt-1">Track instructor schedules, timings, and view session details</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Classes Scheduled</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalClasses}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active / Scheduled</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{scheduledCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{completedCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cancelled</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{cancelledCount}</p>
          </div>
        </div>

        {loadError && <p role="alert" className="bg-red-50 text-red-700 rounded-lg p-4">{loadError}</p>}
        {/* TABLE SECTION */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <div className="relative max-w-md w-full">
              <Search size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by course or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Course & Instructor</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Date & Time</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                      No online classes scheduled yet.
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{cls.course_title}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <User size={12} /> {cls.instructor_name}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        <p className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Calendar size={14} className="text-slate-400" /> {cls.session_date.split("T")[0]}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Clock size={14} className="text-slate-400" /> {cls.start_time} - {cls.end_time} ({cls.time_zone})
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max ${
                          cls.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          cls.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          cls.status === 'Rescheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {cls.status === 'Completed' && <CheckCircle size={12} />}
                          {cls.status === 'Cancelled' && <XCircle size={12} />}
                          {cls.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewDetails(cls)}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center gap-1 text-sm font-medium"
                          title="View Session Details"
                        >
                          <Eye size={18} /> Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* DETAILS MODAL */}
      {showModal && selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-lg font-bold text-slate-800">Class Session Details</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border">
                <p><strong>Course:</strong> {selectedClass.course_title}</p>
                <p><strong>Batch:</strong> {selectedClass.course_batch_id}</p>
                <p><strong>Instructor:</strong> {selectedClass.instructor_name}</p>
                <p><strong>Date:</strong> {selectedClass.session_date.split("T")[0]}</p>
                <p><strong>Timing:</strong> {selectedClass.start_time} - {selectedClass.end_time} ({selectedClass.time_zone})</p>
                <p><strong>Status:</strong> {selectedClass.status}</p>
                <p><strong>Total Enrolled Students:</strong> <span className="text-purple-700 font-semibold">{enrolledStudents.length} students</span></p>
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-1">Meeting Link:</p>
                <a
                  href={selectedClass.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline break-all text-xs"
                >
                  {selectedClass.meeting_link}
                </a>
              </div>

              {/* ENROLLED STUDENTS LIST */}
              <div className="pt-2">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                  <Users size={16} className="text-purple-600" /> Enrolled Students List ({enrolledStudents.length}):
                </p>
                {loadingStudents ? (
                  <p className="text-xs text-slate-400 italic py-2">Loading students list...</p>
                ) : studentsError ? (
                  <p role="alert" className="text-xs text-red-600 py-2">{studentsError}</p>
                ) : enrolledStudents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No students enrolled in this course yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border rounded-xl divide-y bg-slate-50">
                    {enrolledStudents.map((st) => (
                      <div key={st.id} className="p-2.5 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-medium text-slate-800">{st.name}</p>
                          <p className="text-slate-500">{st.email}</p>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Enrolled</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnlineClasses;