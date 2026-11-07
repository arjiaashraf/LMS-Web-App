
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch as fetch } from "../services/api";
import {
  ArrowLeft,
  CalendarClock,
  Save,
  RefreshCw,
} from "lucide-react";


type Student = {
  student_id: number;
  student_name: string;
  email: string;
  extension_id: number | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  extra_attempts: number | null;
  attempt_count: number;
  latest_status: string | null;
  result_status: string | null;
};

type ExamInfo = {
  id: number;
  title: string;
  exam_mode: string;
  result_published: number;
  attempt_limit: number;
};

function getTeacherId() {
  try {
    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
    return user.role === "instructor"
      ? Number(user.id)
      : null;
  } catch {
    return null;
  }
}

export default function InstructorExamExtensions() {
  const { examId } = useParams<{ examId: string }>();
  const teacherId = getTeacherId();

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [extraAttempts, setExtraAttempts] = useState("0");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadStudents() {
    if (!teacherId || !examId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/teacher/exams/${examId}/extensions/${teacherId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load students.");
      }

      setExam(data.exam);
      setStudents(data.students);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Loading failed."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, teacherId]);

  function selectStudent(student: Student) {
    setSelected(student);
    setError("");
    setSuccess("");

    setDate(student.start_at?.slice(0, 10) || "");
    setTime(student.start_at?.slice(11, 16) || "09:00");

    setEndDate(student.end_at?.slice(0, 10) || "");
    setEndTime(student.end_at?.slice(11, 16) || "10:00");

    setDuration(String(student.duration_minutes || 30));

    setExtraAttempts(
      String(
        student.extra_attempts ??
        (Number(student.attempt_count) > 0 ? 1 : 0)
      )
    );
  }

  async function saveExtension() {
    if (!selected || !teacherId || !examId) return;

    if (!date || !time || !endDate || !endTime) {
      setError("Select the opening and closing date/time.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/teacher/exams/${examId}/extensions/${selected.student_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            start_at: `${date} ${time}`,
            end_at: `${endDate} ${endTime}`,
            duration_minutes: Number(duration),
            extra_attempts: Number(extraAttempts),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save extension."
        );
      }

      setSuccess("Student extension saved successfully.");
      await loadStudents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white rounded-xl border p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Manage Extensions & Retakes
            </h1>
            <p className="text-slate-500 mt-1">
              {exam?.title || "Online Examination"}
            </p>
          </div>

          <Link
            to="/instructor/exams"
            className="flex gap-2 items-center text-purple-700"
          >
            <ArrowLeft size={18} />
            Back to Exams
          </Link>
        </header>

        {error && (
          <p className="rounded-lg bg-red-50 text-red-700 p-4">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-green-50 text-green-700 p-4">
            {success}
          </p>
        )}

        <div className="grid md:grid-cols-[320px_1fr] gap-5 items-start">
          <section className="bg-white border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Enrolled Students</h2>

              <button
                type="button"
                onClick={() => void loadStudents()}
                title="Refresh"
                className="text-purple-700"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {loading && (
              <p className="text-sm text-slate-500">Loading...</p>
            )}

            {students.map((student) => (
              <button
                key={student.student_id}
                type="button"
                onClick={() => selectStudent(student)}
                className={`w-full text-left border rounded-lg p-3 ${
                  selected?.student_id === student.student_id
                    ? "border-purple-600 bg-purple-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <p className="font-semibold">
                  {student.student_name}
                </p>

                <p className="text-xs text-slate-500">
                  {student.email}
                </p>

                <p className="text-xs text-slate-500 mt-2">
                  Attempts: {student.attempt_count}
                  {" · "}
                  {student.latest_status || "Not Attempted"}
                </p>

                {student.extension_id && (
                  <p className="text-xs text-green-700 mt-1">
                    Individual permission exists
                  </p>
                )}
              </button>
            ))}

            {!loading && students.length === 0 && (
              <p className="text-sm text-slate-500">
                No active students found.
              </p>
            )}
          </section>

          <section className="bg-white border rounded-xl p-6 space-y-5">
            {!selected ? (
              <div className="text-center text-slate-500 py-14">
                <CalendarClock
                  size={40}
                  className="mx-auto mb-3"
                />
                Select a student to grant an extension.
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold">
                    {selected.student_name}
                  </h2>

                  <p className="text-sm text-slate-500">
                    Individual exam permission
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      New Opening Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Opening Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Closing Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Closing Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Attempt Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Extra Attempts
                    </label>
                    <select
                      value={extraAttempts}
                      onChange={(e) =>
                        setExtraAttempts(e.target.value)
                      }
                      className="w-full border p-3 rounded-lg"
                    >
                      <option value="0">
                        0 — Missed exam extension
                      </option>
                      <option value="1">1 extra attempt</option>
                      <option value="2">2 extra attempts</option>
                      <option value="3">3 extra attempts</option>
                    </select>
                  </div>
                </div>

                <p className="text-sm text-slate-500">
                  Missed student with no attempts: 0 extra attempts.
                  Completed attempt: at least 1 extra attempt.
                  A published result cannot be changed here.
                </p>

                <button
                  type="button"
                  disabled={
                    saving ||
                    exam?.exam_mode !== "Online" ||
                    exam?.result_published === 1
                  }
                  onClick={() => void saveExtension()}
                  className="bg-purple-600 text-white px-5 py-3 rounded-lg font-semibold flex gap-2 items-center disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Student Extension"}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
