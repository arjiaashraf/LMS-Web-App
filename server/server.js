require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");


const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.disable("x-powered-by");

app.use(helmet());

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients without an Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// Limit repeated authentication requests.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many verification requests. Try again later.",
  },
});

app.use("/api/login", loginLimiter);
app.use("/api/register", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/verify-email", otpLimiter);


// PAYMENT RECEIPT UPLOAD CONFIGURATION

const receiptDirectory = process.env.VERCEL
  ? path.join("/tmp", "campus95", "receipts")
  : path.join(__dirname, "uploads", "receipts");

fs.mkdirSync(receiptDirectory, {
  recursive: true,
});


const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptDirectory);
  },
  filename: (req, file, cb) => {
    const extension = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf'
    }[file.mimetype];

    cb(null, crypto.randomUUID() + extension);
  }
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG and PDF receipts are allowed.'));
    }

    cb(null, true);
  }
});


// MySQL Database Connection
// MySQL Database Connection


const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "lms_database",

  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,

  enableKeepAlive: true,

  ssl: process.env.DB_SSL === "true"
    ? { minVersion: "TLSv1.2" }
    : undefined,
});



db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", {
      code: err.code,
      message: err.message,
    });
    return;
  }

  console.log("Database connection successful");
  connection.release();
});


/* ========== CAMPUS 95 AUTH HELPERS ========== */

const EMAIL_OTP_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const authQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(
      { sql, values: params, timeout: 10000 },
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

const normalizeEmail = (email) =>
  String(email || '').trim().toLowerCase();

const makeOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const createLoginToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h', algorithm: 'HS256' }
  );
};


/* =================================================
   CAMPUS 95 — JWT AUTHENTICATION MIDDLEWARE
   ================================================= */

const authenticateToken = async (req, res, next) => {
  const authorization = req.headers.authorization || "";

  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Authentication required. Please login."
    });
  }

  const token = match[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing.");

      return res.status(500).json({
        message: "Authentication configuration error."
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    const userId = Number(decoded.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: "Invalid authentication token."
      });
    }

    
const users = await authQuery(
  `SELECT id, name, email, role, status, email_verified
   FROM users
   WHERE id = ?
     AND is_deleted = 0
   LIMIT 1`,
  [userId]
);


    if (!users.length) {
      return res.status(401).json({
        message: "User account no longer exists."
      });
    }

    const user = users[0];

    if (Number(user.email_verified) !== 1) {
      return res.status(403).json({
        message: "Email verification required."
      });
    }

    if (
      user.role !== "admin" &&
      user.status !== "approved"
    ) {
      return res.status(403).json({
        message: "Your account is not approved."
      });
    }

    req.user = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();

  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Session expired or invalid. Please login again."
      });
    }

    console.error("Authentication error:", error);

    return res.status(500).json({
      message: "Failed to verify authentication."
    });
  }
};


/* =================================================
   ROLE-BASED AUTHORIZATION MIDDLEWARE
   ================================================= */



const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions."
      });
    }

    next();
  };
};


/* =====================================================
   CAMPUS 95 — ADMIN & STUDENT SECURITY
   Protected independently of LMS_ENFORCE_AUTH flag.
   ===================================================== */

const securePositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const secureSameUser = (value, userId) =>
  securePositiveId(value) &&
  Number(value) === Number(userId);

const securityDenied = (res) =>
  res.status(403).json({
    message: "Access denied. Insufficient permissions."
  });

// =============== ADMIN SECURITY ===============

// Protect all /api/admin/* routes.
// Exception: instructors viewing their assigned batch roster.
app.use("/api/admin", authenticateToken, async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  const rosterMatch =
    req.method === "GET"
      ? req.path.match(/^\/class-batch-students\/(\d+)$/)
      : null;

  if (req.user.role === "instructor" && rosterMatch) {
    try {
      const batchId = Number(rosterMatch[1]);

      const rows = await authQuery(
        `SELECT cb.id
         FROM course_batches cb
         WHERE cb.id = ?
           AND (
             cb.instructor_id = ?
             OR EXISTS (
               SELECT 1
               FROM batch_instructors bi
               WHERE bi.batch_id = cb.id
                 AND bi.instructor_id = ?
             )
           )
         LIMIT 1`,
        [batchId, req.user.id, req.user.id]
      );

      if (!rows.length) {
        return securityDenied(res);
      }

      return next();
    } catch (error) {
      console.error("Roster authorization error:", error);
      return res.status(500).json({
        message: "Authorization check failed."
      });
    }
  }

  return securityDenied(res);
});

// Admin-managed user listings.
app.use(
  ["/api/students", "/api/teachers"],
  authenticateToken,
  authorizeRoles("admin")
);

// =============== STUDENT SECURITY ===============

app.use("/api/student", (req, res, next) => {
  // Published course catalog is public.
  if (req.method === "GET" && req.path === "/courses") {
    return next();
  }

  return authenticateToken(req, res, () => {
    authorizeRoles("student")(req, res, next);
  });
});

// Verify student identity and ownership.
app.use("/api/student", async (req, res, next) => {
  if (req.method === "GET" && req.path === "/courses") {
    return next();
  }

  const userId = req.user.id;

  // These paths contain student IDs, not resource IDs.
  const studentIdPatterns = [
    /^\/(\d+)$/,
    /^\/dashboard\/(\d+)$/,
    /^\/update-profile\/(\d+)$/,
    /^\/enrolled-batches\/(\d+)$/,
    /^\/assignments\/(\d+)$/,
    /^\/attendance\/(\d+)$/,
    /^\/class-schedules\/(\d+)$/,
    /^\/exams\/(\d+)$/,
    /^\/exam-attempt-statuses\/(\d+)$/
  ];

  for (const pattern of studentIdPatterns) {
    const match = req.path.match(pattern);

    if (match && !secureSameUser(match[1], userId)) {
      return securityDenied(res);
    }
  }

  // Check student IDs supplied inside JSON.
  // Multipart data is parsed later by Multer.
  for (const field of ["student_id", "studentId"]) {
    if (
      req.body?.[field] !== undefined &&
      !secureSameUser(req.body[field], userId)
    ) {
      return securityDenied(res);
    }

    if (
      req.query?.[field] !== undefined &&
      !secureSameUser(req.query[field], userId)
    ) {
      return securityDenied(res);
    }
  }

  try {
    // A student may access only their own exam attempts.
    const attemptMatch = req.path.match(
      /^\/exam-attempts\/(\d+)(?:\/.*)?$/
    );

    if (attemptMatch) {
      const attemptId = Number(attemptMatch[1]);

      const attempts = await authQuery(
        `SELECT id
         FROM exam_attempts
         WHERE id = ?
           AND student_id = ?
         LIMIT 1`,
        [attemptId, userId]
      );

      if (!attempts.length) {
        return securityDenied(res);
      }
    }

    // A student may start only an enrolled exam.
    const examStartMatch = req.path.match(
      /^\/exams\/(\d+)\/start$/
    );

    if (examStartMatch) {
      const examId = Number(examStartMatch[1]);

      const exams = await authQuery(
        `SELECT e.id
         FROM exams e
         JOIN course_enrollments ce
           ON ce.course_batch_id = e.course_batch_id
         WHERE e.id = ?
           AND ce.student_id = ?
           AND ce.status = 'Active'
         LIMIT 1`,
        [examId, userId]
      );

      if (!exams.length) {
        return securityDenied(res);
      }
    }

    return next();
  } catch (error) {
    console.error("Student authorization error:", error);

    return res.status(500).json({
      message: "Authorization check failed."
    });
  }
});



/* ==========================================================
   CAMPUS 95 — CENTRAL API SECURITY GATE
   ==========================================================
   This middleware:
   1. Protects private API routes with JWT.
   2. Checks Admin, Instructor, and Student roles.
   3. Verifies selected user and exam ownership.
   4. Blocks the database debug endpoint.
   5. Supports staged rollout to avoid breaking the LMS.
   ========================================================== */

// Keep false until all frontend requests send JWT.
// Set LMS_ENFORCE_AUTH=true in .env after integration/testing.
const ENFORCE_LMS_AUTH =
  process.env.LMS_ENFORCE_AUTH === "true";


if (
  process.env.NODE_ENV === "production" &&
  !ENFORCE_LMS_AUTH
) {
  throw new Error(
    "SECURITY ERROR: Production requires LMS_ENFORCE_AUTH=true."
  );
}


const validSecurityId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const sameSecurityId = (a, b) =>
  validSecurityId(a) &&
  validSecurityId(b) &&
  Number(a) === Number(b);

const checkStudentAttemptOwnership = async (
  attemptId,
  studentId
) => {
  const rows = await authQuery(
    `SELECT id
     FROM exam_attempts
     WHERE id = ?
       AND student_id = ?
     LIMIT 1`,
    [attemptId, studentId]
  );

  return rows.length > 0;
};

const checkStudentExamEnrollment = async (
  examId,
  studentId
) => {
  const rows = await authQuery(
    `SELECT e.id
     FROM exams e
     JOIN course_enrollments ce
       ON ce.course_batch_id = e.course_batch_id
     WHERE e.id = ?
       AND ce.student_id = ?
       AND ce.status = 'Active'
     LIMIT 1`,
    [examId, studentId]
  );

  return rows.length > 0;
};

const checkTeacherExamOwnership = async (
  examId,
  teacherId
) => {
  const rows = await authQuery(
    `SELECT id
     FROM exams
     WHERE id = ?
       AND teacher_id = ?
     LIMIT 1`,
    [examId, teacherId]
  );

  return rows.length > 0;
};

const checkTeacherAttemptOwnership = async (
  attemptId,
  teacherId
) => {
  const rows = await authQuery(
    `SELECT a.id
     FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     WHERE a.id = ?
       AND e.teacher_id = ?
     LIMIT 1`,
    [attemptId, teacherId]
  );

  return rows.length > 0;
};

const checkTeacherBatchAccess = async (
  batchId,
  teacherId
) => {
  const rows = await authQuery(
    `SELECT cb.id
     FROM course_batches cb
     WHERE cb.id = ?
       AND (
         cb.instructor_id = ?
         OR EXISTS (
           SELECT 1
           FROM batch_instructors bi
           WHERE bi.batch_id = cb.id
             AND bi.instructor_id = ?
         )
       )
     LIMIT 1`,
    [batchId, teacherId, teacherId]
  );

  return rows.length > 0;
};

const checkTeacherAssignmentAccess = async (
  assignmentId,
  teacherId
) => {
  const rows = await authQuery(
    `SELECT a.id
     FROM assignments a
     JOIN course_batches cb
       ON cb.id = a.course_batch_id
     WHERE a.id = ?
       AND (
         cb.instructor_id = ?
         OR EXISTS (
           SELECT 1
           FROM batch_instructors bi
           WHERE bi.batch_id = cb.id
             AND bi.instructor_id = ?
         )
       )
     LIMIT 1`,
    [assignmentId, teacherId, teacherId]
  );

  return rows.length > 0;
};



/* =====================================================
   CAMPUS 95 — INSTRUCTOR BACKEND SECURITY
   JWT + ROLE + OWNERSHIP
   Works independently of LMS_ENFORCE_AUTH.
   ===================================================== */

const instructorSecurity = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "instructor") {
      return res.status(403).json({
        message: "Instructor access required."
      });
    }

    const teacherId = req.user.id;
    const method = req.method;
    
const route = `${req.baseUrl}${req.path}`.replace(/^\/api(?=\/)/, "");

    const deny = () =>
      res.status(403).json({
        message: "Access denied to this instructor resource."
      });

    const validId = (value) => {
      const id = Number(value);
      return Number.isSafeInteger(id) && id > 0;
    };

    const ownId = (value) =>
      validId(value) && Number(value) === teacherId;

    const body = req.body || {};

    // Never trust instructor IDs supplied by the frontend.
    for (const field of ["teacher_id", "instructor_id"]) {
      if (
        body[field] !== undefined &&
        !ownId(body[field])
      ) {
        return deny();
      }

      if (
        req.query[field] !== undefined &&
        !ownId(req.query[field])
      ) {
        return deny();
      }
    }

    const batchAccess = async (batchId) => {
      if (!validId(batchId)) return false;

      const rows = await authQuery(
        `SELECT cb.id
         FROM course_batches cb
         WHERE cb.id = ?
           AND (
             cb.instructor_id = ?
             OR EXISTS (
               SELECT 1
               FROM batch_instructors bi
               WHERE bi.batch_id = cb.id
                 AND bi.instructor_id = ?
             )
           )
         LIMIT 1`,
        [batchId, teacherId, teacherId]
      );

      return rows.length > 0;
    };

    const courseAccess = async (courseId) => {
      if (!validId(courseId)) return false;

      const rows = await authQuery(
        `SELECT cb.id
         FROM course_batches cb
         WHERE cb.course_id = ?
           AND (
             cb.instructor_id = ?
             OR EXISTS (
               SELECT 1
               FROM batch_instructors bi
               WHERE bi.batch_id = cb.id
                 AND bi.instructor_id = ?
             )
           )
         LIMIT 1`,
        [courseId, teacherId, teacherId]
      );

      return rows.length > 0;
    };

    const examAccess = async (examId) => {
      if (!validId(examId)) return false;

      const rows = await authQuery(
        `SELECT e.id
         FROM exams e
         WHERE e.id = ?
           AND e.teacher_id = ?
         LIMIT 1`,
        [examId, teacherId]
      );

      return rows.length > 0;
    };

    const attemptAccess = async (attemptId) => {
      if (!validId(attemptId)) return false;

      const rows = await authQuery(
        `SELECT a.id
         FROM exam_attempts a
         JOIN exams e ON e.id = a.exam_id
         WHERE a.id = ?
           AND e.teacher_id = ?
         LIMIT 1`,
        [attemptId, teacherId]
      );

      return rows.length > 0;
    };

    const assignmentAccess = async (assignmentId) => {
      if (!validId(assignmentId)) return false;

      const rows = await authQuery(
        `SELECT a.id
         FROM assignments a
         JOIN course_batches cb
           ON cb.id = a.course_batch_id
         WHERE a.id = ?
           AND (
             cb.instructor_id = ?
             OR EXISTS (
               SELECT 1
               FROM batch_instructors bi
               WHERE bi.batch_id = cb.id
                 AND bi.instructor_id = ?
             )
           )
         LIMIT 1`,
        [assignmentId, teacherId, teacherId]
      );

      return rows.length > 0;
    };

    const sessionAccess = async (sessionId) => {
      if (!validId(sessionId)) return false;

      const rows = await authQuery(
        `SELECT cs.id
         FROM class_schedules cs
         WHERE cs.id = ?
           AND cs.instructor_id = ?
         LIMIT 1`,
        [sessionId, teacherId]
      );

      return rows.length > 0;
    };

    // =============================================
    // INSTRUCTOR COURSES
    // =============================================

    if (
      method === "POST" &&
      route === "/instructor/propose-course"
    ) {
      return next();
    }
    
    // Instructor can update only their own class.
    const classStatusMatch = route.match(
      /^\/teacher\/class-schedule\/status\/(\d+)$/
    );

    if (method === "PUT" && classStatusMatch) {
      return (await sessionAccess(classStatusMatch[1]))
        ? next()
        : deny();
    }


    const instructorBatches = route.match(
      /^\/instructor\/batches\/(\d+)$/
    );

    if (method === "GET" && instructorBatches) {
      return ownId(instructorBatches[1])
        ? next()
        : deny();
    }

    const batchStudents = route.match(
      /^\/instructor\/batch-students\/(\d+)$/
    );

    if (method === "GET" && batchStudents) {
      return (await batchAccess(batchStudents[1]))
        ? next()
        : deny();
    }

    // =============================================
    // ROUTES WITH INSTRUCTOR ID IN URL
    // =============================================

    const personalRoutes = [
      /^\/teacher\/dashboard\/(\d+)$/,
      /^\/teacher\/(\d+)$/,
      /^\/teacher\/update-profile\/(\d+)$/,
      /^\/teacher\/assignment-batches\/(\d+)$/,
      /^\/teacher\/assignments\/(\d+)$/,
      /^\/teacher\/class-schedules\/(\d+)$/,
      /^\/teacher\/courses\/(\d+)$/,
      /^\/teacher\/exams\/(\d+)$/
    ];

    for (const pattern of personalRoutes) {
      const match = route.match(pattern);

      if (match) {
        return ownId(match[1]) ? next() : deny();
      }
    }

    // =============================================
    // ASSIGNMENT SECURITY
    // =============================================

    
    // Instructor may grade only assignments
    // belonging to their assigned batches.
    if (
      method === "POST" &&
      route === "/teacher/grade-submission"
    ) {
      const assignmentId = Number(body.assignment_id);

      if (
        !Number.isSafeInteger(assignmentId) ||
        assignmentId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid assignment ID."
        });
      }

      return (await assignmentAccess(assignmentId))
        ? next()
        : deny();
    }


    if (
      method === "POST" &&
      route === "/teacher/assignments"
    ) {
      return (await batchAccess(body.course_batch_id))
        ? next()
        : deny();
    }

    const submissions = route.match(
      /^\/teacher\/assignment-submissions\/(\d+)\/(\d+)$/
    );

    if (method === "GET" && submissions) {
      if (!ownId(submissions[2])) return deny();

      return (await assignmentAccess(submissions[1]))
        ? next()
        : deny();
    }

    // =============================================
    // ONLINE CLASSES & ATTENDANCE
    // =============================================

    if (
      method === "POST" &&
      route === "/teacher/class-schedule"
    ) {
      return (await batchAccess(body.course_batch_id))
        ? next()
        : deny();
    }

    const updateClass = route.match(
      /^\/teacher\/class-schedule\/status\/(\d+)$/
    );

    if (method === "PUT" && updateClass) {
      return (await sessionAccess(updateClass[1]))
        ? next()
        : deny();
    }

    const attendanceSession = route.match(
      /^\/teacher\/attendance\/(\d+)$/
    );

    if (method === "GET" && attendanceSession) {
      return (await sessionAccess(attendanceSession[1]))
        ? next()
        : deny();
    }

    if (
      method === "POST" &&
      route === "/teacher/attendance"
    ) {
      return (await sessionAccess(body.class_session_id))
        ? next()
        : deny();
    }

    // =============================================
    // EXAM CREATION & QUESTION MANAGEMENT
    // =============================================

    if (
      method === "POST" &&
      route === "/teacher/exams"
    ) {
      return (await courseAccess(body.course_id))
        ? next()
        : deny();
    }

    if (
      method === "POST" &&
      route === "/teacher/exam-questions"
    ) {
      return (await examAccess(body.exam_id))
        ? next()
        : deny();
    }

    const examQuestions = route.match(
      /^\/teacher\/exam-questions\/(\d+)\/(\d+)$/
    );

    if (method === "GET" && examQuestions) {
      if (!ownId(examQuestions[2])) return deny();

      return (await examAccess(examQuestions[1]))
        ? next()
        : deny();
    }

    // =============================================
    // EXAM RESULTS, PUBLISHING & EXTENSIONS
    // =============================================

    const examResultStudents = route.match(
      /^\/teacher\/exam-results\/(\d+)\/(\d+)$/
    );

    if (method === "GET" && examResultStudents) {
      if (!ownId(examResultStudents[2])) return deny();

      return (await examAccess(examResultStudents[1]))
        ? next()
        : deny();
    }

    const examOperation = route.match(
      /^\/teacher\/exams\/(\d+)\/(settings|publish|publish-results|reschedule)$/
    );

    if (examOperation && method === "PUT") {
      return (await examAccess(examOperation[1]))
        ? next()
        : deny();
    }

    const submittedAttempts = route.match(
      /^\/teacher\/exams\/(\d+)\/submitted-attempts\/(\d+)$/
    );

    if (method === "GET" && submittedAttempts) {
      if (!ownId(submittedAttempts[2])) return deny();

      return (await examAccess(submittedAttempts[1]))
        ? next()
        : deny();
    }

    const reviewAttempt = route.match(
      /^\/teacher\/exam-attempts\/(\d+)\/review\/(\d+)$/
    );

    if (method === "GET" && reviewAttempt) {
      if (!ownId(reviewAttempt[2])) return deny();

      return (await attemptAccess(reviewAttempt[1]))
        ? next()
        : deny();
    }

    const gradeAttempt = route.match(
      /^\/teacher\/exam-attempts\/(\d+)\/grade-answer$/
    );

    if (method === "PUT" && gradeAttempt) {
      return (await attemptAccess(gradeAttempt[1]))
        ? next()
        : deny();
    }

    if (
      method === "POST" &&
      route === "/teacher/exam-results"
    ) {
      return (await examAccess(body.exam_id))
        ? next()
        : deny();
    }

    const feedbackRoute = route.match(
      /^\/teacher\/exam-results\/(\d+)\/(\d+)\/feedback$/
    );

    if (method === "PUT" && feedbackRoute) {
      return (await examAccess(feedbackRoute[1]))
        ? next()
        : deny();
    }

    const extensionRoute = route.match(
      /^\/teacher\/exams\/(\d+)\/extensions\/(\d+)$/
    );

    if (extensionRoute) {
      const examId = extensionRoute[1];
      const secondId = extensionRoute[2];

      if (method === "GET" && !ownId(secondId)) {
        return deny();
      }

      if (method !== "GET" && method !== "PUT") {
        return deny();
      }

      // PUT secondId is studentId, not teacherId.
      return (await examAccess(examId))
        ? next()
        : deny();
    }

    // =============================================
    // ASSIGNMENT MARKS VIEW
    // =============================================

    const assignmentMarks = route.match(
      /^\/teacher\/batches\/(\d+)\/assignment-marks\/(\d+)$/
    );

    if (method === "GET" && assignmentMarks) {
      if (!ownId(assignmentMarks[2])) return deny();

      return (await batchAccess(assignmentMarks[1]))
        ? next()
        : deny();
    }

    // Unrecognized instructor API: DENY BY DEFAULT.
    return res.status(403).json({
      message: "Instructor route needs authorization policy."
    });

  } catch (error) {
    console.error("Instructor authorization error:", error);

    return res.status(500).json({
      message: "Instructor authorization failed."
    });
  }
};

// Apply before instructor API handlers.
app.use(
  ["/api/teacher", "/api/instructor"],
  authenticateToken,
  instructorSecurity
);


const campus95SecurityGate = async (req, res, next) => {
  const apiPath = req.path;
  const method = req.method.toUpperCase();

  if (!apiPath.startsWith("/api/")) {
    return next();
  }

  // Never expose database debugging information.
  if (apiPath === "/api/debug/database") {
    return res.status(404).json({
      message: "Not found."
    });
  }

  // Rollout safety switch.
  if (!ENFORCE_LMS_AUTH) {
    return next();
  }

  // Only these API routes are public.
  const publicRoutes = new Set([
    "POST /api/login",
    "POST /api/register",
    "POST /api/auth/verify-email",
    "POST /api/auth/resend-otp",
    "GET /api/payment-settings",
    "GET /api/student/courses",
  ]);

  if (publicRoutes.has(`${method} ${apiPath}`)) {
    return next();
  }

  // Token verification; the middleware reads the DB user.
  authenticateToken(req, res, async () => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          message: "Authentication required."
        });
      }

      const role = user.role;
      const userId = user.id;

      const deny = () =>
        res.status(403).json({
          message: "Access denied."
        });

      
// Instructor may view students only in assigned batches.
const attendanceRosterMatch = apiPath.match(
  /^\/api\/admin\/class-batch-students\/(\d+)$/
);

if (
  method === "GET" &&
  attendanceRosterMatch &&
  role === "instructor"
) {
  const allowed = await checkTeacherBatchAccess(
    attendanceRosterMatch[1],
    userId
  );

  if (!allowed) return deny();

  return next();
}


      // ========== ADMIN ROUTES ==========

      if (apiPath.startsWith("/api/admin/")) {
        return role === "admin" ? next() : deny();
      }

      // Admin-managed student and teacher lists.
      if (
        apiPath === "/api/students" ||
        apiPath === "/api/teachers"
      ) {
        return role === "admin" ? next() : deny();
      }

      // ========== STUDENT ROUTES ==========

      if (apiPath.startsWith("/api/student/")) {
        if (role !== "student" && role !== "admin") {
          return deny();
        }

        // Admin can access student records.
        if (role === "admin") return next();

        // Student IDs supplied as URL parameters.
        const studentIdPaths = [
          /^\/api\/student\/(\d+)$/,
          /^\/api\/student\/dashboard\/(\d+)$/,
          /^\/api\/student\/update-profile\/(\d+)$/,
          /^\/api\/student\/enrolled-batches\/(\d+)$/,
          /^\/api\/student\/assignments\/(\d+)$/,
          /^\/api\/student\/class-schedules\/(\d+)$/,
          /^\/api\/student\/attendance\/(\d+)$/,
          /^\/api\/student\/exams\/(\d+)$/,
          /^\/api\/student\/exam-attempt-statuses\/(\d+)$/,
        ];

        for (const pattern of studentIdPaths) {
          const match = apiPath.match(pattern);

          if (
            match &&
            !sameSecurityId(match[1], userId)
          ) {
            return deny();
          }
        }

        // Student ID inside JSON or multipart form data.
        // Multipart is parsed later by multer, so enrollment
        // ownership must ALSO be checked inside that handler.
        const bodyStudentId =
          req.body?.student_id ?? req.body?.studentId;

        if (
          bodyStudentId !== undefined &&
          !sameSecurityId(bodyStudentId, userId)
        ) {
          return deny();
        }

        // Attempt ownership.
        const attemptMatch = apiPath.match(
          /^\/api\/student\/exam-attempts\/(\d+)(?:\/.*)?$/
        );

        if (attemptMatch) {
          const ownsAttempt =
            await checkStudentAttemptOwnership(
              attemptMatch[1],
              userId
            );

          if (!ownsAttempt) return deny();
        }

        // Exam enrollment.
        const startMatch = apiPath.match(
          /^\/api\/student\/exams\/(\d+)\/start$/
        );

        if (startMatch) {
          const enrolled =
            await checkStudentExamEnrollment(
              startMatch[1],
              userId
            );

          if (!enrolled) return deny();
        }

        return next();
      }

      // ========== INSTRUCTOR ROUTES ==========

      if (
        apiPath.startsWith("/api/teacher/") ||
        apiPath.startsWith("/api/instructor/")
      ) {
        if (role !== "instructor" && role !== "admin") {
          return deny();
        }

        if (role === "admin") return next();

        // Match URL parameters that identify the instructor.
        const teacherIdPatterns = [
          /^\/api\/teacher\/dashboard\/(\d+)$/,
          /^\/api\/teacher\/(\d+)$/,
          /^\/api\/teacher\/update-profile\/(\d+)$/,
          /^\/api\/teacher\/assignment-batches\/(\d+)$/,
          /^\/api\/teacher\/assignments\/(\d+)$/,
          /^\/api\/teacher\/class-schedules\/(\d+)$/,
          /^\/api\/teacher\/courses\/(\d+)$/,
          /^\/api\/teacher\/exams\/(\d+)$/,
          /^\/api\/instructor\/batches\/(\d+)$/,
          /^\/api\/teacher\/exam-results\/\d+\/(\d+)$/,
          /^\/api\/teacher\/exam-questions\/\d+\/(\d+)$/,
          /^\/api\/teacher\/assignment-submissions\/\d+\/(\d+)$/,
          /^\/api\/teacher\/exam-attempts\/\d+\/review\/(\d+)$/,
          /^\/api\/teacher\/exams\/\d+\/submitted-attempts\/(\d+)$/,
          /^\/api\/teacher\/exams\/\d+\/extensions\/(\d+)$/,
          /^\/api\/teacher\/batches\/\d+\/assignment-marks\/(\d+)$/,
        ];

        for (const pattern of teacherIdPatterns) {
          const match = apiPath.match(pattern);

          if (
            match &&
            !sameSecurityId(match[1], userId)
          ) {
            return deny();
          }
        }

        const bodyTeacherId =
          req.body?.teacher_id ??
          req.body?.instructor_id;

        if (
          bodyTeacherId !== undefined &&
          !sameSecurityId(bodyTeacherId, userId)
        ) {
          return deny();
        }

        // Direct exam ownership.
        const examMatch = apiPath.match(
          /^\/api\/teacher\/exams\/(\d+)\/(?:settings|publish|publish-results|reschedule|extensions\/.*)$/
        );

        if (examMatch) {
          const ownsExam =
            await checkTeacherExamOwnership(
              examMatch[1],
              userId
            );

          if (!ownsExam) return deny();
        }

        // Grading/review attempt ownership.
        const attemptMatch = apiPath.match(
          /^\/api\/teacher\/exam-attempts\/(\d+)(?:\/.*)?$/
        );

        if (attemptMatch) {
          const ownsAttempt =
            await checkTeacherAttemptOwnership(
              attemptMatch[1],
              userId
            );

          if (!ownsAttempt) return deny();
        }

        // Batch access.
        const batchMatch = apiPath.match(
          /^\/api\/(?:teacher\/batches|instructor\/batch-students)\/(\d+)(?:\/.*)?$/
        );

        if (batchMatch) {
          const assigned =
            await checkTeacherBatchAccess(
              batchMatch[1],
              userId
            );

          if (!assigned) return deny();
        }

        // Assignment submission access.
        const assignmentMatch = apiPath.match(
          /^\/api\/teacher\/assignment-submissions\/(\d+)\/\d+$/
        );

        if (assignmentMatch) {
          const assigned =
            await checkTeacherAssignmentAccess(
              assignmentMatch[1],
              userId
            );

          if (!assigned) return deny();
        }

        return next();
      }

      // Public catalog endpoints that require login.
      if (apiPath.startsWith("/api/course-batches/")) {
        return next();
      }

      // Fail closed for any other API not explicitly mapped.
      return res.status(403).json({
        message: "This API route needs a security policy."
      });
    } catch (error) {
      console.error("Security gate error:", error);

      return res.status(500).json({
        message: "Authorization check failed."
      });
    }
  });
};


