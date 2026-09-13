/* Shared data and rendering for the calendar and the camp directory. */
const CampData = (() => {
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function link(url, label, className = "") {
    const node = element("a", label, className);
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      node.href = url;
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
    return node;
  }

  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid camp date: ${value}`);
    const [y, m, d] = value.split("-").map(Number);
    const result = new Date(y, m - 1, d);
    if (result.getFullYear() !== y || result.getMonth() !== m - 1 || result.getDate() !== d) {
      throw new Error(`Invalid camp date: ${value}`);
    }
    return result;
  }

  function key(value) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  function displayDate(value) {
    return date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function range(session) {
    return session.Start_Date === session.End_Date ? displayDate(session.Start_Date) :
      `${displayDate(session.Start_Date)} – ${displayDate(session.End_Date)}`;
  }

  async function readCSV(path, headers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      const result = parseCSV(await response.text(), headers);
      if (!result.length) throw new Error(`${path} is empty`);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function load() {
    const [providers, sessions] = await Promise.all([
      readCSV("./camp_providers.csv", ["Provider_ID", "Name", "Minimum_Age", "Status", "Source_URL", "Last_Checked"]),
      readCSV("./camp_sessions.csv", ["Session_ID", "Provider_ID", "Start_Date", "End_Date", "Booking_Type", "Registration_URL", "Source_URL", "Last_Checked"]),
    ]);
    const byProvider = new Map();
    providers.forEach(provider => {
      if (!provider.Provider_ID || byProvider.has(provider.Provider_ID)) throw new Error("Duplicate or missing camp provider ID");
      if (!/^\d+$/.test(provider.Minimum_Age)) throw new Error("Invalid camp minimum age");
      if (!["dated", "announced", "lead", "restricted"].includes(provider.Status)) throw new Error("Invalid provider status");
      date(provider.Last_Checked);
      byProvider.set(provider.Provider_ID, provider);
    });
    const byDate = new Map();
    const ids = new Set();
    sessions.forEach(session => {
      if (!session.Session_ID || ids.has(session.Session_ID)) throw new Error("Duplicate or missing camp session ID");
      ids.add(session.Session_ID);
      const provider = byProvider.get(session.Provider_ID);
      if (!provider || provider.Status !== "dated") throw new Error("Camp session needs a dated provider");
      const start = date(session.Start_Date);
      const end = date(session.End_Date);
      if (end < start || end - start > 14 * 86400000) throw new Error("Invalid camp date range");
      if (!["single-day", "multi-day"].includes(session.Booking_Type) ||
          (session.Booking_Type === "single-day") !== (session.Start_Date === session.End_Date)) {
        throw new Error("Camp booking type does not match its dates");
      }
      for (const field of ["Registration_URL", "Source_URL"]) {
        if (!/^https?:\/\//i.test(session[field])) throw new Error("Camp session needs a web registration and source link");
      }
      date(session.Last_Checked);
      if (session.Registration_Opens) date(session.Registration_Opens);
      session.provider = provider;
      for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const day = key(cursor);
        if (!byDate.has(day)) byDate.set(day, []);
        byDate.get(day).push(session);
      }
    });
    sessions.sort((a, b) => a.Start_Date.localeCompare(b.Start_Date) || a.provider.Name.localeCompare(b.provider.Name));
    const checked = [...new Set(providers.map(p => p.Last_Checked))].sort().join(", ");
    return { providers, sessions, byProvider, byDate, checked };
  }

  function status(session) {
    if (session.Registration_Opens && key(new Date()) >= session.Registration_Opens &&
        session.Availability.startsWith("Registration opens")) {
      return `Scheduled registration opening: ${displayDate(session.Registration_Opens)}; recheck provider`;
    }
    return session.Availability;
  }

  function registrationLabel(session) {
    if (/waitlist/i.test(session.Availability)) return "Check waitlist / register";
    if (session.Registration_Opens && key(new Date()) < session.Registration_Opens) return "View registration · opens " + displayDate(session.Registration_Opens);
    return "Check seats & register";
  }

  function fact(container, label, value) {
    if (!value) return;
    const p = element("p", "", "camp-fact");
    p.append(element("strong", label + ": "), document.createTextNode(value));
    container.append(p);
  }

  function sessionCard(session) {
    const provider = session.provider;
    const card = element("article", "", "camp-card");
    card.dataset.provider = provider.Provider_ID;
    card.dataset.session = session.Session_ID;
    const badge = session.Booking_Type === "multi-day" ? "Multi-day booking required" : "Single-day booking";
    card.append(element("p", badge, "camp-tag"));
    card.append(element("h4", provider.Name));
    card.append(element("p", session.Program, "camp-program"));
    fact(card, "Ages", provider.Ages);
    fact(card, "Dates", range(session));
    fact(card, "Hours", session.Hours);
    fact(card, "Care", /no aftercare/i.test(session.Notes) ? session.Notes : provider.Extended_Care);
    fact(card, "Cost", session.Cost);
    fact(card, "Where", session.Location);
    if (session.Notes) card.append(element("p", session.Notes, "small"));
    const availability = element("p", `${status(session)} · checked ${displayDate(session.Last_Checked)}`, "camp-availability");
    if (/waitlist/i.test(session.Availability)) availability.classList.add("waitlist");
    card.append(availability);
    const actions = element("div", "", "camp-links");
    actions.append(link(session.Registration_URL, registrationLabel(session), "registration-link"));
    actions.append(link(session.Source_URL, "Date source"));
    actions.append(link(provider.Source_URL, "Program details"));
    const directory = element("a", "Provider notes");
    directory.href = `./camps.html#${provider.Provider_ID}`;
    actions.append(directory);
    card.append(actions);
    return card;
  }

  return { load, date, key, displayDate, range, status, registrationLabel, sessionCard, element, link, fact };
})();
