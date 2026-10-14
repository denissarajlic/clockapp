// The timer remembers when it started, so it keeps counting
// even if the page is closed and opened again.
const STORAGE_KEY = "runningTimer";

const descriptionInput = document.getElementById("description");
const clock = document.getElementById("clock");
const toggleButton = document.getElementById("toggle");
const lastEntry = document.getElementById("last");

let running = null; // { start: timestamp, description: text } while the timer runs
let tick = null;

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
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
  const duration = Date.now() - running.start;
  const description = running.description || "(no description)";
  lastEntry.textContent = `Last: ${description} — ${formatDuration(duration)}`;

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

// If a timer was running when the page was closed, continue it.
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  running = JSON.parse(saved);
  descriptionInput.value = running.description;
  tick = setInterval(updateClock, 1000);
}
showRunning();
