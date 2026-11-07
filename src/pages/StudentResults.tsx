
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import {
  ArrowLeft,
  BarChart3,
  Award,
  CheckCircle,
  RefreshCw,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";

type ExamResult = {
  id: number;
  title: string;
  exam_type: string;
  exam_mode: string;
  course_title: string;
  instructor_name: string;
  exam_date: string;
  total_marks: number;
  marks_obtained: number | string | null;
  grade: string | null;
  feedback: string | null;
  result_published: number;
  result_status: string;
};

type ResultsResponse = {
  exams: ExamResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

function StudentResults() {
  const navigate = useNavigate();

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const getStudentId = (): number | null => {
    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      const id = Number(user.id);

      if (
        user.role !== "student" ||
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !user.token
      ) {
        return null;
      }

      return id;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const studentId = getStudentId();

    if (!studentId) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    const loadResults = async () => {
      setLoading(true);
      setError("");

      try {
        const allResults: ExamResult[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const response = await apiFetch(
            `/api/student/exams/${studentId}` +
              `?filter=results&page=${currentPage}&limit=50`,
            { signal: controller.signal }
          );

          const data: ResultsResponse =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || "Failed to load results."
            );
          }

          if (!Array.isArray(data.exams)) {
            throw new Error("Invalid results response.");
          }

          allResults.push(...data.exams);

          totalPages = Math.max(
            1,
            Number(data.pagination?.totalPages || 1)
          );

          currentPage++;
        } while (
          currentPage <= totalPages &&
          !controller.signal.aborted
        );

        if (!controller.signal.aborted) {
          const publishedOnlineResults = allResults.filter(
            (exam) =>
              exam.exam_mode === "Online" &&
              Number(exam.result_published) === 1 &&
              exam.result_status === "Graded" &&
              exam.marks_obtained !== null
          );

          setResults(publishedOnlineResults);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load results."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadResults();

    return () => controller.abort();
  }, [navigate, refreshKey]);

  const totalObtained = results.reduce(
    (sum, result) =>
      sum + Number(result.marks_obtained || 0),
    0
  );

  const totalPossible = results.reduce(
    (sum, result) =>
      sum + Number(result.total_marks || 0),
    0
  );

  const overallPercentage =
    totalPossible > 0
      ? (totalObtained / totalPossible) * 100
      : null;

  const completedExams = results.length;

  const courseCount = new Set(
    results.map((result) => result.course_title)
  ).size;

  const formatDate = (value: string) => {
    if (!value) return "N/A";

    const date = value.slice(0, 10);
    const parts = date.split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}
      <header className="bg-white border-b min-h-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/student-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={22} />
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Results & Grades
            </h1>

            <p className="text-sm text-slate-500">
              Your published examination results
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="p-2 rounded-lg hover:bg-slate-100"
          title="Refresh Results"
        >
          <RefreshCw size={20} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6">

        {/* BANNER */}
        <div className="bg-purple-600 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <BarChart3 size={30} />
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                Academic Results
              </h2>

              <p className="text-purple-100 mt-1">
                View your real Online Exam marks, grades
                and instructor feedback.
              </p>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-slate-500">
              Overall Exam Percentage
            </p>

            <h2 className="text-3xl font-bold text-purple-600 mt-2">
              {loading || overallPercentage === null
                ? "—"
                : `${overallPercentage.toFixed(1)}%`}
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              Based on published exam marks
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-slate-500">
              Results Published
            </p>

            <h2 className="text-3xl font-bold text-blue-600 mt-2">
              {loading ? "—" : completedExams}
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              Graded online examinations
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-slate-500">
              Courses With Results
            </p>

            <h2 className="text-3xl font-bold text-green-600 mt-2">
              {loading ? "—" : courseCount}
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              Courses with published exam results
            </p>
          </div>

        </div>

        {/* RESULTS TABLE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-slate-800">
              Published Exam Results
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Only results published by your instructors
              are displayed.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">
              Loading your results...
            </div>
          ) : error ? (
            <div
              role="alert"
              className="p-10 text-center text-red-600"
            >
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardCheck
                size={40}
                className="mx-auto text-slate-400 mb-3"
              />

              <p className="font-semibold text-slate-700">
                No published results yet
              </p>

              <p className="text-sm text-slate-500 mt-2">
                Your results will appear here after
                your instructor publishes them.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-4">
                      Course / Exam
                    </th>
                    <th className="text-center px-6 py-4">
                      Type
                    </th>
                    <th className="text-center px-6 py-4">
                      Date
                    </th>
                    <th className="text-center px-6 py-4">
                      Obtained
                    </th>
                    <th className="text-center px-6 py-4">
                      Total
                    </th>
                    <th className="text-center px-6 py-4">
                      Percentage
                    </th>
                    <th className="text-center px-6 py-4">
                      Grade
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((result) => {
                    const obtained = Number(
                      result.marks_obtained || 0
                    );
                    const maximum = Number(
                      result.total_marks || 0
                    );

                    const percentage =
                      maximum > 0
                        ? (obtained / maximum) * 100
                        : null;

                    return (
                      <tr
                        key={result.id}
                        className="border-t hover:bg-slate-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-800">
                            {result.course_title}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            <BookOpen
                              size={13}
                              className="inline mr-1"
                            />
                            {result.title}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            {result.instructor_name}
                          </p>
                        </td>

                        <td className="text-center px-6 py-5">
                          {result.exam_type}
                        </td>

                        <td className="text-center px-6 py-5">
                          {formatDate(result.exam_date)}
                        </td>

                        <td className="text-center px-6 py-5 font-semibold">
                          {obtained}
                        </td>

                        <td className="text-center px-6 py-5">
                          {maximum}
                        </td>

                        <td className="text-center px-6 py-5">
                          {percentage === null
                            ? "—"
                            : `${percentage.toFixed(1)}%`}
                        </td>

                        <td className="text-center px-6 py-5">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                            <CheckCircle size={15} />
                            {result.grade || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* INSTRUCTOR FEEDBACK */}
        {!loading && !error && results.some(
          (result) => Boolean(result.feedback)
        ) && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <Award size={24} className="text-yellow-600" />

              <h3 className="font-bold text-slate-800">
                Instructor Feedback
              </h3>
            </div>

            <div className="space-y-4">
              {results
                .filter((result) => Boolean(result.feedback))
                .map((result) => (
                  <div
                    key={result.id}
                    className="border rounded-lg p-4"
                  >
                    <p className="font-semibold text-slate-800">
                      {result.course_title} — {result.title}
                    </p>

                    <p className="text-sm text-slate-600 mt-2">
                      {result.feedback}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default StudentResults;
