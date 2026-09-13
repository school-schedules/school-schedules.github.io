# Triangle School Calendar Explorer

Live site: https://school-schedules.github.io/

This static website reads `triangle_school_closures_2026_2027.csv` on each page load and displays:

- clickable monthly calendars,
- school toggles,
- day-off type toggles,
- Durham County camp options for kindergarten, with age, provider and multi-day booking filters,
- a [camp directory](https://school-schedules.github.io/camps.html) with schedules, registration links, sources and undated leads.

The camp research covers September 2026–May 2027 and was checked September 12, 2026. See [camp-research.md](camp-research.md) for the search scope, evidence decisions and follow-up priorities. Published dates do not guarantee available seats.

To run:

1. Open a terminal in this folder.
2. Start a tiny local server:
   - `python3 -m http.server 8000`
3. Open `http://127.0.0.1:8000/index.html` in your browser.

If the CSV cannot be auto-loaded (for example, when opened with `file://`), use the file picker in the left panel to load the CSV manually.
Camp data requires HTTP hosting (the local server above or GitHub Pages). A camp-data error does not prevent school CSV loading or manual preview.

## Camp data

The calendar and directory both fetch these files on each load; there is no separate schedule embedded in JavaScript:

- `camp_providers.csv`: one row per provider, including eligibility, location, hours, fees, sources and last check date. `Status` is `dated`, `announced`, `lead` or `restricted`. `Minimum_Age=0` means eligibility is specified by grade or needs confirmation; read the `Ages` field. It does not mean all ages are accepted.
- `camp_sessions.csv`: one row per bookable session with inclusive start/end dates, `single-day` or `multi-day` booking type, registration status, source and registration URLs. Multi-day sessions are shown across their published range only when enabled. Split noncontiguous dates into separate rows; never stretch a range across a closure within a camp week.

Only `dated` providers may have session rows. Do not generate camp dates from school closures or assign dates to unverified leads. Retain waitlist and registration-opening details, and update `Last_Checked` only after reviewing the relevant primary source. Numeric age minimums apply to the camp date; the default is five. Enrolled-student-only care stays in the directory rather than the public overlay.

To validate data after edits, run `node tests/validate-data.mjs` (Node 18+; no packages needed). The tests include the initial research inventory counts; update those assertions when intentionally adding or removing sessions. The original 137 school records are preserved.

Verification for this update: data integrity checks and 48 browser checks covering school filters, camp controls, age eligibility, multi-day bookings, source/registration links, directory search, mobile layout, dialog dismissal and CSV failure recovery. Browser checks were run in isolated headless Chrome.

## Publish and update

The repository is `school-schedules/school-schedules.github.io`. GitHub Pages serves the root of the `main` branch. `.nojekyll` allows the HTML, CSS, JavaScript, and CSV to be served directly without a site generator.

To update the calendar, edit `triangle_school_closures_2026_2027.csv` and commit and push it to `main` (or edit and commit it on GitHub). GitHub Pages republishes automatically. The calendar derives its schools, day types, and date range from the CSV; there is no separate copy of the schedule in JavaScript.

Keep the CSV headers and use `YYYY-MM-DD` dates. `Date`, `School`, and `Closure_Type` are required. Event notes, scope, and source links appear in date details. Some schools have partial coverage as documented in the CSV; missing entries do not establish that school is in session.

The file picker previews a school CSV in the current browser only; it does not change the published schedule. When changing CSS or JavaScript, update the asset versions in both `index.html` and `camps.html` so returning visitors receive the changes together.

Directory links may open the calendar at a date using `?date=YYYY-MM-DD`; `&age=6` and `&multi=1` enable matching options when needed.
