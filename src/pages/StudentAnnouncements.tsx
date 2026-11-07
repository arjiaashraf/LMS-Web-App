
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch as fetch } from "../services/api";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Award,
  Clock,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  LockKeyhole,
  Timer,
  CalendarClock,
} from "lucide-react";


type ExamFilter = "all" | "upcoming" | "results";

type Exam = {
  id: number;
  title: string;
  exam_type: string;
  exam_date: string;
  total_marks: number;
  course_title: string;
  instructor_name: string;
  course_batch_id: number;
  timing_days: string | null;

  exam_start_time: string | null;
  batch_start_time: string | null;
  batch_end_time: string | null;

  exam_status: "Draft" | "Published";
  exam_mode: "Online" | "Offline"; // Legacy Offline rows may still exist in DB.
  duration_minutes: number | null;
  attempt_limit: number;
  result_published: number;

  extension_id: number | null;
  extension_end_at: string | null;

  marks_obtained: number | string | null;
  grade: string | null;
  feedback: string | null;
  result_status: string;
};

type ExamResponse = {
  exams: Exam[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

type AttemptSummary = {
  exam_id: number;
  attempt_id: number;
  attempt_number: number;
  status: "InProgress" | "Submitted" | "PendingReview" | "Graded";
  expires_at_unix: number | null;
};

type AttemptResponse = {
  attempts: AttemptSummary[];
  message?: string;
};

type StartExamResponse = {
  message: string;
  attempt_id: number;
  exam_id: number;
  attempt_number: number;
  expires_at_unix: number;
  server_now_unix: number;
  resumed: boolean;
};

type Availability = {
  label: string;
  canStart: boolean;
  message: string;
};

function getStudentId(): number | null {
  try {
    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    const id = Number(user.id);

    if (
      String(user.role).toLowerCase() !== "student" ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return null;
    }

    return id;
  } catch {
    return null;
  }
}

// Format date without UTC timezone shifting.
function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";

  const datePart = value.slice(0, 10);
  const parts = datePart.split("-").map(Number);

  if (
    parts.length !== 3 ||
    parts.some((value) => !Number.isFinite(value))
  ) {
    return "Not scheduled";
  }

  const [year, month, day] = parts;

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Not scheduled";
  }

  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Schedules are stored in Pakistan Standard Time (UTC+05:00).
// Database/server must use the same agreed timezone.
function parsePakistanDateTime(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined
): number | null {
  if (!dateValue || !timeValue) return null;

  const datePart = dateValue.slice(0, 10);
  const timePart = timeValue.slice(0, 8);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timePart)) {
    return null;
  }

  const normalizedTime =
    timePart.length === 5
      ? `${timePart}:00`
      : timePart;

  const timestamp = new Date(
    `${datePart}T${normalizedTime}+05:00`
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function getExamStart(exam: Exam): number | null {
  return parsePakistanDateTime(
    exam.exam_date,
    exam.exam_start_time
  );
}

function getExamEnd(exam: Exam): number | null {
  // Individual extension closing time takes priority.
  if (exam.extension_id && exam.extension_end_at) {
    const extensionDate = exam.extension_end_at.slice(0, 10);
    const extensionTime = exam.extension_end_at.slice(11, 19);

    return parsePakistanDateTime(
      extensionDate,
      extensionTime
    );
  }

  const start = getExamStart(exam);

  if (
    start === null ||
    !exam.duration_minutes ||
    Number(exam.duration_minutes) <= 0
  ) {
    return null;
  }

  return start + Number(exam.duration_minutes) * 60_000;
}

function formatTime(time: string | null): string {
  return time?.slice(0, 5) || "--:--";
}

export default function StudentExams() {
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);

  const [attemptByExam, setAttemptByExam] = useState<
    Record<number, AttemptSummary>
  >({});

  const [filter, setFilter] = useState<ExamFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [startingExamId, setStartingExamId] =
    useState<number | null>(null);

  const [startErrors, setStartErrors] = useState<
    Record<number, string>
  >({});

  // Refresh availability every 10 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // ========== LOAD STUDENT EXAMS ==========

  useEffect(() => {
    const studentId = getStudentId();

    if (!studentId) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    async function loadExams() {
      setLoading(true);
      setError("");

      try {
        const examsUrl =
          `/api/student/exams/${studentId}` +
          `?page=${page}&limit=10&filter=${filter}`;

        const statusesUrl =
          `/api/student/exam-attempt-statuses/${studentId}`;

        const [examResponse, statusResponse] =
          await Promise.all([
            fetch(examsUrl, {
              signal: controller.signal,
            }),
            fetch(statusesUrl, {
              signal: controller.signal,
            }),
          ]);

        const examData: ExamResponse =
          await examResponse.json();

        const statusData: AttemptResponse =
          await statusResponse.json();

        if (!examResponse.ok) {
          throw new Error(
            examData.message || "Failed to load exams."
          );
        }

        if (!statusResponse.ok) {
          throw new Error(
            statusData.message ||
              "Failed to load attempt statuses."
          );
        }

        if (controller.signal.aborted) return;

        const mapping: Record<number, AttemptSummary> = {};

        for (const attempt of statusData.attempts || []) {
          mapping[Number(attempt.exam_id)] = attempt;
        }

        setAttemptByExam(mapping);
        setExams(
          Array.isArray(examData.exams)
              ? examData.exams.filter((exam) => exam.exam_mode === "Online")
              : []
        );

        setTotalPages(
          Math.max(1, examData.pagination?.totalPages || 1)
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load examinations."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadExams();

    return () => controller.abort();
  }, [navigate, page, filter, reloadKey]);

  const changeFilter = (value: ExamFilter) => {
    setFilter(value);
    setPage(1);
  };

  // ========== EXAM AVAILABILITY ==========

  function getAvailability(exam: Exam): Availability {
    if (exam.exam_status !== "Published") {
      return {
        label: "Draft",
        canStart: false,
        message: "Exam has not been published.",
      };
    }

    if (exam.exam_mode !== "Online") {
      return {
        label: "Unavailable",
        canStart: false,
        message: "This legacy exam is not configured for online attempts.",
      };
    }

    const start = getExamStart(exam);
    const end = getExamEnd(exam);

    if (
      start === null ||
      end === null ||
      end <= start
    ) {
      return {
        label: "Not Ready",
        canStart: false,
        message: "Exam schedule is incomplete.",
      };
    }

    const latest = attemptByExam[exam.id];

    // Published result always takes precedence.
    if (Number(exam.result_published) === 1) {
      return {
        label: "Result Published",
        canStart: false,
        message: "Your examination result is available.",
      };
    }

    if (latest?.status === "InProgress") {
      const expiry =
        latest.expires_at_unix == null
          ? null
          : Number(latest.expires_at_unix) * 1000;

      if (
        (expiry !== null && now >= expiry) ||
        now >= end
      ) {
        return {
          label: "Expired / Incomplete",
          canStart: false,
          message:
            "Your previous attempt expired. It must be finalized before another attempt.",
        };
      }

      return {
        label: "In Progress",
        canStart: true,
        message:
          "Your examination is in progress. Resume before the timer expires.",
      };
    }

    const hasCompletedAttempt =
      latest &&
      ["Submitted", "PendingReview", "Graded"].includes(
        latest.status
      );

    const usedAttempts = latest
      ? Number(latest.attempt_number)
      : 0;

    const allowedAttempts = Math.max(
      1,
      Number(exam.attempt_limit || 1)
    );

    const canRetake =
      Boolean(exam.extension_id) &&
      Boolean(hasCompletedAttempt) &&
      usedAttempts < allowedAttempts;

    if (hasCompletedAttempt && !canRetake) {
      return {
        label: "Submitted",
        canStart: false,
        message:
          "You have submitted this examination.",
      };
    }
    if (hasCompletedAttempt && !canRetake) {
  return {
    label: "Submitted",
    canStart: false,
    message: "You have submitted this examination.",
  };
}

if (now < start) {
  return {
    label: canRetake ? "Retake Upcoming" : "Upcoming",
    canStart: false,
    message: canRetake
      ? "Your instructor has scheduled an additional attempt."
      : "Exam has not started yet.",
  };
}

    if (now < start) {
      return {
        label: canRetake
          ? "Retake Upcoming"
          : "Upcoming",
        canStart: false,
        message: exam.extension_id
          ? `Your individual exam window opens on ${formatDate(
              exam.exam_date
            )} at ${formatTime(exam.exam_start_time)}.`
          : `Exam opens on ${formatDate(
              exam.exam_date
            )} at ${formatTime(exam.exam_start_time)}.`,
      };
    }

    if (now >= end) {
      if (hasCompletedAttempt) {
        return {
          label: "Submitted",
          canStart: false,
          message:
            "The retake window has closed. Your previous submission is retained.",
        };
      }

      return {
        label: "Missed",
        canStart: false,
        message:
          "You did not attempt this exam before the closing time.",
      };
    }

    if (usedAttempts >= allowedAttempts) {
      return {
        label: "Attempt Limit Reached",
        canStart: false,
        message:
          "You have used all permitted attempts.",
      };
    }

    if (canRetake) {
      return {
        label: "Retake Available",
        canStart: true,
        message:
          "Your instructor has allowed an additional attempt.",
      };
    }

    return {
      label: "Available",
      canStart: true,
      message: exam.extension_id
        ? "Your individual exam extension is available now."
        : "Your examination is available now.",
    };
  }

  // ========== START / RESUME EXAM ==========

  async function handleStartExam(exam: Exam) {
    if (startingExamId !== null) return;

    const studentId = getStudentId();

    if (!studentId) {
      navigate("/login", { replace: true });
      return;
    }

    const availability = getAvailability(exam);

    if (!availability.canStart) {
      setStartErrors((prev) => ({
        ...prev,
        [exam.id]: availability.message,
      }));
      return;
    }

    setStartErrors((prev) => ({
      ...prev,
      [exam.id]: "",
    }));

    setStartingExamId(exam.id);

    try {
      const response = await fetch(
        `/api/student/exams/${exam.id}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_id: studentId,
          }),
        }
      );

      const data: StartExamResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to start examination."
        );
      }

      if (!data.attempt_id) {
        throw new Error(
          "Invalid attempt response from server."
        );
      }

      navigate(
        `/student/exam-attempt/${data.attempt_id}`,
        {
          state: {
            examId: exam.id,
            examTitle: exam.title,
            courseTitle: exam.course_title,
            totalMarks: exam.total_marks,
            durationMinutes: exam.duration_minutes,
            expiresAtUnix: data.expires_at_unix,
            serverNowUnix: data.server_now_unix,
            resumed: data.resumed,
          },
        }
      );
    } catch (err) {
      setStartErrors((prev) => ({
        ...prev,
        [exam.id]:
          err instanceof Error
            ? err.message
            : "Unable to start exam.",
      }));
    } finally {
      setStartingExamId(null);
    }
  }

  function statusClasses(label: string): string {
    if (
      [
        "Available",
        "Retake Available",
        "Submitted",
        "Result Published",
      ].includes(label)
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      [
        "Upcoming",
        "Retake Upcoming",
        "In Progress",
      ].includes(label)
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      [
        "Missed",
        "Expired / Incomplete",
        "Attempt Limit Reached",
      ].includes(label)
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-slate-100 text-slate-700";
  }

  // ========== FRONTEND ==========

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b min-h-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/student-dashboard"
            aria-label="Back to dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={22} />
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Exams & Results
            </h1>

            <p className="text-sm text-slate-500">
              Your enrolled batch assessments
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Refresh exams"
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* BANNER */}
        <section className="bg-purple-600 rounded-xl p-6 text-white mb-6 flex gap-4 items-center">
          <div className="bg-white/20 p-3 rounded-lg">
            <ClipboardList size={30} />
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              My Examinations
            </h2>

            <p className="text-purple-100 mt-1">
              View upcoming exams, attempt online papers,
              and check published results.
            </p>
          </div>
        </section>

        {/* FILTERS */}
        <div
          className="flex flex-wrap gap-2 mb-5"
          role="group"
          aria-label="Filter exams"
        >
          {(
            [
              ["all", "All Exams"],
              ["upcoming", "Upcoming"],
              ["results", "My Results"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => changeFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-lg px-4 py-2 font-medium text-sm ${
                filter === value
                  ? "bg-purple-600 text-white"
                  : "bg-white text-slate-700 border hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* LOAD / ERROR */}
        {loading ? (
          <p className="text-slate-500 bg-white rounded-xl p-8 text-center">
            Loading exams...
          </p>
        ) : error ? (
          <div
            role="alert"
            className="bg-white p-6 rounded-xl text-red-600"
          >
            {error}

            <button
              type="button"
              className="underline ml-2"
              onClick={() =>
                setReloadKey((key) => key + 1)
              }
            >
              Retry
            </button>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white p-10 rounded-xl text-center text-slate-500">
            No online examinations found.
          </div>
        ) : (
          <div className="space-y-5">
            {exams.map((exam) => {
              const availability = getAvailability(exam);

              const hasResult =
                Number(exam.result_published) === 1 &&
                exam.result_status === "Graded";

              const isExtended =
                exam.extension_id !== null &&
                exam.extension_id !== undefined;

              const closingTime = getExamEnd(exam);

              const startLabel =
                availability.label === "In Progress"
                  ? "Resume Exam"
                  : availability.label === "Retake Available"
                    ? "Start Retake"
                    : "Start Exam";

              return (
                <article
                  key={exam.id}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex gap-4">
                    <div className="bg-purple-100 text-purple-600 p-3 rounded-lg h-fit">
                      <BookOpen size={23} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* EXAM TITLE */}
                      <div className="flex flex-wrap justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-800">
                          {exam.title}
                        </h3>

                        <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full h-fit">
                          {exam.exam_type}
                        </span>
                      </div>

                      <p className="text-slate-600 text-sm mt-1">
                        {exam.course_title} ·{" "}
                        {exam.instructor_name}
                      </p>

                      {/* INDIVIDUAL EXTENSION */}
                      {isExtended && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                          <div className="flex items-center gap-2 font-semibold">
                            <CalendarClock size={17} />
                            Individual Extension / Retake
                          </div>

                          <p className="mt-1">
                            Your instructor has assigned you
                            a separate exam schedule.
                          </p>
                        </div>
                      )}

                      {/* EXAM DETAILS */}
                      <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-500 mt-4">
                        <span className="inline-flex gap-2 items-center">
                          <CalendarDays size={16} />
                          {formatDate(exam.exam_date)}
                        </span>

                        <span className="inline-flex gap-2 items-center">
                          <Award size={16} />
                          {exam.total_marks} total marks
                        </span>

                        <span className="inline-flex gap-2 items-center">
                          <BookOpen size={16} />
                          Online
                        </span>

                        {(
                          <>
                            <span className="inline-flex gap-2 items-center">
                              <Timer size={16} />
                              {exam.duration_minutes || 0} minutes
                            </span>

                            <span className="inline-flex gap-2 items-center">
                              <Clock size={16} />
                              Opens:{" "}
                              {formatTime(exam.exam_start_time)}
                            </span>

                            <span className="inline-flex gap-2 items-center">
                              <RotateCcw size={16} />
                              {exam.attempt_limit || 1} attempt(s)
                            </span>
                          </>
                        )}
                      </div>

                      {isExtended && closingTime !== null && (
                        <p className="mt-3 text-sm text-amber-800">
                          Individual closing time:{" "}
                          <strong>
                            {new Date(
                              closingTime
                            ).toLocaleString("en-PK", {
                              timeZone: "Asia/Karachi",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </strong>
                        </p>
                      )}

                      {/* STATUS */}
                      <div className="mt-5 pt-4 border-t space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusClasses(
                              availability.label
                            )}`}
                          >
                            {availability.label}
                          </span>

                          <span className="text-sm text-slate-500">
                            {availability.message}
                          </span>
                        </div>

                        {/* PUBLISHED RESULT */}
                        {hasResult ? (
                          <div className="bg-green-50 border border-green-100 p-4 rounded-lg space-y-2 text-sm">
                            <p className="font-semibold text-green-700 flex items-center gap-2">
                              <CheckCircle size={17} />
                              Result Published
                            </p>

                            <p>
                              Marks:{" "}
                              <strong>
                                {exam.marks_obtained} /{" "}
                                {exam.total_marks}
                              </strong>

                              {exam.grade && (
                                <>
                                  {" · "}Grade:{" "}
                                  <strong>
                                    {exam.grade}
                                  </strong>
                                </>
                              )}
                            </p>

                            {exam.feedback && (
                              <p className="text-slate-600">
                                Instructor Feedback:{" "}
                                {exam.feedback}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-amber-700 font-medium">
                            Result not published yet
                          </p>
                        )}

                        {/* START / RESUME */}
                        {exam.exam_mode === "Online" &&
                          exam.exam_status === "Published" && (
                            <div className="space-y-3">
                              <button
                                type="button"
                                disabled={
                                  !availability.canStart ||
                                  startingExamId !== null
                                }
                                onClick={() =>
                                  void handleStartExam(exam)
                                }
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {startingExamId === exam.id ? (
                                  <>
                                    <RefreshCw
                                      size={18}
                                      className="animate-spin"
                                    />
                                    Starting...
                                  </>
                                ) : availability.canStart ? (
                                  <>
                                    <Play size={18} />
                                    {startLabel}
                                  </>
                                ) : (
                                  <>
                                    <LockKeyhole size={18} />
{availability.label === "Retake Upcoming"
  ? "Retake Opens on Scheduled Date"
  : availability.label === "Upcoming"
    ? "Exam Not Started Yet"
    : availability.label === "Submitted"
      ? "Already Submitted"
      : availability.label === "Result Published"
        ? "Result Published"
        : "Exam Unavailable"}
                                  </>
                                )}
                              </button>

                              {startErrors[exam.id] && (
                                <div
                                  role="alert"
                                  className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm"
                                >
                                  <AlertCircle size={18} />
                                  {startErrors[exam.id]}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-6 text-sm text-slate-600">
          <button
            type="button"
            disabled={loading || page === 1}
            onClick={() =>
              setPage((current) => current - 1)
            }
            className="px-4 py-2 bg-white rounded-lg border disabled:opacity-40"
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() =>
              setPage((current) => current + 1)
            }
            className="px-4 py-2 bg-white rounded-lg border disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}
