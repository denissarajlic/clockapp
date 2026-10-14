// The timer remembers when it started, so it keeps counting
// even if the page is closed and opened again.
const STORAGE_KEY = "runningTimer";
const ENTRIES_KEY = "entries";

const descriptionInput = document.getElementById("description");
const clock = document.getElementById("clock");
const toggleButton = document.getElementById("toggle");
const daysList = document.getElementById("days");
const emptyMessage = document.getElementById("empty");
const manualForm = document.getElementById("manual-form");
const manualDescription = document.getElementById("manual-description");
const manualDate = document.getElementById("manual-date");
const manualStart = document.getElementById("manual-start");
const manualEnd = document.getElementById("manual-end");
const manualError = document.getElementById("manual-error");

let running = null; // { start: timestamp, description: text } while the timer runs
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

  main.append(description, time);

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
  running = { start: Date.now(), description: descriptionInput.value.trim() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(running));
  tick = setInterval(updateClock, 1000);
  showRunning();
}

function stopTimer() {
  addEntry({
    id: newId(),
    description: running.description || "(no description)",
    start: running.start,
    end: Date.now(),
  });

  running = null;
  localStorage.removeItem(STORAGE_KEY);
  clearInterval(tick);
  descriptionInput.value = "";
  showRunning();
}

toggleButton.addEventListener("click", () => {
  if (running) {
    stopTimer();
  } else {
    startTimer();
  }
});

// Keep the description up to date if it is changed while the timer runs.
descriptionInput.addEventListener("input", () => {
  if (running) {
    running.description = descriptionInput.value.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(running));
  }
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
    start,
    end,
  });

  manualDescription.value = "";
  manualStart.value = "";
  manualEnd.value = "";
});

manualDate.value = todayValue();

// If a timer was running when the page was closed, continue it.
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  running = JSON.parse(saved);
  descriptionInput.value = running.description;
  tick = setInterval(updateClock, 1000);
}
showRunning();
renderHistory();
