import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Calendar,
  Clock,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  BookOpen,
  User,
} from "lucide-react";

import { apiFetch as fetch } from "../services/api";

type ClassSchedule = {
  id: number;
  course_id: number;
  course_title: string;
  instructor_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  meeting_link: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
};

function StudentOnlineClasses() {
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (!user || !user.role || user.role.toLowerCase() !== "student" || !user.id) {
        navigate("/login");
        return;
      }
      fetchStudentClasses(user.id);
    } catch (err) {
      console.error("Session parse error:", err);
      navigate("/login");
    }
  }, [navigate]);

  const fetchStudentClasses = async (id: number) => {
    try {
      const res = await fetch(`/api/student/class-schedules/${id}`);
      const data = await res.json();
      if (res.ok) {
        setClasses(data);
      }
    } catch (err) {
      console.error("Error fetching student class schedules:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex-1">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Online Classes & Schedule</h2>
          <p className="text-sm text-slate-500">View upcoming live sessions and join meetings for your enrolled courses</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
              <Video size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No online classes scheduled for your enrolled courses yet.</p>
            </div>
          ) : (
            classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <BookOpen size={13} /> {cls.course_title}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      cls.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      cls.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      cls.status === 'Rescheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {cls.status === 'Completed' && <CheckCircle size={12} />}
                      {cls.status === 'Cancelled' && <XCircle size={12} />}
                      {cls.status === 'Scheduled' && <Clock size={12} />}
                      {cls.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 mt-3">
                    <p className="flex items-center gap-2">
                      <User size={15} className="text-slate-400" /> Instructor: <strong>{cls.instructor_name}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" /> Date: <strong>{cls.session_date.split('T')[0]}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" /> Time: {cls.start_time} - {cls.end_time} ({cls.time_zone})
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t">
                <a
                  href={cls.status === 'Completed' || cls.status === 'Cancelled' ? '#' : cls.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (cls.status === 'Completed' || cls.status === 'Cancelled') {
                      e.preventDefault();
                    }
                  }}
                  className={`w-full text-center py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition ${
                    cls.status === 'Cancelled' || cls.status === 'Completed'
                      ? 'bg-slate-100 text-slate-400 pointer-events-none cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                  }`}
                >
                  <LinkIcon size={16} /> 
                  {cls.status === 'Cancelled' ? 'Class Cancelled' : 
                   cls.status === 'Completed' ? 'Class Completed' : 'Join Live Class'}
                </a>
              </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentOnlineClasses;