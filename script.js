// Global variables
let currentUser = null;
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizzes = [];
let quizStartTime = null;
let detailedResults = null;
let isAuthenticating = false;
let authRetryCount = 0;
const MAX_AUTH_RETRIES = 3;
const authCheckTimeout = null;
let lastAuthCheck = 0;
const AUTH_CHECK_COOLDOWN = 5000; // 5 seconds cooldown between auth checks

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  if (!isAuthenticating) {
    checkAuthentication();
  }
});

async function checkAuthentication() {
  const now = Date.now();
  if (isAuthenticating || now - lastAuthCheck < AUTH_CHECK_COOLDOWN) {
    return;
  }

  isAuthenticating = true;
  lastAuthCheck = now;
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  if (!token || !userId) {
    if (
      !window.location.pathname.includes("auth.html") &&
      !window.location.pathname.includes("index.html")
    ) {
      isAuthenticating = false;
      setTimeout(() => {
        if (!window.location.pathname.includes("auth.html")) {
          window.location.href = "/auth.html";
        }
      }, 1000);
    } else {
      isAuthenticating = false;
    }
    return;
  }

  try {
    // Verify token and get user info
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const userData = await response.json();
      currentUser = userData;
      authRetryCount = 0; // Reset retry count on success
      isAuthenticating = false;
      initializeApp();
    } else if (response.status === 401 || response.status === 403) {
      console.warn("Authentication failed, cleaning up tokens");
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      isAuthenticating = false;

      if (!window.location.pathname.includes("auth.html")) {
        setTimeout(() => {
          if (!window.location.pathname.includes("auth.html")) {
            window.location.href = "/auth.html";
          }
        }, 2000);
      }
    } else {
      authRetryCount++;
      if (authRetryCount >= MAX_AUTH_RETRIES) {
        console.error(
          "Max authentication retries reached, redirecting to login"
        );
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        isAuthenticating = false;

        if (!window.location.pathname.includes("auth.html")) {
          setTimeout(() => {
            window.location.href = "/auth.html";
          }, 3000);
        }
      } else {
        const retryDelay = Math.min(
          2000 * Math.pow(2, authRetryCount - 1),
          10000
        );
        setTimeout(() => {
          isAuthenticating = false;
          checkAuthentication();
        }, retryDelay);
      }
    }
  } catch (error) {
    console.error("Authentication error:", error);

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      // Network error - retry without clearing tokens
      authRetryCount++;
      if (authRetryCount >= MAX_AUTH_RETRIES) {
        console.error(
          "Network connectivity issues, please check your connection"
        );
        isAuthenticating = false;
        return;
      } else {
        const retryDelay = Math.min(3000 * authRetryCount, 15000);
        setTimeout(() => {
          isAuthenticating = false;
          checkAuthentication();
        }, retryDelay);
      }
    } else {
      // Other errors - treat as auth failure
      authRetryCount++;
      if (authRetryCount >= MAX_AUTH_RETRIES) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        isAuthenticating = false;

        if (!window.location.pathname.includes("auth.html")) {
          setTimeout(() => {
            window.location.href = "/auth.html";
          }, 3000);
        }
      } else {
        setTimeout(() => {
          isAuthenticating = false;
          checkAuthentication();
        }, 2000 * authRetryCount);
      }
    }
  }
}

function initializeApp() {
  // Update user info in sidebar
  document.getElementById("currentUserName").textContent = currentUser.email;
  document.getElementById("currentUserRole").textContent =
    currentUser.role || "student";

  setupEventListeners();
  loadDashboard();
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const section = this.dataset.section;
      navigateToSection(section);
    });
  });

  // Quiz controls
  document.getElementById("prevQuestion").addEventListener("click", (e) => {
    e.preventDefault();
    previousQuestion();
  });
  document.getElementById("nextQuestion").addEventListener("click", (e) => {
    e.preventDefault();
    nextQuestion();
  });
  document.getElementById("submitQuiz").addEventListener("click", (e) => {
    e.preventDefault();
    submitQuiz();
  });

  // Results actions
  document.getElementById("backToQuizzes").addEventListener("click", (e) => {
    e.preventDefault();
    navigateToSection("quizzes");
  });
  document
    .getElementById("viewDetailedResults")
    .addEventListener("click", (e) => {
      e.preventDefault();
      showDetailedResults();
    });
  document.getElementById("backToResults").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("detailed-results").classList.remove("active");
    document.getElementById("quiz-results").classList.add("active");
  });

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

