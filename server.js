const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const {
  Pool
} = require("pg")
const path = require("path")
const multer = require("multer")
const fs = require("fs").promises
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads", "images")
    try {
      await fs.mkdir(uploadDir, {
        recursive: true
      })
      cb(null, uploadDir)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "img-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed!"), false)
    }
  },
})

// Middleware
app.use(express.json({
  limit: "50mb"
}))
app.use(express.urlencoded({
  limit: "50mb",
  extended: true
}))
app.use(express.static("."))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({
      message: "Токен доступу відсутній"
    })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Недійсний токен"
      })
    }
    req.user = user
    next()
  })
}

// Admin middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    // First authenticate the token
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({
        message: "Access token required"
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    // Check if user has admin role
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [decoded.userId])
    if (result.rows.length === 0 || result.rows[0].role !== "admin") {
      return res.status(403).json({
        message: "Admin access required"
      })
    }

    req.user = decoded
    next()
  } catch (error) {
    return res.status(403).json({
      message: "Invalid or expired token"
    })
  }
}

// Image upload endpoint
app.post("/api/upload-image", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Файл не завантажено"
      })
    }

    // Return the URL path to the uploaded image
    const imageUrl = `/uploads/images/${req.file.filename}`

    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
    })
  } catch (error) {
    console.error("Image upload error:", error)
    res.status(500).json({
      error: "Помилка завантаження зображення"
    })
  }
})

async function initDatabase() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      birth_date DATE,
      phone VARCHAR(20),
      school VARCHAR(255),
      grade VARCHAR(20),
      city VARCHAR(100),
      subjects TEXT,
      role VARCHAR(20) DEFAULT 'student',
      total_score INTEGER DEFAULT 0,
      tests_completed INTEGER DEFAULT 0,
      average_score DECIMAL(5,2) DEFAULT 0,
      last_login TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) DEFAULT 'general',
      difficulty VARCHAR(20) DEFAULT 'medium',
      time_limit INTEGER DEFAULT 60,
      passing_score INTEGER DEFAULT 60,
      times_taken INTEGER DEFAULT 0,
      average_score DECIMAL(5,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_html TEXT,
      question_type VARCHAR(50) DEFAULT 'single',
      points INTEGER DEFAULT 1,
      time_limit INTEGER DEFAULT 60,
      explanation TEXT,
      explanation_html TEXT,
      question_order INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE TABLE IF NOT EXISTS answers (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL,
      answer_html TEXT,
      is_correct BOOLEAN DEFAULT false,
      answer_order INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE TABLE IF NOT EXISTS question_metadata (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      metadata_key VARCHAR(100) NOT NULL,
      metadata_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      time_spent INTEGER DEFAULT 0,
      results JSONB NOT NULL,
      category VARCHAR(100),
      difficulty VARCHAR(20),
      ip_address INET,
      user_agent TEXT,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(quiz_id, question_order)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_answers_order ON answers(question_id, answer_order)`)

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tests_completed INTEGER DEFAULT 0`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS average_score DECIMAL(5,2) DEFAULT 0`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`)

      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS times_taken INTEGER DEFAULT 0`)
      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS average_score DECIMAL(5,2) DEFAULT 0`)
      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`)
      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`)
      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 60`)
      await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 60`)

      await pool.query(`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0`)
      await pool.query(`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)`)
      await pool.query(`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS ip_address INET`)
      await pool.query(`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS user_agent TEXT`)
    } catch (alterError) {
      console.log("Some columns may already exist:", alterError.message)
    }

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_test_results_quiz_id ON test_results(quiz_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_test_results_completed_at ON test_results(completed_at)`)

    // Insert default quizzes if they don't exist
    const quizCount = await pool.query("SELECT COUNT(*) FROM quizzes")
    if (Number.parseInt(quizCount.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO quizzes (title, description, category, difficulty, questions) VALUES
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10)`,
        [
          "Математика - Основи",
          "Тест з основ математики",
          "mathematics",
          "easy",
          JSON.stringify([{
              id: 1,
              question: "Скільки буде 2 + 2?",
              options: ["3", "4", "5", "6"],
              correct: 1,
            },
            {
              id: 2,
              question: "Яка формула площі кола?",
              options: ["πr²", "2πr", "πd", "r²"],
              correct: 0,
            },
            {
              id: 3,
              question: "Скільки градусів у прямому куті?",
              options: ["45°", "60°", "90°", "180°"],
              correct: 2,
            },
          ]),
          "Історія України",
          "Тест з історії України",
          "history",
          "medium",
          JSON.stringify([{
              id: 1,
              question: "В якому році Україна отримала незалежність?",
              options: ["1990", "1991", "1992", "1993"],
              correct: 1,
            },
            {
              id: 2,
              question: "Хто був першим президентом України?",
              options: ["Леонід Кравчук", "Леонід Кучма", "Віктор Ющенко", "Петро Порошенко"],
              correct: 0,
            },
          ]),
        ],
      )
    }

    // Create default admin user
    await createDefaultAdmin()

    console.log("Database tables initialized successfully")
  } catch (error) {
    console.error("Database initialization error:", error)
  }
}

