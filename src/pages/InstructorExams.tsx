
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Calendar,
  Award,
  ArrowLeft,
  X,
  BookOpen,
  Save,
  CheckCircle,
  Clock,
  ListChecks,
  AlertCircle,
  Settings,
  Send,
} from "lucide-react";

const API_BASE = "http://localhost:5000";

// MySQL DATE must be provided by the API as YYYY-MM-DD (not an ISO timestamp).
// Avoid converting date-only values through new Date(), which can shift days.
const formatExamDate = (value: string | null | undefined): string => {
  if (!value) return "N/A";
  const dateOnly = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : "N/A";
};

// =============== TYPES ===============

type Course = {
  id: number;
  title: string;
};

type Exam = {
  id: number;
  course_id: number;
  course_batch_id?: number;
  course_title: string;
  title: string;
  exam_type: string;
  total_marks: number;
  exam_date: string;
  exam_status: "Draft" | "Published";
  exam_mode: "Online" | "Offline";
  start_time: string | null;
  duration_minutes: number | null;
  attempt_limit: number;
  result_published?: number;
};

type StudentResult = {
  student_id: number;
  student_name: string;
  student_email: string;
  result_id: number | null;
  marks_obtained: number | string | null;
  grade: string | null;
  feedback: string | null;
  status: string;
};

type AssignmentMark = {
  assignment_id: number;
  assignment_title: string;
  due_date: string;
  total_marks: number;
  student_id: number;
  student_name: string;
  student_email: string;
  submission_id: number | null;
  marks_obtained: number | string | null;
  feedback: string | null;
  status: string;
};

type QuestionType = "MCQ" | "TrueFalse" | "ShortAnswer";

type ExamQuestion = {
  id: number;
  exam_id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[] | string | null;
  correct_answer: string | null;
  marks: number;
};

interface InstructorExamsProps {
  onBack?: () => void;
}

// Convert stored JSON options to array
const parseQuestionOptions = (
  options: ExamQuestion["options"]
): string[] => {
  if (Array.isArray(options)) return options;

  if (typeof options === "string") {
    try {
      const parsed: unknown = JSON.parse(options);
      return Array.isArray(parsed)
        ? parsed.map(String)
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

// =============== COMPONENT ===============

function InstructorExams({ onBack }: InstructorExamsProps) {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );
  const teacherId = Number(user.id);

  // ========== EXAM STATES ==========

  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [studentResults, setStudentResults] =
    useState<StudentResult[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showMarksSelector, setShowMarksSelector] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingFeedbackId, setSavingFeedbackId] = useState<number | null>(null);
  const [publishingResults, setPublishingResults] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<Record<number, string>>({});
  const [creatingExam, setCreatingExam] = useState(false);
  const [examError, setExamError] = useState("");

  // Create Exam Form
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState("Midterm");
  const [totalMarks, setTotalMarks] = useState("");
  const [examDate, setExamDate] = useState("");

  // ========== QUESTION STATES ==========

  const [questionExam, setQuestionExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [questionSuccess, setQuestionSuccess] = useState("");

  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] =
    useState<QuestionType>("MCQ");
  const [questionOptions, setQuestionOptions] = useState([
    "", "", "", ""
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questionMarks, setQuestionMarks] = useState("1");

  // ========== EXAM SETTINGS STATES ==========

  // Published or draft online exams can be rescheduled only if nobody attempted them.
  const [rescheduleExam, setRescheduleExam] = useState<Exam | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState("60");
  const [rescheduleError, setRescheduleError] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  const [settingsExam, setSettingsExam] = useState<Exam | null>(null);

  const [examMode, setExamMode] =
    useState<"Online" | "Offline">("Online");

  const [durationMinutes, setDurationMinutes] = useState("60");
  const [startTime, setStartTime] = useState("09:00");
  const [attemptLimit, setAttemptLimit] = useState("1");

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  const [publishingExamId, setPublishingExamId] =
    useState<number | null>(null);

  const [assignmentMarks, setAssignmentMarks] =
  useState<AssignmentMark[]>([]);

const [loadingAssignmentMarks, setLoadingAssignmentMarks] =
  useState(false);

const [assignmentMarksError, setAssignmentMarksError] =
  useState("");

  // ========== AUTHENTICATION ==========

  useEffect(() => {
    if (user.role !== "instructor" || !teacherId) {
      navigate("/login");
      return;
    }

    fetchInstructorCourses();
    fetchInstructorExams();
  }, [navigate, teacherId]);

  // ========== FETCH COURSES ==========

  const fetchInstructorCourses = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/courses/${teacherId}`
      );

      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        setCourses(data);
      }
    } catch (error) {
      console.error("Fetch courses error:", error);
    }
  };

  // ========== FETCH EXAMS ==========

  const fetchInstructorExams = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams/${teacherId}`
      );

      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        setExams(data);
      }
    } catch (error) {
      console.error("Fetch exams error:", error);
    }
  };

  // ========== CREATE EXAM ==========

  const handleCreateExam = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (creatingExam) return;

    setCreatingExam(true);
    setExamError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_id: Number(courseId),
            teacher_id: teacherId,
            title: title.trim(),
            exam_type: examType,
            total_marks: Number(totalMarks),
            exam_date: examDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create exam."
        );
      }

      setShowModal(false);
      setCourseId("");
      setTitle("");
      setExamType("Midterm");
      setTotalMarks("");
      setExamDate("");

      await fetchInstructorExams();
    } catch (error) {
      setExamError(
        error instanceof Error
          ? error.message
          : "Failed to create exam."
      );
    } finally {
      setCreatingExam(false);
    }
  };
  

  
