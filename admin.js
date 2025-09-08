/* global Quill, katex, renderMathInElement */

class AdminPanel {
  constructor() {
    this.token = localStorage.getItem("adminToken");
    this.currentSection = "dashboard";
    this.questionCounter = 0;
    this.init();
  }

  init() {
    console.log("[v0] Initializing admin panel");
    this.setupEventListeners();

    if (this.token) {
      this.showAdminPanel();
      this.loadDashboard();
      this.loadUsers();
      this.loadQuizzes();
    } else {
      this.showLoginModal();
    }
  }

  setupEventListeners() {
    // Login form
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout button
    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.logout();
    });

    // Navigation buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchSection(e.target.dataset.section);
      });
    });

    // Refresh buttons
    document.getElementById("refreshUsers").addEventListener("click", () => {
      this.loadUsers();
    });
    document.getElementById("refreshQuizzes").addEventListener("click", () => {
      this.loadQuizzes();
    });
    document.getElementById("refreshResults").addEventListener("click", () => {
      this.loadResults();
    });

    // Create quiz button
    document.getElementById("createQuiz").addEventListener("click", () => {
      this.showCreateQuizModal();
    });

    // Add question button
    const addQuestionBtn = document.getElementById("addQuestion");
    if (addQuestionBtn) {
      console.log("[v0] Add question button found, attaching event listener");
      addQuestionBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[v0] Add question button clicked");
        const questionTypeSelect = document.getElementById("questionType");
        const questionType = questionTypeSelect
          ? questionTypeSelect.value
          : "single";
        console.log("[v0] Question type:", questionType);
        this.addQuestion(questionType);
      });
    } else {
      console.error("[v0] Add question button not found!");
    }

    // Modal close buttons
    document.querySelectorAll(".close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", (e) => {
        e.target.closest(".modal").style.display = "none";
      });
    });

    // Edit user form
    document.getElementById("editUserForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.updateUser();
    });

    // Create quiz form
    document
      .getElementById("createQuizForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.createQuiz();
      });

    // Close modals when clicking outside
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    });
  }

  async handleLogin() {
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("loginError");
    const submitBtn = document.querySelector(
      "#loginForm button[type='submit']"
    );

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Вхід...";

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.token = data.token;
        localStorage.setItem("adminToken", this.token);
        this.showAdminPanel();
        this.loadDashboard();
        errorDiv.style.display = "none";

        if (data.user) {
          document.getElementById(
            "adminInfo"
          ).textContent = `${data.user.first_name} ${data.user.last_name} (${data.user.email})`;
        }
      } else {
        errorDiv.textContent = data.message || "Помилка входу";
        errorDiv.style.display = "block";
      }
    } catch (error) {
      console.error("Login error:", error);
      errorDiv.textContent = "Помилка з'єднання з сервером";
      errorDiv.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Увійти";
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem("adminToken");
    this.showLoginModal();
    document.getElementById("adminInfo").textContent = "";
  }

  showLoginModal() {
    document.getElementById("loginModal").style.display = "flex";
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("password").focus();
  }

  showAdminPanel() {
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
  }

  switchSection(section) {
    // Update navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    // Update sections
    document.querySelectorAll(".admin-section").forEach((sec) => {
      sec.classList.remove("active");
    });
    document.getElementById(section).classList.add("active");

    this.currentSection = section;

    // Load section data
    switch (section) {
      case "dashboard":
        this.loadDashboard();
        break;
      case "users":
        this.loadUsers();
        break;
      case "quizzes":
        this.loadQuizzes();
        break;
      case "results":
        this.loadResults();
        break;
    }
  }

  async apiRequest(url, options = {}) {
    const defaultOptions = {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });

      if (response.status === 401 || response.status === 403) {
        this.logout();
        return null;
      }

      return response;
    } catch (error) {
      console.error("API request error:", error);
      return null;
    }
  }

  async loadDashboard() {
    try {
      console.log("[v0] Loading dashboard stats");

      const response = await this.apiRequest("/api/admin/dashboard");
      if (!response || !response.ok) {
        console.error("[v0] Dashboard API response failed");
        this.showDashboardError();
        return;
      }

      const stats = await response.json();
      console.log("[v0] Dashboard stats received:", stats);

      // Update basic stats
      document.getElementById("statsUsers").textContent = stats.totalUsers || 0;
      document.getElementById("statsQuizzes").textContent =
        stats.totalQuizzes || 0;
      document.getElementById("statsResults").textContent =
        stats.totalResults || 0;
      document.getElementById("statsAvgScore").textContent =
        (stats.averageScore || 0) + "%";

      // Update additional stats if elements exist
      const activeUsersEl = document.getElementById("statsActiveUsers");
      if (activeUsersEl) {
        activeUsersEl.textContent = stats.activeUsers || 0;
      }

      const todayResultsEl = document.getElementById("statsTodayResults");
      if (todayResultsEl) {
        todayResultsEl.textContent = stats.todayResults || 0;
      }

      // Load top performers
      this.loadTopPerformers(stats.topPerformers || []);

      // Load category statistics
      this.loadCategoryStats(stats.categoryStats || []);

      // Load recent activity
      this.loadRecentActivity(stats.recentActivity || []);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      this.showDashboardError();
    }
  }

  showDashboardError() {
    document.getElementById("statsUsers").textContent = "Помилка";
    document.getElementById("statsQuizzes").textContent = "Помилка";
    document.getElementById("statsResults").textContent = "Помилка";
    document.getElementById("statsAvgScore").textContent = "Помилка";
  }

  loadTopPerformers(performers) {
    const container = document.getElementById("topPerformersContainer");
    if (!container) return;

    if (performers.length === 0) {
      container.innerHTML = "<p>Немає даних для відображення</p>";
      return;
    }

    container.innerHTML = performers
      .map(
        (performer, index) => `
      <div class="performer-item">
        <span class="rank">${index + 1}</span>
        <span class="name">${performer.first_name || ""} ${
          performer.last_name || ""
        }</span>
        <span class="score">${Math.round(performer.avg_score)}%</span>
        <span class="tests">${performer.tests_taken} тестів</span>
      </div>
    `
      )
      .join("");
  }

  loadCategoryStats(categories) {
    const container = document.getElementById("categoryStatsContainer");
    if (!container) return;

    if (categories.length === 0) {
      container.innerHTML = "<p>Немає даних для відображення</p>";
      return;
    }

    container.innerHTML = categories
      .map(
        (category) => `
      <div class="category-stat">
        <h4>${this.getCategoryName(category.category)}</h4>
        <div class="stat-row">
          <span>Тестів пройдено:</span>
          <span>${category.total_tests}</span>
        </div>
        <div class="stat-row">
          <span>Середній бал:</span>
          <span>${Math.round(category.avg_score)}%</span>
        </div>
        <div class="stat-row">
          <span>Унікальних користувачів:</span>
          <span>${category.unique_users}</span>
        </div>
      </div>
    `
      )
      .join("");
  }

  loadRecentActivity(activities) {
    const container = document.getElementById("recentActivityContainer");
    if (!container) return;

    if (activities.length === 0) {
      container.innerHTML = "<p>Немає останньої активності</p>";
      return;
    }

    container.innerHTML = activities
      .map(
        (activity) => `
      <div class="activity-item">
        <div class="activity-user">${activity.first_name || ""} ${
          activity.last_name || ""
        }</div>
        <div class="activity-quiz">${activity.quiz_title}</div>
        <div class="activity-score ${this.getScoreBadgeClass(
          activity.score
        )}">${activity.score}%</div>
        <div class="activity-time">${new Date(
          activity.completed_at
        ).toLocaleString("uk-UA")}</div>
      </div>
    `
      )
      .join("");
  }

  async loadUsers() {
    try {
      console.log("[v0] Loading users");

      const response = await this.apiRequest("/api/admin/users");
      if (!response) {
        console.error("[v0] No response from users API");
        this.showUsersError("Помилка з'єднання з сервером");
        return;
      }

      if (!response.ok) {
        console.error(
          "[v0] Users API response failed with status:",
          response.status
        );
        const errorText = await response.text();
        console.error("[v0] Error response:", errorText);
        this.showUsersError("Помилка завантаження користувачів");
        return;
      }

      const data = await response.json();
      console.log("[v0] Users data received:", data);

      const users = Array.isArray(data) ? data : data.users || [];
      const tbody = document.querySelector("#usersTable tbody");

      if (users.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: 40px; color: var(--text-secondary);">
              Користувачі не знайдені
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = users
        .map(
          (user) => `
        <tr>
          <td>${user.id}</td>
          <td>${user.email}</td>
          <td>${user.first_name || "-"}</td>
          <td>${user.last_name || "-"}</td>
          <td>
            <span class="badge ${
              user.role === "admin" ? "badge-danger" : "badge-primary"
            }">
              ${user.role === "admin" ? "Адмін" : "Студент"}
            </span>
          </td>
          <td>${user.school || "-"}</td>
          <td>${user.grade || "-"}</td>
          <td>${user.city || "-"}</td>
          <td>${user.totalScore || 0}</td>
          <td>${user.testsCompleted || 0}</td>
          <td class="actions">
            <button class="btn btn-success" onclick="adminPanel.editUser(${
              user.id
            })">
              Редагувати
            </button>
            <button class="btn btn-danger" onclick="adminPanel.deleteUser(${
              user.id
            })" ${
            user.role === "admin"
              ? 'disabled title="Неможливо видалити адміністратора"'
              : ""
          }>
              Видалити
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (error) {
      console.error("Error loading users:", error);
      this.showUsersError("Помилка завантаження користувачів");
    }
  }

  showUsersError(message) {
    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 40px; color: var(--danger-color);">
          ${message}
        </td>
      </tr>
    `;
  }

  async loadQuizzes() {
    try {
      console.log("[v0] Loading quizzes");

      const response = await this.apiRequest("/api/admin/quizzes");
      if (!response) {
        console.error("[v0] No response from quizzes API");
        this.showQuizzesError("Помилка з'єднання з сервером");
        return;
      }

      if (!response.ok) {
        console.error(
          "[v0] Quizzes API response failed with status:",
          response.status
        );
        this.showQuizzesError("Помилка завантаження тестів");
        return;
      }

      const quizzes = await response.json();
      console.log("[v0] Quizzes data received:", quizzes);

      const tbody = document.querySelector("#quizzesTable tbody");

      if (!Array.isArray(quizzes) || quizzes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
              Тести не знайдені
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = quizzes
        .map(
          (quiz) => `
        <tr>
          <td>${quiz.id}</td>
          <td>${quiz.title}</td>
          <td>
            <span class="badge badge-secondary">${this.getCategoryName(
              quiz.category
            )}</span>
          </td>
          <td>
            <span class="badge ${this.getDifficultyBadgeClass(
              quiz.difficulty
            )}">
              ${this.getDifficultyText(quiz.difficulty)}
            </span>
          </td>
          <td>${quiz.questionCount || quiz.question_count || 0}</td>
          <td>${quiz.timesTaken || 0}</td>
          <td>${quiz.averageScore || 0}%</td>
          <td>${new Date(quiz.createdAt || quiz.created_at).toLocaleDateString(
            "uk-UA"
          )}</td>
          <td class="actions">
            <button class="btn btn-success" onclick="adminPanel.editQuiz(${
              quiz.id
            })">
              Редагувати
            </button>
            <button class="btn btn-danger" onclick="adminPanel.deleteQuiz(${
              quiz.id
            })">
              Видалити
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (error) {
      console.error("Error loading quizzes:", error);
      this.showQuizzesError("Помилка завантаження тестів");
    }
  }

  showQuizzesError(message) {
    const tbody = document.querySelector("#quizzesTable tbody");
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--danger-color);">
          ${message}
        </td>
      </tr>
    `;
  }

  async loadResults() {
    try {
      console.log("[v0] Loading results");

      const response = await this.apiRequest("/api/admin/results");
      if (!response || !response.ok) {
        console.error("[v0] Results API response failed");
        this.showResultsError("Помилка завантаження результатів");
        return;
      }

      const results = await response.json();
      console.log("[v0] Results data received:", results);

      const tbody = document.querySelector("#resultsTable tbody");

      if (!Array.isArray(results) || results.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">
              Результати не знайдені
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = results
        .map(
          (result) => `
        <tr>
          <td>${result.id}</td>
          <td>${
            result.userName || result.user_name || "Невідомий користувач"
          }</td>
          <td>${result.quizTitle || result.quiz_title || "Невідомий тест"}</td>
          <td>
            <span class="badge badge-secondary">${this.getCategoryName(
              result.category
            )}</span>
          </td>
          <td>
            <span class="score-badge ${this.getScoreBadgeClass(result.score)}">
              ${result.score}%
            </span>
          </td>
          <td>${result.correctAnswers || result.correct_answers || 0}</td>
          <td>${result.totalQuestions || result.total_questions || 0}</td>
          <td>${new Date(
            result.completedAt || result.completed_at
          ).toLocaleDateString("uk-UA")}</td>
        </tr>
      `
        )
        .join("");
    } catch (error) {
      console.error("Error loading results:", error);
      this.showResultsError("Помилка завантаження результатів");
    }
  }

  showResultsError(message) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--danger-color);">
          ${message}
        </td>
      </tr>
    `;
  }

  getCategoryName(category) {
    const categories = {
      mathematics: "Математика",
      ukrainian: "Українська мова",
      history: "Історія України",
      biology: "Біологія",
      chemistry: "Хімія",
      physics: "Фізика",
      geography: "Географія",
      english: "Англійська мова",
      literature: "Українська література",
      general: "Загальні знання",
    };
    return categories[category] || category;
  }

  getDifficultyBadgeClass(difficulty) {
    switch (difficulty) {
      case "easy":
        return "badge-success";
      case "medium":
        return "badge-warning";
      case "hard":
        return "badge-danger";
      case "expert":
        return "quiz-difficulty-expert";
      default:
        return "badge-secondary";
    }
  }

  getDifficultyText(difficulty) {
    switch (difficulty) {
      case "easy":
        return "Легка";
      case "medium":
        return "Середня";
      case "hard":
        return "Важка";
      case "expert":
        return "Експертна";
      default:
        return "Невідома";
    }
  }

  getScoreBadgeClass(score) {
    if (score >= 80) return "score-excellent";
    if (score >= 60) return "score-good";
    if (score >= 40) return "score-fair";
    return "score-poor";
  }

  async editUser(userId) {
    try {
      const response = await this.apiRequest("/api/admin/users");
      if (!response || !response.ok) return;

      const data = await response.json();
      const users = Array.isArray(data) ? data : data.users || [];
      const user = users.find((u) => u.id === userId);

      if (user) {
        document.getElementById("editUserId").value = user.id;
        document.getElementById("editEmail").value = user.email;
        document.getElementById("editFirstName").value = user.first_name || "";
        document.getElementById("editLastName").value = user.last_name || "";
        document.getElementById("editRole").value = user.role || "student";
        document.getElementById("editSchool").value = user.school || "";
        document.getElementById("editGrade").value = user.grade || "";
        document.getElementById("editCity").value = user.city || "";

        document.getElementById("editUserModal").style.display = "flex";
      }
    } catch (error) {
      console.error("Error loading user for edit:", error);
      this.showNotification("Помилка завантаження даних користувача", "error");
    }
  }

  async updateUser() {
    const userId = document.getElementById("editUserId").value;
    const userData = {
      email: document.getElementById("editEmail").value,
      firstName: document.getElementById("editFirstName").value,
      lastName: document.getElementById("editLastName").value,
      role: document.getElementById("editRole").value,
    };

    try {
      const response = await this.apiRequest(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      });

      if (response && response.ok) {
        document.getElementById("editUserModal").style.display = "none";
        this.loadUsers();
        this.loadDashboard(); // Refresh stats
        this.showNotification("Користувача оновлено успішно", "success");
      } else {
        this.showNotification("Помилка оновлення користувача", "error");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      this.showNotification("Помилка оновлення користувача", "error");
    }
  }

  async deleteUser(userId) {
    if (!confirm("Ви впевнені, що хочете видалити цього користувача?")) {
      return;
    }

    try {
      const response = await this.apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response && response.ok) {
        this.loadUsers();
        this.loadDashboard(); // Refresh stats
        this.showNotification("Користувача видалено успішно", "success");
      } else {
        this.showNotification("Помилка видалення користувача", "error");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      this.showNotification("Помилка видалення користувача", "error");
    }
  }

  async deleteQuiz(quizId) {
    if (!confirm("Ви впевнені, що хочете видалити цей тест?")) {
      return;
    }

    try {
      const response = await this.apiRequest(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (response && response.ok) {
        this.loadQuizzes();
        this.loadDashboard(); // Refresh stats
        this.showNotification("Тест видалено успішно", "success");
      } else {
        this.showNotification("Помилка видалення тесту", "error");
      }
    } catch (error) {
      console.error("Error deleting quiz:", error);
      this.showNotification("Помилка видалення тесту", "error");
    }
  }

  async editQuiz(quizId) {
    try {
      const response = await this.apiRequest(`/api/admin/quizzes/${quizId}`);
      if (!response || !response.ok) return;

      const quiz = await response.json();

      // Fill the form with quiz data
      document.getElementById("quizTitle").value = quiz.title;
      document.getElementById("quizDescription").value = quiz.description || "";
      document.getElementById("quizCategory").value = quiz.category;
      document.getElementById("quizDifficulty").value = quiz.difficulty;
      document.getElementById("quizTimeLimit").value = quiz.time_limit || 60;
      document.getElementById("quizPassingScore").value =
        quiz.passing_score || 60;

      // Clear existing questions and add quiz questions
      document.getElementById("questionsContainer").innerHTML = "";
      this.questionCounter = 0;

      if (quiz.questions && Array.isArray(quiz.questions)) {
        quiz.questions.forEach((question) => {
          this.addQuestion(question.type || "single");
          const questionDiv = document.querySelector(
            `[data-question-id="${this.questionCounter}"]`
          );
          questionDiv.querySelector(".question-text").value = question.question;

          if (question.options) {
            const optionInputs = questionDiv.querySelectorAll(".option-text");
            question.options.forEach((option, index) => {
              if (optionInputs[index]) {
                optionInputs[index].value = option;
              }
            });
          }
        });
      }

      // Store quiz ID for updating
      document.getElementById("createQuizForm").dataset.editingQuizId = quizId;
      document.getElementById("createQuizModal").style.display = "flex";
    } catch (error) {
      console.error("Error loading quiz for edit:", error);
      this.showNotification("Помилка завантаження тесту", "error");
    }
  }

  showCreateQuizModal() {
    document.getElementById("createQuizModal").style.display = "flex";
    document.getElementById("questionsContainer").innerHTML = "";
    this.questionCounter = 0;
    delete document.getElementById("createQuizForm").dataset.editingQuizId;
    this.addQuestion("single");
  }

  addQuestion(type = "single") {
    console.log("[v0] Adding question of type:", type);
    const container = document.getElementById("questionsContainer");
    if (!container) {
      console.error("[v0] Questions container not found!");
      return;
    }

    this.questionCounter++;
    const questionNumber = this.questionCounter;
    console.log("[v0] Question number:", questionNumber);

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-item";
    questionDiv.dataset.questionId = questionNumber;
    questionDiv.dataset.questionType = type;

    let questionHTML = `
      <div class="question-header">
        <div>
          <span class="question-number">Питання ${questionNumber}</span>
          <span class="question-type-badge">${this.getQuestionTypeName(
            type
          )}</span>
          <select class="question-type-changer" onchange="adminPanel.changeQuestionType(${questionNumber}, this.value)">
            <option value="single" ${
              type === "single" ? "selected" : ""
            }>Одна правильна відповідь</option>
            <option value="multiple" ${
              type === "multiple" ? "selected" : ""
            }>Декілька правильних відповідей</option>
            <option value="matching" ${
              type === "matching" ? "selected" : ""
            }>Встановлення відповідності</option>
            <option value="ordering" ${
              type === "ordering" ? "selected" : ""
            }>Послідовність</option>
            <option value="short-answer" ${
              type === "short-answer" ? "selected" : ""
            }>Коротка відкрита відповідь</option>
            <option value="single-image" ${
              type === "single-image" ? "selected" : ""
            }>З фотографією (одна)</option>
            <option value="multiple-image" ${
              type === "multiple-image" ? "selected" : ""
            }>З фотографією (декілька)</option>
            <option value="graph-table" ${
              type === "graph-table" ? "selected" : ""
            }>Завдання з графіками/таблицями</option>
            <option value="text-based" ${
              type === "text-based" ? "selected" : ""
            }>Аналіз тексту</option>
          </select>
        </div>
        <button type="button" class="remove-question" onclick="this.parentElement.parentElement.remove(); adminPanel.updateQuestionNumbers();">×</button>
      </div>
      <div class="form-group">
        <label>Текст питання:</label>
        <textarea class="question-text" required rows="2" placeholder="Введіть текст питання..."></textarea>
      </div>
    `;

    if (type === "text-based") {
      questionHTML += `
        <div class="form-group">
          <label>Текст для аналізу:</label>
          <textarea class="text-content" rows="6" placeholder="Введіть текст, який потрібно проаналізувати..."></textarea>
        </div>
      `;
    }

    if (type.includes("image") || type === "graph-table") {
      questionHTML += `
        <div class="image-upload-section">
          <input type="file" class="image-upload-input" accept="image/*" onchange="adminPanel.handleImageUpload(this, ${questionNumber})">
          <button type="button" class="image-upload-button" onclick="this.previousElementSibling.click()">
            📷 Додати ${
              type === "graph-table" ? "графік/таблицю" : "зображення"
            }
          </button>
          <div class="image-preview" style="display: none;">
            <img src="/placeholder.svg" alt="Question image" onclick="adminPanel.previewImage(this.src)">
            <button type="button" class="image-remove" onclick="adminPanel.removeImage(${questionNumber})">×</button>
          </div>
        </div>
      `;
    }

    switch (type) {
      case "single":
      case "single-image":
        questionHTML += this.createSingleChoiceOptions(questionNumber);
        break;
      case "multiple":
      case "multiple-image":
        questionHTML += this.createMultipleChoiceOptions(questionNumber);
        break;
      case "matching":
        questionHTML += this.createMatchingOptions(questionNumber);
        break;
      case "ordering":
        questionHTML += this.createOrderingOptions(questionNumber);
        break;
      case "short-answer":
        questionHTML += this.createShortAnswerOptions(questionNumber);
        break;
      case "graph-table":
        questionHTML += this.createGraphTableOptions(questionNumber);
        break;
      case "text-based":
        questionHTML += this.createTextBasedOptions(questionNumber);
        break;
    }

    questionDiv.innerHTML = questionHTML;
    container.appendChild(questionDiv);

    questionDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });

    console.log("[v0] Question added successfully:", questionNumber);
  }

  createSingleChoiceOptions(questionNumber) {
    return `
      <div class="options-container">
        <h4>Варіанти відповідей (одна правильна):</h4>
        ${[0, 1, 2, 3]
          .map(
            (index) => `
          <div class="option-group">
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <input type="radio" name="correct_${questionNumber}" value="${index}" required>
            <input type="text" class="option-text" placeholder="Варіант ${
              index + 1
            }" required>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  createMultipleChoiceOptions(questionNumber) {
    return `
      <div class="options-container">
        <h4>Варіанти відповідей (декілька правильних):</h4>
        <p class="instruction">Відмітьте всі правильні варіанти:</p>
        ${[0, 1, 2, 3]
          .map(
            (index) => `
          <div class="option-group">
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <input type="checkbox" name="correct_${questionNumber}_${index}" value="${index}">
            <input type="text" class="option-text" placeholder="Варіант ${
              index + 1
            }" required>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  changeQuestionType(questionNumber, newType) {
    const questionDiv = document.querySelector(
      `[data-question-id="${questionNumber}"]`
    );
    if (!questionDiv) return;

    // Save current question text and text content
    const questionText = questionDiv.querySelector(".question-text").value;
    const textContent = questionDiv.querySelector(".text-content")?.value || "";

    // Update question type
    questionDiv.dataset.questionType = newType;

    // Update type badge
    const badge = questionDiv.querySelector(".question-type-badge");
    badge.textContent = this.getQuestionTypeName(newType);

    // Remove existing options container
    const existingOptions = questionDiv.querySelector(
      ".options-container, .matching-container, .ordering-container, .short-answer-container, .graph-table-container, .text-based-container"
    );
    if (existingOptions) {
      existingOptions.remove();
    }

    // Remove existing image section if not needed
    const imageSection = questionDiv.querySelector(".image-upload-section");
    if (
      imageSection &&
      !newType.includes("image") &&
      newType !== "graph-table"
    ) {
      imageSection.remove();
    }

    // Remove existing text content section if not needed
    const textContentSection =
      questionDiv.querySelector(".text-content")?.parentElement;
    if (textContentSection && newType !== "text-based") {
      textContentSection.remove();
    }

    // Add new sections based on type
    let newHTML = "";

    // Add text content section for text-based questions
    if (
      newType === "text-based" &&
      !questionDiv.querySelector(".text-content")
    ) {
      newHTML += `
        <div class="form-group">
          <label>Текст для аналізу:</label>
          <textarea class="text-content" rows="6" placeholder="Введіть текст, який потрібно проаналізувати...">${textContent}</textarea>
        </div>
      `;
    }

    // Add image section for image-based and graph-table questions
    if (
      (newType.includes("image") || newType === "graph-table") &&
      !questionDiv.querySelector(".image-upload-section")
    ) {
      newHTML += `
        <div class="image-upload-section">
          <input type="file" class="image-upload-input" accept="image/*" onchange="adminPanel.handleImageUpload(this, ${questionNumber})">
          <button type="button" class="image-upload-button" onclick="this.previousElementSibling.click()">
            📷 Додати ${
              newType === "graph-table" ? "графік/таблицю" : "зображення"
            }
          </button>
          <div class="image-preview" style="display: none;">
            <img src="/placeholder.svg" alt="Question image" onclick="adminPanel.previewImage(this.src)">
            <button type="button" class="image-remove" onclick="adminPanel.removeImage(${questionNumber})">×</button>
          </div>
        </div>
      `;
    }

    // Add appropriate options based on new type
    switch (newType) {
      case "single":
      case "single-image":
        newHTML += this.createSingleChoiceOptions(questionNumber);
        break;
      case "multiple":
      case "multiple-image":
        newHTML += this.createMultipleChoiceOptions(questionNumber);
        break;
      case "matching":
        newHTML += this.createMatchingOptions(questionNumber);
        break;
      case "ordering":
        newHTML += this.createOrderingOptions(questionNumber);
        break;
      case "short-answer":
        newHTML += this.createShortAnswerOptions(questionNumber);
        break;
      case "graph-table":
        newHTML += this.createGraphTableOptions(questionNumber);
        break;
      case "text-based":
        newHTML += this.createTextBasedOptions(questionNumber);
        break;
    }

    // Insert new HTML after the question text
    const questionTextGroup = questionDiv.querySelector(".form-group");
    questionTextGroup.insertAdjacentHTML("afterend", newHTML);

    // Restore question text
    questionDiv.querySelector(".question-text").value = questionText;
  }

  createMatchingOptions(questionNumber) {
    return `
      <div class="matching-container">
        <h4>Встановлення відповідності</h4>
        <div class="matching-pairs">
          <div class="matching-column">
            <label>Ліва колонка:</label>
            ${[0, 1, 2, 3]
              .map(
                (index) => `
              <div class="matching-item">
                <span class="item-number">${index + 1}.</span>
                <input type="text" class="left-item" placeholder="Елемент ${
                  index + 1
                }" required>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="matching-column">
            <label>Права колонка:</label>
            ${[0, 1, 2, 3]
              .map(
                (index) => `
              <div class="matching-item">
                <span class="item-letter">${String.fromCharCode(
                  65 + index
                )}.</span>
                <input type="text" class="right-item" placeholder="Відповідь ${String.fromCharCode(
                  65 + index
                )}" required>
                <select class="correct-match" required>
                  <option value="">Відповідає...</option>
                  <option value="0">1</option>
                  <option value="1">2</option>
                  <option value="2">3</option>
                  <option value="3">4</option>
                </select>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  createOrderingOptions(questionNumber) {
    return `
      <div class="ordering-container">
        <h4>Встановлення послідовності</h4>
        <p class="instruction">Введіть елементи у правильному порядку:</p>
        <div class="ordering-items">
          ${[0, 1, 2, 3, 4]
            .map(
              (index) => `
            <div class="ordering-item">
              <span class="order-number">${index + 1}.</span>
              <input type="text" class="order-item" placeholder="Крок ${
                index + 1
              }" required>
              <button type="button" class="move-up" onclick="adminPanel.moveOrderItem(this, 'up')" ${
                index === 0 ? "disabled" : ""
              }>↑</button>
              <button type="button" class="move-down" onclick="adminPanel.moveOrderItem(this, 'down')" ${
                index === 4 ? "disabled" : ""
              }>↓</button>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  createShortAnswerOptions(questionNumber) {
    return `
      <div class="short-answer-container">
        <h4>Коротка відкрита відповідь</h4>
        <div class="form-group">
          <label>Правильна відповідь (або кілька варіантів через кому):</label>
          <input type="text" class="short-answer-correct" placeholder="Наприклад: Київ, столиця України" required>
        </div>
        <div class="form-group">
          <label>Максимальна кількість символів:</label>
          <input type="number" class="max-length" value="100" min="10" max="500">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" class="case-sensitive"> Враховувати регістр
          </label>
        </div>
      </div>
    `;
  }

  createGraphTableOptions(questionNumber) {
    return `
      <div class="graph-table-container">
        <h4>Завдання з графіками/таблицями</h4>
        <div class="form-group">
          <label>Тип завдання:</label>
          <select class="graph-table-type">
            <option value="graph">Графік</option>
            <option value="table">Таблиця</option>
            <option value="chart">Діаграма</option>
            <option value="map">Карта</option>
          </select>
        </div>
        <div class="options-container">
          ${[0, 1, 2, 3]
            .map(
              (index) => `
            <div class="option-group">
              <div class="option-letter">${String.fromCharCode(
                65 + index
              )}</div>
              <input type="radio" name="correct_${questionNumber}" value="${index}" required>
              <input type="text" class="option-text" placeholder="Варіант ${
                index + 1
              }" required>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  createTextBasedOptions(questionNumber) {
    return `
      <div class="text-based-container">
        <h4>Аналіз тексту</h4>
        <div class="form-group">
          <label>Тип аналізу:</label>
          <select class="text-analysis-type">
            <option value="comprehension">Розуміння змісту</option>
            <option value="grammar">Граматичний аналіз</option>
            <option value="style">Стилістичний аналіз</option>
            <option value="literary">Літературний аналіз</option>
          </select>
        </div>
        <div class="options-container">
          ${[0, 1, 2, 3]
            .map(
              (index) => `
            <div class="option-group">
              <div class="option-letter">${String.fromCharCode(
                65 + index
              )}</div>
              <input type="radio" name="correct_${questionNumber}" value="${index}" required>
              <input type="text" class="option-text" placeholder="Варіант ${
                index + 1
              }" required>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  moveOrderItem(button, direction) {
    const item = button.closest(".ordering-item");
    const container = item.parentElement;

    if (direction === "up" && item.previousElementSibling) {
      container.insertBefore(item, item.previousElementSibling);
    } else if (direction === "down" && item.nextElementSibling) {
      container.insertBefore(item.nextElementSibling, item);
    }

    // Update order numbers and button states
    this.updateOrderNumbers(container);
  }

  updateOrderNumbers(container) {
    const items = container.querySelectorAll(".ordering-item");
    items.forEach((item, index) => {
      const numberSpan = item.querySelector(".order-number");
      numberSpan.textContent = `${index + 1}.`;

      const upBtn = item.querySelector(".move-up");
      const downBtn = item.querySelector(".move-down");

      upBtn.disabled = index === 0;
      downBtn.disabled = index === items.length - 1;
    });
  }

  getQuestionTypeName(type) {
    const types = {
      single: "Одна відповідь",
      multiple: "Декілька відповідей",
      matching: "Відповідність",
      ordering: "Послідовність",
      "short-answer": "Коротка відповідь",
      "single-image": "З фото (одна)",
      "multiple-image": "З фото (декілька)",
      "graph-table": "Графік/Таблиця",
      "text-based": "Аналіз тексту",
    };
    return types[type] || type;
  }

  async createQuiz() {
    const title = document.getElementById("quizTitle").value;
    const description = document.getElementById("quizDescription").value;
    const category = document.getElementById("quizCategory").value;
    const difficulty = document.getElementById("quizDifficulty").value;
    const timeLimit = document.getElementById("quizTimeLimit").value;
    const passingScore = document.getElementById("quizPassingScore").value;

    if (!title.trim()) {
      this.showNotification("Будь ласка, введіть назву тесту", "error");
      return;
    }

    const questionItems = document.querySelectorAll(".question-item");
    const questions = [];

    for (let i = 0; i < questionItems.length; i++) {
      const item = questionItems[i];
      const questionType = item.dataset.questionType;
      const questionText = item.querySelector(".question-text").value;

      if (!questionText.trim()) {
        this.showNotification(
          `Будь ласка, введіть текст для питання ${i + 1}`,
          "error"
        );
        return;
      }

      const questionData = {
        question: questionText,
        type: questionType,
        image: null,
      };

      if (questionType === "text-based") {
        const textContent = item.querySelector(".text-content")?.value;
        if (!textContent?.trim()) {
          this.showNotification(
            `Будь ласка, введіть текст для аналізу для питання ${i + 1}`,
            "error"
          );
          return;
        }
        questionData.textContent = textContent;
        questionData.analysisType =
          item.querySelector(".text-analysis-type")?.value || "comprehension";
      }

      // Handle image upload
      const imagePreview = item.querySelector(".image-preview img");
      if (imagePreview && imagePreview.src !== "/placeholder.svg") {
        questionData.image = imagePreview.src;
      }

      switch (questionType) {
        case "single":
        case "single-image":
        case "graph-table":
        case "text-based":
          const singleOptions = Array.from(
            item.querySelectorAll(".option-text")
          ).map((input) => input.value);
          const singleCorrectRadio = item.querySelector(
            'input[type="radio"]:checked'
          );

          if (singleOptions.some((opt) => !opt.trim()) || !singleCorrectRadio) {
            this.showNotification(
              `Будь ласка, заповніть всі поля для питання ${i + 1}`,
              "error"
            );
            return;
          }

          questionData.options = singleOptions;
          questionData.correct = Number.parseInt(singleCorrectRadio.value);

          if (questionType === "graph-table") {
            questionData.graphTableType =
              item.querySelector(".graph-table-type")?.value || "graph";
          }
          break;

        case "multiple":
        case "multiple-image":
          const multipleOptions = Array.from(
            item.querySelectorAll(".option-text")
          ).map((input) => input.value);
          const multipleCorrectCheckboxes = Array.from(
            item.querySelectorAll('input[type="checkbox"]:checked')
          );

          if (
            multipleOptions.some((opt) => !opt.trim()) ||
            multipleCorrectCheckboxes.length === 0
          ) {
            this.showNotification(
              `Будь ласка, заповніть всі поля та оберіть правильні відповіді для питання ${
                i + 1
              }`,
              "error"
            );
            return;
          }

          questionData.options = multipleOptions;
          questionData.correct = multipleCorrectCheckboxes.map((cb) =>
            Number.parseInt(cb.value)
          );
          break;

        case "matching":
          const leftItems = Array.from(item.querySelectorAll(".left-item")).map(
            (input) => input.value
          );
          const rightItems = Array.from(
            item.querySelectorAll(".right-item")
          ).map((input) => input.value);
          const correctMatches = Array.from(
            item.querySelectorAll(".correct-match")
          ).map((select) => Number.parseInt(select.value));

          if (
            leftItems.some((item) => !item.trim()) ||
            rightItems.some((item) => !item.trim()) ||
            correctMatches.some((match) => isNaN(match))
          ) {
            this.showNotification(
              `Будь ласка, заповніть всі поля відповідності для питання ${
                i + 1
              }`,
              "error"
            );
            return;
          }

          questionData.leftItems = leftItems;
          questionData.rightItems = rightItems;
          questionData.correctMatches = correctMatches;
          break;

        case "ordering":
          const orderItems = Array.from(
            item.querySelectorAll(".order-item")
          ).map((input) => input.value);

          if (orderItems.some((item) => !item.trim())) {
            this.showNotification(
              `Будь ласка, заповніть всі елементи послідовності для питання ${
                i + 1
              }`,
              "error"
            );
            return;
          }

          questionData.correctOrder = orderItems;
          break;

        case "short-answer":
          const shortAnswer = item.querySelector(".short-answer-correct").value;
          const maxLength = item.querySelector(".max-length").value;
          const caseSensitive = item.querySelector(".case-sensitive").checked;

          if (!shortAnswer.trim()) {
            this.showNotification(
              `Будь ласка, введіть правильну відповідь для питання ${i + 1}`,
              "error"
            );
            return;
          }

          questionData.correctAnswers = shortAnswer
            .split(",")
            .map((ans) => ans.trim());
          questionData.maxLength = Number.parseInt(maxLength) || 100;
          questionData.caseSensitive = caseSensitive;
          break;
      }

      questions.push(questionData);
    }

    if (questions.length === 0) {
      this.showNotification("Додайте хоча б одне питання", "error");
      return;
    }

    try {
      const form = document.getElementById("createQuizForm");
      form.classList.add("creating-quiz");

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      const editingQuizId = form.dataset.editingQuizId;
      const isEditing = !!editingQuizId;

      submitBtn.textContent = isEditing
        ? "⏳ Оновлення тесту..."
        : "⏳ Створення тесту...";

      const url = isEditing
        ? `/api/admin/quizzes/${editingQuizId}`
        : "/api/admin/quizzes";
      const method = isEditing ? "PUT" : "POST";

      const response = await this.apiRequest(url, {
        method: method,
        body: JSON.stringify({
          title,
          description,
          category,
          difficulty,
          timeLimit: Number.parseInt(timeLimit),
          passingScore: Number.parseInt(passingScore),
          questions,
        }),
      });

      if (response && response.ok) {
        document.getElementById("createQuizModal").style.display = "none";
        this.loadQuizzes();
        this.loadDashboard();
        this.showNotification(
          isEditing ? "Тест оновлено успішно! 🎉" : "Тест створено успішно! 🎉",
          "success"
        );

        // Reset form
        document.getElementById("createQuizForm").reset();
        document.getElementById("questionsContainer").innerHTML = "";
        this.questionCounter = 0;
        delete form.dataset.editingQuizId;
      } else {
        const errorData = await response.json();
        this.showNotification(
          errorData.error || "Помилка збереження тесту",
          "error"
        );
      }
    } catch (error) {
      console.error("Error saving quiz:", error);
      this.showNotification("Помилка збереження тесту", "error");
    } finally {
      const form = document.getElementById("createQuizForm");
      form.classList.remove("creating-quiz");

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = "✅ Створити тест";
    }
  }

  showNotification(message, type = "info") {
    const existing = document.querySelector(".notification");
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }
}

// Global functions for onclick handlers
function closeEditUserModal() {
  document.getElementById("editUserModal").style.display = "none";
}

function closeCreateQuizModal() {
  document.getElementById("createQuizModal").style.display = "none";
}

// Initialize admin panel
const adminPanel = new AdminPanel();

const notificationStyles = `
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 500;
  transform: translateX(400px);
  transition: transform 0.3s ease;
  z-index: 1000;
  max-width: 300px;
  box-shadow: var(--shadow-lg);
}

.notification.show {
  transform: translateX(0);
}

.notification-success {
  background: var(--success-color);
  color: white;
}

.notification-error {
  background: var(--danger-color);
  color: white;
}

.notification-info {
  background: var(--primary-color);
  color: white;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-primary {
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
}

.badge-secondary {
  background: rgba(100, 116, 139, 0.1);
  color: var(--secondary-color);
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning-color);
}

.badge-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

.score-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.score-excellent {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.score-good {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning-color);
}

.score-fair {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

.score-poor {
  background: rgba(100, 116, 139, 0.1);
  color: var(--secondary-color);
}
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Global variables for editors
const quillEditors = new Map();
let currentMathEditor = null;

// Math symbols database
const mathSymbols = {
  basic: [
    { symbol: "+", latex: "+", name: "Додавання" },
    { symbol: "−", latex: "-", name: "Віднімання" },
    { symbol: "×", latex: "\\times", name: "Множення" },
    { symbol: "÷", latex: "\\div", name: "Ділення" },
    { symbol: "=", latex: "=", name: "Дорівнює" },
    { symbol: "≠", latex: "\\neq", name: "Не дорівнює" },
    { symbol: "≈", latex: "\\approx", name: "Приблизно дорівнює" },
    { symbol: "<", latex: "<", name: "Менше" },
    { symbol: ">", latex: ">", name: "Більше" },
    { symbol: "≤", latex: "\\leq", name: "Менше або дорівнює" },
    { symbol: "≥", latex: "\\geq", name: "Більше або дорівнює" },
    { symbol: "±", latex: "\\pm", name: "Плюс-мінус" },
  ],
  fractions: [
    { symbol: "½", latex: "\\frac{1}{2}", name: "Одна друга" },
    { symbol: "⅓", latex: "\\frac{1}{3}", name: "Одна третя" },
    { symbol: "¼", latex: "\\frac{1}{4}", name: "Одна четверта" },
    { symbol: "¾", latex: "\\frac{3}{4}", name: "Три четвертих" },
    { symbol: "a/b", latex: "\\frac{a}{b}", name: "Звичайний дріб" },
    {
      symbol: "a/b/c",
      latex: "\\frac{\\frac{a}{b}}{c}",
      name: "Складний дріб",
    },
  ],
  powers: [
    { symbol: "x²", latex: "x^2", name: "Квадрат" },
    { symbol: "x³", latex: "x^3", name: "Куб" },
    { symbol: "xⁿ", latex: "x^n", name: "Степінь" },
    { symbol: "x₁", latex: "x_1", name: "Індекс" },
    { symbol: "aⁿ", latex: "a^n", name: "Степінь a" },
    { symbol: "10⁶", latex: "10^6", name: "Мільйон" },
  ],
  roots: [
    { symbol: "√", latex: "\\sqrt{x}", name: "Квадратний корінь" },
    { symbol: "∛", latex: "\\sqrt[3]{x}", name: "Кубічний корінь" },
    { symbol: "ⁿ√", latex: "\\sqrt[n]{x}", name: "Корінь n-го степеня" },
  ],
  geometry: [
    { symbol: "∠", latex: "\\angle", name: "Кут" },
    { symbol: "°", latex: "^\\circ", name: "Градус" },
    { symbol: "△", latex: "\\triangle", name: "Трикутник" },
    { symbol: "□", latex: "\\square", name: "Квадрат" },
    { symbol: "○", latex: "\\circ", name: "Коло" },
    { symbol: "∥", latex: "\\parallel", name: "Паралельно" },
    { symbol: "⊥", latex: "\\perp", name: "Перпендикулярно" },
    { symbol: "≅", latex: "\\cong", name: "Конгруентно" },
    { symbol: "∼", latex: "\\sim", name: "Подібно" },
  ],
  calculus: [
    { symbol: "∫", latex: "\\int", name: "Інтеграл" },
    { symbol: "∑", latex: "\\sum", name: "Сума" },
    { symbol: "∏", latex: "\\prod", name: "Добуток" },
    { symbol: "∂", latex: "\\partial", name: "Частинна похідна" },
    { symbol: "∞", latex: "\\infty", name: "Нескінченність" },
    { symbol: "lim", latex: "\\lim", name: "Границя" },
    { symbol: "Δ", latex: "\\Delta", name: "Дельта" },
    { symbol: "α", latex: "\\alpha", name: "Альфа" },
    { symbol: "β", latex: "\\beta", name: "Бета" },
    { symbol: "γ", latex: "\\gamma", name: "Гамма" },
    { symbol: "π", latex: "\\pi", name: "Пі" },
    { symbol: "θ", latex: "\\theta", name: "Тета" },
  ],
};

// Initialize rich text editors
function initializeRichTextEditor(containerId, placeholder = "") {
  const toolbarOptions = [
    ["bold", "italic", "underline", "strike"],
    ["blockquote", "code-block"],
    [{ header: 1 }, { header: 2 }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ script: "sub" }, { script: "super" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ direction: "rtl" }],
    [{ size: ["small", false, "large", "huge"] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ color: [] }, { background: [] }],
    [{ font: [] }],
    [{ align: [] }],
    ["link", "image", "formula"],
    ["clean"],
  ];

  const quill = new Quill(containerId, {
    theme: "snow",
    placeholder: placeholder,
    modules: {
      toolbar: {
        container: toolbarOptions,
        handlers: {
          formula: function () {
            openMathFormulaModal(this);
          },
          image: function () {
            openImageUploadModal(this);
          },
        },
      },
    },
  });

  // Store editor reference
  quillEditors.set(containerId, quill);

  return quill;
}

// Initialize math formula modal
function initializeMathFormulaModal() {
  const modal = document.getElementById("mathFormulaModal");
  const mathSymbolsContainer = document.getElementById("mathSymbols");
  const mathPreview = document.getElementById("mathPreview");
  const mathLatexInput = document.getElementById("mathLatexInput");
  const insertBtn = document.getElementById("insertMathFormula");

  // Category buttons
  document.querySelectorAll(".math-cat-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".math-cat-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      loadMathSymbols(this.dataset.category);
    });
  });

  // Load initial category
  loadMathSymbols("basic");

  // LaTeX input handler
  mathLatexInput.addEventListener("input", function () {
    updateMathPreview(this.value);
  });

  // Insert formula button
  insertBtn.addEventListener("click", () => {
    const latex = mathLatexInput.value.trim();
    if (latex && currentMathEditor) {
      insertMathFormula(currentMathEditor, latex);
      closeMathFormulaModal();
    }
  });
}

// Load math symbols for category
function loadMathSymbols(category) {
  const container = document.getElementById("mathSymbols");
  const symbols = mathSymbols[category] || [];

  container.innerHTML = symbols
    .map(
      (symbol) => `
        <div class="math-symbol" data-latex="${symbol.latex}" title="${symbol.name}">
            ${symbol.symbol}
        </div>
    `
    )
    .join("");

  // Add click handlers
  container.querySelectorAll(".math-symbol").forEach((symbolEl) => {
    symbolEl.addEventListener("click", function () {
      const latex = this.dataset.latex;
      document.getElementById("mathLatexInput").value = latex;
      updateMathPreview(latex);
    });
  });
}

// Update math preview
function updateMathPreview(latex) {
  const preview = document.getElementById("mathPreview");
  if (latex.trim()) {
    try {
      katex.render(latex, preview, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      preview.innerHTML = `<span style="color: red;">Помилка: ${e.message}</span>`;
    }
  } else {
    preview.innerHTML =
      '<span style="color: #999;">Попередній перегляд з\'явиться тут</span>';
  }
}

// Open math formula modal
function openMathFormulaModal(editor) {
  currentMathEditor = editor;
  document.getElementById("mathFormulaModal").style.display = "block";
  document.getElementById("mathLatexInput").value = "";
  updateMathPreview("");
}

// Close math formula modal
function closeMathFormulaModal() {
  document.getElementById("mathFormulaModal").style.display = "none";
  currentMathEditor = null;
}

// Insert math formula into editor
function insertMathFormula(editor, latex) {
  const range = editor.getSelection(true);
  editor.insertEmbed(range.index, "formula", latex);
  editor.setSelection(range.index + 1);
}

// Initialize image upload modal
function initializeImageUploadModal() {
  const modal = document.getElementById("imageUploadModal");
  const fileInput = document.getElementById("imageFileInput");
  const dropZone = document.getElementById("imageDropZone");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const previewImage = document.getElementById("uploadImagePreview");
  const confirmBtn = document.getElementById("confirmImageUpload");

  const currentImageEditor = null;
  let currentImageFile = null;

  // File input handler
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  });

  // Drag and drop handlers
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    this.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", function (e) {
    e.preventDefault();
    this.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    this.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleImageFile(files[0]);
    }
  });

  // Click to select file
  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  // Confirm upload
  confirmBtn.addEventListener("click", () => {
    if (currentImageFile && currentImageEditor) {
      uploadAndInsertImage(currentImageEditor, currentImageFile);
    }
  });

  // Handle image file
  function handleImageFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Будь ласка, виберіть файл зображення");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      alert("Розмір файлу не повинен перевищувати 5MB");
      return;
    }

    currentImageFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      document.getElementById("imageFileName").textContent = file.name;
      document.getElementById("imageFileSize").textContent = formatFileSize(
        file.size
      );

      dropZone.style.display = "none";
      previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  // Upload and insert image
  async function uploadAndInsertImage(editor, file) {
    try {
      confirmBtn.textContent = "Завантаження...";
      confirmBtn.disabled = true;

      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Помилка завантаження зображення");
      }

      const result = await response.json();

      // Insert image into editor
      const range = editor.getSelection(true);
      editor.insertEmbed(range.index, "image", result.url);
      editor.setSelection(range.index + 1);

      closeImageUploadModal();
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Помилка завантаження зображення: " + error.message);
    } finally {
      confirmBtn.textContent = "Підтвердити завантаження";
      confirmBtn.disabled = false;
    }
  }
}

function openImageUploadModal(editor) {
  const modal = document.getElementById("imageUploadModal");
  if (modal) {
    // Set current editor reference
    window.currentImageEditor = editor;
    modal.style.display = "block";
    resetImageUploadModal();
  }
}

function closeImageUploadModal() {
  const modal = document.getElementById("imageUploadModal");
  if (modal) {
    modal.style.display = "none";
    window.currentImageEditor = null;
    resetImageUploadModal();
  }
}

function resetImageUploadModal() {
  const dropZone = document.getElementById("imageDropZone");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const fileInput = document.getElementById("imageFileInput");

  if (dropZone) dropZone.style.display = "block";
  if (previewContainer) previewContainer.style.display = "none";
  if (fileInput) fileInput.value = "";
  window.currentImageFile = null;
}

function generateMathCalculationAnswer(questionIndex) {
  return `
        <h4>Математичні обчислення:</h4>
        <div class="math-calculation-section">
            <div class="form-group">
                <label>Правильна відповідь (число):</label>
                <input type="number" class="math-calculation-answer" step="any" placeholder="Введіть числову відповідь" required>
            </div>
            <div class="form-group">
                <label>Допустима похибка:</label>
                <input type="number" class="calculation-tolerance" min="0" step="0.01" value="0.01" placeholder="0.01">
            </div>
            <div class="form-group">
                <label>Одиниці вимірювання:</label>
                <input type="text" class="calculation-units" placeholder="м, кг, с, тощо">
            </div>
        </div>
    `;
}

function generateShortAnswer(questionIndex) {
  return `
        <h4>Коротка відкрита відповідь:</h4>
        <div class="short-answer-section">
            <div class="form-group">
                <label>Правильна відповідь (або кілька варіантів через кому):</label>
                <input type="text" class="short-answer-correct" placeholder="Наприклад: Київ, столиця України" required>
            </div>
            <div class="form-group">
                <label>Максимальна кількість символів:</label>
                <input type="number" class="max-length" value="100" min="10" max="500">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" class="case-sensitive"> Враховувати регістр
                </label>
            </div>
        </div>
    `;
}

function generateMatchingAnswers(questionIndex) {
  return `
        <h4>Встановлення відповідності:</h4>
        <div class="matching-section">
            <div class="matching-pairs">
                <div class="matching-column">
                    <label>Ліва колонка:</label>
                    ${[0, 1, 2, 3]
                      .map(
                        (index) => `
                        <div class="matching-item">
                            <span class="item-number">${index + 1}.</span>
                            <input type="text" class="left-item" placeholder="Елемент ${
                              index + 1
                            }" required>
                        </div>
                    `
                      )
                      .join("")}
                </div>
                <div class="matching-column">
                    <label>Права колонка:</label>
                    ${[0, 1, 2, 3]
                      .map(
                        (index) => `
                        <div class="matching-item">
                            <span class="item-letter">${String.fromCharCode(
                              65 + index
                            )}.</span>
                            <input type="text" class="right-item" placeholder="Відповідь ${String.fromCharCode(
                              65 + index
                            )}" required>
                            <select class="correct-match" required>
                                <option value="">Відповідає...</option>
                                <option value="0">1</option>
                                <option value="1">2</option>
                                <option value="2">3</option>
                                <option value="3">4</option>
                            </select>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        </div>
    `;
}

function generateOrderingAnswers(questionIndex) {
  return `
        <h4>Встановлення послідовності:</h4>
        <div class="ordering-section">
            <p class="instruction">Введіть елементи у правильному порядку:</p>
            <div class="ordering-items">
                ${[0, 1, 2, 3, 4]
                  .map(
                    (index) => `
                    <div class="ordering-item">
                        <span class="order-number">${index + 1}.</span>
                        <input type="text" class="order-item" placeholder="Крок ${
                          index + 1
                        }" required>
                        <button type="button" class="move-up" onclick="adminPanel.moveOrderItem(this, 'up')" ${
                          index === 0 ? "disabled" : ""
                        }>↑</button>
                        <button type="button" class="move-down" onclick="adminPanel.moveOrderItem(this, 'down')" ${
                          index === 4 ? "disabled" : ""
                        }>↓</button>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}

// Enhanced initialization
document.addEventListener("DOMContentLoaded", () => {
  // Initialize rich text editor for quiz description
  setTimeout(() => {
    const descEditor = initializeRichTextEditor(
      "#quizDescriptionEditor",
      "Введіть опис тесту..."
    );

    // Sync with hidden input
    descEditor.on("text-change", () => {
      document.getElementById("quizDescription").value =
        descEditor.root.innerHTML;
    });
  }, 100);

  // Initialize math formula modal
  initializeMathFormulaModal();

  // Initialize image upload modal
  initializeImageUploadModal();

  // Initialize KaTeX auto-render
  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
    });
  }

  // Modal close handlers
  document.querySelectorAll(".modal .close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", function () {
      this.closest(".modal").style.display = "none";
    });
  });

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  });
});
