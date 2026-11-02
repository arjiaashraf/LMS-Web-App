
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

type Course = {
  batch_id: number;
  course_id: number;
  course_title: string;
  timing_days: string;
  start_time: string;
  end_time: string;
};

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
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
};

interface InstructorOnlineClassesProps {
  onBack?: () => void;
}

function InstructorOnlineClasses({
  onBack,
}: InstructorOnlineClassesProps) {
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const instructorId = user.id;

  useEffect(() => {
    if (!instructorId || user.role !== "instructor") {
      navigate("/login");
      return;
    }

    fetchInstructorCourses();
    fetchClassSchedules();
  }, [navigate, instructorId]);

  // FORMAT TIME INTO AM / PM
  const formatTime = (time: string) => {
    if (!time) return "";

    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  // FETCH ASSIGNED COURSES AND BATCHES
  const fetchInstructorCourses = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/teacher/assignment-batches/${instructorId}`
      );

      const data = await res.json();

      if (res.ok) {
        setCourses(data);
      } else {
        console.error("Failed to fetch batches:", data);
      }
    } catch (err) {
      console.error("Error fetching instructor batches:", err);
    }
  };

  // FETCH SCHEDULED CLASSES
  const fetchClassSchedules = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/teacher/class-schedules/${instructorId}`
      );

      const data = await res.json();

      if (res.ok) {
        setClasses(data);
      } else {
        console.error("Failed to fetch schedules:", data);
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  };

  // CREATE ONLINE CLASS
  const handleCreateClass = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!courseId || !batchId) {
      alert("Please select a course and batch.");
      return;
    }

    if (startTime >= endTime) {
      alert("End time must be after start time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(
        "http://localhost:5000/api/teacher/class-schedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_id: Number(courseId),
            course_batch_id: Number(batchId),
            instructor_id: Number(instructorId),
            session_date: sessionDate,
            start_time: startTime,
            end_time: endTime,
            time_zone: timeZone,
            meeting_link: meetingLink,
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        alert("Online class scheduled successfully!");

        setShowModal(false);
        setCourseId("");
        setBatchId("");
        setSessionDate("");
        setStartTime("");
        setEndTime("");
        setTimeZone("PKT");
        setMeetingLink("");

        fetchClassSchedules();
      } else {
        alert(data.message || "Failed to schedule class.");
      }
    } catch (err) {
      console.error("Error scheduling class:", err);
      alert("Server error while scheduling class.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPDATE CLASS STATUS
  const handleStatusUpdate = async (
    scheduleId: number,
    newStatus: "Completed" | "Cancelled"
  ) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/teacher/class-schedule/status/${scheduleId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            instructor_id: Number(instructorId),
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        fetchClassSchedules();
      } else {
        alert(data.message || "Failed to update class status.");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Server error while updating class status.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (onBack) onBack();
                else navigate("/instructor-dashboard");
              }}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0 cursor-pointer"
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

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition cursor-pointer shrink-0"
          >
            <Plus size={18} />
            Schedule New Class
          </button>
        </div>
      </div>

      {/* CLASSES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {classes.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
            <Video
              size={48}
              className="mx-auto text-slate-300 mb-3"
            />
            <p className="text-slate-600 font-medium">
              No online classes scheduled yet.
            </p>
          </div>
        ) : (
          classes.map((cls) => (
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
                      <span className="font-medium">Date: </span>
                      <span className="font-semibold text-slate-700">
                        {cls.session_date.split("T")[0]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock
                      size={17}
                      className="text-slate-400 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <span className="font-medium">Time: </span>
                      <span className="text-slate-700 break-words">
                        {formatTime(cls.start_time)} -{" "}
                        {formatTime(cls.end_time)} ({cls.time_zone})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <BookOpen
                      size={17}
                      className="text-slate-400 shrink-0 mt-0.5"
                    />
                    <div>
                      <span className="font-medium">Batch: </span>
                      <span className="font-semibold text-slate-700">
                        {cls.course_batch_id ?? "Not assigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 border-t flex flex-col gap-3">
                <a
                  href={cls.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-center py-2.5 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition min-w-0"
                >
                  <LinkIcon size={16} className="shrink-0" />
                  Join Meeting Room
                </a>

                {cls.status === "Scheduled" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        handleStatusUpdate(cls.id, "Completed")
                      }
                      className="min-w-0 w-full bg-green-50 hover:bg-green-100 text-green-700 px-2 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Mark Completed
                    </button>

                    <button
                      onClick={() =>
                        handleStatusUpdate(cls.id, "Cancelled")
                      }
                      className="min-w-0 w-full bg-red-50 hover:bg-red-100 text-red-700 px-2 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel Class
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Schedule Online Class
              </h3>

              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

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
                  onChange={(e) => {
                    const selectedBatchId = e.target.value;
                    const selectedCourse = courses.find(
                      (c) =>
                        String(c.batch_id) === selectedBatchId
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

                  {courses.map((c) => (
                    <option
                      key={c.batch_id}
                      value={c.batch_id}
                    >
                      {c.course_title} - Batch {c.batch_id}
                      {" "}({c.timing_days}, {c.start_time} - {c.end_time})
                    </option>
                  ))}
                </select>
              </div>

              {/* SESSION DATE */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Session Date
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) =>
                    setSessionDate(e.target.value)
                  }
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              {/* START AND END TIME */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) =>
                      setStartTime(e.target.value)
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
                    onChange={(e) =>
                      setEndTime(e.target.value)
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
                  onChange={(e) =>
                    setTimeZone(e.target.value)
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
                  onChange={(e) =>
                    setMeetingLink(e.target.value)
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium cursor-pointer"
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
