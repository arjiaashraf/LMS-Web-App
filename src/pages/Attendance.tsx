import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  CalendarCheck,
  ArrowLeft,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

type AttendanceStatus = "Present" | "Absent" | "Late";

type AttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  date: string;
  status: AttendanceStatus;
};

function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([
    {
      id: "ATT001",
      studentId: "STU001",
      studentName: "Ahmed Ali",
      course: "Data Structures",
      date: "2026-08-03",
      status: "Present",
    },
    {
      id: "ATT002",
      studentId: "STU002",
      studentName: "Sara Khan",
      course: "Database Systems",
      date: "2026-08-03",
      status: "Present",
    },
    {
      id: "ATT003",
      studentId: "STU003",
      studentName: "Hassan Raza",
      course: "Software Engineering",
      date: "2026-08-03",
      status: "Late",
    },
    {
      id: "ATT004",
      studentId: "STU004",
      studentName: "Ayesha Noor",
      course: "Computer Networks",
      date: "2026-08-03",
      status: "Absent",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecord, setEditingRecord] = useState<string | null>(
    null
  );

  const navigate = useNavigate();

useEffect(() => {
  const user = localStorage.getItem("user");
  if (!user) {
    navigate("/login");
  }
}, [navigate]);

  const [formData, setFormData] = useState<AttendanceRecord>({
    id: "",
    studentId: "",
    studentName: "",
    course: "",
    date: "",
    status: "Present",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openAddForm = () => {
    setEditingRecord(null);

    setFormData({
      id: "",
      studentId: "",
      studentName: "",
      course: "",
      date: "",
      status: "Present",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecord(null);

    setFormData({
      id: "",
      studentId: "",
      studentName: "",
      course: "",
      date: "",
      status: "Present",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingRecord !== null) {
      setRecords(
        records.map((record) =>
          record.id === editingRecord ? formData : record
        )
      );
    } else {
      setRecords([...records, formData]);
    }

    closeForm();
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record.id);
    setFormData(record);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this attendance record?"
    );

    if (confirmed) {
      setRecords(
        records.filter((record) => record.id !== id)
      );
    }
  };

  const handleView = (record: AttendanceRecord) => {
    window.alert(
      `Attendance Details\n\n` +
        `Record ID: ${record.id}\n` +
        `Student ID: ${record.studentId}\n` +
        `Student Name: ${record.studentName}\n` +
        `Course: ${record.course}\n` +
        `Date: ${record.date}\n` +
        `Status: ${record.status}`
    );
  };

  const filteredRecords = records.filter((record) => {
    const search = searchTerm.toLowerCase();

    return (
      record.id.toLowerCase().includes(search) ||
      record.studentId.toLowerCase().includes(search) ||
      record.studentName.toLowerCase().includes(search) ||
      record.course.toLowerCase().includes(search) ||
      record.date.toLowerCase().includes(search) ||
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

  const attendancePercentage =
    totalRecords === 0
      ? 0
      : Math.round((presentCount / totalRecords) * 100);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}

      <header className="bg-white border-b px-6 py-5">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

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
                Manage student attendance records
              </p>

            </div>

          </div>

          <button
            onClick={openAddForm}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium"
          >
            <Plus size={18} />
            Mark Attendance
          </button>

        </div>

      </header>

      {/* MAIN */}

      <main className="p-6">

        {/* FORM */}

        {showForm && (

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

            <div className="flex items-center justify-between mb-6">

              <div>

                <h2 className="text-xl font-bold text-slate-800">
                  {editingRecord
                    ? "Edit Attendance"
                    : "Mark Attendance"}
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Enter attendance information
                </p>

              </div>

              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                title="Close"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >

              {/* ATTENDANCE ID */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Attendance ID
                </label>

                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  placeholder="e.g. ATT005"
                  required
                  disabled={editingRecord !== null}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500 disabled:bg-slate-100"
                />

              </div>

              {/* STUDENT ID */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Student ID
                </label>

                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="e.g. STU005"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />

              </div>

              {/* STUDENT NAME */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Student Name
                </label>

                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  placeholder="Enter student name"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />

              </div>

              {/* COURSE */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Course
                </label>

                <input
                  type="text"
                  name="course"
                  value={formData.course}
                  onChange={handleChange}
                  placeholder="e.g. Data Structures"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />

              </div>

              {/* DATE */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Attendance Date
                </label>

                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />

              </div>

              {/* STATUS */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Attendance Status
                </label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                >

                  <option value="Present">
                    Present
                  </option>

                  <option value="Absent">
                    Absent
                  </option>

                  <option value="Late">
                    Late
                  </option>

                </select>

              </div>

              {/* BUTTONS */}

              <div className="md:col-span-2 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {editingRecord
                    ? "Update Attendance"
                    : "Save Attendance"}
                </button>

              </div>

            </form>

          </div>
        )}

        {/* STATISTICS */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">

          {/* TOTAL */}

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

          {/* PRESENT */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Present
            </p>

            <p className="text-2xl font-bold text-green-600 mt-1">
              {presentCount}
            </p>

          </div>

          {/* ABSENT */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Absent
            </p>

            <p className="text-2xl font-bold text-red-500 mt-1">
              {absentCount}
            </p>

          </div>

          {/* LATE */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Late
            </p>

            <p className="text-2xl font-bold text-orange-500 mt-1">
              {lateCount}
            </p>

          </div>

          {/* PERCENTAGE */}

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

          {/* SEARCH */}

          <div className="p-5 border-b">

            <div className="relative max-w-md">

              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                placeholder="Search attendance..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50 border-b">

                <tr>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Record ID
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Student
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Course
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Date
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredRecords.length === 0 ? (

                  <tr>

                    <td
                      colSpan={6}
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

                      {/* RECORD ID */}

                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {record.id}
                      </td>

                      {/* STUDENT */}

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {record.studentName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>

                            <p className="text-sm font-semibold text-slate-800">
                              {record.studentName}
                            </p>

                            <p className="text-xs text-slate-500">
                              {record.studentId}
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* COURSE */}

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {record.course}
                      </td>

                      {/* DATE */}

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {record.date}
                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-4">

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            record.status === "Present"
                              ? "bg-green-100 text-green-700"
                              : record.status === "Absent"
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {record.status}
                        </span>

                      </td>

                      {/* ACTIONS */}

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-2">

                          <button
                            onClick={() =>
                              handleView(record)
                            }
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="View Attendance"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            onClick={() =>
                              handleEdit(record)
                            }
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                            title="Edit Attendance"
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(record.id)
                            }
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                            title="Delete Attendance"
                          >
                            <Trash2 size={18} />
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Attendance;