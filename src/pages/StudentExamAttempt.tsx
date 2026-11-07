
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Loader2,
  AlertTriangle,
  Send,
  RefreshCw,
  Save,
} from "lucide-react";
import { apiFetch as fetch } from "../services/api";

type QuestionType = "MCQ" | "TrueFalse" | "ShortAnswer";

type Question = {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[] | string | null;
  marks: number | string;
  saved_answer: string | null;
};

type Attempt = {
  id: number;
  exam_id: number;
  exam_title: string;
  course_title: string;
  total_marks: number;
  duration_minutes: number;
  status: string;
  expires_at_unix: number;
  server_now_unix: number;
  attempt_number: number;
};

type PaperResponse = {
  attempt: Attempt;
  questions: Question[];
  message?: string;
  expired?: boolean;
};

type SubmitResponse = {
  message: string;
  attempt_id: number;
  status: string;
  objective_score: number;
  total_marks?: number;
  already_submitted?: boolean;
};

function getStudentId(): number | null {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const id = Number(user.id);

    return (
      String(user.role).toLowerCase() === "student" &&
      Number.isSafeInteger(id) &&
      id > 0
    ) ? id : null;
  } catch {
    return null;
  }
}

function optionList(options: Question["options"]): string[] {
  if (Array.isArray(options)) return options.map(String);

  if (typeof options === "string") {
    try {
      const parsed: unknown = JSON.parse(options);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function timerText(seconds: number) {
  const safe = Math.max(0, seconds);

  return (
    `${String(Math.floor(safe / 60)).padStart(2, "0")}:` +
    `${String(safe % 60).padStart(2, "0")}`
  );
}

export default function StudentExamAttempt() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const id = Number(attemptId);
  const studentId = getStudentId();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<
    Record<number, string>
  >({});

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saveErrors, setSaveErrors] = useState<
    Record<number, string>
  >({});

  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] =
    useState<SubmitResponse | null>(null);

  const [serverExpired, setServerExpired] = useState(false);

  const answersRef = useRef(answers);
  const savedRef = useRef(savedAnswers);

  const inFlight = useRef<Record<number, Promise<void> | undefined>>({});
  const timers = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});

  const deadlineRef = useRef(0);
  const submissionStarted = useRef(false);
  const studentIdRef = useRef(studentId);

  answersRef.current = answers;
  savedRef.current = savedAnswers;
  studentIdRef.current = studentId;

  // ========== LOAD EXAM QUESTIONS ==========

  useEffect(() => {
    if (!studentId) {
      navigate("/login", { replace: true });
      return;
    }

    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Invalid exam attempt ID.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/student/exam-attempts/${id}?student_id=${studentId}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          if (data.expired) setServerExpired(true);

          throw new Error(
            data.message || "Could not load examination."
          );
        }

        const paper: PaperResponse = data;

        setAttempt(paper.attempt);
        setQuestions(paper.questions);

        const initial: Record<number, string> = {};

        for (const question of paper.questions) {
          initial[question.id] = question.saved_answer ?? "";
        }

        setAnswers(initial);
        setSavedAnswers(initial);

        answersRef.current = initial;
        savedRef.current = initial;

        const serverTimeAtResponse =
          Number(paper.attempt.server_now_unix) * 1000;

        const expiry =
          Number(paper.attempt.expires_at_unix) * 1000;

        const timeLeft = Math.max(
          0,
          expiry - serverTimeAtResponse
        );

        deadlineRef.current = Date.now() + timeLeft;

        setRemaining(Math.ceil(timeLeft / 1000));
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load exam."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();

      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, [id, studentId, navigate]);

  // ========== EXAM TIMER ==========

  useEffect(() => {
    if (!attempt || submission) return;

    const tick = () => {
      setRemaining(
        Math.max(
          0,
          Math.ceil(
            (deadlineRef.current - Date.now()) / 1000
          )
        )
      );
    };

    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [attempt, submission]);

  // ========== AUTO SAVE ANSWER ==========

  async function saveQuestion(
    questionId: number,
    value: string
  ): Promise<void> {
    const sid = studentIdRef.current;

    if (
      !sid ||
      submissionStarted.current ||
      Date.now() >= deadlineRef.current
    ) {
      return;
    }

    if (inFlight.current[questionId]) {
      await inFlight.current[questionId];
    }

    if (savedRef.current[questionId] === value) {
      return;
    }

    const promise = (async () => {
      setSaving((prev) => ({
        ...prev,
        [questionId]: true,
      }));

      try {
        const response = await fetch(
          `/api/student/exam-attempts/${id}/answers`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              student_id: sid,
              question_id: questionId,
              answer_text: value,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Auto-save failed."
          );
        }

        savedRef.current = {
          ...savedRef.current,
          [questionId]: value,
        };

        setSavedAnswers((prev) => ({
          ...prev,
          [questionId]: value,
        }));

        setSaveErrors((prev) => ({
          ...prev,
          [questionId]: "",
        }));
      } catch (err) {
        setSaveErrors((prev) => ({
          ...prev,
          [questionId]:
            err instanceof Error
              ? err.message
              : "Save failed",
        }));

        throw err;
      } finally {
        setSaving((prev) => ({
          ...prev,
          [questionId]: false,
        }));
      }
    })();

    inFlight.current[questionId] = promise;

    try {
      await promise;
    } finally {
      delete inFlight.current[questionId];
    }
  }

  function onAnswer(questionId: number, value: string) {
    if (
      submitting ||
      submission ||
      remaining <= 0
    ) {
      return;
    }

    answersRef.current = {
      ...answersRef.current,
      [questionId]: value,
    };

    setAnswers(answersRef.current);

    clearTimeout(timers.current[questionId]);

    timers.current[questionId] = setTimeout(() => {
      void saveQuestion(
        questionId,
        answersRef.current[questionId]
      ).catch(() => {});
    }, 500);
  }

  // ========== FLUSH UNSAVED ANSWERS ==========

  async function saveQuestionForSubmission(
    questionId: number,
    value: string
  ) {
    if (Date.now() >= deadlineRef.current) {
      return;
    }

    const response = await fetch(
      `/api/student/exam-attempts/${id}/answers`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentIdRef.current,
          question_id: questionId,
          answer_text: value,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Question ${questionId}: ${
          data.message || "Unable to save answer."
        }`
      );
    }

    savedRef.current = {
      ...savedRef.current,
      [questionId]: value,
    };

    setSavedAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }

  // ========== SUBMIT EXAM ==========

  async function submitExam(auto = false) {
    if (
      !studentId ||
      submissionStarted.current ||
      submission
    ) {
      return;
    }

    if (
      !auto &&
      !window.confirm(
        "Submit exam? You cannot change answers after submitting."
      )
    ) {
      return;
    }

    submissionStarted.current = true;
    setSubmitting(true);
    setError("");

    const hasTime = Date.now() < deadlineRef.current;

    try {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};

      if (hasTime) {
        await Promise.all(
          Object.values(inFlight.current)
        );

        for (
          const [questionId, value]
          of Object.entries(answersRef.current)
        ) {
          if (
            value !== savedRef.current[Number(questionId)]
          ) {
            await saveQuestionForSubmission(
              Number(questionId),
              value
            );
          }
        }
      }

      const response = await fetch(
        `/api/student/exam-attempts/${id}/submit`,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to submit exam."
        );
      }

      setSubmission(data as SubmitResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed."
      );

      submissionStarted.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  // ========== AUTO SUBMIT ON EXPIRY ==========

  useEffect(() => {
    if (
      attempt &&
      remaining === 0 &&
      !submission &&
      !submissionStarted.current
    ) {
      void submitExam(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, attempt, submission]);

  // ========== LOADING PAGE ==========

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center gap-3 text-slate-600">
        <Loader2 className="animate-spin" size={23} />
        Loading your examination...
      </main>
    );
  }

  // ========== SUBMISSION SUCCESS ==========

  if (submission) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
        <section className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-lg text-center">
          <CheckCircle2
            size={48}
            className="mx-auto text-green-600 mb-3"
          />

          <h1 className="text-2xl font-bold text-slate-800">
            Exam Submitted
          </h1>

          <p className="text-slate-600 mt-3">
            {submission.message}
          </p>

          <p className="text-sm text-slate-500 mt-3">
            Status: {submission.status}
          </p>

          <p className="text-sm text-slate-500 mt-1">
            Objective marks awarded:{" "}
            {submission.objective_score}
          </p>

          {submission.status === "PendingReview" && (
            <p className="text-amber-700 mt-3 text-sm">
              Final marks will be available after instructor
              review and result publication.
            </p>
          )}

          <Link
            to="/student-announcements"
            className="inline-block mt-6 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium"
          >
            Back to My Examinations
          </Link>
        </section>
      </main>
    );
  }

  // ========== EXAM ERROR PAGE ==========

  if (!attempt || questions.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <section className="bg-white rounded-xl shadow-sm p-8 w-full max-w-lg">
          <AlertTriangle className="text-amber-600 mb-3" />

          <h1 className="font-bold text-xl">
            Exam could not be opened
          </h1>

          <p className="text-red-700 mt-3">
            {error || "No exam questions available."}
          </p>

          {serverExpired && (
            <button
              type="button"
              onClick={() => void submitExam(true)}
              disabled={submitting}
              className="bg-purple-600 text-white rounded-lg px-4 py-2 mt-4 disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : "Finalize expired attempt"}
            </button>
          )}

          <Link
            to="/student-announcements"
            className="block mt-5 text-purple-700 underline"
          >
            Back to My Examinations
          </Link>
        </section>
      </main>
    );
  }

  const question = questions[current];

  const selected = answers[question.id] || "";

  const answered = questions.filter(
    (q) => Boolean(answers[q.id]?.trim())
  ).length;

  const expired = remaining === 0;

  const choices = optionList(question.options);

  // ========== EXAMINATION INTERFACE ==========

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}

        <header className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3 items-center">
            <BookOpen
              className="text-purple-600"
              size={28}
            />

            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {attempt.exam_title}
              </h1>

              <p className="text-sm text-slate-500">
                {attempt.course_title} · Attempt{" "}
                {attempt.attempt_number}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono font-bold ${
              remaining <= 60
                ? "bg-red-100 text-red-700"
                : "bg-purple-50 text-purple-700"
            }`}
          >
            <Clock3 size={18} />
            {timerText(remaining)}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-start">

          {/* QUESTION PANEL */}

          <section className="bg-white shadow-sm rounded-xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-4 gap-3">
              <div>
                <h2 className="font-semibold text-slate-800">
                  Question {current + 1} of {questions.length}
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  {question.question_type} · {question.marks} marks
                </p>
              </div>

              <span className="text-sm text-purple-700 bg-purple-50 rounded-lg px-3 py-1">
                {answered}/{questions.length} answered
              </span>
            </div>

            <p className="text-lg font-medium text-slate-800 whitespace-pre-wrap">
              {question.question_text}
            </p>

            {/* MCQ OPTIONS */}

            {question.question_type === "MCQ" && (
              <div className="space-y-3">
                {choices.map((option, index) => (
                  <label
                    key={index}
                    className={`flex gap-3 items-center border rounded-lg p-4 cursor-pointer ${
                      selected === String(index)
                        ? "border-purple-600 bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={String(index)}
                      checked={selected === String(index)}
                      disabled={expired || submitting}
                      onChange={() =>
                        onAnswer(question.id, String(index))
                      }
                      className="accent-purple-600"
                    />

                    <span>
                      {String.fromCharCode(65 + index)}.{" "}
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* TRUE / FALSE */}

            {question.question_type === "TrueFalse" && (
              <div className="space-y-3">
                {["True", "False"].map((value) => (
                  <label
                    key={value}
                    className={`flex gap-3 items-center border rounded-lg p-4 cursor-pointer ${
                      selected === value
                        ? "border-purple-600 bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      checked={selected === value}
                      disabled={expired || submitting}
                      onChange={() =>
                        onAnswer(question.id, value)
                      }
                      className="accent-purple-600"
                    />

                    {value}
                  </label>
                ))}
              </div>
            )}

            {/* SHORT ANSWER */}

            {question.question_type === "ShortAnswer" && (
              <textarea
                value={selected}
                disabled={expired || submitting}
                onChange={(e) =>
                  onAnswer(question.id, e.target.value)
                }
                rows={7}
                maxLength={10000}
                placeholder="Type your answer here..."
                className="w-full border rounded-lg p-4 outline-none focus:border-purple-500 resize-y"
              />
            )}

            {/* AUTO SAVE STATUS */}

            <div className="text-sm flex items-center gap-2">
              {saving[question.id] ? (
                <>
                  <RefreshCw
                    className="animate-spin"
                    size={15}
                  />
                  Saving answer...
                </>
              ) : saveErrors[question.id] ? (
                <span className="text-red-700">
                  {saveErrors[question.id]}
                </span>
              ) : savedAnswers[question.id] === selected ? (
                <span className="text-green-700 inline-flex gap-1 items-center">
                  <Save size={15} />
                  Saved
                </span>
              ) : (
                <span className="text-amber-700">
                  Not saved yet
                </span>
              )}
            </div>

            {/* PREVIOUS / NEXT */}

            <div className="flex items-center justify-between gap-2 border-t pt-5">
              <button
                type="button"
                onClick={() =>
                  setCurrent((c) => Math.max(0, c - 1))
                }
                disabled={current === 0}
                className="border rounded-lg px-4 py-2 disabled:opacity-40 inline-flex gap-2 items-center"
              >
                <ArrowLeft size={16} />
                Previous
              </button>

              {current < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrent((c) =>
                      Math.min(questions.length - 1, c + 1)
                    )
                  }
                  className="rounded-lg bg-purple-600 text-white px-4 py-2 inline-flex gap-2 items-center"
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitExam()}
                  className="bg-green-600 text-white rounded-lg px-4 py-2 disabled:opacity-50 inline-flex gap-2 items-center"
                >
                  <Send size={16} />
                  {submitting
                    ? "Submitting..."
                    : "Submit Exam"}
                </button>
              )}
            </div>
          </section>

          {/* QUESTION NAVIGATOR */}

          <aside className="bg-white shadow-sm rounded-xl p-5 space-y-4">
            <h2 className="font-bold text-slate-800">
              Question Navigator
            </h2>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, index) => (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => setCurrent(index)}
                  className={`h-9 rounded-lg border text-sm font-semibold ${
                    index === current
                      ? "ring-2 ring-purple-500"
                      : ""
                  } ${
                    answers[q.id]?.trim()
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <p className="text-sm text-slate-600">
              Total marks:{" "}
              <strong>{attempt.total_marks}</strong>
            </p>

            <p className="text-sm text-slate-600">
              Answered:{" "}
              <strong>
                {answered} / {questions.length}
              </strong>
            </p>

            <button
              type="button"
              onClick={() => void submitExam()}
              disabled={submitting}
              className="w-full rounded-lg bg-purple-600 text-white py-3 font-semibold disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : "Submit Exam"}
            </button>

            {expired && (
              <p className="text-red-700 text-sm">
                Time expired. Finalizing your answers...
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="text-red-700 bg-red-50 rounded-lg p-3 text-sm"
              >
                {error}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