/* ================================================
   CAMPUS 95 — REMAINING API LOCKDOWN
   ================================================ */

const campus95FinalApiGuard = (req, res, next) => {
  const route = req.path;
  const method = req.method.toUpperCase();

  // Disable diagnostic endpoints.
  if (
    route === "/debug/database" ||
    route === "/test-route"
  ) {
    return res.status(404).json({
      message: "Not found."
    });
  }

  // Explicit public routes.
  const publicRoutes = new Set([
    "POST /login",
    "POST /register",
    "POST /auth/verify-email",
    "POST /auth/resend-otp",
    "GET /payment-settings",
    "GET /student/courses"
  ]);

  if (publicRoutes.has(`${method} ${route}`)) {
    return next();
  }

  // Admin / Student / Instructor routes are protected
  // by their independently registered security guards.
  
  // Admin-only student and teacher listings.
  // These URLs do not start with /admin,
  // so the final guard must handle them explicitly.
  if (
    method === "GET" &&
    (route === "/students" || route === "/teachers")
  ) {
    return authenticateToken(req, res, () => {
      return authorizeRoles("admin")(req, res, next);
    });
  }

  if (
    route.startsWith("/admin/") ||
    route.startsWith("/student/") ||
    route.startsWith("/teacher/") ||
    route.startsWith("/instructor/")
  ) {
    return next();
  }

  // Shared course batches require authenticated access.
  if (
    method === "GET" &&
    /^\/course-batches\/\d+$/.test(route)
  ) {
    if (req.user) return next();

    return authenticateToken(req, res, next);
  }

  // Unknown API endpoints are denied.
  return res.status(403).json({
    message: "API route is not authorized."
  });
};

app.use("/api", campus95FinalApiGuard);

app.use(campus95SecurityGate);

/* =================================================
   ADMIN — VIEW PAYMENT RECEIPT (PROTECTED)
   ================================================= */

app.get(
  "/api/admin/payment-receipt/:enrollmentId",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {

    const enrollmentId = Number(req.params.enrollmentId);

    if (
      !Number.isSafeInteger(enrollmentId) ||
      enrollmentId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid enrollment ID."
      });
    }

    db.query(
      `SELECT payment_proof
       FROM course_enrollments
       WHERE id = ?`,
      [enrollmentId],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            message: "Database error."
          });
        }

        if (!results.length || !results[0].payment_proof) {
          return res.status(404).json({
            message: "Receipt not found."
          });
        }

        const filename = results[0].payment_proof;

        if (
          !/^[a-f0-9-]{36}\.(jpg|png|pdf)$/.test(filename)
        ) {
          return res.status(404).json({
            message: "Valid receipt not found."
          });
        }

        return res.sendFile(filename, {
          root: receiptDirectory
        });
      }
    );
  }
);



const sendVerificationCode = async (user) => {
  const otp = makeOtp();
  const hash = await bcrypt.hash(otp, 10);

  await authQuery(
    `INSERT INTO email_verification_codes
       (user_id, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW())
     ON DUPLICATE KEY UPDATE
       code_hash = VALUES(code_hash),
       expires_at = VALUES(expires_at),
       attempts = 0,
       created_at = NOW()`,
    [user.id, hash]
  );

  await mailTransport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Campus 95 - Verify Your Email',
    text:
      `Welcome to Campus 95!\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in ${EMAIL_OTP_MINUTES} minutes.\n\n` +
      `If you did not create this account, ignore this email.`
  });
};


/* =================================================
   1. REGISTER WITH EMAIL VERIFICATION
   ================================================= */

app.post('/api/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const role = req.body?.role;

  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 72 ||
    !['student', 'instructor'].includes(role)
  ) {
    return res.status(400).json({
      message: 'Enter valid details and a password of 8–72 characters.'
    });
  }

  try {
    const existing = await authQuery(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length) {
      return res.status(409).json({
        message: 'Email is already registered.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await authQuery(
      `INSERT INTO users
       (name, email, password, role, status, email_verified)
       VALUES (?, ?, ?, ?, 'pending', 0)`,
      [name, email, passwordHash, role]
    );

    let emailSent = true;

    try {
      await sendVerificationCode({
        id: result.insertId,
        email
      });
    } catch (mailError) {
      emailSent = false;
      console.error('Registration OTP email error:', mailError);
    }

    return res.status(201).json({
      message: emailSent
        ? 'Account created. Check your email for the verification code.'
        : 'Account created, but verification email could not be sent. Try Resend Code.',
      email,
      verification_required: true,
      email_sent: emailSent
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Email is already registered.'
      });
    }

    return res.status(500).json({
      message: 'Registration failed.'
    });
  }
});


/* =================================================
   2. VERIFY EMAIL OTP
   ================================================= */

app.post('/api/auth/verify-email', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      message: 'Enter a valid 6-digit code.'
    });
  }

  try {
    const users = await authQuery(
      `SELECT id, email_verified
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!users.length) {
      return res.status(400).json({
        message: 'Invalid or expired verification code.'
      });
    }

    const user = users[0];

    if (Number(user.email_verified) === 1) {
      return res.json({
        message: 'Email already verified.'
      });
    }

    // Atomically consume one verification attempt.
    const counter = await authQuery(
      `UPDATE email_verification_codes
       SET attempts = attempts + 1
       WHERE user_id = ?
         AND expires_at > NOW()
         AND attempts < ?`,
      [user.id, MAX_OTP_ATTEMPTS]
    );

    if (!counter.affectedRows) {
      return res.status(400).json({
        message: 'Code expired or attempts exceeded. Request a new code.'
      });
    }

    const rows = await authQuery(
      `SELECT code_hash
       FROM email_verification_codes
       WHERE user_id = ?
       LIMIT 1`,
      [user.id]
    );

    if (!rows.length) {
      return res.status(400).json({
        message: 'Invalid or expired verification code.'
      });
    }

    const valid = await bcrypt.compare(
      code,
      rows[0].code_hash
    );

    if (!valid) {
      return res.status(400).json({
        message: 'Incorrect verification code.'
      });
    }

    await authQuery(
      'UPDATE users SET email_verified = 1 WHERE id = ?',
      [user.id]
    );

    await authQuery(
      'DELETE FROM email_verification_codes WHERE user_id = ?',
      [user.id]
    );

    return res.json({
      message: 'Email verified! Your account is awaiting admin approval.'
    });
  } catch (error) {
    console.error('Email verification error:', error);

    return res.status(500).json({
      message: 'Could not verify email.'
    });
  }
});


/* =================================================
   3. RESEND VERIFICATION OTP
   ================================================= */

app.post('/api/auth/resend-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Enter a valid email.'
    });
  }

  const genericResponse = {
    message: 'If your account needs verification, a new code will be sent.'
  };

  try {
    const users = await authQuery(
      `SELECT id, email, email_verified
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (
      !users.length ||
      Number(users[0].email_verified) === 1
    ) {
      return res.json(genericResponse);
    }

    const codes = await authQuery(
      `SELECT created_at
       FROM email_verification_codes
       WHERE user_id = ?
       LIMIT 1`,
      [users[0].id]
    );

    if (codes.length) {
      const seconds = (
        Date.now() -
        new Date(codes[0].created_at).getTime()
      ) / 1000;

      if (seconds < 60) {
        return res.status(429).json({
          message: 'Please wait at least 60 seconds before resending.'
        });
      }
    }

    await sendVerificationCode(users[0]);

    return res.json(genericResponse);
  } catch (error) {
    console.error('Resend OTP error:', error);

    return res.status(500).json({
      message: 'Unable to resend code right now.'
    });
  }
});


/* =================================================
   4. SECURE LOGIN WITH JWT
   ================================================= */

app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (
    !email ||
    typeof password !== 'string' ||
    !password
  ) {
    return res.status(400).json({
      message: 'Email and password are required.'
    });
  }

  try {
    
const users = await authQuery(
  `SELECT id, name, email, password,
          role, status, email_verified
   FROM users
   WHERE email = ?
     AND is_deleted = 0
   LIMIT 1`,
  [email]
);


    if (!users.length) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];
    const storedPassword = String(user.password || '');

    const isHashed =
      /^\$2[aby]\$/.test(storedPassword);

    let validPassword = false;

    if (isHashed) {
      validPassword = await bcrypt.compare(
        password,
        storedPassword
      );
    } else {
      // Temporary migration support for legacy accounts.
      // Remove after all plaintext passwords are migrated.
      const supplied = Buffer.from(password);
      const stored = Buffer.from(storedPassword);

      validPassword =
        supplied.length === stored.length &&
        crypto.timingSafeEqual(supplied, stored);
    }

    if (!validPassword) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // Upgrade legacy password immediately on successful login.
    if (!isHashed) {
      const upgraded = await bcrypt.hash(password, 12);

      await authQuery(
        'UPDATE users SET password = ? WHERE id = ?',
        [upgraded, user.id]
      );
    }

    if (Number(user.email_verified) !== 1) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        verification_required: true,
        email: user.email
      });
    }

    if (
      user.role !== 'admin' &&
      user.status !== 'approved'
    ) {
      return res.status(403).json({
        message: 'Your account is waiting for admin approval.'
      });
    }

    const token = createLoginToken(user);

    return res.json({
      message: 'Login successful!',
      token,
      token_type: 'Bearer',
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Login failed.'
    });
  }
});




/* =================================================
   ADMIN — GET PENDING USERS (PROTECTED)
   ================================================= */

app.get(
  "/api/admin/pending-users",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {

    const sql = `
      SELECT
        id,
        name,
        email,
        role,
        status,
        email_verified
      FROM users
      WHERE status = 'pending'
      ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error("Pending users error:", err);

        return res.status(500).json({
          message: "Failed to load pending users."
        });
      }

      return res.json(results);
    });
  }
);


/* =================================================
   ADMIN — APPROVE USER (PROTECTED)
   ================================================= */

app.put(
  "/api/admin/approve-user/:id",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {

    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user ID."
      });
    }

    const sql = `
      UPDATE users
      SET status = 'approved'
      WHERE id = ?
        AND role IN ('student', 'instructor')
        AND email_verified = 1
        AND status = 'pending'
    `;

    db.query(sql, [userId], (err, result) => {

      if (err) {
        console.error("Approve user error:", err);

        return res.status(500).json({
          message: "Failed to approve user."
        });
      }

      if (result.affectedRows === 0) {
        return res.status(409).json({
          message:
            "User not found, not pending, or email not verified."
        });
      }

      return res.json({
        message: "User approved successfully!"
      });
    });
  }
);



/* ========== ADMIN DASHBOARD REAL STATISTICS ========== */

app.get('/api/admin/stats', (req, res) => {
  const query = `
    SELECT

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'student'
          AND status = 'approved'
      ) AS totalStudents,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'instructor'
          AND status = 'approved'
      ) AS totalTeachers,

      (
        SELECT COUNT(*)
        FROM courses
        WHERE status = 'Published'
      ) AS activeCourses,

      (
        SELECT COUNT(*)
        FROM users
        WHERE status = 'pending'
          AND role IN ('student', 'instructor')
      ) AS pendingUsers
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Admin dashboard stats error:', err);

      return res.status(500).json({
        message: 'Failed to load admin statistics.'
      });
    }

    return res.json({
      totalStudents: Number(results[0].totalStudents),
      totalTeachers: Number(results[0].totalTeachers),
      activeCourses: Number(results[0].activeCourses),
      pendingUsers: Number(results[0].pendingUsers)
    });
  });
});


// ================= TEACHERS MODULE APIs =================

app.get('/api/teachers', (req, res) => {
  const query = "SELECT id, name, email, phone, qualification, specialisation, department, profile_photo, role, status FROM users WHERE role = 'instructor' AND is_deleted = 0";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });

    const formattedTeachers = results.map(teacher => ({
      id: "TCH00" + teacher.id,
      databaseId: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || "Not Provided",
      qualification: teacher.qualification || "Not Provided",
      specialisation: teacher.specialisation || "Not Provided",
      department: teacher.department || "Not Provided",
      profilePhoto: teacher.profile_photo || "",
      status: teacher.status === 'approved' ? 'Active' : 'Pending'
    }));
    res.json(formattedTeachers);
  });
});

// ========== INSTRUCTOR DASHBOARD API ==========

// YAHAN NEW DASHBOARD API PASTE KAREIN

/* =========================================================
   INSTRUCTOR DASHBOARD — REAL MYSQL DATA
   GET /api/teacher/dashboard/:teacherId
   ========================================================= */

app.get('/api/teacher/dashboard/:teacherId', async (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!Number.isSafeInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({
      message: 'Invalid instructor ID.'
    });
  }

  const runQuery = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  // Includes the primary instructor and other assigned instructors.
  const assignedBatchCondition = `
    (
      cb.instructor_id = ?
      OR EXISTS (
        SELECT 1
        FROM batch_instructors bi
        WHERE bi.batch_id = cb.id
          AND bi.instructor_id = ?
      )
    )
  `;

  try {
    const instructors = await runQuery(
      `SELECT id
       FROM users
       WHERE id = ? AND role = 'instructor'
       LIMIT 1`,
      [teacherId]
    );

    if (instructors.length === 0) {
      return res.status(404).json({
        message: 'Instructor not found.'
      });
    }

    const [
      courses,
      students,
      pendingReviews,
      exams,
      classes,
      submissions
    ] = await Promise.all([

      // 1. Assigned courses
      runQuery(
        `
        SELECT COUNT(DISTINCT cb.course_id) AS total
        FROM course_batches cb
        WHERE ${assignedBatchCondition}
        `,
        [teacherId, teacherId]
      ),

      // 2. Active enrolled students
      runQuery(
        `
        SELECT COUNT(DISTINCT ce.student_id) AS total
        FROM course_batches cb

        JOIN course_enrollments ce
          ON ce.course_batch_id = cb.id
         AND ce.status = 'Active'

        WHERE ${assignedBatchCondition}
        `,
        [teacherId, teacherId]
      ),

      // 3. Assignment submissions awaiting grading
      runQuery(
        `
        SELECT COUNT(DISTINCT s.id) AS total
        FROM assignment_submissions s

        JOIN assignments a
          ON a.id = s.assignment_id

        JOIN course_batches cb
          ON cb.id = a.course_batch_id

        JOIN course_enrollments ce
          ON ce.course_batch_id = cb.id
         AND ce.student_id = s.student_id
         AND ce.status = 'Active'

        WHERE ${assignedBatchCondition}
          AND s.status = 'Submitted'
        `,
        [teacherId, teacherId]
      ),

      // 4. Created exams
      runQuery(
        `
        SELECT COUNT(DISTINCT e.id) AS total
        FROM exams e

        JOIN course_batches cb
          ON cb.id = e.course_batch_id

        WHERE e.teacher_id = ?
          AND ${assignedBatchCondition}
        `,
        [teacherId, teacherId, teacherId]
      ),

      // 5. Upcoming online classes
      runQuery(
        `
        SELECT
          cs.id,
          c.title AS course_title,
          DATE_FORMAT(
            cs.session_date,
            '%Y-%m-%d'
          ) AS session_date,
          TIME_FORMAT(
            cs.start_time,
            '%H:%i:%s'
          ) AS start_time,
          cs.status

        FROM class_schedules cs

        JOIN course_batches cb
          ON cb.id = cs.course_batch_id

        JOIN courses c
          ON c.id = cb.course_id

        WHERE cs.instructor_id = ?
          AND ${assignedBatchCondition}
          AND TIMESTAMP(
            cs.session_date,
            cs.start_time
          ) > NOW()
          AND cs.status = 'Scheduled'

        ORDER BY
          cs.session_date ASC,
          cs.start_time ASC

        LIMIT 5
        `,
        [teacherId, teacherId, teacherId]
      ),

      // 6. Latest assignment submissions
      runQuery(
        `
        SELECT
          s.id AS submission_id,
          u.name AS student_name,
          a.title AS assignment_title,
          c.title AS course_title,
          s.status,
          DATE_FORMAT(
            s.submitted_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS submitted_at

        FROM assignment_submissions s

        JOIN assignments a
          ON a.id = s.assignment_id

        JOIN course_batches cb
          ON cb.id = a.course_batch_id

        JOIN courses c
          ON c.id = cb.course_id

        JOIN users u
          ON u.id = s.student_id

        JOIN course_enrollments ce
          ON ce.course_batch_id = cb.id
         AND ce.student_id = s.student_id
         AND ce.status = 'Active'

        WHERE ${assignedBatchCondition}

        ORDER BY
          s.submitted_at DESC,
          s.id DESC

        LIMIT 5
        `,
        [teacherId, teacherId]
      )
    ]);

    return res.json({
      assignedCoursesCount:
        Number(courses[0]?.total || 0),

      activeStudentsCount:
        Number(students[0]?.total || 0),

      pendingAssignmentReviewsCount:
        Number(pendingReviews[0]?.total || 0),

      totalExamsCount:
        Number(exams[0]?.total || 0),

      upcomingClasses: classes,
      recentSubmissions: submissions
    });

  } catch (error) {
    console.error(
      'Instructor dashboard API error:',
      error
    );

    return res.status(500).json({
      message: 'Failed to load instructor dashboard.'
    });
  }
});



// ========== EXISTING TEACHER PROFILE API ==========
// ISKO BILKUL CHANGE NAHI KARNA

app.get('/api/teacher/:id', (req, res) => {
  const teacherId = req.params.id;

  db.query(
    "SELECT id, name, email, phone, qualification, specialisation, department, profile_photo, role, status FROM users WHERE id = ? AND role = 'instructor'",
    [teacherId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({
          message: "Teacher not found"
        });
      }

      res.json(results[0]);
    }
  );
});


app.put('/api/teacher/update-profile/:id', (req, res) => {
  const teacherId = req.params.id;
  const { phone, qualification, specialisation, department, profile_photo } = req.body;
  const query = `
    UPDATE users 
    SET phone = ?, qualification = ?, specialisation = ?, department = ?, profile_photo = ? 
    WHERE id = ? AND role = 'instructor'
  `;
  db.query(query, [phone, qualification, specialisation, department, profile_photo, teacherId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: 'Profile updated successfully!' });
  });
});

app.put('/api/admin/update-teacher/:id', (req, res) => {
  const teacherId = req.params.id;
  const { phone, qualification, specialisation, department } = req.body;
  const query = `
    UPDATE users 
    SET phone = ?, qualification = ?, specialisation = ?, department = ? 
    WHERE id = ?
  `;
  db.query(query, [phone, qualification, specialisation, department, teacherId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Teacher updated successfully!" });
  });
});

/* ============================================
   ADMIN — ARCHIVE STUDENT OR INSTRUCTOR
   ============================================ */

app.delete(
  "/api/admin/delete-user/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const userId = Number(req.params.id);

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid user ID."
      });
    }

    try {
      const users = await authQuery(
        `SELECT id, name, role, is_deleted
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );

      if (!users.length) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const user = users[0];

      // Never delete administrators from this API.
      if (!["student", "instructor"].includes(user.role)) {
        return res.status(403).json({
          message:
            "Only Student and Instructor accounts can be removed."
        });
      }

      if (Number(user.is_deleted) === 1) {
        return res.status(409).json({
          message: "This account is already removed."
        });
      }

      const result = await authQuery(
        `UPDATE users
         SET is_deleted = 1
         WHERE id = ?
           AND role IN ('student', 'instructor')
           AND is_deleted = 0`,
        [userId]
      );

      if (result.affectedRows !== 1) {
        return res.status(409).json({
          message: "Unable to remove this account."
        });
      }

      return res.json({
        message: `${user.role === "student"
          ? "Student"
          : "Teacher"} account removed successfully.`,
        user_id: userId,
        removed: true
      });

    } catch (error) {
      console.error("Admin remove user error:", error);

      return res.status(500).json({
        message: "Failed to remove user."
      });
    }
  }
);


// ================= STUDENTS MODULE APIs =================

app.get('/api/students', (req, res) => {
  const query = "SELECT id, name, email, phone, qualification, department, program, semester, cgpa, profile_photo, role, status FROM users WHERE role = 'student' AND status = 'approved' AND is_deleted = 0";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });

    const formattedStudents = results.map(student => ({
      id: "STU00" + student.id,
      databaseId: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone || "Not Provided",
      qualification: student.qualification || "Not Provided",
      department: student.department || "Not Provided",
      program: student.program || "Not Provided",
      semester: student.semester || "Not Provided",
      cgpa: student.cgpa || "Not Provided",
      profilePhoto: student.profile_photo || "",
      status: 'Active'
    }));
    res.json(formattedStudents);
  });
});

// STUDENT - Get All Published Courses Catalog
app.get('/api/student/courses', (req, res) => {
  const query = `
    SELECT c.*,
           GROUP_CONCAT(DISTINCT inst.name SEPARATOR ', ') AS assigned_instructors
    FROM courses c
    LEFT JOIN course_batches cb ON cb.course_id = c.id
    LEFT JOIN batch_instructors bi ON bi.batch_id = cb.id
    LEFT JOIN users inst ON inst.id = bi.instructor_id OR inst.id = cb.instructor_id
    WHERE c.status = 'Published'
    GROUP BY c.id
    ORDER BY c.id DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({
      message: "Database error",
      error: err
    });

    res.json(results);
  });
});
// STUDENT - Submit or Update Assignment
app.post('/api/student/submit-assignment', (req, res) => {
  const {
    assignment_id,
    student_id,
    submission_text,
    file_url
  } = req.body;

  const assignmentId = Number(assignment_id);
  const studentId = Number(student_id);

  if (
    !Number.isInteger(assignmentId) || assignmentId <= 0 ||
    !Number.isInteger(studentId) || studentId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid assignment or student ID.'
    });
  }

  if (!submission_text?.trim() && !file_url) {
    return res.status(400).json({
      message: 'Please provide an answer or attach a file.'
    });
  }

  // Check whether student is actively enrolled in the assignment batch
  const checkQuery = `
    SELECT a.id
    FROM assignments a
    JOIN course_enrollments ce
      ON ce.course_batch_id = a.course_batch_id
    WHERE a.id = ?
      AND ce.student_id = ?
      AND ce.status = 'Active'
    LIMIT 1
  `;

  db.query(checkQuery, [assignmentId, studentId], (checkErr, results) => {
    if (checkErr) {
      console.error('Submission enrollment check error:', checkErr);
      return res.status(500).json({ message: 'Database error.' });
    }

    if (results.length === 0) {
      return res.status(403).json({
        message: 'You are not enrolled in this assignment batch.'
      });
    }

    // Check existing submission
    db.query(
      `SELECT id, status
       FROM assignment_submissions
       WHERE assignment_id = ? AND student_id = ?
       LIMIT 1`,
      [assignmentId, studentId],
      (findErr, submissions) => {
        if (findErr) {
          return res.status(500).json({ message: 'Database error.' });
        }

        if (submissions.length > 0) {
          if (submissions[0].status === 'Graded') {
            return res.status(400).json({
              message: 'Graded assignments cannot be updated.'
            });
          }

          const updateQuery = `
            UPDATE assignment_submissions
            SET submission_text = ?,
                file_url = ?,
                submitted_at = CURRENT_TIMESTAMP,
                status = 'Submitted'
            WHERE id = ?
          `;

          return db.query(
            updateQuery,
            [submission_text || '', file_url || null, submissions[0].id],
            (updateErr) => {
              if (updateErr) {
                console.error('Submission update error:', updateErr);
                return res.status(500).json({
                  message: 'Failed to update assignment.'
                });
              }

              res.json({
                message: 'Assignment updated successfully!'
              });
            }
          );
        }

        const insertQuery = `
          INSERT INTO assignment_submissions
          (assignment_id, student_id, submission_text, file_url, status)
          VALUES (?, ?, ?, ?, 'Submitted')
        `;

        db.query(
          insertQuery,
          [assignmentId, studentId, submission_text || '', file_url || null],
          (insertErr) => {
            if (insertErr) {
              console.error('Assignment submission error:', insertErr);
              return res.status(500).json({
                message: 'Failed to submit assignment.'
              });
            }

            res.status(201).json({
              message: 'Assignment submitted successfully!'
            });
          }
        );
      }
    );
  });
});

