import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  PlusCircle,
  Eye
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
};

type Batch = {
  id: number;
  instructor_id: number;
  instructor_name: string;
  timing_days: string;
  start_time: string;
  end_time: string;
  capacity: number;
  current_enrolled: number;
  start_date: string;
};
type PaymentSetting = {
  id: number;
  payment_method: string;
  account_title: string;
  account_number: string;
  bank_name: string | null;
  iban: string | null;
  instructions: string | null;
};

function StudentCourses() {
  const [activeTab, setActiveTab] = useState<"browse" | "enrolled">("browse");
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledBatches, setEnrolledBatches] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Batch Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<Course | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.id) {
          setStudentId(user.id);
          fetchEnrolledBatches(user.id);
        }
      } catch (e) { console.error(e); }
    }
    fetchPublishedCourses();
  }, []);

  const fetchPublishedCourses = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/student/courses");
    const data = await res.json();

    if (!res.ok) {
      console.error("Backend error:", data);
      alert(data.message || "Failed to load courses");
      return;
    }

    if (Array.isArray(data)) {
      setCourses(data);
    } else {
      console.error("Invalid courses response:", data);
    }
  } catch (err) {
    console.error("Error fetching published courses:", err);
  }
};

  const fetchEnrolledBatches = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/student/enrolled-batches/${id}`);
      const data = await res.json();
      if (res.ok) setEnrolledBatches(data);
    } catch (err) {
      console.error("Error fetching enrolled batches:", err);
    }
  };

  const handleOpenBatchModal = async (course: Course) => {
    setSelectedBatchId(null);
    setSelectedPaymentMethod("");
    setTransactionId("");
    setReceiptFile(null);
    setBatches([]);
    fetchPaymentSettings(); 
    setSelectedCourse(course);
    setShowBatchModal(true);
    try {
      const res = await fetch(`http://localhost:5000/api/course-batches/${course.id}`);
      const data = await res.json();
      if (res.ok) setBatches(data);
    } catch (err) {
      console.error("Error fetching batches:", err);
    }
  };

const handleEnrollSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!studentId || !selectedBatchId) {
    alert("Please select a batch.");
    return;
  }

  if (!selectedPaymentMethod || !transactionId.trim() || !receiptFile) {
    alert("Please complete all payment details.");
    return;
  }

  if (receiptFile.size > 5 * 1024 * 1024) {
    alert("Receipt must be smaller than 5 MB.");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

  if (!allowedTypes.includes(receiptFile.type)) {
    alert("Only JPG, PNG and PDF files are allowed.");
    return;
  }

  const formData = new FormData();

  formData.append("student_id", String(studentId));
  formData.append("course_batch_id", String(selectedBatchId));
  formData.append("payment_method", selectedPaymentMethod);
  formData.append("transaction_id", transactionId.trim());
  formData.append("receipt", receiptFile);

  setSubmitting(true);

  try {
    const res = await fetch(
      "http://localhost:5000/api/student/enroll-batch",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Payment submission failed.");
      return;
    }

    alert(data.message || "Payment submitted successfully!");

    setShowBatchModal(false);
    setSelectedBatchId(null);
    setSelectedPaymentMethod("");
    setTransactionId("");
    setReceiptFile(null);

    await fetchEnrolledBatches(studentId);

  } catch (err) {
    console.error("Payment submission error:", err);
    alert("Unable to connect to the backend server.");
  } finally {
    setSubmitting(false);
  }
};

  const fetchPaymentSettings = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/payment-settings");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to load payment settings");
    }

    setPaymentSettings(data);
  } catch (err) {
    console.error("Payment settings error:", err);
    setPaymentSettings([]);
  }
};

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <header className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/student-dashboard" className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold text-slate-800">Student Course Catalog & Batches</h1>
        </div>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab("browse")} className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "browse" ? "bg-blue-600 text-white" : "bg-white border"}`}>Browse Courses</button>
        <button onClick={() => setActiveTab("enrolled")} className={`px-5 py-2.5 rounded-xl font-semibold transition ${activeTab === "enrolled" ? "bg-blue-600 text-white" : "bg-white border"}`}>My Enrolled Batches ({enrolledBatches.length})</button>
      </div>

      {activeTab === "browse" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col justify-between border">
              <div className="p-5">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-semibold">{c.category}</span>
                <h3 className="text-lg font-bold text-slate-800 mt-2">{c.title}</h3>
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{c.description}</p>
                <p className="text-green-600 font-bold mt-4">Fee: ${c.fee}</p>
              </div>
                <div className="p-5 pt-0 space-y-2">
                 <button
                   onClick={() => {
                    setSelectedCourseDetail(c);
                    setShowDetailModal(true);
                   }}
                 className="w-full bg-slate-100 text-blue-600 border border-blue-200 py-2.5 rounded-lg font-medium hover:bg-blue-50 flex items-center justify-center gap-2">
                  <Eye size={18} /> View Course Details
                  </button>

  {(() => {
  const enrollment = enrolledBatches.find(
    (eb) => Number(eb.course_id) === Number(c.id)
  );

  if (enrollment?.status === "Active") {
    return (
      <button
        disabled
        className="w-full bg-green-100 text-green-700 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
      >
        <CheckCircle size={18} /> Enrolled ✓
      </button>
    );
  }

  if (enrollment?.status === "Pending Payment Verification") {
    return (
      <button
        disabled
        className="w-full bg-amber-100 text-amber-700 py-2.5 rounded-lg font-semibold"
      >
        Payment Pending
      </button>
    );
  }

  if (enrollment?.status === "Rejected") {
    return (
      <button
        disabled
        className="w-full bg-red-100 text-red-700 py-2.5 rounded-lg font-semibold"
      >
        Payment Rejected
      </button>
    );
  }

  return (
    <button
      onClick={() => handleOpenBatchModal(c)}
      className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
    >
      <PlusCircle size={18} /> View Batches & Enroll
    </button>
  );
})()}

</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {enrolledBatches.length === 0 ? (
            <p className="text-slate-500 text-center py-8 bg-white rounded-xl border">You are not enrolled in any batches yet.</p>
          ) : (
            enrolledBatches.map((eb) => (
              <div key={eb.id} className="bg-white p-5 rounded-xl shadow-sm border flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{eb.course_title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Instructor: <span className="font-semibold text-purple-600">{eb.instructor_name}</span> | Timing: {eb.timing_days} ({eb.start_time} - {eb.end_time})
                  </p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${eb.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Enrollment Status: {eb.status}
                  </span>
                </div>
                {eb.status === 'Active' && <span className="text-green-600 font-bold text-sm flex items-center gap-1"><CheckCircle size={16} /> Access Unlocked</span>}
              </div>
            ))
          )}
        </div>
      )}

      {/* BATCH SELECTION & PAYMENT MODAL */}
      {showBatchModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Select Batch for: {selectedCourse.title}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Choose your preferred instructor and timing slot, then follow the payment instructions.
            </p>

            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              <div className="space-y-3">
                {batches.length === 0 && (
                  <p className="text-sm text-slate-500">No batches available for this course.</p>
                )}
                {batches.map((b) => (
                  <label
                    key={b.id}
                    className={`block border p-4 rounded-xl cursor-pointer transition ${selectedBatchId === b.id ? "border-blue-600 bg-blue-50/50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <input
                          type="radio"
                          name="batch"
                          value={b.id}
                          checked={selectedBatchId === b.id}
                          onChange={() => setSelectedBatchId(b.id)}
                          required
                          className="mr-2"
                        />
                        <span className="font-bold text-slate-800">
                          Instructor: {b.instructor_name}
                        </span>
                      </div>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        Seats Left: {Math.max(0, b.capacity - b.current_enrolled)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 ml-5">
                      📅 {b.timing_days} | ⏰ {b.start_time} - {b.end_time} | Start: {new Date(b.start_date).toLocaleDateString()}
                    </p>
                  </label>
                ))}
              </div>

              {/* COURSE FEE */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <p className="text-sm text-slate-600">Course Fee</p>
                <p className="text-2xl font-bold text-blue-700">
                  ${Number(selectedCourse.fee || 0).toFixed(2)}
                </p>
              </div>

              {/* PAYMENT METHOD */}
              <div>
                <label className="block text-sm font-semibold mb-2">Select Payment Method</label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full border p-3 rounded-lg"
                  required
                >
                  <option value="">Choose Payment Method</option>
                  {paymentSettings.map((p) => (
                    <option key={p.id} value={p.payment_method}>
                      {p.payment_method}
                    </option>
                  ))}
                </select>
                {paymentSettings.length === 0 && (
                  <p className="text-red-600 text-xs mt-2">
                    No payment accounts configured. Please contact Admin.
                  </p>
                )}
              </div>

              {/* PAYMENT ACCOUNT DETAILS */}
              {paymentSettings
                .filter((p) => p.payment_method === selectedPaymentMethod)
                .map((p) => (
                  <div key={p.id} className="bg-slate-50 border p-4 rounded-xl space-y-2">
                    <h4 className="font-bold text-blue-700">
                      {p.payment_method} Payment Instructions
                    </h4>
                    {p.bank_name && <p><strong>Bank:</strong> {p.bank_name}</p>}
                    <p><strong>Account Title:</strong> {p.account_title}</p>
                    <p><strong>Account Number:</strong> {p.account_number}</p>
                    {p.iban && <p><strong>IBAN:</strong> {p.iban}</p>}
                    {p.instructions && (
                      <p className="text-sm text-slate-600">{p.instructions}</p>
                    )}
                    <p className="text-xs text-amber-700">
                      Transfer the course fee to this account, then submit your transaction ID and receipt.
                    </p>
                  </div>
                ))}

              {/* TRANSACTION ID */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Transaction ID / Reference Number
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter transaction reference"
                  className="w-full border p-3 rounded-lg"
                  required
                />
              </div>

              {/* RECEIPT UPLOAD */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Upload Payment Receipt
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full border p-3 rounded-lg"
                  required
                />
                {receiptFile && (
                  <p className="text-green-600 text-xs mt-2">
                    Selected: {receiptFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
  type="submit"
  disabled={submitting}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
>
  {submitting ? "Submitting..." : "Submit Enrollment & Payment"}
</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT COURSE DETAILS MODAL */}
{showDetailModal && selectedCourseDetail && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">

    <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-lg max-h-[85vh] overflow-y-auto">

      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h3 className="text-lg font-bold text-slate-800">
          Course Details
        </h3>

        <button
          onClick={() => setShowDetailModal(false)}
          className="text-slate-400 hover:text-slate-600 text-xl"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">

        {/* COURSE IMAGE */}
        <div className="h-40 bg-slate-200 rounded-lg overflow-hidden">
          {selectedCourseDetail.thumbnail ? (
            <img
              src={selectedCourseDetail.thumbnail}
              alt={selectedCourseDetail.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No Thumbnail Available
            </div>
          )}
        </div>

        {/* COURSE TITLE */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {selectedCourseDetail.title}
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Created by: {selectedCourseDetail.proposer_name || "Admin"}
            {" | "} Category: {selectedCourseDetail.category}
            {" | "} Level: {selectedCourseDetail.level}
          </p>
        </div>

        {/* COURSE INFORMATION */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-sm">

          <p>
            <strong>Fee:</strong>{" "}
            <span className="text-green-600 font-bold">
              ${Number(selectedCourseDetail.fee || 0).toFixed(2)}
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

        {/* DESCRIPTION */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-1">
            Description
          </h4>

          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg whitespace-pre-line">
            {selectedCourseDetail.description}
          </p>
        </div>

        {/* LEARNING OBJECTIVES */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-1">
            Learning Objectives
          </h4>

          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg whitespace-pre-line">
            {selectedCourseDetail.learning_objectives || "Not specified."}
          </p>
        </div>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 pt-3 border-t">

          <button
            onClick={() => setShowDetailModal(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium"
          >
            Close
          </button>

          <button
            onClick={() => {
              const course = selectedCourseDetail;
              setShowDetailModal(false);
              handleOpenBatchModal(course);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            View Batches & Enroll
          </button>

        </div>

      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default StudentCourses;