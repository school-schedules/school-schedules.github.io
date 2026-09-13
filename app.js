const DEFAULT_CSV = "./triangle_school_closures_2026_2027.csv";
const SCHOOL_COLORS = {
  "Chapel Hill-Carrboro City Schools": "#c17f26",
  "Duke School": "#c74f5c",
  "Durham Academy": "#2f7d6f",
  "Durham Public Schools (Traditional Calendar)": "#4268a0",
  "The Lerner School": "#7c4bc8",
};

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const statusMessage = document.getElementById("statusMessage");
const uploadHint = document.getElementById("uploadHint");
const csvFileInput = document.getElementById("csvFileInput");
const schoolFilters = document.getElementById("schoolFilters");
const typeFilters = document.getElementById("typeFilters");
const selectAllSchools = document.getElementById("selectAllSchools");
const clearSchools = document.getElementById("clearSchools");
const selectAllTypes = document.getElementById("selectAllTypes");
const clearTypes = document.getElementById("clearTypes");
const summaryText = document.getElementById("summaryText");
const calendarArea = document.getElementById("calendarArea");
const emptyState = document.getElementById("emptyState");
const legend = document.getElementById("legend");
const drawer = document.getElementById("eventDrawer");
const drawerDate = document.getElementById("drawerDate");
const drawerBody = document.getElementById("drawerBody");
const drawerClose = document.getElementById("drawerClose");

const state = {
  rows: [],
  schools: [],
  types: [],
  recordsByDate: new Map(),
  activeSchools: new Set(),
  activeTypes: new Set(),
  rangeStart: null,
  rangeEnd: null,
};
function toLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((num) => Number.isNaN(num))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return dateKey(date) === value ? date : null;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shortSchoolName(fullName) {
  if (fullName === "Chapel Hill-Carrboro City Schools") return "CHCCS";
  if (fullName === "Durham Academy") return "DA";
  if (fullName === "Duke School") return "Duke";
  if (fullName === "Durham Public Schools (Traditional Calendar)") return "DPS";
  if (fullName === "The Lerner School") return "Lerner";
  return fullName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function schoolColor(name) {
  if (SCHOOL_COLORS[name]) return SCHOOL_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  const hue = hash;
  return `hsl(${hue}, 55%, 55%)`;
}

function buildRows(records) {
  const normalized = [];
  const bySchool = new Set();
  const byType = new Set();

  records.forEach((row, index) => {
    const date = toLocalDate(row.Date);
    if (!date || !row.School) {
      throw new Error(`CSV row ${index + 2} needs a valid YYYY-MM-DD date and school.`);
    }
    const school = row.School || "";
    const type = row.Closure_Type || "Unspecified";
    const event = row.Event || "School event";
    const scope = row.Calendar_or_Scope || "";
    const conference = row.Parent_Teacher_Conference || "";
    const notes = row.Notes || "";
    const source = row.Source_URL || row.Secondary_Source_URL || "";

    normalized.push({
      date,
      dateKey: dateKey(date),
      school,
      type,
      event,
      scope,
      conference,
      notes,
      source,
      schoolShort: shortSchoolName(school),
      color: schoolColor(school),
    });

    if (school) bySchool.add(school);
    byType.add(type);
  });

  const sortedByDate = normalized.sort((a, b) => a.date - b.date);
  const allDates = sortedByDate.map((row) => row.dateKey);
  const map = new Map();
  normalized.forEach((row) => {
    const key = row.dateKey;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });

  const dates = allDates.filter(
    (value, index, self) => self.indexOf(value) === index
  );

  state.rows = sortedByDate;
  state.recordsByDate = map;
  state.schools = Array.from(bySchool).sort();
  state.types = Array.from(byType).sort();
  state.rangeStart = dates.length ? toLocalDate(dates[0]) : null;
  state.rangeEnd = dates.length ? toLocalDate(dates[dates.length - 1]) : null;
}

function buildFilterList(container, items, activeSet, onChange) {
  container.innerHTML = "";
  items.forEach((item) => {
    const wrapper = document.createElement("label");
    wrapper.className = "filter-line";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = item;
    checkbox.checked = true;
    activeSet.add(item);

    const text = document.createElement("span");
    text.textContent = item;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) activeSet.add(item);
      else activeSet.delete(item);
      onChange();
    });

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
  });
}

function updateSummary() {
  const activeSchoolCount = state.rows.filter((row) => {
    return state.activeSchools.has(row.school) && state.activeTypes.has(row.type);
  }).length;
  summaryText.innerHTML =
    `<span>${activeSchoolCount}</span> day-off entries currently visible. ` +
    `Schools selected: <span>${state.activeSchools.size}</span>. ` +
    `Types selected: <span>${state.activeTypes.size}</span>.`;
}

function drawLegend() {
  legend.innerHTML = "";
  state.schools.forEach((school) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = schoolColor(school);
    const text = document.createElement("span");
    text.textContent = school;
    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  });
}

function monthIterator() {
  const months = [];
  if (!state.rangeStart || !state.rangeEnd) return months;

  let current = new Date(state.rangeStart.getFullYear(), state.rangeStart.getMonth(), 1);
  const end = new Date(state.rangeEnd.getFullYear(), state.rangeEnd.getMonth(), 1);

  while (current <= end) {
    months.push({
      year: current.getFullYear(),
      month: current.getMonth(),
    });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function getFilteredRecordsForDate(rowDateKey) {
  const records = state.recordsByDate.get(rowDateKey) || [];
  return records.filter((row) =>
    state.activeSchools.has(row.school) && state.activeTypes.has(row.type)
  );
}

function getClassForPill(row) {
  const color = schoolColor(row.school);
  return `border-color:${color}; color:${color};`;
}

function showDetails(date, records) {
  const safeRecords = records || [];
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    drawerDate.textContent = "Date unavailable";
    drawerBody.textContent = "Choose a valid date from the calendar.";
    drawer.dataset.date = "";
    if (!drawer.open) drawer.showModal();
    return;
  }
  drawerDate.textContent = formatDate(date);
  drawerBody.innerHTML = "";
  drawer.dataset.date = dateKey(date);
  const campCount = getCampsForDate(dateKey(date)).length;
  if (campCount) {
    const jump = document.createElement("button");
    jump.type = "button";
    jump.className = "jump-to-camps";
    jump.textContent = `View ${campCount} camp option${campCount === 1 ? "" : "s"} ↓`;
    jump.addEventListener("click", () => drawerBody.querySelector(".camp-details").scrollIntoView({ block: "start" }));
    drawerBody.appendChild(jump);
  }
  const schoolHeading = document.createElement("h3");
  schoolHeading.textContent = "School days off";
  drawerBody.appendChild(schoolHeading);

  if (!safeRecords.length) {
    const message = document.createElement("p");
    message.textContent = "No matching school events for the selected filters.";
    drawerBody.appendChild(message);
  }

  const eventList = document.createElement("ul");

  safeRecords.forEach((row) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = `${row.schoolShort}: ${row.event}`;
    item.appendChild(title);
    item.appendChild(document.createElement("br"));

    const chips = document.createElement("div");
    chips.className = "small";
    const labels = [`Type: ${row.type}`];
    if (row.conference) labels.push(`Parent/teacher conference: ${row.conference}`);
    if (row.scope) labels.push(row.scope);
    labels.forEach((label) => {
      const chip = document.createElement("span");
      chip.dataset.chip = "";
      chip.style.borderColor = row.color;
      chip.style.color = row.color;
      chip.textContent = label;
      chips.appendChild(chip);
    });
    item.appendChild(chips);

    if (row.notes) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = row.notes;
      item.appendChild(p);
    }

    if (/^https?:\/\//i.test(row.source)) {
      const link = document.createElement("a");
      link.href = row.source;
      link.target = "_blank";
      link.className = "muted-link";
      link.textContent = "source";
      link.rel = "noopener noreferrer";
      item.appendChild(link);
    }

    eventList.appendChild(item);
  });

  drawerBody.appendChild(eventList);
  appendCampDetails(drawerBody, dateKey(date));
  if (!drawer.open) drawer.showModal();
}

function hideDetails() {
  drawer.close();
}

function renderMonths() {
  calendarArea.innerHTML = "";
  emptyState.hidden = true;
  emptyState.textContent = "No days match the current filter.";

  if (!state.rows.length) {
    emptyState.textContent = "No CSV rows to display.";
    emptyState.hidden = false;
    return;
  }

  const months = monthIterator();
  const grid = document.createElement("div");
  grid.className = "months-grid";
  const today = new Date();
  let anyMatches = false;

  months.forEach(({ year, month }) => {
    const card = document.createElement("article");
    card.className = "month-card";

    const title = document.createElement("h2");
    title.className = "month-title";
    title.textContent = `${MONTHS[month]} ${year}`;
    card.appendChild(title);

    const weekGrid = document.createElement("div");
    weekGrid.className = "month-grid";

    DAYS.forEach((day) => {
      const label = document.createElement("div");
      label.className = "weekday";
      label.textContent = day;
      weekGrid.appendChild(label);
    });

    const firstOfMonth = new Date(year, month, 1);
    let cursor = new Date(year, month, 1 - firstOfMonth.getDay());

    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(cursor);
      const cell = document.createElement("button");
      cell.className = "day-cell";
      cell.type = "button";

      if (cellDate.getMonth() !== month) {
        cell.classList.add("other-month", "empty");
        cell.disabled = true;
      }

      const num = document.createElement("span");
      num.className = "day-number";
      num.textContent = cellDate.getDate();
      cell.appendChild(num);

      const key = dateKey(cellDate);
      const activeEvents = cellDate.getMonth() === month ? getFilteredRecordsForDate(key) : [];
      const activeCamps = cellDate.getMonth() === month ? getCampsForDate(key) : [];
      cell.dataset.date = key;
      cell.setAttribute("aria-label", `${formatDate(cellDate)}: ${activeEvents.length} matching school events, ${activeCamps.length} published camp options`);
      const isToday =
        cellDate.getDate() === today.getDate() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear();

      if (isToday) cell.classList.add("today-marker");

      if (activeEvents.length > 0) {
        anyMatches = true;
        cell.classList.add("has-event");
        activeEvents.slice(0, 2).forEach((ev) => {
          const pill = document.createElement("span");
          pill.className = "pill";
          pill.style = getClassForPill(ev);
          const abbrev = document.createElement("span");
          abbrev.textContent = ev.schoolShort;
          pill.appendChild(abbrev);
          pill.title = `${ev.school}: ${ev.event} (${ev.type})`;
          cell.appendChild(pill);
        });
        if (activeEvents.length > 2) {
          const plus = document.createElement("span");
          plus.className = "event-more";
          plus.textContent = `+${activeEvents.length - 2}`;
          cell.appendChild(plus);
        }
      }

      if (activeCamps.length) {
        anyMatches = true;
        cell.classList.add("has-camp");
        const badge = document.createElement("span");
        badge.className = "camp-count";
        badge.textContent = `${activeCamps.length} camp${activeCamps.length === 1 ? "" : "s"}`;
        badge.title = "Published camp dates; click for booking requirements and registration links";
        cell.appendChild(badge);
      }

      if (!cell.classList.contains("other-month")) {
        cell.addEventListener("click", () => {
          showDetails(cellDate, activeEvents);
        });
      }

      weekGrid.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }

    card.appendChild(weekGrid);
    grid.appendChild(card);
  });

  calendarArea.appendChild(grid);
  emptyState.hidden = anyMatches;
}

