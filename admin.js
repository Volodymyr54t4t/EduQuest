class AdminPanel {
  constructor() {
    this.token = localStorage.getItem("adminToken");
    this.currentSection = "dashboard";
    this.questionCounter = 0;
    this.init();
  }

  init() {
    this.setupEventListeners();

    if (this.token) {
      this.showAdminPanel();
      this.loadDashboard();
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
    document.getElementById("addQuestion").addEventListener("click", () => {
      const questionType = document.getElementById("questionType").value;
      this.addQuestion(questionType);
    });

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
    const container = document.getElementById("questionsContainer");
    this.questionCounter++;
    const questionNumber = this.questionCounter;

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
        </div>
        <button type="button" class="remove-question" onclick="this.parentElement.parentElement.remove(); adminPanel.updateQuestionNumbers();">×</button>
      </div>
      <div class="form-group">
        <label>Текст питання:</label>
        <textarea class="question-text" required rows="2" placeholder="Введіть текст питання..."></textarea>
      </div>
    `;

    if (type.includes("image")) {
      questionHTML += `
        <div class="image-upload-section">
          <input type="file" class="image-upload-input" accept="image/*" onchange="adminPanel.handleImageUpload(this, ${questionNumber})">
          <button type="button" class="image-upload-button" onclick="this.previousElementSibling.click()">
            📷 Додати зображення
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
      case "text-input":
        questionHTML += this.createTextInputOptions(questionNumber);
        break;
      case "true-false":
        questionHTML += this.createTrueFalseOptions(questionNumber);
        break;
    }

    questionDiv.innerHTML = questionHTML;
    container.appendChild(questionDiv);
  }

  createSingleChoiceOptions(questionNumber) {
    return `
      <div class="options-container">
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
        <div class="form-group">
          <label style="font-size: 0.875rem; color: var(--text-secondary);">
            ✓ Оберіть всі правильні варіанти:
          </label>
        </div>
        ${[0, 1, 2, 3]
          .map(
            (index) => `
          <div class="option-group">
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <input type="checkbox" name="correct_${questionNumber}" value="${index}">
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

  createTextInputOptions(questionNumber) {
    return `
      <div class="form-group">
        <label>Правильна відповідь:</label>
        <input type="text" class="text-answer-input" placeholder="Введіть правильну відповідь..." required>
        <div class="text-answer-keywords">
          <small>Підказка: Можна вказати кілька варіантів через кому (наприклад: "Київ, київ, КИЇВ")</small>
        </div>
      </div>
    `;
  }

  createTrueFalseOptions(questionNumber) {
    return `
      <div class="true-false-options">
        <div class="true-false-option" onclick="adminPanel.selectTrueFalse(this, ${questionNumber}, true)">
          <input type="radio" name="correct_${questionNumber}" value="true" required>
          ✅ Правда
        </div>
        <div class="true-false-option" onclick="adminPanel.selectTrueFalse(this, ${questionNumber}, false)">
          <input type="radio" name="correct_${questionNumber}" value="false">
          ❌ Неправда
        </div>
      </div>
    `;
  }

  getQuestionTypeName(type) {
    const types = {
      single: "Одна відповідь",
      multiple: "Декілька відповідей",
      "single-image": "З фото (одна)",
      "multiple-image": "З фото (декілька)",
      "text-input": "Текстова",
      "true-false": "Правда/Неправда",
    };
    return types[type] || "Невідомий тип";
  }

  handleImageUpload(input, questionNumber) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.showNotification(
        "Розмір файлу не повинен перевищувати 5MB",
        "error"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const questionDiv = document.querySelector(
        `[data-question-id="${questionNumber}"]`
      );
      const imageSection = questionDiv.querySelector(".image-upload-section");
      const preview = imageSection.querySelector(".image-preview");
      const img = preview.querySelector("img");

      img.src = e.target.result;
      preview.style.display = "block";
      imageSection.classList.add("has-image");

      questionDiv.dataset.imageData = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeImage(questionNumber) {
    const questionDiv = document.querySelector(
      `[data-question-id="${questionNumber}"]`
    );
    const imageSection = questionDiv.querySelector(".image-upload-section");
    const preview = imageSection.querySelector(".image-preview");
    const input = imageSection.querySelector(".image-upload-input");

    preview.style.display = "none";
    imageSection.classList.remove("has-image");
    input.value = "";
    delete questionDiv.dataset.imageData;
  }

  previewImage(src) {
    document.getElementById("previewImage").src = src;
    document.getElementById("imagePreviewModal").style.display = "flex";
  }

  selectTrueFalse(element, questionNumber, value) {
    const container = element.parentElement;
    container.querySelectorAll(".true-false-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    element.classList.add("selected");
    element.querySelector('input[type="radio"]').checked = true;
  }

  updateQuestionNumbers() {
    const questions = document.querySelectorAll(".question-item");
    questions.forEach((question, index) => {
      const questionNumber = index + 1;
      question.querySelector(
        ".question-number"
      ).textContent = `Питання ${questionNumber}`;
      question.dataset.questionId = questionNumber;

      const radios = question.querySelectorAll('input[type="radio"]');
      radios.forEach((radio) => {
        if (radio.name.startsWith("correct_")) {
          radio.name = `correct_${questionNumber}`;
        }
      });

      const checkboxes = question.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        if (checkbox.name.startsWith("correct_")) {
          checkbox.name = `correct_${questionNumber}`;
        }
      });
    });
  }

  async createQuiz() {
    const title = document.getElementById("quizTitle").value;
    const description = document.getElementById("quizDescription").value;
    const category = document.getElementById("quizCategory").value;
    const difficulty = document.getElementById("quizDifficulty").value;
    const timeLimit = document.getElementById("quizTimeLimit").value;
    const passingScore = document.getElementById("quizPassingScore").value;

    const questions = [];
    const questionItems = document.querySelectorAll(".question-item");

    for (let i = 0; i < questionItems.length; i++) {
      const item = questionItems[i];
      const questionType = item.dataset.questionType;
      const questionText = item.querySelector(".question-text").value;
      const imageData = item.dataset.imageData || null;

      if (!questionText.trim()) {
        this.showNotification(
          `Будь ласка, введіть текст для питання ${i + 1}`,
          "error"
        );
        return;
      }

      const questionData = {
        id: i + 1,
        question: questionText,
        type: questionType,
        image: imageData,
      };

      switch (questionType) {
        case "single":
        case "single-image":
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

        case "text-input":
          const textAnswer = item.querySelector(".text-answer-input").value;
          if (!textAnswer.trim()) {
            this.showNotification(
              `Будь ласка, введіть правильну відповідь для питання ${i + 1}`,
              "error"
            );
            return;
          }

          questionData.correctAnswer = textAnswer
            .split(",")
            .map((ans) => ans.trim());
          break;

        case "true-false":
          const trueFalseRadio = item.querySelector(
            'input[type="radio"]:checked'
          );
          if (!trueFalseRadio) {
            this.showNotification(
              `Будь ласка, оберіть правильну відповідь для питання ${i + 1}`,
              "error"
            );
            return;
          }

          questionData.correct = trueFalseRadio.value === "true";
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