const fetchAssignmentMarks = async (batchId?: number) => {
  if (!batchId) {
    setAssignmentMarks([]);
    return;
  }

  setLoadingAssignmentMarks(true);
  setAssignmentMarksError("");

  try {
    const response = await fetch(
      `${API_BASE}/api/teacher/batches/${batchId}/assignment-marks/${teacherId}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to load assignment marks."
      );
    }

    setAssignmentMarks(
      Array.isArray(data.assignments)
        ? data.assignments
        : []
    );
  } catch (error) {
    setAssignmentMarks([]);

    setAssignmentMarksError(
      error instanceof Error
        ? error.message
        : "Unable to load assignment marks."
    );
  } finally {
    setLoadingAssignmentMarks(false);
  }
};

  // ========== FETCH GRADING STUDENTS ==========
    const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    void fetchAssignmentMarks(exam.course_batch_id);
    setStudentResults([]);
    setLoadingResults(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exam-results/${exam.id}/${teacherId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load students."
        );
      }

      if (Array.isArray(data)) {
        setStudentResults(data);
        setSavedFeedback(Object.fromEntries(
          data.map((student: StudentResult) => [student.student_id, student.feedback || ""])
        ));
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load students."
      );
    } finally {
      setLoadingResults(false);
    }
  };

  // ========== UPDATE STUDENT RESULTS ==========

  const handleResultChange = (
    studentId: number,
    field: "marks_obtained" | "grade" | "feedback",
    value: string
  ) => {
    setStudentResults((prev) =>
      prev.map((student) =>
        student.student_id === studentId
          ? { ...student, [field]: value }
          : student
      )
    );
  };

  // ========== GRADE CALCULATION (adjust thresholds to your university policy) ==========

  const calculateGrade = (marks: number | string | null, total: number) => {
    if (marks === null || marks === "" || !Number.isFinite(Number(marks)) || total <= 0) return "—";
    const percentage = Number(marks) * 100 / total;
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
  };

  // ========== SAVE ONLINE FEEDBACK (marks remain unchanged) ==========

  const handleSaveFeedback = async (student: StudentResult) => {
    if (!selectedExam || selectedExam.exam_mode !== "Online" ||
        selectedExam.result_published === 1 || student.status !== "Graded" ||
        savingFeedbackId !== null) return;

    setSavingFeedbackId(student.student_id);
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exam-results/${selectedExam.id}/${student.student_id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher_id: teacherId, feedback: student.feedback || "" }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Feedback save failed.");
      setSavedFeedback(prev => ({ ...prev, [student.student_id]: student.feedback || "" }));
      alert("Feedback saved successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Feedback save failed.");
    } finally {
      setSavingFeedbackId(null);
    }
  };

  // ========== PUBLISH FINAL RESULTS ==========

  const handlePublishResults = async () => {
    if (!selectedExam || publishingResults || submitting || savingFeedbackId !== null ||
        selectedExam.result_published === 1) return;

    if (selectedExam.exam_mode === "Online" && studentResults.some(student =>
      student.status === "Graded" && (student.feedback || "") !== (savedFeedback[student.student_id] || "")
    )) {
      alert("Please save all changed feedback before publishing results.");
      return;
    }

    if (!window.confirm(`Publish all final results for "${selectedExam.title}"? Students will be able to view their marks.`)) return;
    setPublishingResults(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams/${selectedExam.id}/publish-results`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher_id: teacherId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to publish results.");
      const updatedExam = { ...selectedExam, result_published: 1 };
      setSelectedExam(updatedExam);
      await fetchInstructorExams();
      await handleSelectExam(updatedExam);
      alert("Results published! Students can now see them in My Results.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to publish results.");
    } finally {
      setPublishingResults(false);
    }
  };

  // ========== SAVE RESULTS ==========

  const handleSaveResults = async () => {
    if (!selectedExam || submitting) return;
    // Online examination scores come from submitted exam attempts.
    // Do not let this manual-entry workflow overwrite automatic grades.
    if (selectedExam.exam_mode !== "Offline") {
      alert("Online exam marks are saved automatically after answer review.");
      return;
    }

    const invalidMarks = studentResults.some((student) => {
      if (
        student.marks_obtained === null ||
        student.marks_obtained === ""
      ) {
        return false;
      }

      const marks = Number(student.marks_obtained);

      return (
        !Number.isFinite(marks) ||
        marks < 0 ||
        marks > selectedExam.total_marks
      );
    });

    if (invalidMarks) {
      alert(
        `Marks must be between 0 and ${selectedExam.total_marks}.`
      );
      return;
    }

    const payloadResults = studentResults.map((student) => ({
      student_id: student.student_id,
      marks_obtained:
        student.marks_obtained !== null &&
        student.marks_obtained !== ""
          ? Number(student.marks_obtained)
          : null,
      grade: student.marks_obtained === null || student.marks_obtained === ""
        ? "" : calculateGrade(student.marks_obtained, selectedExam.total_marks),
      feedback: student.feedback || "",
    }));

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exam-results`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exam_id: selectedExam.id,
            teacher_id: teacherId,
            results_data: payloadResults,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save results."
        );
      }

      alert("Exam results saved successfully!");
      await handleSelectExam(selectedExam);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save results."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ========== FETCH QUESTIONS ==========

  const fetchExamQuestions = async (examId: number) => {
    setLoadingQuestions(true);
    setQuestionError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exam-questions/${examId}/${teacherId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load questions."
        );
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid questions response.");
      }

      setQuestions(data);
    } catch (error) {
      setQuestionError(
        error instanceof Error
          ? error.message
          : "Failed to fetch questions."
      );
    } finally {
      setLoadingQuestions(false);
    }
  };

  // ========== OPEN QUESTION BUILDER ==========

  const openQuestionBuilder = (exam: Exam) => {
    setQuestionExam(exam);
    setQuestions([]);

    setQuestionText("");
    setQuestionType("MCQ");
    setQuestionOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setQuestionMarks("1");

    setQuestionError("");
    setQuestionSuccess("");

    fetchExamQuestions(exam.id);
  };

  const handleOptionChange = (
    index: number,
    value: string
  ) => {
    setQuestionOptions((prev) =>
      prev.map((option, i) =>
        i === index ? value : option
      )
    );
  };

  // ========== ADD QUESTION ==========

  const handleAddQuestion = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!questionExam || savingQuestion) return;

    if (questionExam.exam_status === "Published") {
      setQuestionError(
        "Cannot add questions to a published exam."
      );
      return;
    }

    setQuestionError("");
    setQuestionSuccess("");

    const marks = Number(questionMarks);

    if (!questionText.trim()) {
      setQuestionError("Please enter a question.");
      return;
    }

    if (!Number.isFinite(marks) || marks <= 0) {
      setQuestionError("Enter valid question marks.");
      return;
    }

    const usedMarks = questions.reduce(
      (total, question) =>
        total + Number(question.marks),
      0
    );

    if (
      usedMarks + marks >
      Number(questionExam.total_marks)
    ) {
      setQuestionError(
        "Question marks exceed the total exam marks."
      );
      return;
    }

    let answerToSave: string | null = null;

    if (questionType === "MCQ") {
      const cleanedOptions = questionOptions.map(
        (option) => option.trim()
      );

      if (cleanedOptions.some((option) => !option)) {
        setQuestionError("Fill all four MCQ options.");
        return;
      }

      if (new Set(cleanedOptions).size !== 4) {
        setQuestionError(
          "MCQ options must be different."
        );
        return;
      }

      if (!["0", "1", "2", "3"].includes(correctAnswer)) {
        setQuestionError(
          "Select the correct MCQ option."
        );
        return;
      }

      answerToSave = correctAnswer;
    }

    if (questionType === "TrueFalse") {
      if (
        correctAnswer !== "True" &&
        correctAnswer !== "False"
      ) {
        setQuestionError("Select True or False.");
        return;
      }

      answerToSave = correctAnswer;
    }

    if (questionType === "ShortAnswer") {
      answerToSave = correctAnswer.trim() || null;
    }

    setSavingQuestion(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exam-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exam_id: questionExam.id,
            teacher_id: teacherId,
            question_text: questionText.trim(),
            question_type: questionType,
            options:
              questionType === "MCQ"
                ? questionOptions.map((o) => o.trim())
                : null,
            correct_answer: answerToSave,
            marks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to add question."
        );
      }

      setQuestionText("");
      setQuestionOptions(["", "", "", ""]);
      setCorrectAnswer("");
      setQuestionMarks("1");

      await fetchExamQuestions(questionExam.id);

      setQuestionSuccess(
        "Question added successfully!"
      );
    } catch (error) {
      setQuestionError(
        error instanceof Error
          ? error.message
          : "Failed to save question."
      );
    } finally {
      setSavingQuestion(false);
    }
  };

  // ========== RESCHEDULE ONLINE EXAM ==========

  const openRescheduleExam = (exam: Exam) => {
    setRescheduleExam(exam);
    setRescheduleDate(formatExamDate(exam.exam_date));
    setRescheduleTime(exam.start_time?.slice(0, 5) || "09:00");
    setRescheduleDuration(String(exam.duration_minutes || 60));
    setRescheduleError("");
  };

  const handleRescheduleExam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rescheduleExam || savingReschedule) return;
    setSavingReschedule(true);
    setRescheduleError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams/${rescheduleExam.id}/reschedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacher_id: teacherId,
            exam_date: rescheduleDate,
            start_time: rescheduleTime,
            duration_minutes: Number(rescheduleDuration),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not reschedule the exam.");
      }
      setRescheduleExam(null);
      await fetchInstructorExams();
      alert("Exam rescheduled successfully. Students will see the new date after refresh.");
    } catch (error) {
      setRescheduleError(error instanceof Error ? error.message : "Reschedule failed.");
    } finally {
      setSavingReschedule(false);
    }
  };

  // ========== OPEN EXAM SETTINGS ==========

  const openExamSettings = (exam: Exam) => {
    setSettingsExam(exam);

    setExamMode(exam.exam_mode || "Online");
    setDurationMinutes(
      String(exam.duration_minutes || 60)
    );
    setStartTime(
      exam.start_time?.slice(0, 5) || "09:00"
    );
    setAttemptLimit(
      String(exam.attempt_limit || 1)
    );

    setSettingsError("");
  };

  // ========== SAVE EXAM SETTINGS ==========

  const handleSaveExamSettings = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!settingsExam || savingSettings) return;

    setSavingSettings(true);
    setSettingsError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams/${settingsExam.id}/settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            exam_mode: examMode,
            duration_minutes:
              examMode === "Online"
                ? Number(durationMinutes)
                : null,
            start_time:
              examMode === "Online"
                ? startTime
                : null,
            attempt_limit: Number(attemptLimit),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save settings."
        );
      }

      await fetchInstructorExams();

      setSettingsExam(null);
      alert("Exam settings saved successfully!");
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Failed to save exam settings."
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // ========== PUBLISH EXAM ==========

  const handlePublishExam = async (exam: Exam) => {
    if (publishingExamId !== null) return;

    const confirmed = window.confirm(
      `Publish "${exam.title}"?\n\n` +
      "Make sure all questions and exam settings are correct."
    );

    if (!confirmed) return;

    setPublishingExamId(exam.id);

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/exams/${exam.id}/publish`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacher_id: teacherId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to publish exam."
        );
      }

      await fetchInstructorExams();

      alert("Exam published successfully!");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to publish exam."
      );
    } finally {
      setPublishingExamId(null);
    }
  };

  const allocatedMarks = questions.reduce(
    (total, question) =>
      total + Number(question.marks),
    0
  );

  // =============== FRONTEND ===============

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      {/* ========== HEADER ========== */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedExam) {
                setSelectedExam(null);
              } else if (onBack) {
                onBack();
              } else {
                navigate("/instructor-dashboard");
              }
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {selectedExam
                ? `Grading: ${selectedExam.title}`
                : "Exams & Assessments"}
            </h1>

            <p className="text-sm text-slate-500">
              {selectedExam
                ? `Course: ${selectedExam.course_title}`
                : "Create and manage student assessments"}
            </p>
          </div>
        </div>

        {!selectedExam && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowMarksSelector(true)}
              className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-lg font-semibold transition"
            >
              <ClipboardList size={18} />
              Manage Marks &amp; Results
            </button>
            <button
              type="button"
              onClick={() => {
                setExamError("");
                setShowModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
            >
              <Plus size={18} />
              Create New Exam
            </button>
          </div>
        )}
      </div>

      {/* ========== EXAM LIST ========== */}

      {!selectedExam ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {exams.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl p-10 text-center border shadow-sm">
              <ClipboardList
                size={48}
                className="mx-auto text-slate-300 mb-3"
              />

              <p className="text-slate-600 font-medium">
                No exams created yet.
              </p>
            </div>
          ) : (
            exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* COURSE AND EXAM TYPE */}

                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <BookOpen size={13} />
                      {exam.course_title}
                    </span>

                    <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700">
                      {exam.exam_type}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mb-3">
                    {exam.title}
                  </h3>

                  {/* EXAM DETAILS */}

                  <div className="space-y-2 text-sm text-slate-600">

                    <p className="flex items-center gap-2">
                      <Calendar
                        size={15}
                        className="text-slate-400"
                      />
                      Date:
                      <strong>
                        {formatExamDate(exam.exam_date)}
                      </strong>
                    </p>

                    <p className="flex items-center gap-2">
                      <Award
                        size={15}
                        className="text-slate-400"
                      />
                      Total Marks:
                      <strong>{exam.total_marks}</strong>
                    </p>

                    <p className="flex items-center gap-2">
                      <Clock
                        size={15}
                        className="text-slate-400"
                      />
                      Mode:
                      <strong>
                        {exam.exam_mode || "Offline"}
                      </strong>
                    </p>

                    {exam.exam_mode === "Online" && (
                      <>
                        <p className="text-sm">
                          Duration:{" "}
                          <strong>
                            {exam.duration_minutes || 0} Minutes
                          </strong>
                        </p>

                        <p className="text-sm">
                          Start Time:{" "}
                          <strong>
                            {exam.start_time?.slice(0, 5) || "--"}
                          </strong>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* ========== ACTION BUTTONS ========== */}

                <div className="mt-5 pt-4 border-t space-y-3">

                  {/* EXAM STATUS */}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Exam Status
                    </span>

                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        exam.exam_status === "Published"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {exam.exam_status || "Draft"}
                    </span>
                  </div>

                  {/* EXAM SETTINGS */}

                  <button
                    type="button"
                    onClick={() => openExamSettings(exam)}
                    disabled={
                      exam.exam_status === "Published"
                    }
                    className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Settings size={17} />
                    Exam Settings
                  </button>

                  {exam.exam_mode === "Online" && (
                    <button
                      type="button"
                      onClick={() => openRescheduleExam(exam)}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Calendar size={17} />
                      Extend / Reschedule Exam
                    </button>
                  )}

                  {/* PUBLISH EXAM */}

                  {exam.exam_status !== "Published" && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePublishExam(exam)
                      }
                      disabled={
                        publishingExamId !== null
                      }
                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Send size={17} />
                      {publishingExamId === exam.id
                        ? "Publishing..."
                        : "Publish Exam"}
                    </button>
                  )}

                  {/* MANAGE QUESTIONS */}

                  <button
                    type="button"
                    onClick={() =>
                      openQuestionBuilder(exam)
                    }
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <ListChecks size={17} />
                    Manage Questions
                  </button>


                  
{/* REVIEW STUDENT SUBMISSIONS */}

