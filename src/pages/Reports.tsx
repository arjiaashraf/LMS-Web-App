import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileText,
  Download,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

type Report = {
  id: string;
  name: string;
  category: string;
  description: string;
  date: string;
  status: string;
};

function Reports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [reports] = useState<Report[]>([
    {
      id: "REP001",
      name: "Student Performance Report",
      category: "Students",
      description:
        "Overall student academic performance and progress.",
      date: "2026-08-01",
      status: "Available",
    },
    {
      id: "REP002",
      name: "Teacher Performance Report",
      category: "Teachers",
      description:
        "Teacher activity, courses and performance summary.",
      date: "2026-08-01",
      status: "Available",
    },
    {
      id: "REP003",
      name: "Course Enrollment Report",
      category: "Courses",
      description:
        "Course enrollment and student registration statistics.",
      date: "2026-08-02",
      status: "Available",
    },
    {
      id: "REP004",
      name: "Attendance Report",
      category: "Attendance",
      description:
        "Student attendance records and attendance percentage.",
      date: "2026-08-02",
      status: "Available",
    },
    {
      id: "REP005",
      name: "Examination Results",
      category: "Exams",
      description:
        "Examination results and student grades.",
      date: "2026-08-03",
      status: "Available",
    },
  ]);

  const categories = [
    "All",
    "Students",
    "Teachers",
    "Courses",
    "Attendance",
    "Exams",
  ];

  const navigate = useNavigate();

useEffect(() => {
  const user = localStorage.getItem("user");
  if (!user) {
    navigate("/login");
  }
}, [navigate]);

  const filteredReports = reports.filter((report) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      report.name.toLowerCase().includes(search) ||
      report.description
        .toLowerCase()
        .includes(search) ||
      report.category.toLowerCase().includes(search);

    const matchesCategory =
      selectedCategory === "All" ||
      report.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleDownload = (report: Report) => {
    const content =
      `LMS REPORT\n\n` +
      `Report ID: ${report.id}\n` +
      `Report Name: ${report.name}\n` +
      `Category: ${report.category}\n` +
      `Description: ${report.description}\n` +
      `Generated Date: ${report.date}\n` +
      `Status: ${report.status}\n`;

    const blob = new Blob([content], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `${report.name.replace(
      /\s+/g,
      "_"
    )}.txt`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const totalStudents = 1250;
  const totalTeachers = 85;
  const totalCourses = 42;
  const attendanceRate = 91;

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

          <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
            <BarChart3 size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold text-slate-800">
              Reports
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              View and manage LMS reports
            </p>

          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="p-6">

        {/* SUMMARY CARDS */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">

          {/* STUDENTS */}

          <div className="bg-white rounded-xl shadow-sm p-5">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-500">
                  Total Students
                </p>

                <h2 className="text-3xl font-bold text-slate-800 mt-2">
                  {totalStudents.toLocaleString()}
                </h2>

              </div>

              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <Users size={23} />
              </div>

            </div>

          </div>

          {/* TEACHERS */}

          <div className="bg-white rounded-xl shadow-sm p-5">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-500">
                  Total Teachers
                </p>

                <h2 className="text-3xl font-bold text-slate-800 mt-2">
                  {totalTeachers}
                </h2>

              </div>

              <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
                <GraduationCap size={23} />
              </div>

            </div>

          </div>

          {/* COURSES */}

          <div className="bg-white rounded-xl shadow-sm p-5">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-500">
                  Active Courses
                </p>

                <h2 className="text-3xl font-bold text-slate-800 mt-2">
                  {totalCourses}
                </h2>

              </div>

              <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                <BookOpen size={23} />
              </div>

            </div>

          </div>

          {/* ATTENDANCE */}

          <div className="bg-white rounded-xl shadow-sm p-5">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-500">
                  Attendance Rate
                </p>

                <h2 className="text-3xl font-bold text-slate-800 mt-2">
                  {attendanceRate}%
                </h2>

              </div>

              <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                <CalendarCheck size={23} />
              </div>

            </div>

          </div>

        </div>

        {/* REPORT OVERVIEW */}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

          <div className="flex items-center gap-3 mb-5">

            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <BarChart3 size={22} />
            </div>

            <div>

              <h2 className="text-xl font-bold text-slate-800">
                Academic Overview
              </h2>

              <p className="text-sm text-slate-500">
                Current LMS statistics
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* STUDENT PERFORMANCE */}

            <div>

              <div className="flex justify-between mb-2">

                <span className="text-sm font-medium text-slate-600">
                  Student Performance
                </span>

                <span className="text-sm font-bold text-blue-600">
                  87%
                </span>

              </div>

              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: "87%" }}
                />

              </div>

            </div>

            {/* ATTENDANCE */}

            <div>

              <div className="flex justify-between mb-2">

                <span className="text-sm font-medium text-slate-600">
                  Attendance
                </span>

                <span className="text-sm font-bold text-green-600">
                  91%
                </span>

              </div>

              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: "91%" }}
                />

              </div>

            </div>

            {/* COURSE COMPLETION */}

            <div>

              <div className="flex justify-between mb-2">

                <span className="text-sm font-medium text-slate-600">
                  Course Completion
                </span>

                <span className="text-sm font-bold text-purple-600">
                  78%
                </span>

              </div>

              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: "78%" }}
                />

              </div>

            </div>

          </div>

        </div>

        {/* REPORTS TABLE */}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          {/* SEARCH AND FILTER */}

          <div className="p-5 border-b">

            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">

              {/* SEARCH */}

              <div className="relative w-full md:max-w-md">

                <Search
                  size={19}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

              </div>

              {/* CATEGORY */}

              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value)
                }
                className="border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500"
              >

                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}

              </select>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50 border-b">

                <tr>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Report
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Category
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Description
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Date
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredReports.length === 0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="text-center px-6 py-10 text-slate-500"
                    >
                      No reports found.
                    </td>

                  </tr>

                ) : (

                  filteredReports.map((report) => (

                    <tr
                      key={report.id}
                      className="border-b last:border-b-0 hover:bg-slate-50"
                    >

                      {/* REPORT */}

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FileText size={20} />
                          </div>

                          <div>

                            <p className="text-sm font-semibold text-slate-800">
                              {report.name}
                            </p>

                            <p className="text-xs text-slate-500">
                              {report.id}
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* CATEGORY */}

                      <td className="px-6 py-4">

                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                          {report.category}
                        </span>

                      </td>

                      {/* DESCRIPTION */}

                      <td className="px-6 py-4">

                        <p className="text-sm text-slate-600 max-w-xs">
                          {report.description}
                        </p>

                      </td>

                      {/* DATE */}

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {report.date}
                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-4">

                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          {report.status}
                        </span>

                      </td>

                      {/* DOWNLOAD */}

                      <td className="px-6 py-4">

                        <button
                          onClick={() =>
                            handleDownload(report)
                          }
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                        >

                          <Download size={16} />

                          Download

                        </button>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

          {/* FOOTER */}

          <div className="px-6 py-4 border-t bg-slate-50">

            <p className="text-sm text-slate-500">

              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredReports.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {reports.length}
              </span>{" "}
              reports

            </p>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Reports;