const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("."));

// JWT Secret
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Токен доступу відсутній" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Недійсний токен" });
    }
    req.user = user;
    next();
  });
};

// Admin middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    // First authenticate the token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user has admin role
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      decoded.userId,
    ]);
    if (result.rows.length === 0 || result.rows[0].role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

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
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) DEFAULT 'general',
      difficulty VARCHAR(20) DEFAULT 'medium',
      time_limit INTEGER DEFAULT 60,
      passing_score INTEGER DEFAULT 60,
      questions JSONB NOT NULL,
      times_taken INTEGER DEFAULT 0,
      average_score DECIMAL(5,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

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
    )`);

    try {
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS tests_completed INTEGER DEFAULT 0`
      );
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS average_score DECIMAL(5,2) DEFAULT 0`
      );
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`
      );
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
      );

      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS times_taken INTEGER DEFAULT 0`
      );
      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS average_score DECIMAL(5,2) DEFAULT 0`
      );
      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
      );
      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`
      );
      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 60`
      );
      await pool.query(
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 60`
      );

      await pool.query(
        `ALTER TABLE test_results ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0`
      );
      await pool.query(
        `ALTER TABLE test_results ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)`
      );
      await pool.query(
        `ALTER TABLE test_results ADD COLUMN IF NOT EXISTS ip_address INET`
      );
      await pool.query(
        `ALTER TABLE test_results ADD COLUMN IF NOT EXISTS user_agent TEXT`
      );
    } catch (alterError) {
      console.log("Some columns may already exist:", alterError.message);
    }

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_test_results_quiz_id ON test_results(quiz_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_test_results_completed_at ON test_results(completed_at)`
    );

    // Insert default quizzes if they don't exist
    const quizCount = await pool.query("SELECT COUNT(*) FROM quizzes");
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
          JSON.stringify([
            {
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
          JSON.stringify([
            {
              id: 1,
              question: "В якому році Україна отримала незалежність?",
              options: ["1990", "1991", "1992", "1993"],
              correct: 1,
            },
            {
              id: 2,
              question: "Хто був першим президентом України?",
              options: [
                "Леонід Кравчук",
                "Леонід Кучма",
                "Віктор Ющенко",
                "Петро Порошенко",
              ],
              correct: 0,
            },
          ]),
        ]
      );
    }

    // Create default admin user
    await createDefaultAdmin();

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Authentication Routes

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email та пароль обов'язкові" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Пароль повинен містити мінімум 6 символів" });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Користувач з таким email вже існує" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      message: "Користувач успішно зареєстрований",
      token,
      userId: user.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email та пароль обов'язкові" });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Невірний email або пароль" });
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Невірний email або пароль" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "Успішний вхід",
      token,
      userId: user.id,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

// Admin Authentication Endpoint
app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body;

    console.log("[v0] Admin login attempt with password:", password);

    // Check admin password (in production, use environment variable)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "319560";
    console.log("[v0] Expected admin password:", ADMIN_PASSWORD);

    if (password !== ADMIN_PASSWORD) {
      console.log("[v0] Password mismatch");
      return res
        .status(401)
        .json({ success: false, message: "Невірний пароль" });
    }

    // Get admin user or create default admin
    const adminResult = await pool.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE role = 'admin' LIMIT 1"
    );

    let admin;
    if (adminResult.rows.length === 0) {
      console.log("[v0] No admin user found, creating default admin");
      const defaultAdminResult = await pool.query(
        "INSERT INTO users (email, first_name, last_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role",
        ["admin@nmt.gov.ua", "Адмін", "Користувач", "admin", "default_hash"]
      );
      admin = defaultAdminResult.rows[0];
    } else {
      admin = adminResult.rows[0];
    }

    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("[v0] Admin login successful, user:", admin);

    res.json({
      success: true,
      token,
      user: admin,
    });
  } catch (error) {
    console.error("[v0] Admin login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутрішня помилка сервера" });
  }
});

// Get profile endpoint
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name, birth_date, phone, school, grade, city, subjects FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Користувач не знайдений" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

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
      subjects,
    } = req.body;

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
      [
        firstName,
        lastName,
        birthDate,
        phone,
        school,
        grade,
        city,
        JSON.stringify(subjects),
        req.user.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Користувач не знайдений" });
    }

    res.json({
      message: "Профіль успішно оновлено",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

// Get all quizzes
app.get("/api/quizzes", async (req, res) => {
  try {
    const result =
      await pool.query(`SELECT id, title, description, category, difficulty, 
             jsonb_array_length(questions) as question_count
      FROM quizzes 
      ORDER BY created_at DESC`);

    const quizzes = result.rows.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      questionCount: quiz.question_count,
    }));

    res.json(quizzes);
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({ error: "Помилка отримання тестів" });
  }
});