// Authentication Routes

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Email та пароль обов'язкові"
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Пароль повинен містити мінімум 6 символів"
      })
    }

    // Check if user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "Користувач з таким email вже існує"
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const result = await pool.query("INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email", [
      email,
      passwordHash,
    ])

    const user = result.rows[0]

    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      email: user.email
    }, JWT_SECRET, {
      expiresIn: "24h",
    })

    res.status(201).json({
      message: "Користувач успішно зареєстрований",
      token,
      userId: user.id,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      message: "Внутрішня помилка сервера"
    })
  }
})

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Email та пароль обов'язкові"
      })
    }

    // Find user
    const result = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Невірний email або пароль"
      })
    }

    const user = result.rows[0]

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({
        message: "Невірний email або пароль"
      })
    }

    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      email: user.email
    }, JWT_SECRET, {
      expiresIn: "24h",
    })

    res.json({
      message: "Успішний вхід",
      token,
      userId: user.id,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      message: "Внутрішня помилка сервера"
    })
  }
})

// Admin Authentication Endpoint
app.post("/api/admin/login", async (req, res) => {
  try {
    const {
      password
    } = req.body

    console.log(" Admin login attempt with password:", password)

    // Check admin password (in production, use environment variable)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "319560"
    console.log(" Expected admin password:", ADMIN_PASSWORD)

    if (password !== ADMIN_PASSWORD) {
      console.log(" Password mismatch")
      return res.status(401).json({
        success: false,
        message: "Невірний пароль"
      })
    }

    // Get admin user or create default admin
    const adminResult = await pool.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE role = 'admin' LIMIT 1",
    )

    let admin
    if (adminResult.rows.length === 0) {
      console.log(" No admin user found, creating default admin")
      const defaultAdminResult = await pool.query(
        "INSERT INTO users (email, first_name, last_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role",
        ["admin@nmt.gov.ua", "Адмін", "Користувач", "admin", "default_hash"],
      )
      admin = defaultAdminResult.rows[0]
    } else {
      admin = adminResult.rows[0]
    }

    const token = jwt.sign({
      userId: admin.id,
      email: admin.email,
      role: admin.role
    }, JWT_SECRET, {
      expiresIn: "24h"
    })

    console.log(" Admin login successful, user:", admin)

    res.json({
      success: true,
      token,
      user: admin,
    })
  } catch (error) {
    console.error(" Admin login error:", error)
    res.status(500).json({
      success: false,
      message: "Внутрішня помилка сервера"
    })
  }
})

// Get profile endpoint
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name, birth_date, phone, school, grade, city, subjects FROM users WHERE id = $1",
      [req.user.userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Користувач не знайдений"
      })
    }

    res.json({
      user: result.rows[0]
    })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({
      message: "Внутрішня помилка сервера"
    })
  }
})

// Update profile endpoint
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      birthDate,
      phone,
      school,
      grade,
      city,
      subjects
    } = req.body

    const result = await pool.query(
      `UPDATE users SET 
        first_name = $1, 
        last_name = $2, 
        birth_date = $3, 
        phone = $4, 
        school = $5, 
        grade = $6, 
        city = $7, 
        subjects = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 
      RETURNING id, email, first_name, last_name`,
      [firstName, lastName, birthDate, phone, school, grade, city, JSON.stringify(subjects), req.user.userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Користувач не знайдений"
      })
    }

    res.json({
      message: "Профіль успішно оновлено",
      user: result.rows[0],
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({
      message: "Внутрішня помилка сервера"
    })
  }
})

// Get all quizzes
app.get("/api/quizzes", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, title, description, category, difficulty, 
             jsonb_array_length(questions) as question_count
      FROM quizzes 
      ORDER BY created_at DESC`)

    const quizzes = result.rows.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      questionCount: quiz.question_count,
    }))

    res.json(quizzes)
  } catch (error) {
    console.error("Get quizzes error:", error)
    res.status(500).json({
      error: "Помилка отримання тестів"
    })
  }
})

// Get specific quiz
app.get("/api/quizzes/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM quizzes WHERE id = $1", [req.params.id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Тест не знайдено"
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get quiz error:", error)
    res.status(500).json({
      error: "Помилка отримання тесту"
    })
  }
})

app.post("/api/admin/quizzes", requireAdmin, async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const {
      title,
      description,
      category,
      difficulty,
      timeLimit,
      passingScore,
      questions
    } = req.body

    // Insert quiz
    const quizResult = await client.query(
      `INSERT INTO quizzes (title, description, category, difficulty, time_limit, passing_score, created_by, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [title, description, category, difficulty, timeLimit, passingScore, req.user.userId],
    )

    const quizId = quizResult.rows[0].id

    // Insert questions with rich content
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      const questionResult = await client.query(
        `INSERT INTO questions (quiz_id, question_text, question_html, question_type, points, time_limit, explanation, explanation_html, question_order, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
        [
          quizId,
          question.text || "",
          question.html || question.text || "",
          question.type || "single",
          question.points || 1,
          question.timeLimit || 60,
          question.explanation || "",
          question.explanationHtml || question.explanation || "",
          i + 1,
        ],
      )

      const questionId = questionResult.rows[0].id

      // Insert answers with HTML support
      if (question.answers && Array.isArray(question.answers)) {
        for (let j = 0; j < question.answers.length; j++) {
          const answer = question.answers[j]
          const isCorrect = Array.isArray(question.correct) ? question.correct.includes(j) : question.correct === j

          await client.query(
            `INSERT INTO answers (question_id, answer_text, answer_html, is_correct, answer_order, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              questionId,
              typeof answer === "string" ? answer : answer.text || "",
              typeof answer === "string" ? answer : answer.html || answer.text || "",
              isCorrect,
              j + 1,
            ],
          )
        }
      }

      // Handle special question metadata
      if (question.metadata) {
        for (const [key, value] of Object.entries(question.metadata)) {
          await client.query(
            `INSERT INTO question_metadata (question_id, metadata_key, metadata_value) 
             VALUES ($1, $2, $3)`,
            [questionId, key, JSON.stringify(value)],
          )
        }
      }
    }

    await client.query("COMMIT")

    res.json({
      success: true,
      message: "Quiz created successfully",
      quizId: quizId,
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating quiz:", error)
    res.status(500).json({
      error: "Failed to create quiz"
    })
  } finally {
    client.release()
  }
})

app.get("/api/admin/quizzes/:id", requireAdmin, async (req, res) => {
  try {
    const quizId = Number.parseInt(req.params.id)

    // Get quiz details
    const quizResult = await pool.query("SELECT * FROM quizzes WHERE id = $1", [quizId])

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: "Quiz not found"
      })
    }

    const quiz = quizResult.rows[0]

    // Get questions with answers
    const questionsResult = await pool.query(
      `SELECT q.*, 
       json_agg(
         json_build_object(
           'id', a.id,
           'text', a.answer_text,
           'html', a.answer_html,
           'isCorrect', a.is_correct,
           'order', a.answer_order
         ) ORDER BY a.answer_order
       ) as answers
       FROM questions q
       LEFT JOIN answers a ON q.id = a.question_id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q.question_order`,
      [quizId],
    )

    // Get question metadata
    const metadataResult = await pool.query(
      `SELECT qm.question_id, qm.metadata_key, qm.metadata_value
       FROM question_metadata qm
       JOIN questions q ON qm.question_id = q.id
       WHERE q.quiz_id = $1`,
      [quizId],
    )

    // Organize metadata by question
    const metadataByQuestion = {}
    metadataResult.rows.forEach((row) => {
      if (!metadataByQuestion[row.question_id]) {
        metadataByQuestion[row.question_id] = {}
      }
      try {
        metadataByQuestion[row.question_id][row.metadata_key] = JSON.parse(row.metadata_value)
      } catch {
        metadataByQuestion[row.question_id][row.metadata_key] = row.metadata_value
      }
    })

    // Combine questions with metadata
    const questions = questionsResult.rows.map((q) => ({
      id: q.id,
      text: q.question_text,
      html: q.question_html,
      type: q.question_type,
      points: q.points,
      timeLimit: q.time_limit,
      explanation: q.explanation,
      explanationHtml: q.explanation_html,
      order: q.question_order,
      answers: q.answers.filter((a) => a.id !== null),
      metadata: metadataByQuestion[q.id] || {},
    }))

    res.json({
      ...quiz,
      questions,
    })
  } catch (error) {
    console.error("Get quiz error:", error)
    res.status(500).json({
      error: "Error retrieving quiz"
    })
  }
})

