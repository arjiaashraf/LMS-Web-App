
const fs = require("node:fs");
const path = require("node:path");

const files = [
  "StudentAttendance.tsx",
  "StudentExamAttempt.tsx",
  "StudentOnlineClasses.tsx",
  "StudentProfile.tsx",
  "Students.tsx",
];

for (const name of files) {
  const file = path.join("src", "pages", name);

  if (!fs.existsSync(file)) {
    console.log(`SKIPPED: ${name} not found`);
    continue;
  }

  const original = fs.readFileSync(file, "utf8");

  // Preserve all existing JSX, forms and logic.
  let updated = original;

  // Convert API_BASE/API template URLs.
  updated = updated.replaceAll(
    "${API_BASE}/api/",
    "/api/"
  );

  updated = updated.replaceAll(
    "${API}/api/",
    "/api/"
  );

  // Convert direct localhost API URLs.
  updated = updated.replaceAll(
    "http://localhost:5000/api/",
    "/api/"
  );

  // Remove unused local API constants.
  if (!updated.includes("${API_BASE}")) {
    updated = updated.replace(
      /const API_BASE = "http:\/\/localhost:5000";\s*/,
      ""
    );
  }

  if (!updated.includes("${API}")) {
    updated = updated.replace(
      /const API = "http:\/\/localhost:5000";\s*/,
      ""
    );
  }

  if (updated === original) {
    console.log(`UNCHANGED: ${name}`);
    continue;
  }

  // Ensure requests use the JWT-enabled API client.
  if (!updated.includes("apiFetch as fetch")) {
    console.log(
      `REVIEW REQUIRED: ${name} does not import apiFetch as fetch`
    );
    continue;
  }

  fs.writeFileSync(
    `${file}.bak`,
    original,
    "utf8"
  );

  fs.writeFileSync(file, updated, "utf8");

  console.log(`FIXED: ${name}`);
}

console.log("API URL migration finished.");
