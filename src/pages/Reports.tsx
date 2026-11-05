
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock3,
  Eye,
  GraduationCap,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

const API_BASE = "http://localhost:5000";

type ExamReport = {
  id: number;
  title: string;
  exam_type: string;
  exam_mode: string;
  exam_status: string;
  result_published: number;
  total_marks: number;
  course_batch_id: number;
  exam_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  attempt_limit: number;
  created_at: string | null;
  course_title: string;
  teacher_name: string;
  total_students?: number;
  students_attempted?: number;
  total_attempts?: number;
  graded_students?: number;
};

type Attempt = {
  attempt_id: number;
  student_id: number;
  student_name: string;
  attempt_number: number;
  status: string;
  total_score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
};

type StudentReport = {
  student_id: number;
  student_name: string;
  student_email: string;
  result_id: number | null;
  marks_obtained: number | null;
  grade: string | null;
  feedback: string | null;
  result_status: string;
  attempts: Attempt[];
};

type Overview = {
  totalExams: number;
  publishedExams: number;
  resultsPublished: number;
  exams: ExamReport[];
};

type FullReport = {
  exam: ExamReport;
  students: StudentReport[];
  totalAttempts: number;
  studentsAttempted: number;
};

const EMPTY_OVERVIEW: Overview = {
  totalExams: 0,
  publishedExams: 0,
  resultsPublished: 0,
  exams: [],
};

const displayDate = (value?: string | null) =>
  value ? value.slice(0, 10) : "—";

const displayTime = (value?: string | null) =>
  value ? value.slice(0, 5) : "—";

const displayDateTime = (value?: string | null) =>
  value ? value.replace("T", " ").slice(0, 19) : "Not recorded";

