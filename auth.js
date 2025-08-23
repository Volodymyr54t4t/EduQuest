document.addEventListener("DOMContentLoaded", function () {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const authForms = document.querySelectorAll(".auth-form");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const switchLinks = document.querySelectorAll(".switch-link");
  const messageDiv = document.getElementById("message");

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  switchLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  function switchTab(tab) {
    // Update tab buttons
    tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // Update forms
    authForms.forEach((form) => {
      form.classList.toggle("active", form.id === `${tab}Form`);
    });

    // Update footer links visibility
    const footerPs = document.querySelectorAll(".auth-footer p");
    footerPs.forEach((p) => {
      const link = p.querySelector(".switch-link");
      if (link) {
        if (tab === "login" && link.dataset.tab === "register") {
          p.style.display = "block";
        } else if (tab === "register" && link.dataset.tab === "login") {
          p.style.display = "block";
        } else {
          p.style.display = "none";
        }
      }
    });
  }

  // Login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const data = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage("Успішний вхід!", "success");
        localStorage.setItem("token", result.token);
        localStorage.setItem("userId", result.userId);
        setTimeout(() => {
          window.location.href = "profile.html";
        }, 1500);
      } else {
        showMessage(result.message || "Помилка входу", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showMessage("Помилка з'єднання з сервером", "error");
    }
  });

  // Register form submission
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      showMessage("Паролі не співпадають", "error");
      return;
    }

    const data = {
      email: formData.get("email"),
      password: password,
    };

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage("Успішна реєстрація!", "success");
        localStorage.setItem("token", result.token);
        localStorage.setItem("userId", result.userId);
        setTimeout(() => {
          window.location.href = "profile.html";
        }, 1500);
      } else {
        showMessage(result.message || "Помилка реєстрації", "error");
      }
    } catch (error) {
      console.error("Register error:", error);
      showMessage("Помилка з'єднання з сервером", "error");
    }
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.add("show");

    setTimeout(() => {
      messageDiv.classList.remove("show");
    }, 3000);
  }

  // Initialize with login tab
  switchTab("login");
});
