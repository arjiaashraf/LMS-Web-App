import {
  BarChart3,
  ArrowLeft,
  CheckCircle,
  Award,
} from "lucide-react";
import { Link } from "react-router-dom";

function StudentResults() {
  const results = [
    {
      course: "Data Structures & Algorithms",
      code: "CS-201",
      midterm: 84,
      assignment: 88,
      final: 86,
      grade: "A",
      gpa: 4.0,
    },
    {
      course: "Database Systems",
      code: "CS-305",
      midterm: 78,
      assignment: 82,
      final: 80,
      grade: "A-",
      gpa: 3.7,
    },
    {
      course: "Software Engineering",
      code: "SE-301",
      midterm: 91,
      assignment: 90,
      final: 92,
      grade: "A+",
      gpa: 4.0,
    },
    {
      course: "Computer Networks",
      code: "CS-402",
      midterm: 76,
      assignment: 81,
      final: 79,
      grade: "B+",
      gpa: 3.3,
    },
    {
      course: "Artificial Intelligence",
      code: "AI-401",
      midterm: 83,
      assignment: 80,
      final: 84,
      grade: "A-",
      gpa: 3.7,
    },
    {
      course: "Web Engineering",
      code: "WE-304",
      midterm: 94,
      assignment: 92,
      final: 91,
      grade: "A+",
      gpa: 4.0,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">

      <header className="bg-white border-b h-20 flex items-center justify-between px-6">

        <div className="flex items-center gap-4">

          <Link
            to="/student-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={22} />
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Results & Grades
            </h1>

            <p className="text-sm text-slate-500">
              View your academic performance
            </p>
          </div>

        </div>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          MA
        </div>

      </header>

      <main className="max-w-7xl mx-auto p-6">

        {/* INTRO */}

        <div className="bg-purple-600 rounded-xl p-6 text-white mb-6">

          <div className="flex items-center gap-4">

            <div className="bg-white/20 p-3 rounded-lg">
              <BarChart3 size={30} />
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                Academic Results
              </h2>

              <p className="text-purple-100 mt-1">
                Your current semester performance and grades.
              </p>
            </div>

          </div>

        </div>

        {/* STATISTICS */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-slate-500">
              Current GPA
            </p>

            <h2 className="text-3xl font-bold text-purple-600 mt-2">
              3.62
            </h2>

            <p className="text-sm text-green-600 mt-2">
              Excellent performance
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-slate-500">
              Semester Percentage
            </p>

            <h2 className="text-3xl font-bold text-blue-600 mt-2">
              85%
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              Overall average
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-slate-500">
              Courses Completed
            </p>

            <h2 className="text-3xl font-bold text-green-600 mt-2">
              6
            </h2>

            <p className="text-sm text-slate-500 mt-2">
              Current semester
            </p>

          </div>

        </div>

        {/* RESULTS TABLE */}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-6 border-b">

            <h2 className="text-xl font-bold text-slate-800">
              Semester Results
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Detailed marks and grades
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50">

                <tr>

                  <th className="text-left px-6 py-4 text-sm text-slate-600">
                    Course
                  </th>

                  <th className="text-center px-6 py-4 text-sm text-slate-600">
                    Midterm
                  </th>

                  <th className="text-center px-6 py-4 text-sm text-slate-600">
                    Assignment
                  </th>

                  <th className="text-center px-6 py-4 text-sm text-slate-600">
                    Final
                  </th>

                  <th className="text-center px-6 py-4 text-sm text-slate-600">
                    Grade
                  </th>

                  <th className="text-center px-6 py-4 text-sm text-slate-600">
                    GPA
                  </th>

                </tr>

              </thead>

              <tbody>

                {results.map((result) => (

                  <tr
                    key={result.code}
                    className="border-t hover:bg-slate-50"
                  >

                    <td className="px-6 py-5">

                      <p className="font-semibold text-slate-800">
                        {result.course}
                      </p>

                      <p className="text-xs text-slate-500">
                        {result.code}
                      </p>

                    </td>

                    <td className="text-center px-6 py-5">
                      {result.midterm}%
                    </td>

                    <td className="text-center px-6 py-5">
                      {result.assignment}%
                    </td>

                    <td className="text-center px-6 py-5">
                      {result.final}%
                    </td>

                    <td className="text-center px-6 py-5">

                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                        <CheckCircle size={15} />
                        {result.grade}
                      </span>

                    </td>

                    <td className="text-center px-6 py-5 font-bold text-purple-600">
                      {result.gpa.toFixed(1)}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

        {/* ACHIEVEMENT */}

        <div className="bg-white rounded-xl shadow-sm p-6 mt-6 flex items-center gap-4">

          <div className="bg-yellow-100 text-yellow-600 p-3 rounded-lg">
            <Award size={28} />
          </div>

          <div>

            <h3 className="font-bold text-slate-800">
              Keep up the excellent work!
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Your current academic performance is above average.
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}

export default StudentResults;