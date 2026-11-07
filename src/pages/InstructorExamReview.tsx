
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch as fetch } from "../services/api";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";


type Submission = {
  attempt_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  attempt_number: number;
  status: string;
  total_score: string | number | null;
  submitted_at: string | null;
};

type Question = {
  id: number;
  question_text: string;
  question_type: "MCQ" | "TrueFalse" | "ShortAnswer";
  options: string[] | string | null;
  correct_answer: string | null;
  marks: string | number;
  student_answer: string | null;
  marks_awarded: string | number | null;
  is_correct: number | null;
};

type ReviewData = {
  attempt: {
    id: number;
    exam_title: string;
    student_name: string;
    status: string;
    total_marks: number;
    total_score: string | number | null;
  };
  questions: Question[];
};

function getTeacherId(): number | null {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (user.role !== "instructor") return null;

    const id = Number(user.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function parseOptions(value: Question["options"]): string[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

export default function InstructorExamReview() {
    const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const teacherId = getTeacherId();
  const id = Number(examId);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [draftMarks, setDraftMarks] = useState<
    Record<number, string>
  >({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSubmissions() {
    if (!teacherId || !Number.isSafeInteger(id) || id <= 0) {
      setError("Invalid instructor session or exam ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/teacher/exams/${id}/submitted-attempts/${teacherId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load submissions.");
      }

      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loading failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReview(attemptId: number) {
    if (!teacherId) return;

    setSelectedId(attemptId);
    setReview(null);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/teacher/exam-attempts/${attemptId}/review/${teacherId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load answers.");
      }

      setReview(data);

      const initial: Record<number, string> = {};

      for (const question of data.questions as Question[]) {
        if (question.question_type === "ShortAnswer") {
          initial[question.id] =
            question.marks_awarded == null
              ? ""
              : String(question.marks_awarded);
        }
      }

      setDraftMarks(initial);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load review."
      );
    }
  }

  useEffect(() => {
    void loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, teacherId]);

  async function saveMarks(question: Question) {
    if (!teacherId || !selectedId) return;

    const value = draftMarks[question.id];

    if (
      value === undefined ||
      value.trim() === "" ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0 ||
      Number(value) > Number(question.marks)
    ) {
      setError(`Enter marks between 0 and ${question.marks}.`);
      return;
    }

    setSavingId(question.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/teacher/exam-attempts/${selectedId}/grade-answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacher_id: teacherId,
            question_id: question.id,
            marks_awarded: Number(value),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save marks.");
      }

      setSuccess(data.message);
      await loadReview(selectedId);
      await loadSubmissions();
      setSuccess("Marks saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  if (!teacherId) {
    return (
      <div className="p-8">
        Instructor login required. <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white rounded-xl p-6 border flex justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Student Exam Submissions
            </h1>
            <p className="text-sm text-slate-500">
              Review submitted answers and grade short answers
            </p>
          </div>

          <button
  type="button"
  onClick={() => navigate("/instructor/exams")}
  className="text-purple-700 flex items-center gap-2"
>
  <ArrowLeft size={18} />
  Back to Exams
</button>
        </header>

        {error && (
          <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg">
            {error}
          </p>
        )}

        {success && (
          <p className="bg-green-50 text-green-700 p-4 rounded-lg">
            {success}
          </p>
        )}

        <div className="grid md:grid-cols-[300px_1fr] gap-5 items-start">
          <section className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">
                Submitted Attempts
              </h2>
              <button
                title="Refresh submissions"
                onClick={() => void loadSubmissions()}
                className="text-purple-700"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : submissions.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No submitted attempts yet.
              </p>
            ) : (
              <div className="space-y-2">
                {submissions.map((submission) => (
                  <button
                    key={submission.attempt_id}
                    onClick={() =>
                      void loadReview(submission.attempt_id)
                    }
                    className={`w-full text-left border rounded-lg p-3 ${
                      selectedId === submission.attempt_id
                        ? "border-purple-600 bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-semibold text-slate-800">
                      {submission.student_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Attempt #{submission.attempt_number}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {submission.status}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border p-6 space-y-5">
            {!review ? (
              <div className="text-slate-500 text-center py-12">
                <ClipboardCheck
                  size={38}
                  className="mx-auto mb-3"
                />
                Select a student submission to review.
              </div>
            ) : (
              <>
                <div className="border-b pb-4">
                  <h2 className="text-xl font-bold text-slate-800">
                    {review.attempt.student_name}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {review.attempt.exam_title}
                  </p>
                  <p className="mt-2 text-sm">
                    Status: <strong>{review.attempt.status}</strong>
                    {" · "}Score:{" "}
                    <strong>
                      {Number(review.attempt.total_score || 0)} /{" "}
                      {review.attempt.total_marks}
                    </strong>
                  </p>
                </div>

                {review.questions.map((question, index) => {
                  const options = parseOptions(question.options);
                  const isShort =
                    question.question_type === "ShortAnswer";
                  const hasAnswer =
                    Boolean(question.student_answer?.trim());

                  const studentAnswer =
                    question.question_type === "MCQ"
                      ? options[Number(question.student_answer)]
                        ?? "Not answered"
                      : question.student_answer || "Not answered";

                  const correctAnswer =
                    question.question_type === "MCQ"
                      ? options[Number(question.correct_answer)]
                        ?? "Not specified"
                      : question.correct_answer ?? "Not specified";

                  return (
                    <article
                      key={question.id}
                      className="border rounded-xl p-5 space-y-3"
                    >
                      <div className="flex justify-between gap-3">
                        <h3 className="font-semibold text-slate-800">
                          Q{index + 1}. {question.question_text}
                        </h3>
                        <span className="text-sm text-purple-700 whitespace-nowrap">
                          {question.marks} marks
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        {question.question_type}
                      </p>

                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Student Answer
                        </p>
                        <p className="whitespace-pre-wrap text-slate-800">
                          {studentAnswer}
                        </p>
                      </div>

                      {!isShort && (
                        <div className="bg-green-50 rounded-lg p-3 text-sm">
                          <p className="text-green-800">
                            Correct Answer: {correctAnswer}
                          </p>
                          <p className="mt-1 text-green-800">
                            Auto Marks:{" "}
                            {question.marks_awarded ?? 0}
                          </p>
                        </div>
                      )}

                      {isShort && hasAnswer && (
                        <div className="space-y-3 bg-purple-50 rounded-lg p-4">
                          <p className="text-xs text-slate-600">
                            Model Answer:{" "}
                            {correctAnswer}
                          </p>

                          <label className="block text-sm font-medium">
                            Marks Awarded
                          </label>

                          <input
                            type="number"
                            min={0}
                            max={Number(question.marks)}
                            step="0.01"
                            value={draftMarks[question.id] ?? ""}
                            onChange={(e) =>
                              setDraftMarks((prev) => ({
                                ...prev,
                                [question.id]: e.target.value,
                              }))
                            }
                            className="border rounded-lg px-3 py-2 w-32"
                          />

                          <button
                            type="button"
                            disabled={savingId !== null}
                            onClick={() => void saveMarks(question)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
                          >
                            <CheckCircle2 size={17} />
                            {savingId === question.id
                              ? "Saving..."
                              : "Save Marks"}
                          </button>
                        </div>
                      )}

                      {isShort && !hasAnswer && (
                        <p className="text-sm text-slate-500">
                          Not answered — 0 marks.
                        </p>
                      )}
                    </article>
                  );
                })}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