function logout() {
  if (confirm("Ви впевнені, що хочете вийти?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 500);
  }
}

let navigationTimeout = null;
function navigateToSection(sectionName) {
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
  }

  navigationTimeout = setTimeout(() => {
    // Update navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });
    const targetNav = document.querySelector(`[data-section="${sectionName}"]`);
    if (targetNav) {
      targetNav.classList.add("active");
    }

    // Show section
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add("active");
    }

    // Load section data
    switch (sectionName) {
      case "dashboard":
        loadDashboard();
        break;
      case "quizzes":
        loadQuizzes();
        break;
      case "leaderboard":
        loadLeaderboard();
        break;
      case "statistics":
        loadStatistics();
        break;
    }
  }, 100); // Small delay to prevent rapid successive calls
}

// Dashboard functions
async function loadDashboard() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`/api/users/${currentUser.id}/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      console.warn("Authentication expired during dashboard load");

      const refreshResult = await tryRefreshAuth();
      if (!refreshResult) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");

        alert("Ваша сесія закінчилася. Будь ласка, увійдіть знову.");
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
      }
      return;
    }

    const data = await response.json();

    // Update dashboard stats
    document.getElementById("userTestsCompleted").textContent =
      data.stats.testsCompleted;
    document.getElementById(
      "userAverageScore"
    ).textContent = `${data.stats.averageScore}%`;
    document.getElementById("userTotalScore").textContent =
      data.stats.totalScore;

    // Load recent results
    const recentResultsContainer = document.getElementById("recentResults");
    if (data.recentResults.length === 0) {
      recentResultsContainer.innerHTML =
        '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Ще немає результатів тестів</p>';
    } else {
      recentResultsContainer.innerHTML = data.recentResults
        .map(
          (result) => `
                <div class="result-item">
                    <div class="result-info">
                        <h4>${result.quiz_title}</h4>
                        <div class="result-date">${new Date(
                          result.completed_at
                        ).toLocaleDateString("uk-UA")}</div>
                    </div>
                    <div class="result-score">${result.score}%</div>
                </div>
            `
        )
        .join("");
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
    const recentResultsContainer = document.getElementById("recentResults");
    if (recentResultsContainer) {
      recentResultsContainer.innerHTML =
        '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Помилка завантаження даних</p>';
    }
  }
}

async function tryRefreshAuth() {
  try {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId) {
      return false;
    }

    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const userData = await response.json();
      currentUser = userData;
      return true;
    }

    return false;
  } catch (error) {
    console.error("Auth refresh failed:", error);
    return false;
  }
}

// Quiz functions
async function loadQuizzes() {
  try {
    const response = await fetch("/api/quizzes");
    quizzes = await response.json();

    const quizzesContainer = document.getElementById("quizzesList");
    quizzesContainer.innerHTML = quizzes
      .map(
        (quiz) => `
            <div class="quiz-card" onclick="startQuiz(${quiz.id})">
                <div class="quiz-title">${quiz.title}</div>
                <div class="quiz-description">${quiz.description}</div>
                <div class="quiz-meta">
                    <span>${quiz.questionCount} питань</span>
                    <span class="quiz-difficulty difficulty-${
                      quiz.difficulty
                    }">${getDifficultyText(quiz.difficulty)}</span>
                </div>
            </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading quizzes:", error);
  }
}

function getDifficultyText(difficulty) {
  const difficulties = {
    easy: "Легкий",
    medium: "Середній",
    hard: "Складний",
  };
  return difficulties[difficulty] || difficulty;
}

async function startQuiz(quizId) {
  try {
    const response = await fetch(`/api/quizzes/${quizId}`);
    currentQuiz = await response.json();
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuiz.questions.length).fill(null);
    quizStartTime = new Date();

    // Hide all sections first
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });

    // Show quiz taking section
    document.getElementById("quiz-taking").classList.add("active");

    // Update navigation state
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    // Update quiz header
    document.getElementById("quizTitle").textContent = currentQuiz.title;

    // Load first question
    loadQuestion();
  } catch (error) {
    console.error("Error starting quiz:", error);
  }
}

function loadQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];

  // Update progress
  const progress =
    ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;
  document.getElementById("progressFill").style.width = `${progress}%`;
  document.getElementById("progressText").textContent = `${
    currentQuestionIndex + 1
  } з ${currentQuiz.questions.length}`;

  // Update question
  document.getElementById("questionText").textContent = question.question;

  // Update options
  const optionsContainer = document.getElementById("optionsContainer");
  optionsContainer.innerHTML = question.options
    .map(
      (option, index) => `
        <div class="option ${
          userAnswers[currentQuestionIndex] === index ? "selected" : ""
        }" 
             onclick="selectOption(${index})">
            ${option}
        </div>
    `
    )
    .join("");

  // Update controls
  document.getElementById("prevQuestion").disabled = currentQuestionIndex === 0;

  if (currentQuestionIndex === currentQuiz.questions.length - 1) {
    document.getElementById("nextQuestion").style.display = "none";
    document.getElementById("submitQuiz").style.display = "block";
  } else {
    document.getElementById("nextQuestion").style.display = "block";
    document.getElementById("submitQuiz").style.display = "none";
  }
}

function selectOption(optionIndex) {
  userAnswers[currentQuestionIndex] = optionIndex;

  // Update UI
  document.querySelectorAll(".option").forEach((option, index) => {
    option.classList.toggle("selected", index === optionIndex);
  });
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    loadQuestion();
  }
}

function nextQuestion() {
  if (currentQuestionIndex < currentQuiz.questions.length - 1) {
    currentQuestionIndex++;
    loadQuestion();
  }
}

function formatTime(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  const ms = milliseconds % 1000;

  let timeString = "";

  if (hours > 0) {
    timeString += `${hours} год `;
  }
  if (minutes > 0) {
    timeString += `${minutes} хв `;
  }
  if (seconds > 0) {
    timeString += `${seconds} сек `;
  }
  if (ms > 0 || timeString === "") {
    timeString += `${ms} мс`;
  }

  return timeString.trim();
}

async function submitQuiz() {
  try {
    const unansweredQuestions = userAnswers.filter((answer) => answer === null);
    if (unansweredQuestions.length > 0) {
      const confirmSubmit = confirm(
        `У вас є ${unansweredQuestions.length} незаповнених питань. Ви впевнені, що хочете завершити тест?`
      );
      if (!confirmSubmit) {
        return;
      }
    }

    const quizEndTime = new Date();
    const timeSpentMs = quizEndTime - quizStartTime;
    const timeSpentMinutes = Math.round(timeSpentMs / 1000 / 60);

    const submitButton = document.getElementById("submitQuiz");
    const originalText = submitButton.textContent;
    submitButton.textContent = "Збереження результатів...";
    submitButton.disabled = true;

    const token = localStorage.getItem("token");
    const response = await fetch(`/api/quizzes/${currentQuiz.id}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        answers: userAnswers,
        timeSpent: timeSpentMinutes,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      console.warn("Session expired during quiz submission");

      const refreshResult = await tryRefreshAuth();
      if (refreshResult) {
        const retryResponse = await fetch(
          `/api/quizzes/${currentQuiz.id}/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              answers: userAnswers,
              timeSpent: timeSpentMinutes,
            }),
          }
        );

        if (retryResponse.ok) {
          const result = await retryResponse.json();
          if (result.success) {
            // Process successful submission
            detailedResults = {
              ...result.result,
              timeSpent: timeSpentMinutes,
              timeSpentMs: timeSpentMs,
              questions: currentQuiz.questions,
              userAnswers: userAnswers,
              quizTitle: currentQuiz.title,
              quizDescription: currentQuiz.description,
              difficulty: currentQuiz.difficulty,
              category: currentQuiz.category,
              completedAt: new Date().toISOString(),
              questionAnalysis: currentQuiz.questions.map((question, index) => {
                const userAnswer = userAnswers[index];
                const correctAnswer = question.correct;
                const isCorrect = userAnswer === correctAnswer;

                return {
                  questionNumber: index + 1,
                  question: question.question,
                  options: question.options,
                  userAnswer:
                    userAnswer !== null
                      ? question.options[userAnswer]
                      : "Не відповів",
                  correctAnswer: question.options[correctAnswer],
                  isCorrect: isCorrect,
                  userAnswerIndex: userAnswer,
                  correctAnswerIndex: correctAnswer,
                };
              }),
            };

            showResults(result.result);
            return;
          }
        }
      }

      alert(
        "Ваша сесія закінчилася під час збереження результатів. Будь ласка, увійдіть знову."
      );
      localStorage.removeItem("token");
      localStorage.removeItem("userId");

      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 3000);
      return;
    }

    const result = await response.json();

    if (result.success) {
      detailedResults = {
        ...result.result,
        timeSpent: timeSpentMinutes,
        timeSpentMs: timeSpentMs,
        questions: currentQuiz.questions,
        userAnswers: userAnswers,
        quizTitle: currentQuiz.title,
        quizDescription: currentQuiz.description,
        difficulty: currentQuiz.difficulty,
        category: currentQuiz.category,
        completedAt: new Date().toISOString(),
        questionAnalysis: currentQuiz.questions.map((question, index) => {
          const userAnswer = userAnswers[index];
          const correctAnswer = question.correct;
          const isCorrect = userAnswer === correctAnswer;

          return {
            questionNumber: index + 1,
            question: question.question,
            options: question.options,
            userAnswer:
              userAnswer !== null
                ? question.options[userAnswer]
                : "Не відповів",
            correctAnswer: question.options[correctAnswer],
            isCorrect: isCorrect,
            userAnswerIndex: userAnswer,
            correctAnswerIndex: correctAnswer,
          };
        }),
      };

      showResults(result.result);
    } else {
      alert(
        "Помилка при збереженні результатів: " +
          (result.error || "Невідома помилка")
      );
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  } catch (error) {
    console.error("Error submitting quiz:", error);
    alert("Помилка при збереженні результатів: " + error.message);
    const submitButton = document.getElementById("submitQuiz");
    submitButton.textContent = "Завершити тест НМТ";
    submitButton.disabled = false;
  }
}

