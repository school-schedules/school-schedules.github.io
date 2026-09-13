// Shared parser for the school and camp CSV files.
function parseCSV(text, requiredHeaders = ["Date", "School", "Closure_Type"]) {
  const normalized = text.trim().replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let quoted = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < normalized.length) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 2;
        continue;
      }

      if (char === '"') {
        quoted = false;
        i += 1;
        continue;
      }

      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (char === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");

  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  const headers = (rows[0] || []).map((header) => header.trim());
  if (!requiredHeaders.every((header) => headers.includes(header))) {
    throw new Error(`CSV needs these columns: ${requiredHeaders.join(", ")}.`);
  }
  return rows.slice(1).filter((row) => row.some((field) => field.trim())).map((rawRow) => {
    const rowObj = {};
    for (let c = 0; c < headers.length; c += 1) {
      rowObj[headers[c]] = (rawRow[c] ?? "").trim();
    }
    return rowObj;
  });
}
