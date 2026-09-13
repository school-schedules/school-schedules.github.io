const campState = {
  data: null,
  error: "",
  activeProviders: new Set(),
  visible: true,
  age: 5,
  multiDay: false,
};

function getCampsForDate(key) {
  if (!campState.visible || !campState.data) return [];
  return (campState.data.byDate.get(key) || []).filter(session =>
    campState.activeProviders.has(session.Provider_ID) &&
    Number(session.provider.Minimum_Age) <= campState.age &&
    (campState.multiDay || session.Booking_Type === "single-day")
  ).sort((a, b) => a.provider.Name.localeCompare(b.provider.Name) || a.Start_Date.localeCompare(b.Start_Date));
}

function appendCampDetails(container, key) {
  const section = CampData.element("section", "", "camp-details");
  section.append(CampData.element("h3", "Day camps"));
  if (!campState.visible) {
    section.append(CampData.element("p", "Camps are hidden. Turn on “Show day camps” in the calendar filters."));
  } else if (!campState.data) {
    section.append(CampData.element("p", campState.error || "Camp data is loading…"));
  } else {
    const matches = getCampsForDate(key);
    section.append(CampData.element("p", matches.length ?
      `${matches.length} published camp option${matches.length === 1 ? "" : "s"} for your filters. Dates and registration status are a research snapshot; check seats with the provider.` :
      "No published camp dates match these filters. This does not mean no care exists on this date.", "summary"));
    if (!campState.multiDay) {
      section.append(CampData.element("p", "Showing single-day bookings. Enable multi-day camps in the filters to include full-week and short-week options.", "small"));
    }
    matches.forEach(session => section.append(CampData.sessionCard(session)));
  }
  const directory = CampData.element("a", "Browse all providers, unannounced dates and research sources →");
  directory.href = "./camps.html";
  section.append(directory);
  container.append(section);
}

function updateCampView() {
  document.getElementById("campOptions").disabled = !campState.visible || !campState.data;
  refreshAll();
  if (drawer.open && drawer.dataset.date) {
    const key = drawer.dataset.date;
    showDetails(toLocalDate(key), getFilteredRecordsForDate(key));
  }
}

async function initializeCamps() {
  const status = document.getElementById("campStatus");
  document.getElementById("showCamps").addEventListener("change", event => {
    campState.visible = event.target.checked;
    updateCampView();
  });
  document.getElementById("campAge").addEventListener("change", event => {
    campState.age = Number(event.target.value);
    updateCampView();
  });
  document.getElementById("multiDayCamps").addEventListener("change", event => {
    campState.multiDay = event.target.checked;
    updateCampView();
  });
  try {
    campState.data = await CampData.load();
    const providers = campState.data.providers.filter(provider => provider.Status === "dated").sort((a, b) => a.Name.localeCompare(b.Name));
    const filters = document.getElementById("campFilters");
    providers.forEach(provider => {
      campState.activeProviders.add(provider.Provider_ID);
      const label = CampData.element("label", "", "filter-line");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = provider.Provider_ID;
      checkbox.checked = true;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) campState.activeProviders.add(provider.Provider_ID);
        else campState.activeProviders.delete(provider.Provider_ID);
        updateCampView();
      });
      label.append(checkbox, CampData.element("span", provider.Name + (Number(provider.Minimum_Age) > 5 ? " (6+)" : "")));
      filters.append(label);
    });
    for (const [id, checked] of [["selectAllCamps", true], ["clearCamps", false]]) {
      document.getElementById(id).addEventListener("click", () => {
        campState.activeProviders.clear();
        if (checked) providers.forEach(p => campState.activeProviders.add(p.Provider_ID));
        filters.querySelectorAll("input").forEach(box => { box.checked = checked; });
        updateCampView();
      });
    }
    status.textContent = `${providers.length} providers with dates · researched ${campState.data.checked}. Age six adds Ninja Challenge.`;
    updateCampView();
    openLinkedDate();
  } catch (error) {
    campState.error = `Camp data could not load (${error.message}). Reload the page to retry; the school calendar still works.`;
    status.textContent = campState.error;
    updateCampView();
    openLinkedDate();
  }
}

// Start both independent loads only after every calendar script is defined.
tryFetchCSV();
initializeCamps();
