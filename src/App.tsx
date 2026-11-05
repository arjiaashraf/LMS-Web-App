
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Admin pages
import AdminDashboard from "./dashboard/AdminDashboard";
import Students from "./pages/Students";
import Courses from "./pages/Courses";
import Teachers from "./pages/Teachers";
import Assignments from "./pages/Assignments";
import Attendance from "./pages/Attendance";
import Exams from "./pages/Exams";
import Settings from "./pages/Settings";
import OnlineClasses from "./pages/OnlineClass";
import Reports from "./pages/Reports";
import Register from "./pages/Register";

// Instructor pages
import InstructorDashboard from "./pages/InstructorDashboard";
import InstructorAttendance from "./pages/InstructorAttendance";
import InstructorExamReview from "./pages/InstructorExamReview";
import InstructorExams from "./pages/InstructorExams";
import InstructorExamExtensions from "./pages/InstructorExamExtensions";
// Login
import Login from "./pages/Login";

// Student pages
import StudentDashboard from "./pages/StudentDashboard";
import StudentCourses from "./pages/StudentCourses";
import StudentAssignments from "./pages/StudentAssignments";
import StudentAttendance from "./pages/StudentAttendance";
import StudentResults from "./pages/StudentResults";
import StudentAnnouncements from "./pages/StudentAnnouncements";
import StudentProfile from "./pages/StudentProfile";
import StudentSettings from "./pages/StudentSettings";
import StudentOnlineClasses from "./pages/StudentOnlineClasses";
import StudentExamAttempt from "./pages/StudentExamAttempt";

// Temporary page for testing exam navigation.
// Replace this with StudentExamAttempt.tsx later.


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC / AUTH */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ADMIN */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/announcements" element={<OnlineClasses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />

        {/* INSTRUCTOR */}
        <Route
          path="/instructor-dashboard"
          element={<InstructorDashboard />}
        />
        <Route
          path="/teacher-attendance"
          element={<InstructorAttendance />}
        />
        <Route
  path="/instructor/exams/:examId/submissions"
  element={<InstructorExamReview />}
/>

<Route
  path="/instructor/exams"
  element={<InstructorExams />}
/>

<Route
  path="/instructor/exams/:examId/extensions"
  element={<InstructorExamExtensions />}
/>
        {/* STUDENT */}
        <Route
          path="/student-dashboard"
          element={<StudentDashboard />}
        />
        <Route
          path="/student-courses"
          element={<StudentCourses />}
        />
        <Route
          path="/student-assignments"
          element={<StudentAssignments />}
        />
        <Route
          path="/student-classes"
          element={<StudentOnlineClasses />}
        />
        <Route
          path="/student-attendance"
          element={<StudentAttendance />}
        />
        <Route
          path="/student-results"
          element={<StudentResults />}
        />
        <Route
          path="/student-announcements"
          element={<StudentAnnouncements />}
        />
        <Route
          path="/student-profile"
          element={<StudentProfile />}
        />
        <Route
          path="/student-settings"
          element={<StudentSettings />}
        />

        {/* STUDENT ONLINE EXAM ATTEMPT */}
        <Route
          path="/student/exam-attempt/:attemptId"
          element={<StudentExamAttempt />}
        />

        {/* FALLBACK */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
