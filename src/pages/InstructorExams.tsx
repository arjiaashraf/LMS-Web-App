import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Calendar,
  Award,
  ArrowLeft,
  X,
  BookOpen,
  Save,
  CheckCircle,
  Clock,
} from "lucide-react";

type Course = {
  id: number;
  title: string;
};

type Exam = {
  id: number;
  course_id: number;
  course_title: string;
  title: string;
  exam_type: string;
  total_marks: number;
  exam_date: string;
};

type StudentResult = {
  student_id: number;
  student_name: string;
  student_email: string;
  result_id: number | null;
  marks_obtained: number | string | null; // <--- string bhi allow kar di hai taake comparison error na aaye
  grade: string | null;
  feedback: string | null;
  status: string;
};

interface InstructorExamsProps {
  onBack?: () => void;
}

function InstructorExams({ onBack }: InstructorExamsProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for creating exam
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState("Midterm");
  const [totalMarks, setTotalMarks] = useState("");
  const [examDate, setExamDate] = useState("");

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const teacherId = user.id;

  useEffect(() => {
    if (!user || user.role !== "instructor") {
      navigate("/login");
      return;
    }
    fetchInstructorCourses();
    fetchInstructorExams();
  }, [navigate]);

  const fetchInstructorCourses = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/courses/${teacherId}`);
      const data = await res.json();
      if (res.ok) setCourses(data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const fetchInstructorExams = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/exams/${teacherId}`);
      const data = await res.json();
      if (res.ok) setExams(data);
    } catch (err) {
      console.error("Error fetching exams:", err);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          teacher_id: teacherId,
          title,
          exam_type: examType,
          total_marks: Number(totalMarks),
          exam_date: examDate,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setCourseId("");
        setTitle("");
        setExamType("Midterm");
        setTotalMarks("");
        setExamDate("");
        fetchInstructorExams();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create exam.");
      }
    } catch (err) {
      console.error("Error creating exam:", err);
    }
  };

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    setLoadingResults(true);
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/exam-results/${exam.id}/${teacherId}`);
      const data = await res.json();
      if (res.ok) {
        setStudentResults(data);
      }
    } catch (err) {
      console.error("Error fetching exam results:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleResultChange = (studentId: number, field: keyof StudentResult, value: any) => {
    setStudentResults(prev =>
      prev.map(st => (st.student_id === studentId ? { ...st, [field]: value } : st))
    );
  };

  const handleSaveResults = async () => {
    if (!selectedExam) return;

    const payloadResults = studentResults.map(st => ({
      student_id: st.student_id,
      marks_obtained: st.marks_obtained !== null && st.marks_obtained !== "" ? Number(st.marks_obtained) : null,
      grade: st.grade || "",
      feedback: st.feedback || "",
    }));

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/teacher/exam-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: selectedExam.id,
          teacher_id: teacherId,
          results_data: payloadResults,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Exam results saved successfully!");
        handleSelectExam(selectedExam);
      } else {
        alert(data.message || "Failed to save results.");
      }
    } catch (err) {
      console.error("Error saving results:", err);
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
              if (selectedExam) setSelectedExam(null);
              else if (onBack) onBack();
              else navigate("/instructor-dashboard");
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {selectedExam ? `Grading: ${selectedExam.title}` : "Exams & Assessments"}
            </h1>
            <p className="text-sm text-slate-500">
              {selectedExam ? `Course: ${selectedExam.course_title}` : "Create and manage student assessments"}
            </p>
          </div>
        </div>

        {!selectedExam && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition cursor-pointer"
          >
            <Plus size={18} /> Create New Exam
          </button>
        )}
      </div>

      {/* EXAMS LIST OR GRADING VIEW */}
      {!selectedExam ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
              <ClipboardList size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No exams created yet.</p>
            </div>
          ) : (
            exams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <BookOpen size={13} /> {exam.course_title}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {exam.exam_type}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mb-2">{exam.title}</h3>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <Calendar size={15} className="text-slate-400" /> Date: <strong>{exam.exam_date.split('T')[0]}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <Award size={15} className="text-slate-400" /> Total Marks: <strong>{exam.total_marks}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t">
                  <button
                    onClick={() => handleSelectExam(exam)}
                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ClipboardList size={16} /> Manage Marks & Results
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* STUDENTS GRADING TABLE */
        <div className="bg-white rounded-xl shadow-sm p-6 border space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Student Results Entry</h2>
              <p className="text-xs text-slate-500 mt-0.5">Total Marks: {selectedExam.total_marks}</p>
            </div>
            <button
              onClick={() => setSelectedExam(null)}
              className="text-sm text-slate-600 border px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Back to Exams List
            </button>
          </div>

          {loadingResults ? (
            <p className="text-center py-10 text-slate-500">Loading student list...</p>
          ) : studentResults.length === 0 ? (
            <p className="text-center py-10 text-slate-500">No students enrolled in this course.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-slate-600 text-sm bg-slate-50">
                      <th className="p-3 font-semibold">Student Name</th>
                      <th className="p-3 font-semibold">Email</th>
                      <th className="p-3 font-semibold w-32">Marks (/{selectedExam.total_marks})</th>
                      <th className="p-3 font-semibold w-24">Grade</th>
                      <th className="p-3 font-semibold">Feedback</th>
                      <th className="p-3 font-semibold text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {studentResults.map((st) => (
                      <tr key={st.student_id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium">{st.student_name}</td>
                        <td className="p-3 text-slate-500 text-sm">{st.student_email}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            max={selectedExam.total_marks}
                            min={0}
                            value={st.marks_obtained !== null ? st.marks_obtained : ""}
                            onChange={(e) => handleResultChange(st.student_id, "marks_obtained", e.target.value)}
                            placeholder="Marks"
                            className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={st.grade || ""}
                            onChange={(e) => handleResultChange(st.student_id, "grade", e.target.value)}
                            placeholder="e.g. A+"
                            className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={st.feedback || ""}
                            onChange={(e) => handleResultChange(st.student_id, "feedback", e.target.value)}
                            placeholder="Optional feedback"
                            className="w-full border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            st.status === 'Graded' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {st.status === 'Graded' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {st.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveResults}
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Save size={16} /> {submitting ? "Saving..." : "Save All Results"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE EXAM MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Create New Exam / Assessment</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm Examination"
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Exam Type</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  >
                    <option value="Quiz">Quiz</option>
                    <option value="Midterm">Midterm</option>
                    <option value="Final">Final</option>
                    <option value="Assignment">Assignment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="e.g. 100"
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium cursor-pointer"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstructorExams;