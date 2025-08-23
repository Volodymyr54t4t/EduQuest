document.addEventListener("DOMContentLoaded", () => {
  const profileForm = document.getElementById("profileForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const testBtn = document.getElementById("testBtn");
  const messageDiv = document.getElementById("message");
  const userEmail = document.getElementById("userEmail");
  const avatarText = document.getElementById("avatarText");

  // Check authentication
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  if (!token || !userId) {
    window.location.href = "auth.html";
    return;
  }

  // Load user profile
  loadUserProfile();

  // Profile form submission
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(profileForm);

    // Get selected subjects
    const subjects = [];
    const subjectCheckboxes = document.querySelectorAll(
      'input[name="subjects"]:checked'
    );
    subjectCheckboxes.forEach((checkbox) => {
      subjects.push(checkbox.value);
    });

    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      birthDate: formData.get("birthDate"),
      phone: formData.get("phone"),
      school: formData.get("school"),
      grade: formData.get("grade"),
      city: formData.get("city"),
      subjects: subjects,
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage("Профіль успішно оновлено!", "success");
        updateAvatar(data.firstName);
      } else {
        showMessage(result.message || "Помилка оновлення профілю", "error");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      showMessage("Помилка з'єднання з сервером", "error");
    }
  });

  // Logout functionality
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.href = "auth.html";
  });

  // Test button functionality
  testBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  async function loadUserProfile() {
    try {
      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        const user = result.user;
        userEmail.textContent = user.email;

        // Fill form with existing data
        if (user.first_name)
          document.getElementById("firstName").value = user.first_name;
        if (user.last_name)
          document.getElementById("lastName").value = user.last_name;
        if (user.birth_date)
          document.getElementById("birthDate").value = user.birth_date;
        if (user.phone) document.getElementById("phone").value = user.phone;
        if (user.school) document.getElementById("school").value = user.school;
        if (user.grade) document.getElementById("grade").value = user.grade;
        if (user.city) document.getElementById("city").value = user.city;

        // Set selected subjects
        if (user.subjects) {
          const subjects = JSON.parse(user.subjects);
          subjects.forEach((subject) => {
            const checkbox = document.querySelector(
              `input[name="subjects"][value="${subject}"]`
            );
            if (checkbox) checkbox.checked = true;
          });
        }

        updateAvatar(user.first_name || user.email);
      } else {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          window.location.href = "auth.html";
        } else {
          showMessage("Помилка завантаження профілю", "error");
        }
      }
    } catch (error) {
      console.error("Profile load error:", error);
      showMessage("Помилка з'єднання з сервером", "error");
    }
  }

  function updateAvatar(name) {
    if (name) {
      avatarText.textContent = name.charAt(0).toUpperCase();
    }
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.add("show");

    setTimeout(() => {
      messageDiv.classList.remove("show");
    }, 3000);
  }
});