app.put("/api/admin/quizzes/:id", requireAdmin, async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const quizId = Number.parseInt(req.params.id)
    const {
      title,
      description,
      category,
      difficulty,
      timeLimit,
      passingScore,
      questions
    } = req.body

    // Update quiz
    await client.query(
      `UPDATE quizzes SET 
        title = $1,
        description = $2,
        category = $3,
        difficulty = $4,
        time_limit = $5,
        passing_score = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7`,
      [title, description, category, difficulty, timeLimit, passingScore, quizId],
    )

    // Delete existing questions and answers (cascade will handle answers)
    await client.query("DELETE FROM questions WHERE quiz_id = $1", [quizId])

    // Insert updated questions
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      const questionResult = await client.query(
        `INSERT INTO questions (quiz_id, question_text, question_html, question_type, points, time_limit, explanation, explanation_html, question_order, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
        [
          quizId,
          question.text || "",
          question.html || question.text || "",
          question.type || "single",
          question.points || 1,
          question.timeLimit || 60,
          question.explanation || "",
          question.explanationHtml || question.explanation || "",
          i + 1,
        ],
      )

      const questionId = questionResult.rows[0].id

      // Insert answers
      if (question.answers && Array.isArray(question.answers)) {
        for (let j = 0; j < question.answers.length; j++) {
          const answer = question.answers[j]
          const isCorrect = Array.isArray(question.correct) ? question.correct.includes(j) : question.correct === j

          await client.query(
            `INSERT INTO answers (question_id, answer_text, answer_html, is_correct, answer_order, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              questionId,
              typeof answer === "string" ? answer : answer.text || "",
              typeof answer === "string" ? answer : answer.html || answer.text || "",
              isCorrect,
              j + 1,
            ],
          )
        }
      }

      // Insert metadata
      if (question.metadata) {
        for (const [key, value] of Object.entries(question.metadata)) {
          await client.query(
            `INSERT INTO question_metadata (question_id, metadata_key, metadata_value) 
             VALUES ($1, $2, $3)`,
            [questionId, key, JSON.stringify(value)],
          )
        }
      }
    }

    await client.query("COMMIT")

    res.json({
      success: true,
      message: "Quiz updated successfully",
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Update quiz error:", error)
    res.status(500).json({
      error: "Error updating quiz"
    })
  } finally {
    client.release()
  }
})

