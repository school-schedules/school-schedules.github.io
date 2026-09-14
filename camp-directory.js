const directoryLabels = {
  dated: "Published dates",
  announced: "2026–27 announced · dates to check",
  lead: "Lead · dates not verified",
  restricted: "Enrolled families only",
};

function providerCard(provider, sessions) {
  const { element, fact, link } = CampData;
  const card = element("article", "", "provider-card panel");
  card.id = provider.Provider_ID;
  card.dataset.status = provider.Status;
  card.dataset.search = [provider.Name, provider.Category, provider.Location, provider.Summary].join(" ").toLowerCase();
  card.append(element("p", directoryLabels[provider.Status], "camp-tag"));
  card.append(element("h2", provider.Name));
  card.append(element("p", provider.Summary));
  fact(card, "Ages", provider.Ages);
  fact(card, "Where", provider.Location);
  fact(card, "Hours", provider.Hours);
  fact(card, "Extended care", provider.Extended_Care);
  fact(card, "Cost", provider.Cost);
  card.append(element("p", provider.Notes, "provider-notes"));
  card.append(element("p", "Checked " + CampData.displayDate(provider.Last_Checked), "small"));
  const actions = element("div", "", "camp-links");
  actions.append(link(provider.Registration_URL, provider.Registration_Label, "registration-link"));
  actions.append(link(provider.Source_URL, "Program source"));
  card.append(actions);
  if (sessions.length) {
    const details = element("details", "", "session-schedule");
    details.append(element("summary", `${sessions.length} published sessions · view dates & registration`));
    const wrap = element("div", "", "table-scroll");
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", provider.Name + " camp dates");
    const table = element("table");
    table.setAttribute("role", "table");
    table.append(element("caption", provider.Name + " · 2026–27 published camp sessions"));
    const head = element("thead");
    head.setAttribute("role", "rowgroup");
    const tr = element("tr");
    tr.setAttribute("role", "row");
    ["Dates / booking", "Cost / status", "Links"].forEach(text => {
      const th = element("th", text);
      th.scope = "col";
      th.setAttribute("role", "columnheader");
      tr.append(th);
    });
    head.append(tr);
    table.append(head);
    const body = element("tbody");
    body.setAttribute("role", "rowgroup");
    sessions.forEach(session => {
      const row = element("tr");
      row.setAttribute("role", "row");
      const dates = element("td");
      dates.setAttribute("role", "cell");
      dates.append(element("strong", CampData.range(session)));
      dates.append(element("p", session.Booking_Type === "single-day" ? "Single day" : "Whole session required", "small"));
      dates.append(element("p", session.Program + " · " + session.Hours, "small"));
      if (session.Notes) dates.append(element("p", session.Notes, "small"));
      if (session.Location !== provider.Location) dates.append(element("p", session.Location, "small"));
      const info = element("td");
      info.setAttribute("role", "cell");
      const costLabel = element("span", "Cost & availability", "mobile-schedule-label");
      costLabel.setAttribute("aria-hidden", "true");
      info.append(costLabel, document.createTextNode(session.Cost));
      info.append(element("p", CampData.status(session), "small"));
      const links = element("td", "", "table-links");
      links.setAttribute("role", "cell");
      const linksLabel = element("span", "Registration & sources", "mobile-schedule-label");
      linksLabel.setAttribute("aria-hidden", "true");
      links.append(linksLabel);
      links.append(link(session.Registration_URL, CampData.registrationLabel(session)));
      links.append(link(session.Source_URL, "Date source"));
      const calendar = element("a", "See in calendar");
      calendar.href = `./?date=${session.Start_Date}${session.Booking_Type === "multi-day" ? "&multi=1" : ""}${Number(provider.Minimum_Age) > 5 ? "&age=6" : ""}`;
      links.append(calendar);
      row.append(dates, info, links);
      body.append(row);
    });
    table.append(body);
    wrap.append(table);
    details.append(wrap);
    card.append(details);
  }
  return card;
}

function filterDirectory() {
  const query = document.getElementById("campSearch").value.trim().toLowerCase();
  const filter = document.getElementById("directoryFilter").value;
  let visible = 0;
  document.querySelectorAll(".provider-card").forEach(card => {
    const matchesStatus = filter === "all" || card.dataset.status === filter ||
      (filter === "undated" && ["announced", "lead"].includes(card.dataset.status));
    card.hidden = !matchesStatus || !card.dataset.search.includes(query);
    if (!card.hidden) visible++;
  });
  document.getElementById("directoryCount").textContent = `${visible} provider${visible === 1 ? "" : "s"} shown`;
  document.getElementById("directoryEmpty").hidden = visible > 0;
}

async function initializeDirectory() {
  try {
    const data = await CampData.load();
    const dated = data.providers.filter(p => p.Status === "dated").length;
    const single = data.sessions.filter(s => s.Booking_Type === "single-day").length;
    document.getElementById("directoryStatus").textContent =
      `${data.providers.length} providers and leads · ${dated} with published dates · ${single} single-day sessions + ${data.sessions.length - single} multi-day sessions. Research check: ${data.checked}.`;
    const order = { dated: 0, announced: 1, lead: 2, restricted: 3 };
    const providers = [...data.providers].sort((a, b) => order[a.Status] - order[b.Status] || a.Name.localeCompare(b.Name));
    const directory = document.getElementById("providerDirectory");
    const sources = document.getElementById("sourceList");
    providers.forEach(provider => {
      directory.append(providerCard(provider, data.sessions.filter(s => s.Provider_ID === provider.Provider_ID)));
      const source = CampData.element("li");
      source.append(CampData.link(provider.Source_URL, provider.Name + " — program page"));
      if (provider.Registration_URL !== provider.Source_URL && /^https?:/.test(provider.Registration_URL)) {
        source.append(document.createTextNode(" · "), CampData.link(provider.Registration_URL, "Official booking portal"));
      }
      provider.Additional_Sources.split("|").filter(Boolean).forEach((url, index) => {
        source.append(document.createTextNode(" · "), CampData.link(url, "Additional source " + (index + 1)));
      });
      sources.append(source);
    });
    document.getElementById("campSearch").addEventListener("input", filterDirectory);
    document.getElementById("directoryFilter").addEventListener("change", filterDirectory);
    filterDirectory();
    const anchor = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (anchor) anchor.scrollIntoView();
  } catch (error) {
    document.getElementById("directoryStatus").textContent = `Could not load the directory (${error.message}). Reload to retry, or use the CSV downloads below.`;
  }
}

initializeDirectory();