<button
  type="button"
  onClick={() =>
    navigate(`/instructor/exams/${exam.id}/submissions`)
  }
  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
>
  <ClipboardList size={17} />
  Review Student Answers
</button>

{exam.exam_mode === "Online" && (
  <button
    type="button"
    onClick={() =>
      navigate(`/instructor/exams/${exam.id}/extensions`)
    }
    className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
  >
    Manage Extensions / Retakes
  </button>
)}


                </div>
              </div>
            ))
          )}
        </div>
      ) : (

        /* ========== GRADING VIEW ========== */

        <div className="bg-white rounded-xl shadow-sm p-6 border space-y-6">

          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Student Results Entry
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Total Marks: {selectedExam.total_marks}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedExam(null)
              }
              className="text-sm text-slate-600 border px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              Back to Exams List
            </button>
          </div>

          {loadingResults ? (
            <p className="text-center py-10 text-slate-500">
              Loading student list...
            </p>
          ) : studentResults.length === 0 ? (
            <p className="text-center py-10 text-slate-500">
              No students enrolled in this exam batch.
            </p>
          ) : (
            <div className="space-y-4">

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-slate-600 text-sm bg-slate-50">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">
                        Marks (/{selectedExam.total_marks})
                      </th>
                      <th className="p-3">Grade</th>
                      <th className="p-3">Feedback</th>
                      {selectedExam.exam_mode === "Online" && (
                        <th className="p-3">Action</th>
                      )}
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>



                  <tbody className="divide-y text-slate-700">
                    {studentResults.map((student) => (
                      <tr
                        key={student.student_id}
                        className="hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium">
                          {student.student_name}
                        </td>

                        <td className="p-3 text-slate-500 text-sm">
                          {student.student_email}
                        </td>

                        <td className="p-3">
                          <input
                            type="number"
                            min={0}
                            max={selectedExam.total_marks}
                            step="0.01"
                            readOnly={selectedExam.exam_mode === "Online" || selectedExam.result_published === 1}
                            value={
                              student.marks_obtained !== null
                                ? student.marks_obtained
                                : ""
                            }
                            onChange={(e) =>
                              handleResultChange(
                                student.student_id,
                                "marks_obtained",
                                e.target.value
                              )
                            }
                            className="w-28 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                            placeholder="Marks"
                          />
                        </td>

                        <td className="p-3">
                          <input
                            type="text"
                            readOnly
                            value={calculateGrade(student.marks_obtained, selectedExam.total_marks)}
                            className="w-24 border rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700"
                            title="Grade calculated automatically from percentage"
                          />
                        </td>

                        <td className="p-3">
                          <input
                            type="text"
                            readOnly={selectedExam.result_published === 1 ||
                              (selectedExam.exam_mode === "Online" && student.status !== "Graded")}
                            maxLength={2000}
                            value={student.feedback || ""}
                            onChange={(e) =>
                              handleResultChange(
                                student.student_id,
                                "feedback",
                                e.target.value
                              )
                            }
                            className="w-full min-w-36 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-purple-500"
                            placeholder="Feedback"
                          />
                        </td>

                        {selectedExam.exam_mode === "Online" && (
                          <td className="p-3">
                            {student.status === "Graded" && selectedExam.result_published !== 1 ? (
                              <button
                                type="button"
                                disabled={savingFeedbackId !== null}
                                onClick={() => void handleSaveFeedback(student)}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap"
                              >
                                {savingFeedbackId === student.student_id ? "Saving..." : "Save Feedback"}
                              </button>
                            ) : <span className="text-xs text-slate-500">{selectedExam.result_published === 1 ? "Published" : "Awaiting grading"}</span>}
                          </td>
                        )}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              student.status === "Graded"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {student.status === "Graded" ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ========== ASSIGNMENT MARKS (READ ONLY) ========== */}

<section className="mt-8 border-t pt-6 space-y-4">
  <div>
    <h3 className="text-lg font-bold text-slate-800">
      Assignment Marks & Results
    </h3>

    <p className="text-sm text-slate-500 mt-1">
      Assignment grades from the same course batch.
      Marks are managed in the Assignments module.
    </p>
  </div>

  {loadingAssignmentMarks ? (
    <p className="text-sm text-slate-500">
      Loading assignment results...
    </p>
  ) : assignmentMarksError ? (
    <p className="text-sm text-red-600">
      {assignmentMarksError}
    </p>
  ) : assignmentMarks.length === 0 ? (
    <p className="text-sm text-slate-500">
      No assignments found for this batch.
    </p>
  ) : (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="p-3">Assignment</th>
            <th className="p-3">Student</th>
            <th className="p-3">Marks</th>
            <th className="p-3">Feedback</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {assignmentMarks.map((item) => (
            <tr
              key={`${item.assignment_id}-${item.student_id}`}
              className="hover:bg-slate-50"
            >
              <td className="p-3 font-medium">
                {item.assignment_title}
              </td>

              <td className="p-3">
                {item.student_name}
              </td>

              <td className="p-3">
                {item.status === "Graded" &&
                item.marks_obtained !== null
                  ? `${item.marks_obtained} / ${item.total_marks}`
                  : "—"}
              </td>

              <td className="p-3 text-slate-600">
                {item.status === "Graded"
                  ? item.feedback || "—"
                  : "—"}
              </td>

              <td className="p-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "Graded"
                      ? "bg-green-100 text-green-700"
                      : item.status === "Submitted"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>

              <div className="flex justify-end pt-4 border-t">
                {selectedExam.exam_mode === "Offline" ? (
                  <button
                    type="button"
                    onClick={handleSaveResults}
                    disabled={submitting || selectedExam.result_published === 1}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Save size={16} />
                    {submitting ? "Saving..." : "Save All Results"}
                  </button>
                ) : (
                  <p className="text-sm text-green-700 font-medium">
                    Online exam marks are saved automatically after grading.
                    Review student answers to finalize marks.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                <span className="text-sm text-slate-600">
                  {selectedExam.result_published === 1
                    ? "Results are published and locked."
                    : "Publish after all required grading is complete."}
                </span>
                <button
                  type="button"
                  onClick={() => void handlePublishResults()}
                  disabled={publishingResults || submitting || savingFeedbackId !== null ||
                    selectedExam.result_published === 1 || !studentResults.some(s => s.status === "Graded")}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
                >
                  {selectedExam.result_published === 1 ? "Results Published" :
                    publishingResults ? "Publishing..." : "Publish Results"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== GLOBAL MARKS & RESULTS SELECTOR ========== */}
      {showMarksSelector && !selectedExam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Manage Marks &amp; Results</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choose an exam to view its results and the course batch assignment marks.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close marks selector"
                onClick={() => setShowMarksSelector(false)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X size={22} />
              </button>
            </div>
            {exams.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No exams available.</p>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => {
                      setShowMarksSelector(false);
                      void handleSelectExam(exam);
                    }}
                    className="w-full text-left rounded-lg border border-slate-200 p-4 hover:border-purple-500 hover:bg-purple-50 transition"
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{exam.title}</p>
                        <p className="text-sm text-slate-500 mt-1">{exam.course_title}</p>
                      </div>
                      <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                        {exam.exam_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      Total Marks: {exam.total_marks} · {exam.exam_mode}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== QUESTION BUILDER MODAL ========== */}

      {questionExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">

            <div className="flex justify-between items-start gap-3 border-b pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Manage Questions
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {questionExam.title}
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  {questionExam.course_title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setQuestionExam(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={22} />
              </button>
            </div>

            {/* QUESTION SUMMARY */}

            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs text-purple-600">
                    Total Questions
                  </p>

                  <p className="text-xl font-bold text-purple-800">
                    {questions.length}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-purple-600">
                    Allocated Marks
                  </p>

                  <p className="text-xl font-bold text-purple-800">
                    {allocatedMarks}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-purple-600">
                    Exam Total
                  </p>

                  <p className="text-xl font-bold text-purple-800">
                    {questionExam.total_marks}
                  </p>
                </div>
              </div>
            </div>

            {questionExam.exam_status === "Published" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 text-sm text-amber-800">
                This exam is already published.
                Questions are displayed in read-only mode.
              </div>
            )}

            {/* ADD QUESTION FORM */}

            {questionExam.exam_status !== "Published" && (
              <form
                onSubmit={handleAddQuestion}
                className="space-y-5"
              >
                <h3 className="text-lg font-semibold text-slate-800">
                  Add New Question
                </h3>

                {/* QUESTION TYPE */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Question Type
                  </label>

                  <select
                    value={questionType}
                    onChange={(e) => {
                      setQuestionType(
                        e.target.value as QuestionType
                      );
                      setCorrectAnswer("");
                      setQuestionError("");
                    }}
                    className="w-full border rounded-lg p-3 outline-none focus:border-purple-500"
                  >
                    <option value="MCQ">
                      Multiple Choice (MCQ)
                    </option>

                    <option value="TrueFalse">
                      True / False
                    </option>

                    <option value="ShortAnswer">
                      Short Answer
                    </option>
                  </select>
                </div>

                {/* QUESTION TEXT */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Question
                  </label>

                  <textarea
                    value={questionText}
                    onChange={(e) =>
                      setQuestionText(e.target.value)
                    }
                    rows={3}
                    required
                    placeholder="Write your question here..."
                    className="w-full border rounded-lg p-3 outline-none focus:border-purple-500"
                  />
                </div>

                {/* MCQ OPTIONS */}

                {questionType === "MCQ" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Answer Options
                    </label>

                    <p className="text-xs text-slate-500">
                      Enter four options and select the correct one.
                    </p>

                    {questionOptions.map((option, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-2 rounded-lg border ${
                          correctAnswer === String(index)
                            ? "border-purple-500 bg-purple-50"
                            : "border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="correctMCQ"
                          checked={
                            correctAnswer === String(index)
                          }
                          onChange={() =>
                            setCorrectAnswer(String(index))
                          }
                          className="accent-purple-600"
                        />

                        <span className="font-medium text-slate-600">
                          {String.fromCharCode(65 + index)}.
                        </span>

                        <input
                          type="text"
                          value={option}
                          onChange={(e) =>
                            handleOptionChange(
                              index,
                              e.target.value
                            )
                          }
                          required
                          placeholder={`Option ${String.fromCharCode(
                            65 + index
                          )}`}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm p-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* TRUE FALSE */}

                {questionType === "TrueFalse" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Correct Answer
                    </label>

                    <select
                      value={correctAnswer}
                      onChange={(e) =>
                        setCorrectAnswer(e.target.value)
                      }
                      required
                      className="w-full border rounded-lg p-3 outline-none focus:border-purple-500"
                    >
                      <option value="">
                        -- Select Correct Answer --
                      </option>

                      <option value="True">True</option>
                      <option value="False">False</option>
                    </select>
                  </div>
                )}

                {/* SHORT ANSWER */}

                {questionType === "ShortAnswer" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Model Answer (Optional)
                    </label>

                    <textarea
                      value={correctAnswer}
                      onChange={(e) =>
                        setCorrectAnswer(e.target.value)
                      }
                      rows={3}
                      placeholder="Reference answer for manual grading..."
                      className="w-full border rounded-lg p-3 outline-none focus:border-purple-500"
                    />

                    <p className="text-xs text-slate-500 mt-1">
                      Short answers will be checked by the instructor.
                    </p>
                  </div>
                )}

                {/* MARKS */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Question Marks
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={questionMarks}
                    onChange={(e) =>
                      setQuestionMarks(e.target.value)
                    }
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:border-purple-500"
                  />

                  <p className="text-xs text-slate-500 mt-1">
                    Remaining Marks:{" "}
                    {Math.max(
                      0,
                      Number(questionExam.total_marks) -
                        allocatedMarks
                    )}
                  </p>
                </div>

                {/* ERROR */}

                {questionError && (
                  <div className="flex gap-2 items-start bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                    <AlertCircle size={18} />
                    <span>{questionError}</span>
                  </div>
                )}

                {/* SUCCESS */}

                {questionSuccess && (
                  <div className="flex gap-2 items-center bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
                    <CheckCircle size={18} />
                    <span>{questionSuccess}</span>
                  </div>
                )}

                {/* ADD QUESTION */}

                <button
                  type="submit"
                  disabled={
                    savingQuestion || loadingQuestions
                  }
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {savingQuestion
                    ? "Saving Question..."
                    : "Add Question"}
                </button>
              </form>
            )}

            {/* SAVED QUESTIONS */}

            <div className="border-t mt-7 pt-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4">
                Saved Questions ({questions.length})
              </h3>

              {loadingQuestions ? (
                <p className="text-slate-500 text-sm">
                  Loading questions...
                </p>
              ) : questions.length === 0 ? (
                <div className="border border-dashed rounded-lg p-6 text-center">
                  <ClipboardList
                    size={30}
                    className="mx-auto text-slate-300 mb-2"
                  />

                  <p className="text-slate-500 text-sm">
                    No questions added yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => {
                    const options = parseQuestionOptions(
                      question.options
                    );

                    return (
                      <div
                        key={question.id}
                        className="border rounded-lg p-4 bg-slate-50"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-semibold text-slate-800">
                            Q{index + 1}.{" "}
                            {question.question_text}
                          </p>

                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                            {question.marks} Marks
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 mt-2 mb-3">
                          {question.question_type}
                        </p>

                        {/* MCQ ANSWERS */}

                        {question.question_type === "MCQ" && (
                          <div className="space-y-2">
                            {options.map((option, i) => {
                              const isCorrect =
                                question.correct_answer === String(i) ||
                                question.correct_answer === option;

                              return (
                                <div
                                  key={i}
                                  className={`text-sm px-3 py-2 rounded-lg ${
                                    isCorrect
                                      ? "bg-green-100 text-green-800 font-medium"
                                      : "bg-white text-slate-600 border"
                                  }`}
                                >
                                  {String.fromCharCode(65 + i)}.{" "}
                                  {option}

                                  {isCorrect && (
                                    <CheckCircle
                                      size={15}
                                      className="inline ml-2"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* TRUE FALSE ANSWER */}

                        {question.question_type === "TrueFalse" && (
                          <p className="text-sm text-green-700 font-medium">
                            Correct Answer:{" "}
                            {question.correct_answer}
                          </p>
                        )}

                        {/* SHORT ANSWER */}

                        {question.question_type === "ShortAnswer" && (
                          <div className="bg-white p-3 rounded-lg border">
                            <p className="text-xs font-medium text-slate-500 mb-1">
                              Model Answer
                            </p>

                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {question.correct_answer ||
                                "Manual grading required"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== RESCHEDULE MODAL ========== */}
      {rescheduleExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRescheduleExam}
            className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-800">
                Reschedule: {rescheduleExam.title}
              </h2>
              <button type="button" onClick={() => setRescheduleExam(null)}>
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
              This is allowed only when no student attempts or result records exist.
              Existing submissions cannot be moved to a new schedule.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              New Exam Date
              <input type="date" required value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Start Time (24-hour)
              <input type="time" required value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Duration (minutes)
              <input type="number" min={1} max={480} required value={rescheduleDuration}
                onChange={(e) => setRescheduleDuration(e.target.value)}
                className="mt-1 block w-full border rounded-lg px-3 py-2" />
            </label>
            {rescheduleError && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
                {rescheduleError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setRescheduleExam(null)}
                className="border rounded-lg px-4 py-2">Cancel</button>
              <button type="submit" disabled={savingReschedule}
                className="bg-purple-600 disabled:opacity-50 text-white rounded-lg px-5 py-2">
                {savingReschedule ? "Saving..." : "Save New Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========== EXAM SETTINGS MODAL ========== */}

      {settingsExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Exam Settings
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {settingsExam.title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsExam(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleSaveExamSettings}
              className="space-y-5"
            >
              {/* EXAM MODE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Mode
                </label>

                <select
                  value={examMode}
                  onChange={(e) =>
                    setExamMode(
                      e.target.value as "Online" | "Offline"
                    )
                  }
                  className="w-full border rounded-lg p-3"
                >
                  <option value="Online">
                    Online Examination
                  </option>
                  <option value="Offline">
                    Offline Examination
                  </option>
                </select>
              </div>

              {/* ONLINE SETTINGS */}

              {examMode === "Online" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Duration (Minutes)
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="480"
                      required
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(e.target.value)
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Exam Start Time
                    </label>

                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) =>
                        setStartTime(e.target.value)
                      }
                      className="w-full border rounded-lg p-3"
                    />

                    <p className="text-xs text-slate-500 mt-2">
                      Exam Date:{" "}
                      {formatExamDate(settingsExam.exam_date)}
                    </p>
                  </div>
                </>
              )}

              {/* ATTEMPT LIMIT */}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Maximum Attempts
                </label>

                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={attemptLimit}
                  onChange={(e) =>
                    setAttemptLimit(e.target.value)
                  }
                  className="w-full border rounded-lg p-3"
                />
              </div>

              {/* ERROR */}

              {settingsError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {settingsError}
                </p>
              )}

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSettingsExam(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {savingSettings
                    ? "Saving..."
                    : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== CREATE EXAM MODAL ========== */}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Create New Exam / Assessment
              </h3>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateExam}
              className="space-y-4"
            >
              {/* COURSE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Course
                </label>

                <select
                  value={courseId}
                  onChange={(e) =>
                    setCourseId(e.target.value)
                  }
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                >
                  <option value="">
                    -- Choose Course --
                  </option>

                  {courses.map((course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* EXAM TITLE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Exam Title
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="e.g. Midterm Examination"
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* EXAM TYPE */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Exam Type
                  </label>

                  <select
                    value={examType}
                    onChange={(e) =>
                      setExamType(e.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  >
                    <option value="Quiz">Quiz</option>
                    <option value="Midterm">Midterm</option>
                    <option value="Final">Final</option>
                  </select>
                </div>

                {/* TOTAL MARKS */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Total Marks
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={totalMarks}
                    onChange={(e) =>
                      setTotalMarks(e.target.value)
                    }
                    placeholder="e.g. 100"
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* EXAM DATE */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Exam Date
                </label>

                <input
                  type="date"
                  value={examDate}
                  onChange={(e) =>
                    setExamDate(e.target.value)
                  }
                  required
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              {/* ERROR */}

              {examError && (
                <p className="text-sm text-red-600">
                  {examError}
                </p>
              )}

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingExam}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {creatingExam
                    ? "Creating..."
                    : "Create Exam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default InstructorExams;