app.post("/api/quizzes/:id/submit", authenticateToken, async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const quizId = Number.parseInt(req.params.id)
    const {
      answers,
      timeSpent
    } = req.body
    const userId = req.user.userId

    // Get quiz with questions and correct answers
    const quizResult = await pool.query("SELECT * FROM quizzes WHERE id = $1", [quizId])
    if (quizResult.rows.length === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      })
    }

    const quiz = quizResult.rows[0]

    // Get questions with correct answers
    const questionsResult = await pool.query(
      `SELECT q.id, q.question_type, q.points,
       json_agg(
         json_build_object(
           'id', a.id,
           'isCorrect', a.is_correct,
           'order', a.answer_order
         ) ORDER BY a.answer_order
       ) as answers
       FROM questions q
       LEFT JOIN answers a ON q.id = a.question_id
       WHERE q.quiz_id = $1
       GROUP BY q.id, q.question_type, q.points
       ORDER BY q.question_order`,
      [quizId],
    )

    const questions = questionsResult.rows

    const normalizedAnswers = []
    for (let i = 0; i < questions.length; i++) {
      // Use provided answer or null if not provided
      normalizedAnswers[i] = answers && answers[i] !== undefined ? answers[i] : null
    }

    let correctAnswers = 0
    let totalPoints = 0
    let earnedPoints = 0

    questions.forEach((question, index) => {
      const userAnswer = normalizedAnswers[index]
      const questionAnswers = question.answers.filter((a) => a.id !== null)
      const correctAnswerIndices = questionAnswers.filter((a) => a.isCorrect).map((a) => a.order - 1)

      totalPoints += question.points

      let isCorrect = false

      switch (question.question_type) {
        case "single":
          isCorrect = userAnswer !== null && userAnswer !== undefined && correctAnswerIndices.includes(userAnswer)
          break
        case "multiple":
          if (Array.isArray(userAnswer) && userAnswer.length > 0) {
            isCorrect =
              userAnswer.length === correctAnswerIndices.length &&
              userAnswer.every((ans) => correctAnswerIndices.includes(ans))
          }
          break
        default:
          isCorrect = userAnswer !== null && userAnswer !== undefined && correctAnswerIndices.includes(userAnswer)
      }

      if (isCorrect) {
        correctAnswers++
        earnedPoints += question.points
      }
    })

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    // Save result
    const resultData = {
      userAnswers: normalizedAnswers,
      questions: questions,
      correctAnswers: correctAnswers,
      totalQuestions: questions.length,
      score: score,
      timeSpent: timeSpent || 0,
      earnedPoints,
      totalPoints,
    }

    const insertResult = await client.query(
      `INSERT INTO test_results (user_id, quiz_id, score, correct_answers, total_questions, time_spent, results, category, difficulty, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        userId,
        quizId,
        score,
        correctAnswers,
        questions.length,
        timeSpent || 0,
        JSON.stringify(resultData),
        quiz.category,
        quiz.difficulty,
        req.ip,
        req.get("User-Agent"),
      ],
    )

    // Update user statistics
    const userUpdateResult = await client.query(
      `UPDATE users SET 
       tests_completed = tests_completed + 1,
       total_score = total_score + $1
       WHERE id = $2 RETURNING tests_completed, total_score`,
      [score, userId],
    )

    if (userUpdateResult.rows.length > 0) {
      const {
        tests_completed,
        total_score
      } = userUpdateResult.rows[0]
      const newAverageScore = Math.round((total_score / tests_completed) * 100) / 100

      await client.query(`UPDATE users SET average_score = $1 WHERE id = $2`, [newAverageScore, userId])
    }

    // Update quiz statistics
    await client.query(
      `UPDATE quizzes SET 
       times_taken = times_taken + 1,
       average_score = (
         SELECT ROUND(AVG(score)::numeric, 2) FROM test_results WHERE quiz_id = $1
       )
       WHERE id = $1`,
      [quizId],
    )

    await client.query("COMMIT")

    res.json({
      success: true,
      result: {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: questions.length,
        earnedPoints,
        totalPoints,
        timeSpent: timeSpent || 0,
        resultId: insertResult.rows[0].id,
      },
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Submit quiz error:", error)
    res.status(500).json({
      success: false,
      error: "Error saving results",
    })
  } finally {
    client.release()
  }
})

app.get("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)

    // Verify user can access this data
    if (req.user.userId !== userId) {
      return res.status(403).json({
        message: "Доступ заборонено"
      })
    }

    const result = await pool.query(
      "SELECT id, email, first_name, last_name, role, tests_completed, average_score, total_score FROM users WHERE id = $1",
      [userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Користувач не знайдений"
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      message: "Помилка сервера"
    })
  }
})

app.get("/api/users/:id/stats", authenticateToken, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)

    // Verify user can access this data
    if (req.user.userId !== userId) {
      return res.status(403).json({
        message: "Доступ заборонено"
      })
    }

    // Get user stats
    const userResult = await pool.query("SELECT tests_completed, average_score, total_score FROM users WHERE id = $1", [
      userId,
    ])

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "Користувач не знайдений"
      })
    }

    const userStats = userResult.rows[0]

    // Get recent results
    const recentResults = await pool.query(
      `SELECT tr.score, tr.completed_at, q.title as quiz_title
       FROM test_results tr
       JOIN quizzes q ON tr.quiz_id = q.id
       WHERE tr.user_id = $1
       ORDER BY tr.completed_at DESC
       LIMIT 5`,
      [userId],
    )

    res.json({
      stats: {
        testsCompleted: userStats.tests_completed || 0,
        averageScore: Math.round(userStats.average_score || 0),
        totalScore: userStats.total_score || 0,
      },
      recentResults: recentResults.rows,
    })
  } catch (error) {
    console.error("Get user stats error:", error)
    res.status(500).json({
      message: "Помилка сервера"
    })
  }
})

app.get("/api/users/:userId/results/:resultId", authenticateToken, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId)
    const resultId = Number.parseInt(req.params.resultId)

    // Verify user can access this data
    if (req.user.userId !== userId) {
      return res.status(403).json({
        message: "Доступ заборонено"
      })
    }

    const result = await pool.query(
      `SELECT tr.*, q.title as quiz_title, q.description, q.difficulty
       FROM test_results tr
       JOIN quizzes q ON tr.quiz_id = q.id
       WHERE tr.id = $1 AND tr.user_id = $2`,
      [resultId, userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Результат не знайдений"
      })
    }

    const testResult = result.rows[0]

    res.json({
      id: testResult.id,
      quiz: {
        title: testResult.quiz_title,
        description: testResult.description,
        difficulty: testResult.difficulty,
      },
      score: testResult.score,
      correctAnswers: testResult.correct_answers,
      totalQuestions: testResult.total_questions,
      results: testResult.results,
      category: testResult.category,
      timeSpent: testResult.time_spent,
      completedAt: testResult.completed_at,
    })
  } catch (error) {
    console.error("Get user result error:", error)
    res.status(500).json({
      message: "Помилка сервера"
    })
  }
})

// Get leaderboard
app.get("/api/debug/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        first_name, 
        last_name, 
        role,
        total_score,
        tests_completed,
        average_score,
        created_at
      FROM users 
      ORDER BY created_at DESC
    `)

    res.json({
      total_users: result.rows.length,
      users: result.rows,
    })
  } catch (error) {
    console.error("Debug users error:", error)
    res.status(500).json({
      error: "Помилка отримання користувачів"
    })
  }
})

