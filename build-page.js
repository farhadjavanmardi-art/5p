// Wraps app.html (the same file published as the claude.ai artifact) into public/index.html,
// loading claude-shim.js first so window.claude points at our own server.
import fs from "node:fs";
const app = fs.readFileSync(new URL("./app.html", import.meta.url), "utf8");
const page = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script src="claude-shim.js"></script>
</head>
<body>
${app}
</body>
</html>
`;
fs.writeFileSync(new URL("./public/index.html", import.meta.url), page);
console.log("public/index.html built");