// Get specific quiz
app.get("/api/quizzes/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM quizzes WHERE id = $1", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Тест не знайдено" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({ error: "Помилка отримання тесту" });
  }
});

app.post("/api/admin/quizzes", requireAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      difficulty,
      timeLimit,
      passingScore,
      questions,
    } = req.body;

    if (!title || !description || !questions || questions.length === 0) {
      return res.status(400).json({ error: "Відсутні обов'язкові поля" });
    }

    const processedQuestions = questions.map((q, index) => {
      const questionData = {
        id: index + 1,
        question: q.question,
        type: q.type || "single",
        image: q.image || null,
      };

      switch (q.type) {
        case "single":
        case "single-image":
          questionData.options = q.options;
          questionData.correct = q.correct;
          break;
        case "multiple":
        case "multiple-image":
          questionData.options = q.options;
          questionData.correct = Array.isArray(q.correct)
            ? q.correct
            : [q.correct];
          break;
        case "text-input":
          questionData.correctAnswer = Array.isArray(q.correctAnswer)
            ? q.correctAnswer
            : [q.correctAnswer];
          break;
        case "true-false":
          questionData.correct = q.correct;
          break;
        default:
          questionData.options = q.options;
          questionData.correct = q.correct;
      }

      return questionData;
    });

    const result = await pool.query(
      `INSERT INTO quizzes (title, description, category, difficulty, time_limit, passing_score, questions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        title,
        description,
        category || "general",
        difficulty || "medium",
        timeLimit || 60,
        passingScore || 60,
        JSON.stringify(processedQuestions),
      ]
    );

    res.json({ success: true, quiz: result.rows[0] });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ error: "Помилка створення тесту" });
  }
});

app.post("/api/quizzes/:id/submit", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quizId = Number.parseInt(req.params.id);
    const { answers, timeSpent } = req.body;
    const userId = req.user.userId;

    // Input validation
    if (!Array.isArray(answers)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "Невірний формат відповідей",
      });
    }

    if (timeSpent && (typeof timeSpent !== "number" || timeSpent < 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "Невірний формат часу виконання",
      });
    }

    // Get quiz data
    const quizResult = await client.query(
      "SELECT * FROM quizzes WHERE id = $1",
      [quizId]
    );
    if (quizResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Тест не знайдено",
      });
    }

    const quiz = quizResult.rows[0];
    const questions = quiz.questions;

    // Validate answers array length
    if (answers.length !== questions.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "Кількість відповідей не відповідає кількості питань",
      });
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = questions.length;

    questions.forEach((question, index) => {
      const userAnswer = answers[index];
      if (userAnswer !== null && userAnswer === question.correct) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / totalQuestions) * 100);

    // Save result to database
    const resultData = {
      userAnswers: answers,
      questions: questions,
      correctAnswers: correctAnswers,
      totalQuestions: totalQuestions,
      score: score,
      timeSpent: timeSpent || 0,
    };

    const insertResult = await client.query(
      `INSERT INTO test_results (user_id, quiz_id, score, correct_answers, total_questions, time_spent, results, category, difficulty, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        userId,
        quizId,
        score,
        correctAnswers,
        totalQuestions,
        timeSpent || 0,
        JSON.stringify(resultData),
        quiz.category,
        quiz.difficulty,
        req.ip,
        req.get("User-Agent"),
      ]
    );

    if (insertResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        error: "Помилка збереження результату тесту",
      });
    }

    // Update user statistics with correct calculation
    const userUpdateResult = await client.query(
      `UPDATE users SET 
       tests_completed = tests_completed + 1,
       total_score = total_score + $1
       WHERE id = $2 RETURNING tests_completed, total_score`,
      [score, userId]
    );

    if (userUpdateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        error: "Помилка оновлення статистики користувача",
      });
    }

    // Calculate and update average score separately
    const { tests_completed, total_score } = userUpdateResult.rows[0];
    const newAverageScore =
      Math.round((total_score / tests_completed) * 100) / 100;

    await client.query(`UPDATE users SET average_score = $1 WHERE id = $2`, [
      newAverageScore,
      userId,
    ]);

    // Update quiz statistics
    const quizUpdateResult = await client.query(
      `UPDATE quizzes SET 
       times_taken = times_taken + 1,
       average_score = (
         SELECT ROUND(AVG(score)::numeric, 2) FROM test_results WHERE quiz_id = $1
       )
       WHERE id = $1 RETURNING times_taken`,
      [quizId]
    );

    if (quizUpdateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        error: "Помилка оновлення статистики тесту",
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      result: {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: totalQuestions,
        timeSpent: timeSpent || 0,
        resultId: insertResult.rows[0].id,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submit quiz error:", error);

    // Provide more specific error messages
    let errorMessage = "Помилка збереження результатів";

    if (error.code === "23503") {
      errorMessage = "Помилка: користувач або тест не існує";
    } else if (error.code === "23505") {
      errorMessage = "Помилка: дублікат запису";
    } else if (error.code === "22P02") {
      errorMessage = "Помилка: невірний формат даних";
    } else if (error.message.includes("connection")) {
      errorMessage = "Помилка з'єднання з базою даних";
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  } finally {
    client.release();
  }
});

app.get("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id);

    // Verify user can access this data
    if (req.user.userId !== userId) {
      return res.status(403).json({ message: "Доступ заборонено" });
    }

    const result = await pool.query(
      "SELECT id, email, first_name, last_name, role, tests_completed, average_score, total_score FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Користувач не знайдений" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.get("/api/users/:id/stats", authenticateToken, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id);

    // Verify user can access this data
    if (req.user.userId !== userId) {
      return res.status(403).json({ message: "Доступ заборонено" });
    }

    // Get user stats
    const userResult = await pool.query(
      "SELECT tests_completed, average_score, total_score FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Користувач не знайдений" });
    }

    const userStats = userResult.rows[0];

    // Get recent results
    const recentResults = await pool.query(
      `SELECT tr.score, tr.completed_at, q.title as quiz_title
       FROM test_results tr
       JOIN quizzes q ON tr.quiz_id = q.id
       WHERE tr.user_id = $1
       ORDER BY tr.completed_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      stats: {
        testsCompleted: userStats.tests_completed || 0,
        averageScore: Math.round(userStats.average_score || 0),
        totalScore: userStats.total_score || 0,
      },
      recentResults: recentResults.rows,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        COALESCE(first_name || ' ' || last_name, email) as name,
        email,
        tests_completed,
        ROUND(average_score) as averageScore
       FROM users 
       WHERE tests_completed > 0 
       ORDER BY average_score DESC, tests_completed DESC 
       LIMIT 10`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Помилка отримання рейтингу" });
  }
});

app.get("/api/stats/overview", async (req, res) => {
  try {
    // Get total counts
    const totalTests = await pool.query("SELECT COUNT(*) FROM test_results");
    const totalUsers = await pool.query(
      "SELECT COUNT(*) FROM users WHERE tests_completed > 0"
    );
    const averageScore = await pool.query(
      "SELECT AVG(score) FROM test_results"
    );

    // Get category stats
    const categoryStats = await pool.query(
      `SELECT 
        category,
        COUNT(*) as count,
        ROUND(AVG(score)) as averageScore
       FROM test_results 
       WHERE category IS NOT NULL
       GROUP BY category`
    );

    const categoryStatsObj = {};
    categoryStats.rows.forEach((row) => {
      categoryStatsObj[row.category] = {
        count: Number.parseInt(row.count),
        averageScore: Number.parseInt(row.averagescore),
      };
    });

    res.json({
      totalTests: Number.parseInt(totalTests.rows[0].count),
      totalUsers: Number.parseInt(totalUsers.rows[0].count),
      averageScore: Math.round(
        Number.parseFloat(averageScore.rows[0].avg) || 0
      ),
      categoryStats: categoryStatsObj,
    });
  } catch (error) {
    console.error("Get stats overview error:", error);
    res.status(500).json({ error: "Помилка отримання статистики" });
  }
});

// Get user statistics
app.get("/api/users/:id/stats", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id);

    // Get user info
    const userResult = await pool.query(
      "SELECT id, first_name, last_name, email, role, total_score FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Користувач не знайдений" });
    }

    const user = userResult.rows[0];

    // Get user statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as tests_completed,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(SUM(score), 0) as total_score
      FROM test_results 
      WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

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
      [userId]
    );

    const categoryStats = {};
    categoryStatsResult.rows.forEach((row) => {
      categoryStats[row.category] = {
        testsCompleted: Number.parseInt(row.tests_completed),
        totalScore: Number.parseInt(row.total_score),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
      };
    });

    // Get recent results
    const recentResults = await pool.query(
      `SELECT tr.*, q.title as quiz_title
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      WHERE tr.user_id = $1
      ORDER BY tr.completed_at DESC
      LIMIT 5`,
      [userId]
    );

    res.json({
      user: {
        id: user.id,
        name:
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email,
        role: user.role || "student",
      },
      stats: {
        testsCompleted: Number.parseInt(stats.tests_completed),
        totalScore: Number.parseInt(stats.total_score),
        averageScore: Math.round(Number.parseFloat(stats.average_score)),
        categoryStats,
      },
      recentResults: recentResults.rows,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: "Помилка отримання статистики" });
  }
});