app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        CASE 
          WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL AND TRIM(u.first_name) != '' AND TRIM(u.last_name) != '' 
          THEN CONCAT(TRIM(u.first_name), ' ', TRIM(u.last_name))
          WHEN u.first_name IS NOT NULL AND TRIM(u.first_name) != '' 
          THEN TRIM(u.first_name)
          ELSE SPLIT_PART(u.email, '@', 1)
        END as name,
        u.email,
        COALESCE(u.total_score, 0) as total_score,
        COALESCE(u.tests_completed, 0) as tests_completed,
        COALESCE(u.average_score, 0) as average_score,
        COALESCE(AVG(tr.score), 0) as calculated_average_score
      FROM users u
      LEFT JOIN test_results tr ON u.id = tr.user_id
      WHERE (u.role = 'student' OR u.role IS NULL)
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.total_score, u.tests_completed, u.average_score
      ORDER BY 
        CASE WHEN COALESCE(u.tests_completed, 0) = 0 THEN 1 ELSE 0 END,
        COALESCE(u.average_score, COALESCE(AVG(tr.score), 0)) DESC, 
        COALESCE(u.total_score, 0) DESC,
        COALESCE(u.tests_completed, 0) DESC
      LIMIT 50
    `)

    console.log(` Leaderboard query returned ${result.rows.length} users`)

    const leaderboard = result.rows.map((row, index) => {
      const user = {
        id: row.id,
        name: row.name || "Невідомий користувач",
        email: row.email,
        totalScore: Number.parseInt(row.total_score) || 0,
        testsCompleted: Number.parseInt(row.tests_completed) || 0,
        averageScore: Math.round(
          Number.parseFloat(row.average_score) || Number.parseFloat(row.calculated_average_score) || 0,
        ),
        rank: index + 1,
      }

      console.log(
        ` User ${user.rank}: ${user.name} (${user.email}) - ${user.testsCompleted} tests, ${user.averageScore}% avg`,
      )
      return user
    })

    res.json(leaderboard)
  } catch (error) {
    console.error("Get leaderboard error:", error)
    res.status(500).json({
      error: "Помилка отримання рейтингу"
    })
  }
})

app.get("/api/stats/overview", async (req, res) => {
  try {
    // Get total counts
    const totalTests = await pool.query("SELECT COUNT(*) FROM test_results")
    const totalUsers = await pool.query("SELECT COUNT(*) FROM users WHERE tests_completed > 0")
    const averageScore = await pool.query("SELECT AVG(score) FROM test_results")

    // Get category stats
    const categoryStats = await pool.query(
      `SELECT 
        category,
        COUNT(*) as count,
        ROUND(AVG(score)) as averageScore
       FROM test_results 
       WHERE category IS NOT NULL
       GROUP BY category`,
    )

    const categoryStatsObj = {}
    categoryStats.rows.forEach((row) => {
      categoryStatsObj[row.category] = {
        count: Number.parseInt(row.count),
        averageScore: Number.parseInt(row.averageScore),
      }
    })

    res.json({
      totalTests: Number.parseInt(totalTests.rows[0].count),
      totalUsers: Number.parseInt(totalUsers.rows[0].count),
      averageScore: Math.round(Number.parseFloat(averageScore.rows[0].avg) || 0),
      categoryStats: categoryStatsObj,
    })
  } catch (error) {
    console.error("Get stats overview error:", error)
    res.status(500).json({
      error: "Помилка отримання статистики"
    })
  }
})

// Admin Results Endpoint
app.get("/api/admin/results", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
        tr.id,
        tr.score,
        tr.correct_answers,
        tr.total_questions,
        tr.category,
        tr.completed_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as user_name,
        q.title as quiz_title
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN quizzes q ON tr.quiz_id = q.id
      ORDER BY tr.completed_at DESC
      LIMIT 100`)

    const results = result.rows.map((result) => ({
      id: result.id,
      userName: result.user_name || "Без імені",
      quizTitle: result.quiz_title,
      category: result.category,
      score: result.score,
      correctAnswers: result.correct_answers,
      totalQuestions: result.total_questions,
      completedAt: result.completed_at,
    }))

    res.json(results)
  } catch (error) {
    console.error("Get results error:", error)
    res.status(500).json({
      error: "Помилка отримання результатів"
    })
  }
})

