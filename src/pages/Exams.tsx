
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Eye,
  GraduationCap,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

import { apiFetch } from "../services/api";

type Exam = {
  id: number;
  title: string;
  exam_type: string;
  exam_mode: string;
  exam_status: string;
  total_marks: number;
  result_published: number;
  course_batch_id: number;
  exam_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  attempt_limit: number;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  enrolled_students: number;
  submitted_attempts: number;
  graded_results: number;
};

type StudentResult = {
  student_id: number;
  student_name: string;
  student_email: string;
  result_id: number | null;
  marks_obtained: number | null;
  grade: string | null;
  feedback: string | null;
  result_status: string;
  attempts_used: number;
  latest_attempt_status: string | null;
};

type OverviewResponse = {
  totalExams: number;
  publishedExams: number;
  publishedResults: number;
  exams: Exam[];
};

type DetailsResponse = {
  exam: Exam;
  students: StudentResult[];
};

const emptyOverview: OverviewResponse = {
  totalExams: 0,
  publishedExams: 0,
  publishedResults: 0,
  exams: [],
};

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "—";
  return value.slice(0, 10);
};

function AdminExams() {
  const navigate = useNavigate();

  const [overview, setOverview] =
    useState<OverviewResponse>(emptyOverview);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedExam, setSelectedExam] =
    useState<Exam | null>(null);

  const [students, setStudents] =
    useState<StudentResult[]>([]);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState("");

  const fetchOverview = useCallback(async (
    showLoading = false
  ) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/exams-overview`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load exams."
        );
      }

      setOverview({
        totalExams: Number(data.totalExams || 0),
        publishedExams: Number(data.publishedExams || 0),
        publishedResults: Number(data.publishedResults || 0),
        exams: Array.isArray(data.exams)
          ? data.exams
          : [],
      });

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load exams."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let user: { role?: string } = {};

    try {
      user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch {
      navigate("/login");
      return;
    }

    if (user.role !== "admin") {
      navigate("/login");
      return;
    }

    void fetchOverview(true);

    const interval = window.setInterval(() => {
      void fetchOverview();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [navigate, fetchOverview]);

  const openExamDetails = async (exam: Exam) => {
    setSelectedExam(exam);
    setStudents([]);
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await apiFetch(
        `/api/admin/exams/${exam.id}/details`
      );

      const data: DetailsResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          (data as unknown as { message?: string }).message ||
          "Failed to load exam details."
        );
      }

      setSelectedExam({
        ...exam,
        ...data.exam,
      });

      setStudents(
        Array.isArray(data.students) ? data.students : []
      );
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to load student results."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredExams = useMemo(() => {
    const term = search.trim().toLowerCase();

    return overview.exams.filter((exam) => {
      const matchesSearch =
        exam.title.toLowerCase().includes(term) ||
        exam.course_title.toLowerCase().includes(term) ||
        exam.teacher_name.toLowerCase().includes(term) ||
        exam.exam_type.toLowerCase().includes(term);

      const matchesFilter =
        filter === "All" ||
        (filter === "Published" &&
          exam.exam_status === "Published") ||
        (filter === "Draft" &&
          exam.exam_status === "Draft") ||
        (filter === "Results Published" &&
          Number(exam.result_published) === 1);

      return matchesSearch && matchesFilter;
    });
  }, [overview.exams, search, filter]);

  const cards = [
    {
      label: "Total Exams",
      value: overview.totalExams,
      icon: ClipboardList,
      color: "text-purple-600",
      background: "bg-purple-100",
    },
    {
      label: "Published Exams",
      value: overview.publishedExams,
      icon: BookOpen,
      color: "text-blue-600",
      background: "bg-blue-100",
    },
    {
      label: "Results Published",
      value: overview.publishedResults,
      icon: GraduationCap,
      color: "text-green-600",
      background: "bg-green-100",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin-dashboard"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Back to Admin Dashboard"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <ClipboardList size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Exams & Results
              </h1>
              <p className="text-sm text-slate-500">
                Monitor instructor exams and student performance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchOverview(true)}
            className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border p-6 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-500">
                      {card.label}
                    </p>
                    <h2 className="text-3xl font-bold text-slate-800 mt-2">
                      {loading ? "..." : card.value}
                    </h2>
                  </div>

                  <div
                    className={`${card.background} ${card.color} p-3 rounded-lg`}
                  >
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* EXAM LIST */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  All Instructor Exams
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  View exams, results and student attempts
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search exam, course, teacher..."
                    className="border rounded-lg pl-9 pr-3 py-2.5 text-sm w-full sm:w-64 outline-none focus:border-purple-500"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2.5 text-sm bg-white"
                >
                  <option value="All">All Exams</option>
                  <option value="Published">Published Exams</option>
                  <option value="Draft">Draft Exams</option>
                  <option value="Results Published">
                    Results Published
                  </option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="mx-6 mt-5 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="p-8 text-center text-slate-500">
              Loading exams...
            </p>
          ) : filteredExams.length === 0 ? (
            <p className="p-8 text-center text-slate-500">
              No exams found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Course</th>
                    <th className="p-4">Instructor</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Students</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Results</th>
                    <th className="p-4">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredExams.map((exam) => (
                    <tr
                      key={exam.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">
                          {exam.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {exam.exam_type} · {exam.exam_mode}
                        </p>
                      </td>

                      <td className="p-4">
                        {exam.course_title}
                      </td>

                      <td className="p-4">
                        {exam.teacher_name}
                      </td>

                      <td className="p-4">
                        {dateLabel(exam.exam_date)}
                      </td>

                      <td className="p-4">
                        {exam.enrolled_students}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            exam.exam_status === "Published"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {exam.exam_status}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`text-xs font-medium ${
                            Number(exam.result_published) === 1
                              ? "text-green-700"
                              : "text-orange-600"
                          }`}
                        >
                          {Number(exam.result_published) === 1
                            ? "Published"
                            : "Not Published"}
                        </span>
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() =>
                            void openExamDetails(exam)
                          }
                          className="inline-flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700"
                        >
                          <Eye size={16} />
                          View Details
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

      {/* DETAILS MODAL */}
      {selectedExam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-5 flex items-start justify-between gap-4 z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedExam.title}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedExam.course_title} · Instructor:{" "}
                  {selectedExam.teacher_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedExam(null)}
                aria-label="Close details"
                className="text-slate-500 hover:text-slate-900 p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* EXAM DETAILS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <Calendar size={14} />
                    Exam Date
                  </p>
                  <p className="font-bold mt-2">
                    {dateLabel(selectedExam.exam_date)}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">
                    Exam Type
                  </p>
                  <p className="font-bold mt-2">
                    {selectedExam.exam_type}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">
                    Total Marks
                  </p>
                  <p className="font-bold mt-2">
                    {selectedExam.total_marks}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">
                    Results Status
                  </p>
                  <p
                    className={`font-bold mt-2 ${
                      Number(selectedExam.result_published) === 1
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {Number(selectedExam.result_published) === 1
                      ? "Published"
                      : "Not Published"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="bg-slate-100 px-3 py-2 rounded-lg">
                  Mode: {selectedExam.exam_mode}
                </span>
                <span className="bg-slate-100 px-3 py-2 rounded-lg">
                  Start: {selectedExam.start_time?.slice(0, 5) || "—"}
                </span>
                <span className="bg-slate-100 px-3 py-2 rounded-lg">
                  Duration: {selectedExam.duration_minutes ?? "—"} min
                </span>
                <span className="bg-slate-100 px-3 py-2 rounded-lg">
                  Attempt Limit: {selectedExam.attempt_limit}
                </span>
              </div>

              {/* STUDENTS */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users size={20} className="text-purple-600" />
                  <h3 className="text-lg font-bold text-slate-800">
                    Student Results & Attempts
                  </h3>
                </div>

                {detailsLoading ? (
                  <p className="text-slate-500 py-6">
                    Loading student results...
                  </p>
                ) : detailsError ? (
                  <p className="text-red-600 py-4">
                    {detailsError}
                  </p>
                ) : students.length === 0 ? (
                  <p className="text-slate-500 py-6">
                    No active enrolled students found.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b text-slate-600">
                        <tr>
                          <th className="p-3">Student</th>
                          <th className="p-3">Marks</th>
                          <th className="p-3">Grade</th>
                          <th className="p-3">Result Status</th>
                          <th className="p-3">Attempts</th>
                          <th className="p-3">Latest Attempt</th>
                          <th className="p-3">Feedback</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {students.map((student) => (
                          <tr key={student.student_id}>
                            <td className="p-3">
                              <p className="font-semibold">
                                {student.student_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {student.student_email}
                              </p>
                            </td>

                            <td className="p-3 font-semibold">
                              {student.marks_obtained === null
                                ? "—"
                                : `${student.marks_obtained} / ${selectedExam.total_marks}`}
                            </td>

                            <td className="p-3">
                              {student.grade || "—"}
                            </td>

                            <td className="p-3">
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  student.result_status === "Graded"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {student.result_status}
                              </span>
                            </td>

                            <td className="p-3">
                              {student.attempts_used}
                            </td>

                            <td className="p-3">
                              {student.latest_attempt_status || "Not Started"}
                            </td>

                            <td className="p-3 text-slate-600 max-w-xs">
                              {student.feedback || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 text-xs text-slate-500">
                Admin monitoring only. Exam creation,
                marks editing and result publication
                remain under the instructor module.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminExams;