// Get leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
      u.id,
      COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as name,
      COALESCE(u.total_score, 0) as total_score,
      COUNT(tr.id) as tests_completed,
      COALESCE(AVG(tr.score), 0) as average_score
      FROM users u
      LEFT JOIN test_results tr ON u.id = tr.user_id
      WHERE u.role = 'student' OR u.role IS NULL
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.total_score
      ORDER BY average_score DESC, total_score DESC
      LIMIT 20`);

    const leaderboard = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      totalScore: Number.parseInt(row.total_score),
      testsCompleted: Number.parseInt(row.tests_completed),
      averageScore: Math.round(Number.parseFloat(row.average_score)),
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Помилка отримання рейтингу" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const result =
      await pool.query(`SELECT id, email, first_name, last_name, role 
      FROM users 
      ORDER BY created_at DESC`);

    const users = result.rows.map((user) => ({
      id: user.id,
      name:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
      email: user.email,
      role: user.role || "student",
    }));

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Помилка отримання користувачів" });
  }
});

// Get overall statistics
app.get("/api/stats/overview", async (req, res) => {
  try {
    // Get basic stats
    const totalTestsResult = await pool.query(
      "SELECT COUNT(*) FROM test_results"
    );
    const totalUsersResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student' OR role IS NULL"
    );
    const totalQuizzesResult = await pool.query("SELECT COUNT(*) FROM quizzes");
    const averageScoreResult = await pool.query(
      "SELECT COALESCE(AVG(score), 0) as avg_score FROM test_results"
    );

    // Get category stats
    const categoryStatsResult = await pool.query(`SELECT 
      category,
      COUNT(*) as count,
      COALESCE(AVG(score), 0) as average_score,
      COALESCE(SUM(score), 0) as total_score
      FROM test_results 
      GROUP BY category`);

    const categoryStats = {};
    categoryStatsResult.rows.forEach((row) => {
      categoryStats[row.category] = {
        count: Number.parseInt(row.count),
        totalScore: Number.parseInt(row.total_score),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
      };
    });

    // Get recent activity
    const recentActivityResult =
      await pool.query(`SELECT tr.*, q.title as quiz_title, 
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as user_name
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      JOIN users u ON tr.user_id = u.id
      ORDER BY tr.completed_at DESC
      LIMIT 10`);

    res.json({
      totalTests: Number.parseInt(totalTestsResult.rows[0].count),
      totalUsers: Number.parseInt(totalUsersResult.rows[0].count),
      totalQuizzes: Number.parseInt(totalQuizzesResult.rows[0].count),
      averageScore: Math.round(
        Number.parseFloat(averageScoreResult.rows[0].avg_score)
      ),
      categoryStats,
      recentActivity: recentActivityResult.rows,
    });
  } catch (error) {
    console.error("Get overview stats error:", error);
    res.status(500).json({ error: "Помилка отримання загальної статистики" });
  }
});

// Admin Routes (require authentication)

// Admin Dashboard Endpoint with Real Data
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    // Get total users
    const usersResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role != 'admin'"
    );
    const totalUsers = Number.parseInt(usersResult.rows[0].count);

    // Get total quizzes
    const quizzesResult = await pool.query("SELECT COUNT(*) FROM quizzes");
    const totalQuizzes = Number.parseInt(quizzesResult.rows[0].count);

    // Get total results
    const resultsResult = await pool.query("SELECT COUNT(*) FROM test_results");
    const totalResults = Number.parseInt(resultsResult.rows[0].count);

    // Get average score
    const avgScoreResult = await pool.query(
      "SELECT AVG(score) as avg_score FROM test_results"
    );
    const averageScore = Math.round(avgScoreResult.rows[0].avg_score || 0);

    // Get recent activity
    const recentActivity = await pool.query(`SELECT 
        tr.id,
        tr.score,
        tr.completed_at,
        tr.category,
        u.first_name || ' ' || u.last_name as user_name,
        q.title as quiz_title
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN quizzes q ON tr.quiz_id = q.id
      ORDER BY tr.completed_at DESC
      LIMIT 10`);

    // Get category stats
    const categoryStats = await pool.query(`SELECT 
        category,
        COUNT(*) as total_tests,
        AVG(score) as avg_score
      FROM test_results
      GROUP BY category
      ORDER BY total_tests DESC`);

    res.json({
      totalUsers,
      totalQuizzes,
      totalResults,
      averageScore,
      recentActivity: recentActivity.rows,
      categoryStats: categoryStats.rows,
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ error: "Помилка отримання даних дашборду" });
  }
});

// Admin Users Endpoint
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    console.log("[v0] Admin users endpoint called");

    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.school,
        u.grade,
        u.city,
        u.total_score,
        u.created_at,
        COUNT(tr.id) as tests_completed,
        COALESCE(AVG(tr.score), 0) as average_score
      FROM users u
      LEFT JOIN test_results tr ON u.id = tr.user_id
      WHERE u.role != 'admin' OR u.role IS NULL
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.school, u.grade, u.city, u.total_score, u.created_at
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map((user) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
      role: user.role || "student",
      school: user.school,
      grade: user.grade,
      city: user.city,
      totalScore: Number.parseInt(user.total_score) || 0,
      testsCompleted: Number.parseInt(user.tests_completed),
      averageScore: Math.round(Number.parseFloat(user.average_score)),
      createdAt: user.created_at,
    }));

    console.log("[v0] Returning users:", users.length);
    res.json({ users });
  } catch (error) {
    console.error("[v0] Get admin users error:", error);
    res.status(500).json({ error: "Помилка отримання користувачів" });
  }
});

// Admin Quizzes Endpoint
app.get("/api/admin/quizzes", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
        q.id,
        q.title,
        q.category,
        q.difficulty,
        q.created_at,
        jsonb_array_length(q.questions) as question_count,
        COUNT(tr.id) as times_taken,
        COALESCE(AVG(tr.score), 0) as average_score
      FROM quizzes q
      LEFT JOIN test_results tr ON q.id = tr.quiz_id
      GROUP BY q.id, q.title, q.category, q.difficulty, q.created_at, q.questions
      ORDER BY q.created_at DESC`);

    const quizzes = result.rows.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      category: quiz.category,
      difficulty: quiz.difficulty,
      questionCount: quiz.question_count,
      timesTaken: Number.parseInt(quiz.times_taken),
      averageScore: Math.round(quiz.average_score),
      createdAt: quiz.created_at,
    }));

    res.json(quizzes);
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({ error: "Помилка отримання тестів" });
  }
});

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
        u.first_name || ' ' || u.last_name as user_name,
        q.title as quiz_title
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN quizzes q ON tr.quiz_id = q.id
      ORDER BY tr.completed_at DESC
      LIMIT 100`);

    const results = result.rows.map((result) => ({
      id: result.id,
      userName: result.user_name || "Без імені",
      quizTitle: result.quiz_title,
      category: result.category,
      score: result.score,
      correctAnswers: result.correct_answers,
      totalQuestions: result.total_questions,
      completedAt: result.completed_at,
    }));

    res.json(results);
  } catch (error) {
    console.error("Get results error:", error);
    res.status(500).json({ error: "Помилка отримання результатів" });
  }
});

// Update existing quiz
app.put("/api/admin/quizzes/:id", requireAdmin, async (req, res) => {
  try {
    const quizId = Number.parseInt(req.params.id);
    const { title, description, category, difficulty, questions } = req.body;

    const questionsWithIds = questions
      ? questions.map((q, index) => ({
          id: index + 1,
          question: q.question,
          options: q.options,
          correct: q.correct,
        }))
      : null;

    const result = await pool.query(
      `UPDATE quizzes SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        difficulty = COALESCE($4, difficulty),
        questions = COALESCE($5, questions),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [
        title,
        description,
        category,
        difficulty,
        questionsWithIds ? JSON.stringify(questionsWithIds) : null,
        quizId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Тест не знайдено" });
    }

    res.json({ success: true, quiz: result.rows[0] });
  } catch (error) {
    console.error("Update quiz error:", error);
    res.status(500).json({ error: "Помилка оновлення тесту" });
  }
});