// Admin Dashboard Endpoint with Real Data
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    // Get total users
    const usersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role != 'admin'")
    const totalUsers = Number.parseInt(usersResult.rows[0].count)

    // Get total quizzes
    const quizzesResult = await pool.query("SELECT COUNT(*) FROM quizzes")
    const totalQuizzes = Number.parseInt(quizzesResult.rows[0].count)

    // Get total results
    const resultsResult = await pool.query("SELECT COUNT(*) FROM test_results")
    const totalResults = Number.parseInt(resultsResult.rows[0].count)

    // Get average score
    const avgScoreResult = await pool.query("SELECT AVG(score) as avg_score FROM test_results")
    const averageScore = Math.round(avgScoreResult.rows[0].avg_score || 0)

    // Get recent activity
    const recentActivity = await pool.query(`SELECT 
        tr.id,
        tr.score,
        tr.completed_at,
        tr.category,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as user_name,
        q.title as quiz_title
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN quizzes q ON tr.quiz_id = q.id
      ORDER BY tr.completed_at DESC
      LIMIT 10`)

    // Get category stats
    const categoryStats = await pool.query(`SELECT 
        category,
        COUNT(*) as total_tests,
        AVG(score) as avg_score
      FROM test_results
      GROUP BY category
      ORDER BY total_tests DESC`)

    res.json({
      totalUsers,
      totalQuizzes,
      totalResults,
      averageScore,
      recentActivity: recentActivity.rows,
      categoryStats: categoryStats.rows,
    })
  } catch (error) {
    console.error("Dashboard data error:", error)
    res.status(500).json({
      error: "Помилка отримання даних дашборду"
    })
  }
})