app.get('/api/student/:id', (req, res) => {
  const studentId = req.params.id;
  db.query("SELECT id, name, email, phone, qualification, department, program, semester, cgpa, profile_photo, role, status FROM users WHERE id = ? AND role = 'student'", [studentId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: "Student not found" });
    res.json(results[0]);
  });
});

app.put('/api/student/update-profile/:id', (req, res) => {
  const studentId = req.params.id;
  const { phone, qualification, department, program, semester, cgpa, profile_photo } = req.body;
  const query = `
    UPDATE users 
    SET phone = ?, qualification = ?, department = ?, program = ?, semester = ?, cgpa = ?, profile_photo = ? 
    WHERE id = ? AND role = 'student'
  `;
  db.query(query, [phone, qualification, department, program, semester, cgpa, profile_photo, studentId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: 'Profile updated successfully!' });
  });
});

app.put('/api/admin/update-student/:id', (req, res) => {
  const studentId = req.params.id;
  const { phone, qualification, department, program, semester, cgpa } = req.body;
  const query = `
    UPDATE users 
    SET phone = ?, qualification = ?, department = ?, program = ?, semester = ?, cgpa = ? 
    WHERE id = ? AND role = 'student'
  `;
  db.query(query, [phone, qualification, department, program, semester, cgpa, studentId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Student updated successfully by Admin!" });
  });
});


/* ========== STUDENT DASHBOARD — REAL DATABASE DATA ========== */

app.get('/api/student/dashboard/:id', async (req, res) => {
  const studentId = Number(req.params.id);

  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      message: 'Invalid student ID.'
    });
  }

  const query = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  try {
    // Student profile
    const students = await query(
      `SELECT id, name, email, cgpa
       FROM users
       WHERE id = ? AND role = 'student'
       LIMIT 1`,
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({
        message: 'Student not found.'
      });
    }

    const [
      courseRows,
      assignmentRows,
      attendanceRows,
      upcomingAssignments,
      upcomingExams
    ] = await Promise.all([

      // 1. Active enrolled courses
      query(
        `SELECT COUNT(DISTINCT cb.course_id) AS total
         FROM course_enrollments ce
         JOIN course_batches cb
           ON cb.id = ce.course_batch_id
         WHERE ce.student_id = ?
           AND ce.status = 'Active'`,
        [studentId]
      ),

      // 2. Pending assignments
      query(
        `SELECT COUNT(*) AS total
         FROM assignments a
         WHERE EXISTS (
           SELECT 1
           FROM course_enrollments ce
           WHERE ce.course_batch_id = a.course_batch_id
             AND ce.student_id = ?
             AND ce.status = 'Active'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM assignment_submissions s
           WHERE s.assignment_id = a.id
             AND s.student_id = ?
             AND s.status IN ('Submitted', 'Graded')
         )`,
        [studentId, studentId]
      ),

      // 3. Recorded attendance
      query(
        `SELECT
           COUNT(*) AS total,
           COALESCE(
             SUM(
               CASE WHEN ar.status = 'Present'
               THEN 1 ELSE 0 END
             ), 0
           ) AS present
         FROM attendance_records ar
         JOIN class_schedules cs
           ON cs.id = ar.class_session_id
         WHERE ar.student_id = ?
           AND EXISTS (
             SELECT 1
             FROM course_enrollments ce
             WHERE ce.student_id = ar.student_id
               AND ce.course_batch_id = cs.course_batch_id
               AND ce.status = 'Active'
           )`,
        [studentId]
      ),

      // 4. Upcoming unsubmitted assignments
      query(
        `SELECT
           a.id,
           a.title,
           c.title AS course_title,
           DATE_FORMAT(
             a.due_date, '%Y-%m-%d'
           ) AS due_date
         FROM assignments a
         JOIN course_batches cb
           ON cb.id = a.course_batch_id
         JOIN courses c
           ON c.id = cb.course_id
         WHERE a.due_date >= CURDATE()
           AND EXISTS (
             SELECT 1
             FROM course_enrollments ce
             WHERE ce.course_batch_id = a.course_batch_id
               AND ce.student_id = ?
               AND ce.status = 'Active'
           )
           AND NOT EXISTS (
             SELECT 1
             FROM assignment_submissions s
             WHERE s.assignment_id = a.id
               AND s.student_id = ?
               AND s.status IN ('Submitted', 'Graded')
           )
         ORDER BY a.due_date ASC, a.id ASC
         LIMIT 5`,
        [studentId, studentId]
      ),

      // 5. Upcoming online exams, including individual extensions
      query(
        `SELECT
           e.id,
           e.title,
           c.title AS course_title,

           DATE_FORMAT(
             COALESCE(
               x.start_at,
               TIMESTAMP(e.exam_date, e.start_time)
             ),
             '%Y-%m-%d'
           ) AS exam_date,

           DATE_FORMAT(
             COALESCE(
               x.start_at,
               TIMESTAMP(e.exam_date, e.start_time)
             ),
             '%H:%i:%s'
           ) AS exam_start_time

         FROM exams e

         JOIN course_batches cb
           ON cb.id = e.course_batch_id

         JOIN courses c
           ON c.id = cb.course_id

         JOIN course_enrollments ce
           ON ce.course_batch_id = cb.id
          AND ce.student_id = ?
          AND ce.status = 'Active'

         LEFT JOIN student_exam_extensions x
           ON x.exam_id = e.id
          AND x.student_id = ce.student_id

         WHERE e.exam_status = 'Published'
           AND e.exam_mode = 'Online'
           AND e.result_published = 0

           AND COALESCE(
             x.start_at,
             TIMESTAMP(e.exam_date, e.start_time)
           ) > NOW()

         ORDER BY
           COALESCE(
             x.start_at,
             TIMESTAMP(e.exam_date, e.start_time)
           ) ASC,
           e.id ASC

         LIMIT 5`,
        [studentId]
      )
    ]);

    const attendanceTotal =
      Number(attendanceRows[0]?.total || 0);

    const attendancePresent =
      Number(attendanceRows[0]?.present || 0);

    const rawCgpa = students[0].cgpa;

    const validCgpa =
      rawCgpa !== null &&
      rawCgpa !== undefined &&
      String(rawCgpa).trim() !== '' &&
      Number.isFinite(Number(rawCgpa)) &&
      Number(rawCgpa) >= 0 &&
      Number(rawCgpa) <= 4;

    return res.json({
      id: students[0].id,
      name: students[0].name,
      email: students[0].email,

      enrolledCoursesCount:
        Number(courseRows[0]?.total || 0),

      pendingAssignmentsCount:
        Number(assignmentRows[0]?.total || 0),

      attendancePercentage:
        attendanceTotal > 0
          ? `${(
              attendancePresent / attendanceTotal * 100
            ).toFixed(1)}%`
          : null,

      cgpa: validCgpa
        ? Number(rawCgpa).toFixed(2)
        : null,

      upcomingAssignments,
      upcomingExams
    });

  } catch (err) {
    console.error('Student dashboard real data error:', err);

    return res.status(500).json({
      message: 'Failed to load student dashboard.'
    });
  }
});



// ================= COURSES & BATCHES AUTHORITATIVE MODULE APIs =================

app.post('/api/admin/courses', (req, res) => {
  const { title, description, learning_objectives, schedule, thumbnail, fee, category, level, duration } = req.body;
  const code = 'CRS-' + Math.floor(1000 + Math.random() * 9000);
  const query = `
    INSERT INTO courses (title, code, description, learning_objectives, schedule, thumbnail, fee, category, level, duration, status, proposed_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', NULL)
  `;
  db.query(query, [title, code, description, learning_objectives || '', schedule || '', thumbnail || '', fee || 0, category || 'Academics', level || 'Beginner', duration || '4 Weeks'], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.status(201).json({ message: "Course created and published successfully by Admin!" });
  });
});

app.post('/api/instructor/propose-course', (req, res) => {
  const { title, description, learning_objectives, schedule, thumbnail, fee, category, level, duration, instructor_id } = req.body;
  const code = 'CRS-' + Math.floor(1000 + Math.random() * 9000);
  const query = `
    INSERT INTO courses (title, code, description, learning_objectives, schedule, thumbnail, fee, category, level, duration, status, proposed_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Approval', ?)
  `;
  db.query(query, [title, code, description, learning_objectives || '', schedule || '', thumbnail || '', fee || 0, category || 'Academics', level || 'Beginner', duration || '4 Weeks', instructor_id], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.status(201).json({ message: "Course proposed successfully! Waiting for Admin approval." });
  });
});

app.get('/api/admin/courses', (req, res) => {
  const query = `
    SELECT c.*, u.name AS proposer_name, 
           GROUP_CONCAT(DISTINCT inst.name SEPARATOR ', ') AS assigned_instructors
    FROM courses c
    LEFT JOIN users u ON c.proposed_by = u.id
    LEFT JOIN course_batches cb ON cb.course_id = c.id
    LEFT JOIN batch_instructors bi ON bi.batch_id = cb.id
    LEFT JOIN users inst ON inst.id = bi.instructor_id OR inst.id = cb.instructor_id
    GROUP BY c.id
    ORDER BY c.id DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.get('/api/admin/pending-courses', (req, res) => {
  const query = `
    SELECT c.*, u.name AS proposer_name 
    FROM courses c
    LEFT JOIN users u ON c.proposed_by = u.id
    WHERE c.status = 'Pending Approval'
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.put('/api/admin/course-status/:id', (req, res) => {
  const courseId = req.params.id;
  const { status, fee } = req.body;
  const query = `UPDATE courses SET status = ?, fee = ? WHERE id = ?`;
  db.query(query, [status, fee || 0, courseId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: `Course approved, published, and fee set to $${fee || 0} successfully!` });
  });
});

app.put('/api/admin/update-course/:id', (req, res) => {
  const courseId = req.params.id;
  const { fee, status, level } = req.body;
  const query = `UPDATE courses SET fee = ?, status = ?, level = ? WHERE id = ?`;
  db.query(query, [fee, status, level, courseId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Course updated and managed successfully by Admin!" });
  });
});

app.post('/api/admin/course-batches', (req, res) => {
  const { course_id, instructor_ids, timing_days, start_time, end_time, capacity, start_date } = req.body;
  const batchQuery = `
    INSERT INTO course_batches (course_id, instructor_id, timing_days, start_time, end_time, capacity, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const primaryInstructorId = instructor_ids && instructor_ids.length > 0 ? Number(instructor_ids[0]) : null;

  db.query(batchQuery, [course_id, primaryInstructorId, timing_days, start_time, end_time, capacity, start_date], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    
    const batchId = result.insertId;
    if (instructor_ids && instructor_ids.length > 0) {
      const instructorValues = instructor_ids.map(id => [batchId, Number(id)]);
      const multiInstructorQuery = `INSERT IGNORE INTO batch_instructors (batch_id, instructor_id) VALUES ?`;
      db.query(multiInstructorQuery, [instructorValues], (multiErr) => {
        if (multiErr) return res.status(500).json({ message: "Failed to assign instructors", error: multiErr });
        res.status(201).json({ message: "Batch created & instructors assigned successfully!" });
      });
    } else {
      res.status(201).json({ message: "Batch created successfully!" });
    }
  });
});

// ADMIN - Delete Course
app.delete('/api/admin/courses/:id', (req, res) => {
  const courseId = req.params.id;

  const query = "DELETE FROM courses WHERE id = ?";

  db.query(query, [courseId], (err, result) => {
    if (err) {
      console.error("Course deletion error:", err);
      return res.status(500).json({
        message: "Failed to delete course",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Course not found"
      });
    }

    res.json({
      message: "Course deleted successfully!"
    });
  });
});


app.get('/api/course-batches/:courseId', (req, res) => {
  const courseId = req.params.courseId;
  const query = `
    SELECT cb.*, u.name AS instructor_name, u.qualification, u.specialisation,
           (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_batch_id = cb.id AND ce.status = 'Active') AS current_enrolled
    FROM course_batches cb
    JOIN users u ON cb.instructor_id = u.id
    WHERE cb.course_id = ?
  `;
  db.query(query, [courseId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.get('/api/admin/course-batches/:courseId', (req, res) => {
  const courseId = req.params.courseId;
  const query = `
    SELECT cb.*, 
           GROUP_CONCAT(u.name SEPARATOR ', ') AS instructor_names,
           GROUP_CONCAT(u.id SEPARATOR ',') AS assigned_instructor_ids
    FROM course_batches cb
    LEFT JOIN batch_instructors bi ON bi.batch_id = cb.id
    LEFT JOIN users u ON u.id = bi.instructor_id
    WHERE cb.course_id = ?
    GROUP BY cb.id
  `;
  db.query(query, [courseId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});
// STUDENT - Get Active Payment Methods
app.get('/api/payment-settings', (req, res) => {
  const query = `
    SELECT id, payment_method, account_title,
           account_number, bank_name, iban, instructions
    FROM payment_settings
    WHERE is_active = 1
    ORDER BY id ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Failed to load payment methods"
      });
    }

    res.json(results);
  });
});

// STUDENT - Submit Enrollment with Payment Proof
// STUDENT - Enroll with Payment Receipt
app.post('/api/student/enroll-batch',
  authenticateToken,
  authorizeRoles("student"),
  (req, res) => {

  receiptUpload.single('receipt')(req, res, (uploadErr) => {

    if (uploadErr) {
      return res.status(400).json({
        message: uploadErr.message
      });
    }

    const {
      student_id,
      course_batch_id,
      payment_method,
      transaction_id
    } = req.body;

    const receipt = req.file;

    const removeReceipt = () => {
      if (receipt) {
        fs.unlink(receipt.path, (err) => {
          if (err) console.error("Receipt cleanup error:", err);
        });
      }
    };

    if (
      !student_id ||
      !course_batch_id ||
      !payment_method ||
      !transaction_id?.trim() ||
      !receipt
    ) {
      removeReceipt();
      return res.status(400).json({
        message: "All payment details and receipt are required."
      });
    }

    const studentId = Number(student_id);
    const batchId = Number(course_batch_id);

    if (
      !Number.isInteger(studentId) || studentId <= 0 ||
      !Number.isInteger(batchId) || batchId <= 0
    ) {
      removeReceipt();
      return res.status(400).json({
        message: "Invalid student or batch ID."
      });
    }

    // SECURITY: Student can enroll only themselves.
if (studentId !== req.user.id) {
  removeReceipt();

  return res.status(403).json({
    message: "You cannot enroll another student."
  });
}

    const paymentQuery = `
      SELECT id FROM payment_settings
      WHERE payment_method = ? AND is_active = 1
    `;

    db.query(paymentQuery, [payment_method], (paymentErr, methods) => {

      if (paymentErr || methods.length === 0) {
        removeReceipt();
        return res.status(400).json({
          message: "Selected payment method is unavailable."
        });
      }

      const checkQuery = `
        SELECT cb.capacity,
          (SELECT COUNT(*)
           FROM course_enrollments ce
           WHERE ce.course_batch_id = cb.id
           AND ce.status IN ('Active', 'Pending Payment Verification')
          ) AS enrolled_count,
          (SELECT COUNT(*)
           FROM course_enrollments ce
           WHERE ce.course_batch_id = cb.id
           AND ce.student_id = ?
          ) AS already_enrolled
        FROM course_batches cb
        WHERE cb.id = ?
      `;

      db.query(checkQuery, [studentId, batchId], (err, results) => {

        if (err) {
          removeReceipt();
          return res.status(500).json({ message: "Database error" });
        }

        if (results.length === 0) {
          removeReceipt();
          return res.status(404).json({ message: "Batch not found." });
        }

        const batch = results[0];

        if (batch.already_enrolled > 0) {
          removeReceipt();
          return res.status(400).json({
            message: "You already have an enrollment request for this batch."
          });
        }

        if (batch.enrolled_count >= batch.capacity) {
          removeReceipt();
          return res.status(400).json({
            message: "Batch capacity is full!"
          });
        }

        const insertQuery = `
          INSERT INTO course_enrollments
          (student_id, course_batch_id, payment_method,
           transaction_id, payment_proof, status)
          VALUES (?, ?, ?, ?, ?, 'Pending Payment Verification')
        `;

        db.query(
          insertQuery,
          [
            studentId,
            batchId,
            payment_method,
            transaction_id.trim(),
            receipt.filename
          ],
          (insertErr, result) => {

            if (insertErr) {
              removeReceipt();
              console.error("Enrollment error:", insertErr);

              return res.status(500).json({
                message: "Failed to submit enrollment request."
              });
            }

            res.status(201).json({
              message: "Payment submitted! Waiting for Admin approval.",
              enrollment_id: result.insertId,
              status: "Pending Payment Verification"
            });
          }
        );
      });
    });
  });
});

app.get('/api/admin/pending-enrollments', (req, res) => {
  const query = `
    SELECT ce.*, u.name AS student_name, u.email AS student_email, 
           c.title AS course_title, cb.timing_days, cb.start_time, inst.name AS instructor_name
    FROM course_enrollments ce
    JOIN users u ON ce.student_id = u.id
    JOIN course_batches cb ON ce.course_batch_id = cb.id
    JOIN courses c ON cb.course_id = c.id
    JOIN users inst ON cb.instructor_id = inst.id
    WHERE ce.status = 'Pending Payment Verification'
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.put('/api/admin/verify-enrollment/:id', (req, res) => {
  const enrollmentId = req.params.id;
  const { status, rejection_reason } = req.body;
  const query = `UPDATE course_enrollments SET status = ?, rejection_reason = ? WHERE id = ?`;
  db.query(query, [status, rejection_reason || '', enrollmentId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: `Enrollment status updated to ${status} successfully!` });
  });
});

app.get('/api/student/enrolled-batches/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const query = `
    SELECT ce.*, cb.course_id AS course_id,
       cb.timing_days, cb.start_time, cb.end_time, cb.start_date,
           c.title AS course_title, c.description, c.thumbnail, c.category, c.level,
           u.name AS instructor_name
    FROM course_enrollments ce
    JOIN course_batches cb ON ce.course_batch_id = cb.id
    JOIN courses c ON cb.course_id = c.id
    JOIN users u ON cb.instructor_id = u.id
    WHERE ce.student_id = ?
  `;
  db.query(query, [studentId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.get('/api/instructor/batches/:instructorId', (req, res) => {
  const instructorId = Number(req.params.instructorId);
  const query = `
    SELECT 
      c.id AS course_id,
      c.title AS course_title,
      c.description,
      c.learning_objectives,
      c.duration,
      c.level,
      c.schedule,
      c.category,
      c.thumbnail,
      GROUP_CONCAT(DISTINCT cb.timing_days SEPARATOR ' | ') AS timing_days,
      GROUP_CONCAT(DISTINCT CONCAT(cb.start_time, ' - ', cb.end_time) SEPARATOR ' | ') AS start_time,
      GROUP_CONCAT(DISTINCT u_all.name SEPARATOR ', ') AS assigned_instructors,
      COALESCE(SUM(
        (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_batch_id = cb.id AND ce.status = 'Active')
      ), 0) AS active_students_count,
      MAX(cb.id) AS id
    FROM courses c
    JOIN course_batches cb ON cb.course_id = c.id
    LEFT JOIN batch_instructors bi ON bi.batch_id = cb.id
    LEFT JOIN users u_all ON u_all.id = bi.instructor_id OR u_all.id = cb.instructor_id
    WHERE cb.instructor_id = ? OR bi.instructor_id = ?
    GROUP BY c.id;
  `;
  db.query(query, [instructorId, instructorId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

app.get('/api/instructor/batch-students/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const query = `
    SELECT u.id, u.name, u.email, u.phone, ce.enrolled_at, ce.status
    FROM course_enrollments ce
    JOIN users u ON ce.student_id = u.id
    WHERE ce.course_batch_id = ? AND ce.status = 'Active'
  `;
  db.query(query, [batchId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});


// ================= ASSIGNMENTS & ATTENDANCE MODULES =================
// STUDENT - Get Assignments for Active Enrolled Batches
// STUDENT - Get Assignments with Instructor and Submission Status
app.get('/api/student/assignments/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      message: 'Invalid student ID'
    });
  }

  const query = `
    SELECT
      a.id,
      a.course_id,
      a.course_batch_id,
      a.title,
      a.instructions,
      a.issue_date,
      a.due_date,
      a.total_marks,

      c.title AS course_title,

      COALESCE(u.name, 'Instructor') AS instructor_name,

      s.id AS submission_id,
      COALESCE(s.status, 'Pending') AS status,
      s.marks_obtained,
      s.feedback

    FROM assignments a

    JOIN course_batches cb
      ON cb.id = a.course_batch_id

    JOIN courses c
      ON c.id = cb.course_id

    LEFT JOIN users u
      ON u.id = cb.instructor_id

    LEFT JOIN assignment_submissions s
      ON s.id = (
        SELECT MAX(s2.id)
        FROM assignment_submissions s2
        WHERE s2.assignment_id = a.id
          AND s2.student_id = ?
      )

    WHERE EXISTS (
      SELECT 1
      FROM course_enrollments ce
      WHERE ce.course_batch_id = a.course_batch_id
        AND ce.student_id = ?
        AND ce.status = 'Active'
    )

    ORDER BY a.due_date ASC, a.id DESC
  `;

  db.query(query, [studentId, studentId], (err, results) => {
    if (err) {
      console.error('Student assignments error:', err);

      return res.status(500).json({
        message: 'Failed to load student assignments'
      });
    }

    res.json(results);
  });
});
// TEACHER - Get Assigned Batches for Assignment Creation
app.get('/api/teacher/assignment-batches/:teacherId', (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: 'Invalid teacher ID' });
  }

  const query = `
    SELECT
      cb.id AS batch_id,
      cb.course_id,
      c.title AS course_title,
      cb.timing_days,
      cb.start_time,
      cb.end_time
    FROM course_batches cb
    JOIN courses c ON c.id = cb.course_id
    WHERE cb.instructor_id = ?
      AND c.status = 'Published'
    ORDER BY c.title, cb.id
  `;

  db.query(query, [teacherId], (err, results) => {
    if (err) {
      console.error('Assignment batches error:', err);
      return res.status(500).json({
        message: 'Failed to load assigned batches'
      });
    }

    res.json(results);
  });
});

app.get('/api/teacher/assignments/:teacherId', (req, res) => {
  const teacherId = req.params.teacherId;
  const query = `
    SELECT a.*, c.title AS course_title 
    FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE c.proposed_by = ? OR c.id IN (SELECT course_id FROM course_batches WHERE instructor_id = ?)
  `;
  db.query(query, [teacherId, teacherId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

// TEACHER - Create Assignment for Assigned Batch
app.post('/api/teacher/assignments', (req, res) => {
  const {
    course_batch_id,
    teacher_id,
    title,
    instructions,
    due_date,
    total_marks
  } = req.body;

  const batchId = Number(course_batch_id);
  const teacherId = Number(teacher_id);
  const marks = Number(total_marks);

  if (
    !Number.isInteger(batchId) || batchId <= 0 ||
    !Number.isInteger(teacherId) || teacherId <= 0 ||
    !title?.trim() ||
    !instructions?.trim() ||
    !due_date ||
    !Number.isInteger(marks) || marks <= 0
  ) {
    return res.status(400).json({
      message: 'Please provide valid assignment details.'
    });
  }

  // Verify that teacher is assigned to this batch
  const checkQuery = `
    SELECT cb.course_id
    FROM course_batches cb
    JOIN courses c ON c.id = cb.course_id
    WHERE cb.id = ?
      AND cb.instructor_id = ?
      AND c.status = 'Published'
  `;

  db.query(checkQuery, [batchId, teacherId], (checkErr, batches) => {
    if (checkErr) {
      return res.status(500).json({ message: 'Database error.' });
    }

    if (batches.length === 0) {
      return res.status(403).json({
        message: 'You are not assigned to this batch.'
      });
    }

    const courseId = batches[0].course_id;

    const insertQuery = `
      INSERT INTO assignments
      (course_id, course_batch_id, title, instructions,
       issue_date, due_date, total_marks)
      VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
    `;

    db.query(
      insertQuery,
      [courseId, batchId, title.trim(), instructions.trim(), due_date, marks],
      (insertErr, result) => {
        if (insertErr) {
          console.error('Assignment creation error:', insertErr);
          return res.status(500).json({
            message: 'Failed to create assignment.'
          });
        }

        res.status(201).json({
          message: 'Assignment created successfully!',
          assignmentId: result.insertId
        });
      }
    );
  });
});

 // TEACHER - View Student Assignment Submissions
app.get('/api/teacher/assignment-submissions/:assignmentId/:teacherId', (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const teacherId = Number(req.params.teacherId);

  if (!Number.isInteger(assignmentId) || assignmentId <= 0 ||
      !Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: 'Invalid IDs.' });
  }

  const query = `
    SELECT
      s.id AS submission_id,
      s.assignment_id,
      s.student_id,
      u.name AS student_name,
      u.email AS student_email,
      s.submission_text,
      s.file_url,
      s.submitted_at,
      s.marks_obtained,
      s.feedback,
      s.status
    FROM assignment_submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN course_batches cb ON cb.id = a.course_batch_id
    JOIN users u ON u.id = s.student_id
    WHERE s.assignment_id = ?
      AND cb.instructor_id = ?
      AND EXISTS (
        SELECT 1
        FROM course_enrollments ce
        WHERE ce.student_id = s.student_id
          AND ce.course_batch_id = a.course_batch_id
          AND ce.status = 'Active'
      )
    ORDER BY s.submitted_at DESC
  `;

  db.query(query, [assignmentId, teacherId], (err, results) => {
    if (err) {
      console.error('Teacher submissions error:', err);
      return res.status(500).json({
        message: 'Failed to load submissions.'
      });
    }

    res.json(results);
  });
});


/* ==============================================
   INSTRUCTOR — SAVE / UPDATE ASSIGNMENT GRADE
   ============================================== */

app.post(
  "/api/teacher/grade-submission",
  authenticateToken,
  authorizeRoles("instructor"),
  async (req, res) => {
    const assignmentId = Number(req.body?.assignment_id);
    const studentId = Number(req.body?.student_id);
    const teacherId = Number(req.user?.id);
    const marks = Number(req.body?.marks_obtained);
    const feedback = req.body?.feedback;

    if (
      !Number.isSafeInteger(assignmentId) ||
      assignmentId <= 0 ||
      !Number.isSafeInteger(studentId) ||
      studentId <= 0 ||
      !Number.isSafeInteger(teacherId) ||
      teacherId <= 0 ||
      req.body?.marks_obtained === null ||
      req.body?.marks_obtained === "" ||
      !Number.isFinite(marks) ||
      typeof feedback !== "string" ||
      feedback.length > 5000
    ) {
      return res.status(400).json({
        message: "Invalid grading information."
      });
    }

    // Never trust teacher_id supplied by frontend.
    if (
      req.body?.teacher_id !== undefined &&
      Number(req.body.teacher_id) !== teacherId
    ) {
      return res.status(403).json({
        message: "Instructor identity mismatch."
      });
    }

    try {
      const rows = await authQuery(
        `SELECT
           s.id AS submission_id,
           a.total_marks
         FROM assignment_submissions s
         JOIN assignments a
           ON a.id = s.assignment_id
         JOIN course_batches cb
           ON cb.id = a.course_batch_id
         WHERE s.assignment_id = ?
           AND s.student_id = ?
           AND (
             cb.instructor_id = ?
             OR EXISTS (
               SELECT 1
               FROM batch_instructors bi
               WHERE bi.batch_id = cb.id
                 AND bi.instructor_id = ?
             )
           )
           AND EXISTS (
             SELECT 1
             FROM course_enrollments ce
             WHERE ce.course_batch_id = a.course_batch_id
               AND ce.student_id = s.student_id
               AND ce.status = 'Active'
           )
         ORDER BY s.id DESC
         LIMIT 1`,
        [assignmentId, studentId, teacherId, teacherId]
      );

      if (!rows.length) {
        return res.status(404).json({
          message:
            "Submission not found or not assigned to this instructor."
        });
      }

      const submission = rows[0];
      const maximum = Number(submission.total_marks);

      if (
        !Number.isFinite(maximum) ||
        marks < 0 ||
        marks > maximum
      ) {
        return res.status(400).json({
          message: `Marks must be between 0 and ${maximum}.`
        });
      }

      const result = await authQuery(
        `UPDATE assignment_submissions
         SET marks_obtained = ?,
             feedback = ?,
             status = 'Graded'
         WHERE id = ?
           AND assignment_id = ?
           AND student_id = ?`,
        [
          marks,
          feedback.trim(),
          submission.submission_id,
          assignmentId,
          studentId
        ]
      );

      if (result.affectedRows !== 1) {
        return res.status(409).json({
          message: "Grade could not be saved."
        });
      }

      return res.json({
        message: "Grade saved successfully.",
        submission_id: submission.submission_id,
        marks_obtained: marks,
        feedback: feedback.trim(),
        status: "Graded"
      });

    } catch (error) {
      console.error("Assignment grading error:", error);

      return res.status(500).json({
        message: "Unable to save assignment grade."
      });
    }
  }
);


app.get('/api/admin/course-instructors/:courseId', (req, res) => {
  const courseId = req.params.courseId;
  const query = `
    SELECT DISTINCT bi.instructor_id 
    FROM batch_instructors bi
    JOIN course_batches cb ON cb.id = bi.batch_id
    WHERE cb.course_id = ?
    UNION
    SELECT DISTINCT instructor_id 
    FROM course_batches 
    WHERE course_id = ? AND instructor_id IS NOT NULL;
  `;
  db.query(query, [courseId, courseId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    const assignedIds = results.map(r => Number(r.instructor_id));
    res.json(assignedIds);
  });
});

// ADMIN - Save or Update Payment Settings
app.put('/api/admin/payment-settings', (req, res) => {
  const {
    payment_method,
    account_title,
    account_number,
    bank_name,
    iban,
    instructions,
    is_active
  } = req.body;

  const allowedMethods = ['Bank Transfer', 'JazzCash', 'Easypaisa'];

  if (
    !allowedMethods.includes(payment_method) ||
    !account_title?.trim() ||
    !account_number?.trim()
  ) {
    return res.status(400).json({
      message: 'Valid payment method, account title and account number are required.'
    });
  }

  const query = `
    INSERT INTO payment_settings
      (payment_method, account_title, account_number,
       bank_name, iban, instructions, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      account_title = VALUES(account_title),
      account_number = VALUES(account_number),
      bank_name = VALUES(bank_name),
      iban = VALUES(iban),
      instructions = VALUES(instructions),
      is_active = VALUES(is_active)
  `;

  db.query(
    query,
    [
      payment_method,
      account_title.trim(),
      account_number.trim(),
      bank_name || null,
      iban || null,
      instructions || null,
      is_active ? 1 : 0
    ],
    (err) => {
      if (err) {
        console.error('Payment settings error:', err);
        return res.status(500).json({ message: 'Failed to save payment settings.' });
      }

      res.json({ message: 'Payment settings saved successfully!' });
    }
  );
});

// ADMIN - Get All Payment Settings
app.get('/api/admin/payment-settings', (req, res) => {
  db.query(
    'SELECT * FROM payment_settings ORDER BY id',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});
// ================= SERVER PORT CONFIGURATION =================

app.get('/api/test-route', (req, res) => {
  res.json({ message: 'Correct backend is running!' });
});
// ADMIN - Get Successfully Enrolled Students of a Course
app.get('/api/admin/course-students/:courseId', (req, res) => {
  const courseId = Number(req.params.courseId);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({ message: 'Invalid course ID' });
  }

  const query = `
    SELECT
      ce.id AS enrollment_id,
      ce.student_id,
      u.name AS student_name,
      u.email AS student_email,
      ce.status,
      ce.enrolled_at,
      cb.id AS batch_id,
      cb.timing_days,
      cb.start_time,
      cb.end_time,
      inst.name AS instructor_name
    FROM course_enrollments ce
    JOIN users u ON ce.student_id = u.id
    JOIN course_batches cb ON ce.course_batch_id = cb.id
    JOIN users inst ON cb.instructor_id = inst.id
    WHERE cb.course_id = ?
      AND ce.status = 'Active'
    ORDER BY ce.enrolled_at DESC
  `;

  db.query(query, [courseId], (err, results) => {
    if (err) {
      console.error('Enrolled students error:', err);
      return res.status(500).json({
        message: 'Failed to load enrolled students'
      });
    }

    res.json(results);
  });
});

 // ADMIN - Get All Assignments
app.get('/api/admin/assignments', (req, res) => {
  const query = `
    SELECT
      a.id,
      a.course_id,
      a.course_batch_id,
      a.title,
      a.instructions,
      a.issue_date,
      a.due_date,
      a.total_marks,
      c.title AS course_title,
      cb.instructor_id,
      u.name AS instructor_name
    FROM assignments a
    JOIN courses c ON c.id = a.course_id
    LEFT JOIN course_batches cb
      ON cb.id = a.course_batch_id
    LEFT JOIN users u
      ON u.id = cb.instructor_id
    ORDER BY a.issue_date DESC, a.id DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Admin assignments error:', err);
      return res.status(500).json({
        message: 'Failed to load assignments'
      });
    }

    res.json(results);
  });
});


 // ADMIN - Get Assignment Submissions and Grading
