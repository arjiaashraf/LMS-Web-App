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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});