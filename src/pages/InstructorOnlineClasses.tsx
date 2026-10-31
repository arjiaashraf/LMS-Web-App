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
  id: number;
  title: string;
};

type ClassSchedule = {
  id: number;
  course_id: number;
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

function InstructorOnlineClasses({ onBack }: InstructorOnlineClassesProps) {
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [courseId, setCourseId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeZone, setTimeZone] = useState("PKT");
  const [meetingLink, setMeetingLink] = useState("");

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const instructorId = user.id;

  useEffect(() => {
    if (!user || user.role !== "instructor") {
      navigate("/login");
      return;
    }
    fetchInstructorCourses();
    fetchClassSchedules();
  }, [navigate]);

  const fetchInstructorCourses = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/courses/${instructorId}`);
      const data = await res.json();
      if (res.ok) setCourses(data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const fetchClassSchedules = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/class-schedules/${instructorId}`);
      const data = await res.json();
      if (res.ok) setClasses(data);
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/teacher/class-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          instructor_id: instructorId,
          session_date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          time_zone: timeZone,
          meeting_link: meetingLink,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setCourseId("");
        setSessionDate("");
        setStartTime("");
        setEndTime("");
        setMeetingLink("");
        fetchClassSchedules();
      } else {
        alert("Failed to schedule class");
      }
    } catch (err) {
      console.error("Error scheduling class:", err);
    }
  };

  const handleStatusUpdate = async (scheduleId: number, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/teacher/class-schedule/status/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchClassSchedules();
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onBack) onBack();
              else navigate("/instructor-dashboard");
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Online Classes & Schedule</h1>
            <p className="text-sm text-slate-500">Manage and schedule live sessions for your courses</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition cursor-pointer"
        >
          <Plus size={18} /> Schedule New Class
        </button>
      </div>

      {/* CLASSES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
            <Video size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No online classes scheduled yet.</p>
          </div>
        ) : (
          classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                    <BookOpen size={13} /> {cls.course_title}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    cls.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    cls.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                    cls.status === 'Rescheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {cls.status === 'Completed' && <CheckCircle size={12} />}
                    {cls.status === 'Cancelled' && <XCircle size={12} />}
                    {cls.status === 'Scheduled' && <Clock size={12} />}
                    {cls.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mt-3">
                  <p className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" /> Date: <strong>{cls.session_date.split('T')[0]}</strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" /> Time: {cls.start_time} - {cls.end_time} ({cls.time_zone})
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t flex flex-col gap-3">
                <a
                  href={cls.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-center py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition"
                >
                  <LinkIcon size={15} /> Join Meeting Room
                </a>

                {cls.status === 'Scheduled' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(cls.id, 'Completed')}
                      className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(cls.id, 'Cancelled')}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
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
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Schedule Online Class</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Session Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Zone</label>
                <input
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  placeholder="e.g. PKT, EST"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Link (Zoom / Teams / Meet)</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://zoom.us/..."
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer"
                >
                  Schedule Class
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