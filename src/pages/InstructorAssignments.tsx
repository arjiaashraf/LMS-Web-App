
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
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
  Eye,
  RefreshCw,
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

async function readApiResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Request failed (${response.status}).`
    );
  }

  return data;
}

function InstructorAssignments({
  teacherId,
  onBack,
}: InstructorAssignmentsProps) {
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [submissionError, setSubmissionError] = useState("");

  const [batchId, setBatchId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [gradingSubmission, setGradingSubmission] =
    useState<Submission | null>(null);
  const [gradeMarks, setGradeMarks] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");

  const fetchInstructorCourses = useCallback(async () => {
    if (!teacherId) return;

    try {
      setBatchError("");

      const response = await apiFetch(
        `/api/teacher/assignment-batches/${teacherId}`
      );
      const data = await readApiResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("Invalid batches response.");
      }

      setBatches(data);
    } catch (err) {
      setBatchError(
        err instanceof Error
          ? err.message
          : "Unable to load assigned batches."
      );
    }
  }, [teacherId]);

  const fetchInstructorAssignments = useCallback(async () => {
    if (!teacherId) return;

    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/teacher/assignments/${teacherId}`
      );
      const data = await readApiResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("Invalid assignments response.");
      }

      setAssignments(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load assignments."
      );
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      if (
        user.role !== "instructor" ||
        !user.token ||
        Number(user.id) !== Number(teacherId)
      ) {
        navigate("/login", { replace: true });
        return;
      }
    } catch {
      navigate("/login", { replace: true });
      return;
    }

    void fetchInstructorCourses();
    void fetchInstructorAssignments();
  }, [
    teacherId,
    navigate,
    fetchInstructorCourses,
    fetchInstructorAssignments,
  ]);

  const handleCreateAssignment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!teacherId || creating) return;

    const marks = Number(totalMarks);

    if (
      !batchId ||
      !title.trim() ||
      !description.trim() ||
      !dueDate ||
      !Number.isFinite(marks) ||
      marks <= 0
    ) {
      window.alert("Please enter valid assignment details.");
      return;
    }

    setCreating(true);

    try {
      const response = await apiFetch(
        "/api/teacher/assignments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_batch_id: Number(batchId),
            teacher_id: teacherId,
            title: title.trim(),
            instructions: description.trim(),
            total_marks: marks,
            due_date: dueDate,
          }),
        }
      );

      await readApiResponse(response);

      setShowModal(false);
      setBatchId("");
      setTitle("");
      setDescription("");
      setTotalMarks("");
      setDueDate("");

      await fetchInstructorAssignments();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to create assignment."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSelectAssignment = useCallback(
    async (assignment: Assignment) => {
      if (!teacherId) return;

      setSelectedAssignment(assignment);
      setSubmissions([]);
      setLoadingSubmissions(true);
      setSubmissionError("");

      try {
        const response = await apiFetch(
          `/api/teacher/assignment-submissions/${assignment.id}/${teacherId}`
        );

        const data = await readApiResponse(response);

        if (!Array.isArray(data)) {
          throw new Error("Invalid submissions response.");
        }

        setSubmissions(data);
      } catch (err) {
        setSubmissionError(
          err instanceof Error
            ? err.message
            : "Unable to load submissions."
        );
      } finally {
        setLoadingSubmissions(false);
      }
    },
    [teacherId]
  );

  const handleSubmissionChange = (
    submissionId: number,
    field: "marks_obtained" | "feedback",
    value: string
  ) => {
    setSubmissions((previous) =>
      previous.map((submission) =>
        submission.submission_id === submissionId
          ? { ...submission, [field]: value }
          : submission
      )
    );
  };

  const handleGradeSubmission = async () => {
    if (
      !selectedAssignment ||
      !gradingSubmission ||
      !teacherId ||
      submitting
    ) {
      return;
    }

    const marks = Number(gradeMarks);

    if (
      gradeMarks.trim() === "" ||
      !Number.isFinite(marks) ||
      marks < 0 ||
      marks > Number(selectedAssignment.total_marks)
    ) {
      window.alert(
        `Please enter marks between 0 and ${selectedAssignment.total_marks}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(
        "/api/teacher/grade-submission",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignment_id: selectedAssignment.id,
            student_id: gradingSubmission.student_id,
            teacher_id: teacherId,
            marks_obtained: marks,
            feedback: gradeFeedback.trim(),
          }),
        }
      );

      await readApiResponse(response);

      // Close only after the server confirms the grade.
      setGradingSubmission(null);
      setGradeMarks("");
      setGradeFeedback("");

      window.alert("Grade saved successfully!");

      await handleSelectAssignment(selectedAssignment);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to save grade."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openGradingModal = (submission: Submission) => {
    setGradingSubmission(submission);
    setGradeMarks(
      submission.marks_obtained === null
        ? ""
        : String(submission.marks_obtained)
    );
    setGradeFeedback(submission.feedback || "");
  };

  const handlePreviewFile = async (fileUrl: string) => {
    const previewTab = window.open("", "_blank");

    if (!previewTab) {
      window.alert("Please allow pop-ups to view files.");
      return;
    }

    try {
      const normalizedUrl = fileUrl.trim();

      // Only backend-owned relative paths are accepted.
      // Do not send JWT credentials to third-party URLs.
      if (
        !normalizedUrl.startsWith("/") ||
        normalizedUrl.startsWith("//") ||
        normalizedUrl.includes("\\")
      ) {
        throw new Error(
          "Unsupported file URL. A protected backend file path is required."
        );
      }

      const response = await apiFetch(normalizedUrl);

      if (!response.ok) {
        throw new Error("Unable to load submission file.");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      previewTab.location.href = blobUrl;

      // Release the object URL after giving the browser
      // enough time to load the file.
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (err) {
      previewTab.close();

      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to preview the file."
      );
    }
  };

  const backToList = () => {
    setSelectedAssignment(null);
    setSubmissions([]);
    setSubmissionError("");
    setGradingSubmission(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedAssignment) backToList();
              else if (onBack) onBack();
              else navigate("/instructor-dashboard");
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {selectedAssignment
                ? `Submissions: ${selectedAssignment.title}`
                : "Assignment Management"}
            </h1>

            <p className="text-sm text-slate-500">
              {selectedAssignment
                ? `Course: ${selectedAssignment.course_title}`
                : "Create assignments and grade student submissions"}
            </p>
          </div>
        </div>

        {!selectedAssignment && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void fetchInstructorAssignments();
                void fetchInstructorCourses();
              }}
              className="p-2 border rounded-lg hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw size={19} />
            </button>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium"
            >
              <Plus size={18} />
              Create Assignment
            </button>
          </div>
        )}
      </div>

      {/* ASSIGNMENTS LIST */}
      {!selectedAssignment ? (
        <>
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-5"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-xl p-10 text-center text-slate-500">
              Loading assignments...
            </div>
          ) : assignments.length === 0 && !error ? (
            <div className="bg-white rounded-xl p-10 text-center border shadow-sm">
              <FileText
                size={48}
                className="mx-auto text-slate-300 mb-3"
              />
              <p className="text-slate-600 font-medium">
                No assignments created yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
                      <BookOpen size={13} />
                      {assignment.course_title}
                    </span>

                    <h3 className="font-bold text-slate-800 text-lg mt-3 mb-2">
                      {assignment.title}
                    </h3>

                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {assignment.instructions || "No instructions"}
                    </p>

                    <div className="space-y-2 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <Calendar size={15} />
                        Due:
                        <strong>
                          {assignment.due_date?.slice(0, 10) || "—"}
                        </strong>
                      </p>

                      <p className="flex items-center gap-2">
                        <Award size={15} />
                        Total Marks:
                        <strong>{assignment.total_marks}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() =>
                        void handleSelectAssignment(assignment)
                      }
                      className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <FileText size={16} />
                      View Submissions & Grade
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* SUBMISSIONS */
        <div className="bg-white rounded-xl shadow-sm p-6 border space-y-6">
          <div className="flex justify-between items-center border-b pb-4 gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Student Submissions
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Total Marks: {selectedAssignment.total_marks}
              </p>
            </div>

            <button
              type="button"
              onClick={backToList}
              className="text-sm text-slate-600 border px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              Back to Assignments
            </button>
          </div>

          {submissionError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3"
            >
              {submissionError}
            </div>
          )}

          {loadingSubmissions ? (
            <p className="text-center py-10 text-slate-500">
              Loading submissions...
            </p>
          ) : submissions.length === 0 && !submissionError ? (
            <p className="text-center py-10 text-slate-500">
              No submissions found for this assignment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-slate-600 text-sm bg-slate-50">
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Student Answer</th>
                    <th className="p-3">Submission File</th>
                    <th className="p-3">
                      Marks / {selectedAssignment.total_marks}
                    </th>
                    <th className="p-3">Feedback</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y text-slate-700">
                  {submissions.map((sub) => (
                    <tr
                      key={sub.submission_id}
                      className="hover:bg-slate-50"
                    >
                      <td className="p-3 font-medium">
                        {sub.student_name}
                        <span className="block text-xs text-slate-400">
                          {sub.student_email}
                        </span>
                      </td>

                      <td className="p-3">
                        {sub.submission_text ? (
                          <p className="text-sm whitespace-pre-wrap max-w-xs">
                            {sub.submission_text}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-sm">
                            No text answer
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {sub.file_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handlePreviewFile(sub.file_url!)
                            }
                            className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium text-sm"
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

                      <td className="p-3">
                        <input
                          type="number"
                          min={0}
                          max={selectedAssignment.total_marks}
                          step="any"
                          value={sub.marks_obtained ?? ""}
                          onChange={(event) =>
                            handleSubmissionChange(
                              sub.submission_id,
                              "marks_obtained",
                              event.target.value
                            )
                          }
                          placeholder="Marks"
                          className="w-28 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          value={sub.feedback || ""}
                          onChange={(event) =>
                            handleSubmissionChange(
                              sub.submission_id,
                              "feedback",
                              event.target.value
                            )
                          }
                          placeholder="Add feedback"
                          className="w-full min-w-36 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            sub.status === "Graded"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {sub.status === "Graded" ? (
                            <CheckCircle size={12} />
                          ) : (
                            <Clock size={12} />
                          )}
                          {sub.status}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openGradingModal(sub)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          {sub.status === "Graded"
                            ? "Edit Grade"
                            : "Grade"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  {gradingSubmission.status === "Graded"
                    ? "Edit Grade"
                    : "Grade Assignment"}
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Student: {gradingSubmission.student_name}
                </p>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setGradingSubmission(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleGradeSubmission();
              }}
              className="space-y-5"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Obtained Marks (Out of {selectedAssignment.total_marks})
                </label>

                <input
                  type="number"
                  min={0}
                  max={selectedAssignment.total_marks}
                  step="any"
                  required
                  value={gradeMarks}
                  onChange={(event) =>
                    setGradeMarks(event.target.value)
                  }
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
                  onChange={(event) =>
                    setGradeFeedback(event.target.value)
                  }
                  placeholder="Write feedback for the student..."
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setGradingSubmission(null)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Grade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ASSIGNMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Create New Assignment
              </h3>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateAssignment}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Assigned Batch
                </label>

                <select
                  value={batchId}
                  onChange={(event) =>
                    setBatchId(event.target.value)
                  }
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                >
                  <option value="">-- Choose Assigned Batch --</option>

                  {batches.map((batch) => (
                    <option
                      key={batch.batch_id}
                      value={batch.batch_id}
                    >
                      {batch.course_title} — Batch {batch.batch_id} —{" "}
                      {batch.timing_days} ({batch.start_time} -{" "}
                      {batch.end_time})
                    </option>
                  ))}
                </select>

                {batchError && (
                  <p className="text-xs text-red-500 mt-1">
                    {batchError}
                  </p>
                )}

                {!batchError && batches.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    No assigned batches found.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assignment Title
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  required
                  placeholder="e.g. Homework 1"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={3}
                  required
                  placeholder="Assignment instructions..."
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Total Marks
                  </label>

                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={totalMarks}
                    onChange={(event) =>
                      setTotalMarks(event.target.value)
                    }
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Due Date
                  </label>

                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) =>
                      setDueDate(event.target.value)
                    }
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || batches.length === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
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
