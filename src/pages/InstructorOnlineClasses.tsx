
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  ArrowLeft,
  X,
  BookOpen,
  RefreshCw,
} from "lucide-react";

type Course = {
  batch_id: number;
  course_id: number;
  course_title: string;
  timing_days: string;
  start_time: string;
  end_time: string;
};

type ClassStatus =
  | "Scheduled"
  | "Completed"
  | "Cancelled"
  | "Rescheduled";

type ClassSchedule = {
  id: number;
  course_id: number;
  course_batch_id: number | null;
  course_title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  meeting_link: string;
  status: ClassStatus;
};

interface InstructorOnlineClassesProps {
  onBack?: () => void;
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Request failed (${response.status}).`
    );
  }

  return data;
}

function getInstructorId(): number | null {
  try {
    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    const id = Number(user.id);

    if (
      user.role !== "instructor" ||
      typeof user.token !== "string" ||
      !user.token ||
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

function formatTime(time: string) {
  if (!time) return "—";

  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function InstructorOnlineClasses({
  onBack,
}: InstructorOnlineClassesProps) {
  const navigate = useNavigate();

  const [instructorId] = useState(getInstructorId);

  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [showModal, setShowModal] = useState(false);

  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeZone, setTimeZone] = useState("PKT");
  const [meetingLink, setMeetingLink] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(
    null
  );

  const [error, setError] = useState("");
  const [courseError, setCourseError] = useState("");

  // =====================================
  // FETCH ASSIGNED COURSES AND BATCHES
  // =====================================

  const fetchInstructorCourses = useCallback(async () => {
    if (!instructorId) return;

    setCourseError("");

    try {
      const response = await apiFetch(
        `/api/teacher/assignment-batches/${instructorId}`
      );

      const data = await parseResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("Invalid assigned batches response.");
      }

      setCourses(data);
    } catch (err) {
      setCourseError(
        err instanceof Error
          ? err.message
          : "Unable to load assigned batches."
      );
    }
  }, [instructorId]);

  // =====================================
  // FETCH ALL SCHEDULED CLASSES
  // =====================================

  const fetchClassSchedules = useCallback(async () => {
    if (!instructorId) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/teacher/class-schedules/${instructorId}`
      );

      const data = await parseResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("Invalid class schedules response.");
      }

      setClasses(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load online classes."
      );
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    if (!instructorId) {
      navigate("/login", { replace: true });
      return;
    }

    void fetchInstructorCourses();
    void fetchClassSchedules();
  }, [
    instructorId,
    navigate,
    fetchInstructorCourses,
    fetchClassSchedules,
  ]);

  const refreshAll = async () => {
    await Promise.all([
      fetchInstructorCourses(),
      fetchClassSchedules(),
    ]);
  };

  const resetForm = () => {
    setCourseId("");
    setBatchId("");
    setSessionDate("");
    setStartTime("");
    setEndTime("");
    setTimeZone("PKT");
    setMeetingLink("");
  };

  // =====================================
  // CREATE ONLINE CLASS
  // =====================================

  const handleCreateClass = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!instructorId || isSubmitting) return;

    if (!courseId || !batchId) {
      window.alert("Please select an assigned course and batch.");
      return;
    }

    if (!sessionDate || !startTime || !endTime) {
      window.alert("Please enter class date and time.");
      return;
    }

    if (startTime >= endTime) {
      window.alert("End time must be after start time.");
      return;
    }

    try {
      const url = new URL(meetingLink.trim());

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        throw new Error();
      }
    } catch {
      window.alert("Please enter a valid meeting URL.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch(
        "/api/teacher/class-schedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_id: Number(courseId),
            course_batch_id: Number(batchId),
            instructor_id: instructorId,
            session_date: sessionDate,
            start_time: startTime,
            end_time: endTime,
            time_zone: timeZone.trim() || "PKT",
            meeting_link: meetingLink.trim(),
          }),
        }
      );

      await parseResponse(response);

      setShowModal(false);
      resetForm();

      window.alert("Online class scheduled successfully!");

      await fetchClassSchedules();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to schedule online class."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================
  // MARK COMPLETED / CANCEL CLASS
  // =====================================

  const handleStatusUpdate = async (
    scheduleId: number,
    newStatus: "Completed" | "Cancelled"
  ) => {
    if (!instructorId || updatingId !== null) return;

    const action =
      newStatus === "Completed"
        ? "mark this class as completed"
        : "cancel this class";

    const confirmed = window.confirm(
      `Are you sure you want to ${action}?`
    );

    if (!confirmed) return;

    setUpdatingId(scheduleId);

    try {
      const response = await apiFetch(
        `/api/teacher/class-schedule/status/${scheduleId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            instructor_id: instructorId,
          }),
        }
      );

      await parseResponse(response);

      window.alert(
        newStatus === "Completed"
          ? "Class marked as completed successfully!"
          : "Class cancelled successfully!"
      );

      // Reload from database after server confirms update.
      await fetchClassSchedules();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to update class status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (onBack) onBack();
                else navigate("/instructor-dashboard");
              }}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-800">
                Online Classes & Schedule
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Manage and schedule live sessions for your courses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading}
              className="p-2.5 bg-white border rounded-lg hover:bg-slate-50 disabled:opacity-50"
              title="Refresh Classes"
            >
              <RefreshCw size={19} />
            </button>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
            >
              <Plus size={18} />
              Schedule New Class
            </button>
          </div>
        </div>
      </div>

      {/* ERRORS */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-5"
        >
          {error}
        </div>
      )}

      {/* CLASSES GRID */}
      {loading ? (
        <div className="bg-white rounded-xl p-10 text-center text-slate-500">
          Loading online classes...
        </div>
      ) : classes.length === 0 && !error ? (
        <div className="bg-white rounded-xl p-10 text-center border shadow-sm">
          <Video
            size={48}
            className="mx-auto text-slate-300 mb-3"
          />

          <p className="text-slate-600 font-medium">
            No online classes scheduled yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between min-w-0 w-full gap-4"
            >
              <div className="min-w-0">
                {/* COURSE AND STATUS */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg inline-flex items-start gap-2 min-w-0 max-w-full break-words">
                    <BookOpen
                      size={15}
                      className="shrink-0 mt-0.5"
                    />

                    <span className="break-words min-w-0">
                      {cls.course_title}
                    </span>
                  </span>

                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 ${
                      cls.status === "Completed"
                        ? "bg-green-100 text-green-700"
                        : cls.status === "Cancelled"
                        ? "bg-red-100 text-red-700"
                        : cls.status === "Rescheduled"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {cls.status === "Completed" && (
                      <CheckCircle size={13} />
                    )}

                    {cls.status === "Cancelled" && (
                      <XCircle size={13} />
                    )}

                    {cls.status === "Scheduled" && (
                      <Clock size={13} />
                    )}

                    {cls.status}
                  </span>
                </div>

                {/* CLASS DETAILS */}
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <Calendar
                      size={17}
                      className="text-slate-400 shrink-0 mt-0.5"
                    />

                    <div className="min-w-0">
                      <span className="font-medium">
                        Date:{" "}
                      </span>

                      <span className="font-semibold text-slate-700">
                        {cls.session_date?.slice(0, 10) || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock
                      size={17}
                      className="text-slate-400 shrink-0 mt-0.5"
                    />

                    <div className="min-w-0">
                      <span className="font-medium">
                        Time:{" "}
                      </span>

                      <span className="text-slate-700 break-words">
                        {formatTime(cls.start_time)} -{" "}
                        {formatTime(cls.end_time)} (
                        {cls.time_zone || "PKT"})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <BookOpen
                      size={17}
                      className="text-slate-400 shrink-0 mt-0.5"
                    />

                    <div>
                      <span className="font-medium">
                        Batch:{" "}
                      </span>

                      <span className="font-semibold text-slate-700">
                        {cls.course_batch_id ?? "Not assigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 border-t flex flex-col gap-3">
                {cls.meeting_link && (
                  <a
                    href={cls.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-center py-2.5 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
                  >
                    <LinkIcon size={16} />
                    Join Meeting Room
                  </a>
                )}

                {cls.status === "Scheduled" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={updatingId !== null}
                      onClick={() =>
                        void handleStatusUpdate(
                          cls.id,
                          "Completed"
                        )
                      }
                      className="min-w-0 w-full bg-green-50 hover:bg-green-100 text-green-700 px-2 py-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                    >
                      {updatingId === cls.id
                        ? "Updating..."
                        : "Mark Completed"}
                    </button>

                    <button
                      type="button"
                      disabled={updatingId !== null}
                      onClick={() =>
                        void handleStatusUpdate(
                          cls.id,
                          "Cancelled"
                        )
                      }
                      className="min-w-0 w-full bg-red-50 hover:bg-red-100 text-red-700 px-2 py-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                    >
                      {updatingId === cls.id
                        ? "Updating..."
                        : "Cancel Class"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCHEDULE NEW CLASS MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Schedule Online Class
              </h3>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {courseError && (
              <div
                role="alert"
                className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg mb-4 text-sm"
              >
                {courseError}
              </div>
            )}

            <form
              onSubmit={handleCreateClass}
              className="space-y-4"
            >
              {/* COURSE AND BATCH */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Course & Batch
                </label>

                <select
                  value={batchId}
                  onChange={(event) => {
                    const selectedBatchId =
                      event.target.value;

                    const selectedCourse = courses.find(
                      (course) =>
                        String(course.batch_id) ===
                        selectedBatchId
                    );

                    setBatchId(selectedBatchId);

                    setCourseId(
                      selectedCourse
                        ? String(selectedCourse.course_id)
                        : ""
                    );
                  }}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">
                    -- Choose Course & Batch --
                  </option>

                  {courses.map((course) => (
                    <option
                      key={course.batch_id}
                      value={course.batch_id}
                    >
                      {course.course_title} - Batch{" "}
                      {course.batch_id} (
                      {course.timing_days},{" "}
                      {course.start_time} -{" "}
                      {course.end_time})
                    </option>
                  ))}
                </select>

                {!courseError && courses.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    No assigned batches found.
                  </p>
                )}
              </div>

              {/* SESSION DATE */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Session Date
                </label>

                <input
                  type="date"
                  value={sessionDate}
                  onChange={(event) =>
                    setSessionDate(event.target.value)
                  }
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              {/* TIME */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Time
                  </label>

                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) =>
                      setStartTime(event.target.value)
                    }
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Time
                  </label>

                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) =>
                      setEndTime(event.target.value)
                    }
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* TIME ZONE */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time Zone
                </label>

                <input
                  type="text"
                  value={timeZone}
                  onChange={(event) =>
                    setTimeZone(event.target.value)
                  }
                  placeholder="e.g. PKT, EST"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              {/* MEETING LINK */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Link (Zoom / Teams / Meet)
                </label>

                <input
                  type="url"
                  value={meetingLink}
                  onChange={(event) =>
                    setMeetingLink(event.target.value)
                  }
                  placeholder="https://meet.google.com/..."
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !courses.length ||
                    Boolean(courseError)
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {isSubmitting
                    ? "Scheduling..."
                    : "Schedule Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstructorOnlineClasses;
