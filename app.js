// ===== APP.JS — LawBank Search Application =====

// ---- Vietnamese diacritic normalization ----
function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// ---- Multi-word tokenized search ----
// "Lao dong 2019" => tokens ["lao","dong","2019"]
// Each token must appear somewhere in the text
function matchesTokens(tokens, text) {
  const norm = normalize(text);
  return tokens.every(token => norm.includes(token));
}

// ---- Quick keyword suggestions ----
const QUICK_KEYWORDS = [
  { label: "Lao động 2019", value: "Lao động 2019" },
  { label: "Hiến pháp 2013", value: "Hiến pháp 2013" },
  { label: "Dân sự 2015", value: "Dân sự 2015" },
  { label: "Hình sự 2015", value: "Hình sự 2015" },
  { label: "Hành chính 2012", value: "Hành chính 2012" },
  { label: "Tham nhũng 2018", value: "Tham nhũng 2018" },
  { label: "Người tiêu dùng 2023", value: "Người tiêu dùng 2023" },
  { label: "Quốc hội", value: "Quốc hội" },
  { label: "Hợp đồng vô hiệu", value: "Hợp đồng vô hiệu" },
  { label: "Tội phạm nghiêm trọng", value: "Tội phạm nghiêm trọng" },
  { label: "Sa thải", value: "Sa thải" },
  { label: "Tòa án", value: "Tòa án" },
  { label: "Đúng hay Sai", value: "Đúng hay Sai" },
  { label: "Hình phạt tử hình", value: "tử hình" },
  { label: "Bồi thường", value: "bồi thường" },
  { label: "Vi phạm", value: "vi phạm" },
  { label: "Chủ tịch nước", value: "Chủ tịch nước" },
  { label: "Pháp nhân", value: "pháp nhân" },
];

// ---- State ----
let currentFilter = "all";
let currentQuery = "";
let isRandomized = false;
let filteredData = [];

// ---- DOM refs ----
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const cardsGrid = document.getElementById("cardsGrid");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultCount = document.getElementById("resultCount");
const totalCountEl = document.querySelector("#totalCount .stat-num");
const scrollTopBtn = document.getElementById("scrollTop");
const chips = document.querySelectorAll(".chip");
const sortDefault = document.getElementById("sortDefault");
const sortRandom = document.getElementById("sortRandom");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalBadge = document.getElementById("modalBadge");
const modalQuestion = document.getElementById("modalQuestion");
const modalAnswer = document.getElementById("modalAnswer");

// ---- Init ----
function init() {
  // Set total count
  totalCountEl.textContent = QUIZ_DATA.length;

  // Render keyword chips
  renderKeywords();

  // Render all on start
  filteredData = [...QUIZ_DATA];
  renderCards(filteredData);

  // Attach listeners
  searchInput.addEventListener("input", onSearchInput);
  clearBtn.addEventListener("click", clearSearch);
  chips.forEach(chip => chip.addEventListener("click", onChipClick));
  sortDefault.addEventListener("click", onSortDefault);
  sortRandom.addEventListener("click", onSortRandom);
  scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", onScroll);
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // Hide loading
  loadingState.style.display = "none";

  // Particles
  createParticles();
}

// ---- Render quick keyword chips ----
function renderKeywords() {
  const container = document.getElementById("keywordChips");
  if (!container) return;
  container.innerHTML = QUICK_KEYWORDS.map(kw =>
    `<button class="kw-chip" onclick="applyKeyword('${kw.value.replace(/'/g, "\\'")}')">🔖 ${kw.label}</button>`
  ).join("");
}

// ---- Apply keyword from chip click ----
function applyKeyword(value) {
  searchInput.value = value;
  currentQuery = value;
  clearBtn.classList.add("visible");
  applyFilters();
  searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---- Search ----
function onSearchInput() {
  currentQuery = searchInput.value.trim();
  clearBtn.classList.toggle("visible", currentQuery.length > 0);
  applyFilters();
}

function clearSearch() {
  searchInput.value = "";
  currentQuery = "";
  clearBtn.classList.remove("visible");
  applyFilters();
  searchInput.focus();
}

// ---- Filter chips ----
function onChipClick(e) {
  chips.forEach(c => c.classList.remove("active"));
  e.currentTarget.classList.add("active");
  currentFilter = e.currentTarget.dataset.filter;
  isRandomized = false;
  sortDefault.classList.add("active");
  sortRandom.classList.remove("active");
  applyFilters();
}

// ---- Sort ----
function onSortDefault() {
  isRandomized = false;
  sortDefault.classList.add("active");
  sortRandom.classList.remove("active");
  applyFilters();
}

function onSortRandom() {
  isRandomized = true;
  sortRandom.classList.add("active");
  sortDefault.classList.remove("active");
  shuffle(filteredData);
  renderCards(filteredData);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---- Core filter logic (multi-word tokenized) ----
function applyFilters() {
  // Split query into tokens, filter empty strings
  const tokens = normalize(currentQuery)
    .split(/\s+/)
    .filter(t => t.length > 0);

  filteredData = QUIZ_DATA.filter(item => {
    const matchSubject = currentFilter === "all" || item.subject === currentFilter;
    const matchQuery = tokens.length === 0 ||
      matchesTokens(tokens, item.q) ||
      matchesTokens(tokens, item.a);
    return matchSubject && matchQuery;
  });

  if (isRandomized) shuffle(filteredData);

  renderCards(filteredData);
}

// ---- Highlight match (each token separately) ----
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  let escaped = escapeHtml(text);
  const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
  tokens.forEach(token => {
    // Build regex ignoring diacritics by matching the original token chars literally
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      escaped = escaped.replace(new RegExp(`(${escapedToken})`, "gi"), "<mark>$1</mark>");
    } catch(e) {}
  });
  return escaped;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Render cards ----
function renderCards(data) {
  // Update result count
  const total = QUIZ_DATA.filter(item => currentFilter === "all" || item.subject === currentFilter).length;
  if (currentQuery) {
    resultCount.innerHTML = `Tìm thấy <strong>${data.length}</strong> kết quả cho "<strong>${escapeHtml(currentQuery)}</strong>"`;
  } else {
    resultCount.innerHTML = `Hiển thị <strong>${data.length}</strong> câu hỏi${currentFilter !== "all" ? ` · ${SUBJECTS[currentFilter]?.label}` : ""}`;
  }

  if (data.length === 0) {
    cardsGrid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  // Build cards HTML
  const html = data.map((item, idx) => {
    const subject = SUBJECTS[item.subject] || { label: item.subject, emoji: "📚" };
    const qHighlighted = highlight(item.q, currentQuery);
    const aHighlighted = highlight(item.a, currentQuery);

    return `
      <div class="card" data-id="${item.id}" style="animation-delay:${Math.min(idx * 0.03, 0.5)}s" onclick="openModal(${item.id})">
        <div class="card-header">
          <span class="card-number">Câu ${item.id}</span>
          <span class="card-badge badge-${item.subject}">${subject.emoji} ${subject.short}</span>
        </div>
        <p class="card-question">${qHighlighted}</p>
        <div class="card-answer-preview">
          <span class="answer-icon">✅</span>
          <span class="answer-text">${aHighlighted}</span>
        </div>
        <div class="card-footer">
          <span class="view-more">Xem chi tiết</span>
        </div>
      </div>
    `.trim();
  }).join("");

  cardsGrid.innerHTML = html;
}

// ---- Modal ----
function openModal(id) {
  const item = QUIZ_DATA.find(i => i.id === id);
  if (!item) return;

  const subject = SUBJECTS[item.subject] || { label: item.subject, emoji: "📚" };

  modalBadge.textContent = `${subject.emoji} ${subject.label}`;
  modalBadge.className = `modal-badge badge-${item.subject}`;
  modalQuestion.textContent = item.q;
  modalAnswer.textContent = item.a;

  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ---- Scroll to top ----
function onScroll() {
  scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
}

// ---- Background particles ----
function createParticles() {
  const container = document.getElementById("bgParticles");
  const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];
  const count = window.innerWidth < 768 ? 12 : 24;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = Math.random() * 6 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 20 + 15}s;
      animation-delay: ${Math.random() * 15}s;
    `;
    container.appendChild(p);
  }
}

// ---- Start ----
document.addEventListener("DOMContentLoaded", init);