// Get all test results (admin only)
app.get("/api/admin/results", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT tr.*, q.title as quiz_title,
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as user_name
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      JOIN users u ON tr.user_id = u.id
      ORDER BY tr.completed_at DESC`)

    res.json(result.rows)
  } catch (error) {
    console.error("Get admin results error:", error)
    res.status(500).json({
      error: "Помилка отримання результатів"
    })
  }
})

// Get overall statistics
app.get("/api/stats/overview", async (req, res) => {
  try {
    // Get basic stats
    const totalTestsResult = await pool.query("SELECT COUNT(*) FROM test_results")
    const totalUsersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student' OR role IS NULL")
    const totalQuizzesResult = await pool.query("SELECT COUNT(*) FROM quizzes")
    const averageScoreResult = await pool.query("SELECT COALESCE(AVG(score), 0) as avg_score FROM test_results")

    // Get category stats
    const categoryStatsResult = await pool.query(`SELECT 
      category,
      COUNT(*) as count,
      COALESCE(AVG(score), 0) as average_score,
      COALESCE(SUM(score), 0) as total_score
      FROM test_results 
      GROUP BY category`)

    const categoryStats = {}
    categoryStatsResult.rows.forEach((row) => {
      categoryStats[row.category] = {
        count: Number.parseInt(row.count),
        totalScore: Number.parseInt(row.total_score),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
      }
    })

    // Get recent activity
    const recentActivityResult = await pool.query(`SELECT tr.*, q.title as quiz_title, 
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as user_name
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      JOIN users u ON tr.user_id = u.id
      ORDER BY tr.completed_at DESC
      LIMIT 10`)

    res.json({
      totalTests: Number.parseInt(totalTestsResult.rows[0].count),
      totalUsers: Number.parseInt(totalUsersResult.rows[0].count),
      totalQuizzes: Number.parseInt(totalQuizzesResult.rows[0].count),
      averageScore: Math.round(Number.parseFloat(averageScoreResult.rows[0].avg_score)),
      categoryStats,
      recentActivity: recentActivityResult.rows,
    })
  } catch (error) {
    console.error("Get overview stats error:", error)
    res.status(500).json({
      error: "Помилка отримання загальної статистики"
    })
  }
})

// Get user statistics
app.get("/api/users/:id/stats", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)

    // Get user info
    const userResult = await pool.query(
      "SELECT id, first_name, last_name, email, role, total_score FROM users WHERE id = $1",
      [userId],
    )
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "Користувач не знайдений"
      })
    }

    const user = userResult.rows[0]

    // Get user statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as tests_completed,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(SUM(score), 0) as total_score
      FROM test_results 
      WHERE user_id = $1`,
      [userId],
    )

    const stats = statsResult.rows[0]

    // Get category statistics
    const categoryStatsResult = await pool.query(
      `SELECT 
        category,
        COUNT(*) as tests_completed,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(SUM(score), 0) as total_score
      FROM test_results 
      WHERE user_id = $1 
      GROUP BY category`,
      [userId],
    )

    const categoryStats = {}
    categoryStatsResult.rows.forEach((row) => {
      categoryStats[row.category] = {
        testsCompleted: Number.parseInt(row.tests_completed),
        totalScore: Number.parseInt(row.total_score),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
      }
    })

    // Get recent results
    const recentResults = await pool.query(
      `SELECT tr.*, q.title as quiz_title
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      WHERE tr.user_id = $1
      ORDER BY tr.completed_at DESC
      LIMIT 5`,
      [userId],
    )

    res.json({
      user: {
        id: user.id,
        name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
        role: user.role || "student",
      },
      stats: {
        testsCompleted: Number.parseInt(stats.tests_completed),
        totalScore: Number.parseInt(stats.total_score),
        averageScore: Math.round(Number.parseFloat(stats.average_score)),
        categoryStats,
      },
      recentResults: recentResults.rows,
    })
  } catch (error) {
    console.error("Get user stats error:", error)
    res.status(500).json({
      error: "Помилка отримання статистики"
    })
  }
})

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, email, first_name, last_name, role 
      FROM users 
      ORDER BY created_at DESC`)

    const users = result.rows.map((user) => ({
      id: user.id,
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
      email: user.email,
      role: user.role || "student",
    }))

    res.json(users)
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({
      error: "Помилка отримання користувачів"
    })
  }
})

async function createDefaultAdmin() {
  try {
    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")

    if (adminResult.rows.length === 0) {
      const defaultAdminResult = await pool.query(
        "INSERT INTO users (email, first_name, last_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ["admin@nmt.gov.ua", "Адмін", "Користувач", "admin", "default_hash"],
      )
      console.log("Default admin created with ID:", defaultAdminResult.rows[0].id)
    }
  } catch (error) {
    console.error("Error creating default admin:", error)
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  initDatabase()
})