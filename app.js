// The timer remembers when it started, so it keeps counting
// even if the page is closed and opened again.
const STORAGE_KEY = "runningTimer";
const ENTRIES_KEY = "entries";

const descriptionInput = document.getElementById("description");
const tagsInput = document.getElementById("tags");
const tagSuggestions = document.getElementById("tag-suggestions");
const clock = document.getElementById("clock");
const toggleButton = document.getElementById("toggle");
const daysList = document.getElementById("days");
const emptyMessage = document.getElementById("empty");
const manualForm = document.getElementById("manual-form");
const manualDescription = document.getElementById("manual-description");
const manualTags = document.getElementById("manual-tags");
const manualDate = document.getElementById("manual-date");
const manualStart = document.getElementById("manual-start");
const manualEnd = document.getElementById("manual-end");
const manualError = document.getElementById("manual-error");

let running = null; // { start, description, tags } while the timer runs
let tick = null;
let entries = JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// "Today", "Yesterday", or a date like "Mon, 12 Oct 2026".
function formatDay(timestamp) {
  const day = new Date(timestamp).toDateString();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (day === today.toDateString()) return "Today";
  if (day === yesterday.toDateString()) return "Yesterday";
  return new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "work, Study ,work" -> ["work", "study"]
function parseTags(text) {
  const tags = text
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== "");
  return [...new Set(tags)];
}

// Every tag used so far, most used first.
function allTags() {
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
}

function renderTagList(tags) {
  const list = document.createElement("div");
  list.className = "tag-list";
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    list.append(chip);
  }
  return list;
}

// Buttons under the timer for tags used before. Tapping one adds or removes it.
function renderTagSuggestions() {
  tagSuggestions.innerHTML = "";
  const selected = parseTags(tagsInput.value);

  for (const tag of allTags()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = selected.includes(tag) ? "tag selected" : "tag";
    button.textContent = tag;
    button.addEventListener("click", () => {
      const tags = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
      tagsInput.value = tags.join(", ");
      tagsInput.dispatchEvent(new Event("input"));
    });
    tagSuggestions.append(button);
  }
}

function saveEntries() {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function addEntry(entry) {
  entries.push(entry);
  saveEntries();
  renderHistory();
}

function deleteEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (!confirm(`Delete "${entry.description}"?`)) return;
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  renderHistory();
}

function renderEntry(entry) {
  const row = document.createElement("div");
  row.className = "entry";

  const main = document.createElement("div");
  main.className = "entry-main";

  const description = document.createElement("div");
  description.className = "entry-description";
  description.textContent = entry.description;

  const time = document.createElement("div");
  time.className = "entry-time";
  time.textContent = `${formatTime(entry.start)} – ${formatTime(entry.end)}`;

  main.append(description, time, renderTagList(entry.tags || []));

  const duration = document.createElement("div");
  duration.className = "entry-duration";
  duration.textContent = formatDuration(entry.end - entry.start);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete";
  deleteButton.textContent = "✕";
  deleteButton.title = "Delete";
  deleteButton.addEventListener("click", () => deleteEntry(entry.id));

  row.append(main, duration, deleteButton);
  return row;
}

// Show all entries, newest first, grouped by day with a total for each day.
function renderHistory() {
  daysList.innerHTML = "";
  emptyMessage.hidden = entries.length > 0;

  const sorted = [...entries].sort((a, b) => b.start - a.start);
  const groups = new Map();
  for (const entry of sorted) {
    const day = new Date(entry.start).toDateString();
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(entry);
  }

  for (const dayEntries of groups.values()) {
    const total = dayEntries.reduce((sum, e) => sum + (e.end - e.start), 0);

    const day = document.createElement("div");
    day.className = "day";

    const header = document.createElement("div");
    header.className = "day-header";
    const label = document.createElement("span");
    label.textContent = formatDay(dayEntries[0].start);
    const totalLabel = document.createElement("span");
    totalLabel.textContent = formatDuration(total);
    header.append(label, totalLabel);

    day.append(header, ...dayEntries.map(renderEntry));
    daysList.append(day);
  }

  renderTagSuggestions();
}

function updateClock() {
  clock.textContent = running ? formatDuration(Date.now() - running.start) : "00:00:00";
}

function showRunning() {
  toggleButton.textContent = running ? "Stop" : "Start";
  toggleButton.className = running ? "stop" : "start";
  updateClock();
}

function startTimer() {
  running = {
    start: Date.now(),
    description: descriptionInput.value.trim(),
    tags: parseTags(tagsInput.value),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(running));
  tick = setInterval(updateClock, 1000);
  showRunning();
}

function stopTimer() {
  addEntry({
    id: newId(),
    description: running.description || "(no description)",
    tags: running.tags || [],
    start: running.start,
    end: Date.now(),
  });

  running = null;
  localStorage.removeItem(STORAGE_KEY);
  clearInterval(tick);
  descriptionInput.value = "";
  tagsInput.value = "";
  renderTagSuggestions();
  showRunning();
}

toggleButton.addEventListener("click", () => {
  if (running) {
    stopTimer();
  } else {
    startTimer();
  }
});

// Keep the description and tags up to date if they are changed while the timer runs.
function updateRunning() {
  if (running) {
    running.description = descriptionInput.value.trim();
    running.tags = parseTags(tagsInput.value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(running));
  }
}

descriptionInput.addEventListener("input", updateRunning);
tagsInput.addEventListener("input", () => {
  updateRunning();
  renderTagSuggestions();
});

// Today's date as "2026-10-14", the format a date field expects.
function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

manualForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const start = new Date(`${manualDate.value}T${manualStart.value}`).getTime();
  const end = new Date(`${manualDate.value}T${manualEnd.value}`).getTime();
  if (end <= start) {
    manualError.textContent = "End time must be after start time.";
    manualError.hidden = false;
    return;
  }

  manualError.hidden = true;
  addEntry({
    id: newId(),
    description: manualDescription.value.trim() || "(no description)",
    tags: parseTags(manualTags.value),
    start,
    end,
  });

  manualDescription.value = "";
  manualTags.value = "";
  manualStart.value = "";
  manualEnd.value = "";
});

manualDate.value = todayValue();

// Menu: show one view (Timer, Calendar or Activity) at a time
// and remember which one was open last.
const VIEW_KEY = "view";
const navItems = document.querySelectorAll(".nav-item");

function showView(name) {
  for (const item of navItems) {
    item.classList.toggle("active", item.dataset.view === name);
  }
  for (const view of document.querySelectorAll(".view")) {
    view.hidden = view.id !== `view-${name}`;
  }
  localStorage.setItem(VIEW_KEY, name);
  window.scrollTo(0, 0);
}

for (const item of navItems) {
  item.addEventListener("click", () => showView(item.dataset.view));
}
showView(localStorage.getItem(VIEW_KEY) || "timer");

// If a timer was running when the page was closed, continue it.
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  running = JSON.parse(saved);
  descriptionInput.value = running.description;
  tagsInput.value = (running.tags || []).join(", ");
  tick = setInterval(updateClock, 1000);
}
showRunning();
renderHistory();
