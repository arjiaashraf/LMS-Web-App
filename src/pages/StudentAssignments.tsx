import {
  ClipboardList,
  Search,
  Clock,
  CheckCircle,
  CalendarDays,
  ArrowLeft,
  X,
  Send,
  Award,
  User,
  Upload,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch as fetch } from "../services/api";

type Assignment = {
  id: number;
  course_title: string;
  instructor_name: string;
  title: string;
  instructions: string;
  due_date: string;
  total_marks: number;
  submission_id: number;
  status: string;
  marks_obtained: number;
  feedback: string;
};

function StudentAssignments() {
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  
  // Submission modal states
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const navigate = useNavigate();

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
        fetchStudentAssignments(userData.id);
      }
    } catch (e) {
      console.error("Error parsing user session", e);
    }
  }, [navigate]);

  const fetchStudentAssignments = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/student/assignments/${id}`);
      const data = await res.json();
      if (res.ok) {
        setAssignments(data);
      }
    } catch (err) {
      console.error("Error fetching student assignments:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !studentId) return;

    try {
      const res = await fetch("http://localhost:5000/api/student/submit-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          student_id: studentId,
          submission_text: submissionText,
          file_url: fileUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowSubmitModal(false);
        setSubmissionText("");
        setFileUrl("");
        setFileName("");
        fetchStudentAssignments(studentId);
      } else {
        alert(data.message || "Failed to submit assignment.");
      }
    } catch (err) {
      console.error("Error submitting assignment:", err);
      alert("Server error while submitting assignment.");
    }
  };

  const filteredAssignments = assignments.filter(
    (assignment) =>
      assignment.title?.toLowerCase().includes(search.toLowerCase()) ||
      assignment.course_title?.toLowerCase().includes(search.toLowerCase()) ||
      assignment.instructor_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalAssignments = assignments.length;
  const pendingCount = assignments.filter((a) => !a.status || a.status === "Pending").length;
  const submittedCount = assignments.filter((a) => a.status === "Submitted" || a.status === "Graded").length;

  const getStatusStyle = (status: string) => {
    if (status === "Submitted") return "bg-blue-100 text-blue-700";
    if (status === "Graded") return "bg-green-100 text-green-700";
    return "bg-orange-100 text-orange-700";
  };

  const getStatusIcon = (status: string) => {
    if (status === "Submitted" || status === "Graded") return <CheckCircle size={18} />;
    return <Clock size={18} />;
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link to="/student-dashboard" className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={22} className="text-slate-700" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Assignments</h1>
            <p className="text-sm text-slate-500">View and manage your assignments</p>
          </div>
        </div>
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
          ST
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6 max-w-7xl mx-auto">
        {/* INTRO */}
        <div className="bg-blue-600 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <ClipboardList size={30} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">My Assignments</h2>
              <p className="text-blue-100 mt-1">Keep track of your academic tasks and deadlines.</p>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Total Assignments</p>
            <h2 className="text-3xl font-bold text-slate-800 mt-2">{totalAssignments}</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Pending</p>
            <h2 className="text-3xl font-bold text-orange-600 mt-2">{pendingCount}</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Submitted / Graded</p>
            <h2 className="text-3xl font-bold text-green-600 mt-2">{submittedCount}</h2>
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search assignments, courses, or instructors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-lg pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ASSIGNMENT LIST */}
        <div className="space-y-5">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                {/* LEFT */}
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800">{assignment.title}</h3>
                      <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 font-semibold ${getStatusStyle(assignment.status || "Pending")}`}>
                        {getStatusIcon(assignment.status || "Pending")}
                        {assignment.status || "Pending"}
                      </span>
                    </div>

                    {/* Course Title and Instructor Name Display */}
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-sm text-blue-600 font-semibold">{assignment.course_title}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <User size={14} className="text-slate-400" /> Instructor: <strong className="text-slate-800">{assignment.instructor_name || "Instructor"}</strong>
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 mt-2 max-w-2xl">{assignment.instructions}</p>

                    <div className="flex flex-wrap gap-5 mt-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-500">
                        <CalendarDays size={17} />
                        <span>
  Due: {new Date(assignment.due_date).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  })}
</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Award size={17} />
                        <span>Total Marks: {assignment.total_marks}</span>
                      </div>
                    </div>

                    {assignment.status === "Graded" && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                        <p><strong>Marks Obtained:</strong> {assignment.marks_obtained} / {assignment.total_marks}</p>
                        <p className="mt-1"><strong>Feedback:</strong> {assignment.feedback || "No feedback provided."}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT */}
<div className="flex lg:flex-col gap-3 lg:min-w-32">
  <button
    type="button"
    disabled={assignment.status === "Submitted" || assignment.status === "Graded"}
    onClick={() => {
      setSelectedAssignment(assignment);
      setSubmissionText("");
      setFileUrl("");
      setFileName("");
      setShowSubmitModal(true);
    }}
    className={`px-5 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
      assignment.status === "Submitted" || assignment.status === "Graded"
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : "bg-blue-600 hover:bg-blue-700 text-white"
    }`}
  >
    {assignment.status === "Submitted" || assignment.status === "Graded" ? (
      <CheckCircle size={16} />
    ) : (
      <Send size={16} />
    )}

    {assignment.status === "Graded"
      ? "Graded"
      : assignment.status === "Submitted"
      ? "Submitted"
      : "Submit Work"}
  </button>
</div>
              </div>
            </div>
          ))}
        </div>

        {/* NO RESULTS */}
        {filteredAssignments.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center">
            <ClipboardList size={45} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No assignments found</h3>
            <p className="text-sm text-slate-500 mt-1">Assignments from your enrolled courses will appear here.</p>
          </div>
        )}
      </main>

      {/* SUBMISSION MODAL */}
      {showSubmitModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Submit: {selectedAssignment.title}</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Solution / Answer (Text)</label>
                <textarea
                  rows={4}
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attach File (PDF, Doc, Image)</label>
                <label className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg border border-blue-200 text-sm font-medium hover:bg-blue-100 transition flex items-center justify-center gap-2">
                  <Upload size={16} /> {fileName ? fileName : "Choose File to Upload"}
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Submit Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentAssignments;