require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// PAYMENT RECEIPT UPLOAD CONFIGURATION
const receiptDirectory = path.join(__dirname, 'uploads', 'receipts');

fs.mkdirSync(receiptDirectory, { recursive: true });

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

// 👇 YAHAN RECEIPT VIEW API ADD KARO

app.get('/api/admin/payment-receipt/:enrollmentId', (req, res) => {
  const enrollmentId = Number(req.params.enrollmentId);

  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return res.status(400).json({ message: 'Invalid enrollment ID.' });
  }

  db.query(
    'SELECT payment_proof FROM course_enrollments WHERE id = ?',
    [enrollmentId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (!results.length) {
        return res.status(404).json({ message: 'Receipt not found.' });
      }

      const filename = results[0].payment_proof;

      if (!/^[a-f0-9-]{36}\.(jpg|png|pdf)$/.test(filename || ''))  {
        return res.status(404).json({
          message: 'Valid uploaded receipt not found.'
        });
      }

      res.sendFile(filename, { root: receiptDirectory });
    }
  );
});

// MySQL Database Connection
// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "lms_database",
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database: lms_database');
});

// ================= AUTHENTICATION APIs =================

// 1. REGISTER API
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      
      if (results.length > 0) {
        return res.status(400).json({ message: 'Email is already registered!' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userStatus = 'pending';

      const query = 'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [name, email, hashedPassword, role, userStatus], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(201).json({ message: 'Account created successfully! Waiting for admin approval.' });
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// 2. LOGIN API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = results[0];

    let isMatch = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role !== 'admin' && user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending admin approval.' });
    }

    res.json({
      message: 'Login successful!',
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email
    });
  });
});


// ================= ADMIN MANAGEMENT APIs =================

app.get('/api/admin/pending-users', (req, res) => {
  db.query("SELECT id, name, email, role, status FROM users WHERE status = 'pending'", (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

app.put('/api/admin/approve-user/:id', (req, res) => {
  const userId = req.params.id;
  db.query("UPDATE users SET status = 'approved' WHERE id = ?", [userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json({ message: 'User approved successfully!' });
  });
});

app.get('/api/admin/stats', (req, res) => {
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'approved') as totalStudents,
      (SELECT COUNT(*) FROM users WHERE role = 'instructor' AND status = 'approved') as totalTeachers,
      (SELECT COUNT(*) FROM users WHERE status = 'pending') as pendingUsers
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results[0]);
  });
});

app.delete('/api/admin/delete-user/:id', (req, res) => {
  const userId = req.params.id;
  db.query("DELETE FROM users WHERE id = ?", [userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "User deleted successfully from database!" });
  });
});


// ================= TEACHERS MODULE APIs =================

app.get('/api/teachers', (req, res) => {
  const query = "SELECT id, name, email, phone, qualification, specialisation, department, profile_photo, role, status FROM users WHERE role = 'instructor'";
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

app.get('/api/teacher/:id', (req, res) => {
  const teacherId = req.params.id;
  db.query("SELECT id, name, email, phone, qualification, specialisation, department, profile_photo, role, status FROM users WHERE id = ? AND role = 'instructor'", [teacherId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: "Teacher not found" });
    res.json(results[0]);
  });
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


// ================= STUDENTS MODULE APIs =================

app.get('/api/students', (req, res) => {
  const query = "SELECT id, name, email, phone, qualification, department, program, semester, cgpa, profile_photo, role, status FROM users WHERE role = 'student' AND status = 'approved'";
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

app.get('/api/student/dashboard/:id', (req, res) => {
  const studentId = req.params.id;
  db.query("SELECT id, name, email, role, status FROM users WHERE id = ? AND role = 'student'", [studentId], (err, studentResults) => {
    if (err || studentResults.length === 0) return res.status(404).json({ message: "Student not found" });
    res.json({
      id: studentResults[0].id,
      name: studentResults[0].name,
      email: studentResults[0].email,
      enrolledCoursesCount: 4,
      pendingAssignmentsCount: 2,
      attendancePercentage: "94%",
      gpa: "3.75"
    });
  });
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
app.post('/api/student/enroll-batch', (req, res) => {

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
    !['Quiz', 'Midterm', 'Final', 'Assignment'].includes(exam_type) ||
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Offline', 1, 0)
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
    !['Online', 'Offline'].includes(exam_mode) ||
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



/* ========== INSTRUCTOR: GRADE SHORT ANSWER ========== */

app.put('/api/teacher/exam-attempts/:attemptId/grade-answer', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const teacherId = Number(req.body?.teacher_id);
  const questionId = Number(req.body?.question_id);
  const rawMarks = req.body?.marks_awarded;
  const awarded = Number(rawMarks);

  if (
    !Number.isSafeInteger(attemptId) || attemptId <= 0 ||
    !Number.isSafeInteger(teacherId) || teacherId <= 0 ||
    !Number.isSafeInteger(questionId) || questionId <= 0 ||
    rawMarks === null || rawMarks === undefined || rawMarks === '' ||
    !Number.isFinite(awarded) || awarded < 0
  ) {
    return res.status(400).json({ message: 'Invalid grading information.' });
  }

  db.beginTransaction((beginErr) => {
    if (beginErr) {
      return res.status(500).json({ message: 'Could not begin grading.' });
    }

    const fail = (code, message) => {
      db.rollback(() => res.status(code).json({ message }));
    };

    const verifySql = `
      SELECT a.id, a.exam_id, a.student_id, a.status,
             e.result_published, q.marks, ans.id AS answer_id
      FROM exam_attempts a
      JOIN exams e ON e.id = a.exam_id
      JOIN exam_questions q ON q.exam_id = a.exam_id
        AND q.id = ? AND q.question_type = 'ShortAnswer'
      JOIN exam_answers ans ON ans.attempt_id = a.id
        AND ans.question_id = q.id
      WHERE a.id = ? AND e.teacher_id = ?
        AND a.status IN ('PendingReview', 'Graded')
        AND TRIM(COALESCE(ans.answer_text, '')) <> ''
      FOR UPDATE
    `;

    db.query(verifySql, [questionId, attemptId, teacherId], (verifyErr, rows) => {
      if (verifyErr) return fail(500, 'Failed to verify answer.');
      if (!rows.length) return fail(404, 'Reviewable short answer not found.');

      const row = rows[0];

      if (Number(row.result_published) === 1) {
        return fail(409, 'Published results cannot be changed here.');
      }

      if (awarded > Number(row.marks)) {
        return fail(400, `Marks cannot exceed ${row.marks}.`);
      }

      db.query(
        `UPDATE exam_answers
         SET marks_awarded = ?, is_correct = NULL
         WHERE id = ?`,
        [awarded, row.answer_id],
        (answerErr) => {
          if (answerErr) return fail(500, 'Failed to save answer marks.');

          db.query(
            `SELECT COALESCE(SUM(ans.marks_awarded), 0) AS total_score,
               SUM(CASE WHEN q.question_type = 'ShortAnswer'
                 AND TRIM(COALESCE(ans.answer_text, '')) <> ''
                 AND ans.marks_awarded IS NULL THEN 1 ELSE 0 END) AS pending_count
             FROM exam_questions q
             LEFT JOIN exam_answers ans
               ON ans.question_id = q.id AND ans.attempt_id = ?
             WHERE q.exam_id = ?`,
            [attemptId, row.exam_id],
            (sumErr, sumRows) => {
              if (sumErr) return fail(500, 'Failed to calculate total marks.');

              const total = Number(sumRows[0].total_score || 0);
              const pending = Number(sumRows[0].pending_count || 0);
              const status = pending === 0 ? 'Graded' : 'PendingReview';

              db.query(
                `UPDATE exam_attempts
                 SET total_score = ?, status = ?
                 WHERE id = ?`,
                [total, status, attemptId],
                (attemptErr) => {
                  if (attemptErr) return fail(500, 'Failed to update attempt.');

                  const commitAndRespond = () => {
                    db.commit((commitErr) => {
                      if (commitErr) {
                        return db.rollback(() => res.status(500).json({
                          message: 'Failed to commit grading.'
                        }));
                      }

                      res.json({
                        message: 'Marks saved successfully.',
                        attempt_id: attemptId,
                        total_score: total,
                        status,
                        pending_short_answers: pending
                      });
                    });
                  };

                  if (status !== 'Graded') return commitAndRespond();

                  // Synchronize final marks without publishing them
                  db.query(
                    `SELECT id FROM exam_results
                     WHERE exam_id = ? AND student_id = ?
                     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
                    [row.exam_id, row.student_id],
                    (findErr, results) => {
                      if (findErr) return fail(500, 'Failed to check result.');

                      const hasResult = results.length > 0;

                      const sql = hasResult
                        ? `UPDATE exam_results
                           SET marks_obtained = ?, status = 'Graded'
                           WHERE id = ?`
                        : `INSERT INTO exam_results
                           (exam_id, student_id, marks_obtained, status)
                           VALUES (?, ?, ?, 'Graded')`;

                      const params = hasResult
                        ? [total, results[0].id]
                        : [row.exam_id, row.student_id, total];

                      db.query(sql, params, (syncErr) => {
                        if (syncErr) return fail(500, 'Failed to sync result.');
                        commitAndRespond();
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});
       

/* ========== INSTRUCTOR: SAVE OFFLINE EXAM RESULTS ========== */

app.post('/api/teacher/exam-results', (req, res) => {
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

// Runs after server starts, then approximately every 15 seconds.
setInterval(() => {
  void processExpiredExams();
}, 15000);

setTimeout(() => {
  void processExpiredExams();
}, 3000);

// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});