function refreshAll() {
  updateSummary();
  drawLegend();
  renderMonths();
}

function wireButtons() {
  selectAllSchools.addEventListener("click", () => {
    state.schools.forEach((school) => state.activeSchools.add(school));
    Array.from(schoolFilters.querySelectorAll("input")).forEach((box) => {
      box.checked = true;
    });
    refreshAll();
  });

  clearSchools.addEventListener("click", () => {
    state.activeSchools.clear();
    Array.from(schoolFilters.querySelectorAll("input")).forEach((box) => {
      box.checked = false;
    });
    refreshAll();
  });

  selectAllTypes.addEventListener("click", () => {
    state.types.forEach((type) => state.activeTypes.add(type));
    Array.from(typeFilters.querySelectorAll("input")).forEach((box) => {
      box.checked = true;
    });
    refreshAll();
  });

  clearTypes.addEventListener("click", () => {
    state.activeTypes.clear();
    Array.from(typeFilters.querySelectorAll("input")).forEach((box) => {
      box.checked = false;
    });
    refreshAll();
  });

  drawerClose.addEventListener("click", hideDetails);
  drawer.addEventListener("click", (e) => {
    const rect = drawer.getBoundingClientRect();
    if (e.target === drawer &&
        (e.clientX < rect.left || e.clientX > rect.right ||
         e.clientY < rect.top || e.clientY > rect.bottom)) hideDetails();
  });
}

function initializeControls() {
  buildFilterList(schoolFilters, state.schools, state.activeSchools, refreshAll);
  buildFilterList(typeFilters, state.types, state.activeTypes, refreshAll);
  refreshAll();
}

function handleDataLoad(csvText, source) {
  const parsed = parseCSV(csvText);
  if (!parsed.length || !Object.keys(parsed[0] || {}).length) {
    throw new Error("CSV appears empty or malformed.");
  }
  buildRows(parsed);
  hideDetails();
  state.activeSchools = new Set(state.schools);
  state.activeTypes = new Set(state.types);
  initializeControls();
  statusMessage.textContent = `Loaded ${state.rows.length} entries from ${source}`;
  uploadHint.hidden = true;
  openLinkedDate();
}

let linkedDateOpened = false;
function openLinkedDate() {
  if (linkedDateOpened || !state.rows.length || (!campState.data && !campState.error)) return;
  const params = new URLSearchParams(location.search);
  const key = params.get("date");
  const date = toLocalDate(key);
  if (!date) return;
  if (params.get("age") === "6") {
    campState.age = 6;
    document.getElementById("campAge").value = "6";
  }
  if (params.get("multi") === "1") {
    campState.multiDay = true;
    document.getElementById("multiDayCamps").checked = true;
  }
  renderMonths();
  const cell = calendarArea.querySelector(`.day-cell[data-date="${key}"]:not(.other-month)`);
  if (!cell) return;
  linkedDateOpened = true;
  cell.scrollIntoView({ block: "center" });
  showDetails(date, getFilteredRecordsForDate(key));
}

async function tryFetchCSV() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(DEFAULT_CSV, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    try {
      handleDataLoad(csvText, "CSV server file");
    } catch (err) {
      throw new Error(`CSV parse issue: ${err.message}`);
    }
  } catch (error) {
    statusMessage.textContent = `Could not auto-load CSV (${error.message}).`;
    uploadHint.hidden = false;
  } finally {
    clearTimeout(timeout);
  }
}

csvFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    handleDataLoad(text, "manually selected file");
    statusMessage.textContent = `Loaded ${state.rows.length} entries from uploaded file`;
    uploadHint.hidden = true;
  } catch (error) {
    statusMessage.textContent = `Could not read uploaded file: ${error.message}`;
  }
});

wireButtons();
