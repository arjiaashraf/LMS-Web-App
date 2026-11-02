import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  FileText,
  Plus,
  Calendar,
  BookOpen,
  ArrowLeft,
  X,
  CheckCircle,
  Clock,
  Award,
  Eye
} from "lucide-react";

type Batch = {
  batch_id: number;
  course_id: number;
  course_title: string;
  timing_days: string;
  start_time: string;
  end_time: string;
};

type Assignment = {
  id: number;
  course_id: number;
  course_title: string;
  title: string;
  instructions: string | null;
  course_batch_id?: number | null;
  total_marks: number;
  due_date: string;
};
type Submission = {
  submission_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  submission_text: string | null;
  file_url: string | null;
  submitted_at: string;
  marks_obtained: number | string | null;
  feedback: string | null;
  status: string;
};

interface InstructorAssignmentsProps {
  teacherId: number | null;
  onBack?: () => void;
}

function InstructorAssignments({ teacherId, onBack }: InstructorAssignmentsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [batchError, setBatchError] = useState("");

  // Form states for creating assignment
  const [batchId, setBatchId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
const [gradeMarks, setGradeMarks] = useState("");
const [gradeFeedback, setGradeFeedback] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    if (!teacherId) return;
    fetchInstructorCourses();
    fetchInstructorAssignments();
  }, [teacherId]);

  const fetchInstructorCourses = async () => {
  if (!teacherId) return;

  try {
    const res = await fetch(
      `http://localhost:5000/api/teacher/assignment-batches/${teacherId}`
    );

    const data = await res.json();

    if (res.ok && Array.isArray(data)) {
      setBatches(data);
      setBatchError("");
    } else {
      setBatchError(data.message || "Failed to fetch assigned batches.");
    }
  } catch (err) {
    console.error("Error fetching assigned batches:", err);
    setBatchError("Cannot connect to the server.");
  }
};

  const fetchInstructorAssignments = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/assignments/${teacherId}`);
      const data = await res.json();
      if (res.ok) setAssignments(data);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !batchId) return;
    setCreating(true);
    try {
      const res = await fetch("http://localhost:5000/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  course_batch_id: Number(batchId),
  teacher_id: teacherId,
  title,
  instructions: description,
  total_marks: Number(totalMarks),
  due_date: dueDate,
}),
      });

      if (res.ok) {
        setShowModal(false);
        setBatchId("");
        setTitle("");
        setDescription("");
        setTotalMarks("");
        setDueDate("");
        fetchInstructorAssignments();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create assignment.");
      }
    } catch (err) {
      console.error("Error creating assignment:", err);
      alert("Cannot connect to the server.");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectAssignment = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/assignment-submissions/${assignment.id}/${teacherId}`);
      const data = await res.json();
      if (res.ok) {
        setSubmissions(data);
      }
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSubmissionChange = (studentId: number, field: keyof Submission, value: any) => {
    setSubmissions(prev =>
      prev.map(sub => (sub.student_id === studentId ? { ...sub, [field]: value } : sub))
    );
  };

  const handleGradeSubmission = async (studentId: number, marks: number | string, feedback: string) => {
    if (!selectedAssignment) return;
    if (
  marks === "" ||
  marks === null ||
  !Number.isFinite(Number(marks)) ||
  Number(marks) < 0 ||
  Number(marks) > selectedAssignment.total_marks
) {
  alert(
    `Please enter valid marks between 0 and ${selectedAssignment.total_marks}.`
  );
  return;
}

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/teacher/grade-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          student_id: studentId,
          teacher_id: teacherId,
          marks_obtained: marks !== "" ? Number(marks) : null,
          feedback: feedback || "",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Grade saved successfully!");
        handleSelectAssignment(selectedAssignment);
      } else {
        alert(data.message || "Failed to save grade.");
      }
    } catch (err) {
      console.error("Error grading submission:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedAssignment) setSelectedAssignment(null);
              else if (onBack) onBack();
              else navigate("/instructor-dashboard");
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {selectedAssignment ? `Submissions: ${selectedAssignment.title}` : "Assignment Management"}
            </h1>
            <p className="text-sm text-slate-500">
              {selectedAssignment ? `Course: ${selectedAssignment.course_title}` : "Create assignments and grade student submissions"}
            </p>
          </div>
        </div>

        {!selectedAssignment && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition cursor-pointer"
          >
            <Plus size={18} /> Create Assignment
          </button>
        )}
      </div>

      {/* ASSIGNMENTS GRID OR SUBMISSIONS VIEW */}
      {!selectedAssignment ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No assignments created yet.</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <BookOpen size={13} /> {assignment.course_title}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mb-2">{assignment.title}</h3>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{assignment.instructions}</p>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <Calendar size={15} className="text-slate-400" /> Due: <strong>{assignment.due_date.split('T')[0]}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <Award size={15} className="text-slate-400" /> Total Marks: <strong>{assignment.total_marks}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t">
                  <button
                    onClick={() => handleSelectAssignment(assignment)}
                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <FileText size={16} /> View Submissions & Grade
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* SUBMISSIONS GRADING TABLE */
        <div className="bg-white rounded-xl shadow-sm p-6 border space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Student Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Total Marks: {selectedAssignment.total_marks}</p>
            </div>
            <button
              onClick={() => setSelectedAssignment(null)}
              className="text-sm text-slate-600 border px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Back to Assignments List
            </button>
          </div>

          {loadingSubmissions ? (
            <p className="text-center py-10 text-slate-500">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p className="text-center py-10 text-slate-500">No submissions found for this assignment.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-slate-600 text-sm bg-slate-50">
                      <th className="p-3 font-semibold">Student Name</th>
                      <th className="p-3 font-semibold">Student Answer</th>
                      <th className="p-3 font-semibold">Submission File</th>
                      <th className="p-3 font-semibold w-32">Marks (/{selectedAssignment.total_marks})</th>
                      <th className="p-3 font-semibold">Feedback</th>
                      <th className="p-3 font-semibold text-center w-28">Status</th>
                      <th className="p-3 font-semibold text-center w-24">Action</th>
                    </tr>
                  </thead>
                 
<tbody className="divide-y text-slate-700">
  {submissions.map((sub) => (
    <tr key={sub.student_id} className="hover:bg-slate-50">

      {/* Student Name */}
      <td className="p-3 font-medium">
        {sub.student_name}
        <span className="block text-xs text-slate-400">
          {sub.student_email}
        </span>
      </td>

      {/* Student Answer */}
      <td className="p-3">
        {sub.submission_text ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap max-w-xs">
            {sub.submission_text}
          </p>
        ) : (
          <span className="text-slate-400 text-sm">
            No text answer
          </span>
        )}
      </td>

      {/* Submission File */}
      
<td className="p-3">
  {sub.file_url ? (
    <button
      type="button"
      onClick={async () => {
        try {
          const fileUrl = sub.file_url!;

          const fullUrl =
            fileUrl.startsWith("data:") ||
            fileUrl.startsWith("http")
              ? fileUrl
              : `http://localhost:5000${fileUrl}`;

          // Open a blank tab immediately to avoid popup blocking
          const previewTab = window.open("", "_blank");

          if (!previewTab) {
            alert("Please allow pop-ups to preview the file.");
            return;
          }

          const response = await fetch(fullUrl);

          if (!response.ok) {
            previewTab.close();
            alert("Unable to load the file.");
            return;
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);

          previewTab.location.href = blobUrl;
        } catch (error) {
          console.error("File preview error:", error);
          alert("Unable to preview this file.");
        }
      }}
      className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium text-sm cursor-pointer"
    >
      <Eye size={16} />
      View File
    </button>
  ) : (
    <span className="text-slate-400 text-sm">
      No file attached
    </span>
  )}
</td>

      {/* Marks column starts here — keep your existing code */}

                        <td className="p-3">
                          <input
                            type="number"
                            max={selectedAssignment.total_marks}
                            min={0}
                            value={sub.marks_obtained !== null ? sub.marks_obtained : ""}
                            onChange={(e) => handleSubmissionChange(sub.student_id, "marks_obtained", e.target.value)}
                            placeholder="Marks"
                            className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={sub.feedback || ""}
                            onChange={(e) => handleSubmissionChange(sub.student_id, "feedback", e.target.value)}
                            placeholder="Add feedback"
                            className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            sub.status === 'Graded' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {sub.status === 'Graded' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
     <button
  type="button"
  onClick={() => {
    setGradingSubmission(sub);
    setGradeMarks(
      sub.marks_obtained !== null
        ? String(sub.marks_obtained)
        : ""
    );
    setGradeFeedback(sub.feedback || "");
  }}
  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
>
  {sub.status === "Graded" ? "Edit Grade" : "Grade"}
</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      
{/* GRADING MODAL */}
{gradingSubmission && selectedAssignment && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
      <div className="flex justify-between items-center border-b pb-4 mb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Grade Assignment
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Student: {gradingSubmission.student_name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGradingSubmission(null)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Obtained Marks (Out of {selectedAssignment.total_marks})
          </label>
          <input
            type="number"
            min={0}
            max={selectedAssignment.total_marks}
            value={gradeMarks}
            onChange={(e) => setGradeMarks(e.target.value)}
            placeholder="Enter obtained marks"
            className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Teacher Feedback
          </label>
          <textarea
            rows={5}
            value={gradeFeedback}
            onChange={(e) => setGradeFeedback(e.target.value)}
            placeholder="Write feedback for the student..."
            className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => setGradingSubmission(null)}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              if (
                gradeMarks.trim() === "" ||
                !Number.isFinite(Number(gradeMarks)) ||
                Number(gradeMarks) < 0 ||
                Number(gradeMarks) > selectedAssignment.total_marks
              ) {
                alert(`Enter marks between 0 and ${selectedAssignment.total_marks}`);
                return;
              }

              await handleGradeSubmission(
                gradingSubmission.student_id,
                gradeMarks,
                gradeFeedback
              );
              setGradingSubmission(null);
            }}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Grade"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      {/* CREATE ASSIGNMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Create New Assignment</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Assigned Batch</label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                >
                  <option value="">-- Choose Assigned Batch --</option>
                  {batches.map((batch) => (
                    <option key={batch.batch_id} value={batch.batch_id}>
                      {batch.course_title} — Batch {batch.batch_id} — {batch.timing_days} ({batch.start_time} - {batch.end_time})
                    </option>
                  ))}
                </select>
                {batchError && <p className="text-xs text-red-500 mt-1">{batchError}</p>}
                {!batchError && batches.length === 0 && <p className="text-xs text-slate-500 mt-1">No assigned batches found.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assignment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Homework 1"
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Assignment instructions..."
                  rows={3}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="e.g. 50"
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || batches.length === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstructorAssignments;