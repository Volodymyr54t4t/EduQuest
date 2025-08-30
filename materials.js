// Sample materials data
let materials = [
  {
    id: 1,
    title: "Основи української граматики",
    subject: "ukrainian",
    subjectName: "Українська мова",
    type: "pdf",
    description:
      "Повний курс української граматики з прикладами та вправами для підготовки до НМТ.",
    file: "ukrainian-grammar.pdf",
    date: "2024-01-15",
    downloads: 245,
  },
  {
    id: 2,
    title: "Алгебра та геометрія - відеокурс",
    subject: "math",
    subjectName: "Математика",
    type: "video",
    description: "Комплексний відеокурс з математики, що охоплює всі теми НМТ.",
    file: "https://youtube.com/watch?v=example",
    date: "2024-01-20",
    downloads: 189,
  },
  {
    id: 3,
    title: "Тест з історії України",
    subject: "history",
    subjectName: "Історія України",
    type: "test",
    description: "Інтерактивний тест для перевірки знань з історії України.",
    file: "history-test.html",
    date: "2024-01-25",
    downloads: 156,
  },
  {
    id: 4,
    title: "English Grammar Essentials",
    subject: "english",
    subjectName: "Англійська мова",
    type: "pdf",
    description:
      "Essential English grammar rules and exercises for NMT preparation.",
    file: "english-grammar.pdf",
    date: "2024-02-01",
    downloads: 203,
  },
  {
    id: 5,
    title: "Біологія клітини - презентація",
    subject: "biology",
    subjectName: "Біологія",
    type: "presentation",
    description: "Детальна презентація про будову та функції клітини.",
    file: "cell-biology.pptx",
    date: "2024-02-05",
    downloads: 134,
  },
  {
    id: 6,
    title: "Хімічні реакції та рівняння",
    subject: "chemistry",
    subjectName: "Хімія",
    type: "article",
    description:
      "Стаття про основні типи хімічних реакцій та способи їх запису.",
    file: "chemical-reactions.html",
    date: "2024-02-10",
    downloads: 167,
  },
  {
    id: 7,
    title: "Фізика руху - відеоурок",
    subject: "physics",
    subjectName: "Фізика",
    type: "video",
    description: "Відеоурок про основи механіки та закони руху.",
    file: "https://youtube.com/watch?v=physics",
    date: "2024-02-15",
    downloads: 198,
  },
  {
    id: 8,
    title: "Географія України - тест",
    subject: "geography",
    subjectName: "Географія",
    type: "test",
    description: "Тест на знання географії України для підготовки до НМТ.",
    file: "geography-test.html",
    date: "2024-02-20",
    downloads: 142,
  },
];

let filteredMaterials = [...materials];

// DOM elements
const searchInput = document.getElementById("searchInput");
const subjectFilter = document.getElementById("subjectFilter");
const sortSelect = document.getElementById("sortSelect");
const materialsGrid = document.getElementById("materialsGrid");
const emptyState = document.getElementById("emptyState");
const addModal = document.getElementById("addModal");
const addMaterialForm = document.getElementById("addMaterialForm");

// Statistics elements
const totalMaterials = document.getElementById("totalMaterials");
const pdfCount = document.getElementById("pdfCount");
const videoCount = document.getElementById("videoCount");
const testCount = document.getElementById("testCount");

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  renderMaterials();
  updateStatistics();
  setupEventListeners();
});

// Event listeners
function setupEventListeners() {
  searchInput.addEventListener("input", handleSearch);
  subjectFilter.addEventListener("change", handleFilter);
  sortSelect.addEventListener("change", handleSort);
  addMaterialForm.addEventListener("submit", handleAddMaterial);

  // Close modal when clicking outside
  addModal.addEventListener("click", (e) => {
    if (e.target === addModal) {
      closeAddModal();
    }
  });
}

// Search functionality
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase();
  filteredMaterials = materials.filter(
    (material) =>
      material.title.toLowerCase().includes(searchTerm) ||
      material.description.toLowerCase().includes(searchTerm) ||
      material.subjectName.toLowerCase().includes(searchTerm)
  );
  applyCurrentFilters();
}

// Filter functionality
function handleFilter() {
  const selectedSubject = subjectFilter.value;
  if (selectedSubject === "all") {
    filteredMaterials = [...materials];
  } else {
    filteredMaterials = materials.filter(
      (material) => material.subject === selectedSubject
    );
  }

  // Apply search if there's a search term
  if (searchInput.value) {
    handleSearch();
    return;
  }

  renderMaterials();
}

// Sort functionality
function handleSort() {
  const sortBy = sortSelect.value;

  filteredMaterials.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.title.localeCompare(b.title);
      case "date":
        return new Date(b.date) - new Date(a.date);
      case "subject":
        return a.subjectName.localeCompare(b.subjectName);
      case "type":
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  renderMaterials();
}

// Apply current filters (used after search)
function applyCurrentFilters() {
  const selectedSubject = subjectFilter.value;
  if (selectedSubject !== "all") {
    filteredMaterials = filteredMaterials.filter(
      (material) => material.subject === selectedSubject
    );
  }
  renderMaterials();
}

// Render materials
function renderMaterials() {
  if (filteredMaterials.length === 0) {
    materialsGrid.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  materialsGrid.style.display = "grid";
  emptyState.style.display = "none";

  materialsGrid.innerHTML = filteredMaterials
    .map(
      (material) => `
        <div class="material-card" data-id="${material.id}">
            <div class="material-header">
                <div class="material-type">
                    <i class="fas fa-${getTypeIcon(material.type)}"></i>
                    ${getTypeName(material.type)}
                </div>
                <div class="material-actions">
                    <button class="action-btn" onclick="editMaterial(${
                      material.id
                    })" title="Редагувати">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="deleteMaterial(${
                      material.id
                    })" title="Видалити">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <h3 class="material-title">${material.title}</h3>
            <div class="material-subject">${material.subjectName}</div>
            <p class="material-description">${material.description}</p>
            
            <div class="material-footer">
                <span class="material-date">${formatDate(material.date)}</span>
                <button class="download-btn" onclick="downloadMaterial(${
                  material.id
                })">
                    <i class="fas fa-download"></i>
                    Завантажити
                </button>
            </div>
        </div>
    `
    )
    .join("");
}

// Update statistics
function updateStatistics() {
  totalMaterials.textContent = materials.length;
  pdfCount.textContent = materials.filter((m) => m.type === "pdf").length;
  videoCount.textContent = materials.filter((m) => m.type === "video").length;
  testCount.textContent = materials.filter((m) => m.type === "test").length;
}

// Helper functions
function getTypeIcon(type) {
  const icons = {
    pdf: "file-pdf",
    video: "video",
    test: "question-circle",
    presentation: "file-powerpoint",
    article: "file-alt",
  };
  return icons[type] || "file";
}

function getTypeName(type) {
  const names = {
    pdf: "PDF",
    video: "Відео",
    test: "Тест",
    presentation: "Презентація",
    article: "Стаття",
  };
  return names[type] || "Файл";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("uk-UA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Modal functions
function openAddModal() {
  addModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAddModal() {
  addModal.classList.remove("active");
  document.body.style.overflow = "auto";
  addMaterialForm.reset();
}

// Add material functionality
function handleAddMaterial(e) {
  e.preventDefault();

  const formData = new FormData(addMaterialForm);
  const newMaterial = {
    id: materials.length + 1,
    title: document.getElementById("materialTitle").value,
    subject: document.getElementById("materialSubject").value,
    subjectName: getSubjectName(
      document.getElementById("materialSubject").value
    ),
    type: document.getElementById("materialType").value,
    description: document.getElementById("materialDescription").value,
    file: document.getElementById("materialFile").value,
    date: new Date().toISOString().split("T")[0],
    downloads: 0,
  };

  materials.push(newMaterial);
  filteredMaterials = [...materials];

  renderMaterials();
  updateStatistics();
  closeAddModal();

  // Show success message
  showNotification("Матеріал успішно додано!", "success");
}

function getSubjectName(subject) {
  const subjects = {
    ukrainian: "Українська мова",
    math: "Математика",
    history: "Історія України",
    english: "Англійська мова",
    biology: "Біологія",
    chemistry: "Хімія",
    physics: "Фізика",
    geography: "Географія",
  };
  return subjects[subject] || subject;
}

// Material actions
function downloadMaterial(id) {
  const material = materials.find((m) => m.id === id);
  if (material) {
    // Simulate download
    showNotification(`Завантаження "${material.title}"...`, "info");

    // Increment download count
    material.downloads++;

    // In a real application, you would trigger the actual download here
    console.log("Downloading:", material.file);
  }
}

function editMaterial(id) {
  const material = materials.find((m) => m.id === id);
  if (material) {
    // Populate form with material data
    document.getElementById("materialTitle").value = material.title;
    document.getElementById("materialSubject").value = material.subject;
    document.getElementById("materialType").value = material.type;
    document.getElementById("materialDescription").value = material.description;
    document.getElementById("materialFile").value = material.file;

    // Change form to edit mode
    addMaterialForm.dataset.editId = id;
    openAddModal();
  }
}

function deleteMaterial(id) {
  if (confirm("Ви впевнені, що хочете видалити цей матеріал?")) {
    materials = materials.filter((m) => m.id !== id);
    filteredMaterials = filteredMaterials.filter((m) => m.id !== id);

    renderMaterials();
    updateStatistics();
    showNotification("Матеріал видалено!", "success");
  }
}

// Notification system
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Add styles
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--primary);
        color: var(--primary-foreground);
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        z-index: 1001;
        animation: slideInRight 0.3s ease;
    `;

  if (type === "success") {
    notification.style.background = "var(--primary)";
  } else if (type === "error") {
    notification.style.background = "var(--destructive)";
  }

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Add CSS for notifications
const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
