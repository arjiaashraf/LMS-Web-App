import { useState, useEffect } from "react";
import {
  CalendarCheck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch as fetch } from "../services/api";

type CourseAttendance = {
  course: string;
  code: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
};

function StudentAttendance() {
  const [attendance, setAttendance] = useState<CourseAttendance[]>([]);
  const [stats, setStats] = useState({
  totalClasses: 0,
  presentCount: 0,
  absentCount: 0,
  attendancePercentage: 0
});
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const studentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (!studentUser.id) {
      navigate("/login");
      return;
    }
    fetchStudentAttendance(studentUser.id);
  }, []);

  const fetchStudentAttendance = async (studentId: number) => {
    try {
      const res = await fetch(`/api/student/attendance/${studentId}`);
      const data = await res.json();
      if (res.ok) {
        setAttendance(data.courses || []);
        setStats(data.stats || { totalClasses: 0, presentCount: 0, absentCount: 0, attendancePercentage: 0 });
      }
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalPresent = stats.presentCount;
const totalAbsent = stats.absentCount;
const overallPercentage = stats.attendancePercentage;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Loading attendance records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/student-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
            <p className="text-sm text-slate-500">View your attendance record</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          {studentUser.name ? studentUser.name.substring(0, 2).toUpperCase() : "ST"}
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto p-6">
        {/* INTRO */}
        <div className="bg-blue-600 text-white rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <CalendarCheck size={30} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Attendance Overview</h2>
              <p className="text-blue-100 mt-1">
                Keep track of your attendance in all enrolled courses.
              </p>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Overall Attendance</p>
                <h2 className="text-3xl font-bold text-green-600 mt-2">
                  {overallPercentage}%
                </h2>
              </div>
              <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                <CalendarCheck size={25} />
              </div>
            </div>
            <p className="text-sm text-green-600 mt-3">Good attendance</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Classes Present</p>
                <h2 className="text-3xl font-bold text-blue-600 mt-2">
                  {totalPresent}
                </h2>
              </div>
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <CheckCircle size={25} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Classes Absent</p>
                <h2 className="text-3xl font-bold text-red-600 mt-2">
                  {totalAbsent}
                </h2>
              </div>
              <div className="bg-red-100 text-red-600 p-3 rounded-lg">
                <XCircle size={25} />
              </div>
            </div>
          </div>
        </div>

        {/* COURSE ATTENDANCE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-slate-800">Course Attendance</h2>
            <p className="text-sm text-slate-500 mt-1">
              Attendance percentage for each course
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Course</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Total Classes</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Present</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Absent</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No attendance records found yet.
                    </td>
                  </tr>
                ) : (
                  attendance.map((course) => (
                    <tr key={course.code} className="border-t hover:bg-slate-50">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800">{course.course}</p>
                        <p className="text-xs text-slate-500 mt-1">{course.code}</p>
                      </td>
                      <td className="text-center px-6 py-5 text-slate-700">{course.total}</td>
                      <td className="text-center px-6 py-5 text-green-600 font-semibold">{course.present}</td>
                      <td className="text-center px-6 py-5 text-red-600 font-semibold">{course.absent}</td>
                      <td className="px-6 py-5 min-w-56">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">{course.percentage}%</span>
                          {course.percentage >= 90 ? (
                            <CheckCircle size={17} className="text-green-600" />
                          ) : (
                            <Clock size={17} className="text-orange-500" />
                          )}
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full">
                          <div
                            className={`h-2 rounded-full ${
                              course.percentage >= 90 ? "bg-green-500" : "bg-orange-500"
                            }`}
                            style={{ width: `${course.percentage}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NOTE */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mt-6">
          <p className="text-sm text-blue-800">
            <strong>Attendance Policy:</strong> Students should maintain the required attendance percentage for each course.
          </p>
        </div>
      </main>
    </div>
  );
}

export default StudentAttendance;