app.get('/api/admin/assignment-submissions/:assignmentId', (req, res) => {
  const assignmentId = Number(req.params.assignmentId);

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({
      message: 'Invalid assignment ID'
    });
  }

  const query = `
    SELECT
      u.id AS student_id,
      u.name AS student_name,
      u.email AS student_email,
      s.id AS submission_id,
      s.submission_text,
      s.file_url,
      s.submitted_at,
      COALESCE(s.status, 'Not Submitted') AS status,
      s.marks_obtained,
      s.feedback
    FROM assignments a
    JOIN course_enrollments ce
      ON ce.course_batch_id = a.course_batch_id
      AND ce.status = 'Active'
    JOIN users u
      ON u.id = ce.student_id
    LEFT JOIN assignment_submissions s
      ON s.id = (
        SELECT s2.id
        FROM assignment_submissions s2
        WHERE s2.assignment_id = a.id
          AND s2.student_id = ce.student_id
        ORDER BY s2.submitted_at DESC, s2.id DESC
        LIMIT 1
      )
    WHERE a.id = ?
    ORDER BY u.name ASC
  `;

  db.query(query, [assignmentId], (err, results) => {
    if (err) {
      console.error('Admin submissions error:', err);
      return res.status(500).json({
        message: 'Failed to load assignment submissions'
      });
    }

    res.json(results);
  });
});

app.get('/api/teacher/class-schedules/:teacherId', (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: 'Invalid instructor ID' });
  }

  const query = `
    SELECT
      cs.*,
      c.title AS course_title
    FROM class_schedules cs
    JOIN courses c ON c.id = cs.course_id
    WHERE cs.instructor_id = ?
    ORDER BY cs.session_date DESC, cs.start_time DESC
  `;

  db.query(query, [teacherId], (err, results) => {
    if (err) {
      console.error('Class schedules error:', err);
      return res.status(500).json({
        message: 'Failed to load class schedules'
      });
    }

    res.json(results);
  });
});


app.post('/api/teacher/class-schedule', (req, res) => {
  const {
    course_id,
    course_batch_id,
    instructor_id,
    session_date,
    start_time,
    end_time,
    time_zone,
    meeting_link
  } = req.body;

  const courseId = Number(course_id);
  const batchId = Number(course_batch_id);
  const instructorId = Number(instructor_id);

  if (
    !Number.isInteger(courseId) || courseId <= 0 ||
    !Number.isInteger(batchId) || batchId <= 0 ||
    !Number.isInteger(instructorId) || instructorId <= 0 ||
    !session_date || !start_time || !end_time ||
    !meeting_link
  ) {
    return res.status(400).json({
      message: 'All required class details must be provided'
    });
  }

  if (start_time >= end_time) {
    return res.status(400).json({
      message: 'End time must be after start time'
    });
  }

  try {
    const url = new URL(meeting_link);
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return res.status(400).json({
      message: 'Enter a valid meeting URL'
    });
  }

  const checkQuery = `
    SELECT cb.id
    FROM course_batches cb
    WHERE cb.id = ?
      AND cb.course_id = ?
      AND (
        cb.instructor_id = ?
        OR EXISTS (
          SELECT 1
          FROM batch_instructors bi
          WHERE bi.batch_id = cb.id
            AND bi.instructor_id = ?
        )
      )
    LIMIT 1
  `;

  db.query(
    checkQuery,
    [batchId, courseId, instructorId, instructorId],
    (err, rows) => {
      if (err) {
        console.error('Batch verification error:', err);
        return res.status(500).json({
          message: 'Failed to verify instructor batch'
        });
      }

      if (rows.length === 0) {
        return res.status(403).json({
          message: 'Instructor is not assigned to this batch'
        });
      }

      const insertQuery = `
        INSERT INTO class_schedules
          (course_id, course_batch_id, instructor_id,
           session_date, start_time, end_time,
           time_zone, meeting_link, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled')
      `;

      db.query(
        insertQuery,
        [
          courseId,
          batchId,
          instructorId,
          session_date,
          start_time,
          end_time,
          time_zone || 'PKT',
          meeting_link
        ],
        (insertErr, result) => {
          if (insertErr) {
            console.error('Schedule class error:', insertErr);
            return res.status(500).json({
              message: 'Failed to schedule online class'
            });
          }

          res.status(201).json({
            message: 'Online class scheduled successfully',
            schedule_id: result.insertId
          });
        }
      );
    }
  );
});


app.put('/api/teacher/class-schedule/status/:scheduleId', (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  const instructorId = Number(req.body.instructor_id);
  const { status } = req.body;

  const allowedStatuses = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];

  if (
    !Number.isInteger(scheduleId) || scheduleId <= 0 ||
    !Number.isInteger(instructorId) || instructorId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    return res.status(400).json({
      message: 'Invalid schedule, instructor or status'
    });
  }

  const query = `
    UPDATE class_schedules
    SET status = ?
    WHERE id = ?
      AND instructor_id = ?
  `;

  db.query(query, [status, scheduleId, instructorId], (err, result) => {
    if (err) {
      console.error('Class status error:', err);
      return res.status(500).json({
        message: 'Failed to update class status'
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Class not found for this instructor'
      });
    }

    res.json({ message: 'Class status updated successfully' });
  });
});


// STUDENT - Get Online Classes for Enrolled Batches
app.get('/api/student/class-schedules/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      message: 'Invalid student ID'
    });
  }

  const query = `
    SELECT
      cs.id,
      cs.course_id,
      cs.course_batch_id,
      c.title AS course_title,
      u.name AS instructor_name,
      cs.session_date,
      cs.start_time,
      cs.end_time,
      cs.time_zone,
      cs.meeting_link,
      cs.status
    FROM class_schedules cs
    JOIN courses c
      ON c.id = cs.course_id
    JOIN users u
      ON u.id = cs.instructor_id
    WHERE EXISTS (
      SELECT 1
      FROM course_enrollments ce
      WHERE ce.course_batch_id = cs.course_batch_id
        AND ce.student_id = ?
        AND ce.status = 'Active'
    )
    ORDER BY cs.session_date ASC, cs.start_time ASC
  `;

  db.query(query, [studentId], (err, results) => {
    if (err) {
      console.error('Student class schedules error:', err);
      return res.status(500).json({
        message: 'Failed to load student online classes'
      });
    }

    res.json(results);
  });
});


 // ADMIN - Get All Online Classes
app.get('/api/admin/class-schedules', (req, res) => {
  const query = `
    SELECT
      cs.id,
      cs.course_id,
      cs.course_batch_id,
      c.title AS course_title,
      cs.instructor_id,
      u.name AS instructor_name,
      cs.session_date,
      cs.start_time,
      cs.end_time,
      cs.time_zone,
      cs.meeting_link,
      cs.status,
      (
        SELECT COUNT(DISTINCT ce.student_id)
        FROM course_enrollments ce
        WHERE ce.course_batch_id = cs.course_batch_id
          AND ce.status = 'Active'
      ) AS enrolled_students_count
    FROM class_schedules cs
    JOIN courses c ON c.id = cs.course_id
    JOIN users u ON u.id = cs.instructor_id
    ORDER BY cs.session_date DESC, cs.start_time DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Admin class schedules error:', err);
      return res.status(500).json({
        message: 'Failed to load online classes'
      });
    }

    res.json(results);
  });
});


// ADMIN - Get Active Students of a Specific Class Batch
app.get('/api/admin/class-batch-students/:batchId', (req, res) => {
  const batchId = Number(req.params.batchId);

  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({
      message: 'Invalid batch ID'
    });
  }

  const query = `
    SELECT DISTINCT
      u.id,
      u.name,
      u.email
    FROM course_enrollments ce
    JOIN users u ON u.id = ce.student_id
    WHERE ce.course_batch_id = ?
      AND ce.status = 'Active'
    ORDER BY u.name ASC
  `;

  db.query(query, [batchId], (err, results) => {
    if (err) {
      console.error('Admin batch students error:', err);
      return res.status(500).json({
        message: 'Failed to load batch students'
      });
    }

    res.json(results);
  });
});

// TEACHER - GET SAVED ATTENDANCE
app.get("/api/teacher/attendance/:sessionId", (req, res) => {
  const sessionId = Number(req.params.sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({
      message: "Invalid session ID",
    });
  }

  const query = `
    SELECT student_id, status
    FROM attendance_records
    WHERE class_session_id = ?
  `;

  db.query(query, [sessionId], (err, results) => {
    if (err) {
      console.error("Fetch attendance error:", err);
      return res.status(500).json({
        message: "Failed to fetch attendance",
      });
    }

    res.json(results);
  });
});


// TEACHER - SAVE / UPDATE ATTENDANCE
app.post("/api/teacher/attendance", (req, res) => {
  const {
    class_session_id,
    teacher_id,
    attendance_data,
  } = req.body;

  const sessionId = Number(class_session_id);
  const teacherId = Number(teacher_id);

  if (
    !Number.isInteger(sessionId) ||
    !Number.isInteger(teacherId) ||
    !Array.isArray(attendance_data) ||
    attendance_data.length === 0
  ) {
    return res.status(400).json({
      message: "Invalid attendance data",
    });
  }

  const allowedStatuses = [
    "Present",
    "Absent",
    "Late",
    "Excused",
  ];

  const studentIds = attendance_data.map((record) =>
    Number(record.student_id)
  );

  if (
    studentIds.some(
      (id) => !Number.isInteger(id) || id <= 0
    ) ||
    new Set(studentIds).size !== studentIds.length ||
    attendance_data.some(
      (record) => !allowedStatuses.includes(record.status)
    )
  ) {
    return res.status(400).json({
      message: "Invalid student IDs or attendance statuses",
    });
  }

  // Verify that this session belongs to the instructor
  const sessionQuery = `
    SELECT id, course_batch_id, status
    FROM class_schedules
    WHERE id = ? AND instructor_id = ?
  `;

  db.query(
    sessionQuery,
    [sessionId, teacherId],
    (sessionErr, sessions) => {
      if (sessionErr) {
        console.error(sessionErr);
        return res.status(500).json({
          message: "Failed to verify class session",
        });
      }

      if (sessions.length === 0) {
        return res.status(403).json({
          message: "Class session not assigned to this instructor",
        });
      }

      const session = sessions[0];

      if (session.status === "Cancelled") {
        return res.status(400).json({
          message: "Cannot mark attendance for a cancelled class",
        });
      }

      if (!session.course_batch_id) {
        return res.status(400).json({
          message: "Class has no assigned batch",
        });
      }

      // Verify students belong to the selected batch
      const placeholders = studentIds.map(() => "?").join(",");

      const enrollmentQuery = `
        SELECT DISTINCT student_id
        FROM course_enrollments
        WHERE course_batch_id = ?
          AND status = 'Active'
          AND student_id IN (${placeholders})
      `;

      db.query(
        enrollmentQuery,
        [session.course_batch_id, ...studentIds],
        (enrollmentErr, enrollments) => {
          if (enrollmentErr) {
            console.error(enrollmentErr);
            return res.status(500).json({
              message: "Failed to verify enrolled students",
            });
          }

          const enrolledIds = new Set(
            enrollments.map((row) => Number(row.student_id))
          );

          if (
            studentIds.some((id) => !enrolledIds.has(id))
          ) {
            return res.status(400).json({
              message: "Some students are not enrolled in this batch",
            });
          }

          // Save or update existing attendance
          const values = attendance_data.map((record) => [
            sessionId,
            Number(record.student_id),
            record.status,
            teacherId,
          ]);

          const saveQuery = `
            INSERT INTO attendance_records
              (class_session_id, student_id, status, marked_by)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              marked_by = VALUES(marked_by),
              updated_at = CURRENT_TIMESTAMP
          `;

          db.query(saveQuery, [values], (saveErr) => {
            if (saveErr) {
              console.error("Save attendance error:", saveErr);
              return res.status(500).json({
                message: "Failed to save attendance",
              });
            }

            res.json({
              message: "Attendance saved successfully",
            });
          });
        }
      );
    }
  );
});


 // STUDENT - GET COURSE-WISE ATTENDANCE
app.get("/api/student/attendance/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      message: "Invalid student ID"
    });
  }

  const query = `
    SELECT
      c.id AS course_id,
      c.title AS course,
      cs.course_batch_id AS batch_id,
      COUNT(ar.id) AS total,
      SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN ar.status = 'Excused' THEN 1 ELSE 0 END) AS excused
    FROM attendance_records ar
    JOIN class_schedules cs
      ON cs.id = ar.class_session_id
    JOIN courses c
      ON c.id = cs.course_id
    WHERE ar.student_id = ?
      AND EXISTS (
        SELECT 1
        FROM course_enrollments ce
        WHERE ce.student_id = ar.student_id
          AND ce.course_batch_id = cs.course_batch_id
          AND ce.status = 'Active'
      )
    GROUP BY c.id, c.title, cs.course_batch_id
    ORDER BY c.title ASC
  `;

  db.query(query, [studentId], (err, results) => {
    if (err) {
      console.error("Student attendance error:", err);
      return res.status(500).json({
        message: "Failed to fetch student attendance"
      });
    }

    const courses = results.map((row) => {
      const total = Number(row.total);
      const present = Number(row.present);
      const absent = Number(row.absent);
      const late = Number(row.late);
      const excused = Number(row.excused);

      return {
        course: row.course,
        code: `Course ${row.course_id} - Batch ${row.batch_id}`,
        total,
        present,
        absent,
        late,
        excused,
        percentage: total > 0
          ? Number(((present / total) * 100).toFixed(1))
          : 0
      };
    });

    const totalClasses = courses.reduce(
      (sum, course) => sum + course.total, 0
    );

    const presentCount = courses.reduce(
      (sum, course) => sum + course.present, 0
    );

    const absentCount = courses.reduce(
      (sum, course) => sum + course.absent, 0
    );

    const stats = {
      totalClasses,
      presentCount,
      absentCount,
      attendancePercentage: totalClasses > 0
        ? Number(((presentCount / totalClasses) * 100).toFixed(1))
        : 0
    };

    res.json({ courses, stats });
  });
});

// ADMIN - GET ALL ATTENDANCE RECORDS
app.get("/api/admin/attendance", (req, res) => {
  const query = `
    SELECT
      ar.id,
      ar.student_id AS studentId,
      u.name AS studentName,
      u.email AS studentEmail,
      c.title AS course,
      cs.course_batch_id AS batchId,
      DATE_FORMAT(cs.session_date, '%Y-%m-%d') AS date,
      cs.start_time AS startTime,
      cs.end_time AS endTime,
      ar.status,
      ar.marked_by AS instructorId,
      instructor.name AS instructorName
    FROM attendance_records ar
    JOIN class_schedules cs
      ON cs.id = ar.class_session_id
    JOIN courses c
      ON c.id = cs.course_id
    JOIN users u
      ON u.id = ar.student_id
    LEFT JOIN users instructor
      ON instructor.id = ar.marked_by
    ORDER BY cs.session_date DESC, ar.id DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Admin attendance error:", err);
      return res.status(500).json({
        message: "Failed to fetch attendance records"
      });
    }

    res.json(results);
  });
});

// GET COURSES ASSIGNED TO INSTRUCTOR
app.get('/api/teacher/courses/:teacherId', (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({
      message: 'Invalid instructor ID'
    });
  }

  const query = `
    SELECT DISTINCT
      c.id,
      c.title
    FROM courses c
    JOIN course_batches cb ON cb.course_id = c.id
    LEFT JOIN batch_instructors bi ON bi.batch_id = cb.id
    WHERE
      (cb.instructor_id = ? OR bi.instructor_id = ?)
      AND c.status = 'Published'
    ORDER BY c.title ASC
  `;

  db.query(query, [teacherId, teacherId], (err, results) => {
    if (err) {
      console.error('Instructor courses error:', err);
      return res.status(500).json({
        message: 'Failed to fetch instructor courses'
      });
    }

    res.json(results);
  });
});


// ========== INSTRUCTOR - CREATE EXAM ==========

app.post('/api/teacher/exams', (req, res) => {
  const {
    course_id,
    teacher_id,
    title,
    exam_type,
    total_marks,
    exam_date
  } = req.body;

  const courseId = Number(course_id);
  const teacherId = Number(teacher_id);
  const marks = Number(total_marks);

  if (
    !Number.isInteger(courseId) || courseId <= 0 ||
    !Number.isInteger(teacherId) || teacherId <= 0 ||
    !title?.trim() ||
    !['Quiz', 'Midterm', 'Final'].includes(exam_type) ||
    !Number.isInteger(marks) || marks <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(exam_date || '')
  ) {
    return res.status(400).json({
      message: 'Please provide valid exam details.'
    });
  }

  // Find instructor's assigned batch for this course
  const checkQuery = `
    SELECT cb.id AS batch_id
    FROM course_batches cb
    JOIN courses c ON c.id = cb.course_id
    WHERE cb.course_id = ?
      AND cb.instructor_id = ?
      AND c.status = 'Published'
    ORDER BY cb.id ASC
  `;

  db.query(checkQuery, [courseId, teacherId], (err, batches) => {
    if (err) {
      console.error('Exam batch check error:', err);
      return res.status(500).json({
        message: 'Database error.'
      });
    }

    if (batches.length === 0) {
      return res.status(403).json({
        message: 'You are not assigned to this course.'
      });
    }

    // Avoid assigning the exam to an arbitrary batch
    if (batches.length > 1) {
      return res.status(400).json({
        message: 'Multiple batches found. Please select a batch before creating an exam.'
      });
    }

    const batchId = batches[0].batch_id;

    const insertQuery = `
      INSERT INTO exams
      (
        course_id,
        course_batch_id,
        teacher_id,
        title,
        exam_type,
        total_marks,
        exam_date,
        exam_mode,
        attempt_limit,
        result_published
      )
      
VALUES (?, ?, ?, ?, ?, ?, ?, 'Online', 1, 0)

    `;

    db.query(
      insertQuery,
      [
        courseId,
        batchId,
        teacherId,
        title.trim(),
        exam_type,
        marks,
        exam_date
      ],
      (insertErr, result) => {
        if (insertErr) {
          console.error('Create exam error:', insertErr);
          return res.status(500).json({
            message: 'Failed to create exam.'
          });
        }

        res.status(201).json({
          message: 'Exam created successfully!',
          exam_id: result.insertId,
          course_batch_id: batchId
        });
      }
    );
  });
});

// ========== INSTRUCTOR - GET CREATED EXAMS ==========

app.get('/api/teacher/exams/:teacherId', (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const page = Number(req.query.page || 1);
  const limit = Math.min(50, Number(req.query.limit || 10));

  if (
    !Number.isSafeInteger(teacherId) || teacherId <= 0 ||
    !Number.isSafeInteger(page) || page < 1 ||
    !Number.isSafeInteger(limit) || limit < 1
  ) {
    return res.status(400).json({
      message: 'Invalid request parameters.'
    });
  }

  // TODO: Add JWT authentication and instructor authorization.
  const offset = (page - 1) * limit;

  const query = `
    SELECT
      e.id,
      e.course_id,
      e.course_batch_id,
      e.teacher_id,
      e.title,
      e.exam_type,
      e.total_marks,
      DATE_FORMAT(e.exam_date, '%Y-%m-%d') AS exam_date,
      e.result_published,
      e.exam_status,
      e.exam_mode,
      e.duration_minutes,
      e.start_time,
      e.attempt_limit,
      c.title AS course_title
    FROM exams e
    JOIN courses c ON c.id = e.course_id
    JOIN course_batches cb ON cb.id = e.course_batch_id
    WHERE e.teacher_id = ?
      AND cb.instructor_id = ?
    ORDER BY e.exam_date DESC, e.id DESC
    LIMIT ? OFFSET ?
  `;

  db.query(
    query,
    [teacherId, teacherId, limit, offset],
    (err, results) => {
      if (err) {
        console.error('Get instructor exams error:', err);
        return res.status(500).json({
          message: 'Failed to fetch exams.'
        });
      }

      // Current InstructorExams.tsx expects an array.
      res.json(results);
    }
  );
});


