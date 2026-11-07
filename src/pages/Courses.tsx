
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Upload,
  Eye,
  Pencil,
  DollarSign,
  X,
  Trash2,
} from "lucide-react";
import { apiFetch as fetch } from "../services/api";

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
  assigned_instructors?: string;
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

type BatchForm = {
  instructor_ids: number[];
  timing_days: string;
  start_time: string;
  end_time: string;
  capacity: number;
  start_date: string;
};

type Instructor = {
  id: string | number;
  databaseId?: number;
  name: string;
  department?: string;
};

type CourseStudent = {
  enrollment_id: number;
  student_name: string;
  student_email: string;
  instructor_name: string;
  timing_days: string;
  start_time: string;
  end_time: string;
};

const initialCourse = {
  title: "",
  description: "",
  learning_objectives: "",
  schedule: "",
  category: "Quran",
  level: "Beginner",
  fee: 0,
  duration: "4 Weeks",
  thumbnail: "",
};

const initialBatch: BatchForm = {
  instructor_ids: [],
  timing_days: "Mon, Wed, Fri",
  start_time: "10:00 AM",
  end_time: "11:30 AM",
  capacity: 30,
  start_date: "",
};

const paymentMethods: PaymentSetting["payment_method"][] = [
  "Bank Transfer",
  "JazzCash",
  "Easypaisa",
];