// Delete quiz
app.delete("/api/admin/quizzes/:id", requireAdmin, async (req, res) => {
  try {
    const quizId = Number.parseInt(req.params.id);

    const result = await pool.query(
      "DELETE FROM quizzes WHERE id = $1 RETURNING id",
      [quizId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Тест не знайдено" });
    }

    res.json({ success: true, message: "Тест успішно видалено" });
  } catch (error) {
    console.error("Delete quiz error:", error);
    res.status(500).json({ error: "Помилка видалення тесту" });
  }
});

// Get all test results (admin only)
app.get("/api/admin/results", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT tr.*, q.title as quiz_title,
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as user_name
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      JOIN users u ON tr.user_id = u.id
      ORDER BY tr.completed_at DESC`);

    res.json(result.rows);
  } catch (error) {
    console.error("Get admin results error:", error);
    res.status(500).json({ error: "Помилка отримання результатів" });
  }
});

// Get detailed analytics (admin only)
app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    // Basic stats
    const totalQuizzesResult = await pool.query("SELECT COUNT(*) FROM quizzes");
    const totalUsersResult = await pool.query("SELECT COUNT(*) FROM users");
    const totalResultsResult = await pool.query(
      "SELECT COUNT(*) FROM test_results"
    );
    const averageScoreResult = await pool.query(
      "SELECT COALESCE(AVG(score), 0) as avg_score FROM test_results"
    );

    // Quiz performance
    const quizPerformanceResult =
      await pool.query(`SELECT q.id, q.title, q.difficulty, q.category,
             COUNT(tr.id) as times_completed,
             COALESCE(AVG(tr.score), 0) as average_score
      FROM quizzes q
      LEFT JOIN test_results tr ON q.id = tr.quiz_id
      GROUP BY q.id, q.title, q.difficulty, q.category
      ORDER BY times_completed DESC`);

    // Category statistics
    const categoryStatsResult = await pool.query(`SELECT 
        q.category,
        COUNT(DISTINCT q.id) as quiz_count,
        COUNT(tr.id) as completions,
        COALESCE(AVG(tr.score), 0) as average_score
      FROM quizzes q
      LEFT JOIN test_results tr ON q.id = tr.quiz_id
      GROUP BY q.category`);

    // Recent activity
    const recentActivityResult =
      await pool.query(`SELECT tr.id, tr.score, tr.completed_at,
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as user_name,
             q.title as quiz_title
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN quizzes q ON tr.quiz_id = q.id
      ORDER BY tr.completed_at DESC
      LIMIT 20`);

    const analytics = {
      totalQuizzes: Number.parseInt(totalQuizzesResult.rows[0].count),
      totalUsers: Number.parseInt(totalUsersResult.rows[0].count),
      totalResults: Number.parseInt(totalResultsResult.rows[0].count),
      averageScore: Math.round(
        Number.parseFloat(averageScoreResult.rows[0].avg_score)
      ),

      quizPerformance: quizPerformanceResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        timesCompleted: Number.parseInt(row.times_completed),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
        difficulty: row.difficulty,
        category: row.category,
      })),

      categoryStats: categoryStatsResult.rows.map((row) => ({
        category: row.category,
        quizCount: Number.parseInt(row.quiz_count),
        completions: Number.parseInt(row.completions),
        averageScore: Math.round(Number.parseFloat(row.average_score)),
      })),

      recentActivity: recentActivityResult.rows,
    };

    res.json(analytics);
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Помилка отримання аналітики" });
  }
});

// Admin Users Management

// Get all users with detailed information (admin only)
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    console.log("[v0] Admin users endpoint called");

    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.school, u.grade, u.city, u.total_score, u.created_at,
             COUNT(tr.id) as tests_completed,
             COALESCE(AVG(tr.score), 0) as average_score
      FROM users u
      LEFT JOIN test_results tr ON u.id = tr.user_id
      WHERE u.role != 'admin' OR u.role IS NULL
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.school, u.grade, u.city, u.total_score, u.created_at
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map((user) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
      role: user.role || "student",
      school: user.school,
      grade: user.grade,
      city: user.city,
      totalScore: Number.parseInt(user.total_score) || 0,
      testsCompleted: Number.parseInt(user.tests_completed),
      averageScore: Math.round(Number.parseFloat(user.average_score)),
      createdAt: user.created_at,
    }));

    console.log("[v0] Returning users:", users.length);
    res.json({ users });
  } catch (error) {
    console.error("[v0] Get admin users error:", error);
    res.status(500).json({ error: "Помилка отримання користувачів" });
  }
});

// Create new user (admin only)
app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email та пароль обов'язкові" });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Користувач з таким email вже існує" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, role || "student"]
    );

    res.status(201).json({
      success: true,
      message: "Користувач успішно створений",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

// Update user (admin only)
app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id);
    const { email, firstName, lastName, role } = req.body;

    const result = await pool.query(
      `UPDATE users SET 
        email = COALESCE($1, email),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        role = COALESCE($4, role),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, email, first_name, last_name, role`,
      [email, firstName, lastName, role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Користувач не знайдений" });
    }

    res.json({
      success: true,
      message: "Користувач успішно оновлений",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Помилка оновлення користувача" });
  }
});

// Delete user (admin only)
app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id);

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Користувач не знайдений" });
    }

    res.json({
      success: true,
      message: "Користувач успішно видалений",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Помилка видалення користувача" });
  }
});

// Enhanced Quiz Management

// Get quiz performance statistics (admin only)
app.get("/api/admin/quiz-performance", requireAdmin, async (req, res) => {
  try {
    const result =
      await pool.query(`SELECT q.id, q.title, q.category, q.difficulty,
             COUNT(tr.id) as times_completed,
             COALESCE(AVG(tr.score), 0) as average_score,
             COALESCE(MIN(tr.score), 0) as min_score,
             COALESCE(MAX(tr.score), 0) as max_score,
             jsonb_array_length(q.questions) as question_count
      FROM quizzes q
      LEFT JOIN test_results tr ON q.id = tr.quiz_id
      GROUP BY q.id, q.title, q.category, q.difficulty, q.questions
      ORDER BY times_completed DESC`);

    const performance = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      difficulty: row.difficulty,
      timesCompleted: Number.parseInt(row.times_completed),
      averageScore: Math.round(Number.parseFloat(row.average_score)),
      minScore: Number.parseInt(row.min_score),
      maxScore: Number.parseInt(row.max_score),
      questionCount: Number.parseInt(row.question_count),
    }));

    res.json(performance);
  } catch (error) {
    console.error("Get quiz performance error:", error);
    res.status(500).json({ error: "Помилка отримання статистики тестів" });
  }
});

// Enhanced Results Management

// Get detailed test result (admin only)
app.get("/api/admin/results/:id", requireAdmin, async (req, res) => {
  try {
    const resultId = Number.parseInt(req.params.id);

    const result = await pool.query(
      `SELECT tr.*, q.title as quiz_title, q.questions,
             CONCAT(u.first_name, ' ', u.last_name) as user_name,
             u.email as user_email
      FROM test_results tr
      JOIN quizzes q ON tr.quiz_id = q.id
      JOIN users u ON tr.user_id = u.id
      WHERE tr.id = $1`,
      [resultId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Результат не знайдений" });
    }

    const testResult = result.rows[0];

    res.json({
      id: testResult.id,
      user: {
        name: testResult.user_name,
        email: testResult.user_email,
      },
      quiz: {
        title: testResult.quiz_title,
        questions: testResult.questions,
      },
      score: testResult.score,
      correctAnswers: testResult.correct_answers,
      totalQuestions: testResult.total_questions,
      results: testResult.results,
      category: testResult.category,
      completedAt: testResult.completed_at,
    });
  } catch (error) {
    console.error("Get detailed result error:", error);
    res.status(500).json({ error: "Помилка отримання детального результату" });
  }
});

// Advanced Analytics

// Get time-based analytics (admin only)
app.get("/api/admin/analytics/time-based", requireAdmin, async (req, res) => {
  try {
    const { period = 30 } = req.query; // days

    // Daily activity for the period
    const dailyActivity = await pool.query(`SELECT DATE(completed_at) as date,
             COUNT(*) as tests_completed,
             COALESCE(AVG(score), 0) as average_score
      FROM test_results
      WHERE completed_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY DATE(completed_at)
      ORDER BY date DESC`);

    // Hourly distribution
    const hourlyDistribution =
      await pool.query(`SELECT EXTRACT(HOUR FROM completed_at) as hour,
             COUNT(*) as count
      FROM test_results
      WHERE completed_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY EXTRACT(HOUR FROM completed_at)
      ORDER BY hour`);

    // Category trends
    const categoryTrends = await pool.query(`SELECT category,
             DATE(completed_at) as date,
             COUNT(*) as count,
             COALESCE(AVG(score), 0) as average_score
      FROM test_results
      WHERE completed_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY category, DATE(completed_at)
      ORDER BY date DESC, category`);

    res.json({
      dailyActivity: dailyActivity.rows,
      hourlyDistribution: hourlyDistribution.rows,
      categoryTrends: categoryTrends.rows,
    });
  } catch (error) {
    console.error("Get time-based analytics error:", error);
    res.status(500).json({ error: "Помилка отримання аналітики за часом" });
  }
});

// Get user engagement analytics (admin only)
app.get("/api/admin/analytics/engagement", requireAdmin, async (req, res) => {
  try {
    // User activity levels
    const userActivity = await pool.query(`SELECT 
        CASE 
          WHEN test_count = 0 THEN 'Неактивні'
          WHEN test_count <= 5 THEN 'Низька активність'
          WHEN test_count <= 15 THEN 'Середня активність'
          ELSE 'Висока активність'
        END as activity_level,
        COUNT(*) as user_count
      FROM (
        SELECT u.id, COUNT(tr.id) as test_count
        FROM users u
        LEFT JOIN test_results tr ON u.id = tr.user_id
        WHERE u.role = 'student' OR u.role IS NULL
        GROUP BY u.id
      ) user_tests
      GROUP BY activity_level`);

    // Retention analysis
    const retention = await pool.query(`SELECT 
        DATE_TRUNC('week', completed_at) as week,
        COUNT(DISTINCT user_id) as active_users
      FROM test_results
      WHERE completed_at >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', completed_at)
      ORDER BY week`);

    // Score distribution
    const scoreDistribution = await pool.query(`SELECT 
        CASE 
          WHEN score < 40 THEN '0-39%'
          WHEN score < 60 THEN '40-59%'
          WHEN score < 80 THEN '60-79%'
          ELSE '80-100%'
        END as score_range,
        COUNT(*) as count
      FROM test_results
      GROUP BY score_range
      ORDER BY score_range`);

    res.json({
      userActivity: userActivity.rows,
      retention: retention.rows,
      scoreDistribution: scoreDistribution.rows,
    });
  } catch (error) {
    console.error("Get engagement analytics error:", error);
    res.status(500).json({ error: "Помилка отримання аналітики залученості" });
  }
});

// System Settings Management

// Get system settings (admin only)
app.get("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    // For now, return default settings
    // In production, you might store these in a settings table
    const settings = {
      general: {
        platformName: "НМТ Платформа",
        maxTestTime: 60,
        passingScore: 60,
      },
      security: {
        tokenLifetime: 24,
        maxLoginAttempts: 5,
        requireEmailVerification: false,
      },
    };

    res.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Помилка отримання налаштувань" });
  }
});

// Update system settings (admin only)
app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const { general, security } = req.body;

    // In production, you would save these to a database
    // For now, just return success

    res.json({
      success: true,
      message: "Налаштування успішно збережені",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Помилка збереження налаштувань" });
  }
});

// Export data (admin only)
app.get("/api/admin/export/:type", requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = "json" } = req.query;

    let data;
    let filename;

    switch (type) {
      case "users":
        const usersResult =
          await pool.query(`SELECT u.*, COUNT(tr.id) as tests_completed,
                 COALESCE(AVG(tr.score), 0) as average_score
          FROM users u
          LEFT JOIN test_results tr ON u.id = tr.user_id
          GROUP BY u.id`);
        data = usersResult.rows;
        filename = "users_export";
        break;

      case "results":
        const resultsResult =
          await pool.query(`SELECT tr.*, q.title as quiz_title,
                 CONCAT(u.first_name, ' ', u.last_name) as user_name
          FROM test_results tr
          JOIN quizzes q ON tr.quiz_id = q.id
          JOIN users u ON tr.user_id = u.id
          ORDER BY tr.completed_at DESC`);
        data = resultsResult.rows;
        filename = "results_export";
        break;

      case "quizzes":
        const quizzesResult = await pool.query("SELECT * FROM quizzes");
        data = quizzesResult.rows;
        filename = "quizzes_export";
        break;

      default:
        return res.status(400).json({ error: "Невідомий тип експорту" });
    }

    if (format === "csv") {
      // Convert to CSV format
      const csv = convertToCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`
      );
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.json"`
      );
      res.json(data);
    }
  } catch (error) {
    console.error("Export data error:", error);
    res.status(500).json({ error: "Помилка експорту даних" });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data.length) return "";

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(",");

  const csvRows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",")
  );

  return [csvHeaders, ...csvRows].join("\n");
}

// Static file routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "auth.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "profile.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Start server
app.listen(PORT, async () => {
  console.log(
    `Educational Platform server running on http://localhost:${PORT}`
  );
  await initDatabase();
});

async function createDefaultAdmin() {
  try {
    // Check if admin already exists
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'admin'"
    );

    if (adminCheck.rows.length === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash("319560", 10);

      await pool.query(
        `INSERT INTO users (email, first_name, last_name, role, password_hash) VALUES ($1, $2, $3, $4, $5)`,
        ["admin@nmt.ua", "Admin", "User", "admin", hashedPassword]
      );

      console.log("Default admin user created: admin@nmt.ua / 319560");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}
