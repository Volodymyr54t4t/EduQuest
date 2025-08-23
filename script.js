// Global variables
const currentUser = { id: 1, name: "Студент 1", role: "student" };
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizzes = [];
let quizStartTime = null;
let detailedResults = null;

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  setupEventListeners();
  loadDashboard();
});

function initializeApp() {
  // Update user info in sidebar
  document.getElementById("currentUserName").textContent = currentUser.name;
  document.getElementById("currentUserRole").textContent = currentUser.role;

  // Load initial data
  loadQuizzes();
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", function () {
      const section = this.dataset.section;
      navigateToSection(section);
    });
  });

  // Quiz controls
  document
    .getElementById("prevQuestion")
    .addEventListener("click", previousQuestion);
  document
    .getElementById("nextQuestion")
    .addEventListener("click", nextQuestion);
  document.getElementById("submitQuiz").addEventListener("click", submitQuiz);

  // Results actions
  document
    .getElementById("backToQuizzes")
    .addEventListener("click", () => navigateToSection("quizzes"));
  document
    .getElementById("viewDetailedResults")
    .addEventListener("click", showDetailedResults);
  document.getElementById("backToResults").addEventListener("click", () => {
    document.getElementById("detailed-results").classList.remove("active");
    document.getElementById("quiz-results").classList.add("active");
  });
}

function navigateToSection(sectionName) {
  // Update navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  document
    .querySelector(`[data-section="${sectionName}"]`)
    .classList.add("active");

  // Show section
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(sectionName).classList.add("active");

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
}

// Dashboard functions
async function loadDashboard() {
  try {
    const response = await fetch(`/api/users/${currentUser.id}/stats`);
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
        '<p style="text-align: center; color: var(--muted-foreground); padding: 2rem;">Ще немає результатів тестів</p>';
    } else {
      recentResultsContainer.innerHTML = data.recentResults
        .map(
          (result) => `
                <div class="result-item">
                    <div class="result-info">
                        <h4>Тест #${result.quizId}</h4>
                        <div class="result-date">${new Date(
                          result.completedAt
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
    const quizEndTime = new Date();
    const timeSpentMs = quizEndTime - quizStartTime;
    const timeSpentMinutes = Math.round(timeSpentMs / 1000 / 60); // Keep for server compatibility

    const response = await fetch(`/api/quizzes/${currentQuiz.id}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUser.id,
        answers: userAnswers,
        timeSpent: timeSpentMinutes,
      }),
    });

    const result = await response.json();

    if (result.success) {
      detailedResults = {
        ...result.result,
        timeSpent: timeSpentMinutes,
        timeSpentMs: timeSpentMs,
        questions: currentQuiz.questions,
        userAnswers: userAnswers,
      };
      showResults(result.result);
    }
  } catch (error) {
    console.error("Error submitting quiz:", error);
  }
}

function showResults(result) {
  // Show results section
  document.getElementById("quiz-taking").classList.remove("active");
  document.getElementById("quiz-results").classList.add("active");

  // Update results
  document.getElementById("finalScore").textContent = `${result.score}%`;
  document.getElementById("correctCount").textContent = result.correctAnswers;
  document.getElementById("totalCount").textContent = result.totalQuestions;
}

function showDetailedResults() {
  if (!detailedResults) {
    alert("Детальні результати недоступні");
    return;
  }

  // Hide results section and show detailed results
  document.getElementById("quiz-results").classList.remove("active");
  document.getElementById("detailed-results").classList.add("active");

  // Update detailed summary
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

  // Generate detailed questions review
  const questionsReview = document.getElementById("questionsReview");
  questionsReview.innerHTML = detailedResults.questions
    .map((question, index) => {
      const userAnswer = detailedResults.userAnswers[index];
      const correctAnswer = question.correct;
      const isCorrect = userAnswer === correctAnswer;

      return `
      <div class="question-review ${isCorrect ? "correct" : "incorrect"}">
        <div class="question-header">
          <span class="question-number">Питання ${index + 1}</span>
          <span class="question-status ${
            isCorrect ? "status-correct" : "status-incorrect"
          }">
            ${isCorrect ? "✓ Правильно" : "✗ Неправильно"}
          </span>
        </div>
        <div class="question-text">${question.question}</div>
        <div class="answers-review">
          ${question.options
            .map((option, optionIndex) => {
              let className = "answer-option";
              if (optionIndex === correctAnswer) {
                className += " correct-answer";
              }
              if (optionIndex === userAnswer && userAnswer !== correctAnswer) {
                className += " user-wrong-answer";
              }
              if (optionIndex === userAnswer && userAnswer === correctAnswer) {
                className += " user-correct-answer";
              }

              return `
              <div class="${className}">
                ${option}
                ${
                  optionIndex === correctAnswer
                    ? ' <span class="answer-label">(Правильна відповідь)</span>'
                    : ""
                }
                ${
                  optionIndex === userAnswer && userAnswer !== correctAnswer
                    ? ' <span class="answer-label">(Ваша відповідь)</span>'
                    : ""
                }
              </div>
            `;
            })
            .join("")}
        </div>
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
                    <div class="leaderboard-name">${user.name}</div>
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
              '<p style="text-align: center; color: var(--muted-foreground); padding: 1rem;">Немає даних</p>'
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
