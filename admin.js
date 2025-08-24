class AdminPanel {
  constructor() {
    this.token = localStorage.getItem("adminToken");
    this.currentSection = "dashboard";
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
      this.addQuestion();
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

        // Show admin info
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
        return;
      }

      const stats = await response.json();
      console.log("[v0] Dashboard stats received:", stats);

      document.getElementById("statsUsers").textContent = stats.totalUsers || 0;
      document.getElementById("statsQuizzes").textContent =
        stats.totalQuizzes || 0;
      document.getElementById("statsResults").textContent =
        stats.totalResults || 0;
      document.getElementById("statsAvgScore").textContent =
        (stats.averageScore || 0) + "%";
    } catch (error) {
      console.error("Error loading dashboard:", error);
      document.getElementById("statsUsers").textContent = "0";
      document.getElementById("statsQuizzes").textContent = "0";
      document.getElementById("statsResults").textContent = "0";
      document.getElementById("statsAvgScore").textContent = "0%";
    }
  }

  async loadUsers() {
    try {
      console.log("[v0] Loading users");

      const response = await this.apiRequest("/api/admin/users");
      if (!response || !response.ok) {
        console.error("[v0] Users API response failed");
        return;
      }

      const data = await response.json();
      console.log("[v0] Users data received:", data);

      const users = Array.isArray(data) ? data : data.users || [];
      const tbody = document.querySelector("#usersTable tbody");

      if (users.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
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
            <td>${user.totalScore || user.total_score || 0}</td>
            <td class="actions">
              <button class="btn btn-success" onclick="adminPanel.editUser(${
                user.id
              })">
                Редагувати
              </button>
              <button class="btn btn-danger" onclick="adminPanel.deleteUser(${
                user.id
              })" 
                      ${
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
      const tbody = document.querySelector("#usersTable tbody");
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--danger-color);">
            Помилка завантаження користувачів
          </td>
        </tr>
      `;
    }
  }

  async loadQuizzes() {
    try {
      console.log("[v0] Loading quizzes");

      const response = await this.apiRequest("/api/admin/quizzes");
      if (!response || !response.ok) {
        console.error("[v0] Quizzes API response failed");
        return;
      }

      const quizzes = await response.json();
      console.log("[v0] Quizzes data received:", quizzes);

      const tbody = document.querySelector("#quizzesTable tbody");

      if (!Array.isArray(quizzes) || quizzes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
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
              <span class="badge badge-secondary">${quiz.category}</span>
            </td>
            <td>
              <span class="badge ${this.getDifficultyBadgeClass(
                quiz.difficulty
              )}">
                ${this.getDifficultyText(quiz.difficulty)}
              </span>
            </td>
            <td>${quiz.questionCount || quiz.question_count || 0}</td>
            <td>${new Date(
              quiz.createdAt || quiz.created_at
            ).toLocaleDateString("uk-UA")}</td>
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
      const tbody = document.querySelector("#quizzesTable tbody");
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--danger-color);">
            Помилка завантаження тестів
          </td>
        </tr>
      `;
    }
  }

  async loadResults() {
    try {
      console.log("[v0] Loading results");

      const response = await this.apiRequest("/api/admin/results");
      if (!response || !response.ok) {
        console.error("[v0] Results API response failed");
        return;
      }

      const results = await response.json();
      console.log("[v0] Results data received:", results);

      const tbody = document.querySelector("#resultsTable tbody");

      if (!Array.isArray(results) || results.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
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
            <td>${
              result.quizTitle || result.quiz_title || "Невідомий тест"
            }</td>
            <td>
              <span class="score-badge ${this.getScoreBadgeClass(
                result.score
              )}">
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
      const tbody = document.querySelector("#resultsTable tbody");
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--danger-color);">
            Помилка завантаження результатів
          </td>
        </tr>
      `;
    }
  }

  getDifficultyBadgeClass(difficulty) {
    switch (difficulty) {
      case "easy":
        return "badge-success";
      case "medium":
        return "badge-warning";
      case "hard":
        return "badge-danger";
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
      alert("Помилка завантаження даних користувача");
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

  showCreateQuizModal() {
    document.getElementById("createQuizModal").style.display = "flex";
    document.getElementById("questionsContainer").innerHTML = "";
    this.addQuestion(); // Add first question
  }

  addQuestion() {
    const container = document.getElementById("questionsContainer");
    const questionNumber = container.children.length + 1;

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-item";
    questionDiv.innerHTML = `
      <div class="question-header">
        <span class="question-number">Питання ${questionNumber}</span>
        <button type="button" class="remove-question" onclick="this.parentElement.parentElement.remove(); adminPanel.updateQuestionNumbers();">×</button>
      </div>
      <div class="form-group">
        <label>Текст питання:</label>
        <input type="text" class="question-text" required>
      </div>
      <div class="options-container">
        <div class="option-group">
          <input type="radio" name="correct_${questionNumber}" value="0" required>
          <input type="text" class="option-text" placeholder="Варіант 1" required>
        </div>
        <div class="option-group">
          <input type="radio" name="correct_${questionNumber}" value="1">
          <input type="text" class="option-text" placeholder="Варіант 2" required>
        </div>
        <div class="option-group">
          <input type="radio" name="correct_${questionNumber}" value="2">
          <input type="text" class="option-text" placeholder="Варіант 3" required>
        </div>
        <div class="option-group">
          <input type="radio" name="correct_${questionNumber}" value="3">
          <input type="text" class="option-text" placeholder="Варіант 4" required>
        </div>
      </div>
    `;

    container.appendChild(questionDiv);
  }

  updateQuestionNumbers() {
    const questions = document.querySelectorAll(".question-item");
    questions.forEach((question, index) => {
      const questionNumber = index + 1;
      question.querySelector(
        ".question-number"
      ).textContent = `Питання ${questionNumber}`;

      // Update radio button names
      const radios = question.querySelectorAll('input[type="radio"]');
      radios.forEach((radio) => {
        radio.name = `correct_${questionNumber}`;
      });
    });
  }

  async createQuiz() {
    const title = document.getElementById("quizTitle").value;
    const description = document.getElementById("quizDescription").value;
    const category = document.getElementById("quizCategory").value;
    const difficulty = document.getElementById("quizDifficulty").value;

    const questions = [];
    const questionItems = document.querySelectorAll(".question-item");

    for (let i = 0; i < questionItems.length; i++) {
      const item = questionItems[i];
      const questionText = item.querySelector(".question-text").value;
      const options = Array.from(item.querySelectorAll(".option-text")).map(
        (input) => input.value
      );
      const correctRadio = item.querySelector('input[type="radio"]:checked');

      if (!questionText || options.some((opt) => !opt) || !correctRadio) {
        this.showNotification(
          `Будь ласка, заповніть всі поля для питання ${i + 1}`,
          "error"
        );
        return;
      }

      questions.push({
        id: i + 1,
        question: questionText,
        options: options,
        correct: Number.parseInt(correctRadio.value),
      });
    }

    if (questions.length === 0) {
      this.showNotification("Додайте хоча б одне питання", "error");
      return;
    }

    try {
      const response = await this.apiRequest("/api/admin/quizzes", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          category,
          difficulty,
          questions,
        }),
      });

      if (response && response.ok) {
        document.getElementById("createQuizModal").style.display = "none";
        this.loadQuizzes();
        this.loadDashboard(); // Refresh stats
        this.showNotification("Тест створено успішно", "success");

        // Reset form
        document.getElementById("createQuizForm").reset();
        document.getElementById("questionsContainer").innerHTML = "";
      } else {
        this.showNotification("Помилка створення тесту", "error");
      }
    } catch (error) {
      console.error("Error creating quiz:", error);
      this.showNotification("Помилка створення тесту", "error");
    }
  }

  showNotification(message, type = "info") {
    // Remove existing notifications
    const existing = document.querySelector(".notification");
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    // Hide notification after 3 seconds
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

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
