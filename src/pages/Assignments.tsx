import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ClipboardList,
  ArrowLeft,
  User,
  X,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

type Assignment = {
  id: number;
  course_title: string;
  instructor_name: string;
  title: string;
  instructions: string;
  issue_date: string;
  due_date: string;
  total_marks: number;
};

type SubmissionDetail = {
  student_id: number;
  student_name: string;
  student_email: string;
  submission_text: string;
  file_url: string;
  submitted_at: string;
  status: string;
  marks_obtained: number;
  feedback: string;
};

function AdminAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Submissions Modal States
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDetail[]>([]);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
      return;
    }
    fetchAdminAssignments();
  }, [navigate]);

  const fetchAdminAssignments = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/assignments");
      const data = await res.json();
      if (res.ok) {
        setAssignments(data);
      }
    } catch (err) {
      console.error("Error fetching admin assignments:", err);
    }
  };

  const handleViewSubmissions = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmissionsModal(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/assignment-submissions/${assignment.id}`);
      const data = await res.json();
      if (res.ok) {
        setSubmissions(data);
      }
    } catch (err) {
      console.error("Error fetching assignment submissions:", err);
    }
  };

  const filteredAssignments = assignments.filter((assignment) => {
    const search = searchTerm.toLowerCase();
    return (
      assignment.title?.toLowerCase().includes(search) ||
      assignment.course_title?.toLowerCase().includes(search) ||
      assignment.instructor_name?.toLowerCase().includes(search)
    );
  });

  const totalAssignments = assignments.length;

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
            <div>
              <h1 className="text-2xl font-bold text-slate-800">System Assignments</h1>
              <p className="text-sm text-slate-500 mt-1">Monitor all instructor assignments and student progress</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6">
        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                <ClipboardList size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total System Assignments</p>
                <p className="text-2xl font-bold text-slate-800">{totalAssignments}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ASSIGNMENTS TABLE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* SEARCH */}
          <div className="p-5 border-b">
            <div className="relative max-w-md">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by title, course or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Assignment Title</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Course</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Instructor</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Due Date</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Marks</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No assignments found in the system.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                            <ClipboardList size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{assignment.title}</p>
                            <p className="text-xs text-slate-500">ID: ASN-{assignment.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                        {assignment.course_title}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-1.5 pt-6">
                        <User size={15} className="text-slate-400" /> {assignment.instructor_name}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {assignment.due_date}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                        {assignment.total_marks} Marks
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewSubmissions(assignment)}
                          className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          View Submissions & Grading
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

      {/* VIEW SUBMISSIONS & GRADING MODAL */}
      {showSubmissionsModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-lg max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Submissions & Grading: {selectedAssignment.title}</h3>
                <p className="text-xs text-slate-500">Course: {selectedAssignment.course_title} | Total Marks: {selectedAssignment.total_marks}</p>
              </div>
              <button onClick={() => setShowSubmissionsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {submissions.length === 0 ? (
                <p className="text-center py-10 text-slate-500">No students enrolled or no data found for this course.</p>
              ) : (
                submissions.map((sub, index) => (
                  <div key={index} className="border rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{sub.student_name}</h4>
                        <p className="text-xs text-slate-500">{sub.student_email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        sub.status === 'Graded' ? 'bg-green-100 text-green-700' :
                        sub.status === 'Submitted' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {sub.status === 'Graded' || sub.status === 'Submitted' ? <CheckCircle size={13} /> : <Clock size={13} />}
                        {sub.status}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border text-sm text-slate-700">
                      <p><strong>Student Answer:</strong> {sub.submission_text || "No text provided."}</p>
                      {sub.file_url && (
                        <div className="mt-2">
                          <a
                            href={sub.file_url}
                            download="Student_File"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            📎 View / Download Attached File
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-2 border-t text-xs gap-2">
                      <span className="text-slate-500">
                        {sub.submitted_at ? `Submitted on: ${new Date(sub.submitted_at).toLocaleDateString()}` : "Not submitted yet"}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-200 px-3 py-1.5 rounded-md font-semibold text-slate-700">
                          Marks: {sub.marks_obtained !== null && sub.marks_obtained !== undefined ? `${sub.marks_obtained} / ${selectedAssignment.total_marks}` : "Not Graded"}
                        </span>
                        <span className="bg-slate-200 px-3 py-1.5 rounded-md text-slate-700">
                          Feedback: {sub.feedback || "No feedback yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowSubmissionsModal(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium"
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

export default AdminAssignments;