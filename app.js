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

function totalTime(list) {
  return list.reduce((sum, e) => sum + (e.end - e.start), 0);
}

// A card with the day's name and total on top, and its entries below.
function renderDayCard(timestamp, dayEntries) {
  const day = document.createElement("div");
  day.className = "day";

  const header = document.createElement("div");
  header.className = "day-header";
  const label = document.createElement("span");
  label.textContent = formatDay(timestamp);
  const totalLabel = document.createElement("span");
  totalLabel.textContent = formatDuration(totalTime(dayEntries));
  header.append(label, totalLabel);

  day.append(header, ...dayEntries.map(renderEntry));
  return day;
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
    daysList.append(renderDayCard(dayEntries[0].start, dayEntries));
  }

  renderTagSuggestions();
  renderCalendar();
  renderActivity();
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

// Calendar: one month at a time. Each day shows how long you worked;
// tapping a day shows its entries below the calendar.
const calendarTitle = document.getElementById("cal-title");
const calendarGrid = document.getElementById("cal-grid");
const calendarDay = document.getElementById("cal-day");

let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = new Date();

// 2h 30m -> "2:30"
function formatHours(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${Math.floor(totalMinutes / 60)}:${minutes}`;
}

function entriesOn(date) {
  const day = date.toDateString();
  return entries
    .filter((e) => new Date(e.start).toDateString() === day)
    .sort((a, b) => a.start - b.start);
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  calendarTitle.textContent = calendarMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";

  // Weeks start on Monday, so leave empty boxes before the 1st.
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < blanks; i++) {
    calendarGrid.append(document.createElement("div"));
  }

  const today = new Date().toDateString();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const total = totalTime(entriesOn(date));

    const cell = document.createElement("button");
    cell.className = "cal-day";
    if (total > 0) cell.classList.add("has-time");
    if (date.toDateString() === today) cell.classList.add("today");
    if (date.toDateString() === selectedDate.toDateString()) cell.classList.add("selected");

    const number = document.createElement("span");
    number.textContent = d;
    const hours = document.createElement("span");
    hours.className = "cal-hours";
    hours.textContent = total > 0 ? formatHours(total) : "";
    cell.append(number, hours);

    cell.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
    });
    calendarGrid.append(cell);
  }

  renderSelectedDay();
}

function renderSelectedDay() {
  calendarDay.innerHTML = "";
  const dayEntries = entriesOn(selectedDate);
  const card = renderDayCard(selectedDate.getTime(), dayEntries);
  if (dayEntries.length === 0) {
    const nothing = document.createElement("div");
    nothing.className = "entry empty";
    nothing.textContent = "Nothing tracked on this day.";
    card.append(nothing);
  }
  calendarDay.append(card);
}

function changeMonth(step) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + step, 1);
  renderCalendar();
}

document.getElementById("cal-prev").addEventListener("click", () => changeMonth(-1));
document.getElementById("cal-next").addEventListener("click", () => changeMonth(1));
document.getElementById("cal-today").addEventListener("click", () => {
  selectedDate = new Date();
  calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderCalendar();
});

// Activity: totals for today, this week and this month, a chart of
// the week, and where the time went (by tag and by description).
const PERIOD_KEY = "activityPeriod";
const periodOptions = document.querySelectorAll(".period-option");
let activityPeriod = localStorage.getItem(PERIOD_KEY) || "week";

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Weeks start on Monday.
function startOfWeek(date) {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function entriesSince(date) {
  return entries.filter((e) => e.start >= date.getTime());
}

// One row per name: the name and time on top, a bar below.
function renderBars(container, totals, emptyText) {
  container.innerHTML = "";
  const rows = [...totals].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const sum = rows.reduce((total, row) => total + row[1], 0);
  const max = rows[0][1];
  for (const [name, time] of rows) {
    const percent = Math.round((time / sum) * 100);

    const row = document.createElement("div");
    row.title = `${name}: ${formatHours(time)} (${percent}%)`;

    const top = document.createElement("div");
    top.className = "bar-row-top";
    const label = document.createElement("span");
    label.className = "bar-name";
    label.textContent = name;
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = `${formatHours(time)} · ${percent}%`;
    top.append(label, value);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(time / max) * 100}%`;
    track.append(fill);

    row.append(top, track);
    container.append(row);
  }
}

function renderWeekChart() {
  const chart = document.getElementById("week-chart");
  chart.innerHTML = "";

  const monday = startOfWeek(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push({ date, total: totalTime(entriesOn(date)) });
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  const today = new Date().toDateString();

  for (const { date, total } of days) {
    const name = date.toLocaleDateString("en-GB", { weekday: "short" });

    const column = document.createElement("div");
    column.className = "week-day";
    column.title = `${name}: ${formatHours(total)}`;

    const value = document.createElement("div");
    value.className = "week-value";
    value.textContent = total > 0 ? formatHours(total) : "";

    const track = document.createElement("div");
    track.className = "week-track";
    const bar = document.createElement("div");
    bar.className = "week-bar";
    bar.style.height = `${(total / max) * 100}%`;
    track.append(bar);

    const label = document.createElement("div");
    label.className = date.toDateString() === today ? "week-label today" : "week-label";
    label.textContent = name;

    column.append(value, track, label);
    chart.append(column);
  }
}

function renderActivity() {
  const now = new Date();
  document.getElementById("stat-today").textContent = formatHours(totalTime(entriesOn(now)));
  document.getElementById("stat-week").textContent = formatHours(totalTime(entriesSince(startOfWeek(now))));
  document.getElementById("stat-month").textContent = formatHours(totalTime(entriesSince(startOfMonth(now))));

  renderWeekChart();

  for (const option of periodOptions) {
    option.classList.toggle("active", option.dataset.period === activityPeriod);
  }
  const since = { week: startOfWeek(now), month: startOfMonth(now), all: new Date(0) }[activityPeriod];
  const periodEntries = entriesSince(since);

  const byTag = new Map();
  const byDescription = new Map();
  for (const entry of periodEntries) {
    const time = entry.end - entry.start;
    const tags = entry.tags && entry.tags.length > 0 ? entry.tags : ["(no tag)"];
    for (const tag of tags) {
      byTag.set(tag, (byTag.get(tag) || 0) + time);
    }
    byDescription.set(entry.description, (byDescription.get(entry.description) || 0) + time);
  }

  renderBars(document.getElementById("tag-chart"), byTag, "Nothing tracked in this period.");
  renderBars(
    document.getElementById("top-activities"),
    [...byDescription].sort((a, b) => b[1] - a[1]).slice(0, 5),
    "Nothing tracked in this period."
  );
}

for (const option of periodOptions) {
  option.addEventListener("click", () => {
    activityPeriod = option.dataset.period;
    localStorage.setItem(PERIOD_KEY, activityPeriod);
    renderActivity();
  });
}

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
