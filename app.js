(() => {
  "use strict";

  const STORAGE_PREFIX = "vidhitack-workspace-v1:";
  const FILE_DB_PREFIX = "vidhitack-documents-v1:";
  const SESSION_KEY = "vidhitack-session";
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(today);
  const isoDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const referenceCases = [
    { id: "ref-1", title: "Kesavananda Bharati v. State of Kerala", citation: "(1973) 4 SCC 225", court: "Supreme Court of India", year: "1973", category: "Constitutional", summary: "Established the basic structure doctrine, limiting Parliament's power to amend the Constitution.", tags: ["Constitution", "Basic structure", "Landmark"] },
    { id: "ref-2", title: "Maneka Gandhi v. Union of India", citation: "(1978) 1 SCC 248", court: "Supreme Court of India", year: "1978", category: "Constitutional", summary: "Expanded the interpretation of personal liberty under Article 21 and procedural fairness.", tags: ["Article 21", "Personal liberty", "Landmark"] },
    { id: "ref-3", title: "Vishaka v. State of Rajasthan", citation: "(1997) 6 SCC 241", court: "Supreme Court of India", year: "1997", category: "Employment", summary: "Set out safeguards against workplace sexual harassment in the absence of legislation.", tags: ["Workplace", "Gender justice", "Guidelines"] },
    { id: "ref-4", title: "Mohori Bibee v. Dharmodas Ghose", citation: "(1903) 30 IA 114", court: "Privy Council", year: "1903", category: "Civil", summary: "A foundational decision on agreements entered into by a minor under contract law.", tags: ["Contract", "Capacity", "Civil"] },
    { id: "ref-5", title: "K.S. Puttaswamy v. Union of India", citation: "(2017) 10 SCC 1", court: "Supreme Court of India", year: "2017", category: "Constitutional", summary: "Recognized privacy as a fundamental right protected by the Constitution.", tags: ["Privacy", "Fundamental rights", "Landmark"] },
    { id: "ref-6", title: "Shayara Bano v. Union of India", citation: "(2017) 9 SCC 1", court: "Supreme Court of India", year: "2017", category: "Constitutional", summary: "Considered the constitutional validity of the practice of instant triple talaq.", tags: ["Family law", "Constitution", "Landmark"] }
  ];

  const seedNews = [
    { category: "Supreme Court", title: "A closer look at recent constitutional bench decisions", date: "Legal briefing · 6 min read", summary: "A concise overview of recent judgments and the questions they raise for constitutional practice." },
    { category: "Practice note", title: "Preparing a clear, court-ready case file", date: "Practice guide · 4 min read", summary: "A practical checklist for keeping pleadings, orders, and supporting records easy to retrieve." },
    { category: "High Courts", title: "This week's notable rulings from across India", date: "Weekly roundup · 5 min read", summary: "Selected updates from High Courts, organized by subject for a faster first read." },
    { category: "On the diary", title: "A better system for capturing hearing notes", date: "Field notes · 3 min read", summary: "Small habits for recording next steps and preserving useful context after a hearing." }
  ];

  let state = emptyState();
  let storageKey = null;
  let fileDatabaseName = null;
  let currentPage = "dashboard";
  let activeDiaryId = null;
  let diarySaveTimer = null;
  let selectedUploadFiles = [];
  let previousFocus = null;
  let calendarMonthOffset = 0;
  let selectedCalendarDay = isoDate;
  const content = document.getElementById("page-content");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  const appShell = document.getElementById("app-shell");
  const loginScreen = document.getElementById("login-screen");
  const loginForm = document.getElementById("login-form");

  function isLoggedIn() {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  }
  function emptyState() {
    return { cases: [], diary: [], files: [], readNews: [], feedback: [], comments: [] };
  }
  function selectWorkspace(email) {
    const account = email.trim().toLowerCase();
    storageKey = `${STORAGE_PREFIX}${encodeURIComponent(account)}`;
    fileDatabaseName = `${FILE_DB_PREFIX}${encodeURIComponent(account)}`;
    state = loadState();
    activeDiaryId = state.diary[0]?.id || null;
  }
  function currentUserName() {
    const email = sessionStorage.getItem(SESSION_KEY) || "";
    const username = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    return username ? username.replace(/\b\w/g, letter => letter.toUpperCase()) : "Advocate";
  }
  function setAuthenticatedView(isAuthenticated) {
    appShell.hidden = !isAuthenticated;
    loginScreen.hidden = isAuthenticated;
    if (isAuthenticated) {
      selectWorkspace(sessionStorage.getItem(SESSION_KEY) || "");
      const name = currentUserName();
      const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "A";
      document.querySelector(".profile-copy strong").textContent = name;
      document.querySelector(".profile-copy small").textContent = "Advocate · India";
      document.querySelector(".avatar").textContent = initials;
      document.querySelector(".top-avatar").textContent = initials;
      renderPage();
      updateCaseCount();
    } else {
      document.getElementById("login-email")?.focus();
    }
  }

  function loadState() {
    const base = emptyState();
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { ...base, ...parsed, cases: Array.isArray(parsed.cases) ? parsed.cases : [], diary: Array.isArray(parsed.diary) ? parsed.diary : [], files: Array.isArray(parsed.files) ? parsed.files : [], readNews: Array.isArray(parsed.readNews) ? parsed.readNews : [], feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [], comments: Array.isArray(parsed.comments) ? parsed.comments : [] };
    } catch (error) {
      console.error("Could not read saved workspace data.", error);
      return base;
    }
  }

  function persist() {
    try {
      if (!storageKey) throw new Error("Sign in is required before saving workspace data.");
      localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Could not save workspace data.", error);
      showToast("This browser could not save the latest workspace changes.", true);
      return false;
    }
  }

  function openFileDatabase() {
      return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
          reject(new Error("This browser does not support local file storage."));
          return;
        }
        const request = indexedDB.open(fileDatabaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open local file storage."));
      });
  }

  async function storeFileBlob(fileId, file) {
      const db = await openFileDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readwrite");
        transaction.objectStore("files").put({ id: fileId, blob: file, name: file.name, type: file.type });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { const error = transaction.error; db.close(); reject(error || new Error("Could not store the selected file.")); };
        transaction.onabort = () => { const error = transaction.error; db.close(); reject(error || new Error("File storage was interrupted.")); };
      });
  }

  async function getFileBlob(fileId) {
      const db = await openFileDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readonly");
        const request = transaction.objectStore("files").get(fileId);
        request.onsuccess = () => { db.close(); resolve(request.result || null); };
        request.onerror = () => { const error = request.error; db.close(); reject(error || new Error("Could not retrieve the selected file.")); };
      });
  }

  async function deleteFileBlob(fileId) {
      const db = await openFileDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readwrite");
        transaction.objectStore("files").delete(fileId);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { const error = transaction.error; db.close(); reject(error || new Error("Could not remove the stored file.")); };
      });
  }

  async function addFilesToCase(files, caseId) {
      const records = files.map(file => fileRecord(file, caseId));
      const storedIds = [];
      try {
        for (let index = 0; index < files.length; index += 1) {
          await storeFileBlob(records[index].id, files[index]);
          storedIds.push(records[index].id);
        }
      } catch (error) {
        await Promise.allSettled(storedIds.map(deleteFileBlob));
        console.error("Could not save the selected case files.", error);
        showToast(error.message || "Could not save the selected files on this device.", true);
        return false;
      }
      state.files.push(...records);
      if (!persist()) {
        state.files = state.files.filter(file => !storedIds.includes(file.id));
        await Promise.allSettled(storedIds.map(deleteFileBlob));
        return false;
      }
      return true;
  }

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function formatDate(dateString) {
    if (!dateString) return "Today";
    const parsed = new Date(`${String(dateString).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? safe(dateString) : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
  }
  function dateTimeLabel(value) {
    if (!value) return "Not saved yet";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  }
  function allCases() { return [...state.cases, ...referenceCases]; }
  function findCase(id) { return allCases().find(item => item.id === id); }
  function caseName(id) { return findCase(id)?.title || "Unlinked entry"; }
  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.textContent = message;
    document.getElementById("toast-region").append(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }
  function setPage(page) {
    currentPage = page;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === page));
    const names = { dashboard: "Overview", "my-cases": "My cases", calendar: "Calendar", "case-library": "Case library", diary: "Digital diary", "legal-resources": "Legal resources", "legal-updates": "Legal updates", feedback: "Feedback", profile: "Your profile" };
    document.getElementById("breadcrumb-current").textContent = names[page] || "Overview";
    document.getElementById("sidebar").classList.remove("open");
    renderPage();
    content.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function heading(eyebrow, title, description, actions = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
  }
  function renderPage() {
    const renderers = { dashboard: renderDashboard, "my-cases": renderMyCases, calendar: renderCalendar, "case-library": renderCaseLibrary, diary: renderDiary, "legal-resources": renderLegalResources, "legal-updates": renderNews, feedback: renderFeedback, profile: renderProfile };
    content.innerHTML = (renderers[currentPage] || renderDashboard)();
    if (currentPage === "diary") bindDiaryEditor();
    if (currentPage === "case-library") bindCaseFilters("library-search", "library-category", referenceCases);
    if (currentPage === "my-cases") bindMyCases();
    if (currentPage === "feedback") bindFeedbackForm();
  }
  function caseRow(item) {
    const fileCount = state.files.filter(file => file.caseId === item.id).length;
    return `<div class="case-row" role="button" tabindex="0" data-open-case="${safe(item.id)}">
      <span class="case-file-icon">▤</span><span class="case-row-info"><strong>${safe(item.title)}</strong><small>${safe(item.category || "General")} · ${fileCount} ${fileCount === 1 ? "file" : "files"}</small></span>
      <span class="case-row-date">${formatDate(item.updatedAt || item.createdAt)}</span><span class="row-arrow">›</span>
    </div>`;
  }
  function updateCard(news, index) {
    return `<article class="update-item"><div class="update-category">${safe(news.category)}</div><h3>${safe(news.title)}</h3><small>${safe(news.date)}</small></article>`;
  }
  function renderDashboard() {
    const recent = [...state.cases].sort((a,b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")).slice(0, 4);
    const pendingNotes = state.diary.filter(entry => entry.body?.trim()).length;
    return `${heading(`TODAY · ${dateLabel.toUpperCase()}`, `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${safe(currentUserName())}.`, "Your practice, thoughtfully organized.", `<button class="button button-primary" data-action="new-case"><span class="button-icon">＋</span>New case</button>`)}
      <section class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">A CLEARER WAY TO PRACTICE</div><h2>Your cases, notes, and legal reading<br>in one considered workspace.</h2><p>Pick up where you left off. Your diary saves as you write.</p><button class="banner-link" data-page="diary">Open your digital diary <span>→</span></button></div><div class="banner-illustration" aria-hidden="true"><span class="illustration-ring"></span><span class="illustration-book">§</span><span class="illustration-spark">✳</span></div></section>
      <section class="stat-grid" aria-label="Workspace summary">
        <article class="stat-card"><div class="stat-label">Active cases <span class="stat-icon">▤</span></div><div class="stat-number">${state.cases.length}</div><div class="stat-note">Your private case files</div></article>
        <article class="stat-card"><div class="stat-label">Documents saved <span class="stat-icon">▧</span></div><div class="stat-number">${state.files.length}</div><div class="stat-note">Across your case workspace</div></article>
        <article class="stat-card"><div class="stat-label">Diary entries <span class="stat-icon">✎</span></div><div class="stat-number">${pendingNotes}</div><div class="stat-note">Saved automatically as you write</div></article>
        <article class="stat-card"><div class="stat-label">Cases to explore <span class="stat-icon">⌕</span></div><div class="stat-number">${referenceCases.length}</div><div class="stat-note">Curated reference cases</div></article>
      </section>
      <div class="content-grid">
        <section class="section-block"><div class="section-title-row"><h2>Recent cases</h2><button class="text-link" data-page="my-cases">View all cases →</button></div>
          <div class="case-list">${recent.length ? recent.map(caseRow).join("") : `<div class="empty-state"><strong>Your workspace starts here</strong><p>Create a case to organize documents, details, and hearing notes in one place.</p><button class="button button-small" data-action="new-case">Create your first case</button></div>`}</div>
        </section>
        <section class="section-block"><div class="section-title-row"><h2>Worth a read</h2><button class="text-link" data-page="legal-updates">All updates →</button></div><div class="updates-card">${seedNews.slice(0,2).map(updateCard).join("")}</div></section>
      </div>`;
  }
  function renderMyCases() {
    const cases = [...state.cases].sort((a,b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
    return `${heading("YOUR WORKSPACE", "My cases", "A private, organized home for the matters you're working on.", `<button class="button button-primary" data-action="new-case"><span class="button-icon">＋</span>New case</button>`)}
      <div class="toolbar"><label class="filter-search"><span>⌕</span><input type="search" id="my-cases-search" placeholder="Search your cases…" aria-label="Search your cases"></label>
        <div class="filter-controls"><button class="button" data-action="upload-files"><span class="button-icon">↑</span>Upload files</button></div></div>
      <div class="file-table"><div class="file-table-head"><span>CASE</span><span>TYPE</span><span>LAST UPDATED</span><span></span></div>
        <div id="my-cases-rows">${cases.length ? cases.map(item => caseTableRow(item)).join("") : `<div class="empty-state"><strong>No cases yet</strong><p>Create a matter to begin organizing case documents and diary entries.</p><button class="button button-small button-primary" data-action="new-case">Create a case</button></div>`}</div>
      </div>
      <p class="news-disclaimer">${state.files.length} document${state.files.length === 1 ? "" : "s"} saved in your workspace. Documents and case details are stored in your browser.</p>`;
  }
  function caseTableRow(item) {
    const files = state.files.filter(file => file.caseId === item.id).length;
    return `<div class="file-table-row" data-case-row="${safe(item.id)}"><div class="file-name"><span class="file-badge">CASE</span><span>${safe(item.title)}</span></div><span>${safe(item.category || "General")}</span><span>${formatDate(item.updatedAt || item.createdAt)}</span><div class="table-actions"><button data-open-case="${safe(item.id)}">Open</button><button data-action="delete-case" data-id="${safe(item.id)}" aria-label="Delete ${safe(item.title)}" title="Delete case">×</button></div></div>`;
  }
  function renderCaseLibrary() {
    return `${heading("REFERENCE DESK", "Case library", "Search landmark Indian judgments and keep useful references close.", "")}
      <div class="toolbar"><label class="filter-search"><span>⌕</span><input type="search" id="library-search" placeholder="Search case, citation, or topic…" aria-label="Search case library"></label>
        <div class="filter-controls"><select class="select-control" id="library-category" aria-label="Filter by case category"><option value="All">All subjects</option><option>Constitutional</option><option>Civil</option><option>Employment</option></select></div></div>
      <div class="case-grid" id="library-cards">${referenceCases.map(libraryCard).join("")}</div>
      <p class="news-disclaimer">Reference summaries are for orientation, not legal advice. Verify the original judgment before relying on any case.</p>`;
  }
  function libraryCard(item) {
    return `<article class="case-card" data-case-card="${safe(item.id)}"><div class="case-card-top"><span class="case-card-icon">§</span><span class="case-type">${safe(item.category)}</span></div><h3>${safe(item.title)}</h3><div class="case-citation">${safe(item.citation)} · ${safe(item.year)}</div><p class="case-summary">${safe(item.summary)}</p><div class="tag-list">${item.tags.map(tag => `<span class="tag">${safe(tag)}</span>`).join("")}</div><div class="case-card-footer"><span>${safe(item.court)}</span><div class="card-actions"><button data-action="share-case" data-id="${safe(item.id)}">Share</button><button data-action="save-reference" data-id="${safe(item.id)}">＋ Save</button></div></div></article>`;
  }
  function renderCalendar() {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(monthDate);
    const firstWeekday = monthDate.getDay();
    const monthDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const events = state.cases.filter(item => item.nextDate).reduce((result, item) => {
      const key = String(item.nextDate).slice(0, 10);
      (result[key] ||= []).push(item);
      return result;
    }, {});
    const dates = Array.from({ length: 42 }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index - firstWeekday + 1));
    const cells = dates.map(date => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
      const isCurrentMonth = date.getMonth() === monthDate.getMonth();
      const isToday = dateKey === isoDate;
      const dayEvents = events[dateKey] || [];
      return `<button class="calendar-day ${isCurrentMonth ? "" : "outside-month"} ${isToday ? "is-today" : ""} ${selectedCalendarDay === dateKey ? "is-selected" : ""} ${dayEvents.length ? "has-events" : ""}" data-action="select-calendar-day" data-date="${dateKey}" aria-label="${safe(new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(date))}${dayEvents.length ? `, ${dayEvents.length} hearing${dayEvents.length === 1 ? "" : "s"}` : ""}">
        <span class="calendar-day-number">${date.getDate()}</span>${dayEvents.length ? `<span class="calendar-event-count">${dayEvents.length} hearing${dayEvents.length === 1 ? "" : "s"}</span>` : ""}
      </button>`;
    }).join("");
    const selectedEvents = events[selectedCalendarDay] || [];
    const selectedDateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${selectedCalendarDay}T12:00:00`));
    const upcoming = state.cases.filter(item => item.nextDate && item.nextDate >= isoDate).sort((a,b) => `${a.nextDate} ${a.nextTime || ""}`.localeCompare(`${b.nextDate} ${b.nextTime || ""}`)).slice(0,4);
    return `${heading("HEARINGS & REMINDERS", "Calendar", "Keep hearing dates and case reminders in view.", `<button class="button button-primary" data-action="new-case"><span class="button-icon">＋</span>Add a hearing</button>`)}
      <div class="calendar-layout"><section class="calendar-panel">
        <div class="calendar-toolbar"><div><h2>${safe(monthName)}</h2><p>Hearings linked to your cases</p></div><div class="calendar-controls"><button class="button button-small" data-action="calendar-today">Today</button><button class="button button-small calendar-arrow" data-action="calendar-shift" data-direction="-1" aria-label="Previous month">‹</button><button class="button button-small calendar-arrow" data-action="calendar-shift" data-direction="1" aria-label="Next month">›</button></div></div>
        <div class="calendar-weekdays">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<span>${day}</span>`).join("")}</div>
        <div class="calendar-grid">${cells}</div>
      </section><aside class="calendar-agenda"><div class="section-title-row"><h2>${safe(selectedDateLabel)}</h2></div>
        <div class="agenda-list">${selectedEvents.length ? selectedEvents.map(item => `<button class="agenda-event" data-open-case="${safe(item.id)}"><span class="agenda-event-time">${safe(item.nextTime || "Time not set")}</span><strong>${safe(item.title)}</strong><small>${safe(item.court || item.category || "Case hearing")}${item.number ? ` · ${safe(item.number)}` : ""}</small></button>`).join("") : `<div class="empty-state"><strong>No hearings this day</strong><p>Add a hearing date to a case and it will appear on your calendar.</p></div>`}</div>
        <div class="agenda-upcoming"><h3>Coming up</h3>${upcoming.length ? upcoming.map(item => `<button class="upcoming-item" data-open-case="${safe(item.id)}"><span>${formatDate(item.nextDate)}${item.nextTime ? ` · ${safe(item.nextTime)}` : ""}</span><strong>${safe(item.title)}</strong></button>`).join("") : `<p>No upcoming hearing dates yet.</p>`}</div>
      </aside></div>`;
  }
  function renderLegalResources() {
    const resources = [
      { id: "forms", icon: "▤", category: "PRACTICE TOOL", title: "Model forms & checklists", summary: "A basic case-preparation checklist to help keep filing materials together.", action: "Open checklist" },
      { id: "filing", icon: "↗", category: "OFFICIAL PORTAL", title: "Online court filing", summary: "Go to the eCourts e-filing portal for online filing services.", action: "Visit e-filing" },
      { id: "laws", icon: "§", category: "LEGAL REFERENCE", title: "Acts & law e-books", summary: "Browse legislation and acts through the Government of India's India Code portal.", action: "Browse India Code" },
      { id: "exams", icon: "⌑", category: "CAREER INFORMATION", title: "Judicial service exams", summary: "Find exam notices and eligibility details from the relevant High Court or state authority.", action: "View guidance" },
      { id: "cases", icon: "⌕", category: "CASE REFERENCE", title: "Common case library", summary: "Search landmark Indian judgments and save useful references to your workspace.", action: "Browse cases" }
    ];
    return `${heading("REFERENCE DESK", "Legal resources", "Quick access to filing guidance, legislation, model forms, and common cases.", "")}
      <div class="resource-grid">${resources.map(item => `<article class="resource-card"><div class="resource-icon">${item.icon}</div><div class="resource-category">${item.category}</div><h2>${item.title}</h2><p>${item.summary}</p><button class="text-link" data-action="open-resource" data-id="${item.id}">${item.action} →</button></article>`).join("")}</div>
      <div class="info-callout"><strong>Verify before relying.</strong> Official procedures and filing forms vary by court and jurisdiction. Confirm current requirements with the relevant court.</div>`;
  }
  function renderFeedback() {
    return `${heading("HELP US IMPROVE", "Share feedback", "Tell us what would make this workspace more useful to your practice.", "")}
      <section class="feedback-panel"><form id="feedback-form"><div class="form-field"><label for="feedback-topic">What is your feedback about?</label><select id="feedback-topic" name="topic"><option>Case organization</option><option>Calendar & reminders</option><option>Digital diary</option><option>Legal resources</option><option>Accessibility or usability</option><option>Something else</option></select></div>
      <div class="form-field"><label for="feedback-message">Your feedback</label><textarea id="feedback-message" name="message" maxlength="1000" required placeholder="Share a suggestion, issue, or idea…"></textarea></div>
      <div class="feedback-footer"><span>Feedback is saved in this browser.</span><button class="button button-primary" type="submit">Save feedback</button></div></form></section>
      ${state.feedback.length ? `<section class="feedback-history"><div class="section-title-row"><h2>Your saved feedback</h2></div>${state.feedback.slice().reverse().map(item => `<article class="feedback-item"><div class="feedback-item-top"><span>${safe(item.topic)} · ${formatDate(item.date)}</span><button class="delete-entry-button" data-action="delete-feedback" data-id="${safe(item.id)}">Remove</button></div><p>${safe(item.message)}</p></article>`).join("")}</section>` : ""}`;
  }
  function bindFeedbackForm() {
    document.getElementById("feedback-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const item = { id: `feedback-${Date.now()}`, topic: data.get("topic"), message: data.get("message").trim(), date: isoDate };
      state.feedback.push(item);
      if (!persist()) { state.feedback.pop(); return; }
      renderPage();
      showToast("Feedback saved on this device.");
    });
  }
  function openResource(id) {
    if (id === "cases") { setPage("case-library"); return; }
    if (id === "forms") {
      openModal(`${modalHeader("Case preparation checklist", "A general checklist for organizing a filing. Always verify the current court-specific requirements.")}<div class="resource-checklist"><label><input type="checkbox"> Confirm the correct court, jurisdiction, and filing destination</label><label><input type="checkbox"> Check the cause title, case number, and party details</label><label><input type="checkbox"> Review signatures, affidavits, and required enclosures</label><label><input type="checkbox"> Verify page order, pagination, and document legibility</label><label><input type="checkbox"> Confirm fees, deadlines, and current filing rules</label></div><div class="modal-actions"><button class="button" data-action="download-checklist">Download checklist</button><button class="button button-primary" data-action="close-modal">Done</button></div>`);
      return;
    }
    if (id === "filing" || id === "laws") {
      const filing = id === "filing";
      const title = filing ? "eCourts e-filing portal" : "India Code — official legislation";
      const url = filing ? "https://efiling.ecourts.gov.in/" : "https://www.indiacode.nic.in/";
      const explanation = filing ? "Use the official eCourts portal to review available online filing services." : "Browse central acts and legislation from the Government of India's India Code portal.";
      openModal(`${modalHeader(title, "External official reference") }<div class="detail-section"><p>${explanation}</p></div><div class="info-callout">This site does not submit filings. Confirm that the linked resource applies to your court and jurisdiction.</div><div class="modal-actions"><button class="button" data-action="close-modal">Cancel</button><a class="button button-primary" href="${url}" target="_blank" rel="noopener noreferrer">Open official site ↗</a></div>`);
      return;
    }
    openModal(`${modalHeader("Judicial service examinations", "State-specific recruitment information") }<div class="detail-section"><p>Judicial service examinations are announced by the relevant State Public Service Commission or High Court. Check the recruiting authority's current official notification for eligibility, dates, syllabus, and application details.</p></div><div class="info-callout">Exam dates and notices change. Verify details directly with the issuing authority.</div><div class="modal-actions"><button class="button button-primary" data-action="close-modal">Understood</button></div>`);
  }
  function downloadChecklist() {
    const text = [
      "VIDHITACK — “ADVOCATE DIARY”",
      "General case preparation checklist",
      "",
      "[ ] Confirm the correct court, jurisdiction, and filing destination",
      "[ ] Check the cause title, case number, and party details",
      "[ ] Review signatures, affidavits, and required enclosures",
      "[ ] Verify page order, pagination, and document legibility",
      "[ ] Confirm fees, deadlines, and current filing rules",
      "",
      "General organizational aid only. Confirm current court-specific rules."
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vidhitack-case-preparation-checklist.txt";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Checklist downloaded.");
  }
  function confirmDeleteDiaryEntry(id) {
    const item = state.diary.find(entry => entry.id === id);
    if (!item) return;
    openModal(`${modalHeader("Delete this diary entry?", "This removes the saved entry from this browser.")}<div class="detail-section"><p><strong>${safe(item.title || "Untitled entry")}</strong></p></div><div class="modal-actions"><button class="button" data-action="close-modal">Keep entry</button><button class="button button-primary" data-action="confirm-delete-entry" data-id="${safe(id)}">Delete entry</button></div>`);
  }
  function renderDiary() {
    const selected = state.diary.find(entry => entry.id === activeDiaryId) || state.diary[0] || null;
    activeDiaryId = selected?.id || null;
    const entries = [...state.diary].sort((a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const caseOptions = `<option value="">No linked case</option>${allCases().map(item => `<option value="${safe(item.id)}" ${selected?.caseId === item.id ? "selected" : ""}>${safe(item.title)}</option>`).join("")}`;
    return `${heading("YOUR PRIVATE NOTES", "Digital diary", "Capture the details. Your notes save on this device as you write.", `<button class="button button-primary" data-action="new-entry"><span class="button-icon">＋</span>New entry</button>`)}
      <div class="diary-layout"><section class="diary-editor"><div class="editor-top"><h2>${selected ? "Diary entry" : "Start a new entry"}</h2><div class="editor-status-actions"><span class="save-status" id="save-status">${selected?.updatedAt ? `Saved ${dateTimeLabel(selected.updatedAt)}` : "Ready to save"}</span>${selected ? `<button class="delete-entry-button" data-action="delete-entry" data-id="${safe(selected.id)}">Delete entry</button>` : ""}</div></div>
        <label for="diary-title">Entry title</label><input id="diary-title" type="text" maxlength="120" placeholder="e.g. Hearing notes — Sharma v. State" value="${safe(selected?.title || "")}">
        <div class="form-grid"><div class="form-field"><label for="diary-date">Date</label><input id="diary-date" type="date" value="${safe(selected?.date || isoDate)}"></div><div class="form-field"><label for="diary-case">Linked case</label><select id="diary-case">${caseOptions}</select></div></div>
        <label for="diary-body">Notes</label><textarea id="diary-body" placeholder="Capture your observations, next steps, or a useful detail…">${safe(selected?.body || "")}</textarea>
        <div class="editor-bottom"><span>Auto-save is on</span><span id="word-count">${(selected?.body || "").trim().split(/\s+/).filter(Boolean).length} words</span></div></section>
        <aside class="diary-side-card"><h3>Recent entries</h3><p class="diary-hint">Your diary stays private to this browser. Entries are saved automatically while you work.</p><div class="draft-list">${entries.length ? entries.map(entry => `<button class="draft-item ${entry.id === activeDiaryId ? "selected" : ""}" data-open-entry="${safe(entry.id)}"><strong>${safe(entry.title || "Untitled entry")}</strong><small>${formatDate(entry.date)}${entry.caseId ? ` · ${safe(caseName(entry.caseId))}` : ""}</small></button>`).join("") : `<div class="draft-empty">Your saved entries will appear here.</div>`}</div></aside></div>`;
  }
  function renderNews() {
    return `${heading("FROM THE LEGAL COMMUNITY", "Legal updates", "A reading desk for legal news, case commentary, and practical notes.", "")}
      <div class="news-grid">${seedNews.map((item,index) => `<article class="news-card"><div class="news-label">${safe(item.category)}</div><h2>${safe(item.title)}</h2><p>${safe(item.summary)}</p><div class="news-card-footer"><span>${safe(item.date)}</span><button class="text-link" data-action="read-news" data-id="${index}">${state.readNews.includes(String(index)) ? "Read again →" : "Mark as read →"}</button></div></article>`).join("")}</div>
      <p class="news-disclaimer">Editorial summaries are for general information and are not legal advice. Consult original decisions and official publications for current information.</p>`;
  }
  function renderProfile() {
    const name = currentUserName();
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    return `${heading("ACCOUNT", "Your profile", "Manage your professional profile and workspace preferences.", `<button class="button" data-action="logout">Sign out</button>`)}
      <section class="profile-card"><div class="profile-large">${safe(initials)}</div><div class="profile-details"><h2>${safe(name)}</h2><p>Advocate · India</p></div></section>
      <div class="profile-info-grid"><div class="profile-info"><small>Professional jurisdiction</small><strong>India</strong></div><div class="profile-info"><small>Signed-in account</small><strong>${safe(sessionStorage.getItem(SESSION_KEY) || "")}</strong></div><div class="profile-info"><small>Workspace</small><strong>${state.cases.length} cases · ${state.files.length} documents</strong></div><div class="profile-info"><small>Data storage</small><strong>This browser</strong></div></div>
      <div class="info-callout"><strong>Privacy reminder.</strong> Information is saved on this device and does not sync to other browsers. Avoid storing confidential client information on a shared device.</div>`;
  }
  function bindCaseFilters(searchId, categoryId, source) {
    const search = document.getElementById(searchId);
    const category = document.getElementById(categoryId);
    const apply = () => {
      const term = search.value.trim().toLowerCase();
      const selectedCategory = category.value;
      document.querySelectorAll("[data-case-card]").forEach(card => {
        const item = source.find(candidate => candidate.id === card.dataset.caseCard);
        const matchesText = [item.title,item.citation,item.court,item.summary,...item.tags].join(" ").toLowerCase().includes(term);
        card.hidden = !(matchesText && (selectedCategory === "All" || item.category === selectedCategory));
      });
      const visible = [...document.querySelectorAll("[data-case-card]")].some(card => !card.hidden);
      let empty = document.getElementById("library-empty");
      if (!visible && !empty) {
        empty = document.createElement("div"); empty.id = "library-empty"; empty.className = "empty-state";
        empty.innerHTML = "<strong>No matching cases</strong><p>Try another search or subject.</p>";
        document.getElementById("library-cards").append(empty);
      } else if (visible && empty) empty.remove();
    };
    search.addEventListener("input", apply);
    category.addEventListener("change", apply);
  }
  function bindMyCases() {
    document.getElementById("my-cases-search").addEventListener("input", event => {
      const term = event.target.value.trim().toLowerCase();
      document.querySelectorAll("[data-case-row]").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(term); });
    });
  }
  function bindDiaryEditor() {
    const title = document.getElementById("diary-title");
    const date = document.getElementById("diary-date");
    const linkedCase = document.getElementById("diary-case");
    const body = document.getElementById("diary-body");
    const count = document.getElementById("word-count");
    const status = document.getElementById("save-status");
    function saveDraft() {
      count.textContent = `${body.value.trim().split(/\s+/).filter(Boolean).length} words`;
      status.textContent = "Saving…";
      window.clearTimeout(diarySaveTimer);
      diarySaveTimer = window.setTimeout(() => {
        let entry = state.diary.find(candidate => candidate.id === activeDiaryId);
        if (!entry) {
          entry = { id: `entry-${Date.now()}`, createdAt: new Date().toISOString() };
          state.diary.unshift(entry);
          activeDiaryId = entry.id;
        }
        Object.assign(entry, { title: title.value.trim(), date: date.value || isoDate, caseId: linkedCase.value, body: body.value, updatedAt: new Date().toISOString() });
        if (persist()) {
          status.textContent = `Saved ${dateTimeLabel(entry.updatedAt)}`;
          document.querySelector(".editor-top h2").textContent = "Diary entry";
          document.querySelector(".draft-list").innerHTML = [...state.diary]
            .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
            .map(item => `<button class="draft-item ${item.id === activeDiaryId ? "selected" : ""}" data-open-entry="${safe(item.id)}"><strong>${safe(item.title || "Untitled entry")}</strong><small>${formatDate(item.date)}${item.caseId ? ` · ${safe(caseName(item.caseId))}` : ""}</small></button>`)
            .join("");
          document.querySelector(".stat-card:nth-child(3) .stat-number")?.replaceChildren(document.createTextNode(state.diary.filter(item => item.body?.trim()).length));
        } else status.textContent = "Save failed · try again";
      }, 450);
    }
    [title,date,linkedCase,body].forEach(element => element.addEventListener("input", saveDraft));
    linkedCase.addEventListener("change", saveDraft);
    body.addEventListener("input", () => {
      count.textContent = `${body.value.trim().split(/\s+/).filter(Boolean).length} words`;
    });
  }
  function openModal(html) {
    previousFocus = document.activeElement;
    modalContent.innerHTML = html;
    modalBackdrop.hidden = false;
    modalContent.querySelector("input:not([type=hidden]), select, textarea, button")?.focus();
  }
  function closeModal() {
    modalBackdrop.hidden = true;
    modalContent.innerHTML = "";
    if (previousFocus?.focus) previousFocus.focus();
  }
  function modalHeader(title, subtitle) {
    return `<div class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></div>`;
  }
  function openNewCaseModal() {
    selectedUploadFiles = [];
    openModal(`${modalHeader("Create a case", "Start a matter and add its key details.")}<form id="new-case-form">
      <div class="form-grid"><div class="form-field form-full"><label for="new-case-title">Case name *</label><input id="new-case-title" name="title" required maxlength="140" placeholder="e.g. Sharma v. State of Maharashtra"></div>
      <div class="form-field"><label for="new-case-number">Case number</label><input id="new-case-number" name="number" maxlength="60" placeholder="e.g. WP(C) 123/2026"></div>
      <div class="form-field"><label for="new-case-category">Category</label><select id="new-case-category" name="category"><option>Constitutional</option><option>Civil</option><option>Criminal</option><option>Family</option><option>Employment</option><option>Commercial</option><option>Other</option></select></div>
      <div class="form-field"><label for="new-case-court">Court / jurisdiction</label><input id="new-case-court" name="court" maxlength="100" placeholder="Court or jurisdiction"></div>
      <div class="form-field"><label for="new-case-next-date">Next hearing date</label><input id="new-case-next-date" name="nextDate" type="date"></div>
      <div class="form-field"><label for="new-case-next-time">Hearing time</label><input id="new-case-next-time" name="nextTime" type="time"></div>
      <div class="form-field form-full"><label for="new-case-summary">Matter notes</label><textarea id="new-case-summary" name="summary" maxlength="500" placeholder="A short private note about this matter…"></textarea></div></div>
      <label class="drop-zone" id="drop-zone" for="modal-file-input"><span><span class="drop-icon">↑</span><strong>Add case documents</strong><br><small>Choose files to keep with this case · any file type</small></span></label>
      <input type="file" id="modal-file-input" multiple hidden><div class="selected-files" id="selected-files"></div>
      <div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create case</button></div></form>`);
    document.getElementById("modal-file-input").addEventListener("change", event => {
      selectedUploadFiles = [...event.target.files];
      showSelectedFiles();
    });
    const zone = document.getElementById("drop-zone");
    zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", event => {
      event.preventDefault(); zone.classList.remove("dragover");
      selectedUploadFiles = [...event.dataTransfer.files];
      showSelectedFiles();
    });
    document.getElementById("new-case-form").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const now = new Date().toISOString();
      const item = { id: `case-${Date.now()}`, title: data.get("title").trim(), number: data.get("number").trim(), category: data.get("category"), court: data.get("court").trim(), nextDate: data.get("nextDate"), nextTime: data.get("nextTime"), summary: data.get("summary").trim(), createdAt: now, updatedAt: now };
      state.cases.unshift(item);
      if (!persist()) { state.cases.shift(); return; }
      const attachedFiles = selectedUploadFiles.length ? await addFilesToCase(selectedUploadFiles, item.id) : true;
      closeModal(); updateCaseCount(); renderPage();
      showToast(attachedFiles ? `“${item.title}” added to your cases.` : `“${item.title}” was created, but its files could not be saved.`);
    });
  }
  function fileRecord(file, caseId) {
    return { id: `file-${Date.now()}-${Math.random().toString(16).slice(2,7)}`, name: file.name, type: file.type || "application/octet-stream", size: file.size, caseId, addedAt: new Date().toISOString() };
  }
  function showSelectedFiles() {
    const list = document.getElementById("selected-files");
    if (list) list.innerHTML = selectedUploadFiles.map(file => `<span>▤ ${safe(file.name)} · ${formatSize(file.size)}</span>`).join("");
  }
  function formatSize(bytes) {
    if (!bytes) return "0 KB";
    return bytes < 1024 * 1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
  }
  function updateCaseCount() { document.getElementById("case-nav-count").textContent = state.cases.length; }
  function openCaseDetails(id) {
    const item = findCase(id);
    if (!item) return;
    const files = state.files.filter(file => file.caseId === id);
    const comments = state.comments.filter(comment => comment.caseId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const isReference = id.startsWith("ref-");
    openModal(`${modalHeader(safe(item.title), safe(item.citation || item.number || "Case details"))}<div class="detail-meta"><span class="case-type">${safe(item.category || "General")}</span>${item.court ? `<span class="tag">${safe(item.court)}</span>` : ""}</div>
      ${item.summary ? `<div class="detail-section"><h3>Notes / summary</h3><p>${safe(item.summary)}</p></div>` : ""}
      ${item.nextDate ? `<div class="detail-section"><h3>Next hearing</h3><p>${formatDate(item.nextDate)}${item.nextTime ? ` · ${safe(item.nextTime)}` : ""}</p></div>` : ""}
      <div class="detail-section"><h3>Documents · ${files.length}</h3><div class="detail-files">${files.length ? files.map(file => `<div class="detail-file"><span class="file-badge">${safe(file.name.split(".").pop().slice(0,4).toUpperCase())}</span><span>${safe(file.name)} · ${formatSize(file.size)}</span><button data-action="download-file" data-id="${safe(file.id)}">Open</button><button data-action="remove-file" data-id="${safe(file.id)}">Remove</button></div>`).join("") : `<span class="draft-empty">No documents attached yet.</span>`}</div></div>
      <section class="case-comments"><div class="case-comments-heading"><h3>Comments</h3><span>${comments.length}</span></div>
        ${comments.length ? `<div class="case-comment-list">${comments.map(comment => `<article class="case-comment"><div class="case-comment-meta"><strong>${safe(comment.author)}</strong><time datetime="${safe(comment.createdAt)}">${dateTimeLabel(comment.createdAt)}</time></div><p>${safe(comment.text)}</p></article>`).join("")}</div>` : `<p class="case-comments-empty">No comments yet. Add a note or update for this case.</p>`}
        <form id="case-comment-form" data-case-id="${safe(id)}"><label for="case-comment-text">Add a comment</label><textarea id="case-comment-text" name="comment" maxlength="1000" required placeholder="Write a comment about this case…"></textarea><div class="case-comment-form-footer"><span>Up to 1,000 characters</span><button class="button button-primary button-small" type="submit">Add comment</button></div></form>
      </section>
      <div class="modal-actions">${isReference ? `<button class="button" data-action="share-case" data-id="${safe(item.id)}">Share reference</button>` : `<button class="button" data-action="upload-case-files" data-id="${safe(item.id)}">＋ Add documents</button>`}<button class="button button-primary" data-action="close-modal">Done</button></div>`);
    document.getElementById("case-comment-form").addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = new FormData(form).get("comment").trim();
      if (!text) return;
      const comment = {
        id: `comment-${Date.now()}`,
        caseId: id,
        author: currentUserName(),
        text,
        createdAt: new Date().toISOString()
      };
      state.comments.push(comment);
      if (persist()) {
        openCaseDetails(id);
        document.getElementById("case-comment-text")?.focus();
        showToast("Comment added.");
      } else {
        state.comments.pop();
      }
    });
  }
  function openUploadPrompt(caseId = "") {
    const chooser = document.getElementById("quick-upload-input");
    chooser.value = "";
    chooser.onchange = () => {
      const files = [...chooser.files];
      if (!files.length) return;
      if (!caseId && state.cases.length === 0) {
        showToast("Create a case before adding documents.", true);
        return;
      }
      if (!caseId && state.cases.length > 1) {
        openUploadCasePicker(files);
        return;
      }
      const targetId = caseId || state.cases[0].id;
      addFilesToCase(files, targetId).then(saved => {
        if (saved) {
          renderPage();
          showToast(`${files.length} document${files.length === 1 ? "" : "s"} added.`);
        }
      });
    };
    chooser.click();
  }
  function openUploadCasePicker(files) {
    openModal(`${modalHeader("Choose a case", "Select where these documents should be filed.")}<div class="draft-list">${state.cases.map(item => `<button class="draft-item" data-action="finish-upload" data-id="${safe(item.id)}"><strong>${safe(item.title)}</strong><small>${safe(item.category)}</small></button>`).join("")}</div>`);
    modalContent.querySelectorAll("[data-action=finish-upload]").forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.id;
      addFilesToCase(files, id).then(saved => {
        if (saved) { closeModal(); renderPage(); showToast(`${files.length} document${files.length === 1 ? "" : "s"} added to the case.`); }
      });
    }));
  }
  function deleteCase(id) {
    const item = state.cases.find(candidate => candidate.id === id);
    if (!item) return;
    openModal(`${modalHeader("Remove this case?", "This also removes its saved files and linked diary entries from this browser.")}<div class="detail-section"><p><strong>${safe(item.title)}</strong></p></div><div class="modal-actions"><button class="button" data-action="close-modal">Keep case</button><button class="button button-primary" data-action="confirm-delete-case" data-id="${safe(id)}">Remove case</button></div>`);
  }
  function createDiaryEntry() {
    const entry = { id: `entry-${Date.now()}`, title: "", date: isoDate, caseId: "", body: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.diary.unshift(entry);
    activeDiaryId = entry.id;
    if (persist()) renderPage();
    else {
      state.diary.shift();
      activeDiaryId = state.diary[0]?.id || null;
    }
  }
  async function shareCase(id) {
    const item = findCase(id);
    if (!item) return;
    const text = `${item.title} — ${item.citation || item.number || "Advocate Diary"}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, text });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error("Share is not available in this browser.");
      showToast(navigator.share ? "Case reference shared." : "Case reference copied.");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Could not share the case reference.", error);
      showToast("Could not share this reference. You can copy its citation from the case details.", true);
    }
  }
  function globalSearch(value) {
    const query = value.trim().toLowerCase();
    if (!query) return;
    const diaryMatch = state.diary.find(entry => [entry.title, entry.body, caseName(entry.caseId)].join(" ").toLowerCase().includes(query));
    if (diaryMatch) {
      activeDiaryId = diaryMatch.id;
      setPage("diary");
      return;
    }
    const fileMatch = state.files.find(file => [file.name, caseName(file.caseId)].join(" ").toLowerCase().includes(query));
    if (fileMatch) {
      setPage("my-cases");
      openCaseDetails(fileMatch.caseId);
      return;
    }
    const matches = allCases().filter(item => [item.title,item.citation,item.number,item.category,item.summary].join(" ").toLowerCase().includes(query));
    if (matches.length) {
      const userCase = matches.find(item => !item.id.startsWith("ref-"));
      setPage(userCase ? "my-cases" : "case-library");
      if (userCase) {
        const input = document.getElementById("my-cases-search"); input.value = query; input.dispatchEvent(new Event("input"));
      } else {
        const input = document.getElementById("library-search"); input.value = query; input.dispatchEvent(new Event("input"));
      }
    } else {
      setPage("my-cases");
      const input = document.getElementById("my-cases-search"); input.value = query; input.dispatchEvent(new Event("input"));
      showToast(`No cases found for “${value.trim()}”.`);
    }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-page], [data-action], [data-open-case], [data-open-entry], [data-case-row]");
    if (!target) return;
    if (target.dataset.page) { event.preventDefault(); setPage(target.dataset.page); return; }
    if (target.dataset.openCase) { openCaseDetails(target.dataset.openCase); return; }
    if (target.dataset.openEntry) { activeDiaryId = target.dataset.openEntry; setPage("diary"); return; }
    if (target.dataset.caseRow) { openCaseDetails(target.dataset.caseRow); return; }
    switch (target.dataset.action) {
      case "new-case": openNewCaseModal(); break;
      case "close-modal": closeModal(); break;
      case "upload-files": openUploadPrompt(); break;
      case "upload-case-files": {
        const id = target.dataset.id; closeModal(); openUploadPrompt(id); break;
      }
      case "new-entry": createDiaryEntry(); break;
      case "delete-entry": confirmDeleteDiaryEntry(target.dataset.id); break;
      case "confirm-delete-entry": {
        const previousDiary = state.diary;
        const deletedId = target.dataset.id;
        state.diary = state.diary.filter(entry => entry.id !== deletedId);
        if (persist()) {
          activeDiaryId = state.diary[0]?.id || null;
          closeModal(); renderPage(); showToast("Diary entry deleted.");
        } else state.diary = previousDiary;
        break;
      }
      case "calendar-shift": {
        calendarMonthOffset += Number(target.dataset.direction);
        const month = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
        selectedCalendarDay = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-01`;
        renderPage();
        break;
      }
      case "calendar-today":
        calendarMonthOffset = 0;
        selectedCalendarDay = isoDate;
        renderPage();
        break;
      case "select-calendar-day":
        selectedCalendarDay = target.dataset.date;
        renderPage();
        break;
      case "open-resource": openResource(target.dataset.id); break;
      case "download-checklist": downloadChecklist(); break;
      case "delete-feedback": {
        const previousFeedback = state.feedback;
        state.feedback = previousFeedback.filter(item => item.id !== target.dataset.id);
        if (persist()) { renderPage(); showToast("Saved feedback removed."); }
        else state.feedback = previousFeedback;
        break;
      }
      case "show-login-disclaimer":
        openModal(`${modalHeader("Privacy & data information", "Your workspace data") }<div class="detail-section"><p>Case details, diary entries, feedback, and uploaded files are stored in this browser. They stay on this device and are not available in other browsers or devices.</p><p>Your email address separates your workspace from other sign-ins on this device. Passwords are not checked against an online account, and workspace data does not sync. Avoid entering confidential client information.</p></div><div class="modal-actions"><button class="button button-primary" data-action="close-modal">Got it</button></div>`);
        break;
      case "logout":
        sessionStorage.removeItem(SESSION_KEY);
        closeModal();
        setAuthenticatedView(false);
        break;
      case "delete-case": deleteCase(target.dataset.id); break;
      case "confirm-delete-case": {
        const id = target.dataset.id;
        const removedFiles = state.files.filter(file => file.caseId === id);
        const previousCases = state.cases;
        const previousFiles = state.files;
        const previousDiary = state.diary;
        const previousComments = state.comments;
        state.cases = previousCases.filter(item => item.id !== id);
        state.files = previousFiles.filter(file => file.caseId !== id);
        state.diary = previousDiary.filter(entry => entry.caseId !== id);
        state.comments = previousComments.filter(comment => comment.caseId !== id);
        if (persist()) {
          Promise.allSettled(removedFiles.map(file => deleteFileBlob(file.id))).then(results => {
            if (results.some(result => result.status === "rejected")) showToast("The case was removed, but some local file data could not be cleaned up.", true);
          });
          closeModal(); updateCaseCount(); renderPage(); showToast("Case and its linked workspace items removed.");
        } else {
          state.cases = previousCases;
          state.files = previousFiles;
          state.diary = previousDiary;
          state.comments = previousComments;
        }
        break;
      }
      case "remove-file": {
        const file = state.files.find(item => item.id === target.dataset.id);
        if (!file) break;
        const previousFiles = state.files;
        state.files = previousFiles.filter(item => item.id !== file.id);
        if (persist()) {
          deleteFileBlob(file.id).catch(error => { console.error("Could not delete the stored case file.", error); showToast("The file record was removed, but local file cleanup failed.", true); });
          openCaseDetails(file.caseId); showToast("Document removed.");
        } else state.files = previousFiles;
        break;
      }
      case "download-file": {
        const record = state.files.find(file => file.id === target.dataset.id);
        if (!record) break;
        getFileBlob(record.id).then(saved => {
          if (!saved?.blob) throw new Error("The original file is not available on this device.");
          const url = URL.createObjectURL(saved.blob);
          const link = document.createElement("a");
          link.href = url; link.download = saved.name || record.name;
          document.body.append(link); link.click(); link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }).catch(error => { console.error("Could not retrieve the case file.", error); showToast(error.message || "Could not open this file.", true); });
        break;
      }
      case "share-case": shareCase(target.dataset.id); break;
      case "save-reference": {
        const ref = findCase(target.dataset.id);
        if (!ref) break;
        if (state.cases.some(item => item.referenceId === ref.id)) { showToast("This reference is already in your cases."); break; }
        const now = new Date().toISOString();
        const previousCases = state.cases;
        state.cases.unshift({ ...ref, id: `case-${Date.now()}`, referenceId: ref.id, summary: `Saved reference — ${ref.summary}`, createdAt: now, updatedAt: now });
        if (persist()) { updateCaseCount(); renderPage(); showToast("Reference saved to My cases."); }
        else state.cases = previousCases;
        break;
      }
      case "read-news": {
        if (!state.readNews.includes(target.dataset.id)) state.readNews.push(target.dataset.id);
        if (persist()) { renderPage(); showToast("Article marked as read."); }
        break;
      }
      default: break;
    }
  });
  content.addEventListener("keydown", event => {
    const row = event.target.closest("[data-open-case]");
    if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openCaseDetails(row.dataset.openCase); }
  });
  modalBackdrop.addEventListener("click", event => { if (event.target === modalBackdrop) closeModal(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); document.getElementById("global-search").focus();
    }
  });
  document.getElementById("global-search").addEventListener("keydown", event => {
    if (event.key === "Enter") { globalSearch(event.currentTarget.value); event.currentTarget.blur(); }
    if (event.key === "Escape") { event.currentTarget.value = ""; event.currentTarget.blur(); }
  });
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("notification-button").addEventListener("click", () => {
    setPage("legal-updates");
    showToast("You're all caught up on the latest updates.");
  });
  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const error = document.getElementById("login-error");
    if (!email || !password) {
      error.textContent = "Enter an email and password to continue.";
      error.hidden = false;
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, email);
      error.hidden = true;
      setAuthenticatedView(true);
    } catch (storageError) {
      console.error("Could not start the workspace session.", storageError);
      error.textContent = "This browser could not start a session. Check its storage settings and try again.";
      error.hidden = false;
    }
  });
  document.getElementById("login-password").addEventListener("input", () => {
    const error = document.getElementById("login-error");
    error.hidden = true;
  });
  setAuthenticatedView(isLoggedIn());
})();
