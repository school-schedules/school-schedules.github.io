# Triangle School Calendar Explorer

Live site: https://school-schedules.github.io/

This static website reads `triangle_school_closures_2026_2027.csv` on each page load and displays:

- clickable monthly calendars,
- school toggles,
- and day-off type toggles.

To run:

1. Open a terminal in this folder.
2. Start a tiny local server:
   - `python3 -m http.server 8000`
3. Open `http://127.0.0.1:8000/index.html` in your browser.

If the CSV cannot be auto-loaded (for example, when opened with `file://`), use the file picker in the left panel to load the CSV manually.

## Publish and update

The repository is `school-schedules/school-schedules.github.io`. GitHub Pages serves the root of the `main` branch. `.nojekyll` allows the HTML, CSS, JavaScript, and CSV to be served directly without a site generator.

To update the calendar, edit `triangle_school_closures_2026_2027.csv` and commit and push it to `main` (or edit and commit it on GitHub). GitHub Pages republishes automatically. The calendar derives its schools, day types, and date range from the CSV; there is no separate copy of the schedule in JavaScript.

Keep the CSV headers and use `YYYY-MM-DD` dates. `Date`, `School`, and `Closure_Type` are required. Event notes, scope, and source links appear in date details. Some schools have partial coverage as documented in the CSV; missing entries do not establish that school is in session.

The file picker previews a CSV in the current browser only; it does not change the published schedule. When changing CSS or JavaScript, update the asset version in `index.html` so returning visitors receive both changes together.
