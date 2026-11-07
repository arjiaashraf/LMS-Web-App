import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  ArrowLeft,
  X,
  Save,
  User
} from "lucide-react";
import { apiFetch as fetch } from "../services/api";

type Student = {
  id: string;
  databaseId: number;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  department: string;
  program: string;
  semester: string;
  cgpa: string;
  profilePhoto: string;
  status: string;
};

function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
    } else {
      fetchStudents();
    }
  }, [navigate]);

  const fetchStudents = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/students");
      const data = await response.json();
      if (response.ok) {
        setStudents(data);
      } else {
        console.error("Failed to fetch students");
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
    }
  };

  const handleDelete = async (databaseId: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this student?");
    if (confirmed) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/delete-user/${databaseId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          fetchStudents();
        } else {
          alert(data.message || "Failed to delete student.");
        }
      } catch (error) {
        console.error("Error deleting student:", error);
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      const response = await fetch(`http://localhost:5000/api/admin/update-student/${selectedStudent.databaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedStudent),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setSelectedStudent(null);
        setIsEditing(false);
        fetchStudents();
      } else {
        alert(data.message || "Failed to update student.");
      }
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };

  const filteredStudents = students.filter((student) => {
    const search = searchTerm.toLowerCase();
    return (
      student.id?.toLowerCase().includes(search) ||
      student.name?.toLowerCase().includes(search) ||
      student.email?.toLowerCase().includes(search) ||
      student.program?.toLowerCase().includes(search)
    );
  });

  const totalStudents = students.length;
  const activeStudents = students.filter((student) => student.status === "Active").length;

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
              <h1 className="text-2xl font-bold text-slate-800">Students Management</h1>
              <p className="text-sm text-slate-500 mt-1">
                View, update, or remove registered students from database
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6 max-w-7xl mx-auto">
        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Approved Students</p>
              <p className="text-2xl font-bold text-slate-800">{totalStudents}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Students</p>
              <p className="text-2xl font-bold text-green-600">{activeStudents}</p>
            </div>
          </div>
        </div>

        {/* STUDENT TABLE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <div className="p-5 border-b">
            <div className="relative max-w-md">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by name, email or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Program & Semester</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">CGPA</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      No students found in database.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.databaseId} className="hover:bg-slate-50">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden">
                          {student.profilePhoto ? (
                            <img src={student.profilePhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400">{student.email} • {student.id}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-700 font-medium">{student.program}</p>
                        <p className="text-xs text-slate-400">{student.semester}</p>
                      </td>
                      <td className="p-4 text-slate-600">{student.department}</td>
                      <td className="p-4 font-semibold text-green-600">{student.cgpa}</td>
                      <td className="p-4 text-slate-600">{student.phone}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsEditing(false);
                            }}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="View / Edit Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsEditing(true);
                            }}
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                            title="Edit Student"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(student.databaseId)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                            title="Delete Student"
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

        {/* VIEW / EDIT MODAL */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  {isEditing ? "Edit Student Details" : "Student Full Profile"}
                </h2>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={selectedStudent.phone}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Qualification</label>
                      <input
                        type="text"
                        value={selectedStudent.qualification}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, qualification: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Program</label>
                      <input
                        type="text"
                        value={selectedStudent.program}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, program: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Semester</label>
                      <input
                        type="text"
                        value={selectedStudent.semester}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, semester: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                      <input
                        type="text"
                        value={selectedStudent.department}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">CGPA</label>
                      <input
                        type="text"
                        value={selectedStudent.cgpa}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, cgpa: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                    >
                      <Save size={16} /> Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border">
                    <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
                      {selectedStudent.profilePhoto ? (
                        <img src={selectedStudent.profilePhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedStudent.name[0]
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{selectedStudent.name}</h3>
                      <p className="text-sm text-slate-500">{selectedStudent.email}</p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                        {selectedStudent.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Phone</p>
                      <p className="font-medium text-slate-700">{selectedStudent.phone}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Qualification</p>
                      <p className="font-medium text-slate-700">{selectedStudent.qualification}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Program</p>
                      <p className="font-medium text-slate-700">{selectedStudent.program}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Semester</p>
                      <p className="font-medium text-slate-700">{selectedStudent.semester}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Department</p>
                      <p className="font-medium text-slate-700">{selectedStudent.department}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-400">Current CGPA</p>
                      <p className="font-semibold text-green-600">{selectedStudent.cgpa}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                    >
                      <Pencil size={16} /> Edit Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Students;