
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../services/api";

type Teacher = {
  id: string;
  databaseId: number;
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

type TeacherApiRecord = {
  id?: string | number;
  databaseId?: number;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  specialisation?: string;
  qualification?: string;
  profilePhoto?: string;
  status?: string;
};

const emptyTeacher: Teacher = {
  id: "",
  databaseId: 0,
  name: "",
  email: "",
  phone: "",
  department: "",
  subject: "",
  qualification: "",
  specialisation: "",
  profilePhoto: "",
  status: "Inactive",
};

function Teachers() {
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTeacher, setEditingTeacher] =
    useState<Teacher | null>(null);
  const [formData, setFormData] =
    useState<Teacher>(emptyTeacher);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/teachers");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load teachers."
        );
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid teachers response.");
      }

      const formatted: Teacher[] = data.map(
        (item: TeacherApiRecord) => {
          const name = String(item.name || "");
          const specialisation =
            item.specialisation &&
            item.specialisation !== "Not Provided"
              ? item.specialisation
              : "";

          const originalStatus = String(
            item.status || ""
          ).toLowerCase();

          const status: Teacher["status"] =
            originalStatus === "active" ||
            originalStatus === "approved"
              ? "Active"
              : originalStatus === "pending"
                ? "Pending"
                : "Inactive";

          return {
            id: String(item.id || ""),
            databaseId: Number(item.databaseId || 0),
            name,
            email: String(item.email || ""),
            phone:
              item.phone === "Not Provided"
                ? ""
                : String(item.phone || ""),
            department:
              item.department === "Not Provided"
                ? "General"
                : String(item.department || "General"),
            subject: specialisation || "General",
            qualification:
              item.qualification === "Not Provided"
                ? ""
                : String(item.qualification || ""),
            specialisation,
            profilePhoto: String(item.profilePhoto || ""),
            status,
          };
        }
      );

      setTeachers(formatted);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load teachers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let allowed = false;

    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      allowed =
        user.role === "admin" &&
        typeof user.token === "string" &&
        user.token.length > 0;
    } catch {
      allowed = false;
    }

    if (!allowed) {
      navigate("/login", { replace: true });
      return;
    }

    void fetchTeachers();
  }, [navigate, fetchTeachers]);

  const closeForm = () => {
    setEditingTeacher(null);
    setFormData(emptyTeacher);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({ ...teacher });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingTeacher?.databaseId || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/update-teacher/${editingTeacher.databaseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: formData.phone.trim(),
            qualification: formData.qualification.trim(),
            specialisation: formData.subject.trim(),
            department: formData.department.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update teacher."
        );
      }

      closeForm();
      await fetchTeachers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update teacher."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!teacher.databaseId) return;

    const confirmed = window.confirm(
      `Delete ${teacher.name} from the database?\n\n` +
      "This action may affect related records."
    );

    if (!confirmed) return;

    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/delete-user/${teacher.databaseId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete teacher."
        );
      }

      window.alert(
        data.message || "Teacher deleted successfully."
      );

      await fetchTeachers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete teacher."
      );
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
      `Subject: ${teacher.subject}\n` +
      `Qualification: ${teacher.qualification || "Not Provided"}\n` +
      `Status: ${teacher.status}`
    );
  };

  const filteredTeachers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return teachers.filter((teacher) =>
      [
        teacher.id,
        teacher.name,
        teacher.email,
        teacher.phone,
        teacher.department,
        teacher.subject,
        teacher.qualification,
        teacher.status,
      ].some((value) =>
        value.toLowerCase().includes(search)
      )
    );
  }, [teachers, searchTerm]);

  const totalTeachers = teachers.length;

  const activeTeachers = teachers.filter(
    (teacher) => teacher.status === "Active"
  ).length;

  const inactiveTeachers = teachers.filter(
    (teacher) => teacher.status === "Inactive"
  ).length;

  const departments = new Set(
    teachers
      .map((teacher) => teacher.department.trim())
      .filter(Boolean)
  ).size;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin-dashboard"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Teachers
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage registered teachers and faculty profiles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchTeachers()}
            disabled={loading}
            className="flex items-center gap-2 border rounded-lg px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700"
          >
            {error}
          </div>
        )}

        {editingTeacher && (
          <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Edit Teacher Details
                </h2>
                <p className="text-sm text-slate-500">
                  Update teacher academic information
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              {[
                { label: "Teacher ID", key: "id" },
                { label: "Full Name", key: "name" },
                { label: "Email Address", key: "email" },
                { label: "Phone Number", key: "phone" },
                { label: "Department", key: "department" },
                { label: "Subject / Specialisation", key: "subject" },
                { label: "Qualification", key: "qualification" },
              ].map((field) => {
                const readOnly = [
                  "id",
                  "name",
                  "email",
                ].includes(field.key);

                const value = String(
                  formData[field.key as keyof Teacher] ?? ""
                );

                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {field.label}
                    </label>

                    <input
                      type={field.key === "email" ? "email" : "text"}
                      name={field.key}
                      value={value}
                      onChange={handleChange}
                      disabled={readOnly}
                      className={`w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500 ${
                        readOnly
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white"
                      }`}
                    />
                  </div>
                );
              })}

              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 border rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Update Teacher"}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {[
            {
              label: "Total Teachers",
              value: totalTeachers,
              color: "text-slate-800",
            },
            {
              label: "Active Teachers",
              value: activeTeachers,
              color: "text-green-600",
            },
            {
              label: "Inactive Teachers",
              value: inactiveTeachers,
              color: "text-red-500",
            },
            {
              label: "Departments",
              value: departments,
              color: "text-purple-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {stat.label === "Total Teachers" && (
                  <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                    <GraduationCap size={22} />
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-500">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                    {loading ? "—" : stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <div className="relative max-w-md">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {[
                    "Teacher",
                    "Contact",
                    "Department",
                    "Subject",
                    "Qualification",
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
                      Loading teachers...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-red-600"
                    >
                      Unable to load teachers. Check the error above.
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No teachers found from database.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className="border-b last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden">
                            {teacher.profilePhoto ? (
                              <img
                                src={teacher.profilePhoto}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              teacher.name.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {teacher.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {teacher.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail size={13} />
                          {teacher.email}
                        </p>
                        <p className="flex items-center gap-2 text-xs text-slate-600 mt-2">
                          <Phone size={13} />
                          {teacher.phone || "Not Provided"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {teacher.department}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {teacher.subject}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {teacher.qualification || "Not Provided"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            teacher.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : teacher.status === "Pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {teacher.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleView(teacher)}
                            title="View Teacher"
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEdit(teacher)}
                            title="Edit Teacher"
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(teacher)}
                            title="Delete Teacher"
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
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
        </section>
      </main>
    </div>
  );
}

export default Teachers;