// ========== INSTRUCTOR - GET EXAM STUDENTS & RESULTS ==========

app.get('/api/teacher/exam-results/:examId/:teacherId', (req, res) => {
  const examId = Number(req.params.examId);
  const teacherId = Number(req.params.teacherId);

  if (
    !Number.isSafeInteger(examId) || examId <= 0 ||
    !Number.isSafeInteger(teacherId) || teacherId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid exam or instructor ID.'
    });
  }

  // TODO: Enforce JWT authentication and verify instructor identity.

  const checkQuery = `
    SELECT e.id, e.course_batch_id
    FROM exams e
    JOIN course_batches cb ON cb.id = e.course_batch_id
    WHERE e.id = ?
      AND e.teacher_id = ?
      AND cb.instructor_id = ?
    LIMIT 1
  `;

  db.query(checkQuery, [examId, teacherId, teacherId], (checkErr, exams) => {
    if (checkErr) {
      console.error('Exam verification error:', checkErr);
      return res.status(500).json({
        message: 'Database error.'
      });
    }

    if (!exams.length) {
      return res.status(403).json({
        message: 'Exam not found or instructor not authorized.'
      });
    }

    const batchId = exams[0].course_batch_id;

    const query = `
      SELECT
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,

        er.id AS result_id,
        er.marks_obtained,
        er.grade,
        er.feedback,

        COALESCE(er.status, 'Pending') AS status

      FROM course_enrollments ce

      JOIN users u
        ON u.id = ce.student_id

      LEFT JOIN exam_results er
        ON er.id = (
          SELECT MAX(er2.id)
          FROM exam_results er2
          WHERE er2.exam_id = ?
            AND er2.student_id = u.id
        )

      WHERE ce.course_batch_id = ?
        AND ce.status = 'Active'
        AND u.role = 'student'

      ORDER BY u.name ASC
    `;

    db.query(query, [examId, batchId], (err, results) => {
      if (err) {
        console.error('Exam students error:', err);

        return res.status(500).json({
          message: 'Failed to load exam students.'
        });
      }

      res.json(results);
    });
  });
});

// ========== INSTRUCTOR - ADD EXAM QUESTION ==========

