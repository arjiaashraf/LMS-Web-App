import { useState, useEffect } from "react";
import { Users, Upload, Plus } from "lucide-react";

interface InstructorCoursesProps {
  teacherId: number | null;
  teacherName: string;
}

function InstructorCourses({ teacherId }: InstructorCoursesProps) {
  const [assignedBatches, setAssignedBatches] = useState<any[]>([]);
  const [isProposing, setIsProposing] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterStudents, setRosterStudents] = useState<any[]>([]);
  const [selectedBatchTitle, setSelectedBatchTitle] = useState("");

  // Course Details View Modal State for Instructor
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<any>(null);

  const [proposal, setProposal] = useState({
    title: "",
    description: "",
    learning_objectives: "",
    schedule: "",
    duration: "4 Weeks",
    category: "Quran",
    level: "Beginner",
    price: 0,
    thumbnail: ""
  });

  useEffect(() => {
    if (teacherId) {
      fetchInstructorBatches(teacherId);
    }
  }, [teacherId]);

  const fetchInstructorBatches = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/instructor/batches/${id}`);
      const data = await res.json();
      if (res.ok) setAssignedBatches(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProposal({ ...proposal, thumbnail: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleViewRoster = async (batchId: number, title: string) => {
    setSelectedBatchTitle(title);
    setShowRosterModal(true);
    try {
      const res = await fetch(`http://localhost:5000/api/instructor/batch-students/${batchId}`);
      const data = await res.json();
      if (res.ok) setRosterStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProposeCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;

    try {
      const res = await fetch("http://localhost:5000/api/instructor/propose-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proposal, instructor_id: teacherId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setIsProposing(false);
        setProposal({
          title: "",
          description: "",
          learning_objectives: "",
          schedule: "",
          duration: "4 Weeks",
          category: "Quran",
          level: "Beginner",
          price: 0,
          thumbnail: ""
        });
      } else {
        alert(data.message || "Failed to propose course.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {!isProposing ? (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Your Assigned Course Batches & Rosters</h2>
            <button
              onClick={() => setIsProposing(true)}
              className="bg-purple-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-purple-700 font-medium shadow"
            >
              <Plus size={18} /> Propose New Course
            </button>
          </div>

          {assignedBatches.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border text-slate-500">
              No course batches assigned by Admin yet. Click "Propose New Course" to submit a course proposal to Admin!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedBatches.map((b) => (
                <div key={b.id} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col justify-between">
                  <div className="h-36 bg-slate-200 overflow-hidden">
                    {b.thumbnail ? (
                      <img src={b.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-slate-400">No Thumbnail</div>
                    )}
                  </div>
                  <div className="p-5">
                    {/* Clickable Course Title to open Details Modal */}
                    <h3 
                      className="text-lg font-bold text-blue-600 cursor-pointer hover:underline mt-1"
                      onClick={() => {
                        setSelectedCourseDetail(b);
                        setShowDetailModal(true);
                      }}
                    >
                      {b.course_title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">📅 {b.timing_days} | ⏰ {b.start_time} - {b.end_time}</p>
                    
                    {/* Display Assigned Instructors */}
                    <p className="text-xs text-purple-600 font-medium mt-2">
                      Instructors: {b.assigned_instructors || "Not Assigned"}
                    </p>
                  </div>
                  <div className="px-5 pb-5 pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Enrolled: {b.active_students_count} Students</span>
                    <button
                      onClick={() => handleViewRoster(b.id, b.course_title)}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Users size={14} /> View Roster
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6 border max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6 border-b pb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Propose New Course</h2>
              <p className="text-xs text-slate-500">Submit syllabus details for Admin review & approval</p>
            </div>
            <button onClick={() => setIsProposing(false)} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
              Cancel
            </button>
          </div>

          <form onSubmit={handleProposeCourse} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
              <input
                type="text"
                value={proposal.title}
                onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
                placeholder="e.g. Quran Tajweed Mastery"
                className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={proposal.category}
                  onChange={(e) => setProposal({ ...proposal, category: e.target.value })}
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
                  value={proposal.level}
                  onChange={(e) => setProposal({ ...proposal, level: e.target.value })}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Proposed Fee ($)</label>
                <input
                  type="number"
                  value={proposal.price}
                  onChange={(e) => setProposal({ ...proposal, price: Number(e.target.value) })}
                  className="w-full border p-2.5 rounded-lg"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                <input
                  type="text"
                  value={proposal.duration}
                  onChange={(e) => setProposal({ ...proposal, duration: e.target.value })}
                  placeholder="e.g. 6 Weeks"
                  className="w-full border p-2.5 rounded-lg"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Suggested Class Schedule</label>
              <input
                type="text"
                value={proposal.schedule}
                onChange={(e) => setProposal({ ...proposal, schedule: e.target.value })}
                placeholder="e.g. Tue & Thu, 5:00 PM - 6:30 PM"
                className="w-full border p-2.5 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={proposal.description}
                onChange={(e) => setProposal({ ...proposal, description: e.target.value })}
                placeholder="Course overview..."
                className="w-full border p-2.5 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Learning Objectives</label>
              <textarea
                rows={2}
                value={proposal.learning_objectives}
                onChange={(e) => setProposal({ ...proposal, learning_objectives: e.target.value })}
                placeholder="What students will achieve..."
                className="w-full border p-2.5 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Course Thumbnail</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
                  {proposal.thumbnail ? (
                    <img src={proposal.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No Image</span>
                  )}
                </div>
                <label className="cursor-pointer bg-purple-50 text-purple-700 px-4 py-2 rounded-lg border border-purple-200 text-sm font-medium hover:bg-purple-100 transition flex items-center gap-2">
                  <Upload size={16} /> Upload Thumbnail
                  <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setIsProposing(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 shadow">
                Submit Proposal for Admin Approval
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COURSE DETAILS VIEW MODAL FOR INSTRUCTOR */}
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
          <h2 className="text-xl font-bold text-slate-800">{selectedCourseDetail.course_title}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Level: {selectedCourseDetail.level || "Advanced"} | Duration: {selectedCourseDetail.duration || "12 Weeks"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-sm">
          <p><strong>Schedule:</strong> {selectedCourseDetail.schedule || "Flexible"}</p>
          <p><strong>Timing:</strong> {selectedCourseDetail.timing_days} ({selectedCourseDetail.start_time})</p>
          <p><strong>Active Students:</strong> {selectedCourseDetail.active_students_count}</p>
          <p><strong>Assigned Instructors:</strong> {selectedCourseDetail.assigned_instructors || "N/A"}</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-1">Description</h4>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
            {selectedCourseDetail.description || "No description provided."}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-1">Learning Objectives</h4>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
            {selectedCourseDetail.learning_objectives || "Not specified."}
          </p>
        </div>
        <div className="flex justify-end pt-3 border-t">
          <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* ROSTER MODAL */}
      {showRosterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Student Roster: {selectedBatchTitle}</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mt-4">
              {rosterStudents.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">No active students in this batch yet.</p>
              ) : (
                rosterStudents.map((s) => (
                  <div key={s.id} className="border p-3 rounded-lg flex justify-between items-center bg-slate-50">
                    <div>
                      <p className="font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.email} | Phone: {s.phone || "N/A"}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">Active</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowRosterModal(false)} className="mt-5 w-full bg-slate-200 hover:bg-slate-300 py-2 rounded-lg text-slate-700 font-medium">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstructorCourses;