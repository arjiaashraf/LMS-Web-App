
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search,
  Eye,
  CalendarCheck,
  ArrowLeft,
  X,
} from "lucide-react";

type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Late"
  | "Excused";

type AttendanceRecord = {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  course: string;
  batchId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  instructorId: number;
  instructorName: string;
};

function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] =
    useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      navigate("/login");
      return;
    }

    fetchAttendance();
  }, [navigate]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/admin/attendance"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }

      const data = await response.json();

      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Attendance fetch error:", err);
      setError("Unable to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
  if (!date) return "-";

  const [year, month, day] = date.slice(0, 10).split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

  const formatTime = (time: string) => {
    if (!time) return "-";

    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  const filteredRecords = records.filter((record) => {
    const search = searchTerm.toLowerCase();

    return (
      String(record.id).includes(search) ||
      String(record.studentId).includes(search) ||
      record.studentName.toLowerCase().includes(search) ||
      record.studentEmail.toLowerCase().includes(search) ||
      record.course.toLowerCase().includes(search) ||
      String(record.batchId).includes(search) ||
      record.instructorName.toLowerCase().includes(search) ||
      formatDate(record.date).toLowerCase().includes(search) ||
      record.status.toLowerCase().includes(search)
    );
  });

  const totalRecords = records.length;

  const presentCount = records.filter(
    (record) => record.status === "Present"
  ).length;

  const absentCount = records.filter(
    (record) => record.status === "Absent"
  ).length;

  const lateCount = records.filter(
    (record) => record.status === "Late"
  ).length;

  const excusedCount = records.filter(
    (record) => record.status === "Excused"
  ).length;

  const attendancePercentage =
    totalRecords === 0
      ? 0
      : Math.round((presentCount / totalRecords) * 100);

  const statusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-700";
      case "Absent":
        return "bg-red-100 text-red-700";
      case "Late":
        return "bg-orange-100 text-orange-700";
      case "Excused":
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}
      <header className="bg-white border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <Link
            to="/admin-dashboard"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Attendance
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitor student attendance records
            </p>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6">

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <CalendarCheck size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  Total Records
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {totalRecords}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Present</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {presentCount}
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Absent</p>
            <p className="text-2xl font-bold text-red-500 mt-1">
              {absentCount}
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Late</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">
              {lateCount}
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Attendance Rate
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {attendancePercentage}%
            </p>
          </div>

        </div>

        {/* ATTENDANCE TABLE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-5 border-b">
            <div className="relative max-w-md">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search student, course, batch, instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {error && (
            <p className="px-6 py-4 text-red-600">{error}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {[
                    "Record ID",
                    "Student",
                    "Course / Batch",
                    "Instructor",
                    "Date",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="text-left px-6 py-4 text-sm font-semibold text-slate-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      Loading attendance records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        ATT{String(record.id).padStart(3, "0")}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {record.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {record.studentName}
                            </p>
                            <p className="text-xs text-slate-500">
                              Student ID: {record.studentId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {record.course}
                        </p>
                        <p className="text-xs text-slate-500">
                          Batch {record.batchId}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {record.instructorName || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(record.date)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                          title="View Attendance"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {excusedCount > 0 && (
          <p className="text-sm text-slate-500 mt-4">
            Excused attendance records: {excusedCount}
          </p>
        )}
      </main>

      {/* VIEW DETAILS MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">

            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-slate-800">
                Attendance Details
              </h2>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {[
                ["Record ID", `ATT${String(selectedRecord.id).padStart(3, "0")}`],
                ["Student Name", selectedRecord.studentName],
                ["Student ID", selectedRecord.studentId],
                ["Student Email", selectedRecord.studentEmail],
                ["Course", selectedRecord.course],
                ["Batch", selectedRecord.batchId],
                ["Instructor", selectedRecord.instructorName || "-"],
                ["Date", formatDate(selectedRecord.date)],
                [
                  "Class Time",
                  `${formatTime(selectedRecord.startTime)} - ${formatTime(selectedRecord.endTime)} (PKT)`,
                ],
                ["Status", selectedRecord.status],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between gap-4 border-b pb-3"
                >
                  <span className="text-sm text-slate-500">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 text-right">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;
