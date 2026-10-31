import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, CheckCircle, XCircle, ArrowLeft, Upload, Eye, Pencil, DollarSign, X, Trash2 } from "lucide-react";
type Course = {
  id: number;
  title: string;
  code: string;
  category: string;
  level: string;
  description: string;
  learning_objectives: string;
  schedule: string;
  duration: string;
  fee: number;
  status: string;
  thumbnail: string;
  proposed_by?: number;
  proposer_name?: string;
  assigned_instructors?: string; // Assigned instructors field added here
};

type PendingEnrollment = {
  id: number;
  student_name: string;
  student_email: string;
  course_title: string;
  timing_days: string;
  start_time: string;
  instructor_name: string;
  payment_proof: string;
  created_at: string;
  payment_method?: string;
  transaction_id?: string;
};

type PaymentSetting = {
  id?: number;
  payment_method: "Bank Transfer" | "JazzCash" | "Easypaisa";
  account_title: string;
  account_number: string;
  bank_name: string;
  iban: string;
  instructions: string;
  is_active: boolean;
};

function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [pendingEnrollments, setPendingEnrollments] = useState<PendingEnrollment[]>([]);
  const [activeTab, setActiveTab] = useState<"catalog" | "proposals" | "payments" | "payment-settings">("catalog");
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedStudentsCourse, setSelectedStudentsCourse] = useState<Course | null>(null);
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // State to hold approved fee for each proposal item
  const [approvalFees, setApprovalFees] = useState<{ [key: number]: number }>({});

  // Admin Create Course Modal & Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    learning_objectives: "",
    schedule: "",
    category: "Quran",
    level: "Beginner",
    fee: 0,
    duration: "4 Weeks",
    thumbnail: ""
  });

  // Course Details View Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<Course | null>(null);

  // Edit / Manage Course Fee Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editFee, setEditFee] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>("Published");
  const [editLevel, setEditLevel] = useState<string>("Beginner");

  // Batch Creation Modal State (With Multiple Instructors & Already Assigned Support)
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [existingAssignedInstructorIds, setExistingAssignedInstructorIds] = useState<number[]>([]);
  const [batchForm, setBatchForm] = useState({
    instructor_ids: [] as number[],
    timing_days: "Mon, Wed, Fri",
    start_time: "10:00 AM",
    end_time: "11:30 AM",
    capacity: 30,
    start_date: ""
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [savingMethod, setSavingMethod] = useState<string | null>(null);
  const [receiptEnrollmentId, setReceiptEnrollmentId] = useState<number | null>(null);

  const paymentMethods: PaymentSetting["payment_method"][] = ["Bank Transfer", "JazzCash", "Easypaisa"];

  const getPaymentSetting = (method: PaymentSetting["payment_method"]): PaymentSetting =>
    paymentSettings.find((setting) => setting.payment_method === method) || {
      payment_method: method,
      account_title: "",
      account_number: "",
      bank_name: "",
      iban: "",
      instructions: "",
      is_active: true
    };

  const updatePaymentSetting = (method: PaymentSetting["payment_method"], changes: Partial<PaymentSetting>) => {
    setPaymentSettings((previous) => {
      const existing = previous.find((setting) => setting.payment_method === method);
      if (existing) return previous.map((setting) => setting.payment_method === method ? { ...setting, ...changes } : setting);
      return [...previous, { ...getPaymentSetting(method), ...changes }];
    });
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/payment-settings");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load payment settings");
      setPaymentSettings(data.map((item: any) => ({
        ...item,
        bank_name: item.bank_name || "",
        iban: item.iban || "",
        instructions: item.instructions || "",
        is_active: Boolean(item.is_active)
      })));
    } catch (error) {
      console.error("Payment settings error:", error);
    }
  };

  const handleSavePaymentSetting = async (method: PaymentSetting["payment_method"]) => {
    const setting = getPaymentSetting(method);
    if (!setting.account_title.trim() || !setting.account_number.trim()) {
      alert("Account title and account number are required.");
      return;
    }
    setSavingMethod(method);
    try {
      const response = await fetch("http://localhost:5000/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save payment settings");
      alert(data.message || "Payment settings saved.");
      await fetchPaymentSettings();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save payment settings.");
    } finally {
      setSavingMethod(null);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
    } else {
      fetchData();
    }
  }, [navigate]);

  const fetchData = async () => {
    try {
      const resCourses = await fetch("http://localhost:5000/api/admin/courses");
      const dataCourses = await resCourses.json();
      if (resCourses.ok) setCourses(dataCourses);

      const resPending = await fetch("http://localhost:5000/api/admin/pending-courses");
      const dataPending = await resPending.json();
      if (resPending.ok) {
        setPendingCourses(dataPending);
        const initialFees: { [key: number]: number } = {};
        dataPending.forEach((c: Course) => {
          initialFees[c.id] = c.fee || 0;
        });
        setApprovalFees(initialFees);
      }

      const resPayments = await fetch("http://localhost:5000/api/admin/pending-enrollments");
      const dataPayments = await resPayments.json();
      if (resPayments.ok) setPendingEnrollments(dataPayments);

      await fetchPaymentSettings();

      const resInst = await fetch("http://localhost:5000/api/teachers");
      const dataInst = await resInst.json();
      if (resInst.ok) setInstructors(dataInst);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchExistingBatchAssignments = async (courseId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/course-batches/${courseId}`);
      const data = await res.json();
      if (res.ok) {
        // Collect all already assigned instructor IDs for this course across batches
        const assignedIds: number[] = [];
        data.forEach((batch: any) => {
          if (batch.assigned_instructor_ids) {
            batch.assigned_instructor_ids.split(",").forEach((idStr: string) => {
              if (idStr) assignedIds.push(Number(idStr));
            });
          }
          if (batch.instructor_id) {
            assignedIds.push(Number(batch.instructor_id));
          }
        });
        setExistingAssignedInstructorIds([...new Set(assignedIds)]);
      }
    } catch (err) {
      console.error("Error fetching existing batch assignments:", err);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCourse({ ...newCourse, thumbnail: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCourse)
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowCreateModal(false);
        setNewCourse({
          title: "",
          description: "",
          learning_objectives: "",
          schedule: "",
          category: "Quran",
          level: "Beginner",
          fee: 0,
          duration: "4 Weeks",
          thumbnail: ""
        });
        fetchData();
      } else {
        alert(data.message || "Failed to create course.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    setEditFee(course.fee || 0);
    setEditStatus(course.status || "Published");
    setEditLevel(course.level || "Beginner");
    setShowEditModal(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/update-course/${editingCourse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee: Number(editFee), status: editStatus, level: editLevel })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowEditModal(false);
        setEditingCourse(null);
        fetchData();
      } else {
        alert(data.message || "Failed to update course.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveCourse = async (courseId: number, status: string) => {
    try {
      const feeToSet = approvalFees[courseId] || 0;
      const res = await fetch(`http://localhost:5000/api/admin/course-status/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, fee: feeToSet })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyEnrollment = async (enrollmentId: number, status: "Active" | "Rejected") => {
    let rejectionReason = "";
    if (status === "Active") {
      if (!window.confirm("Have you checked the payment receipt and transaction details?")) return;
    } else {
      const reason = window.prompt("Enter the reason for rejecting this payment:");
      if (reason === null) return;
      rejectionReason = reason.trim();
      if (!rejectionReason) {
        alert("Rejection reason is required.");
        return;
      }
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/verify-enrollment/${enrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejection_reason: rejectionReason })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Enrollment updated.");
        fetchData();
      } else {
        alert(data.message || "Could not update enrollment.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while verifying enrollment.");
    }
  };

  const handleInstructorCheckboxChange = (id: number) => {
    const currentIds = [...batchForm.instructor_ids];
    if (currentIds.includes(id)) {
      setBatchForm({ ...batchForm, instructor_ids: currentIds.filter(i => i !== id) });
    } else {
      setBatchForm({ ...batchForm, instructor_ids: [...currentIds, id] });
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    try {
      const res = await fetch("http://localhost:5000/api/admin/course-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: selectedCourseId, ...batchForm })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowBatchModal(false);
        setSelectedCourseId(null);
        setBatchForm({
          instructor_ids: [],
          timing_days: "Mon, Wed, Fri",
          start_time: "10:00 AM",
          end_time: "11:30 AM",
          capacity: 30,
          start_date: ""
        });
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
  const confirmed = window.confirm(
    "Are you sure you want to permanently delete this course and its related batches and enrollments?"
  );

  if (!confirmed) return;

  try {
    const res = await fetch(
      `http://localhost:5000/api/admin/courses/${courseId}`,
      { method: "DELETE" }
    );

    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      fetchData();
    } else {
      alert(data.message || "Failed to delete course.");
    }
  } catch (err) {
    console.error("Error deleting course:", err);
    alert("Server error while deleting course.");
  }
};
const handleViewStudents = async (course: Course) => {
  setSelectedStudentsCourse(course);
  setShowStudentsModal(true);
  setLoadingStudents(true);
  setCourseStudents([]);

  try {
    const res = await fetch(
      `http://localhost:5000/api/admin/course-students/${course.id}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to fetch students");
    }

    setCourseStudents(data);
  } catch (err) {
    console.error("Error loading enrolled students:", err);
    alert("Unable to load enrolled students.");
  } finally {
    setLoadingStudents(false);
  }
};
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <header className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/admin-dashboard" className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Admin Course & Batch Management</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-medium shadow"
        >
          <Plus size={18} /> Create New Course
        </button>
      </header>

      {/* TABS */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "catalog" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}
        >
          All Courses ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab("proposals")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "proposals" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}
        >
          Instructor Course Proposals ({pendingCourses.length})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "payments" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}
        >
          Payment Verification Queue ({pendingEnrollments.length})
        </button>
        <button
          onClick={() => setActiveTab("payment-settings")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "payment-settings" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}
        >
          Payment Settings
        </button>
      </div>

      {/* CATALOG TAB */}
      {activeTab === "catalog" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Published & Draft Courses</h3>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="p-3">Thumbnail</th>
                <th className="p-3">Title & Creator</th>
                <th className="p-3">Category</th>
                <th className="p-3">Fee ($)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b hover:bg-slate-50 text-sm">
                  <td className="p-3">
                    <div className="w-14 h-10 rounded bg-slate-200 overflow-hidden flex items-center justify-center">
                      {c.thumbnail ? (
                        <img src={c.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-400">No Img</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => { setSelectedCourseDetail(c); setShowDetailModal(true); }}>
                      {c.title}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.proposed_by ? `Created by Instructor: ${c.proposer_name}` : "Created by: Admin"}
                    </p>
                    {/* Display Assigned Instructor Name */}
                    <p className="text-xs text-purple-600 font-medium mt-1">
                      Assigned To: {c.assigned_instructors || "Not Assigned"}
                    </p>
                  </td>
                  <td className="p-3">{c.category}</td>
                  <td className="p-3 font-bold text-green-600">${c.fee || 0}</td>
                  <td className="p-3"><span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{c.status}</span></td>
                  <td className="p-3 flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedCourseDetail(c); setShowDetailModal(true); }}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="bg-amber-50 text-amber-600 hover:bg-amber-100 p-2 rounded-lg"
                      title="Edit Fee & Status"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        fetchExistingBatchAssignments(c.id);
                        setShowBatchModal(true);
                      }}
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Create Batch
                    </button>
<button
  type="button"
  onClick={() => handleViewStudents(c)}
  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg text-xs font-medium"
  title="View Enrolled Students"
>
  View Students
</button>
                    <button
                    type="button"
                    onClick={() => handleDeleteCourse(c.id)}
                    className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg"
                     title="Delete Course"
                    >
  <Trash2 size={16} />
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PROPOSALS TAB */}
      {activeTab === "proposals" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Pending Instructor Course Proposals</h3>
          {pendingCourses.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">No pending course proposals.</p>
          ) : (
            <div className="space-y-4">
              {pendingCourses.map((c) => (
                <div key={c.id} className="border p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-16 rounded bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {c.thumbnail ? (
                        <img src={c.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-400">No Img</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 cursor-pointer hover:underline text-blue-600" onClick={() => { setSelectedCourseDetail(c); setShowDetailModal(true); }}>
                        {c.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Created by Instructor: <span className="font-semibold text-purple-600">{c.proposer_name}</span> | Category: {c.category}</p>
                      <p className="text-sm text-slate-600 mt-2">{c.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Set Approved Fee ($)</label>
                      <input
                        type="number"
                        value={approvalFees[c.id] !== undefined ? approvalFees[c.id] : c.fee}
                        onChange={(e) => setApprovalFees({ ...approvalFees, [c.id]: Number(e.target.value) })}
                        className="w-24 border p-1.5 rounded-lg text-sm bg-white"
                        min="0"
                      />
                    </div>
                    <button
                      onClick={() => handleApproveCourse(c.id, "Published")}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shrink-0 mt-5"
                    >
                      <CheckCircle size={16} /> Approve & Publish
                    </button>
                    <button
                      onClick={() => handleApproveCourse(c.id, "Rejected")}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shrink-0 mt-5"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAYMENT VERIFICATION TAB */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Student Batch Enrollments Awaiting Payment Verification</h3>
          {pendingEnrollments.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">No pending payment verifications.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="p-3">Student</th>
                  <th className="p-3">Course & Batch Timing</th>
                  <th className="p-3">Assigned Instructor</th>
                  <th className="p-3">Payment Details & Receipt</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingEnrollments.map((pe) => (
                  <tr key={pe.id} className="border-b text-sm">
                    <td className="p-3 font-medium">{pe.student_name}<br/><span className="text-xs text-slate-400">{pe.student_email}</span></td>
                    <td className="p-3">{pe.course_title}<br/><span className="text-xs text-purple-600">{pe.timing_days} ({pe.start_time})</span></td>
                    <td className="p-3">{pe.instructor_name}</td>
                    <td className="p-3 text-xs space-y-1">
                      <p><strong>Method:</strong> {pe.payment_method || "Not recorded"}</p>
                      <p><strong>Transaction ID:</strong> {pe.transaction_id || "Not recorded"}</p>
                      <button
                        type="button"
                        onClick={() => setReceiptEnrollmentId(pe.id)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                      >
                        <Eye size={14} /> View Receipt
                      </button>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => handleVerifyEnrollment(pe.id, "Active")}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700"
                      >
                        Verify & Activate
                      </button>
                      <button
                        onClick={() => handleVerifyEnrollment(pe.id, "Rejected")}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PAYMENT SETTINGS TAB */}
      {activeTab === "payment-settings" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-lg text-slate-800">Payment Account Settings</h3>
            <p className="text-sm text-slate-500 mt-1">These active account details will appear in the Student Enrollment payment form.</p>
          </div>
          {paymentMethods.map((method) => {
            const setting = getPaymentSetting(method);
            return (
              <div key={method} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg text-blue-700">{method}</h4>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={setting.is_active}
                      onChange={(e) => updatePaymentSetting(method, { is_active: e.target.checked })} /> Active
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-sm font-medium">Account Title
                    <input value={setting.account_title} onChange={(e) => updatePaymentSetting(method, { account_title: e.target.value })}
                      className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Account holder name" />
                  </label>
                  <label className="text-sm font-medium">Account Number
                    <input value={setting.account_number} onChange={(e) => updatePaymentSetting(method, { account_number: e.target.value })}
                      className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Account / wallet number" />
                  </label>
                  {method === "Bank Transfer" && (
                    <>
                      <label className="text-sm font-medium">Bank Name
                        <input value={setting.bank_name} onChange={(e) => updatePaymentSetting(method, { bank_name: e.target.value })}
                          className="mt-1 block w-full border rounded-lg p-2.5" placeholder="Bank name" />
                      </label>
                      <label className="text-sm font-medium">IBAN
                        <input value={setting.iban} onChange={(e) => updatePaymentSetting(method, { iban: e.target.value })}
                          className="mt-1 block w-full border rounded-lg p-2.5" placeholder="IBAN (optional)" />
                      </label>
                    </>
                  )}
                </div>
                <label className="block text-sm font-medium">Payment Instructions
                  <textarea value={setting.instructions} onChange={(e) => updatePaymentSetting(method, { instructions: e.target.value })}
                    className="mt-1 block w-full border rounded-lg p-2.5" rows={2} placeholder="Optional instructions for students" />
                </label>
                <button type="button" onClick={() => handleSavePaymentSetting(method)} disabled={savingMethod !== null}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {savingMethod === method ? "Saving..." : `Save ${method} Settings`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* RECEIPT VIEW MODAL */}
      {receiptEnrollmentId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Payment Receipt — Enrollment #{receiptEnrollmentId}</h3>
              <button type="button" onClick={() => setReceiptEnrollmentId(null)} className="text-slate-500 hover:text-slate-800"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-3">Receipt preview (images and PDFs).</p>
            <iframe title="Payment Receipt" src={`http://localhost:5000/api/admin/payment-receipt/${receiptEnrollmentId}`}
              className="w-full h-[60vh] border rounded-lg" />
            <a target="_blank" rel="noopener noreferrer"
              href={`http://localhost:5000/api/admin/payment-receipt/${receiptEnrollmentId}`}
              className="inline-block mt-3 text-blue-600 hover:underline">Open receipt in new tab</a>
          </div>
        </div>
      )}

      {/* ENROLLED STUDENTS MODAL */}
{showStudentsModal && selectedStudentsCourse && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto">

      <div className="flex justify-between items-center mb-5 border-b pb-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Enrolled Students
          </h3>
          <p className="text-sm text-blue-600 mt-1">
            {selectedStudentsCourse.title}
          </p>
        </div>

        <button
          onClick={() => setShowStudentsModal(false)}
          className="text-slate-500 hover:text-red-600"
        >
          <X size={22} />
        </button>
      </div>

      <p className="text-sm font-semibold text-slate-600 mb-4">
        Total Approved Enrollments: {courseStudents.length}
      </p>

      {loadingStudents ? (
        <p className="text-center py-8 text-slate-500">
          Loading students...
        </p>
      ) : courseStudents.length === 0 ? (
        <p className="text-center py-8 text-slate-500">
          No approved students enrolled in this course yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">Student Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Instructor</th>
                <th className="p-3">Batch Timing</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {courseStudents.map((student) => (
                <tr
                  key={student.enrollment_id}
                  className="border-b hover:bg-slate-50"
                >
                  <td className="p-3 font-medium">
                    {student.student_name}
                  </td>

                  <td className="p-3">
                    {student.student_email}
                  </td>

                  <td className="p-3">
                    {student.instructor_name}
                  </td>

                  <td className="p-3">
                    {student.timing_days}
                    <p className="text-xs text-slate-500">
                      {student.start_time} - {student.end_time}
                    </p>
                  </td>

                  <td className="p-3">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-5">
        <button
          onClick={() => setShowStudentsModal(false)}
          className="bg-slate-200 px-5 py-2 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      {/* EDIT FEE & STATUS MODAL */}
      {showEditModal && editingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Manage Course: {editingCourse.title}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Fee ($)</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={editFee}
                    onChange={(e) => setEditFee(Number(e.target.value))}
                    className="w-full border pl-10 pr-4 py-2.5 rounded-lg"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border p-2.5 rounded-lg bg-white"
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                <input
                  type="text"
                  value={editLevel}
                  onChange={(e) => setEditLevel(e.target.value)}
                  className="w-full border p-2.5 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COURSE DETAILS VIEW MODAL */}
      {showDetailModal && selectedCourseDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Course Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="h-40 bg-slate-200 rounded-lg overflow-hidden">
                {selectedCourseDetail.thumbnail ? (
                  <img src={selectedCourseDetail.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">No Thumbnail Available</div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedCourseDetail.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedCourseDetail.proposed_by ? `Created by Instructor: ${selectedCourseDetail.proposer_name}` : "Created by: Admin"} | Category: {selectedCourseDetail.category} | Level: {selectedCourseDetail.level}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-sm">
                <p><strong>Fee:</strong> <span className="text-green-600 font-bold">${selectedCourseDetail.fee || 0}</span></p>
                <p><strong>Duration:</strong> {selectedCourseDetail.duration || "4 Weeks"}</p>
                <p><strong>Status:</strong> {selectedCourseDetail.status}</p>
                <p><strong>Schedule:</strong> {selectedCourseDetail.schedule || "Flexible"}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 text-sm mb-1">Description</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">{selectedCourseDetail.description}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 text-sm mb-1">Learning Objectives</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">{selectedCourseDetail.learning_objectives || "Not specified."}</p>
              </div>
              <div className="flex justify-end pt-3 border-t">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CREATE COURSE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">Create New Course (Admin)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAdminCreateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="e.g. Advanced Quran Studies"
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={newCourse.category}
                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                    className="w-full border p-2.5 rounded-lg bg-white"
                  >
                    <option value="Quran">Quran</option>
                    <option value="Islamic Studies">Islamic Studies</option>
                    <option value="Academics">Academics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                  <select
                    value={newCourse.level}
                    onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                    className="w-full border p-2.5 rounded-lg bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee ($)</label>
                  <input
                    type="number"
                    value={newCourse.fee}
                    onChange={(e) => setNewCourse({ ...newCourse, fee: Number(e.target.value) })}
                    className="w-full border p-2.5 rounded-lg"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={newCourse.duration}
                    onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                    placeholder="e.g. 4 Weeks"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Course overview..."
                  className="w-full border p-2.5 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Learning Objectives</label>
                <textarea
                  rows={2}
                  value={newCourse.learning_objectives}
                  onChange={(e) => setNewCourse({ ...newCourse, learning_objectives: e.target.value })}
                  placeholder="What students will learn..."
                  className="w-full border p-2.5 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Course Thumbnail</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
                    {newCourse.thumbnail ? (
                      <img src={newCourse.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">No Image</span>
                    )}
                  </div>
                  <label className="cursor-pointer bg-slate-50 text-slate-700 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-slate-100 transition flex items-center gap-2">
                    <Upload size={16} /> Upload Thumbnail
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Publish Course Directly</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH CREATION MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Course Batch & Assign Instructors</h3>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign Instructors (Select One or More)</label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                  {instructors.map((inst) => {
                    const instId = Number(inst.databaseId || inst.id);
                    const isAlreadyAssigned = existingAssignedInstructorIds.includes(instId);
                    return (
                      <label key={instId} className={`flex items-center justify-between text-sm p-1.5 rounded ${isAlreadyAssigned ? 'bg-amber-50 text-slate-500' : 'hover:bg-slate-100 text-slate-700 cursor-pointer'}`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isAlreadyAssigned}
                            checked={batchForm.instructor_ids.includes(instId) || isAlreadyAssigned}
                            onChange={() => handleInstructorCheckboxChange(instId)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>{inst.name} <span className="text-xs text-slate-400">({inst.department})</span></span>
                        </div>
                        {isAlreadyAssigned && (
                          <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">Already Assigned</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Timing Days</label>
                  <input
                    type="text"
                    value={batchForm.timing_days}
                    onChange={(e) => setBatchForm({ ...batchForm, timing_days: e.target.value })}
                    placeholder="e.g. Mon, Wed, Fri"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <input
                    type="text"
                    value={batchForm.start_time}
                    onChange={(e) => setBatchForm({ ...batchForm, start_time: e.target.value })}
                    placeholder="10:00 AM"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Seat Capacity</label>
                  <input
                    type="number"
                    value={batchForm.capacity}
                    onChange={(e) => setBatchForm({ ...batchForm, capacity: Number(e.target.value) })}
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })}
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">Create Batch & Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Courses;