app.post('/api/teacher/exam-questions', (req, res) => {
  const {
    exam_id,
    teacher_id,
    question_text,
    question_type,
    options,
    correct_answer,
    marks
  } = req.body;

  const examId = Number(exam_id);
  const teacherId = Number(teacher_id);
  const questionMarks = Number(marks);

  if (
    !Number.isInteger(examId) || examId <= 0 ||
    !Number.isInteger(teacherId) || teacherId <= 0 ||
    typeof question_text !== 'string' ||
    !question_text.trim() ||
    !['MCQ', 'TrueFalse', 'ShortAnswer'].includes(question_type) ||
    !Number.isFinite(questionMarks) || questionMarks <= 0
  ) {
    return res.status(400).json({
      message: 'Please provide valid question details.'
    });
  }

  if (
  question_type === 'MCQ' &&
  (
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every(o => typeof o === 'string' && o.trim()) ||
    !['0', '1', '2', '3'].includes(String(correct_answer))
  )
) {
  return res.status(400).json({
    message: 'MCQ requires 4 options and a valid correct answer.'
  });
}

  if (question_type === 'TrueFalse' &&
      !['True', 'False'].includes(correct_answer)) {
    return res.status(400).json({
      message: 'Please select True or False.'
    });
  }

  // Verify instructor ownership and check marks
  const checkQuery = `
    SELECT e.id, e.total_marks, e.result_published,
           COALESCE(SUM(q.marks), 0) AS used_marks
    FROM exams e
    JOIN course_batches cb ON cb.id = e.course_batch_id
    LEFT JOIN exam_questions q ON q.exam_id = e.id
    WHERE e.id = ?
      AND e.teacher_id = ?
      AND cb.instructor_id = ?
    GROUP BY e.id, e.total_marks, e.result_published
  `;

  db.query(checkQuery, [examId, teacherId, teacherId], (err, exams) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error.' });
    }

    if (!exams.length) {
      return res.status(403).json({
        message: 'Exam not found or instructor not assigned.'
      });
    }

    const exam = exams[0];

    if (exam.result_published) {
      return res.status(400).json({
        message: 'Cannot modify questions after results are published.'
      });
    }

    if (Number(exam.used_marks) + questionMarks > Number(exam.total_marks)) {
      return res.status(400).json({
        message: 'Question marks exceed total exam marks.'
      });
    }

    const insertQuery = `
      INSERT INTO exam_questions
      (exam_id, question_text, question_type,
       options, correct_answer, marks)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [
        examId,
        question_text.trim(),
        question_type,
        question_type === 'MCQ' ? JSON.stringify(options) : null,
        question_type === 'ShortAnswer'
          ? (correct_answer || null)
          : correct_answer,
        questionMarks
      ],
      (insertErr, result) => {
        if (insertErr) {
          console.error(insertErr);
          return res.status(500).json({
            message: 'Failed to save question.'
          });
        }

        res.status(201).json({
          message: 'Question added successfully!',
          question_id: result.insertId
        });
      }
    );
  });
});

// ========== INSTRUCTOR - GET EXAM QUESTIONS ==========

app.get('/api/teacher/exam-questions/:examId/:teacherId', (req, res) => {
  const examId = Number(req.params.examId);
  const teacherId = Number(req.params.teacherId);

  if (
    !Number.isInteger(examId) || examId <= 0 ||
    !Number.isInteger(teacherId) || teacherId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid exam or instructor ID.'
    });
  }

  const query = `
    SELECT
      q.id,
      q.exam_id,
      q.question_text,
      q.question_type,
      q.options,
      q.correct_answer,
      q.marks
    FROM exam_questions q
    JOIN exams e ON e.id = q.exam_id
    JOIN course_batches cb ON cb.id = e.course_batch_id
    WHERE q.exam_id = ?
      AND e.teacher_id = ?
      AND cb.instructor_id = ?
    ORDER BY q.id ASC
    LIMIT 100
  `;

  db.query(query, [examId, teacherId, teacherId], (err, results) => {
    if (err) {
      console.error('Question fetch error:', err);
      return res.status(500).json({
        message: 'Failed to fetch questions.'
      });
    }

    res.json(results);
  });
});

// ========== INSTRUCTOR - UPDATE EXAM SETTINGS ==========

app.put('/api/teacher/exams/:examId/settings', (req, res) => {
  const examId = Number(req.params.examId);
  const teacherId = Number(req.body.teacher_id);

  const {
    exam_mode,
    duration_minutes,
    start_time,
    attempt_limit
  } = req.body;

  const duration = Number(duration_minutes);
  const attempts = Number(attempt_limit);

  if (
    !Number.isSafeInteger(examId) || examId <= 0 ||
    !Number.isSafeInteger(teacherId) || teacherId <= 0 ||
    exam_mode !== 'Online' ||

    !Number.isInteger(attempts) || attempts < 1 ||
    attempts > 10 ||
    (exam_mode === 'Online' &&
      (!Number.isInteger(duration) || duration < 1 ||
       duration > 480 ||
       !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time || '')))
  ) {
    return res.status(400).json({
      message: 'Invalid exam settings.'
    });
  }

  const query = `
    UPDATE exams e
    JOIN course_batches cb
      ON cb.id = e.course_batch_id
    SET
      e.exam_mode = ?,
      e.duration_minutes = ?,
      e.start_time = ?,
      e.attempt_limit = ?
    WHERE e.id = ?
      AND e.teacher_id = ?
      AND cb.instructor_id = ?
      AND e.exam_status = 'Draft'
      AND NOT EXISTS (
        SELECT 1 FROM exam_attempts a
        WHERE a.exam_id = e.id
      )
  `;

  db.query(
    query,
    [
      exam_mode,
      exam_mode === 'Online' ? duration : null,
      exam_mode === 'Online' ? start_time : null,
      attempts,
      examId,
      teacherId,
      teacherId
    ],
    (err, result) => {
      if (err) {
        console.error('Exam settings error:', err);
        return res.status(500).json({
          message: 'Failed to update exam settings.'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(409).json({
          message: 'Exam not found, already published, or attempts exist.'
        });
      }

      res.json({
        message: 'Exam settings updated successfully!'
      });
    }
  );
});

// ========== INSTRUCTOR - PUBLISH EXAM ==========

app.put('/api/teacher/exams/:examId/publish', (req, res) => {
  const examId = Number(req.params.examId);
  const teacherId = Number(req.body.teacher_id);

  if (
    !Number.isSafeInteger(examId) || examId <= 0 ||
    !Number.isSafeInteger(teacherId) || teacherId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid exam or instructor ID.'
    });
  }

  const checkQuery = `
    SELECT
      e.id,
      e.total_marks,
      e.exam_status,
      e.exam_mode,
      e.duration_minutes,
      e.start_time,
      e.attempt_limit,
      e.exam_date,
      COUNT(q.id) AS question_count,
      COALESCE(SUM(q.marks), 0) AS allocated_marks,
      (TIMESTAMP(e.exam_date, e.start_time) > NOW())
        AS future_schedule
    FROM exams e
    JOIN course_batches cb
      ON cb.id = e.course_batch_id
    LEFT JOIN exam_questions q
      ON q.exam_id = e.id
    WHERE e.id = ?
      AND e.teacher_id = ?
      AND cb.instructor_id = ?
    GROUP BY
      e.id, e.total_marks, e.exam_status,
      e.exam_mode, e.duration_minutes,
      e.start_time, e.attempt_limit, e.exam_date
  `;

  db.query(checkQuery, [examId, teacherId, teacherId], (err, rows) => {
    if (err) {
      console.error('Publish validation error:', err);
      return res.status(500).json({
        message: 'Database error.'
      });
    }

    if (!rows.length) {
      return res.status(403).json({
        message: 'Exam not found or instructor not assigned.'
      });
    }

    const exam = rows[0];

    if (exam.exam_status !== 'Draft') {
      return res.status(400).json({
        message: 'Exam is already published.'
      });
    }

    if (Number(exam.question_count) === 0) {
      return res.status(400).json({
        message: 'Add questions before publishing.'
      });
    }

    if (
      Math.abs(
        Number(exam.allocated_marks) -
        Number(exam.total_marks)
      ) > 0.001
    ) {
      return res.status(400).json({
        message: 'Question marks must equal total exam marks.'
      });
    }

    if (exam.exam_mode === 'Online') {
      if (
        !exam.duration_minutes ||
        !exam.start_time ||
        Number(exam.attempt_limit) < 1
      ) {
        return res.status(400).json({
          message: 'Complete online exam settings first.'
        });
      }

      if (!Number(exam.future_schedule)) {
        return res.status(400).json({
          message: 'Online exam start date/time must be in the future.'
        });
      }
    }
    
    const updateQuery = `
      UPDATE exams
      SET exam_status = 'Published'
      WHERE id = ?
        AND teacher_id = ?
        AND exam_status = 'Draft'
    `;

    db.query(updateQuery, [examId, teacherId], (updateErr, result) => {
      if (updateErr) {
        return res.status(500).json({
          message: 'Failed to publish exam.'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(409).json({
          message: 'Exam status changed. Refresh and try again.'
        });
      }

      res.json({
        message: 'Exam published successfully!',
        exam_status: 'Published'
      });
    });
  });
});
// ========== STUDENT EXAM MODULE ==========


/* =====================================================
   STUDENT EXAMS — ACTIVE ENROLLED BATCHES
   Supports:
   - Original exam schedules
   - Individual student extensions
   - Retake permissions
   - Upcoming / Results filters
   - Pagination
   - Published results and instructor feedback
   ===================================================== */

app.get('/api/student/exams/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);
  const page = Number(req.query.page || 1);
  const limit = Math.min(50, Number(req.query.limit || 10));
  const filter = req.query.filter || 'all';

  if (
    !Number.isSafeInteger(studentId) ||
    studentId <= 0 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !['all', 'upcoming', 'results'].includes(filter)
  ) {
    return res.status(400).json({
      message: 'Invalid request parameters.'
    });
  }

  // SECURITY:
  // Add JWT authentication before production.
  // Verify authenticated user is this student.

  const offset = (page - 1) * limit;

  /* ========== FILTER CONDITIONS ========== */

  let condition = '';

  if (filter === 'upcoming') {
    condition = `
      AND (
        COALESCE(
          x.end_at,
          DATE_ADD(
            TIMESTAMP(e.exam_date, e.start_time),
            INTERVAL e.duration_minutes MINUTE
          )
        ) > NOW()
      )
      AND e.result_published = 0
    `;
  }

  if (filter === 'results') {
    condition = `
      AND e.result_published = 1
      AND er.status = 'Graded'
    `;
  }

  /* ========== COMMON JOIN QUERY ========== */

  const fromQuery = `
    FROM exams e

    JOIN course_batches cb
      ON cb.id = e.course_batch_id

    JOIN courses c
      ON c.id = cb.course_id

    JOIN users i
      ON i.id = cb.instructor_id

    JOIN course_enrollments ce
      ON ce.course_batch_id = cb.id
     AND ce.student_id = ?
     AND ce.status = 'Active'

    /* Individual student extension */
    LEFT JOIN student_exam_extensions x
      ON x.exam_id = e.id
     AND x.student_id = ce.student_id

    /* Latest result for this student and exam */
    LEFT JOIN exam_results er
      ON er.id = (
        SELECT MAX(er2.id)
        FROM exam_results er2
        WHERE er2.exam_id = e.id
          AND er2.student_id = ce.student_id
      )

    WHERE c.status = 'Published'
      AND e.exam_status = 'Published'

    ${condition}
  `;

  /* ========== COUNT EXAMS ========== */

  const countQuery = `
    SELECT COUNT(*) AS total
    ${fromQuery}
  `;

  db.query(countQuery, [studentId], (countErr, countRows) => {
    if (countErr) {
      console.error('Student exam count error:', countErr);

      return res.status(500).json({
        message: 'Failed to count student exams.'
      });
    }

    /* ========== GET EXAMS ========== */

    const query = `
      SELECT
        e.id,
        e.title,
        e.exam_type,

        /* Effective date: extension or original */
        DATE_FORMAT(
          COALESCE(
            DATE(x.start_at),
            e.exam_date
          ),
          '%Y-%m-%d'
        ) AS exam_date,

        e.total_marks,
        e.exam_mode,
        e.result_published,
        e.exam_status,

        /* Effective opening time */
        CASE
          WHEN x.id IS NOT NULL
          THEN DATE_FORMAT(
            x.start_at,
            '%H:%i:%s'
          )
          ELSE TIME_FORMAT(
            e.start_time,
            '%H:%i:%s'
          )
        END AS exam_start_time,

        /* Effective duration */
        COALESCE(
          x.duration_minutes,
          e.duration_minutes
        ) AS duration_minutes,

        /* Original attempts + granted attempts */
        (
          e.attempt_limit +
          COALESCE(x.extra_attempts, 0)
        ) AS attempt_limit,

        /* Individual extension details */
        x.id AS extension_id,

        DATE_FORMAT(
          x.start_at,
          '%Y-%m-%dT%H:%i:%s'
        ) AS extension_start_at,

        DATE_FORMAT(
          x.end_at,
          '%Y-%m-%dT%H:%i:%s'
        ) AS extension_end_at,

        COALESCE(
          x.extra_attempts,
          0
        ) AS extra_attempts,

        /* Course and batch information */
        c.title AS course_title,

        cb.id AS course_batch_id,
        cb.timing_days,

        cb.start_time AS batch_start_time,
        cb.end_time AS batch_end_time,

        i.name AS instructor_name,

        /* Published marks */
        CASE
          WHEN e.result_published = 1
           AND er.status = 'Graded'
          THEN er.marks_obtained
          ELSE NULL
        END AS marks_obtained,

        /* Published grade */
        CASE
          WHEN e.result_published = 1
           AND er.status = 'Graded'
          THEN er.grade
          ELSE NULL
        END AS grade,

        /* Instructor feedback */
        CASE
          WHEN e.result_published = 1
           AND er.status = 'Graded'
          THEN er.feedback
          ELSE NULL
        END AS feedback,

        /* Result status */
        CASE
          WHEN e.result_published = 1
           AND er.status = 'Graded'
          THEN 'Graded'
          ELSE 'Pending'
        END AS result_status

      ${fromQuery}

      ORDER BY
        COALESCE(
          x.start_at,
          TIMESTAMP(e.exam_date, e.start_time)
        ) DESC,
        e.id DESC

      LIMIT ? OFFSET ?
    `;

    db.query(
      query,
      [studentId, limit, offset],
      (err, results) => {
        if (err) {
          console.error('Student exams loading error:', err);

          return res.status(500).json({
            message: 'Failed to load student exams.'
          });
        }

        const total = Number(countRows[0]?.total || 0);

        return res.json({
          exams: results,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(
              1,
              Math.ceil(total / limit)
            )
          }
        });
      }
    );
  });
});

// ========== STUDENT - GET EXAM ATTEMPT QUESTIONS ==========

app.get('/api/student/exam-attempts/:attemptId', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const studentId = Number(req.query.student_id);

  if (
    !Number.isSafeInteger(attemptId) || attemptId <= 0 ||
    !Number.isSafeInteger(studentId) || studentId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid attempt or student ID.'
    });
  }

  const attemptQuery = `
    SELECT
      a.id,
      a.exam_id,
      a.attempt_number,
      a.status,
      UNIX_TIMESTAMP(a.expires_at) AS expires_at_unix,
      UNIX_TIMESTAMP() AS server_now_unix,
      e.title AS exam_title,
      e.total_marks,
      e.duration_minutes,
      c.title AS course_title
    FROM exam_attempts a
    JOIN exams e ON e.id = a.exam_id
    JOIN course_batches cb ON cb.id = e.course_batch_id
    JOIN courses c ON c.id = cb.course_id
    JOIN course_enrollments ce
      ON ce.course_batch_id = cb.id
      AND ce.student_id = a.student_id
      AND ce.status = 'Active'
    WHERE a.id = ?
      AND a.student_id = ?
      AND e.exam_status = 'Published'
      AND e.exam_mode = 'Online'
    LIMIT 1
  `;

  db.query(attemptQuery, [attemptId, studentId], (err, attempts) => {
    if (err) {
      console.error('Get exam attempt error:', err);
      return res.status(500).json({
        message: 'Failed to load exam attempt.'
      });
    }

    if (!attempts.length) {
      return res.status(403).json({
        message: 'Attempt not found or access denied.'
      });
    }

    const attempt = attempts[0];

    if (attempt.status !== 'InProgress') {
      return res.status(409).json({
        message: 'This attempt is already submitted.',
        status: attempt.status
      });
    }

    if (
      Number(attempt.server_now_unix) >=
      Number(attempt.expires_at_unix)
    ) {
      return res.status(409).json({
        message: 'Exam time has expired. Submission is required.',
        expired: true
      });
    }

    const questionsQuery = `
      SELECT
        q.id,
        q.question_text,
        q.question_type,
        q.options,
        q.marks,
        ans.answer_text AS saved_answer
      FROM exam_questions q
      LEFT JOIN exam_answers ans
        ON ans.question_id = q.id
        AND ans.attempt_id = ?
      WHERE q.exam_id = ?
      ORDER BY q.id ASC
      LIMIT 200
    `;

    db.query(
      questionsQuery,
      [attemptId, attempt.exam_id],
      (questionErr, questions) => {
        if (questionErr) {
          console.error('Get attempt questions error:', questionErr);
          return res.status(500).json({
            message: 'Failed to load questions.'
          });
        }

        res.json({
          attempt: {
            id: attempt.id,
            exam_id: attempt.exam_id,
            attempt_number: attempt.attempt_number,
            status: attempt.status,
            expires_at_unix: Number(attempt.expires_at_unix),
            server_now_unix: Number(attempt.server_now_unix),
            exam_title: attempt.exam_title,
            course_title: attempt.course_title,
            total_marks: attempt.total_marks,
            duration_minutes: attempt.duration_minutes
          },
          questions
        });
      }
    );
  });
});


/* ========== STUDENT EXAM ANSWER AUTO-SAVE ========== */

app.put('/api/student/exam-attempts/:attemptId/answers', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const { student_id, question_id, answer_text } = req.body;

  const studentId = Number(student_id);
  const questionId = Number(question_id);

  if (
    !Number.isSafeInteger(attemptId) || attemptId <= 0 ||
    !Number.isSafeInteger(studentId) || studentId <= 0 ||
    !Number.isSafeInteger(questionId) || questionId <= 0 ||
    typeof answer_text !== 'string' ||
    answer_text.length > 10000
  ) {
    return res.status(400).json({
      message: 'Invalid answer data.'
    });
  }

  const attemptQuery = `
    SELECT
      a.id,
      a.exam_id,
      a.status,
      a.expires_at,
      e.exam_status,
      e.exam_mode,
      e.course_batch_id,
      e.exam_date,
      e.start_time,
      UNIX_TIMESTAMP() AS server_now_unix,
      UNIX_TIMESTAMP(a.expires_at) AS expires_at_unix
    FROM exam_attempts a
    JOIN exams e ON e.id = a.exam_id
    JOIN course_enrollments ce
      ON ce.course_batch_id = e.course_batch_id
      AND ce.student_id = a.student_id
      AND ce.status = 'Active'
    WHERE a.id = ?
      AND a.student_id = ?
    LIMIT 1
  `;

  db.query(attemptQuery, [attemptId, studentId], (err, rows) => {
    if (err) {
      console.error('Auto-save attempt error:', err);
      return res.status(500).json({
        message: 'Unable to verify exam attempt.'
      });
    }

    if (!rows.length) {
      return res.status(403).json({
        message: 'Attempt not found or access denied.'
      });
    }

    const attempt = rows[0];

    if (
      attempt.status !== 'InProgress' ||
      attempt.exam_status !== 'Published' ||
      attempt.exam_mode !== 'Online'
    ) {
      return res.status(409).json({
        message: 'This exam attempt cannot accept answers.'
      });
    }

    if (
      !attempt.expires_at_unix ||
      Number(attempt.server_now_unix) >=
      Number(attempt.expires_at_unix)
    ) {
      return res.status(409).json({
        message: 'Exam time has expired.',
        expired: true
      });
    }

    const questionQuery = `
      SELECT id, question_type, options
      FROM exam_questions
      WHERE id = ?
        AND exam_id = ?
      LIMIT 1
    `;

    db.query(
      questionQuery,
      [questionId, attempt.exam_id],
      (questionErr, questions) => {
        if (questionErr) {
          console.error('Auto-save question error:', questionErr);
          return res.status(500).json({
            message: 'Unable to verify question.'
          });
        }

        if (!questions.length) {
          return res.status(404).json({
            message: 'Question not found in this exam.'
          });
        }

        const question = questions[0];
        const answer = answer_text.trim();

        if (question.question_type === 'MCQ' && answer !== '') {
          let options = question.options;

          if (typeof options === 'string') {
            try {
              options = JSON.parse(options);
            } catch {
              return res.status(500).json({
                message: 'Invalid question options.'
              });
            }
          }

          const optionIndex = Number(answer);

          if (
            !Array.isArray(options) ||
            !/^(0|[1-9]\d*)$/.test(answer) ||
            !Number.isSafeInteger(optionIndex) ||
            optionIndex >= options.length
          ) {
            return res.status(400).json({
              message: 'Invalid MCQ option.'
            });
          }
        }

        if (
          question.question_type === 'TrueFalse' &&
          answer !== '' &&
          answer !== 'True' &&
          answer !== 'False'
        ) {
          return res.status(400).json({
            message: 'Answer must be True or False.'
          });
        }

        const saveQuery = `
          INSERT INTO exam_answers (
            attempt_id,
            question_id,
            answer_text,
            marks_awarded,
            is_correct
          )
          VALUES (?, ?, ?, NULL, NULL)
          ON DUPLICATE KEY UPDATE
            answer_text = VALUES(answer_text),
            marks_awarded = NULL,
            is_correct = NULL
        `;

        db.query(
          saveQuery,
          [attemptId, questionId, answer],
          (saveErr) => {
            if (saveErr) {
              console.error('Auto-save answer error:', saveErr);
              return res.status(500).json({
                message: 'Failed to save answer.'
              });
            }

            return res.json({
              message: 'Answer saved successfully.',
              attempt_id: attemptId,
              question_id: questionId,
              saved_answer: answer
            });
          }
        );
      }
    );
  });
});

app.get('/api/debug/database', (req, res) => {
  db.query(
    `SELECT
       DATABASE() AS database_name,
       @@hostname AS mysql_host,
       @@port AS mysql_port,
       CONNECTION_ID() AS connection_id`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }

      res.json(rows[0]);
    }
  );
});


/* ========== STUDENT EXAM SUBMISSION & GRADING ========== */

app.post('/api/student/exam-attempts/:attemptId/submit', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const studentId = Number(req.body?.student_id);

  if (
    !Number.isSafeInteger(attemptId) || attemptId <= 0 ||
    !Number.isSafeInteger(studentId) || studentId <= 0
  ) {
    return res.status(400).json({
      message: 'Invalid attempt or student ID.'
    });
  }

  db.beginTransaction((beginErr) => {
    if (beginErr) {
      console.error('Begin submit transaction:', beginErr);
      return res.status(500).json({
        message: 'Could not begin submission.'
      });
    }

    const rollback = (status, message) => {
      db.rollback(() => {
        res.status(status).json({ message });
      });
    };

    const attemptSql = `
      SELECT
        a.id,
        a.exam_id,
        a.student_id,
        a.status,
        a.total_score,
        e.total_marks,
        e.exam_mode,
        e.exam_status
      FROM exam_attempts a
      JOIN exams e
        ON e.id = a.exam_id
      JOIN course_enrollments ce
        ON ce.student_id = a.student_id
       AND ce.course_batch_id = e.course_batch_id
       AND ce.status = 'Active'
      WHERE a.id = ?
        AND a.student_id = ?
      FOR UPDATE
    `;

    db.query(attemptSql, [attemptId, studentId], (err, rows) => {
      if (err) {
        console.error('Submission verification:', err);
        return rollback(500, 'Failed to verify exam attempt.');
      }

      if (rows.length !== 1) {
        return rollback(403, 'Attempt not found or access denied.');
      }

      const attempt = rows[0];

      if (attempt.status !== 'InProgress') {
        return db.commit((commitErr) => {
          if (commitErr) {
            return res.status(500).json({
              message: 'Failed to finish request.'
            });
          }

          return res.json({
            message: 'Exam was already submitted.',
            attempt_id: attemptId,
            status: attempt.status,
            objective_score: Number(attempt.total_score || 0),
            already_submitted: true
          });
        });
      }

      if (
        attempt.exam_mode !== 'Online' ||
        attempt.exam_status !== 'Published'
      ) {
        return rollback(409, 'This attempt cannot be submitted.');
      }

      const answersSql = `
        SELECT
          q.id AS question_id,
          q.question_type,
          q.correct_answer,
          q.marks,
          ans.id AS answer_id,
          ans.answer_text
        FROM exam_questions q
        LEFT JOIN exam_answers ans
          ON ans.question_id = q.id
         AND ans.attempt_id = ?
        WHERE q.exam_id = ?
        ORDER BY q.id
      `;

      db.query(
        answersSql,
        [attemptId, attempt.exam_id],
        (qErr, questions) => {
          if (qErr) {
            console.error('Submission question load:', qErr);
            return rollback(500, 'Could not load answers for grading.');
          }

          if (!questions.length) {
            return rollback(409, 'Exam has no questions.');
          }

          let score = 0;
          let pendingManualReview = false;

          const objectiveUpdates = [];

          for (const question of questions) {
            const answer = String(
              question.answer_text ?? ''
            ).trim();

            if (question.question_type === 'ShortAnswer') {
              if (answer.length > 0) {
                pendingManualReview = true;
              }
              continue;
            }

            if (
              !['MCQ', 'TrueFalse'].includes(question.question_type)
            ) {
              return rollback(500, 'Unknown question type in exam.');
            }

            const correct =
              answer.length > 0 &&
              answer === String(
                question.correct_answer ?? ''
              ).trim();

            const awarded = correct ? Number(question.marks) : 0;

            score += awarded;

            if (question.answer_id !== null) {
              objectiveUpdates.push([
                awarded,
                correct ? 1 : 0,
                question.answer_id
              ]);
            }
          }

          const finalStatus = pendingManualReview
            ? 'PendingReview'
            : 'Graded';

          const finishAttempt = () => {
            db.query(
              `UPDATE exam_attempts
               SET status = ?,
                   submitted_at = NOW(),
                   total_score = ?
               WHERE id = ?
                 AND status = 'InProgress'`,
              [
                finalStatus,
                Number(score.toFixed(2)),
                attemptId
              ],
              (finishErr, result) => {
                if (finishErr || result.affectedRows !== 1) {
                  console.error(
                    'Attempt finalize error:',
                    finishErr
                  );
                  return rollback(500, 'Could not finalize exam.');
                }

                db.commit((commitErr) => {
                  if (commitErr) {
                    console.error('Commit exam error:', commitErr);

                    return db.rollback(() => {
                      res.status(500).json({
                        message: 'Could not commit submission.'
                      });
                    });
                  }

                  return res.json({
                    message: pendingManualReview
                      ? 'Exam submitted. Short answers await instructor review.'
                      : 'Exam submitted and objective questions graded.',
                    attempt_id: attemptId,
                    status: finalStatus,
                    objective_score: Number(score.toFixed(2)),
                    total_marks: Number(attempt.total_marks),
                    already_submitted: false
                  });
                });
              }
            );
          };

          const updateOne = (idx) => {
            if (idx >= objectiveUpdates.length) {
              return finishAttempt();
            }

            db.query(
              `UPDATE exam_answers
               SET marks_awarded = ?,
                   is_correct = ?
               WHERE id = ?`,
              objectiveUpdates[idx],
              (updateErr) => {
                if (updateErr) {
                  console.error('Answer grading error:', updateErr);

                  return rollback(
                    500,
                    'Could not grade exam answers.'
                  );
                }

                updateOne(idx + 1);
              }
            );
          };

          updateOne(0);
        }
      );
    });
  });
});

/* ========== INSTRUCTOR: REVIEW SUBMITTED EXAM ========== */

app.get(
  '/api/teacher/exam-attempts/:attemptId/review/:teacherId',
  (req, res) => {
    const attemptId = Number(req.params.attemptId);
    const teacherId = Number(req.params.teacherId);

    if (
      !Number.isSafeInteger(attemptId) || attemptId <= 0 ||
      !Number.isSafeInteger(teacherId) || teacherId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid request IDs.'
      });
    }

    const attemptSql = `
      SELECT
        a.id,
        a.exam_id,
        a.student_id,
        a.attempt_number,
        a.status,
        a.total_score,
        a.submitted_at,
        e.title AS exam_title,
        e.total_marks,
        u.name AS student_name
      FROM exam_attempts a
      JOIN exams e ON e.id = a.exam_id
      JOIN users u ON u.id = a.student_id
      WHERE a.id = ?
        AND e.teacher_id = ?
        AND a.status IN (
          'Submitted', 'PendingReview', 'Graded'
        )
      LIMIT 1
    `;

    db.query(attemptSql, [attemptId, teacherId], (err, rows) => {
      if (err) {
        console.error('Instructor attempt review error:', err);
        return res.status(500).json({
          message: 'Failed to load submitted attempt.'
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          message: 'Submitted attempt not found.'
        });
      }

      const attempt = rows[0];

      const questionsSql = `
        SELECT
          q.id,
          q.question_text,
          q.question_type,
          q.options,
          q.correct_answer,
          q.marks,
          ans.answer_text AS student_answer,
          ans.marks_awarded,
          ans.is_correct
        FROM exam_questions q
        LEFT JOIN exam_answers ans
          ON ans.attempt_id = ?
         AND ans.question_id = q.id
        WHERE q.exam_id = ?
        ORDER BY q.id
      `;

      db.query(
        questionsSql,
        [attemptId, attempt.exam_id],
        (qErr, questions) => {
          if (qErr) {
            console.error('Review questions error:', qErr);
            return res.status(500).json({
              message: 'Failed to load student answers.'
            });
          }

          res.json({
            attempt,
            questions
          });
        }
      );
    });
  }
);


/* ========== INSTRUCTOR: LIST SUBMITTED ATTEMPTS ========== */

app.get(
  '/api/teacher/exams/:examId/submitted-attempts/:teacherId',
  (req, res) => {
    const examId = Number(req.params.examId);
    const teacherId = Number(req.params.teacherId);

    if (
      !Number.isSafeInteger(examId) || examId <= 0 ||
      !Number.isSafeInteger(teacherId) || teacherId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid exam or teacher ID.'
      });
    }

    const sql = `
      SELECT
        a.id AS attempt_id,
        a.student_id,
        u.name AS student_name,
        u.email AS student_email,
        a.attempt_number,
        a.status,
        a.total_score,
        a.submitted_at
      FROM exam_attempts a
      JOIN exams e ON e.id = a.exam_id
      JOIN users u ON u.id = a.student_id
      WHERE e.id = ?
        AND e.teacher_id = ?
        AND a.status IN (
          'Submitted', 'PendingReview', 'Graded'
        )
      ORDER BY a.submitted_at DESC, a.id DESC
      LIMIT 100
    `;

    db.query(sql, [examId, teacherId], (err, rows) => {
      if (err) {
        console.error('Submitted attempts list error:', err);
        return res.status(500).json({
          message: 'Failed to load submitted attempts.'
        });
      }

      res.json(rows);
    });
  }
);



/* ==========================================================
   INSTRUCTOR — GRADE SHORT ANSWER (UPDATED)
   - Save question marks
   - Recalculate attempt score
   - Calculate grade automatically
   - Sync latest attempt to exam_results
   - Preserve published results
   - Prevent old retakes overwriting newer attempts
   ========================================================== */

app.put(
  '/api/teacher/exam-attempts/:attemptId/grade-answer',
  (req, res) => {

    const attemptId = Number(req.params.attemptId);
    const teacherId = Number(req.body?.teacher_id);
    const questionId = Number(req.body?.question_id);

    const rawMarks = req.body?.marks_awarded;
    const awarded = Number(rawMarks);

    // ========== VALIDATE INPUT ==========

    if (
      !Number.isSafeInteger(attemptId) ||
      attemptId <= 0 ||
      !Number.isSafeInteger(teacherId) ||
      teacherId <= 0 ||
      !Number.isSafeInteger(questionId) ||
      questionId <= 0 ||
      rawMarks === null ||
      rawMarks === undefined ||
      rawMarks === '' ||
      !Number.isFinite(awarded) ||
      awarded < 0
    ) {
      return res.status(400).json({
        message: 'Invalid grading information.'
      });
    }

    // ========== CALCULATE GRADE ==========

    const calculateExamGrade = (obtained, maximum) => {

      const total = Number(maximum);
      const marks = Number(obtained);

      if (
        !Number.isFinite(total) ||
        !Number.isFinite(marks) ||
        total <= 0
      ) {
        return null;
      }

      const percentage = (marks / total) * 100;

      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B';
      if (percentage >= 60) return 'C';
      if (percentage >= 50) return 'D';

      return 'F';
    };

    // ========== BEGIN TRANSACTION ==========

    db.beginTransaction((beginErr) => {

      if (beginErr) {
        console.error('Grading transaction error:', beginErr);

        return res.status(500).json({
          message: 'Could not begin grading.'
        });
      }

      const fail = (code, message) => {
        db.rollback(() => {
          return res.status(code).json({ message });
        });
      };

      // ========== VERIFY ANSWER AND OWNERSHIP ==========

      const verifySql = `
        SELECT
          a.id,
          a.exam_id,
          a.student_id,
          a.status,

          e.result_published,
          e.total_marks AS exam_total_marks,

          q.marks AS question_marks,

          ans.id AS answer_id

        FROM exam_attempts a

        JOIN exams e
          ON e.id = a.exam_id

        JOIN exam_questions q
          ON q.exam_id = a.exam_id
         AND q.id = ?
         AND q.question_type = 'ShortAnswer'

        JOIN exam_answers ans
          ON ans.attempt_id = a.id
         AND ans.question_id = q.id

        WHERE a.id = ?
          AND e.teacher_id = ?

          AND a.status IN (
            'PendingReview',
            'Graded'
          )

          AND TRIM(
            COALESCE(ans.answer_text, '')
          ) <> ''

        FOR UPDATE
      `;

      db.query(
        verifySql,
        [questionId, attemptId, teacherId],
        (verifyErr, rows) => {

          if (verifyErr) {
            console.error('Verify answer error:', verifyErr);

            return fail(
              500,
              'Failed to verify answer.'
            );
          }

          if (!rows.length) {
            return fail(
              404,
              'Reviewable short answer not found.'
            );
          }

          const row = rows[0];

          // ========== BLOCK PUBLISHED RESULTS ==========

          if (Number(row.result_published) === 1) {
            return fail(
              409,
              'Published results cannot be changed here.'
            );
          }

          // ========== VALIDATE QUESTION MARKS ==========

          if (awarded > Number(row.question_marks)) {
            return fail(
              400,
              `Marks cannot exceed ${row.question_marks}.`
            );
          }

          // ========== UPDATE ANSWER MARKS ==========

          const updateAnswerSql = `
            UPDATE exam_answers

            SET
              marks_awarded = ?,
              is_correct = NULL

            WHERE id = ?
          `;

          db.query(
            updateAnswerSql,
            [awarded, row.answer_id],
            (answerErr) => {

              if (answerErr) {
                console.error(
                  'Update answer marks error:',
                  answerErr
                );

                return fail(
                  500,
                  'Failed to save answer marks.'
                );
              }

              // ========== RECALCULATE TOTAL SCORE ==========

              const sumSql = `
                SELECT

                  COALESCE(
                    SUM(ans.marks_awarded),
                    0
                  ) AS total_score,

                  COALESCE(
                    SUM(
                      CASE
                        WHEN q.question_type = 'ShortAnswer'
                         AND TRIM(
                           COALESCE(ans.answer_text, '')
                         ) <> ''
                         AND ans.marks_awarded IS NULL

                        THEN 1
                        ELSE 0
                      END
                    ),
                    0
                  ) AS pending_count

                FROM exam_questions q

                LEFT JOIN exam_answers ans
                  ON ans.question_id = q.id
                 AND ans.attempt_id = ?

                WHERE q.exam_id = ?
              `;

              db.query(
                sumSql,
                [attemptId, row.exam_id],
                (sumErr, sumRows) => {

                  if (sumErr) {
                    console.error(
                      'Calculate total error:',
                      sumErr
                    );

                    return fail(
                      500,
                      'Failed to calculate total marks.'
                    );
                  }

                  const total = Number(
                    sumRows[0]?.total_score || 0
                  );

                  const pending = Number(
                    sumRows[0]?.pending_count || 0
                  );

                  const status =
                    pending === 0
                      ? 'Graded'
                      : 'PendingReview';

                  // ========== CALCULATE FINAL GRADE ==========

                  const grade =
                    status === 'Graded'
                      ? calculateExamGrade(
                          total,
                          row.exam_total_marks
                        )
                      : null;

                  if (
                    total > Number(row.exam_total_marks) ||
                    (status === 'Graded' && grade === null)
                  ) {
                    return fail(
                      400,
                      'Invalid total score or exam marks.'
                    );
                  }

                  // ========== UPDATE EXAM ATTEMPT ==========

                  const updateAttemptSql = `
                    UPDATE exam_attempts

                    SET
                      total_score = ?,
                      status = ?

                    WHERE id = ?
                  `;

                  db.query(
                    updateAttemptSql,
                    [total, status, attemptId],
                    (attemptErr) => {

                      if (attemptErr) {
                        console.error(
                          'Update attempt error:',
                          attemptErr
                        );

                        return fail(
                          500,
                          'Failed to update exam attempt.'
                        );
                      }

                      // ========== COMMIT HELPER ==========

                      const commitAndRespond = (
                        syncedToResults = false
                      ) => {

                        db.commit((commitErr) => {

                          if (commitErr) {
                            return db.rollback(() => {
                              res.status(500).json({
                                message:
                                  'Failed to commit grading.'
                              });
                            });
                          }

                          return res.json({
                            message:
                              'Marks saved successfully.',

                            attempt_id: attemptId,
                            exam_id: row.exam_id,
                            student_id: row.student_id,

                            total_score: total,
                            total_marks:
                              Number(row.exam_total_marks),

                            grade,
                            status,

                            pending_short_answers: pending,

                            synced_to_results:
                              syncedToResults,

                            result_published: false
                          });
                        });
                      };

                      // ========== PENDING MANUAL REVIEW ==========

                      if (status !== 'Graded') {
                        return commitAndRespond(false);
                      }

                      // ========== CHECK LATEST ATTEMPT ==========

                      const latestAttemptSql = `
                        SELECT
                          id,
                          attempt_number,
                          status

                        FROM exam_attempts

                        WHERE exam_id = ?
                          AND student_id = ?

                        ORDER BY
                          attempt_number DESC,
                          id DESC

                        LIMIT 1
                      `;

                      db.query(
                        latestAttemptSql,
                        [row.exam_id, row.student_id],
                        (latestErr, latestRows) => {

                          if (latestErr) {
                            console.error(
                              'Latest attempt error:',
                              latestErr
                            );

                            return fail(
                              500,
                              'Failed to verify latest attempt.'
                            );
                          }

                          const latestAttempt =
                            latestRows[0];

                          // Older attempts must never overwrite
                          // a newer attempt's final result.
                          if (
                            !latestAttempt ||
                            Number(latestAttempt.id) !== attemptId
                          ) {
                            return commitAndRespond(false);
                          }

                          // ========== FIND EXISTING RESULT ==========

                          const findResultSql = `
                            SELECT
                              id,
                              source_attempt_id

                            FROM exam_results

                            WHERE exam_id = ?
                              AND student_id = ?

                            ORDER BY id DESC

                            LIMIT 1

                            FOR UPDATE
                          `;

                          db.query(
                            findResultSql,
                            [row.exam_id, row.student_id],
                            (findErr, results) => {

                              if (findErr) {
                                console.error(
                                  'Find result error:',
                                  findErr
                                );

                                return fail(
                                  500,
                                  'Failed to check final result.'
                                );
                              }

                              const existingResult =
                                results[0] || null;

                              // ========== UPDATE EXISTING RESULT ==========

                              if (existingResult) {

                                const updateResultSql = `
                                  UPDATE exam_results

                                  SET
                                    marks_obtained = ?,
                                    grade = ?,
                                    status = 'Graded',
                                    source_attempt_id = ?

                                  WHERE id = ?
                                `;

                                return db.query(
                                  updateResultSql,
                                  [
                                    total,
                                    grade,
                                    attemptId,
                                    existingResult.id
                                  ],
                                  (syncErr) => {

                                    if (syncErr) {
                                      console.error(
                                        'Result sync error:',
                                        syncErr
                                      );

                                      return fail(
                                        500,
                                        'Failed to update final result.'
                                      );
                                    }

                                    return commitAndRespond(true);
                                  }
                                );
                              }

                              // ========== INSERT NEW RESULT ==========

                              const insertResultSql = `
                                INSERT INTO exam_results
                                (
                                  exam_id,
                                  student_id,
                                  marks_obtained,
                                  grade,
                                  status,
                                  source_attempt_id
                                )

                                VALUES (
                                  ?, ?, ?, ?, 'Graded', ?
                                )
                              `;

                              db.query(
                                insertResultSql,
                                [
                                  row.exam_id,
                                  row.student_id,
                                  total,
                                  grade,
                                  attemptId
                                ],
                                (insertErr) => {

                                  if (insertErr) {
                                    console.error(
                                      'Insert result error:',
                                      insertErr
                                    );

                                    return fail(
                                      500,
                                      'Failed to create final result.'
                                    );
                                  }

                                  return commitAndRespond(true);
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }
);

       

/* ========== INSTRUCTOR: SAVE OFFLINE EXAM RESULTS ========== */

app.post('/api/teacher/exam-results', (req, res) => {
  
  return res.status(410).json({
    message:
      "Offline exam marks entry is no longer supported. " +
      "Use online exam attempts and grading."
  });

  const teacherId = Number(req.body?.teacher_id);
  const examId = Number(req.body?.exam_id);
  const results = req.body?.results_data;

  if (
    !Number.isSafeInteger(teacherId) || teacherId <= 0 ||
    !Number.isSafeInteger(examId) || examId <= 0 ||
    !Array.isArray(results) ||
    results.length === 0 ||
    results.length > 500
  ) {
    return res.status(400).json({
      message: 'Invalid exam results data.'
    });
  }

  const studentIds = new Set();

  for (const item of results) {
    const studentId = Number(item?.student_id);
    const marks = item?.marks_obtained;

    if (
      !Number.isSafeInteger(studentId) ||
      studentId <= 0 ||
      studentIds.has(studentId) ||
      (marks !== null &&
        marks !== undefined &&
        marks !== '' &&
        (!Number.isFinite(Number(marks)) || Number(marks) < 0))
    ) {
      return res.status(400).json({
        message: 'Invalid or duplicate student result.'
      });
    }

    studentIds.add(studentId);
  }

  db.beginTransaction((beginErr) => {
    if (beginErr) {
      return res.status(500).json({
        message: 'Could not begin saving results.'
      });
    }

    const fail = (status, message) =>
      db.rollback(() => res.status(status).json({ message }));

    db.query(
      `SELECT id, total_marks, exam_mode, result_published,
              course_batch_id
       FROM exams
       WHERE id = ? AND teacher_id = ?
       FOR UPDATE`,
      [examId, teacherId],
      (examErr, exams) => {
        if (examErr) return fail(500, 'Could not verify exam.');

        if (!exams.length) {
          return fail(403, 'Exam not found or access denied.');
        }

        const exam = exams[0];

        // Online marks must come from graded attempts only.
        if (exam.exam_mode === 'Online') {
          return fail(
            409,
            'Online exam marks are automatically graded. Use Review Student Answers.'
          );
        }

        if (Number(exam.result_published) === 1) {
          return fail(
            409,
            'Published results cannot be edited.'
          );
        }

        for (const item of results) {
          if (
            item.marks_obtained !== null &&
            item.marks_obtained !== undefined &&
            item.marks_obtained !== '' &&
            Number(item.marks_obtained) > Number(exam.total_marks)
          ) {
            return fail(
              400,
              `Marks cannot exceed ${exam.total_marks}.`
            );
          }
        }

        const ids = [...studentIds];

        db.query(
          `SELECT student_id
           FROM course_enrollments
           WHERE course_batch_id = ?
             AND status = 'Active'
             AND student_id IN (?)`,
          [exam.course_batch_id, ids],
          (enrollErr, enrolled) => {
            if (enrollErr) {
              return fail(500, 'Could not verify enrolled students.');
            }

            const allowed = new Set(
              enrolled.map((r) => Number(r.student_id))
            );

            if (ids.some((studentId) => !allowed.has(studentId))) {
              return fail(
                403,
                'One or more students are not actively enrolled.'
              );
            }

            const saveOne = (index) => {
              if (index >= results.length) {
                return db.commit((commitErr) => {
                  if (commitErr) {
                    return db.rollback(() => {
                      res.status(500).json({
                        message: 'Failed to commit results.'
                      });
                    });
                  }

                  return res.json({
                    message: 'Offline exam results saved successfully.',
                    saved: results.length
                  });
                });
              }

              const item = results[index];

              // Blank marks mean this student has not been graded.
              if (
                item.marks_obtained === null ||
                item.marks_obtained === undefined ||
                item.marks_obtained === ''
              ) {
                return saveOne(index + 1);
              }

              db.query(
                `SELECT id
                 FROM exam_results
                 WHERE exam_id = ? AND student_id = ?
                 ORDER BY id DESC LIMIT 1
                 FOR UPDATE`,
                [examId, Number(item.student_id)],
                (findErr, existing) => {
                  if (findErr) {
                    return fail(500, 'Could not check existing result.');
                  }

                  const marks = Number(item.marks_obtained);
                  const grade = String(item.grade || '').slice(0, 5);
                  const feedback = String(item.feedback || '').slice(0, 5000);

                  const hasResult = existing.length > 0;

                  const sql = hasResult
                    ? `UPDATE exam_results
                       SET marks_obtained = ?, grade = ?,
                           feedback = ?, status = 'Graded'
                       WHERE id = ?`
                    : `INSERT INTO exam_results
                       (exam_id, student_id, marks_obtained,
                        grade, feedback, status)
                       VALUES (?, ?, ?, ?, ?, 'Graded')`;

                  const params = hasResult
                    ? [marks, grade, feedback, existing[0].id]
                    : [
                        examId,
                        Number(item.student_id),
                        marks,
                        grade,
                        feedback
                      ];

                  db.query(sql, params, (saveErr) => {
                    if (saveErr) {
                      return fail(500, 'Failed to save student result.');
                    }

                    saveOne(index + 1);
                  });
                }
              );
            };

            saveOne(0);
          }
        );
      }
    );
  });
});


/* ==============================================
   SMART LMS - FEEDBACK AND RESULT PUBLICATION
   ============================================== */

// 1. SAVE INSTRUCTOR FEEDBACK

app.put(
  '/api/teacher/exam-results/:examId/:studentId/feedback',
  (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.params.studentId);
    const teacherId = Number(req.body?.teacher_id);
    const feedback = req.body?.feedback;

    if (
      ![examId, studentId, teacherId].every(
        (n) => Number.isSafeInteger(n) && n > 0
      ) ||
      typeof feedback !== 'string' ||
      feedback.length > 2000
    ) {
      return res.status(400).json({
        message: 'Invalid feedback request.'
      });
    }

    const sql = `
      UPDATE exam_results er
      JOIN exams e ON e.id = er.exam_id
      SET er.feedback = ?
      WHERE er.exam_id = ?
        AND er.student_id = ?
        AND er.status = 'Graded'
        AND e.teacher_id = ?
        AND e.exam_mode = 'Online'
        AND e.result_published = 0
    `;

    db.query(
      sql,
      [feedback.trim(), examId, studentId, teacherId],
      (err, result) => {
        if (err) {
          console.error('Save online exam feedback:', err);

          return res.status(500).json({
            message: 'Could not save feedback.'
          });
        }

        if (!result.affectedRows) {
          return res.status(409).json({
            message:
              'Result not graded, not owned, or already published.'
          });
        }

        return res.json({
          message: 'Feedback saved.',
          exam_id: examId,
          student_id: studentId
        });
      }
    );
  }
);


// 2. PUBLISH EXAM RESULTS


/* =====================================================
   SMART LMS — PUBLISH EXAM RESULTS
   Supports:
   - Online and Offline exams
   - Individual extensions / retakes
   - Pending grading checks
   - Latest attempt result synchronization
   - Automatic grade calculation
   ===================================================== */

app.put(
  '/api/teacher/exams/:examId/publish-results',
  (req, res) => {
    const examId = Number(req.params.examId);
    const teacherId = Number(req.body?.teacher_id);

    if (
      ![examId, teacherId].every(
        n => Number.isSafeInteger(n) && n > 0
      )
    ) {
      return res.status(400).json({
        message: 'Invalid exam or instructor ID.'
      });
    }

    db.beginTransaction((beginErr) => {
      if (beginErr) {
        console.error('Begin publication:', beginErr);

        return res.status(500).json({
          message: 'Could not begin publication.'
        });
      }

      const fail = (status, message) => {
        db.rollback(() => {
          return res.status(status).json({ message });
        });
      };

      /* ========== VERIFY EXAM ========== */

      const verifySql = `
        SELECT
          id,
          exam_mode,
          exam_status,
          result_published,
          course_batch_id,
          exam_date,
          start_time,
          duration_minutes,
          total_marks,

          CASE
            WHEN NOW() >= DATE_ADD(
              TIMESTAMP(exam_date, start_time),
              INTERVAL duration_minutes MINUTE
            )
            THEN 1
            ELSE 0
          END AS exam_window_ended

        FROM exams
        WHERE id = ?
          AND teacher_id = ?
        FOR UPDATE
      `;

      db.query(
        verifySql,
        [examId, teacherId],
        (examErr, examRows) => {
          if (examErr) {
            console.error('Verify exam:', examErr);

            return fail(
              500,
              'Could not verify exam.'
            );
          }

          if (examRows.length !== 1) {
            return fail(
              403,
              'Exam not found or access denied.'
            );
          }

          const exam = examRows[0];
          
if (exam.exam_mode !== "Online") {
  return fail(
    409,
    "Only Online Exam results can be published."
  );
}


          if (exam.exam_status !== 'Published') {
            return fail(
              409,
              'Exam must be published first.'
            );
          }

          if (Number(exam.result_published) === 1) {
            return fail(
              409,
              'Results have already been published.'
            );
          }

          if (
            !Number.isFinite(Number(exam.total_marks)) ||
            Number(exam.total_marks) <= 0
          ) {
            return fail(
              409,
              'Exam total marks must be greater than zero.'
            );
          }

          if (
            exam.exam_mode === 'Online' &&
            Number(exam.exam_window_ended) !== 1
          ) {
            return fail(
              409,
              'Wait until the scheduled online exam window ends.'
            );
          }

          /* ========== CHECK STUDENT EXTENSIONS ========== */

          const extensionSql = `
            SELECT COUNT(*) AS active_extensions

            FROM student_exam_extensions x

            JOIN course_enrollments ce
              ON ce.student_id = x.student_id
             AND ce.course_batch_id = ?
             AND ce.status = 'Active'

            WHERE x.exam_id = ?
              AND x.end_at > NOW()
          `;

          db.query(
            extensionSql,
            [exam.course_batch_id, examId],
            (extensionErr, extensionRows) => {
              if (extensionErr) {
                console.error(
                  'Extension verification:',
                  extensionErr
                );

                return fail(
                  500,
                  'Could not verify student extensions.'
                );
              }

              if (
                Number(
                  extensionRows[0]?.active_extensions || 0
                ) > 0
              ) {
                return fail(
                  409,
                  'Some students have active or upcoming extensions. Wait until all extension windows end.'
                );
              }

              /* ========== CHECK GRADING ========== */

              const checkSql =
                exam.exam_mode === 'Online'
                  ? `
                    SELECT

                      (
                        SELECT COUNT(*)
                        FROM exam_attempts a
                        WHERE a.exam_id = ?
                          AND a.status IN (
                            'InProgress',
                            'Submitted',
                            'PendingReview'
                          )
                      ) AS pending,

                      (
                        SELECT COUNT(*)
                        FROM exam_attempts a
                        WHERE a.exam_id = ?
                          AND a.status = 'Graded'
                      ) AS graded,

                      (
                        SELECT COUNT(*)
                        FROM exam_attempts a
                        WHERE a.exam_id = ?
                          AND a.status = 'Graded'

                          AND NOT EXISTS (
                            SELECT 1
                            FROM exam_attempts newer
                            WHERE newer.exam_id = a.exam_id
                              AND newer.student_id = a.student_id
                              AND (
                                newer.attempt_number >
                                  a.attempt_number
                                OR (
                                  newer.attempt_number =
                                    a.attempt_number
                                  AND newer.id > a.id
                                )
                              )
                          )

                          AND NOT EXISTS (
                            SELECT 1
                            FROM exam_results er
                            WHERE er.exam_id = a.exam_id
                              AND er.student_id = a.student_id
                              AND er.status = 'Graded'
                              AND er.marks_obtained IS NOT NULL
                              AND er.source_attempt_id = a.id
                              AND ABS(
                                er.marks_obtained -
                                COALESCE(a.total_score, 0)
                              ) < 0.001
                          )
                      ) AS missing_results
                  `
                  : `
                    SELECT

                      (
                        SELECT COUNT(*)
                        FROM course_enrollments ce
                        WHERE ce.course_batch_id = ?
                          AND ce.status = 'Active'
                          AND NOT EXISTS (
                            SELECT 1
                            FROM exam_results er
                            WHERE er.exam_id = ?
                              AND er.student_id = ce.student_id
                              AND er.status = 'Graded'
                              AND er.marks_obtained IS NOT NULL
                          )
                      ) AS pending,

                      (
                        SELECT COUNT(*)
                        FROM exam_results er
                        WHERE er.exam_id = ?
                          AND er.status = 'Graded'
                          AND er.marks_obtained IS NOT NULL
                      ) AS graded,

                      0 AS missing_results
                  `;

              const args =
                exam.exam_mode === 'Online'
                  ? [examId, examId, examId]
                  : [
                      exam.course_batch_id,
                      examId,
                      examId
                    ];

              db.query(
                checkSql,
                args,
                (checkErr, checkRows) => {
                  if (checkErr) {
                    console.error(
                      'Grading verification:',
                      checkErr
                    );

                    return fail(
                      500,
                      'Could not verify grading and result synchronization.'
                    );
                  }

                  const counts = checkRows[0];

                  if (Number(counts.pending) > 0) {
                    return fail(
                      409,
                      'Some exam attempts are incomplete or awaiting grading.'
                    );
                  }

                  if (Number(counts.missing_results) > 0) {
                    return fail(
                      409,
                      'Latest graded attempts are not synchronized with exam_results.'
                    );
                  }

                  if (Number(counts.graded) === 0) {
                    return fail(
                      409,
                      'No graded results are available to publish.'
                    );
                  }

                  /* ========== CALCULATE GRADES ========== */

                  const gradeSql = `
                    UPDATE exam_results er

                    JOIN exams e
                      ON e.id = er.exam_id

                    SET er.grade = CASE

                      WHEN er.marks_obtained /
                           e.total_marks * 100 >= 90
                        THEN 'A+'

                      WHEN er.marks_obtained /
                           e.total_marks * 100 >= 80
                        THEN 'A'

                      WHEN er.marks_obtained /
                           e.total_marks * 100 >= 70
                        THEN 'B'

                      WHEN er.marks_obtained /
                           e.total_marks * 100 >= 60
                        THEN 'C'

                      WHEN er.marks_obtained /
                           e.total_marks * 100 >= 50
                        THEN 'D'

                      ELSE 'F'

                    END

                    WHERE er.exam_id = ?
                      AND er.status = 'Graded'
                      AND er.marks_obtained IS NOT NULL
                      AND e.total_marks > 0
                  `;

                  db.query(
                    gradeSql,
                    [examId],
                    (gradeErr) => {
                      if (gradeErr) {
                        console.error(
                          'Grade calculation:',
                          gradeErr
                        );

                        return fail(
                          500,
                          'Could not calculate grades.'
                        );
                      }

                      /* ========== PUBLISH RESULTS ========== */

                      const publishSql = `
                        UPDATE exams
                        SET result_published = 1
                        WHERE id = ?
                          AND teacher_id = ?
                          AND result_published = 0
                      `;

                      db.query(
                        publishSql,
                        [examId, teacherId],
                        (publishErr, result) => {
                          if (
                            publishErr ||
                            result.affectedRows !== 1
                          ) {
                            console.error(
                              'Publish results:',
                              publishErr
                            );

                            return fail(
                              500,
                              'Could not publish results.'
                            );
                          }

                          db.commit((commitErr) => {
                            if (commitErr) {
                              console.error(
                                'Publication commit:',
                                commitErr
                              );

                              return db.rollback(() => {
                                res.status(500).json({
                                  message:
                                    'Could not commit results publication.'
                                });
                              });
                            }

                            return res.json({
                              message:
                                'Results published successfully.',
                              exam_id: examId,
                              published: true
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }
);


/* ========== STUDENT EXAM ATTEMPT STATUSES ========== */

app.get('/api/student/exam-attempt-statuses/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      message: 'Invalid student ID.'
    });
  }

  const sql = `
    SELECT
      a.exam_id,
      a.id AS attempt_id,
      a.attempt_number,
      a.status,
      UNIX_TIMESTAMP(a.expires_at) AS expires_at_unix
    FROM exam_attempts a
    JOIN exams e
      ON e.id = a.exam_id
    JOIN course_enrollments ce
      ON ce.course_batch_id = e.course_batch_id
     AND ce.student_id = a.student_id
     AND ce.status = 'Active'
    WHERE a.student_id = ?
      AND e.exam_status = 'Published'
      AND a.id = (
        SELECT a2.id
        FROM exam_attempts a2
        WHERE a2.exam_id = a.exam_id
          AND a2.student_id = a.student_id
        ORDER BY a2.attempt_number DESC, a2.id DESC
        LIMIT 1
      )
    ORDER BY a.exam_id
  `;

  db.query(sql, [studentId], (err, rows) => {
    if (err) {
      console.error('Student attempt status error:', err);

      return res.status(500).json({
        message: 'Failed to load attempt statuses.'
      });
    }

    return res.json({
      attempts: rows
    });
  });
});


/* ========== INSTRUCTOR RESCHEDULE EXAM ========== */

app.put('/api/teacher/exams/:examId/reschedule', (req, res) => {
  const examId = Number(req.params.examId);
  const teacherId = Number(req.body?.teacher_id);
  const examDate = req.body?.exam_date;
  const startTime = req.body?.start_time;
  const duration = Number(req.body?.duration_minutes);

  const isDate =
    typeof examDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(examDate);

  const isTime =
    typeof startTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime);

  const dateIsReal =
    isDate &&
    !Number.isNaN(Date.parse(`${examDate}T12:00:00Z`)) &&
    new Date(`${examDate}T12:00:00Z`)
      .toISOString()
      .slice(0, 10) === examDate;

  if (
    !Number.isSafeInteger(examId) || examId <= 0 ||
    !Number.isSafeInteger(teacherId) || teacherId <= 0 ||
    !dateIsReal ||
    !isTime ||
    !Number.isSafeInteger(duration) ||
    duration < 1 ||
    duration > 480
  ) {
    return res.status(400).json({
      message:
        'Invalid schedule. Use a real date, HH:mm and duration 1–480.'
    });
  }

  db.beginTransaction((beginErr) => {
    if (beginErr) {
      return res.status(500).json({
        message: 'Unable to begin reschedule.'
      });
    }

    const fail = (code, message) => {
      db.rollback(() => {
        res.status(code).json({ message });
      });
    };

    const verifySql = `
      SELECT
        id,
        exam_mode,
        exam_status,
        result_published,

        (
          SELECT COUNT(*)
          FROM exam_attempts
          WHERE exam_id = ?
        ) AS attempt_count,

        (
          SELECT COUNT(*)
          FROM exam_results
          WHERE exam_id = ?
        ) AS result_count,

        CASE
          WHEN TIMESTAMP(?, ?) > NOW()
          THEN 1
          ELSE 0
        END AS future_schedule

      FROM exams
      WHERE id = ?
        AND teacher_id = ?
      FOR UPDATE
    `;

    db.query(
      verifySql,
      [examId, examId, examDate, startTime, examId, teacherId],
      (err, rows) => {
        if (err) {
          console.error('Reschedule verification error:', err);

          return fail(500, 'Failed to verify exam schedule.');
        }

        if (!rows.length) {
          return fail(
            403,
            'Exam not found or access denied.'
          );
        }

        const exam = rows[0];

        if (exam.exam_mode !== 'Online') {
          return fail(
            409,
            'Only Online exams can be rescheduled here.'
          );
        }

        if (Number(exam.result_published) === 1) {
          return fail(
            409,
            'Published results prevent rescheduling.'
          );
        }

        if (
          Number(exam.attempt_count) > 0 ||
          Number(exam.result_count) > 0
        ) {
          return fail(
            409,
            'Exam has student attempts or results. Use per-student extension/retake instead.'
          );
        }

        if (Number(exam.future_schedule) !== 1) {
          return fail(
            400,
            'New exam date and time must be in the future (server timezone).'
          );
        }

        const updateSql = `
          UPDATE exams
          SET exam_date = ?,
              start_time = ?,
              duration_minutes = ?
          WHERE id = ?
            AND teacher_id = ?
        `;

        db.query(
          updateSql,
          [
            examDate,
            `${startTime}:00`,
            duration,
            examId,
            teacherId
          ],
          (updateErr, result) => {
            if (
              updateErr ||
              result.affectedRows !== 1
            ) {
              console.error('Reschedule update error:', updateErr);

              return fail(
                500,
                'Failed to reschedule exam.'
              );
            }

            db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => {
                  res.status(500).json({
                    message: 'Reschedule commit failed.'
                  });
                });
              }

              return res.json({
                message: 'Exam rescheduled successfully.',
                exam_id: examId,
                exam_date: examDate,
                start_time: startTime,
                duration_minutes: duration
              });
            });
          }
        );
      }
    );
  });
});


/* =====================================================
   SMART LMS — INDIVIDUAL EXAM EXTENSIONS AND RETAKES
   Add before app.listen().
   Keep existing Submit Exam API unchanged.
   ===================================================== */

// Helpers for existing callback-based MySQL connection

function examExtensionQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function examExtensionBegin() {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function examExtensionCommit() {
  return new Promise((resolve, reject) => {
    db.commit((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function examExtensionRollback() {
  return new Promise((resolve) => {
    db.rollback(() => resolve());
  });
}

function validExamExtensionId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validExamExtensionDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return false;
  }

  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === datePart
  );
}

/* =====================================================
   1. INSTRUCTOR — LIST STUDENTS AND EXTENSIONS
   ===================================================== */

app.get(
  "/api/teacher/exams/:examId/extensions/:teacherId",
  async (req, res) => {
    const examId = Number(req.params.examId);
    const teacherId = Number(req.params.teacherId);

    if (
      !validExamExtensionId(examId) ||
      !validExamExtensionId(teacherId)
    ) {
      return res.status(400).json({
        message: "Invalid exam or teacher ID."
      });
    }

    try {
      const exams = await examExtensionQuery(
        `SELECT
           id,
           title,
           exam_mode,
           exam_status,
           result_published,
           attempt_limit,
           course_batch_id
         FROM exams
         WHERE id = ?
           AND teacher_id = ?
         LIMIT 1`,
        [examId, teacherId]
      );

      if (!exams.length) {
        return res.status(403).json({
          message: "Exam not found or access denied."
        });
      }

      const exam = exams[0];

      const students = await examExtensionQuery(
        `SELECT
           u.id AS student_id,
           u.name AS student_name,
           u.email,

           x.id AS extension_id,

           DATE_FORMAT(
             x.start_at, '%Y-%m-%d %H:%i'
           ) AS start_at,

           DATE_FORMAT(
             x.end_at, '%Y-%m-%d %H:%i'
           ) AS end_at,

           x.duration_minutes,
           x.extra_attempts,

           (
             SELECT COUNT(*)
             FROM exam_attempts a
             WHERE a.exam_id = ?
               AND a.student_id = u.id
           ) AS attempt_count,

           (
             SELECT a.status
             FROM exam_attempts a
             WHERE a.exam_id = ?
               AND a.student_id = u.id
             ORDER BY
               a.attempt_number DESC,
               a.id DESC
             LIMIT 1
           ) AS latest_status,

           (
             SELECT er.status
             FROM exam_results er
             WHERE er.exam_id = ?
               AND er.student_id = u.id
             ORDER BY er.id DESC
             LIMIT 1
           ) AS result_status

         FROM course_enrollments ce

         JOIN users u
           ON u.id = ce.student_id

         LEFT JOIN student_exam_extensions x
           ON x.exam_id = ?
          AND x.student_id = u.id

         WHERE ce.course_batch_id = ?
           AND ce.status = 'Active'

         ORDER BY u.name, u.id`,
        [
          examId,
          examId,
          examId,
          examId,
          exam.course_batch_id
        ]
      );

      return res.json({
        exam,
        students
      });
    } catch (err) {
      console.error("Extension list error:", err);

      return res.status(500).json({
        message: "Failed to load exam extensions."
      });
    }
  }
);

/* =====================================================
   2. INSTRUCTOR — GRANT INDIVIDUAL EXTENSION
   ===================================================== */

app.put(
  "/api/teacher/exams/:examId/extensions/:studentId",
  async (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.params.studentId);
    const teacherId = Number(req.body?.teacher_id);

    const startAt = req.body?.start_at;
    const endAt = req.body?.end_at;
    const duration = Number(req.body?.duration_minutes);
    const extraAttempts = Number(req.body?.extra_attempts ?? 0);

    if (
      ![examId, studentId, teacherId].every(validExamExtensionId) ||
      !validExamExtensionDate(startAt) ||
      !validExamExtensionDate(endAt) ||
      !Number.isSafeInteger(duration) ||
      duration < 1 ||
      duration > 480 ||
      !Number.isSafeInteger(extraAttempts) ||
      extraAttempts < 0 ||
      extraAttempts > 3
    ) {
      return res.status(400).json({
        message:
          "Invalid extension. Use valid date/time, duration 1-480 and extra attempts 0-3."
      });
    }

    let transactionStarted = false;

    try {
      await examExtensionBegin();
      transactionStarted = true;

      const exams = await examExtensionQuery(
        `SELECT
           id,
           exam_mode,
           exam_status,
           result_published,
           course_batch_id
         FROM exams
         WHERE id = ?
           AND teacher_id = ?
         FOR UPDATE`,
        [examId, teacherId]
      );

      if (!exams.length) {
        await examExtensionRollback();

        return res.status(403).json({
          message: "Exam not found or access denied."
        });
      }

      const exam = exams[0];

      if (
        exam.exam_mode !== "Online" ||
        exam.exam_status !== "Published"
      ) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Only published Online exams support extensions."
        });
      }

      if (Number(exam.result_published) === 1) {
        await examExtensionRollback();

        return res.status(409).json({
          message:
            "Results are already published. This exam cannot be extended."
        });
      }

      const enrolled = await examExtensionQuery(
        `SELECT 1
         FROM course_enrollments
         WHERE student_id = ?
           AND course_batch_id = ?
           AND status = 'Active'
         LIMIT 1`,
        [studentId, exam.course_batch_id]
      );

      if (!enrolled.length) {
        await examExtensionRollback();

        return res.status(403).json({
          message: "Student is not actively enrolled."
        });
      }

      const windows = await examExtensionQuery(
        `SELECT
           TIMESTAMPDIFF(
             MINUTE, ?, ?
           ) AS window_minutes,
           (? > NOW()) AS future_end`,
        [startAt, endAt, endAt]
      );

      const windowMinutes = Number(windows[0].window_minutes);

      if (
        !Number.isFinite(windowMinutes) ||
        windowMinutes < 1 ||
        windowMinutes > 20160 ||
        Number(windows[0].future_end) !== 1
      ) {
        await examExtensionRollback();

        return res.status(400).json({
          message:
            "Closing time must be in the future and after opening time (maximum 14 days)."
        });
      }

      const attempts = await examExtensionQuery(
        `SELECT
           id,
           status,
           attempt_number
         FROM exam_attempts
         WHERE exam_id = ?
           AND student_id = ?
         ORDER BY attempt_number DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [examId, studentId]
      );

      const existingAttempt = attempts[0];

      if (existingAttempt?.status === "InProgress") {
        await examExtensionRollback();

        return res.status(409).json({
          message:
            "Student has an InProgress attempt. Finalize it before granting a retake."
        });
      }

      // A completed previous attempt needs additional permission.
      if (existingAttempt && extraAttempts < 1) {
        await examExtensionRollback();

        return res.status(409).json({
          message:
            "This student already has an attempt. Allow at least one extra attempt."
        });
      }

      await examExtensionQuery(
        `INSERT INTO student_exam_extensions (
           exam_id,
           student_id,
           teacher_id,
           start_at,
           end_at,
           duration_minutes,
           extra_attempts
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)

         ON DUPLICATE KEY UPDATE
           teacher_id = VALUES(teacher_id),
           start_at = VALUES(start_at),
           end_at = VALUES(end_at),
           duration_minutes = VALUES(duration_minutes),
           extra_attempts = VALUES(extra_attempts)`,
        [
          examId,
          studentId,
          teacherId,
          startAt,
          endAt,
          duration,
          extraAttempts
        ]
      );

      await examExtensionCommit();
      transactionStarted = false;

      return res.json({
        message: "Student extension saved successfully.",
        exam_id: examId,
        student_id: studentId
      });
    } catch (err) {
      if (transactionStarted) {
        await examExtensionRollback();
      }

      console.error("Extension save error:", err);

      return res.status(500).json({
        message: "Could not save student extension."
      });
    }
  }
);

