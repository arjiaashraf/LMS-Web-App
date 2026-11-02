import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Save,
  Users,
  BookOpen,
} from "lucide-react";

type ClassSession = {
  id: number;
  course_id: number;
  course_title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  course_batch_id: number | null;
};

type Student = {
  id: number;
  name: string;
  email: string;
};

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";

interface InstructorAttendanceProps {
  onBack?: () => void;
}

function InstructorAttendance({ onBack }: InstructorAttendanceProps) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<{ [studentId: number]: AttendanceStatus }>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const teacherUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (!teacherUser.id) {
      navigate("/login");
      return;
    }
    fetchTeacherSessions();
  }, []);

  
const fetchTeacherSessions = async () => {
  try {
    const res = await fetch(
      `http://localhost:5000/api/teacher/class-schedules/${teacherUser.id}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch class sessions");
    }

    const data = await res.json();
    setSessions(data);
  } catch (err) {
    console.error("Error fetching teacher sessions:", err);
  }
};


  
const handleSelectSession = async (session: ClassSession) => {
  setSelectedSession(session);
  setLoading(true);
  setStudents([]);
  setAttendance({});

  try {
    if (!session.course_batch_id) {
      alert("This class has no batch assigned.");
      return;
    }

    // Fetch students of the selected batch
    const studentsRes = await fetch(
      `http://localhost:5000/api/admin/class-batch-students/${session.course_batch_id}`
    );

    if (!studentsRes.ok) {
      throw new Error("Failed to fetch batch students");
    }

    const studentsData: Student[] = await studentsRes.json();

    // Fetch previously saved attendance
    const attendanceRes = await fetch(
      `http://localhost:5000/api/teacher/attendance/${session.id}`
    );

    let attendanceData: {
      student_id: number;
      status: AttendanceStatus;
    }[] = [];

    if (attendanceRes.ok) {
      attendanceData = await attendanceRes.json();
    }

    setStudents(studentsData);

    const initialAttendance: {
      [studentId: number]: AttendanceStatus;
    } = {};

    studentsData.forEach((student) => {
      const existingRecord = attendanceData.find(
        (record) => record.student_id === student.id
      );

      initialAttendance[student.id] = existingRecord
        ? existingRecord.status
        : "Present";
    });

    setAttendance(initialAttendance);
  } catch (err) {
    console.error("Error loading attendance:", err);
    alert("Failed to load students for this batch.");
  } finally {
    setLoading(false);
  }
};

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmitAttendance = async () => {
    if (!selectedSession) return;

    const attendanceData = Object.keys(attendance).map((studentId) => ({
      student_id: Number(studentId),
      status: attendance[Number(studentId)],
    }));

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_session_id: selectedSession.id,
          teacher_id: teacherUser.id,
          attendance_data: attendanceData,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Attendance submitted successfully!");
        setSelectedSession(null);
      } else {
        alert(data.message || "Failed to submit attendance.");
      }
    } catch (err) {
      console.error("Error submitting attendance:", err);
      alert("An error occurred while submitting attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (onBack) onBack();
                else navigate("/instructor-dashboard");
              }}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
              <p className="text-sm text-slate-500">Record and manage attendance for your class sessions</p>
            </div>
          </div>
        </div>

        {!selectedSession ? (
          /* SESSIONS LIST */
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-blue-600" /> Select a Class Session to Mark Attendance
            </h2>

            {sessions.length === 0 ? (
              <p className="text-slate-500 text-center py-10">No class sessions assigned to you yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border border-slate-200 rounded-xl p-5 hover:border-blue-500 transition flex flex-col justify-between space-y-4 bg-slate-50/50"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                          {session.status}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={14} /> {session.start_time} - {session.end_time}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <BookOpen size={18} className="text-blue-600" /> {session.course_title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Date: {session.session_date.split("T")[0]}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectSession(session)}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Users size={16} /> Mark / Edit Attendance
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ATTENDANCE MARKING FORM */
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6 border">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Mark Attendance: {selectedSession.course_title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Session Date: {selectedSession.session_date.split("T")[0]} ({selectedSession.start_time} - {selectedSession.end_time})
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-sm text-slate-600 hover:text-slate-900 border px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Back to Sessions
              </button>
            </div>

            {loading ? (
              <p className="text-center py-10 text-slate-500">Loading enrolled students...</p>
            ) : students.length === 0 ? (
              <p className="text-center py-10 text-slate-500">No students enrolled in this course.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-slate-600 text-sm">
                        <th className="pb-3 font-semibold">Student Name</th>
                        <th className="pb-3 font-semibold">Email</th>
                        <th className="pb-3 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="py-3 font-medium">{student.name}</td>
                          <td className="py-3 text-slate-500 text-sm">{student.email}</td>
                          <td className="py-3">
                            <div className="flex justify-center gap-2">
                              {(["Present", "Absent", "Late", "Excused"] as AttendanceStatus[]).map((status) => {
                                const isSelected = attendance[student.id] === status;
                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleStatusChange(student.id, status)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                                      isSelected
                                        ? status === "Present"
                                          ? "bg-green-600 text-white shadow-sm"
                                          : status === "Absent"
                                          ? "bg-red-600 text-white shadow-sm"
                                          : status === "Late"
                                          ? "bg-yellow-500 text-white shadow-sm"
                                          : "bg-purple-600 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    {status}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitAttendance}
                    disabled={submitting}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Save size={16} /> {submitting ? "Saving..." : "Save Attendance"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InstructorAttendance;