function Reports() {
  const navigate = useNavigate();

  const [overview, setOverview] =
    useState<Overview>(EMPTY_OVERVIEW);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Published");

  const [selected, setSelected] =
    useState<FullReport | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState("");

  const [showDetails, setShowDetails] =
    useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/exam-reports`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch exam reports."
        );
      }

      setOverview({
        totalExams: Number(data.totalExams || 0),
        publishedExams: Number(data.publishedExams || 0),
        resultsPublished: Number(data.resultsPublished || 0),
        exams: Array.isArray(data.exams)
          ? data.exams
          : [],
      });

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      if (user.role !== "admin") {
        navigate("/login");
        return;
      }
    } catch {
      navigate("/login");
      return;
    }

    void loadOverview();

    const timer = window.setInterval(() => {
      void loadOverview();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [navigate, loadOverview]);

  const filteredExams = useMemo(() => {
    const term = search.trim().toLowerCase();

    return overview.exams.filter(exam => {
      const matchesText = [
        exam.title,
        exam.course_title,
        exam.teacher_name,
        exam.exam_type,
      ].some(value =>
        String(value || "").toLowerCase().includes(term)
      );

      const matchesStatus =
        filter === "All" ||
        (filter === "Published" &&
          exam.exam_status === "Published") ||
        (filter === "Draft" &&
          exam.exam_status === "Draft") ||
        (filter === "Results Published" &&
          Number(exam.result_published) === 1);

      return matchesText && matchesStatus;
    });
  }, [overview.exams, search, filter]);

  const openFullReport = async (examId: number) => {
    setSelected(null);
    setShowDetails(true);
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/exam-reports/${examId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load exam details."
        );
      }

      setSelected({
        exam: data.exam,
        students: Array.isArray(data.students)
          ? data.students
          : [],
        totalAttempts: Number(data.totalAttempts || 0),
        studentsAttempted: Number(data.studentsAttempted || 0),
      });
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to load exam report."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelected(null);
    setDetailsError("");
  };

  const stats = [
    {
      title: "Total Exams",
      value: overview.totalExams,
      icon: ClipboardList,
      color: "bg-purple-100 text-purple-700",
    },
    {
      title: "Published Exams",
      value: overview.publishedExams,
      icon: CalendarDays,
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Results Published",
      value: overview.resultsPublished,
      icon: GraduationCap,
      color: "bg-green-100 text-green-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b p-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin-dashboard"
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="bg-purple-100 text-purple-700 p-3 rounded-lg">
              <ClipboardList size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Examination Reports
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Instructor exams, student attempts and grades
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadOverview()}
            className="flex items-center gap-2 border rounded-lg px-4 py-2.5 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {stats.map(card => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="bg-white rounded-xl border shadow-sm p-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-500">
                      {card.title}
                    </p>
                    <h2 className="text-3xl font-bold mt-2 text-slate-800">
                      {loading ? "..." : card.value}
                    </h2>
                  </div>

                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* EXAMS LIST */}
        <section className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-lg text-slate-800">
                  Published Exams & Results
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Select an exam to see its complete report
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search exam or instructor..."
                    className="border rounded-lg pl-9 pr-3 py-2.5 text-sm"
                  />
                </div>

                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2.5 text-sm bg-white"
                >
                  <option value="Published">Published Exams</option>
                  <option value="Results Published">Results Published</option>
                  <option value="All">All Exams</option>
                  <option value="Draft">Draft Exams</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="m-5 p-3 bg-red-50 text-red-700 rounded-lg">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-center p-10 text-slate-500">
              Loading exam reports...
            </p>
          ) : filteredExams.length === 0 ? (
            <p className="text-center p-10 text-slate-500">
              No matching exams found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Instructor</th>
                    <th className="p-4">Course</th>
                    <th className="p-4">Scheduled Date</th>
                    <th className="p-4">Created At</th>
                    <th className="p-4">Attempted</th>
                    <th className="p-4">Results</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredExams.map(exam => (
                    <tr key={exam.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">
                          {exam.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {exam.exam_type} · {exam.exam_mode}
                        </p>
                      </td>

                      <td className="p-4">{exam.teacher_name}</td>
                      <td className="p-4">{exam.course_title}</td>
                      <td className="p-4">
                        {displayDate(exam.exam_date)}
                        {" "}
                        {displayTime(exam.start_time)}
                      </td>
                      <td className="p-4">
                        {exam.created_at
                          ? displayDateTime(exam.created_at)
                          : "Not recorded"}
                      </td>
                      <td className="p-4">
                        {exam.students_attempted ?? 0}
                        {" / "}
                        {exam.total_students ?? 0}
                      </td>
                      <td className="p-4">
                        <span className={
                          Number(exam.result_published) === 1
                            ? "text-green-700 font-semibold"
                            : "text-orange-600 font-semibold"
                        }>
                          {Number(exam.result_published) === 1
                            ? "Published"
                            : "Not Published"}
                        </span>
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => void openFullReport(exam.id)}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-2 inline-flex items-center gap-2"
                        >
                          <Eye size={16} />
                          View Full Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* FULL EXAM REPORT MODAL */}
      {showDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-xl shadow-xl">
            <div className="sticky top-0 bg-white border-b p-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selected?.exam.title || "Full Exam Report"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Read-only admin monitoring
                </p>
              </div>

              <button
                onClick={closeDetails}
                className="p-2 hover:bg-slate-100 rounded-lg"
                aria-label="Close report"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailsLoading ? (
                <p className="py-10 text-center text-slate-500">
                  Loading full exam details...
                </p>
              ) : detailsError ? (
                <p className="p-4 bg-red-50 text-red-700 rounded-lg">
                  {detailsError}
                </p>
              ) : selected ? (
                <>
                  {/* EXAM INFORMATION */}
                  <section>
                    <h3 className="text-lg font-bold mb-4">
                      Exam Information
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        ["Exam Title", selected.exam.title],
                        ["Instructor", selected.exam.teacher_name],
                        ["Course", selected.exam.course_title],
                        ["Type", selected.exam.exam_type],
                        ["Mode", selected.exam.exam_mode],
                        ["Exam Status", selected.exam.exam_status],
                        ["Scheduled Date", displayDate(selected.exam.exam_date)],
                        ["Start Time", displayTime(selected.exam.start_time)],
                        ["Duration", selected.exam.duration_minutes == null
                          ? "—"
                          : `${selected.exam.duration_minutes} minutes`],
                        ["Created At", displayDateTime(selected.exam.created_at)],
                        ["Total Marks", String(selected.exam.total_marks)],
                        ["Result Published",
                          Number(selected.exam.result_published) === 1
                            ? "Yes"
                            : "No"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="bg-slate-50 border rounded-lg p-4"
                        >
                          <p className="text-xs text-slate-500">
                            {label}
                          </p>
                          <p className="font-semibold mt-2 break-words">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ATTEMPT SUMMARY */}
                  <section className="flex flex-wrap gap-3">
                    <div className="bg-blue-50 text-blue-800 rounded-lg px-4 py-3">
                      <Users size={17} className="inline mr-2" />
                      Students Attempted: {selected.studentsAttempted}
                    </div>
                    <div className="bg-purple-50 text-purple-800 rounded-lg px-4 py-3">
                      <Clock3 size={17} className="inline mr-2" />
                      Total Attempts: {selected.totalAttempts}
                    </div>
                  </section>

                  {/* STUDENT RESULTS */}
                  <section>
                    <h3 className="text-lg font-bold mb-3">
                      Student Marks & Grades
                    </h3>

                    {selected.students.length === 0 ? (
                      <p className="text-slate-500">
                        No enrolled students found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="p-3">Student</th>
                              <th className="p-3">Marks</th>
                              <th className="p-3">Grade</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Attempts</th>
                              <th className="p-3">Feedback</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selected.students.map(student => (
                              <tr key={student.student_id}>
                                <td className="p-3">
                                  <p className="font-semibold">
                                    {student.student_name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {student.student_email}
                                  </p>
                                </td>
                                <td className="p-3">
                                  {student.marks_obtained == null
                                    ? "—"
                                    : `${student.marks_obtained} / ${selected.exam.total_marks}`}
                                </td>
                                <td className="p-3">
                                  {student.grade || "—"}
                                </td>
                                <td className="p-3">
                                  {student.result_status}
                                </td>
                                <td className="p-3">
                                  {student.attempts.length}
                                </td>
                                <td className="p-3">
                                  {student.feedback || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* EVERY ATTEMPT */}
                  <section>
                    <h3 className="text-lg font-bold mb-3">
                      Student Exam Attempt History
                    </h3>

                    {selected.students.every(
                      student => student.attempts.length === 0
                    ) ? (
                      <p className="text-slate-500">
                        No online exam attempts recorded.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {selected.students
                          .filter(student => student.attempts.length > 0)
                          .map(student => (
                            <div
                              key={student.student_id}
                              className="border rounded-lg overflow-hidden"
                            >
                              <div className="bg-slate-50 p-3 font-semibold">
                                {student.student_name}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                  <thead className="border-b text-slate-500">
                                    <tr>
                                      <th className="p-3">Attempt</th>
                                      <th className="p-3">Started At</th>
                                      <th className="p-3">Submitted At</th>
                                      <th className="p-3">Status</th>
                                      <th className="p-3">Score</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {student.attempts.map(attempt => (
                                      <tr key={attempt.attempt_id}>
                                        <td className="p-3">
                                          #{attempt.attempt_number}
                                        </td>
                                        <td className="p-3">
                                          {displayDateTime(attempt.started_at)}
                                        </td>
                                        <td className="p-3">
                                          {attempt.submitted_at
                                            ? displayDateTime(attempt.submitted_at)
                                            : "Not submitted"}
                                        </td>
                                        <td className="p-3">
                                          {attempt.status}
                                        </td>
                                        <td className="p-3">
                                          {attempt.total_score == null
                                            ? "—"
                                            : `${attempt.total_score} / ${selected.exam.total_marks}`}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