/* =====================================================
   3. STUDENT — START OR RESUME EXAM WITH EXTENSION
   Replaces the previous Start Exam route.
   ===================================================== */

app.post(
  "/api/student/exams/:examId/start",
  async (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.body?.student_id);

    if (
      !validExamExtensionId(examId) ||
      !validExamExtensionId(studentId)
    ) {
      return res.status(400).json({
        message: "Invalid exam or student ID."
      });
    }

    let transactionStarted = false;

    try {
      await examExtensionBegin();
      transactionStarted = true;

      const exams = await examExtensionQuery(
        `SELECT
           e.id,
           e.title,
           e.total_marks,
           e.exam_mode,
           e.exam_status,
           e.result_published,
           e.attempt_limit,

           COALESCE(
             x.extra_attempts, 0
           ) AS extra_attempts,

           COALESCE(
             x.duration_minutes,
             e.duration_minutes
           ) AS allowed_duration,

           DATE_FORMAT(
             COALESCE(
               x.end_at,
               DATE_ADD(
                 TIMESTAMP(e.exam_date, e.start_time),
                 INTERVAL e.duration_minutes MINUTE
               )
             ),
             '%Y-%m-%d %H:%i:%s'
           ) AS closes_at,

           CASE
             WHEN NOW() >= COALESCE(
               x.start_at,
               TIMESTAMP(e.exam_date, e.start_time)
             )
             AND NOW() < COALESCE(
               x.end_at,
               DATE_ADD(
                 TIMESTAMP(e.exam_date, e.start_time),
                 INTERVAL e.duration_minutes MINUTE
               )
             )
             THEN 1
             ELSE 0
           END AS window_open

         FROM exams e

         JOIN course_enrollments ce
           ON ce.course_batch_id = e.course_batch_id
          AND ce.student_id = ?
          AND ce.status = 'Active'

         LEFT JOIN student_exam_extensions x
           ON x.exam_id = e.id
          AND x.student_id = ?

         WHERE e.id = ?
         FOR UPDATE`,
        [studentId, studentId, examId]
      );

      if (!exams.length) {
        await examExtensionRollback();

        return res.status(403).json({
          message: "Exam not found or student not enrolled."
        });
      }

      const exam = exams[0];

      if (
        exam.exam_mode !== "Online" ||
        exam.exam_status !== "Published"
      ) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Exam is not available for online attempts."
        });
      }

      if (Number(exam.result_published) === 1) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Exam results have already been published."
        });
      }

      const totals = await examExtensionQuery(
        `SELECT
           COUNT(*) AS question_count,
           COALESCE(SUM(marks), 0) AS total_question_marks
         FROM exam_questions
         WHERE exam_id = ?`,
        [examId]
      );

      if (
        Number(totals[0].question_count) === 0 ||
        Math.abs(
          Number(totals[0].total_question_marks) -
          Number(exam.total_marks)
        ) > 0.001
      ) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Exam questions are incomplete."
        });
      }

      const attempts = await examExtensionQuery(
        `SELECT
           id,
           attempt_number,
           status,
           UNIX_TIMESTAMP(expires_at) AS expires_unix,
           UNIX_TIMESTAMP() AS server_now_unix

         FROM exam_attempts

         WHERE exam_id = ?
           AND student_id = ?

         ORDER BY attempt_number DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [examId, studentId]
      );

      const previous = attempts[0];

      // Existing attempt can be resumed without resetting timer.
      if (previous?.status === "InProgress") {
        const expiry = Number(previous.expires_unix);
        const now = Number(previous.server_now_unix);

        if (expiry <= now) {
          await examExtensionRollback();

          return res.status(409).json({
            message:
              "Previous attempt has expired. Finalize it before starting a new attempt.",
            attempt_id: previous.id
          });
        }

        await examExtensionCommit();
        transactionStarted = false;

        return res.json({
          message: "Existing attempt resumed.",
          attempt_id: previous.id,
          exam_id: examId,
          attempt_number: previous.attempt_number,
          expires_at_unix: expiry,
          server_now_unix: now,
          resumed: true
        });
      }

      if (Number(exam.window_open) !== 1) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Exam is outside your allowed time window."
        });
      }

      const nextAttempt = previous
        ? Number(previous.attempt_number) + 1
        : 1;

      const allowedAttempts =
        Number(exam.attempt_limit || 1) +
        Number(exam.extra_attempts || 0);

      if (nextAttempt > allowedAttempts) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Maximum exam attempts reached."
        });
      }

      const duration = Number(exam.allowed_duration);

      if (
        !Number.isSafeInteger(duration) ||
        duration < 1 ||
        duration > 480
      ) {
        await examExtensionRollback();

        return res.status(409).json({
          message: "Exam duration is invalid."
        });
      }

      const inserted = await examExtensionQuery(
        `INSERT INTO exam_attempts (
           exam_id,
           student_id,
           attempt_number,
           started_at,
           status,
           expires_at
         )
         VALUES (
           ?, ?, ?, NOW(), 'InProgress',
           LEAST(
             DATE_ADD(NOW(), INTERVAL ? MINUTE),
             ?
           )
         )`,
        [
          examId,
          studentId,
          nextAttempt,
          duration,
          exam.closes_at
        ]
      );

      const created = await examExtensionQuery(
        `SELECT
           id,
           attempt_number,
           UNIX_TIMESTAMP(expires_at) AS expires_unix,
           UNIX_TIMESTAMP() AS server_now_unix
         FROM exam_attempts
         WHERE id = ?`,
        [inserted.insertId]
      );

      await examExtensionCommit();
      transactionStarted = false;

      return res.status(201).json({
        message: "Exam started successfully.",
        attempt_id: created[0].id,
        exam_id: examId,
        attempt_number: created[0].attempt_number,
        expires_at_unix: Number(created[0].expires_unix),
        server_now_unix: Number(created[0].server_now_unix),
        resumed: false
      });
    } catch (err) {
      if (transactionStarted) {
        await examExtensionRollback();
      }

      console.error("Start exam with extension error:", err);

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Attempt already exists. Refresh and retry."
        });
      }

      return res.status(500).json({
        message: "Failed to start examination."
      });
    }
  }
);


/* ========================================================
   SMART LMS — AUTOMATIC EXAM EXPIRY & RESULT SYNC
   Requires exam_results.source_attempt_id column.
   Uses existing callback-style db.query connection.
   ======================================================== */

const automaticExamQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

let automaticExamWorkerRunning = false;

/* ---------- FINALIZE ONE EXPIRED ATTEMPT ---------- */

async function finalizeExpiredAttempt(attemptId) {
  const rows = await automaticExamQuery(
    `SELECT
       a.id,
       a.exam_id,
       a.student_id,
       a.status,
       a.expires_at
     FROM exam_attempts a
     WHERE a.id = ?
       AND a.status = 'InProgress'
       AND a.expires_at <= NOW()
     LIMIT 1`,
    [attemptId]
  );

  if (!rows.length) return false;

  const attempt = rows[0];

  // Automatically grade saved MCQ and True/False answers.
  // BINARY comparison matches existing exact-answer grading.
  await automaticExamQuery(
    `UPDATE exam_answers ans
     JOIN exam_questions q
       ON q.id = ans.question_id
     SET
       ans.marks_awarded = CASE
         WHEN TRIM(COALESCE(ans.answer_text, '')) <> ''
          AND BINARY TRIM(ans.answer_text)
              = BINARY TRIM(COALESCE(q.correct_answer, ''))
         THEN q.marks
         ELSE 0
       END,

       ans.is_correct = CASE
         WHEN TRIM(COALESCE(ans.answer_text, '')) <> ''
          AND BINARY TRIM(ans.answer_text)
              = BINARY TRIM(COALESCE(q.correct_answer, ''))
         THEN 1
         ELSE 0
       END

     WHERE ans.attempt_id = ?
       AND q.exam_id = ?
       AND q.question_type IN ('MCQ', 'TrueFalse')`,
    [attemptId, attempt.exam_id]
  );

  // Unanswered Short Answers are worth zero.
  // Answered Short Answers need instructor review.
  const gradingRows = await automaticExamQuery(
    `SELECT
       COALESCE(
         SUM(
           CASE
             WHEN q.question_type IN ('MCQ', 'TrueFalse')
             THEN COALESCE(ans.marks_awarded, 0)
             ELSE 0
           END
         ), 0
       ) AS objective_score,

       COALESCE(
         SUM(
           CASE
             WHEN q.question_type = 'ShortAnswer'
              AND TRIM(COALESCE(ans.answer_text, '')) <> ''
             THEN 1
             ELSE 0
           END
         ), 0
       ) AS short_answers_to_review,

       COUNT(q.id) AS question_count

     FROM exam_questions q
     LEFT JOIN exam_answers ans
       ON ans.question_id = q.id
      AND ans.attempt_id = ?

     WHERE q.exam_id = ?`,
    [attemptId, attempt.exam_id]
  );

  const grading = gradingRows[0];

  if (!Number(grading.question_count)) {
    console.error(
      'Expired attempt has no questions:',
      attemptId
    );
    return false;
  }

  const pendingManualReview =
    Number(grading.short_answers_to_review) > 0;

  const newStatus = pendingManualReview
    ? 'PendingReview'
    : 'Graded';

  const score = Number(
    Number(grading.objective_score || 0).toFixed(2)
  );

  // Conditional update ensures an already-submitted attempt
  // is not finalized twice.
  const result = await automaticExamQuery(
    `UPDATE exam_attempts
     SET
       status = ?,
       submitted_at = COALESCE(submitted_at, expires_at),
       total_score = ?
     WHERE id = ?
       AND status = 'InProgress'
       AND expires_at <= NOW()`,
    [newStatus, score, attemptId]
  );

  if (result.affectedRows !== 1) return false;

  console.log(
    `[AUTO EXPIRE] Attempt ${attemptId} -> ${newStatus}, score ${score}`
  );

  return true;
}

/* ---------- SYNC LATEST GRADED ATTEMPT ---------- */

async function syncLatestGradedResults() {
  const latestGraded = await automaticExamQuery(
    `SELECT
       a.id AS attempt_id,
       a.exam_id,
       a.student_id,
       a.total_score

     FROM exam_attempts a

     JOIN exams e
       ON e.id = a.exam_id

     WHERE a.status = 'Graded'
       AND e.result_published = 0

       AND NOT EXISTS (
         SELECT 1
         FROM exam_attempts newer
         WHERE newer.exam_id = a.exam_id
           AND newer.student_id = a.student_id
           AND (
             newer.attempt_number > a.attempt_number
             OR (
               newer.attempt_number = a.attempt_number
               AND newer.id > a.id
             )
           )
       )

     ORDER BY a.id DESC
     LIMIT 100`
  );

  for (const attempt of latestGraded) {
    const attemptId = Number(attempt.attempt_id);
    const examId = Number(attempt.exam_id);
    const studentId = Number(attempt.student_id);
    const score = Number(attempt.total_score || 0);

    const existing = await automaticExamQuery(
      `SELECT
         id,
         marks_obtained,
         source_attempt_id
       FROM exam_results
       WHERE exam_id = ?
         AND student_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [examId, studentId]
    );

    if (!existing.length) {
      await automaticExamQuery(
        `INSERT INTO exam_results (
           exam_id,
           student_id,
           marks_obtained,
           grade,
           feedback,
           status,
           source_attempt_id
         )
         SELECT ?, ?, ?, NULL, NULL, 'Graded', ?
         WHERE NOT EXISTS (
           SELECT 1
           FROM exam_results
           WHERE exam_id = ?
             AND student_id = ?
         )`,
        [
          examId,
          studentId,
          score,
          attemptId,
          examId,
          studentId
        ]
      );

      continue;
    }

    const previous = existing[0];
    const sameAttempt =
      Number(previous.source_attempt_id) === attemptId;

    const sameScore =
      Math.abs(
        Number(previous.marks_obtained || 0) - score
      ) < 0.001;

    if (sameAttempt && sameScore) {
      continue;
    }

    // If only the source tracking was missing and marks are
    // already correct, preserve existing feedback.
    if (sameScore && previous.source_attempt_id == null) {
      await automaticExamQuery(
        `UPDATE exam_results
         SET source_attempt_id = ?,
             status = 'Graded'
         WHERE id = ?`,
        [attemptId, previous.id]
      );

      continue;
    }

    if (sameAttempt) {
      // Same attempt was regraded: preserve instructor feedback.
      await automaticExamQuery(
        `UPDATE exam_results
         SET marks_obtained = ?,
             grade = NULL,
             status = 'Graded'
         WHERE id = ?`,
        [score, previous.id]
      );
    } else {
      // Different attempt: previous feedback must not carry
      // into the student's new result.
      await automaticExamQuery(
        `UPDATE exam_results
         SET marks_obtained = ?,
             grade = NULL,
             feedback = NULL,
             status = 'Graded',
             source_attempt_id = ?
         WHERE id = ?`,
        [
          score,
          attemptId,
          previous.id
        ]
      );
    }

    console.log(
      `[RESULT SYNC] Exam ${examId}, Student ${studentId}, Attempt ${attemptId}`
    );
  }
}

