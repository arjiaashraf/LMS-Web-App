import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  FileText,
  ArrowLeft,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

type ExamStatus = "Upcoming" | "Completed" | "Results Published";

type Exam = {
  id: string;
  title: string;
  course: string;
  teacher: string;
  examDate: string;
  totalMarks: number;
  students: number;
  passed: number;
  status: ExamStatus;
};

function Exams() {
  const [exams, setExams] = useState<Exam[]>([
    {
      id: "EXM001",
      title: "Mid Term Examination",
      course: "Data Structures",
      teacher: "Dr. Ali Khan",
      examDate: "2026-08-12",
      totalMarks: 50,
      students: 35,
      passed: 30,
      status: "Upcoming",
    },
    {
      id: "EXM002",
      title: "Final Examination",
      course: "Database Systems",
      teacher: "Dr. Sara Ahmed",
      examDate: "2026-08-20",
      totalMarks: 100,
      students: 40,
      passed: 36,
      status: "Upcoming",
    },
    {
      id: "EXM003",
      title: "Quiz 1",
      course: "Software Engineering",
      teacher: "Dr. Hassan Raza",
      examDate: "2026-07-30",
      totalMarks: 20,
      students: 35,
      passed: 31,
      status: "Results Published",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingExam, setEditingExam] = useState<string | null>(null);

  const navigate = useNavigate();

useEffect(() => {
  const user = localStorage.getItem("user");
  if (!user) {
    navigate("/login");
  }
}, [navigate]);

  const [formData, setFormData] = useState<Exam>({
    id: "",
    title: "",
    course: "",
    teacher: "",
    examDate: "",
    totalMarks: 50,
    students: 0,
    passed: 0,
    status: "Upcoming",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        name === "totalMarks" ||
        name === "students" ||
        name === "passed"
          ? Number(value)
          : value,
    }));
  };

  const openAddForm = () => {
    setEditingExam(null);

    setFormData({
      id: "",
      title: "",
      course: "",
      teacher: "",
      examDate: "",
      totalMarks: 50,
      students: 0,
      passed: 0,
      status: "Upcoming",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingExam(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.passed > formData.students) {
      window.alert(
        "Passed students cannot be greater than total students."
      );
      return;
    }

    if (editingExam !== null) {
      setExams(
        exams.map((exam) =>
          exam.id === editingExam ? formData : exam
        )
      );
    } else {
      setExams([...exams, formData]);
    }

    closeForm();
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam.id);
    setFormData(exam);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this exam?"
    );

    if (confirmed) {
      setExams(exams.filter((exam) => exam.id !== id));
    }
  };

  const handleView = (exam: Exam) => {
    const passRate =
      exam.students > 0
        ? Math.round((exam.passed / exam.students) * 100)
        : 0;

    window.alert(
      `Exam Details\n\n` +
        `Exam ID: ${exam.id}\n` +
        `Title: ${exam.title}\n` +
        `Course: ${exam.course}\n` +
        `Teacher: ${exam.teacher}\n` +
        `Exam Date: ${exam.examDate}\n` +
        `Total Marks: ${exam.totalMarks}\n` +
        `Students: ${exam.students}\n` +
        `Passed: ${exam.passed}\n` +
        `Pass Rate: ${passRate}%\n` +
        `Status: ${exam.status}`
    );
  };

  const filteredExams = exams.filter((exam) => {
    const search = searchTerm.toLowerCase();

    return (
      exam.id.toLowerCase().includes(search) ||
      exam.title.toLowerCase().includes(search) ||
      exam.course.toLowerCase().includes(search) ||
      exam.teacher.toLowerCase().includes(search) ||
      exam.status.toLowerCase().includes(search)
    );
  });

  const totalExams = exams.length;

  const upcomingExams = exams.filter(
    (exam) => exam.status === "Upcoming"
  ).length;

  const completedExams = exams.filter(
    (exam) => exam.status === "Completed"
  ).length;

  const publishedResults = exams.filter(
    (exam) => exam.status === "Results Published"
  ).length;

  const totalStudents = exams.reduce(
    (sum, exam) => sum + exam.students,
    0
  );

  const totalPassed = exams.reduce(
    (sum, exam) => sum + exam.passed,
    0
  );

  const overallPassRate =
    totalStudents === 0
      ? 0
      : Math.round((totalPassed / totalStudents) * 100);

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
                Exams & Results
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Manage examinations and student results
              </p>
            </div>

          </div>

          <button
            onClick={openAddForm}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium"
          >
            <Plus size={18} />
            Add Exam
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
                  {editingExam ? "Edit Exam" : "Add New Exam"}
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Enter examination information
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

              {/* EXAM ID */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam ID
                </label>

                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  placeholder="e.g. EXM004"
                  required
                  disabled={editingExam !== null}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              {/* TITLE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Title
                </label>

                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Mid Term Examination"
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

              {/* TEACHER */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Teacher
                </label>

                <input
                  type="text"
                  name="teacher"
                  value={formData.teacher}
                  onChange={handleChange}
                  placeholder="Enter teacher name"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* DATE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Date
                </label>

                <input
                  type="date"
                  name="examDate"
                  value={formData.examDate}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* TOTAL MARKS */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Marks
                </label>

                <input
                  type="number"
                  name="totalMarks"
                  value={formData.totalMarks}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* STUDENTS */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Students
                </label>

                <input
                  type="number"
                  name="students"
                  value={formData.students}
                  onChange={handleChange}
                  min="0"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* PASSED */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Passed Students
                </label>

                <input
                  type="number"
                  name="passed"
                  value={formData.passed}
                  onChange={handleChange}
                  min="0"
                  max={formData.students}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* STATUS */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Status
                </label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Upcoming">
                    Upcoming
                  </option>

                  <option value="Completed">
                    Completed
                  </option>

                  <option value="Results Published">
                    Results Published
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
                  {editingExam ? "Update Exam" : "Save Exam"}
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
                <FileText size={22} />
              </div>

              <div>

                <p className="text-sm text-slate-500">
                  Total Exams
                </p>

                <p className="text-2xl font-bold text-slate-800">
                  {totalExams}
                </p>

              </div>

            </div>

          </div>

          {/* UPCOMING */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Upcoming
            </p>

            <p className="text-2xl font-bold text-blue-600 mt-1">
              {upcomingExams}
            </p>

          </div>

          {/* COMPLETED */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Completed
            </p>

            <p className="text-2xl font-bold text-orange-500 mt-1">
              {completedExams}
            </p>

          </div>

          {/* RESULTS */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Results Published
            </p>

            <p className="text-2xl font-bold text-green-600 mt-1">
              {publishedResults}
            </p>

          </div>

          {/* PASS RATE */}

          <div className="bg-white rounded-xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Overall Pass Rate
            </p>

            <p className="text-2xl font-bold text-purple-600 mt-1">
              {overallPassRate}%
            </p>

          </div>

        </div>

        {/* SEARCH + TABLE */}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-5 border-b">

            <div className="relative max-w-md">

              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50 border-b">

                <tr>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Exam
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Course
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Teacher
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Exam Date
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Marks
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Students
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Pass Rate
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

                {filteredExams.length === 0 ? (

                  <tr>

                    <td
                      colSpan={9}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No exams found.
                    </td>

                  </tr>

                ) : (

                  filteredExams.map((exam) => {

                    const passRate =
                      exam.students > 0
                        ? Math.round(
                            (exam.passed / exam.students) * 100
                          )
                        : 0;

                    return (

                      <tr
                        key={exam.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >

                        {/* EXAM */}

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                              <FileText size={20} />
                            </div>

                            <div>

                              <p className="text-sm font-semibold text-slate-800">
                                {exam.title}
                              </p>

                              <p className="text-xs text-slate-500">
                                {exam.id}
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* COURSE */}

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {exam.course}
                        </td>

                        {/* TEACHER */}

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {exam.teacher}
                        </td>

                        {/* DATE */}

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {exam.examDate}
                        </td>

                        {/* MARKS */}

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {exam.totalMarks}
                        </td>

                        {/* STUDENTS */}

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {exam.students}
                        </td>

                        {/* PASS RATE */}

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-2">

                            <span className="text-sm font-medium text-slate-700">
                              {passRate}%
                            </span>

                            <div className="w-16 h-1.5 bg-slate-200 rounded-full">

                              <div
                                className="h-1.5 bg-green-500 rounded-full"
                                style={{
                                  width: `${passRate}%`,
                                }}
                              />

                            </div>

                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-6 py-4">

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              exam.status === "Upcoming"
                                ? "bg-blue-100 text-blue-700"
                                : exam.status === "Completed"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {exam.status}
                          </span>

                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-2">

                            <button
                              onClick={() =>
                                handleView(exam)
                              }
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                              title="View Exam"
                            >
                              <Eye size={18} />
                            </button>

                            <button
                              onClick={() =>
                                handleEdit(exam)
                              }
                              className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                              title="Edit Exam"
                            >
                              <Pencil size={18} />
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(exam.id)
                              }
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                              title="Delete Exam"
                            >
                              <Trash2 size={18} />
                            </button>

                          </div>

                        </td>

                      </tr>

                    );
                  })

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Exams;