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
  }

  async handleLogin() {
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("loginError");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        localStorage.setItem("adminToken", this.token);
        this.showAdminPanel();
        this.loadDashboard();
        errorDiv.style.display = "none";
      } else {
        errorDiv.textContent = data.message;
        errorDiv.style.display = "block";
      }
    } catch (error) {
      console.error("Login error:", error);
      errorDiv.textContent = "Помилка з'єднання з сервером";
      errorDiv.style.display = "block";
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem("adminToken");
    this.showLoginModal();
  }

  showLoginModal() {
    document.getElementById("loginModal").style.display = "flex";
    document.getElementById("adminPanel").style.display = "none";
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

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (response.status === 401 || response.status === 403) {
      this.logout();
      return null;
    }

    return response;
  }

  async loadDashboard() {
    try {
      const response = await this.apiRequest("/api/admin/stats");
      if (!response) return;

      const stats = await response.json();

      document.getElementById("statsUsers").textContent = stats.users;
      document.getElementById("statsQuizzes").textContent = stats.quizzes;
      document.getElementById("statsResults").textContent = stats.results;
      document.getElementById("statsAvgScore").textContent =
        stats.averageScore + "%";
    } catch (error) {
      console.error("Error loading dashboard:", error);
    }
  }

  async loadUsers() {
    try {
      const response = await this.apiRequest("/api/admin/users");
      if (!response) return;

      const users = await response.json();
      const tbody = document.querySelector("#usersTable tbody");

      tbody.innerHTML = users
        .map(
          (user) => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.email}</td>
                    <td>${user.first_name || "-"}</td>
                    <td>${user.last_name || "-"}</td>
                    <td>${user.role}</td>
                    <td>${user.school || "-"}</td>
                    <td>${user.grade || "-"}</td>
                    <td>${user.city || "-"}</td>
                    <td>${user.total_score}</td>
                    <td class="actions">
                        <button class="btn btn-success" onclick="adminPanel.editUser(${
                          user.id
                        })">Редагувати</button>
                        <button class="btn btn-danger" onclick="adminPanel.deleteUser(${
                          user.id
                        })">Видалити</button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }

  async loadQuizzes() {
    try {
      const response = await this.apiRequest("/api/admin/quizzes");
      if (!response) return;

      const quizzes = await response.json();
      const tbody = document.querySelector("#quizzesTable tbody");

      tbody.innerHTML = quizzes
        .map(
          (quiz) => `
                <tr>
                    <td>${quiz.id}</td>
                    <td>${quiz.title}</td>
                    <td>${quiz.category}</td>
                    <td>${quiz.difficulty}</td>
                    <td>${quiz.question_count}</td>
                    <td>${new Date(quiz.created_at).toLocaleDateString(
                      "uk-UA"
                    )}</td>
                    <td class="actions">
                        <button class="btn btn-success" onclick="adminPanel.editQuiz(${
                          quiz.id
                        })">Редагувати</button>
                        <button class="btn btn-danger" onclick="adminPanel.deleteQuiz(${
                          quiz.id
                        })">Видалити</button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error loading quizzes:", error);
    }
  }

  async loadResults() {
    try {
      const response = await this.apiRequest("/api/admin/results");
      if (!response) return;

      const results = await response.json();
      const tbody = document.querySelector("#resultsTable tbody");

      tbody.innerHTML = results
        .map(
          (result) => `
                <tr>
                    <td>${result.id}</td>
                    <td>${result.first_name} ${result.last_name} (${
            result.email
          })</td>
                    <td>${result.quiz_title}</td>
                    <td>${result.score}%</td>
                    <td>${result.correct_answers}</td>
                    <td>${result.total_questions}</td>
                    <td>${new Date(result.completed_at).toLocaleDateString(
                      "uk-UA"
                    )}</td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error loading results:", error);
    }
  }

  async editUser(userId) {
    try {
      const response = await this.apiRequest(`/api/admin/users`);
      if (!response) return;

      const users = await response.json();
      const user = users.find((u) => u.id === userId);

      if (user) {
        document.getElementById("editUserId").value = user.id;
        document.getElementById("editEmail").value = user.email;
        document.getElementById("editFirstName").value = user.first_name || "";
        document.getElementById("editLastName").value = user.last_name || "";
        document.getElementById("editRole").value = user.role;
        document.getElementById("editSchool").value = user.school || "";
        document.getElementById("editGrade").value = user.grade || "";
        document.getElementById("editCity").value = user.city || "";

        document.getElementById("editUserModal").style.display = "flex";
      }
    } catch (error) {
      console.error("Error loading user for edit:", error);
    }
  }

  async updateUser() {
    const userId = document.getElementById("editUserId").value;
    const userData = {
      email: document.getElementById("editEmail").value,
      first_name: document.getElementById("editFirstName").value,
      last_name: document.getElementById("editLastName").value,
      role: document.getElementById("editRole").value,
      school: document.getElementById("editSchool").value,
      grade: document.getElementById("editGrade").value,
      city: document.getElementById("editCity").value,
    };

    try {
      const response = await this.apiRequest(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      });

      if (response && response.ok) {
        document.getElementById("editUserModal").style.display = "none";
        this.loadUsers();
        alert("Користувача оновлено успішно");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Помилка оновлення користувача");
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
        alert("Користувача видалено успішно");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Помилка видалення користувача");
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
        alert("Тест видалено успішно");
      }
    } catch (error) {
      console.error("Error deleting quiz:", error);
      alert("Помилка видалення тесту");
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
                    <input type="radio" name="correct_${questionNumber}" value="0">
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
        alert(`Будь ласка, заповніть всі поля для питання ${i + 1}`);
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
      alert("Додайте хоча б одне питання");
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
        alert("Тест створено успішно");

        // Reset form
        document.getElementById("createQuizForm").reset();
        document.getElementById("questionsContainer").innerHTML = "";
      }
    } catch (error) {
      console.error("Error creating quiz:", error);
      alert("Помилка створення тесту");
    }
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