function Courses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [pendingEnrollments, setPendingEnrollments] =
    useState<PendingEnrollment[]>([]);

  const [activeTab, setActiveTab] = useState<
    "catalog" | "proposals" | "payments" | "payment-settings"
  >("catalog");

  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedStudentsCourse, setSelectedStudentsCourse] =
    useState<Course | null>(null);
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [approvalFees, setApprovalFees] =
    useState<Record<number, number>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState(initialCourse);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourseDetail, setSelectedCourseDetail] =
    useState<Course | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editFee, setEditFee] = useState(0);
  const [editStatus, setEditStatus] = useState("Published");
  const [editLevel, setEditLevel] = useState("Beginner");

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] =
    useState<number | null>(null);

  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [
    existingAssignedInstructorIds,
    setExistingAssignedInstructorIds,
  ] = useState<number[]>([]);

  const [batchForm, setBatchForm] = useState<BatchForm>(initialBatch);

  const [paymentSettings, setPaymentSettings] =
    useState<PaymentSetting[]>([]);
  const [savingMethod, setSavingMethod] = useState<string | null>(null);

  // JWT-PROTECTED PAYMENT RECEIPT PREVIEW
  const [receiptEnrollmentId, setReceiptEnrollmentId] =
    useState<number | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");

  const [pageError, setPageError] = useState("");

  // ==========================================
  // ADMIN AUTH CHECK
  // ==========================================

  useEffect(() => {
    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      if (
        user.role !== "admin" ||
        typeof user.token !== "string" ||
        !user.token
      ) {
        navigate("/login", { replace: true });
        return;
      }

      void fetchData();
    } catch {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // ==========================================
  // PAYMENT SETTINGS
  // ==========================================

  const getPaymentSetting = (
    method: PaymentSetting["payment_method"]
  ): PaymentSetting =>
    paymentSettings.find(
      (setting) => setting.payment_method === method
    ) || {
      payment_method: method,
      account_title: "",
      account_number: "",
      bank_name: "",
      iban: "",
      instructions: "",
      is_active: true,
    };

  const updatePaymentSetting = (
    method: PaymentSetting["payment_method"],
    changes: Partial<PaymentSetting>
  ) => {
    setPaymentSettings((previous) => {
      const existing = previous.find(
        (setting) => setting.payment_method === method
      );

      if (existing) {
        return previous.map((setting) =>
          setting.payment_method === method
            ? { ...setting, ...changes }
            : setting
        );
      }

      return [
        ...previous,
        {
          payment_method: method,
          account_title: "",
          account_number: "",
          bank_name: "",
          iban: "",
          instructions: "",
          is_active: true,
          ...changes,
        },
      ];
    });
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch(
        "/api/admin/payment-settings"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load payment settings."
        );
      }

      setPaymentSettings(
        data.map((item: PaymentSetting) => ({
          ...item,
          bank_name: item.bank_name || "",
          iban: item.iban || "",
          instructions: item.instructions || "",
          is_active: Boolean(item.is_active),
        }))
      );
    } catch (error) {
      console.error("Payment settings error:", error);
    }
  };

  const handleSavePaymentSetting = async (
    method: PaymentSetting["payment_method"]
  ) => {
    const setting = getPaymentSetting(method);

    if (
      !setting.account_title.trim() ||
      !setting.account_number.trim()
    ) {
      alert("Account title and account number are required.");
      return;
    }

    setSavingMethod(method);

    try {
      const response = await fetch(
        "/api/admin/payment-settings",
        {
          method: "PUT",
          body: JSON.stringify(setting),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not save payment settings."
        );
      }

      alert(data.message || "Payment settings saved.");
      await fetchPaymentSettings();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save payment settings."
      );
    } finally {
      setSavingMethod(null);
    }
  };

  // ==========================================
  // FETCH ADMIN DATA WITH JWT
  // ==========================================

  const fetchData = async () => {
    try {
      setPageError("");

      const [
        resCourses,
        resPending,
        resPayments,
        resInst,
      ] = await Promise.all([
        fetch("/api/admin/courses"),
        fetch("/api/admin/pending-courses"),
        fetch("/api/admin/pending-enrollments"),
        fetch("/api/teachers"),
      ]);

      const [
        dataCourses,
        dataPending,
        dataPayments,
        dataInst,
      ] = await Promise.all([
        resCourses.json(),
        resPending.json(),
        resPayments.json(),
        resInst.json(),
      ]);

      if (resCourses.ok && Array.isArray(dataCourses)) {
        setCourses(dataCourses);
      }

      if (resPending.ok && Array.isArray(dataPending)) {
        setPendingCourses(dataPending);

        const initialFees: Record<number, number> = {};

        dataPending.forEach((course: Course) => {
          initialFees[course.id] = Number(course.fee || 0);
        });

        setApprovalFees(initialFees);
      }

      if (resPayments.ok && Array.isArray(dataPayments)) {
        setPendingEnrollments(dataPayments);
      }

      if (resInst.ok && Array.isArray(dataInst)) {
        setInstructors(dataInst);
      }

      if (
        !resCourses.ok ||
        !resPending.ok ||
        !resPayments.ok ||
        !resInst.ok
      ) {
        setPageError(
          "Some admin data could not be loaded. Check the Network tab for a failed Admin API (especially /api/teachers)."
        );
      }

      await fetchPaymentSettings();
    } catch (error) {
      console.error("Error fetching admin courses data:", error);
      setPageError("Unable to load course management data.");
    }
  };

  // ==========================================
  // JWT RECEIPT LOADING
  // ==========================================

  useEffect(() => {
    if (receiptEnrollmentId === null) {
      setReceiptUrl(null);
      setReceiptType("");
      setReceiptError("");
      setReceiptLoading(false);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    const loadReceipt = async () => {
      setReceiptLoading(true);
      setReceiptError("");
      setReceiptUrl(null);
      setReceiptType("");

      try {
        const response = await fetch(
          `/api/admin/payment-receipt/${receiptEnrollmentId}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          let errorMessage = "Failed to load payment receipt.";

          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch {
            // Keep fallback message.
          }

          throw new Error(errorMessage);
        }

        const blob = await response.blob();

        if (controller.signal.aborted) return;

        const mimeType = blob.type.split(";")[0].toLowerCase();

        if (
          ![
            "image/jpeg",
            "image/png",
            "application/pdf",
          ].includes(mimeType)
        ) {
          throw new Error(
            "Unsupported receipt format. Only JPG, PNG and PDF are allowed."
          );
        }

        objectUrl = URL.createObjectURL(blob);

        setReceiptType(mimeType);
        setReceiptUrl(objectUrl);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Receipt loading error:", error);

        setReceiptError(
          error instanceof Error
            ? error.message
            : "Unable to display payment receipt."
        );
      } finally {
        if (!controller.signal.aborted) {
          setReceiptLoading(false);
        }
      }
    };

    void loadReceipt();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [receiptEnrollmentId]);

  const handleViewReceipt = (enrollmentId: number) => {
    setReceiptEnrollmentId(enrollmentId);
  };

  const closeReceipt = () => {
    setReceiptEnrollmentId(null);
  };

  // ==========================================
  // EXISTING BATCH ASSIGNMENTS
  // ==========================================

  const fetchExistingBatchAssignments = async (
    courseId: number
  ) => {
    try {
      const response = await fetch(
        `/api/admin/course-batches/${courseId}`
      );

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error("Failed to load existing batches.");
      }

      const assignedIds: number[] = [];

      data.forEach((batch: {
        assigned_instructor_ids?: string;
        instructor_id?: number;
      }) => {
        if (batch.assigned_instructor_ids) {
          batch.assigned_instructor_ids
            .split(",")
            .forEach((idStr) => {
              if (idStr) assignedIds.push(Number(idStr));
            });
        }

        if (batch.instructor_id) {
          assignedIds.push(Number(batch.instructor_id));
        }
      });

      setExistingAssignedInstructorIds(
        [...new Set(assignedIds)]
      );
    } catch (error) {
      console.error(
        "Error fetching existing batch assignments:",
        error
      );
    }
  };

  // ==========================================
  // COURSE THUMBNAIL
  // ==========================================

  const handleThumbnailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setNewCourse((previous) => ({
        ...previous,
        thumbnail: reader.result as string,
      }));
    };

    reader.readAsDataURL(file);
  };

  // ==========================================
  // CREATE COURSE
  // ==========================================

  const handleAdminCreateCourse = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "/api/admin/courses",
        {
          method: "POST",
          body: JSON.stringify(newCourse),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);

        setShowCreateModal(false);
        setNewCourse({ ...initialCourse });

        await fetchData();
      } else {
        alert(data.message || "Failed to create course.");
      }
    } catch (error) {
      console.error("Create course error:", error);
      alert("Unable to create course.");
    }
  };

  // ==========================================
  // EDIT COURSE
  // ==========================================

  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    setEditFee(course.fee || 0);
    setEditStatus(course.status || "Published");
    setEditLevel(course.level || "Beginner");
    setShowEditModal(true);
  };

  const handleUpdateCourse = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!editingCourse) return;

    try {
      const response = await fetch(
        `/api/admin/update-course/${editingCourse.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            fee: Number(editFee),
            status: editStatus,
            level: editLevel,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        setShowEditModal(false);
        setEditingCourse(null);
        await fetchData();
      } else {
        alert(data.message || "Failed to update course.");
      }
    } catch (error) {
      console.error("Update course error:", error);
      alert("Unable to update course.");
    }
  };

  // ==========================================
  // APPROVE / REJECT PROPOSED COURSE
  // ==========================================

  const handleApproveCourse = async (
    courseId: number,
    status: string
  ) => {
    try {
      const feeToSet = approvalFees[courseId] || 0;

      const response = await fetch(
        `/api/admin/course-status/${courseId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
            fee: feeToSet,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        await fetchData();
      } else {
        alert(data.message || "Course update failed.");
      }
    } catch (error) {
      console.error("Course approval error:", error);
      alert("Unable to update course proposal.");
    }
  };

  // ==========================================
  // VERIFY / REJECT STUDENT PAYMENT
  // ==========================================

  const handleVerifyEnrollment = async (
    enrollmentId: number,
    status: "Active" | "Rejected"
  ) => {
    let rejectionReason = "";

    if (status === "Active") {
      if (
        !window.confirm(
          "Have you checked the payment receipt and transaction details?"
        )
      ) {
        return;
      }
    } else {
      const reason = window.prompt(
        "Enter the reason for rejecting this payment:"
      );

      if (reason === null) return;

      rejectionReason = reason.trim();

      if (!rejectionReason) {
        alert("Rejection reason is required.");
        return;
      }
    }

    try {
      const response = await fetch(
        `/api/admin/verify-enrollment/${enrollmentId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
            rejection_reason: rejectionReason,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Enrollment updated.");
        closeReceipt();
        await fetchData();
      } else {
        alert(data.message || "Could not update enrollment.");
      }
    } catch (error) {
      console.error("Enrollment verification error:", error);
      alert("Server error while verifying enrollment.");
    }
  };

  // ==========================================
  // BATCH INSTRUCTORS
  // ==========================================

  const handleInstructorCheckboxChange = (id: number) => {
    setBatchForm((previous) => {
      const current = previous.instructor_ids;

      return {
        ...previous,
        instructor_ids: current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      };
    });
  };

  // ==========================================
  // CREATE BATCH
  // ==========================================

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourseId) return;

    try {
      const response = await fetch(
        "/api/admin/course-batches",
        {
          method: "POST",
          body: JSON.stringify({
            course_id: selectedCourseId,
            ...batchForm,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);

        setShowBatchModal(false);
        setSelectedCourseId(null);
        setBatchForm({ ...initialBatch });

        await fetchData();
      } else {
        alert(data.message || "Failed to create batch.");
      }
    } catch (error) {
      console.error("Create batch error:", error);
      alert("Unable to create batch.");
    }
  };

  // ==========================================
  // DELETE COURSE
  // ==========================================

  const handleDeleteCourse = async (courseId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this course and its related batches and enrollments?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/admin/courses/${courseId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        await fetchData();
      } else {
        alert(data.message || "Failed to delete course.");
      }
    } catch (error) {
      console.error("Delete course error:", error);
      alert("Unable to delete course.");
    }
  };

  // ==========================================
  // VIEW ENROLLED STUDENTS
  // ==========================================

  const handleViewStudents = async (course: Course) => {
    setSelectedStudentsCourse(course);
    setShowStudentsModal(true);
    setLoadingStudents(true);
    setCourseStudents([]);

    try {
      const response = await fetch(
        `/api/admin/course-students/${course.id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch students."
        );
      }

      setCourseStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading enrolled students:", error);
      alert("Unable to load enrolled students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  // ==========================================
  // PAGE UI
  // ==========================================

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      {/* HEADER */}
      <header className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/admin-dashboard"
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="text-2xl font-bold text-slate-800">
            Admin Course & Batch Management
          </h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-medium shadow"
        >
          <Plus size={18} />
          Create New Course
        </button>
      </header>

      {pageError && (
        <div
          role="alert"
          className="mb-5 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700"
        >
          {pageError}
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${
            activeTab === "catalog"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-700 border"
          }`}
        >
          All Courses ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${
            activeTab === "proposals"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-700 border"
          }`}
        >
          Instructor Course Proposals ({pendingCourses.length})
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${
            activeTab === "payments"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-700 border"
          }`}
        >
          Payment Verification Queue ({pendingEnrollments.length})
        </button>

        <button
          onClick={() => setActiveTab("payment-settings")}
          className={`px-5 py-2.5 rounded-xl font-semibold transition ${
            activeTab === "payment-settings"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-700 border"
          }`}
        >
          Payment Settings
        </button>
      </div>

      {/* ==========================================
          CATALOG TAB
          ========================================== */}

      {activeTab === "catalog" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Published & Draft Courses
          </h3>

          <div className="overflow-x-auto">
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
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b hover:bg-slate-50 text-sm"
                  >
                    <td className="p-3">
                      <div className="w-14 h-10 rounded bg-slate-200 overflow-hidden flex items-center justify-center">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            No Img
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        className="font-medium text-blue-600 cursor-pointer hover:underline text-left"
                        onClick={() => {
                          setSelectedCourseDetail(course);
                          setShowDetailModal(true);
                        }}
                      >
                        {course.title}
                      </button>

                      <p className="text-xs text-slate-400 mt-0.5">
                        {course.proposed_by
                          ? `Created by Instructor: ${course.proposer_name}`
                          : "Created by: Admin"}
                      </p>

                      <p className="text-xs text-purple-600 font-medium mt-1">
                        Assigned To:{" "}
                        {course.assigned_instructors || "Not Assigned"}
                      </p>
                    </td>

                    <td className="p-3">
                      {course.category}
                    </td>

                    <td className="p-3 font-bold text-green-600">
                      ${course.fee || 0}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {course.status}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCourseDetail(course);
                            setShowDetailModal(true);
                          }}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(course)}
                          className="bg-amber-50 text-amber-600 hover:bg-amber-100 p-2 rounded-lg"
                          title="Edit Fee & Status"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setExistingAssignedInstructorIds([]);
                            void fetchExistingBatchAssignments(course.id);
                            setShowBatchModal(true);
                          }}
                          className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Create Batch
                        </button>

                        <button
                          type="button"
                          onClick={() => handleViewStudents(course)}
                          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg text-xs font-medium"
                        >
                          View Students
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course.id)}
                          className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg"
                          title="Delete Course"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {courses.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-slate-500"
                    >
                      No courses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          INSTRUCTOR PROPOSALS
          ========================================== */}

      {activeTab === "proposals" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Pending Instructor Course Proposals
          </h3>

          {pendingCourses.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">
              No pending course proposals.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingCourses.map((course) => (
                <div
                  key={course.id}
                  className="border p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-16 rounded bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          No Img
                        </span>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="font-bold text-blue-600 hover:underline"
                        onClick={() => {
                          setSelectedCourseDetail(course);
                          setShowDetailModal(true);
                        }}
                      >
                        {course.title}
                      </button>

                      <p className="text-xs text-slate-500 mt-1">
                        Created by Instructor:{" "}
                        <span className="font-semibold text-purple-600">
                          {course.proposer_name}
                        </span>{" "}
                        | Category: {course.category}
                      </p>

                      <p className="text-sm text-slate-600 mt-2">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Set Approved Fee ($)
                      </label>

                      <input
                        type="number"
                        value={
                          approvalFees[course.id] !== undefined
                            ? approvalFees[course.id]
                            : course.fee
                        }
                        onChange={(e) =>
                          setApprovalFees((previous) => ({
                            ...previous,
                            [course.id]: Number(e.target.value),
                          }))
                        }
                        className="w-24 border p-1.5 rounded-lg text-sm bg-white"
                        min="0"
                      />
                    </div>

                    <button
                      onClick={() =>
                        handleApproveCourse(course.id, "Published")
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shrink-0 mt-5"
                    >
                      <CheckCircle size={16} />
                      Approve & Publish
                    </button>

                    <button
                      onClick={() =>
                        handleApproveCourse(course.id, "Rejected")
                      }
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shrink-0 mt-5"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          PAYMENT VERIFICATION QUEUE
          ========================================== */}

      {activeTab === "payments" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Student Batch Enrollments Awaiting Payment Verification
          </h3>

          {pendingEnrollments.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">
              No pending payment verifications.
            </p>
          ) : (
            <div className="overflow-x-auto">
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
                  {pendingEnrollments.map((enrollment) => (
                    <tr
                      key={enrollment.id}
                      className="border-b text-sm"
                    >
                      <td className="p-3 font-medium">
                        {enrollment.student_name}
                        <p className="text-xs text-slate-400">
                          {enrollment.student_email}
                        </p>
                      </td>

                      <td className="p-3">
                        {enrollment.course_title}
                        <p className="text-xs text-purple-600">
                          {enrollment.timing_days} (
                          {enrollment.start_time})
                        </p>
                      </td>

                      <td className="p-3">
                        {enrollment.instructor_name}
                      </td>

                      <td className="p-3 text-xs space-y-1">
                        <p>
                          <strong>Method:</strong>{" "}
                          {enrollment.payment_method || "Not recorded"}
                        </p>

                        <p>
                          <strong>Transaction ID:</strong>{" "}
                          {enrollment.transaction_id || "Not recorded"}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            handleViewReceipt(enrollment.id)
                          }
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                        >
                          <Eye size={14} />
                          View Receipt
                        </button>
                      </td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleVerifyEnrollment(
                                enrollment.id,
                                "Active"
                              )
                            }
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700"
                          >
                            Verify & Activate
                          </button>

                          <button
                            onClick={() =>
                              handleVerifyEnrollment(
                                enrollment.id,
                                "Rejected"
                              )
                            }
                            className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          PAYMENT SETTINGS
          ========================================== */}

      {activeTab === "payment-settings" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-lg text-slate-800">
              Payment Account Settings
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              These active account details will appear in the Student
              Enrollment payment form.
            </p>
          </div>

          {paymentMethods.map((method) => {
            const setting = getPaymentSetting(method);

            return (
              <div
                key={method}
                className="bg-white rounded-xl p-6 shadow-sm border space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg text-blue-700">
                    {method}
                  </h4>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={setting.is_active}
                      onChange={(e) =>
                        updatePaymentSetting(method, {
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Active
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-sm font-medium">
                    Account Title

                    <input
                      value={setting.account_title}
                      onChange={(e) =>
                        updatePaymentSetting(method, {
                          account_title: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border rounded-lg p-2.5"
                      placeholder="Account holder name"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Account Number

                    <input
                      value={setting.account_number}
                      onChange={(e) =>
                        updatePaymentSetting(method, {
                          account_number: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border rounded-lg p-2.5"
                      placeholder="Account / wallet number"
                    />
                  </label>

                  {method === "Bank Transfer" && (
                    <>
                      <label className="text-sm font-medium">
                        Bank Name

                        <input
                          value={setting.bank_name}
                          onChange={(e) =>
                            updatePaymentSetting(method, {
                              bank_name: e.target.value,
                            })
                          }
                          className="mt-1 block w-full border rounded-lg p-2.5"
                          placeholder="Bank name"
                        />
                      </label>

                      <label className="text-sm font-medium">
                        IBAN

                        <input
                          value={setting.iban}
                          onChange={(e) =>
                            updatePaymentSetting(method, {
                              iban: e.target.value,
                            })
                          }
                          className="mt-1 block w-full border rounded-lg p-2.5"
                          placeholder="IBAN (optional)"
                        />
                      </label>
                    </>
                  )}
                </div>

                <label className="block text-sm font-medium">
                  Payment Instructions

                  <textarea
                    value={setting.instructions}
                    onChange={(e) =>
                      updatePaymentSetting(method, {
                        instructions: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border rounded-lg p-2.5"
                    rows={2}
                    placeholder="Optional instructions for students"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleSavePaymentSetting(method)}
                  disabled={savingMethod !== null}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingMethod === method
                    ? "Saving..."
                    : `Save ${method} Settings`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          SECURE PAYMENT RECEIPT MODAL
          ========================================== */}

      {receiptEnrollmentId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                Payment Receipt — Enrollment #{receiptEnrollmentId}
              </h3>

              <button
                type="button"
                onClick={closeReceipt}
                className="text-slate-500 hover:text-slate-800"
                aria-label="Close receipt preview"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-3">
              Secure receipt preview (images and PDFs).
            </p>

            {receiptLoading ? (
              <div className="h-[60vh] border rounded-lg flex items-center justify-center">
                <p className="text-slate-500 font-medium">
                  Loading payment receipt...
                </p>
              </div>
            ) : receiptError ? (
              <div
                role="alert"
                className="h-[40vh] border border-red-200 bg-red-50 rounded-lg flex items-center justify-center p-6"
              >
                <p className="text-red-700 text-center">
                  {receiptError}
                </p>
              </div>
            ) : receiptUrl ? (
              <div className="space-y-3">
                {receiptType.startsWith("image/") ? (
                  <div className="w-full h-[60vh] border rounded-lg bg-slate-50 flex items-center justify-center overflow-auto">
                    <img
                      src={receiptUrl}
                      alt="Student payment receipt"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    title="Payment Receipt"
                    src={receiptUrl}
                    className="w-full h-[60vh] border rounded-lg"
                  />
                )}

                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={receiptUrl}
                  className="inline-block text-blue-600 hover:underline"
                >
                  Open receipt in new tab
                </a>
              </div>
            ) : (
              <p className="text-slate-500 text-center p-8">
                Receipt unavailable.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          ENROLLED STUDENTS MODAL
          ========================================== */}

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

      {/* ==========================================
          EDIT COURSE MODAL
          ========================================== */}

      {showEditModal && editingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Manage Course: {editingCourse.title}
              </h3>

              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateCourse}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Course Fee ($)
                </label>

                <div className="relative">
                  <DollarSign
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="number"
                    value={editFee}
                    onChange={(e) =>
                      setEditFee(Number(e.target.value))
                    }
                    className="w-full border pl-10 pr-4 py-2.5 rounded-lg"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>

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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Level
                </label>

                <input
                  type="text"
                  value={editLevel}
                  onChange={(e) => setEditLevel(e.target.value)}
                  className="w-full border p-2.5 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          COURSE DETAILS MODAL
          ========================================== */}

      {showDetailModal && selectedCourseDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Course Details
              </h3>

              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="h-40 bg-slate-200 rounded-lg overflow-hidden">
                {selectedCourseDetail.thumbnail ? (
                  <img
                    src={selectedCourseDetail.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    No Thumbnail Available
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedCourseDetail.title}
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  {selectedCourseDetail.proposed_by
                    ? `Created by Instructor: ${selectedCourseDetail.proposer_name}`
                    : "Created by: Admin"}
                  {" | Category: "}
                  {selectedCourseDetail.category}
                  {" | Level: "}
                  {selectedCourseDetail.level}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-sm">
                <p>
                  <strong>Fee:</strong>{" "}
                  <span className="text-green-600 font-bold">
                    ${selectedCourseDetail.fee || 0}
                  </span>
                </p>

                <p>
                  <strong>Duration:</strong>{" "}
                  {selectedCourseDetail.duration || "4 Weeks"}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  {selectedCourseDetail.status}
                </p>

                <p>
                  <strong>Schedule:</strong>{" "}
                  {selectedCourseDetail.schedule || "Flexible"}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-700 text-sm mb-1">
                  Description
                </h4>

                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                  {selectedCourseDetail.description}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-700 text-sm mb-1">
                  Learning Objectives
                </h4>

                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                  {selectedCourseDetail.learning_objectives ||
                    "Not specified."}
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          CREATE COURSE MODAL
          ========================================== */}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Create New Course (Admin)
              </h3>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleAdminCreateCourse}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Course Title
                </label>

                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) =>
                    setNewCourse({
                      ...newCourse,
                      title: e.target.value,
                    })
                  }
                  placeholder="e.g. Advanced Quran Studies"
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>

                  <select
                    value={newCourse.category}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        category: e.target.value,
                      })
                    }
                    className="w-full border p-2.5 rounded-lg bg-white"
                  >
                    <option value="Quran">Quran</option>
                    <option value="Islamic Studies">Islamic Studies</option>
                    <option value="Academics">Academics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Level
                  </label>

                  <select
                    value={newCourse.level}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        level: e.target.value,
                      })
                    }
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fee ($)
                  </label>

                  <input
                    type="number"
                    value={newCourse.fee}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        fee: Number(e.target.value),
                      })
                    }
                    className="w-full border p-2.5 rounded-lg"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Duration
                  </label>

                  <input
                    type="text"
                    value={newCourse.duration}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        duration: e.target.value,
                      })
                    }
                    placeholder="e.g. 4 Weeks"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={newCourse.description}
                  onChange={(e) =>
                    setNewCourse({
                      ...newCourse,
                      description: e.target.value,
                    })
                  }
                  placeholder="Course overview..."
                  className="w-full border p-2.5 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Learning Objectives
                </label>

                <textarea
                  rows={2}
                  value={newCourse.learning_objectives}
                  onChange={(e) =>
                    setNewCourse({
                      ...newCourse,
                      learning_objectives: e.target.value,
                    })
                  }
                  placeholder="What students will learn..."
                  className="w-full border p-2.5 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Course Thumbnail
                </label>

                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
                    {newCourse.thumbnail ? (
                      <img
                        src={newCourse.thumbnail}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">
                        No Image
                      </span>
                    )}
                  </div>

                  <label className="cursor-pointer bg-slate-50 text-slate-700 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-slate-100 transition flex items-center gap-2">
                    <Upload size={16} />
                    Upload Thumbnail

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Publish Course Directly
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          BATCH CREATION MODAL
          ========================================== */}

      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Create Course Batch & Assign Instructors
            </h3>

            <form
              onSubmit={handleCreateBatch}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign Instructors (Select One or More)
                </label>

                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                  {instructors.map((instructor) => {
                    const instructorId = Number(
                      instructor.databaseId || instructor.id
                    );

                    const alreadyAssigned =
                      existingAssignedInstructorIds.includes(
                        instructorId
                      );

                    return (
                      <label
                        key={instructorId}
                        className={`flex items-center justify-between text-sm p-1.5 rounded ${
                          alreadyAssigned
                            ? "bg-amber-50 text-slate-500"
                            : "hover:bg-slate-100 text-slate-700 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={alreadyAssigned}
                            checked={
                              batchForm.instructor_ids.includes(
                                instructorId
                              ) || alreadyAssigned
                            }
                            onChange={() =>
                              handleInstructorCheckboxChange(
                                instructorId
                              )
                            }
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />

                          <span>
                            {instructor.name}
                            <span className="text-xs text-slate-400">
                              {" "}({instructor.department})
                            </span>
                          </span>
                        </div>

                        {alreadyAssigned && (
                          <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">
                            Already Assigned
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Timing Days
                  </label>

                  <input
                    type="text"
                    value={batchForm.timing_days}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        timing_days: e.target.value,
                      })
                    }
                    placeholder="e.g. Mon, Wed, Fri"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Time
                  </label>

                  <input
                    type="text"
                    value={batchForm.start_time}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        start_time: e.target.value,
                      })
                    }
                    placeholder="10:00 AM"
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Seat Capacity
                  </label>

                  <input
                    type="number"
                    value={batchForm.capacity}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        capacity: Number(e.target.value),
                      })
                    }
                    className="w-full border p-2.5 rounded-lg"
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        start_date: e.target.value,
                      })
                    }
                    className="w-full border p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Create Batch & Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Courses;