/* ---------- BACKGROUND WORKER ---------- */

async function processExpiredExams() {
  if (automaticExamWorkerRunning) return;

  automaticExamWorkerRunning = true;

  try {
    const expired = await automaticExamQuery(
      `SELECT id
       FROM exam_attempts
       WHERE status = 'InProgress'
         AND expires_at <= NOW()
       ORDER BY expires_at ASC
       LIMIT 50`
    );

    for (const attempt of expired) {
      try {
        await finalizeExpiredAttempt(attempt.id);
      } catch (err) {
        console.error(
          'Automatic expiry failed for attempt',
          attempt.id,
          err
        );
      }
    }

    await syncLatestGradedResults();

  } catch (err) {
    console.error('Automatic exam worker error:', err);

  } finally {
    automaticExamWorkerRunning = false;
  }
}

/* ---------- RUN PERIODICALLY ---------- */

/* ---------- RUN PERIODICALLY ---------- */

// Local server par worker chalega.
// Vercel par background timers disable rahenge.

if (!process.env.VERCEL) {
  setInterval(() => {
    void processExpiredExams();
  }, 15000);

  setTimeout(() => {
    void processExpiredExams();
  }, 3000);
}


/* =====================================================
   INSTRUCTOR — ASSIGNMENT MARKS FOR EXAM RESULTS VIEW
   Read-only: keeps assignment and exam records separate.
   ===================================================== */

app.get(
  '/api/teacher/batches/:batchId/assignment-marks/:teacherId',
  (req, res) => {
    const batchId = Number(req.params.batchId);
    const teacherId = Number(req.params.teacherId);

    if (
      !Number.isSafeInteger(batchId) ||
      batchId <= 0 ||
      !Number.isSafeInteger(teacherId) ||
      teacherId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid batch or instructor ID.'
      });
    }

    const verifySql = `
      SELECT
        cb.id,
        c.title AS course_title
      FROM course_batches cb
      JOIN courses c
        ON c.id = cb.course_id
      WHERE cb.id = ?
        AND cb.instructor_id = ?
      LIMIT 1
    `;

    db.query(
      verifySql,
      [batchId, teacherId],
      (verifyErr, batches) => {
        if (verifyErr) {
          console.error('Assignment batch verification:', verifyErr);

          return res.status(500).json({
            message: 'Could not verify assignment batch.'
          });
        }

        if (!batches.length) {
          return res.status(403).json({
            message: 'Instructor is not assigned to this batch.'
          });
        }

        const query = `
          SELECT
            a.id AS assignment_id,
            a.title AS assignment_title,
            DATE_FORMAT(a.due_date, '%Y-%m-%d') AS due_date,
            a.total_marks,

            u.id AS student_id,
            u.name AS student_name,
            u.email AS student_email,

            s.id AS submission_id,
            s.marks_obtained,
            s.feedback,

            COALESCE(s.status, 'Pending') AS status

          FROM assignments a

          JOIN course_enrollments ce
            ON ce.course_batch_id = a.course_batch_id
           AND ce.status = 'Active'

          JOIN users u
            ON u.id = ce.student_id
           AND u.role = 'student'

          LEFT JOIN assignment_submissions s
            ON s.id = (
              SELECT MAX(s2.id)
              FROM assignment_submissions s2
              WHERE s2.assignment_id = a.id
                AND s2.student_id = u.id
            )

          WHERE a.course_batch_id = ?

          ORDER BY
            a.due_date DESC,
            a.id DESC,
            u.name ASC
        `;

        db.query(query, [batchId], (err, rows) => {
          if (err) {
            console.error('Assignment marks loading:', err);

            return res.status(500).json({
              message: 'Failed to load assignment marks.'
            });
          }

          return res.json({
            course_title: batches[0].course_title,
            assignments: rows
          });
        });
      }
    );
  }
);


/* ======================================================
   ADMIN — ALL EXAMS OVERVIEW (READ ONLY)
   ====================================================== */

app.get('/api/admin/exams-overview', (req, res) => {
  const sql = `
    SELECT
      e.id,
      e.title,
      e.exam_type,
      e.exam_mode,
      e.exam_status,
      e.total_marks,
      e.result_published,
      e.course_batch_id,
      DATE_FORMAT(e.exam_date, '%Y-%m-%d') AS exam_date,
      e.start_time,
      e.duration_minutes,
      e.attempt_limit,

      c.title AS course_title,
      u.id AS teacher_id,
      u.name AS teacher_name,

      (
        SELECT COUNT(DISTINCT ce.student_id)
        FROM course_enrollments ce
        WHERE ce.course_batch_id = e.course_batch_id
          AND ce.status = 'Active'
      ) AS enrolled_students,

      (
        SELECT COUNT(*)
        FROM exam_attempts ea
        WHERE ea.exam_id = e.id
          AND ea.status IN (
            'Submitted', 'PendingReview', 'Graded'
          )
      ) AS submitted_attempts,

      (
        SELECT COUNT(*)
        FROM exam_results er
        WHERE er.exam_id = e.id
          AND er.status = 'Graded'
      ) AS graded_results

    FROM exams e
    JOIN courses c ON c.id = e.course_id
    JOIN users u ON u.id = e.teacher_id

    ORDER BY e.exam_date DESC, e.id DESC
    LIMIT 500
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Admin exams overview error:', err);

      return res.status(500).json({
        message: 'Failed to load admin exams.'
      });
    }

    const exams = rows.map((exam) => ({
      ...exam,
      enrolled_students: Number(exam.enrolled_students || 0),
      submitted_attempts: Number(exam.submitted_attempts || 0),
      graded_results: Number(exam.graded_results || 0)
    }));

    res.json({
      totalExams: exams.length,
      publishedExams: exams.filter(
        e => e.exam_status === 'Published'
      ).length,
      publishedResults: exams.filter(
        e => Number(e.result_published) === 1
      ).length,
      exams
    });
  });
});


/* ======================================================
   ADMIN — EXAM STUDENT RESULTS & ATTEMPTS (READ ONLY)
   ====================================================== */

app.get('/api/admin/exams/:examId/details', (req, res) => {
  const examId = Number(req.params.examId);

  if (!Number.isSafeInteger(examId) || examId <= 0) {
    return res.status(400).json({
      message: 'Invalid exam ID.'
    });
  }

  const examSql = `
    SELECT
      e.id,
      e.title,
      e.exam_type,
      e.exam_mode,
      e.exam_status,
      e.total_marks,
      e.result_published,
      e.course_batch_id,
      DATE_FORMAT(e.exam_date, '%Y-%m-%d') AS exam_date,
      e.start_time,
      e.duration_minutes,
      e.attempt_limit,

      c.title AS course_title,
      u.name AS teacher_name

    FROM exams e
    JOIN courses c ON c.id = e.course_id
    JOIN users u ON u.id = e.teacher_id
    WHERE e.id = ?
    LIMIT 1
  `;

  db.query(examSql, [examId], (examErr, exams) => {
    if (examErr) {
      console.error('Admin exam details error:', examErr);

      return res.status(500).json({
        message: 'Failed to load exam details.'
      });
    }

    if (!exams.length) {
      return res.status(404).json({
        message: 'Exam not found.'
      });
    }

    const exam = exams[0];

    const studentsSql = `
      SELECT
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,

        er.id AS result_id,
        er.marks_obtained,
        er.grade,
        er.feedback,
        COALESCE(er.status, 'Pending') AS result_status,

        (
          SELECT COUNT(*)
          FROM exam_attempts ea
          WHERE ea.exam_id = ?
            AND ea.student_id = u.id
        ) AS attempts_used,

        (
          SELECT ea2.status
          FROM exam_attempts ea2
          WHERE ea2.exam_id = ?
            AND ea2.student_id = u.id
          ORDER BY ea2.id DESC
          LIMIT 1
        ) AS latest_attempt_status

      FROM course_enrollments ce
      JOIN users u
        ON u.id = ce.student_id
       AND u.role = 'student'

      LEFT JOIN exam_results er
        ON er.id = (
          SELECT MAX(er2.id)
          FROM exam_results er2
          WHERE er2.exam_id = ?
            AND er2.student_id = u.id
        )

      WHERE ce.course_batch_id = ?
        AND ce.status = 'Active'

      ORDER BY u.name ASC, u.id ASC
    `;

    db.query(
      studentsSql,
      [examId, examId, examId, exam.course_batch_id],
      (studentErr, students) => {
        if (studentErr) {
          console.error(
            'Admin exam student details error:',
            studentErr
          );

          return res.status(500).json({
            message: 'Failed to load exam student results.'
          });
        }

        const formattedStudents = students.map(student => ({
          ...student,
          attempts_used: Number(student.attempts_used || 0),
          marks_obtained:
            student.marks_obtained === null
              ? null
              : Number(student.marks_obtained)
        }));

        return res.json({
          exam,
          students: formattedStudents
        });
      }
    );
  });
});



/* ============================================================
   ADMIN REPORTS & ANALYTICS — REAL MYSQL DATA
   GET /api/admin/reports-summary

   Read-only reporting API.
   Existing LMS APIs remain unchanged.
   ============================================================ */

app.get('/api/admin/reports-summary', async (req, res) => {

  // Helper function to execute MySQL queries
  const read = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.query(
        {
          sql,
          values: params,
          timeout: 10000
        },
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

  try {

    const [
      totals,
      attendance,
      performance,
      courseEnrollments,
      instructorSummary
    ] = await Promise.all([

      // =====================================================
      // 1. OVERALL LMS STATISTICS
      // =====================================================

      read(`
        SELECT

          (
            SELECT COUNT(*)
            FROM users
            WHERE role = 'student'
              AND status = 'approved'
          ) AS totalStudents,

          (
            SELECT COUNT(*)
            FROM users
            WHERE role = 'instructor'
              AND status = 'approved'
          ) AS totalTeachers,

          (
            SELECT COUNT(*)
            FROM courses
            WHERE status = 'Published'
          ) AS activeCourses,

          (
            SELECT COUNT(DISTINCT ce.id)
            FROM course_enrollments ce
            WHERE ce.status = 'Active'
          ) AS activeEnrollments,

          (
            SELECT COUNT(*)
            FROM exams
          ) AS totalExams,

          (
            SELECT COUNT(*)
            FROM exams
            WHERE result_published = 1
          ) AS resultsPublished
      `),


      // =====================================================
      // 2. OVERALL STUDENT ATTENDANCE
      // =====================================================

      read(`
        SELECT
          COUNT(*) AS total,

          COALESCE(
            SUM(
              CASE
                WHEN status = 'Present' THEN 1
                ELSE 0
              END
            ),
            0
          ) AS present

        FROM attendance_records
      `),


      // =====================================================
      // 3. PUBLISHED EXAM PERFORMANCE
      // =====================================================

      read(`
        SELECT

          COUNT(*) AS gradedResults,

          ROUND(
            100 * SUM(er.marks_obtained)
            / NULLIF(SUM(e.total_marks), 0),
            1
          ) AS performancePercentage

        FROM exam_results er

        JOIN exams e
          ON e.id = er.exam_id

        WHERE e.result_published = 1

          AND er.status = 'Graded'

          AND er.marks_obtained IS NOT NULL

          AND e.total_marks > 0

          AND er.id = (
            SELECT MAX(er2.id)
            FROM exam_results er2
            WHERE er2.exam_id = er.exam_id
              AND er2.student_id = er.student_id
          )
      `),


      // =====================================================
      // 4. COURSE ENROLLMENT REPORT
      // =====================================================

      read(`
        SELECT

          c.id AS course_id,

          c.title AS course_title,

          COUNT(DISTINCT cb.id) AS batches,

          COUNT(
            DISTINCT CASE
              WHEN ce.status = 'Active'
              THEN ce.id
            END
          ) AS active_enrollments,

          COUNT(
            DISTINCT CASE
              WHEN ce.status = 'Active'
              THEN ce.student_id
            END
          ) AS unique_students

        FROM courses c

        LEFT JOIN course_batches cb
          ON cb.course_id = c.id

        LEFT JOIN course_enrollments ce
          ON ce.course_batch_id = cb.id

        WHERE c.status = 'Published'

        GROUP BY c.id, c.title

        ORDER BY
          active_enrollments DESC,
          c.title ASC
      `),


      // =====================================================
      // 5. INSTRUCTOR WORKLOAD REPORT
      // =====================================================

      read(`
        SELECT

          u.id AS teacher_id,

          u.name AS teacher_name,

          COUNT(
            DISTINCT cb.course_id
          ) AS assigned_courses,

          COUNT(
            DISTINCT cb.id
          ) AS assigned_batches

        FROM users u

        LEFT JOIN course_batches cb
          ON cb.instructor_id = u.id

        WHERE u.role = 'instructor'
          AND u.status = 'approved'

        GROUP BY u.id, u.name

        ORDER BY
          assigned_courses DESC,
          u.name ASC
      `)

    ]);


    // =====================================================
    // 6. FORMAT MYSQL RESULTS
    // =====================================================

    const t = totals[0] || {};
    const a = attendance[0] || {};
    const p = performance[0] || {};

    const totalRecords = Number(a.total || 0);

    const performancePercentage =
      p.performancePercentage == null
        ? null
        : Number(p.performancePercentage);


    // =====================================================
    // 7. SEND FINAL REPORT DATA
    // =====================================================

    return res.json({

      summary: {

        totalStudents:
          Number(t.totalStudents || 0),

        totalTeachers:
          Number(t.totalTeachers || 0),

        activeCourses:
          Number(t.activeCourses || 0),

        activeEnrollments:
          Number(t.activeEnrollments || 0),

        totalExams:
          Number(t.totalExams || 0),

        resultsPublished:
          Number(t.resultsPublished || 0),

        gradedResults:
          Number(p.gradedResults || 0),

        attendancePercentage:
          totalRecords > 0
            ? Number(
                (
                  Number(a.present || 0) *
                  100 /
                  totalRecords
                ).toFixed(1)
              )
            : null,

        performancePercentage:
          performancePercentage

      },


      // COURSE ENROLLMENT DATA

      courseEnrollments: courseEnrollments.map(
        (row) => ({
          course_id: row.course_id,

          course_title: row.course_title,

          batches:
            Number(row.batches || 0),

          active_enrollments:
            Number(row.active_enrollments || 0),

          unique_students:
            Number(row.unique_students || 0)
        })
      ),


      // INSTRUCTOR REPORT DATA

      instructorSummary: instructorSummary.map(
        (row) => ({
          teacher_id: row.teacher_id,

          teacher_name: row.teacher_name,

          assigned_courses:
            Number(row.assigned_courses || 0),

          assigned_batches:
            Number(row.assigned_batches || 0)
        })
      )

    });

  } catch (err) {

    console.error(
      'Admin reports summary error:',
      err
    );

    return res.status(500).json({
      message:
        'Unable to load reports. Check backend logs.'
    });

  }

});


/* =========================================================
   ADMIN EXAM REPORTS — READ ONLY
   Overview + student results + individual attempt timeline
   ========================================================= */

const adminExamReportQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(
      { sql, values, timeout: 10000 },
      (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      }
    );
  });

// Get actual creation timestamp only if exams.created_at exists.
// Never substitute exam_date as the creation date.
const getExamCreationColumn = async () => {
  const columns = await adminExamReportQuery(
    "SHOW COLUMNS FROM exams LIKE 'created_at'"
  );

  return columns.length > 0
    ? "DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i:%s')"
    : "NULL";
};


// =============== ALL EXAM REPORTS ===============

app.get('/api/admin/exam-reports', async (req, res) => {
  try {
    const createdExpression =
      await getExamCreationColumn();

    const exams = await adminExamReportQuery(`
      SELECT
        e.id,
        e.title,
        e.exam_type,
        e.exam_mode,
        e.exam_status,
        e.result_published,
        e.total_marks,
        e.course_batch_id,

        DATE_FORMAT(e.exam_date, '%Y-%m-%d')
          AS exam_date,

        TIME_FORMAT(e.start_time, '%H:%i:%s')
          AS start_time,

        e.duration_minutes,
        e.attempt_limit,

        ${createdExpression} AS created_at,

        c.title AS course_title,

        u.id AS teacher_id,
        u.name AS teacher_name,

        (
          SELECT COUNT(DISTINCT ce.student_id)
          FROM course_enrollments ce
          WHERE ce.course_batch_id = e.course_batch_id
            AND ce.status = 'Active'
        ) AS total_students,

        (
          SELECT COUNT(DISTINCT ea.student_id)
          FROM exam_attempts ea
          WHERE ea.exam_id = e.id
        ) AS students_attempted,

        (
          SELECT COUNT(*)
          FROM exam_attempts ea
          WHERE ea.exam_id = e.id
        ) AS total_attempts,

        (
          SELECT COUNT(DISTINCT er.student_id)
          FROM exam_results er
          WHERE er.exam_id = e.id
            AND er.status = 'Graded'
        ) AS graded_students

      FROM exams e

      JOIN courses c
        ON c.id = e.course_id

      JOIN users u
        ON u.id = e.teacher_id

      ORDER BY e.exam_date DESC, e.id DESC
    `);

    return res.json({
      totalExams: exams.length,

      publishedExams: exams.filter(
        e => e.exam_status === 'Published'
      ).length,

      resultsPublished: exams.filter(
        e => Number(e.result_published) === 1
      ).length,

      exams: exams.map(e => ({
        ...e,
        total_students: Number(e.total_students || 0),
        students_attempted: Number(e.students_attempted || 0),
        total_attempts: Number(e.total_attempts || 0),
        graded_students: Number(e.graded_students || 0),
        result_published: Number(e.result_published || 0)
      }))
    });

  } catch (error) {
    console.error('Admin exam reports error:', error);

    return res.status(500).json({
      message: 'Failed to load exam reports.'
    });
  }
});


// =============== SINGLE EXAM FULL REPORT ===============

app.get(
  '/api/admin/exam-reports/:examId',
  async (req, res) => {
    const examId = Number(req.params.examId);

    if (!Number.isSafeInteger(examId) || examId <= 0) {
      return res.status(400).json({
        message: 'Invalid exam ID.'
      });
    }

    try {
      const createdExpression =
        await getExamCreationColumn();

      const exams = await adminExamReportQuery(`
        SELECT
          e.id,
          e.title,
          e.exam_type,
          e.exam_mode,
          e.exam_status,
          e.result_published,
          e.total_marks,
          e.course_batch_id,

          DATE_FORMAT(e.exam_date, '%Y-%m-%d')
            AS exam_date,

          TIME_FORMAT(e.start_time, '%H:%i:%s')
            AS start_time,

          e.duration_minutes,
          e.attempt_limit,

          ${createdExpression} AS created_at,

          c.title AS course_title,
          u.name AS teacher_name

        FROM exams e

        JOIN courses c
          ON c.id = e.course_id

        JOIN users u
          ON u.id = e.teacher_id

        WHERE e.id = ?
        LIMIT 1
      `, [examId]);

      if (!exams.length) {
        return res.status(404).json({
          message: 'Exam not found.'
        });
      }

      const exam = exams[0];

      // Enrolled students and latest stored exam result
      const students = await adminExamReportQuery(`
        SELECT
          u.id AS student_id,
          u.name AS student_name,
          u.email AS student_email,

          er.id AS result_id,
          er.marks_obtained,
          er.grade,
          er.feedback,

          COALESCE(er.status, 'Pending')
            AS result_status

        FROM users u

        JOIN course_enrollments ce
          ON ce.student_id = u.id
         AND ce.status = 'Active'

        LEFT JOIN exam_results er
          ON er.id = (
            SELECT MAX(er2.id)
            FROM exam_results er2
            WHERE er2.exam_id = ?
              AND er2.student_id = u.id
          )

        WHERE ce.course_batch_id = ?
          AND u.role = 'student'

        GROUP BY
          u.id,
          u.name,
          u.email,
          er.id,
          er.marks_obtained,
          er.grade,
          er.feedback,
          er.status

        ORDER BY u.name ASC
      `, [examId, exam.course_batch_id]);

      // Every recorded attempt, including retakes
      const attempts = await adminExamReportQuery(`
        SELECT
          ea.id AS attempt_id,
          ea.student_id,
          u.name AS student_name,

          ea.attempt_number,
          ea.status,
          ea.total_score,

          DATE_FORMAT(
            ea.started_at, '%Y-%m-%d %H:%i:%s'
          ) AS started_at,

          DATE_FORMAT(
            ea.submitted_at, '%Y-%m-%d %H:%i:%s'
          ) AS submitted_at,

          DATE_FORMAT(
            ea.expires_at, '%Y-%m-%d %H:%i:%s'
          ) AS expires_at

        FROM exam_attempts ea

        JOIN users u
          ON u.id = ea.student_id

        WHERE ea.exam_id = ?

        ORDER BY
          ea.student_id ASC,
          ea.attempt_number ASC,
          ea.id ASC
      `, [examId]);

      const attemptMap = new Map();

      for (const attempt of attempts) {
        const key = Number(attempt.student_id);

        if (!attemptMap.has(key)) {
          attemptMap.set(key, []);
        }

        attemptMap.get(key).push({
          ...attempt,
          total_score:
            attempt.total_score == null
              ? null
              : Number(attempt.total_score)
        });
      }

      const formattedStudents = students.map(student => ({
        ...student,

        marks_obtained:
          student.marks_obtained == null
            ? null
            : Number(student.marks_obtained),

        attempts: attemptMap.get(
          Number(student.student_id)
        ) || []
      }));

      return res.json({
        exam: {
          ...exam,
          result_published: Number(
            exam.result_published || 0
          )
        },

        students: formattedStudents,

        totalAttempts: attempts.length,

        studentsAttempted: attemptMap.size
      });

    } catch (error) {
      console.error(
        'Admin full exam report error:',
        error
      );

      return res.status(500).json({
        message: 'Failed to load full exam report.'
      });
    }
  }
);

// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});