function showResults(result) {
  // Show results section
  document.getElementById("quiz-taking").classList.remove("active");
  document.getElementById("quiz-results").classList.add("active");

  document.getElementById("finalScore").textContent = `${result.score}%`;
  document.getElementById("correctCount").textContent = result.correctAnswers;
  document.getElementById("totalCount").textContent = result.totalQuestions;

  const resultsContainer = document.querySelector(".results-summary");
  const performanceFeedback = getPerformanceFeedback(result.score);

  // Remove existing feedback if any
  const existingFeedback = resultsContainer.querySelector(
    ".performance-feedback"
  );
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Add new feedback
  const feedbackElement = document.createElement("div");
  feedbackElement.className = "performance-feedback";
  feedbackElement.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Оцінка результату:</span>
      <span style="color: ${performanceFeedback.color}; font-weight: 600;">${
    performanceFeedback.text
  }</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Час виконання:</span>
      <span>${formatTime(detailedResults.timeSpentMs)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Категорія тесту:</span>
      <span>${getCategoryName(detailedResults.category)}</span>
    </div>
  `;
  resultsContainer.appendChild(feedbackElement);
}

function getPerformanceFeedback(score) {
  if (score >= 90) {
    return { text: "Відмінно! 🎉", color: "#059669" };
  } else if (score >= 75) {
    return { text: "Добре! 👍", color: "#10b981" };
  } else if (score >= 60) {
    return { text: "Задовільно 📚", color: "#f59e0b" };
  } else if (score >= 40) {
    return { text: "Потребує покращення 📖", color: "#f97316" };
  } else {
    return { text: "Рекомендуємо повторити матеріал 📝", color: "#ef4444" };
  }
}

function showDetailedResults() {
  if (!detailedResults) {
    alert("Детальні результати недоступні");
    return;
  }

  // Hide results section and show detailed results
  document.getElementById("quiz-results").classList.remove("active");
  document.getElementById("detailed-results").classList.add("active");

  document.getElementById(
    "detailedScore"
  ).textContent = `${detailedResults.score}%`;
  document.getElementById("detailedCorrect").textContent =
    detailedResults.correctAnswers;
  document.getElementById("detailedIncorrect").textContent =
    detailedResults.totalQuestions - detailedResults.correctAnswers;
  document.getElementById("detailedTime").textContent = formatTime(
    detailedResults.timeSpentMs
  );

  const detailedHeader = document.querySelector(".detailed-header h2");
  detailedHeader.textContent = `Детальні результати: ${detailedResults.quizTitle}`;

  const summaryStats = document.querySelector(".summary-stats");
  summaryStats.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${detailedResults.score}%</span>
      <span class="stat-label">Загальний бал</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${detailedResults.correctAnswers}</span>
      <span class="stat-label">Правильно</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${
        detailedResults.totalQuestions - detailedResults.correctAnswers
      }</span>
      <span class="stat-label">Неправильно</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${formatTime(detailedResults.timeSpentMs)}</span>
      <span class="stat-label">Час проходження</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${getCategoryName(
        detailedResults.category
      )}</span>
      <span class="stat-label">Категорія</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${getDifficultyText(
        detailedResults.difficulty
      )}</span>
      <span class="stat-label">Складність</span>
    </div>
  `;

  const questionsReview = document.getElementById("questionsReview");
  questionsReview.innerHTML = detailedResults.questionAnalysis
    .map((analysis, index) => {
      const isCorrect = analysis.isCorrect;
      const wasAnswered = analysis.userAnswerIndex !== null;

      return `
      <div class="question-review ${isCorrect ? "correct" : "incorrect"}">
        <div class="question-header">
          <span class="question-number">Питання ${
            analysis.questionNumber
          }</span>
          <span class="question-status ${
            isCorrect
              ? "status-correct"
              : wasAnswered
              ? "status-incorrect"
              : "status-no-answer"
          }">
            ${
              isCorrect
                ? "✓ Правильно"
                : wasAnswered
                ? "✗ Неправильно"
                : "⚠ Не відповів"
            }
          </span>
        </div>
        <div class="question-text">${analysis.question}</div>
        <div class="answers-review">
          ${analysis.options
            .map((option, optionIndex) => {
              let className = "answer-option";
              let label = "";

              if (optionIndex === analysis.correctAnswerIndex) {
                className += " correct-answer";
                label = " (Правильна відповідь)";
              }

              if (optionIndex === analysis.userAnswerIndex) {
                if (analysis.isCorrect) {
                  className += " user-correct-answer";
                } else {
                  className += " user-wrong-answer";
                  label = " (Ваша відповідь)";
                }
              }

              return `
              <div class="${className}">
                ${option}${label}
              </div>
            `;
            })
            .join("")}
        </div>
        ${
          !wasAnswered
            ? '<div class="no-answer-note">⚠ Ви не дали відповідь на це питання</div>'
            : ""
        }
      </div>
    `;
    })
    .join("");
}

// Leaderboard functions
async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    const leaderboard = await response.json();

    const leaderboardContainer = document.getElementById("leaderboardList");
    leaderboardContainer.innerHTML = leaderboard
      .map(
        (user, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${
                      user.name || user.email
                    }</div>
                    <div class="leaderboard-stats">${
                      user.testsCompleted
                    } тестів пройдено</div>
                </div>
                <div class="leaderboard-score">${user.averageScore}%</div>
            </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading leaderboard:", error);
  }
}

// Statistics functions
async function loadStatistics() {
  try {
    const response = await fetch("/api/stats/overview");
    const stats = await response.json();

    // Update overview stats
    document.getElementById("totalTestsCount").textContent = stats.totalTests;
    document.getElementById("totalUsersCount").textContent = stats.totalUsers;
    document.getElementById(
      "averageScoreAll"
    ).textContent = `${stats.averageScore}%`;

    // Update category stats
    const categoryStatsContainer = document.getElementById("categoryStats");
    const categoryStatsHTML = Object.entries(stats.categoryStats)
      .map(
        ([category, data]) => `
            <div class="category-item">
                <div class="category-name">${getCategoryName(category)}</div>
                <div class="category-score">${data.averageScore}% (${
          data.count
        } тестів)</div>
            </div>
        `
      )
      .join("");

    categoryStatsContainer.innerHTML = `
            <h3>Статистика за категоріями</h3>
            ${
              categoryStatsHTML ||
              '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Немає даних</p>'
            }
        `;
  } catch (error) {
    console.error("Error loading statistics:", error);
  }
}

function getCategoryName(category) {
  const categories = {
    mathematics: "Математика",
    history: "Історія",
    science: "Наука",
    literature: "Література",
  };
  return categories[category] || category;
}
