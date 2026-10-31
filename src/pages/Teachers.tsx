import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  GraduationCap,
  ArrowLeft,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { Link } from "react-router-dom";

type Teacher = {
  id: string;
  databaseId?: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  subject: string;
  qualification: string;
  specialisation: string;
  profilePhoto: string;
  status: "Active" | "Pending" | "Inactive";
};

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
      return;
    }
    fetchTeachers();
  }, [navigate]);

  // Fetch teachers from backend database
  const fetchTeachers = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/teachers");
      const data = await response.json();
      if (response.ok) {
        const formatted = data.map((t: any) => ({
          id: t.id,
          databaseId: t.databaseId,
          name: t.name,
          email: t.email,
          phone: t.phone !== "Not Provided" ? t.phone : "",
          department: t.department !== "Not Provided" ? t.department : "General",
          subject: t.specialisation !== "Not Provided" ? t.specialisation : "General",
          qualification: t.qualification !== "Not Provided" ? t.qualification : "",
          specialisation: t.specialisation !== "Not Provided" ? t.specialisation : "",
          profilePhoto: t.profilePhoto || "",
          status: t.status === "Active" ? "Active" : "Inactive"
        }));
        setTeachers(formatted);
      }
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<string | null>(null);

  const [formData, setFormData] = useState<Teacher>({
    id: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    subject: "",
    qualification: "",
    specialisation: "",
    profilePhoto: "",
    status: "Active",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeacher !== null) {
      const teacherToUpdate = teachers.find(t => t.id === editingTeacher);
      if (!teacherToUpdate?.databaseId) return;

      try {
        const response = await fetch(`http://localhost:5000/api/admin/update-teacher/${teacherToUpdate.databaseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formData.phone,
            qualification: formData.qualification,
            specialisation: formData.subject,
            department: formData.department
          }),
        });
        if (response.ok) {
          fetchTeachers();
        } else {
          alert("Failed to update teacher profile.");
        }
      } catch (error) {
        console.error("Error updating teacher:", error);
      }
    }
    closeForm();
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher.id);
    setFormData(teacher);
    setShowForm(true);
  };

  const handleDelete = async (teacher: Teacher) => {
    const confirmed = window.confirm("Are you sure you want to delete this teacher from the database?");
    if (confirmed) {
      if (!teacher.databaseId) return;

      try {
        const response = await fetch(`http://localhost:5000/api/admin/delete-user/${teacher.databaseId}`, {
          method: "DELETE",
        });

        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          fetchTeachers();
        } else {
          alert(data.message || "Failed to delete teacher.");
        }
      } catch (error) {
        console.error("Error deleting teacher:", error);
        alert("Server error while deleting.");
      }
    }
  };

  const handleView = (teacher: Teacher) => {
    window.alert(
      `Teacher Details\n\n` +
        `Teacher ID: ${teacher.id}\n` +
        `Name: ${teacher.name}\n` +
        `Email: ${teacher.email}\n` +
        `Phone: ${teacher.phone || "Not Provided"}\n` +
        `Department: ${teacher.department}\n` +
        `Specialisation/Subject: ${teacher.subject}\n` +
        `Qualification: ${teacher.qualification || "Not Provided"}\n` +
        `Status: ${teacher.status}`
    );
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const search = searchTerm.toLowerCase();
    return (
      teacher.id.toLowerCase().includes(search) ||
      teacher.name.toLowerCase().includes(search) ||
      teacher.email.toLowerCase().includes(search) ||
      teacher.phone.toLowerCase().includes(search) ||
      teacher.department.toLowerCase().includes(search) ||
      teacher.subject.toLowerCase().includes(search) ||
      teacher.qualification.toLowerCase().includes(search) ||
      teacher.status.toLowerCase().includes(search)
    );
  });

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((teacher) => teacher.status === "Active").length;
  const inactiveTeachers = teachers.filter((teacher) => teacher.status === "Inactive").length;
  const departments = new Set(teachers.map((teacher) => teacher.department)).size;

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
              <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage registered teachers and faculty profiles
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6">
        {/* EDIT FORM */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Edit Teacher Details</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Update teacher academic information below
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

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Teacher ID</label>
                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  disabled
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  disabled
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0300-1234567"
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g. Computer Science"
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject / Specialisation</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="e.g. Artificial Intelligence"
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Qualification</label>
                <input
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  placeholder="e.g. Ph.D Computer Science"
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

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
                  Update Teacher
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <GraduationCap size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Teachers</p>
                <p className="text-2xl font-bold text-slate-800">{totalTeachers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active Teachers</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{activeTeachers}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Inactive Teachers</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{inactiveTeachers}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">Departments</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{departments}</p>
          </div>
        </div>

        {/* TEACHERS TABLE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <div className="relative max-w-md">
              <Search size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Teacher</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Contact</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Department</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Subject</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Qualification</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                      No teachers found from database.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden border">
                            {teacher.profilePhoto ? (
                              <img src={teacher.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              teacher.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{teacher.name}</p>
                            <p className="text-xs text-slate-500">{teacher.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail size={13} /> {teacher.email}
                          </p>
                          <p className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone size={13} /> {teacher.phone || "Not Provided"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{teacher.department}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{teacher.subject}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{teacher.qualification || "Not Provided"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            teacher.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {teacher.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(teacher)}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="View Teacher"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(teacher)}
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                            title="Edit Teacher"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                            title="Delete Teacher"
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

export default Teachers;